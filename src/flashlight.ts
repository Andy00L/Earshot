import { Container, Sprite, Texture } from "pixi.js";

/**
 * Full-screen darkness overlay with a radial gradient "hole" centered
 * on the player. Creates a canvas-based texture once, then repositions
 * the sprite each frame.
 */
export class Flashlight {
  public container: Container;
  private sprite: Sprite;

  constructor(parent: Container, _viewportWidth: number, _viewportHeight: number) {
    this.container = new Container();
    this.container.zIndex = 100; // above world, below HUD (5000)

    const texture = this.createGradientTexture(280, 80);
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.5);

    this.container.addChild(this.sprite);
    parent.addChild(this.container);
  }

  private createGradientTexture(radius: number, falloff: number): Texture {
    const size = 3000;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Fill with near-opaque black
    ctx.fillStyle = "rgba(0, 0, 0, 0.93)";
    ctx.fillRect(0, 0, size, size);

    // Cut out radial gradient hole at center
    ctx.globalCompositeOperation = "destination-out";
    const center = size / 2;
    const outerR = radius + falloff;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, outerR);
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(radius / outerR, "rgba(0, 0, 0, 0.85)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, outerR, 0, Math.PI * 2);
    ctx.fill();

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
    this.sprite.texture.destroy(true);
    this.sprite.destroy();
    this.container.destroy({ children: true });
  }
}
