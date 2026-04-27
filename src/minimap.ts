import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { RoomId } from "./types";

// Hub-and-spokes layout: Server is center, 4 spokes radiate out.
// Normalized coords: (0,0) = top-left of inner playable area, (1,1) = bottom-right.
const ROOM_POSITIONS: Record<RoomId, { nx: number; ny: number }> = {
  stairwell: { nx: 0.50, ny: 0.18 },
  cubicles:  { nx: 0.20, ny: 0.50 },
  server:    { nx: 0.50, ny: 0.50 },
  archives:  { nx: 0.80, ny: 0.50 },
  reception: { nx: 0.50, ny: 0.85 },
};

// Room connections for line drawing. Vent shortcut (Cubicles to Stairwell)
// is omitted for a clean parchment look.
const CONNECTIONS: [RoomId, RoomId][] = [
  ["stairwell", "server"],
  ["cubicles",  "server"],
  ["server",    "archives"],
  ["server",    "reception"],
];

// Display dimensions. Source textures are scaled down to fit the HUD.
const FRAME_W = 240;
const FRAME_H = 180;

// Parchment frame inner playable area, measured per-edge from minimap-frame.png alpha.
// Phase 9D Issue 3: measured via scanning the inner boundary of the opaque border.
// Fractions of frame dimensions; stable across display-size changes.
// https://pixijs.com/8.x/guides/components/textures
const FRAME_INSET_TOP_PCT    = 0.0450;
const FRAME_INSET_RIGHT_PCT  = 0.0336;
const FRAME_INSET_BOTTOM_PCT = 0.0419;
const FRAME_INSET_LEFT_PCT   = 0.0324;
const TILE_W = 36;
const TILE_H = 26;
const DOT_DISPLAY = 14;
const FADE_MS = 600;
const PULSE_MS = 1200;
const LINE_COLOR = 0x88684a;  // Parchment ink tone.

