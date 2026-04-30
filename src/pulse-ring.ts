import { Container, Graphics } from "pixi.js";

export interface PulseRingOptions {
  x: number;
  y: number;
  parent: Container;
  color?: number;
  baseRadius?: number;
  radiusAmplitude?: number;
  periodMs?: number;
  minAlpha?: number;
  maxAlpha?: number;
  strokeWidth?: number;
  zIndex?: number;
}

export class PulseRing {
  private graphics: Graphics;
  private elapsedMs = 0;
  private active = true;

  private readonly color: number;
  private readonly baseRadius: number;
  private readonly radiusAmplitude: number;
  private readonly periodMs: number;
  private readonly minAlpha: number;
  private readonly maxAlpha: number;
  private readonly strokeWidth: number;

  constructor(opts: PulseRingOptions) {
    this.color = opts.color ?? 0xc4a484;
    this.baseRadius = opts.baseRadius ?? 70;
    this.radiusAmplitude = opts.radiusAmplitude ?? 12;
    this.periodMs = opts.periodMs ?? 2000;
    this.minAlpha = opts.minAlpha ?? 0.3;
    this.maxAlpha = opts.maxAlpha ?? 0.7;
    this.strokeWidth = opts.strokeWidth ?? 2;

    this.graphics = new Graphics();
    this.graphics.x = opts.x;
    this.graphics.y = opts.y;
    this.graphics.zIndex = opts.zIndex ?? 19;
    opts.parent.addChild(this.graphics);

    this.render();
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.elapsedMs = (this.elapsedMs + deltaMs) % this.periodMs;
    this.render();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.graphics.visible = active;
    if (!active) {
      this.elapsedMs = 0;
    }
  }

  destroy(): void {
    this.graphics.parent?.removeChild(this.graphics);
    this.graphics.destroy();
  }

  private render(): void {
    const t = this.elapsedMs / this.periodMs;
    const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2;
    const radius = this.baseRadius + this.radiusAmplitude * (pulse - 0.5);
    const alpha = this.minAlpha + (this.maxAlpha - this.minAlpha) * pulse;

    this.graphics.clear();
    this.graphics.circle(0, 0, radius);
    this.graphics.stroke({ width: this.strokeWidth, color: this.color, alpha });
  }
}
