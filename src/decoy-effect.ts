import { Container, Sprite, Assets, Texture } from "pixi.js";
import { audioManager } from "./audio";
import { AudioId } from "./audio-catalog";

const DECOY_SCREAM_DURATION_MS = 3000;
const DECOY_ANIM_INTERVAL_MS = 300;

function tex(alias: string): Texture {
  return Assets.get<Texture>(alias) || Texture.WHITE;
}

export class DecoyEffect {
  public x: number;
  public y: number;
  public lureActive = true;
  public done = false;

  private container: Container;
  private sprite: Sprite;
  private activateTime: number;
  private animTimer = 0;

  constructor(parent: Container, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.activateTime = performance.now();

    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    parent.addChild(this.container);

    this.sprite = new Sprite(tex("decoy-radio:broadcasting1"));
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.scale.set(0.15);
    this.container.addChild(this.sprite);

    // Play scream audio
    if (audioManager.has("static_burst")) {
      audioManager.playOneShot("static_burst");
    } else {
      const fallbacks: AudioId[] = [
        "monster_alert_growl",
        "monster_hunt_screech",
        "monster_charge_roar",
      ];
      const id = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      if (audioManager.has(id)) {
        audioManager.playOneShot(id);
      }
    }
  }

  update(dtMS: number): void {
    if (this.done) return;

    const elapsed = performance.now() - this.activateTime;

    if (elapsed >= DECOY_SCREAM_DURATION_MS) {
      this.lureActive = false;
      this.done = true;
      this.sprite.texture = tex("decoy-radio:spent");
      return;
    }

    // Animate broadcasting frames
    this.animTimer += dtMS;
    if (this.animTimer >= DECOY_ANIM_INTERVAL_MS) {
      this.animTimer -= DECOY_ANIM_INTERVAL_MS;
      const frame =
        Math.floor(elapsed / DECOY_ANIM_INTERVAL_MS) % 2 === 0
          ? "decoy-radio:broadcasting1"
          : "decoy-radio:broadcasting2";
      this.sprite.texture = tex(frame);
    }
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
