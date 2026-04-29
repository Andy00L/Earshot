import { Container, Sprite, Assets, Texture } from "pixi.js";

const ARROW_TARGET_HEIGHT = 56;
const ARROW_HOVER_OFFSET = 30;
const PULSE_PERIOD_MS = 1200;
const FLOAT_AMPLITUDE_PX = 6;
const FADE_IN_MS = 400;
const FADE_OUT_MS = 400;

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
