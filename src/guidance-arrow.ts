import { Container, Sprite, Assets, Texture } from "pixi.js";
import { GameState, RoomId, TapeId } from "./types";

const ARROW_TARGET_HEIGHT = 56;
const ARROW_HOVER_OFFSET = 30;
const PULSE_PERIOD_MS = 1200;
const FLOAT_AMPLITUDE_PX = 6;
const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;

// ── Arrow target priority chain ──

export type ArrowTargetType =
  | "keycard"
  | "breaker"
  | "map_fragment"
  | "broken_tape"
  | "tape_station"
  | "whisper_trap"
  | "exit";

export interface ArrowTarget {
  type: ArrowTargetType;
  room: RoomId;
  x: number;
}

const BROKEN_TAPE_LOCATIONS: Record<TapeId, { room: RoomId; x: number }> = {
  broken_tape_01: { room: "cubicles", x: 2100 },
  broken_tape_02: { room: "server", x: 1100 },
  broken_tape_03: { room: "stairwell", x: 1900 },
};

const TAPE_STATION = { room: "reception" as const, x: 1500 };
const WHISPER_TRAP = { room: "archives" as const, x: 1500 };
const EXIT_TARGET = { room: "stairwell" as const, x: 3194 };

function getNextBrokenTape(state: GameState): ArrowTarget | null {
  const allTapes: TapeId[] = ["broken_tape_01", "broken_tape_02", "broken_tape_03"];
  const needed = allTapes.filter(
    (t) => !state.brokenTapesCollected.has(t) && !state.tapesReconstructed.has(t)
  );
  if (needed.length === 0) return null;

  const inCurrentRoom = needed.find(
    (t) => BROKEN_TAPE_LOCATIONS[t].room === state.currentRoom
  );
  const pick = inCurrentRoom ?? needed[0];
  const loc = BROKEN_TAPE_LOCATIONS[pick];
  return { type: "broken_tape", room: loc.room, x: loc.x };
}

export function getArrowTarget(state: GameState): ArrowTarget | null {
  // Critical path (existing behavior preserved)
  if (!state.inventory.has("keycard")) {
    return { type: "keycard", room: "cubicles", x: 1600 };
  }
  if (!state.breakerOn) {
    return { type: "breaker", room: "server", x: 2600 };
  }
  if (!state.hasMapFragment) {
    return { type: "map_fragment", room: "archives", x: 2000 };
  }

  // Post-map-fragment: broken tapes not yet collected
  const tapesNeeded = getNextBrokenTape(state);
  if (tapesNeeded !== null) {
    return tapesNeeded;
  }

  // Collected but not yet reconstructed: point to workbench
  if (state.brokenTapesCollected.size > state.tapesReconstructed.size) {
    return { type: "tape_station", ...TAPE_STATION };
  }

  // Whisper trap, only when player is already in Archives (optional content)
  if (!state.whisperTrapUnlocked && state.currentRoom === "archives") {
    return { type: "whisper_trap", ...WHISPER_TRAP };
  }

  // All objectives complete: point to exit
  return { type: "exit", ...EXIT_TARGET };
}

export class GuidanceArrow {
  public container: Container;
  private sprite: Sprite;
  private ageMs = 0;
  private targetAlpha = 0;
  private direction: "left" | "right" = "right";
  private playerHeightPx: number;

  constructor(playerHeightPx: number) {
    this.playerHeightPx = playerHeightPx;
    this.container = new Container();
    this.container.zIndex = 55;

    const tex = Assets.get<Texture>("ui:arrow-guidance");
    if (!tex || tex === Texture.WHITE) {
      console.warn("Missing ui:arrow-guidance texture, arrow will be invisible");
    }
    this.sprite = new Sprite(tex || Texture.WHITE);
    this.sprite.anchor.set(0.5, 0.5);
    const scale = ARROW_TARGET_HEIGHT / Math.max(1, this.sprite.texture.height);
    this.sprite.scale.set(scale);
    this.container.addChild(this.sprite);

    this.container.alpha = 0;
    this.container.visible = false;
  }

  setDirection(direction: "left" | "right"): void {
    if (this.direction === direction) return;
    this.direction = direction;
    const baseScale = ARROW_TARGET_HEIGHT / Math.max(1, this.sprite.texture.height);
    this.sprite.scale.x = direction === "left" ? -baseScale : baseScale;
    this.sprite.scale.y = baseScale;
  }

  show(): void {
    this.container.visible = true;
    this.targetAlpha = 1;
  }

  hide(): void {
    this.targetAlpha = 0;
  }

  update(playerWorldX: number, playerWorldY: number, dtMs: number): void {
    this.ageMs += dtMs;

    const alphaStep = dtMs / (this.targetAlpha > this.container.alpha ? FADE_IN_MS : FADE_OUT_MS);
    if (this.targetAlpha > this.container.alpha) {
      this.container.alpha = Math.min(1, this.container.alpha + alphaStep);
    } else {
      this.container.alpha = Math.max(0, this.container.alpha - alphaStep);
    }

    if (this.container.alpha <= 0 && this.targetAlpha === 0) {
      this.container.visible = false;
    } else {
      this.container.visible = true;
    }

    const phase = (this.ageMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    const floatY = Math.sin(phase * Math.PI * 2) * FLOAT_AMPLITUDE_PX;

    this.container.x = playerWorldX;
    this.container.y = playerWorldY - this.playerHeightPx - ARROW_HOVER_OFFSET + floatY;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
