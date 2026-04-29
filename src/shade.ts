import { Container, Sprite, Texture } from "pixi.js";

// Visual shrink factor for the loot bag. Reduces the shade sprite and
// glow halo proportionally. Tune in one place if the bag footprint
// needs adjustment. Does NOT affect pickup hitbox (fixed 80 px radius).
const LOOT_VISUAL_SHRINK = 0.65;
if (LOOT_VISUAL_SHRINK <= 0 || LOOT_VISUAL_SHRINK > 2) {
  throw new Error(`LOOT_VISUAL_SHRINK out of range: ${LOOT_VISUAL_SHRINK}`);
}

/**
 * Visual representation of the shade (death-drop inventory pile).
 * The stageContainer is added to the stage above the flashlight darkness layer
 * so the glow is always visible, even at Beacon=0.
 */
export class ShadeVisual {
  public stageContainer: Container;
  private sprite: Sprite;
  private glow: Sprite;
  private frames: Texture[];
  private elapsed = 0;
  public worldX: number;
  public worldY: number;

  constructor(
    stage: Container,
    worldX: number,
    worldY: number,
    frames: Texture[],
  ) {
    this.worldX = worldX;
    this.worldY = worldY;

    this.stageContainer = new Container();
    this.stageContainer.zIndex = 110; // above flashlight (100), below vignette (150)
    stage.addChild(this.stageContainer);

    // Glow (radial gradient, visible through darkness)
    const glowTexture = ShadeVisual.createGlowTexture();
    this.glow = new Sprite(glowTexture);
    this.glow.anchor.set(0.5, 0.5);
    this.glow.alpha = 0.7;
    this.glow.scale.set(LOOT_VISUAL_SHRINK);
    this.stageContainer.addChild(this.glow);

    // Shade pile sprite (3-frame pulse loop at ~3 fps)
    this.frames = frames;
    this.sprite = new Sprite(frames[0]);
    this.sprite.anchor.set(0.5, 1.0);
    const shadeScale = (220 * LOOT_VISUAL_SHRINK) / this.sprite.texture.height;
    this.sprite.scale.set(shadeScale);
    this.stageContainer.addChild(this.sprite);
  }

  private static createGlowTexture(): Texture {
    const size = 400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, "rgba(180, 220, 255, 0.6)");
    gradient.addColorStop(0.5, "rgba(150, 200, 255, 0.3)");
    gradient.addColorStop(1, "rgba(100, 150, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
  }

  update(dtMS: number, worldOffsetX: number, worldOffsetY: number): void {
    this.elapsed += dtMS / 1000;

    // Track world camera offset so sprite follows room scrolling
    this.stageContainer.x = this.worldX + worldOffsetX;
    this.stageContainer.y = this.worldY + worldOffsetY;

    // Animate sprite frames (3 fps cycle)
    const frameIdx = Math.floor(this.elapsed * 3) % 3;
    this.sprite.texture = this.frames[frameIdx];

    // Pulse glow
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2);
    this.glow.alpha = 0.5 + 0.3 * pulse;
  }

  isPlayerInRange(playerX: number, playerY: number): boolean {
    const dx = playerX - this.worldX;
    const dy = playerY - this.worldY;
    return Math.hypot(dx, dy) < 80;
  }

  destroy(): void {
    this.stageContainer.parent?.removeChild(this.stageContainer);
    this.stageContainer.destroy({ children: true });
  }
}
