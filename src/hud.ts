import { Container, Graphics, Text } from "pixi.js";

export class HUD {
  private container: Container;
  private msgBox: Container | null = null;
  private msgTimer = 0;
  private suspicionBar: Graphics | null = null;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.zIndex = 5000;
    parent.sortableChildren = true;
    parent.addChild(this.container);
  }

  showMessage(text: string, durationMS: number = 2000): void {
    this.clearMessage();

    const box = new Container();

    const padX = 20;
    const padY = 10;
    const fontSize = 20;
    const boxW = text.length * (fontSize * 0.62) + padX * 2;
    const boxH = fontSize + padY * 2;

    const bg = new Graphics();
    bg.roundRect(0, 0, boxW, boxH, 6);
    bg.fill({ color: 0x000000, alpha: 0.75 });
    box.addChild(bg);

    const label = new Text({
      text,
      style: {
        fontFamily: "monospace",
        fontSize,
        fill: 0xffffff,
      },
    });
    label.x = padX;
    label.y = padY;
    box.addChild(label);

    // Center near bottom of viewport
    box.x = 640 - boxW / 2;
    box.y = 620;

    this.container.addChild(box);
    this.msgBox = box;
    this.msgTimer = durationMS;
  }

  update(dtMS: number): void {
    if (this.msgBox && this.msgTimer > 0) {
      this.msgTimer -= dtMS;
      if (this.msgTimer <= 0) {
        this.clearMessage();
      }
    }
  }

  updateSuspicionMeter(suspicion: number): void {
    if (!this.suspicionBar) {
      this.suspicionBar = new Graphics();
      this.container.addChild(this.suspicionBar);
    }

    this.suspicionBar.clear();

    const barWidth = 200;
    const barHeight = 6;
    const x = 640 - barWidth / 2;
    const y = 16;

    // Background
    this.suspicionBar.rect(x, y, barWidth, barHeight).fill({ color: 0x333333, alpha: 0.5 });

    // Fill
    const fillWidth = (suspicion / 100) * barWidth;
    if (fillWidth > 0) {
      let color: number;
      if (suspicion < 30) {
        color = 0xcccccc;
      } else if (suspicion < 60) {
        color = 0xffaa00;
      } else {
        color = 0xff2200;
      }
      this.suspicionBar.rect(x, y, fillWidth, barHeight).fill({ color });
    }
  }

  private clearMessage(): void {
    if (this.msgBox) {
      this.container.removeChild(this.msgBox);
      this.msgBox.destroy({ children: true });
      this.msgBox = null;
    }
  }

  destroy(): void {
    this.clearMessage();
    if (this.suspicionBar) {
      this.suspicionBar.destroy();
      this.suspicionBar = null;
    }
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
