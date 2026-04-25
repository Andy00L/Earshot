import { Container, Graphics, Text } from "pixi.js";

export class HUD {
  private container: Container;
  private msgBox: Container | null = null;
  private msgTimer = 0;
  private suspicionBar: Graphics | null = null;
  private promptBox: Container | null = null;
  private currentPromptStr: string = "";
  private hiddenIndicator: Container | null = null;
  private radioIndicator: Container | null = null;
  private radioTimerBox: Container | null = null;
  private radioTimerText: Text | null = null;

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

  showPrompt(text: string): void {
    if (text === this.currentPromptStr && this.promptBox) return;
    this.clearPrompt();
    this.currentPromptStr = text;

    const box = new Container();
    const padX = 16;
    const padY = 8;
    const fontSize = 18;
    const boxW = text.length * (fontSize * 0.62) + padX * 2;
    const boxH = fontSize + padY * 2;

    const bg = new Graphics();
    bg.roundRect(0, 0, boxW, boxH, 6);
    bg.fill({ color: 0x222222, alpha: 0.85 });
    box.addChild(bg);

    const label = new Text({
      text,
      style: { fontFamily: "monospace", fontSize, fill: 0xaaddff },
    });
    label.x = padX;
    label.y = padY;
    box.addChild(label);

    box.x = 640 - boxW / 2;
    box.y = 580;

    this.container.addChild(box);
    this.promptBox = box;
  }

  clearPrompt(): void {
    this.currentPromptStr = "";
    if (this.promptBox) {
      this.container.removeChild(this.promptBox);
      this.promptBox.destroy({ children: true });
      this.promptBox = null;
    }
  }

  setHiddenVisible(visible: boolean): void {
    if (visible && !this.hiddenIndicator) {
      const box = new Container();
      const label = new Text({
        text: "HIDDEN",
        style: { fontFamily: "monospace", fontSize: 14, fill: 0x88ccff },
      });
      const bg = new Graphics();
      bg.roundRect(0, 0, label.width + 16, label.height + 8, 4);
      bg.fill({ color: 0x000000, alpha: 0.6 });
      box.addChild(bg);
      label.x = 8;
      label.y = 4;
      box.addChild(label);
      box.x = 1280 - label.width - 30;
      box.y = 10;
      this.container.addChild(box);
      this.hiddenIndicator = box;
    } else if (!visible && this.hiddenIndicator) {
      this.container.removeChild(this.hiddenIndicator);
      this.hiddenIndicator.destroy({ children: true });
      this.hiddenIndicator = null;
    }
  }

  showRadioInventory(carrying: boolean): void {
    if (carrying && !this.radioIndicator) {
      const box = new Container();
      const label = new Text({
        text: "RADIO [R]",
        style: { fontFamily: "monospace", fontSize: 14, fill: 0xffaa44 },
      });
      const bg = new Graphics();
      bg.roundRect(0, 0, label.width + 16, label.height + 8, 4);
      bg.fill({ color: 0x000000, alpha: 0.6 });
      box.addChild(bg);
      label.x = 8;
      label.y = 4;
      box.addChild(label);
      box.x = 16;
      box.y = 10;
      this.container.addChild(box);
      this.radioIndicator = box;
    } else if (!carrying && this.radioIndicator) {
      this.container.removeChild(this.radioIndicator);
      this.radioIndicator.destroy({ children: true });
      this.radioIndicator = null;
    }
  }

  showRadioTimer(remainingMs: number, thrown: boolean): void {
    const sec = Math.max(0, remainingMs / 1000).toFixed(1);
    const throwHint = thrown ? "" : "  [G] throw";
    const display = `ARMED: ${sec}s${throwHint}`;

    if (!this.radioTimerBox) {
      const box = new Container();
      const label = new Text({
        text: display,
        style: { fontFamily: "monospace", fontSize: 16, fill: 0xff4444 },
      });
      const bg = new Graphics();
      bg.roundRect(0, 0, 260, label.height + 12, 4);
      bg.fill({ color: 0x000000, alpha: 0.7 });
      box.addChild(bg);
      label.x = 8;
      label.y = 6;
      box.addChild(label);
      box.x = 640 - 130;
      box.y = 40;
      this.container.addChild(box);
      this.radioTimerBox = box;
      this.radioTimerText = label;
    } else if (this.radioTimerText) {
      this.radioTimerText.text = display;
    }
  }

  clearRadioTimer(): void {
    if (this.radioTimerBox) {
      this.container.removeChild(this.radioTimerBox);
      this.radioTimerBox.destroy({ children: true });
      this.radioTimerBox = null;
      this.radioTimerText = null;
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
    this.clearPrompt();
    this.setHiddenVisible(false);
    this.showRadioInventory(false);
    this.clearRadioTimer();
    if (this.suspicionBar) {
      this.suspicionBar.destroy();
      this.suspicionBar = null;
    }
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
