import { Container, Sprite, Assets, Texture } from "pixi.js";
import { PickupConfig } from "./types";

export class Pickup {
  public sprite: Sprite;
  public config: PickupConfig;
  public collected = false;
  public toggled = false;

  constructor(parent: Container, config: PickupConfig, floorY: number) {
    this.config = config;

    const alias = config.frame.includes(":") ? config.frame : "props:" + config.frame;
    const texture = Assets.get<Texture>(alias);
    if (!texture) {
      console.error(`Missing prop texture: ${alias}`);
    }

    this.sprite = new Sprite(texture || Texture.WHITE);
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.x = config.x;
    this.sprite.y = floorY + config.y;

    // Scale down large atlas props to fit the scene
    this.sprite.scale.set(0.3);

    parent.addChild(this.sprite);
  }

  isInteractable(): boolean {
    if (this.collected) return false;
    if (this.config.togglesTo && this.toggled) return false;
    return true;
  }

  collect(): void {
    this.collected = true;
    this.sprite.visible = false;
  }

  setToggled(): void {
    this.toggled = true;
    if (this.config.togglesTo) {
      const texture = Assets.get<Texture>("props:" + this.config.togglesTo);
      if (texture) {
        this.sprite.texture = texture;
      }
    }
  }

  isInRange(px: number): boolean {
    return Math.abs(px - this.config.x) <= this.config.pickupRange;
  }

  destroy(): void {
    this.sprite.parent?.removeChild(this.sprite);
    this.sprite.destroy();
  }
}
