import { Sprite, Assets, Texture } from "pixi.js";
import type { HidingSpotDef, HidingSpotKind } from "./types";

export class HidingSpot {
  public readonly id: string;
  public readonly kind: HidingSpotKind;
  public readonly x: number;
  public readonly y: number;
  public readonly triggerWidth: number;
  public sprite: Sprite;
  public isOccupied: boolean = false;

  constructor(def: HidingSpotDef, floorY: number) {
    this.id = def.id;
    this.kind = def.kind;
    this.x = def.x;
    this.y = def.y;
    this.triggerWidth = def.triggerWidth;

    const frameName = def.kind === "locker" ? "locker-hide" : "desk-hide";
    const texture = Assets.get<Texture>("props:" + frameName);
    this.sprite = new Sprite(texture || Texture.WHITE);
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.x = def.x;
    this.sprite.y = floorY;
  }

  isPlayerInRange(playerX: number): boolean {
    return Math.abs(playerX - this.x) <= this.triggerWidth / 2;
  }

  destroy(): void {
    this.sprite.parent?.removeChild(this.sprite);
    this.sprite.destroy();
  }
}
