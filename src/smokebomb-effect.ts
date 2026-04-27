import { Container, Sprite, Graphics, Assets, Texture } from "pixi.js";

const SMOKE_DURATION_SEC = 8;
const SMOKE_MUFFLE_RANGE = 300;
const SMOKE_DESPAWN_DELAY_SEC = 2;
const SMOKE_ANIM_ALIASES = [
  "smokebomb:smoke1",
  "smokebomb:smoke2",
  "smokebomb:smoke3",
];
const SMOKE_ANIM_INTERVAL_MS = 500;

function tex(alias: string): Texture {
  return Assets.get<Texture>(alias) || Texture.WHITE;
}

export class SmokeBombEffect {
  public x: number;
  public y: number;
  public expired = false;

  private container: Container;
  private sprite: Sprite;
  private cloud: Graphics;
  private spawnTime: number;
  private animTimer = 0;
  private animFrame = 0;
  private dissipating = false;

  constructor(parent: Container, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.spawnTime = performance.now();

    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    parent.addChild(this.container);

    // Grey cloud overlay
    this.cloud = new Graphics();
    this.cloud.circle(0, -60, 125);
    this.cloud.fill({ color: 0x888888, alpha: 0.4 });
    this.container.addChild(this.cloud);

    // Smoke sprite
    this.sprite = new Sprite(tex("smokebomb:smoke1"));
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.scale.set(0.2);
    this.container.addChild(this.sprite);
  }

  isActive(): boolean {
    return (performance.now() - this.spawnTime) / 1000 < SMOKE_DURATION_SEC;
  }

  containsPlayer(playerX: number, playerY: number): boolean {
    if (!this.isActive()) return false;
    return Math.hypot(playerX - this.x, playerY - this.y) < SMOKE_MUFFLE_RANGE;
  }

  update(dtMS: number): void {
    if (this.expired) return;

    const elapsed = (performance.now() - this.spawnTime) / 1000;

    if (elapsed >= SMOKE_DURATION_SEC + SMOKE_DESPAWN_DELAY_SEC) {
      this.expired = true;
      return;
    }

    if (elapsed >= SMOKE_DURATION_SEC) {
      if (!this.dissipating) {
        this.dissipating = true;
        this.sprite.texture = tex("smokebomb:dissipating");
      }
      this.container.alpha = 1 - (elapsed - SMOKE_DURATION_SEC) / SMOKE_DESPAWN_DELAY_SEC;
      return;
    }

    // Animate smoke frames
    this.animTimer += dtMS;
    if (this.animTimer >= SMOKE_ANIM_INTERVAL_MS) {
      this.animTimer -= SMOKE_ANIM_INTERVAL_MS;
      this.animFrame = (this.animFrame + 1) % SMOKE_ANIM_ALIASES.length;
      this.sprite.texture = tex(SMOKE_ANIM_ALIASES[this.animFrame]);
    }

    this.cloud.alpha = 0.3 + Math.sin(performance.now() / 300) * 0.1;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