export class Minimap {
  public readonly container: Container;
  private connections: Graphics;
  private roomTiles = new Map<RoomId, Sprite>();
  private playerDot: Sprite | null = null;
  private dotBaseScaleX = 0;
  private dotBaseScaleY = 0;
  // VISITED ROOMS PERSIST ACROSS DEATHS BY DESIGN (Phase 9D Issue 4, decision A).
  // The visited Set is part of the player's accumulated knowledge,
  // reset only on full game restart (new Game instance).
  private visitedRooms = new Set<RoomId>();
  private currentRoom: RoomId | null = null;
  private timeMs = 0;
  private fadeState: "hidden" | "fading_in" | "visible" = "hidden";
  private fadeElapsed = 0;
  private texturesLoaded = false;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.container.alpha = 0;
    this.connections = new Graphics();
    this.initSprites();
  }

  private initSprites(): void {
    // Frame: parchment background with golden corners.
    // Pixi v8 Sprite: https://pixijs.com/8.x/guides/components/sprites
    const frameTex = Assets.get<Texture>("ui:minimap-frame");
    if (!frameTex) {
      console.warn("Minimap: texture 'ui:minimap-frame' not found, minimap disabled");
      return;
    }
    const frame = new Sprite(frameTex);
    frame.anchor.set(0, 0);
    frame.width = FRAME_W;
    frame.height = FRAME_H;
    this.container.addChild(frame);

    // Connection lines between rooms (drawn once, below tiles).
    // Pixi v8 Graphics: https://pixijs.com/8.x/guides/components/graphics
    this.container.addChild(this.connections);
    this.drawConnections();

    // Room tiles: one per room, anchored at center.
    const tileTex = Assets.get<Texture>("ui:minimap-room-tile");
    if (!tileTex) {
      console.warn("Minimap: texture 'ui:minimap-room-tile' not found");
      return;
    }
    for (const roomId of Object.keys(ROOM_POSITIONS) as RoomId[]) {
      const tile = new Sprite(tileTex);
      tile.anchor.set(0.5, 0.5);
      tile.width = TILE_W;
      tile.height = TILE_H;
      const pos = this.roomPixelPos(roomId);
      tile.x = pos.x;
      tile.y = pos.y;
      // Unvisited: dimmed tint + low alpha.
      // Pixi v8 tint: https://pixijs.com/8.x/guides/components/sprites#tinting
      tile.tint = 0x666666;
      tile.alpha = 0.45;
      this.container.addChild(tile);
      this.roomTiles.set(roomId, tile);
    }

    // Player dot: white circle with border, pulsing.
    const dotTex = Assets.get<Texture>("ui:minimap-player-dot");
    if (!dotTex) {
      console.warn("Minimap: texture 'ui:minimap-player-dot' not found");
      return;
    }
    this.playerDot = new Sprite(dotTex);
    this.playerDot.anchor.set(0.5, 0.5);
    this.dotBaseScaleX = DOT_DISPLAY / dotTex.width;
    this.dotBaseScaleY = DOT_DISPLAY / dotTex.height;
    this.playerDot.scale.set(this.dotBaseScaleX, this.dotBaseScaleY);
    this.playerDot.visible = false;
    this.container.addChild(this.playerDot);

    this.texturesLoaded = true;
  }

  /** Convert normalized room position to container-local pixel coordinates. */
  private roomPixelPos(roomId: RoomId): { x: number; y: number } {
    const { nx, ny } = ROOM_POSITIONS[roomId];
    const insetL = FRAME_W * FRAME_INSET_LEFT_PCT;
    const insetR = FRAME_W * FRAME_INSET_RIGHT_PCT;
    const insetT = FRAME_H * FRAME_INSET_TOP_PCT;
    const insetB = FRAME_H * FRAME_INSET_BOTTOM_PCT;
    const innerW = FRAME_W - insetL - insetR;
    const innerH = FRAME_H - insetT - insetB;
    return {
      x: insetL + nx * innerW,
      y: insetT + ny * innerH,
    };
  }

  private drawConnections(): void {
    this.connections.clear();
    for (const [a, b] of CONNECTIONS) {
      const pa = this.roomPixelPos(a);
      const pb = this.roomPixelPos(b);
      this.connections.moveTo(pa.x, pa.y);
      this.connections.lineTo(pb.x, pb.y);
      this.connections.stroke({ color: LINE_COLOR, width: 2, alpha: 1.0 });
    }
  }

  /** Show the minimap with a 600ms fade-in. Idempotent. */
  show(): void {
    if (!this.texturesLoaded) return;
    if (this.fadeState === "fading_in" || this.fadeState === "visible") return;
    this.retintRooms();
    this.updatePlayerDotPosition();
    this.container.visible = true;
    this.container.alpha = 0;
    this.fadeState = "fading_in";
    this.fadeElapsed = 0;
  }

  /** Hide the minimap immediately. */
  hide(): void {
    this.container.visible = false;
    this.container.alpha = 0;
    this.fadeState = "hidden";
    this.fadeElapsed = 0;
  }

  /** Track a room as visited and set it as current. Idempotent per room. */
  onRoomEnter(roomId: RoomId): void {
    this.visitedRooms.add(roomId);
    if (roomId === this.currentRoom) return;
    this.currentRoom = roomId;
    this.retintRooms();
    this.updatePlayerDotPosition();
  }

  /** Per-frame update: fade-in animation and player dot pulse. */
  update(dtMs: number): void {
    if (this.fadeState === "fading_in") {
      this.fadeElapsed += dtMs;
      const t = Math.min(1, this.fadeElapsed / FADE_MS);
      this.container.alpha = t;
      if (t >= 1) this.fadeState = "visible";
    }

    this.timeMs += dtMs;
    if (this.playerDot && this.playerDot.visible) {
      const pulse = 1.0 + 0.075 * Math.sin((this.timeMs / PULSE_MS) * Math.PI * 2);
      this.playerDot.scale.set(this.dotBaseScaleX * pulse, this.dotBaseScaleY * pulse);
    }
  }

  /** Reset all state. Used on full game restart. */
  reset(): void {
    this.visitedRooms.clear();
    this.currentRoom = null;
    this.timeMs = 0;
    this.hide();
    this.retintRooms();
    if (this.playerDot) this.playerDot.visible = false;
  }

  /** Tear down Pixi resources. Shared textures from Assets.get are not destroyed. */
  destroy(): void {
    this.container.destroy({ children: true });
  }

  private retintRooms(): void {
    for (const [roomId, tile] of this.roomTiles) {
      if (this.visitedRooms.has(roomId)) {
        tile.tint = 0xFFFFFF;
        tile.alpha = 1.0;
      } else {
        tile.tint = 0x666666;
        tile.alpha = 0.45;
      }
    }
  }

  private updatePlayerDotPosition(): void {
    if (!this.playerDot || !this.currentRoom) {
      if (this.playerDot) this.playerDot.visible = false;
      return;
    }
    this.playerDot.visible = true;
    const pos = this.roomPixelPos(this.currentRoom);
    this.playerDot.x = pos.x;
    this.playerDot.y = pos.y;
  }
}
