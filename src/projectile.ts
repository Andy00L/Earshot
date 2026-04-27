import { Container, Sprite, Texture } from "pixi.js";

export class Projectile {
  public sprite: Sprite;
  public landed = false;
  public landX = 0;
  public landY = 0;

  private vx: number;
  private vy: number;
  private gravity: number;
  private floorY: number;
  private onLand: (x: number, y: number) => void;

  constructor(
    parent: Container,
    texture: Texture,
    startX: number,
    startY: number,
    velocityX: number,
    velocityY: number,
    gravity: number,
    floorY: number,
    scale: number,
    onLand: (x: number, y: number) => void,
  ) {
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.x = startX;
    this.sprite.y = startY;
    this.sprite.scale.set(scale);
    parent.addChild(this.sprite);

    this.vx = velocityX;
    this.vy = velocityY;
    this.gravity = gravity;
    this.floorY = floorY;
    this.onLand = onLand;
  }

  update(dtMS: number): void {
    if (this.landed) return;
    const dtSec = dtMS / 1000;
    this.sprite.x += this.vx * dtSec;
    this.sprite.y += this.vy * dtSec;
    this.vy += this.gravity * dtSec;

    if (this.sprite.y >= this.floorY) {
      this.sprite.y = this.floorY;
      this.landed = true;
      this.landX = this.sprite.x;
      this.landY = this.sprite.y;
      this.onLand(this.landX, this.landY);
    }
  }

  destroy(): void {
    this.sprite.parent?.removeChild(this.sprite);
    this.sprite.destroy();
  }
}
