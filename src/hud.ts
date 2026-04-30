import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { InventorySlotItem, RoomId } from "./types";
import { Minimap } from "./minimap";

export class HUD {
  private container: Container;
  private msgBox: Container | null = null;
  private msgTimer = 0;
  private beaconFrame: Sprite | null = null;
  private beaconFill: Sprite | null = null;
  private beaconFillMaxScaleX = 0;
  private beaconErodedOverlay: Sprite | null = null;
  private beaconMeterWidth = 0;
  private promptBox: Container | null = null;
  private currentPromptStr: string = "";
  private hiddenIndicator: Container | null = null;
  private radioIndicator: Container | null = null;
  private radioTimerBox: Container | null = null;
  private radioTimerText: Text | null = null;
  private inventorySlotBgs: Sprite[] = [];
  private inventorySlotIcons: Sprite[] = [];
  private lastSlotState: string = "";
  private subtitleContainer: Container;
  private subtitleBg: Graphics;
  private subtitleText: Text;
  private subtitleHideTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeRafId: number | null = null;
  private minimap: Minimap;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.zIndex = 5000;
    parent.sortableChildren = true;
    parent.addChild(this.container);
    this.initBeaconMeter();
    this.initInventorySlots();
    this.initSubtitle();

    this.minimap = new Minimap();
    this.minimap.container.x = 1280 - 240 - 16;
    this.minimap.container.y = 16;
    this.container.addChild(this.minimap.container);
  }

  private initBeaconMeter(): void {
    const frameTexture = Assets.get<Texture>("ui:beacon-meter-frame");
    const fillTexture = Assets.get<Texture>("ui:beacon-meter-fill");
    if (!frameTexture || !fillTexture) return;

    const targetWidth = 200;
    const frameScaleX = targetWidth / frameTexture.width;
    const scaledFrameH = frameTexture.height * frameScaleX;
    const meterY = Math.round(720 * 0.10) + 16; // ~88px from top (10% of 720 canvas + original offset)

    // Fill behind frame, inset inside the frame's painted border
    const FRAME_INSET_TOP_PCT = 0.18;
    const FRAME_INSET_BOTTOM_PCT = 0.18;
    const FRAME_INSET_LEFT_PCT = 0.05;
    const FRAME_INSET_RIGHT_PCT = 0.05;
    const interiorH = scaledFrameH * (1 - FRAME_INSET_TOP_PCT - FRAME_INSET_BOTTOM_PCT);
    const interiorW = targetWidth * (1 - FRAME_INSET_LEFT_PCT - FRAME_INSET_RIGHT_PCT);

    this.beaconFill = new Sprite(fillTexture);
    this.beaconFill.anchor.set(0, 0.5);
    this.beaconFillMaxScaleX = interiorW / fillTexture.width;
    const fillScaleY = interiorH / fillTexture.height;
    this.beaconFill.scale.set(this.beaconFillMaxScaleX, fillScaleY);
    this.beaconFill.x = 640 - targetWidth / 2 + targetWidth * FRAME_INSET_LEFT_PCT;
    this.beaconFill.y = meterY + scaledFrameH * FRAME_INSET_TOP_PCT + interiorH / 2;
    this.container.addChild(this.beaconFill);

    // Eroded overlay: dark region covering the right portion when maxBeacon < 100
    this.beaconMeterWidth = interiorW;
    this.beaconErodedOverlay = new Sprite(Texture.WHITE);
    this.beaconErodedOverlay.tint = 0x111111;
    this.beaconErodedOverlay.alpha = 0.7;
    this.beaconErodedOverlay.anchor.set(1, 0.5);
    this.beaconErodedOverlay.x = 640 - targetWidth / 2 + targetWidth * (1 - FRAME_INSET_RIGHT_PCT);
    this.beaconErodedOverlay.y = meterY + scaledFrameH * FRAME_INSET_TOP_PCT + interiorH / 2;
    this.beaconErodedOverlay.width = 0;
    this.beaconErodedOverlay.height = interiorH;
    this.container.addChild(this.beaconErodedOverlay);

    // Frame on top as decoration
    this.beaconFrame = new Sprite(frameTexture);
    this.beaconFrame.anchor.set(0.5, 0);
    this.beaconFrame.scale.set(frameScaleX);
    this.beaconFrame.x = 640;
    this.beaconFrame.y = meterY;
    this.container.addChild(this.beaconFrame);

    // BEACON label above the meter
    const beaconLabel = new Text({
      text: "BEACON",
      style: {
        fontFamily: "monospace",
        fontSize: 14,
        fill: 0xffffff,
        align: "center",
        fontWeight: "bold",
      },
    });
    beaconLabel.alpha = 0.7;
    beaconLabel.anchor.set(0.5, 1);
    beaconLabel.x = 640;
    beaconLabel.y = meterY - 4;
    this.container.addChild(beaconLabel);
  }

  private initInventorySlots(): void {
    const slotTex = Assets.get<Texture>("ui:inventory-slot-empty");
    for (let i = 0; i < 3; i++) {
      const bg = new Sprite(slotTex || Texture.WHITE);
      bg.anchor.set(0, 0);
      bg.x = 16 + i * 56;
      bg.y = 16;
      bg.scale.set(0.08);
      this.container.addChild(bg);
      this.inventorySlotBgs.push(bg);

      const icon = new Sprite(Texture.WHITE);
      icon.anchor.set(0.5, 0.5);
      icon.x = 16 + i * 56 + 25;
      icon.y = 16 + 26;
      icon.visible = false;
      this.container.addChild(icon);
      this.inventorySlotIcons.push(icon);
    }
  }

  private static slotItemAlias(item: InventorySlotItem): string {
    if (item.kind === "material") {
      const map: Record<string, string> = {
        wire: "materials:wire",
        glass_shards: "materials:glass",
        battery: "materials:battery",
        tape: "materials:tape",
      };
      return map[item.id];
    }
    if (item.kind === "crafted") {
      const map: Record<string, string> = {
        flare: "flare:unlit",
        smoke_bomb: "smokebomb:idle",
        decoy_radio: "decoy-radio:idle",
      };
      return map[item.id];
    }
    if (item.kind === "whisper_charm") return "puzzle-props:whisper_charm";
    return "radio";
  }

  private static iconScale(item: InventorySlotItem): number {
    if (item.kind === "radio") return 0.03;
    if (item.kind === "whisper_charm") return 0.03;
    return 0.07;
  }

  updateInventorySlots(
    slots: (InventorySlotItem | null)[],
    selectedSlot: number,
  ): void {
    // Quick dirty-check to avoid per-frame texture swaps
    const key = slots.map((s) => (s ? `${s.kind}:${"id" in s ? s.id : "r"}` : "x")).join(",") + `:${selectedSlot}`;
    if (key === this.lastSlotState) return;
    this.lastSlotState = key;

    const emptyTex = Assets.get<Texture>("ui:inventory-slot-empty");
    const selTex = Assets.get<Texture>("ui:inventory-slot-selected");

    for (let i = 0; i < 3; i++) {
      this.inventorySlotBgs[i].texture =
        (i === selectedSlot ? selTex : emptyTex) || Texture.WHITE;

      const item = slots[i];
      const icon = this.inventorySlotIcons[i];
      if (!item) {
        icon.visible = false;
        continue;
      }
      icon.visible = true;
      const alias = HUD.slotItemAlias(item);
      icon.texture = Assets.get<Texture>(alias) || Texture.WHITE;
      icon.scale.set(HUD.iconScale(item));
    }
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
    this.minimap.update(dtMS);
  }

  updateBeaconMeter(value: number, maxBeacon: number = 100): void {
    if (!this.beaconFill) return;
    const t = Math.max(0, Math.min(1, value / 100));
    this.beaconFill.scale.x = this.beaconFillMaxScaleX * t;
    if (this.beaconErodedOverlay) {
      const erodedFraction = (100 - maxBeacon) / 100;
      this.beaconErodedOverlay.width = erodedFraction * this.beaconMeterWidth;
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

  /**
   * Render a sprite-based prompt: [key icon] + [action label].
   * Falls back to text via showPrompt() if a key sprite is missing from atlas.
   */
  showSpritePrompt(keyId: string, labelId: string | null): void {
    const cacheKey = `${keyId}|${labelId ?? ""}`;
    if (cacheKey === this.currentPromptStr && this.promptBox) return;
    this.clearPrompt();
    this.currentPromptStr = cacheKey;

    const keyTex = Assets.get<Texture>(`ui:${keyId}`);
    const labelTex = labelId ? Assets.get<Texture>(`ui:${labelId}`) : null;

    if (!keyTex || keyTex === Texture.WHITE) {
      console.warn(`Missing UI sprite ui:${keyId}, falling back to text`);
      this.showPrompt(`Press ${this.fallbackKeyName(keyId)}`);
      return;
    }

    const box = new Container();
    const padding = 12;

    const keySprite = new Sprite(keyTex);
    keySprite.height = 48;
    keySprite.scale.x = keySprite.scale.y; // preserve aspect
    keySprite.x = padding;
    keySprite.y = padding;
    box.addChild(keySprite);

    let totalWidth = padding + keySprite.width + padding;

    if (labelTex && labelTex !== Texture.WHITE) {
      const labelSprite = new Sprite(labelTex);
      labelSprite.height = 32;
      labelSprite.scale.x = labelSprite.scale.y;
      labelSprite.x = padding + keySprite.width + 12;
      labelSprite.y = padding + (keySprite.height - labelSprite.height) / 2;
      box.addChild(labelSprite);
      totalWidth = padding + keySprite.width + 12 + labelSprite.width + padding;
    } else if (labelId) {
      // labelId requested but sprite missing: fall back to text label
      const labelText = new Text({
        text: labelId.replace(/^label-/, "").toUpperCase(),
        style: { fontFamily: "monospace", fontSize: 18, fill: 0xaaddff },
      });
      labelText.x = padding + keySprite.width + 12;
      labelText.y = padding + (keySprite.height - labelText.height) / 2;
      box.addChild(labelText);
      totalWidth = padding + keySprite.width + 12 + labelText.width + padding;
    }

    const bg = new Graphics();
    bg.roundRect(0, 0, totalWidth, keySprite.height + padding * 2, 6);
    bg.fill({ color: 0x000000, alpha: 0.5 });
    box.addChildAt(bg, 0);

    box.x = 640 - totalWidth / 2;
    box.y = 580;

    this.container.addChild(box);
    this.promptBox = box;
  }

  private fallbackKeyName(keyId: string): string {
    const map: Record<string, string> = {
      "key-e": "E",
      "key-r": "R",
      "key-g": "G",
      "key-ctrl": "Ctrl",
    };
    return map[keyId] ?? keyId.replace(/^key-/, "").toUpperCase();
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

  private initSubtitle(): void {
    this.subtitleContainer = new Container();
    this.subtitleContainer.alpha = 0;
    this.subtitleContainer.zIndex = 5500;

    this.subtitleBg = new Graphics();
    this.subtitleContainer.addChild(this.subtitleBg);

    this.subtitleText = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 22,
        fill: 0xffffff,
        align: "center",
        wordWrap: true,
        wordWrapWidth: 1080,
      },
    });
    this.subtitleText.anchor.set(0.5, 0.5);
    this.subtitleText.x = 640;
    this.subtitleText.y = 600;
    this.subtitleContainer.addChild(this.subtitleText);

    this.container.addChild(this.subtitleContainer);
  }

  showSubtitle(text: string, durationMs: number): void {
    if (this.subtitleHideTimer) clearTimeout(this.subtitleHideTimer);

    this.subtitleText.text = text;

    // Redraw bg to fit text
    this.subtitleBg.clear();
    const padding = 20;
    const textBounds = this.subtitleText.getBounds();
    const bgX = textBounds.x - padding;
    const bgY = textBounds.y - padding;
    const bgW = textBounds.width + padding * 2;
    const bgH = textBounds.height + padding * 2;
    this.subtitleBg.roundRect(bgX, bgY, bgW, bgH, 6);
    this.subtitleBg.fill({ color: 0x000000, alpha: 0.7 });

    this.subtitleContainer.alpha = 1;

    this.subtitleHideTimer = setTimeout(() => {
      this.fadeSubtitleOut();
    }, durationMs);
  }

  hideSubtitle(): void {
    if (this.subtitleHideTimer) {
      clearTimeout(this.subtitleHideTimer);
      this.subtitleHideTimer = null;
    }
    this.subtitleContainer.alpha = 0;
  }

  private fadeSubtitleOut(): void {
    this.subtitleHideTimer = null;
    const startTime = performance.now();
    const fade = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / 300, 1);
      this.subtitleContainer.alpha = 1 - t;
      if (t < 1) {
        this.fadeRafId = requestAnimationFrame(fade);
      } else {
        this.fadeRafId = null;
      }
    };
    fade();
  }

  cancelFade(): void {
    if (this.fadeRafId !== null) {
      cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
  }

  updateMinimap(currentRoom: RoomId, hasMapFragment: boolean, objectiveRooms?: Set<RoomId>): void {
    this.minimap.onRoomEnter(currentRoom);
    if (objectiveRooms) {
      this.minimap.setObjectiveRooms(objectiveRooms);
    }
    if (hasMapFragment) {
      this.minimap.show();
    } else {
      this.minimap.hide();
    }
  }

  enableMinimapThreatMarkers(): void {
    this.minimap.enableThreatMarkers();
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
    this.hideSubtitle();
    this.minimap.destroy();
    this.setHiddenVisible(false);
    this.showRadioInventory(false);
    this.clearRadioTimer();
    this.inventorySlotBgs.forEach((s) => s.destroy());
    this.inventorySlotBgs = [];
    this.inventorySlotIcons.forEach((s) => s.destroy());
    this.inventorySlotIcons = [];
    this.lastSlotState = "";
    if (this.beaconErodedOverlay) {
      this.beaconErodedOverlay.destroy();
      this.beaconErodedOverlay = null;
    }
    if (this.beaconFill) {
      this.beaconFill.destroy();
      this.beaconFill = null;
    }
    if (this.beaconFrame) {
      this.beaconFrame.destroy();
      this.beaconFrame = null;
    }
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
