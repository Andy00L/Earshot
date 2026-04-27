import { Container, Sprite, Graphics, Assets, Texture } from "pixi.js";
import { BeaconState } from "./beacon";

const FLARE_DURATION_SEC = 30;
const FLARE_DESPAWN_DELAY_SEC = 5;
const FLARE_REFILL_RANGE = 200;
const FLARE_REFILL_RATE = 5;
const FLARE_WHISPERER_REPEL_RANGE = 400;
const FLARE_ANIM_INTERVAL_MS = 300;

function tex(alias: string): Texture {
  return Assets.get<Texture>(alias) || Texture.WHITE;
}

export class FlareEffect {
  public x: number;
  public y: number;
  public active = true;
  public expired = false;

  private container: Container;
  private sprite: Sprite;
  private glow: Graphics;
  private spawnTime: number;
  private animTimer = 0;
  private animFrame = 0;

  constructor(parent: Container, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.spawnTime = performance.now();

    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    parent.addChild(this.container);

    // Warm glow circle
    this.glow = new Graphics();
    this.glow.circle(0, -40, 120);
    this.glow.fill({ color: 0xffcc44, alpha: 0.25 });
    this.container.addChild(this.glow);

    // Flare sprite
    this.sprite = new Sprite(tex("flare:burn1"));
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.scale.set(0.15);
    this.container.addChild(this.sprite);
  }

  update(
    dtMS: number,
    beaconState: BeaconState,
    playerX: number,
    playerY: number,
  ): void {
    if (this.expired) return;

    const elapsed = (performance.now() - this.spawnTime) / 1000;

    if (elapsed > FLARE_DURATION_SEC + FLARE_DESPAWN_DELAY_SEC) {
      this.expired = true;
      return;
    }

    if (elapsed > FLARE_DURATION_SEC) {
      if (this.active) {
        this.active = false;
        this.sprite.texture = tex("flare:burnt-out");
        this.glow.visible = false;
      }
      return;
    }

    // Animate burn frames
    this.animTimer += dtMS;
    if (this.animTimer >= FLARE_ANIM_INTERVAL_MS) {
      this.animTimer -= FLARE_ANIM_INTERVAL_MS;
      this.animFrame = (this.animFrame + 1) % 2;
      this.sprite.texture = tex(
        this.animFrame === 0 ? "flare:burn1" : "flare:burn2",
      );
    }

    // Glow pulse
    this.glow.alpha = 0.2 + Math.sin(performance.now() / 200) * 0.1;

    // Refill beacon when player is nearby
    const dist = Math.hypot(playerX - this.x, playerY - this.y);
    if (dist < FLARE_REFILL_RANGE) {
      beaconState.value = Math.min(
        beaconState.maxBeacon,
        beaconState.value + FLARE_REFILL_RATE * (dtMS / 1000),
      );
    }
  }

  isWhispererRepelled(wx: number, wy: number): boolean {
    if (!this.active) return false;
    return Math.hypot(wx - this.x, wy - this.y) < FLARE_WHISPERER_REPEL_RANGE;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
