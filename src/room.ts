import { Container, Sprite, Assets, Texture } from 'pixi.js';

export class Room extends Container {
  readonly roomWidth: number;
  readonly roomHeight: number;
  readonly floorY: number;

  constructor(roomName: string) {
    super();

    let texture = Assets.get<Texture>(roomName);
    if (!texture) {
      console.warn(`Room texture "${roomName}" not found, using fallback`);
      texture = Texture.WHITE;
    }

    const bg = new Sprite(texture);
    this.addChild(bg);

    this.roomWidth = texture.width;
    this.roomHeight = texture.height;
    this.floorY = texture.height * 0.92;
  }
}
