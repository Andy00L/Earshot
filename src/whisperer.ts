import { Container, Sprite } from "pixi.js";
import { WhispererState } from "./types";
import { Manifest, getFrameTexture, getFrameMeta } from "./assets";
import { BeaconState, erodeMaxBeacon } from "./beacon";
import { audioManager } from "./audio";
import { AudioId } from "./audio-catalog";

// Movement and behavior
const WHISPERER_GLIDE_SPEED = 60;
const WHISPERER_BEACON_DRAIN_RATE = 3.0;
const WHISPERER_LOOK_DISTANCE = 800;
const WHISPERER_FADE_DURATION_MS = 800;
const WHISPERER_SPAWN_DURATION_MS = 800;
const WHISPERER_MAX_BEACON_PENALTY = 5;

// TTS line cadence
const WHISPERER_LINE_INTERVAL_MIN_MS = 8000;
const WHISPERER_LINE_INTERVAL_MAX_MS = 15000;

const WHISPERER_LINE_IDS: AudioId[] = [
  "whisper_01", "whisper_02", "whisper_03", "whisper_04",
  "whisper_05", "whisper_06", "whisper_07", "whisper_08",
];

// Animation
const FRAMES_PER_STATE = 6;
const FRAME_INTERVAL_MS = 133; // ~7.5 fps for ghostly feel

const STATE_FRAME_PREFIX: Record<WhispererState, string> = {
  spawning: "spawn",
  idle: "idle",
  fading: "fade",
  despawned: "idle",
};

export class Whisperer {
  public container: Container;
  public state: WhispererState = "spawning";

  private sprite: Sprite;
  private manifest: Manifest;
  private stateTimer = 0;
  private frameTimer = 0;
  private frameIndex = 0;
  private nextLineAt: number;
  private fadeEventPending = false;
  private lineIsPlaying = false;
  private lastPlayedSoundId: number | null = null;

  constructor(
    manifest: Manifest,
    parent: Container,
    spawnX: number,
    floorY: number,
  ) {
    this.manifest = manifest;
    this.container = new Container();
    this.container.x = spawnX;
    this.container.y = floorY;
    parent.addChild(this.container);

    const texture = getFrameTexture(manifest, "whisperer", "spawn1");
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.alpha = 0.8;
    this.container.addChild(this.sprite);

    // First whisper line after a random delay from spawn
    this.nextLineAt = WHISPERER_LINE_INTERVAL_MIN_MS
      + Math.random() * (WHISPERER_LINE_INTERVAL_MAX_MS - WHISPERER_LINE_INTERVAL_MIN_MS);
  }

  update(
    dtMS: number,
    playerX: number,
    playerFacing: 1 | -1,
    beaconState: BeaconState,
    cameraLeft: number,
    cameraRight: number,
  ): void {
    if (this.state === "despawned") return;

    this.stateTimer += dtMS;
    this.advanceFrame(dtMS);

    if (this.state === "spawning") {
      if (this.stateTimer >= WHISPERER_SPAWN_DURATION_MS) {
        this.transitionTo("idle");
      }
      return;
    }

    if (this.state === "idle") {
      // Glide toward player
      const dx = playerX - this.container.x;
      if (Math.abs(dx) > 2) {
        const moveDx = Math.sign(dx) * WHISPERER_GLIDE_SPEED * (dtMS / 1000);
        this.container.x += moveDx;
      }

      // Drain beacon passively
      beaconState.value = Math.max(0, beaconState.value - WHISPERER_BEACON_DRAIN_RATE * (dtMS / 1000));

      // Play whisper line on schedule
      if (this.stateTimer >= this.nextLineAt) {
        this.playRandomLine();
        this.nextLineAt = this.stateTimer
          + WHISPERER_LINE_INTERVAL_MIN_MS
          + Math.random() * (WHISPERER_LINE_INTERVAL_MAX_MS - WHISPERER_LINE_INTERVAL_MIN_MS);
      }

      // Check if player is looking at the whisperer
      const onScreen = this.container.x >= cameraLeft && this.container.x <= cameraRight;
      const distance = Math.abs(this.container.x - playerX);
      if (onScreen && distance < WHISPERER_LOOK_DISTANCE) {
        const whispererSide: 1 | -1 = this.container.x > playerX ? 1 : -1;
        if (whispererSide === playerFacing) {
          erodeMaxBeacon(beaconState, WHISPERER_MAX_BEACON_PENALTY);
          this.transitionTo("fading");
        }
      }
      return;
    }

    if (this.state === "fading") {
      // Fade out alpha over duration
      const t = Math.min(1, this.stateTimer / WHISPERER_FADE_DURATION_MS);
      this.sprite.alpha = 0.8 * (1 - t);

      if (this.stateTimer >= WHISPERER_FADE_DURATION_MS) {
        this.transitionTo("despawned");
      }
    }
  }

  /** Force transition to fading (e.g., repelled by flare). No Beacon penalty. */
  public forceFade(): void {
    if (this.state !== "idle") return;
    this.transitionTo("fading");
  }

  consumeFadeEvent(): boolean {
    if (this.fadeEventPending) {
      this.fadeEventPending = false;
      return true;
    }
    return false;
  }

  isDespawned(): boolean {
    return this.state === "despawned";
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private transitionTo(next: WhispererState): void {
    this.state = next;
    this.stateTimer = 0;
    this.frameIndex = 0;
    this.frameTimer = 0;

    if (next === "fading") {
      this.fadeEventPending = true;
      audioManager.playOneShot("whisper_fade");
    }

    if (next === "despawned") {
      this.container.visible = false;
    } else {
      this.applyFrame(0);
    }
  }

  private playRandomLine(): void {
    // Don't stack whisper lines
    if (this.lastPlayedSoundId !== null) {
      const managed = audioManager.has(WHISPERER_LINE_IDS[0]);
      if (!managed) return;
    }
    const id = WHISPERER_LINE_IDS[Math.floor(Math.random() * WHISPERER_LINE_IDS.length)];
    if (audioManager.has(id)) {
      audioManager.playOneShot(id);
    }
  }

  // Animation

  private advanceFrame(dtMS: number): void {
    this.frameTimer += dtMS;
    if (this.frameTimer >= FRAME_INTERVAL_MS) {
      this.frameTimer -= FRAME_INTERVAL_MS;
      if (this.state === "idle") {
        this.frameIndex = (this.frameIndex + 1) % FRAMES_PER_STATE;
      } else if (this.state === "spawning") {
        if (this.frameIndex < FRAMES_PER_STATE - 1) this.frameIndex++;
      } else if (this.state === "fading") {
        if (this.frameIndex < FRAMES_PER_STATE - 1) this.frameIndex++;
      }
      this.applyFrame(this.frameIndex);
    }
  }

  private applyFrame(index: number): void {
    if (this.state === "despawned") return;
    // Use glide frames when moving in idle state
    const prefix = this.state === "idle" ? "glide" : STATE_FRAME_PREFIX[this.state];
    const frameName = `${prefix}${index + 1}`;
    const texture = getFrameTexture(this.manifest, "whisperer", frameName);
    this.sprite.texture = texture;

    const meta = getFrameMeta(this.manifest, "whisperer", frameName);
    this.sprite.anchor.set(0.5, meta.baselineY / meta.height);
  }
}
