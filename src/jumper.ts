import { Container, Sprite, Texture, Assets } from "pixi.js";
import { JumperState, JumperHotspot } from "./types";
import { Manifest, getFrameTexture, getFrameMeta } from "./assets";
import { audioManager } from "./audio";
import { AudioId } from "./audio-catalog";

// Timing constants (ms)
const JUMPER_WINDUP_MS = 200;
const JUMPER_FALL_DURATION_MS = 400;
const JUMPER_ATTACK_DURATION_MS = 800;
const JUMPER_RETREAT_DURATION_MS = 1500;

// Distance constants (px)
const JUMPER_TRIGGER_RADIUS_X = 80;
const JUMPER_CATCH_DISTANCE = 80;

// Animation FPS (matches Listener at ~8-10 fps per state)
const FRAME_INTERVAL_MS = 120;

// Frame name prefixes per state
const STATE_FRAME_PREFIX: Record<JumperState, string> = {
  dormant: "idle",
  triggered: "emerge",
  falling: "fall",
  attacking: "attack",
  retreating: "retreat",
};

const FRAMES_PER_STATE = 6;

export class Jumper {
  public container: Container;
  public state: JumperState = "dormant";
  public readonly isUpperFloor: boolean;

  private hotspot: JumperHotspot;
  private sprite: Sprite;
  private manifest: Manifest;
  private stateTimer = 0;
  private frameTimer = 0;
  private frameIndex = 0;
  private floorY: number;
  private fromLocker: boolean;
  private lockerDespawnTimer = 0;
  private despawned = false;

  constructor(
    hotspot: JumperHotspot,
    floorY: number,
    manifest: Manifest,
    parent: Container,
    fromLocker = false,
  ) {
    this.hotspot = hotspot;
    this.floorY = floorY;
    this.manifest = manifest;
    this.fromLocker = fromLocker;
    this.isUpperFloor = hotspot.floorLevel === "upper";

    this.container = new Container();
    this.container.x = hotspot.x;
    this.container.y = fromLocker ? floorY : hotspot.ventY;

    const texture = getFrameTexture(manifest, "jumper", "idle1");
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1.0);
    this.container.addChild(this.sprite);

    parent.addChild(this.container);

    if (fromLocker) {
      this.enterState("attacking");
    }
  }

  update(dtMS: number, playerX: number, playerY: number, playerCrouched: boolean, playerOnUpper = false): void {
    if (this.despawned) return;

    this.stateTimer += dtMS;
    this.advanceFrame(dtMS);

    switch (this.state) {
      case "dormant":
        // Only trigger if player is on the same floor as this hotspot
        if (playerOnUpper !== this.isUpperFloor) break;
        this.updateDormant(playerX, playerCrouched);
        break;
      case "triggered":
        this.updateTriggered();
        break;
      case "falling":
        this.updateFalling();
        break;
      case "attacking":
        // Retreat if player switched floors mid-attack
        if (!this.fromLocker && playerOnUpper !== this.isUpperFloor) {
          this.enterState("retreating");
          break;
        }
        this.updateAttacking(dtMS);
        break;
      case "retreating":
        this.updateRetreating();
        break;
    }
  }

  isPlayerCaught(playerX: number, playerY: number): boolean {
    if (this.state !== "attacking") return false;
    if (this.despawned) return false;
    const dx = Math.abs(playerX - this.container.x);
    const dy = Math.abs(playerY - this.container.y);
    return Math.sqrt(dx * dx + dy * dy) < JUMPER_CATCH_DISTANCE;
  }

  get isDespawned(): boolean {
    return this.despawned;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  // State transitions

  private enterState(newState: JumperState): void {
    this.state = newState;
    this.stateTimer = 0;
    this.frameIndex = 0;
    this.frameTimer = 0;

    this.applyFrame(0);

    switch (newState) {
      case "triggered":
        this.playAudio("monster_alert_growl");
        break;
      case "falling":
        this.playAudio("monster_attack_lunge");
        break;
      case "attacking":
        this.playAudio("monster_charge_roar");
        this.container.y = this.floorY;
        break;
      case "retreating":
        break;
      case "dormant":
        this.container.y = this.hotspot.ventY;
        break;
    }
  }

  // State update handlers

  private updateDormant(playerX: number, playerCrouched: boolean): void {
    if (playerCrouched) return;
    if (Math.abs(playerX - this.hotspot.x) < JUMPER_TRIGGER_RADIUS_X) {
      this.enterState("triggered");
    }
  }

  private updateTriggered(): void {
    if (this.stateTimer >= JUMPER_WINDUP_MS) {
      this.enterState("falling");
    }
  }

  private updateFalling(): void {
    // Interpolate Y from ventY to floorY
    const t = Math.min(1, this.stateTimer / JUMPER_FALL_DURATION_MS);
    this.container.y = this.hotspot.ventY + (this.floorY - this.hotspot.ventY) * t;

    if (this.stateTimer >= JUMPER_FALL_DURATION_MS) {
      this.enterState("attacking");
    }
  }

  private updateAttacking(dtMS: number): void {
    if (this.fromLocker) {
      this.lockerDespawnTimer += dtMS;
      if (this.lockerDespawnTimer >= JUMPER_ATTACK_DURATION_MS) {
        this.despawned = true;
        this.container.visible = false;
      }
      return;
    }

    if (this.stateTimer >= JUMPER_ATTACK_DURATION_MS) {
      this.enterState("retreating");
    }
  }

  private updateRetreating(): void {
    // Interpolate Y from floorY back to ventY
    const t = Math.min(1, this.stateTimer / JUMPER_RETREAT_DURATION_MS);
    this.container.y = this.floorY + (this.hotspot.ventY - this.floorY) * t;

    if (this.stateTimer >= JUMPER_RETREAT_DURATION_MS) {
      this.enterState("dormant");
    }
  }

  // Animation

  private advanceFrame(dtMS: number): void {
    this.frameTimer += dtMS;
    if (this.frameTimer >= FRAME_INTERVAL_MS) {
      this.frameTimer -= FRAME_INTERVAL_MS;
      if (this.state === "dormant") {
        // Loop idle frames continuously
        this.frameIndex = (this.frameIndex + 1) % FRAMES_PER_STATE;
      } else {
        // Play once through the strip, hold on last frame
        if (this.frameIndex < FRAMES_PER_STATE - 1) {
          this.frameIndex++;
        }
      }
      this.applyFrame(this.frameIndex);
    }
  }

  private applyFrame(index: number): void {
    const prefix = STATE_FRAME_PREFIX[this.state];
    const frameName = `${prefix}${index + 1}`;
    const texture = getFrameTexture(this.manifest, "jumper", frameName);
    this.sprite.texture = texture;

    const meta = getFrameMeta(this.manifest, "jumper", frameName);
    this.sprite.anchor.set(0.5, meta.baselineY / meta.height);
  }

  // Audio

  private playAudio(id: AudioId): void {
    if (audioManager.has(id)) {
      audioManager.playOneShot(id);
    }
  }
}
