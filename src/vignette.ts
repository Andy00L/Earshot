import { Container, Graphics } from "pixi.js";

/**
 * Vignette overlay that darkens screen edges based on monster threat level.
 * Intensity 1.0 = no vignette, 0.3 = extreme darkening.
 */
export class Vignette {
  public container: Container;
  private graphics: Graphics;
  private currentRadius = 1.0;
  private targetRadius = 1.0;
  private screenW: number;
  private screenH: number;

  constructor(screenW: number, screenH: number) {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.screenW = screenW;
    this.screenH = screenH;
  }

  setIntensity(monsterState: string | null, suspicion: number): void {
    if (monsterState === "ATTACK") this.targetRadius = 0.3;
    else if (monsterState === "CHARGE") this.targetRadius = 0.45;
    else if (monsterState === "HUNT") this.targetRadius = 0.65;
    else if (monsterState === "ALERT" || suspicion > 30)
      this.targetRadius = 0.85;
    else this.targetRadius = 1.0;
  }

  update(_dtMs: number): void {
    this.currentRadius +=
      (this.targetRadius - this.currentRadius) * 0.05;
    this.redraw();
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();
    const inset =
      (1 - this.currentRadius) *
      Math.min(this.screenW, this.screenH) *
      0.5;
    if (inset < 1) return;

    const alpha = 0.85;
    // Top
    g.rect(0, 0, this.screenW, inset).fill({ color: 0x000000, alpha });
    // Bottom
    g.rect(0, this.screenH - inset, this.screenW, inset).fill({
      color: 0x000000,
      alpha,
    });
    // Left
    g.rect(0, inset, inset, this.screenH - 2 * inset).fill({
      color: 0x000000,
      alpha,
    });
    // Right
    g.rect(this.screenW - inset, inset, inset, this.screenH - 2 * inset).fill(
      { color: 0x000000, alpha },
    );
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}
