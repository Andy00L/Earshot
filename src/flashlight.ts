import { Container, Sprite, Texture } from "pixi.js";

/**
 * Full-screen darkness overlay with a radial gradient "hole" centered
 * on the player. Repaints the gradient when radius or brightness changes,
 * keeping the dark overlay at full viewport coverage regardless of cone size.
 */
export class Flashlight {
  public container: Container;
  private sprite: Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private defaultTexture: Texture;
  private lockerTexture: Texture | null = null;
  private hidingMode: "none" | "locker" | "desk" = "none";
  private static readonly BASE_RADIUS = 280;
  private static readonly FALLOFF = 80;
  private static readonly CANVAS_SIZE = 3000;
  private lastDrawnRadius = -1;
  private lastDrawnBrightness = -1;

  constructor(parent: Container, _viewportWidth: number, _viewportHeight: number) {
    this.container = new Container();
    this.container.zIndex = 100; // above world, below HUD (5000)

    this.canvas = document.createElement("canvas");
    this.canvas.width = Flashlight.CANVAS_SIZE;
    this.canvas.height = Flashlight.CANVAS_SIZE;
    this.ctx = this.canvas.getContext("2d")!;

    this.paintGradient(Flashlight.BASE_RADIUS, 1.0);
    this.defaultTexture = Texture.from(this.canvas);
    this.sprite = new Sprite(this.defaultTexture);
    this.sprite.anchor.set(0.5, 0.5);

    this.container.addChild(this.sprite);
    parent.addChild(this.container);
  }

  /** Repaint the gradient canvas with the given cone radius and brightness. */
  private paintGradient(radius: number, brightness: number): void {
    const size = Flashlight.CANVAS_SIZE;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 0, 0, 0.93)";
    ctx.fillRect(0, 0, size, size);

    if (brightness > 0 && radius > 0) {
      ctx.globalCompositeOperation = "destination-out";
      const center = size / 2;
      const outerR = radius + Flashlight.FALLOFF;
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, outerR);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${brightness})`);
      gradient.addColorStop(radius / outerR, `rgba(0, 0, 0, ${brightness * 0.85})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center, center, outerR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Update cone visuals from Beacon state. Only applies outside hiding spots. */
  setBeaconVisuals(radius: number, brightness: number): void {
    if (this.hidingMode !== "none") return;
    const qr = Math.round(radius / 5) * 5;
    const qb = Math.round(brightness * 20) / 20;
    if (qr === this.lastDrawnRadius && qb === this.lastDrawnBrightness) return;
    this.lastDrawnRadius = qr;
    this.lastDrawnBrightness = qb;
    this.paintGradient(qr, qb);
    this.defaultTexture.source.update();
  }

  /** Switch flashlight visual for hiding states. */
  setHidingMode(mode: "none" | "locker" | "desk"): void {
    this.hidingMode = mode;
    if (mode === "locker") {
      if (!this.lockerTexture) {
        this.lockerTexture = this.createLockerTexture();
      }
      this.sprite.texture = this.lockerTexture;
      this.sprite.scale.set(1);
    } else if (mode === "desk") {
      this.paintGradient(Flashlight.BASE_RADIUS * 0.7, 1.0);
      this.defaultTexture.source.update();
      this.sprite.texture = this.defaultTexture;
      this.sprite.scale.set(1);
      this.lastDrawnRadius = -1;
    } else {
      this.sprite.texture = this.defaultTexture;
      this.sprite.scale.set(1);
      this.lastDrawnRadius = -1;
    }
  }

  /** Near-opaque overlay with a thin horizontal slit (locker louvers). */
  private createLockerTexture(): Texture {
    const size = 3000;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Nearly opaque black
    ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    ctx.fillRect(0, 0, size, size);

    // Cut a thin horizontal slit at center (locker vent)
    ctx.globalCompositeOperation = "destination-out";
    const cx = size / 2;
    const cy = size / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.12); // squash vertically for thin slit
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
    grad.addColorStop(0, "rgba(0,0,0,0.7)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return Texture.from(canvas);
  }

  update(playerScreenX: number, playerScreenY: number): void {
    this.sprite.x = playerScreenX;
    this.sprite.y = playerScreenY;
  }

  setVisible(v: boolean): void {
    this.container.visible = v;
  }

  destroy(): void {
    this.defaultTexture.destroy(true);
    if (this.lockerTexture) this.lockerTexture.destroy(true);
    this.sprite.destroy();
    this.container.destroy({ children: true });
  }
}
