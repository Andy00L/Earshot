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
const FRAME_INTERVAL_MS_PEEKING = 280;
const FRAME_INTERVAL_MS_CRAWLING = 100;

// Floor variant timings
const FLOOR_VISIBILITY_RANGE_PX = 250;
const FLOOR_EMERGING_DURATION_MS = 800;
const FLOOR_GETTING_UP_DURATION_MS = 600;
const FLOOR_CRAWLING_DURATION_MS = 1200;
const FLOOR_CRAWLING_SPEED_PX_PER_SEC = 180;
const FLOOR_RETREAT_DURATION_MS = 1500;

// Behavior probability on trigger
const JUMPER_REAL_ATTACK_CHANCE = 0.25;
const JUMPER_FAKE_ATTACK_CHANCE = 0.40;
// Remaining 35% = peek

// Cooldowns (ms)
const JUMPER_COOLDOWN_AFTER_PEEK_MS = 3000;
const JUMPER_COOLDOWN_AFTER_FAKE_MS = 3000;
const JUMPER_COOLDOWN_AFTER_REAL_MS = 5000;

// Peek timing
const JUMPER_PEEK_DURATION_MS = 2500;

// Fake-attack timing
const JUMPER_FAKE_EMERGE_DURATION_MS = 600;
const JUMPER_FAKE_HOLD_MS = 400;
const JUMPER_FAKE_RETREAT_DURATION_MS = 800;

// Frame name prefixes per state (per-variant to avoid baked-vent artifacts on floor)
const STATE_FRAME_PREFIX_CEILING: Record<JumperState, string> = {
  dormant: "idle",
  peeking: "idle",
  fake_attacking: "emerge",
  triggered: "emerge",
  falling: "fall",
  emerging: "emerge",
  getting_up: "getup",
  crawling: "walk",
  attacking: "attack",
  retreating: "retreat",
};

const STATE_FRAME_PREFIX_FLOOR: Record<JumperState, string> = {
  dormant: "idle",
  peeking: "idle",
  fake_attacking: "emerge",
  triggered: "emerge",
  falling: "fall",
  emerging: "emerge",
  getting_up: "getup",
  crawling: "walk",
  attacking: "attack",
  retreating: "walk",
};

// Master shrink factor for the floor variant's visual footprint.
// All floor-variant size constants below scale by this. Tune in one
// place if the entire silhouette needs adjustment.
// Mirror: DRIP_SHRINK in game.ts MUST stay equal.
const FLOOR_VISUAL_SHRINK = 0.6;
if (FLOOR_VISUAL_SHRINK <= 0 || FLOOR_VISUAL_SHRINK > 2) {
  throw new Error(`FLOOR_VISUAL_SHRINK out of range: ${FLOOR_VISUAL_SHRINK}`);
}

// Locked sprite heights per state for floor variant (prevents size flicker).
// Emerge-prefix states (fake_attacking, emerging) use FLOOR_EMERGE_TARGET_VENT_WIDTH
// scaling instead, but entries are kept here for documentation.
const FLOOR_SPRITE_HEIGHT_BY_STATE: Partial<Record<JumperState, number>> = {
  dormant: 220 * FLOOR_VISUAL_SHRINK,
  peeking: 220 * FLOOR_VISUAL_SHRINK,
  fake_attacking: 200 * FLOOR_VISUAL_SHRINK,
  emerging: 220 * FLOOR_VISUAL_SHRINK,
  getting_up: 220 * FLOOR_VISUAL_SHRINK,
  crawling: 200 * FLOOR_VISUAL_SHRINK,
  attacking: 220 * FLOOR_VISUAL_SHRINK,
  retreating: 200 * FLOOR_VISUAL_SHRINK,
};

// Per-state max on-screen width for the floor variant. Caps the uniform
// scale produced by applyLockedSpriteSize so wide-but-short frames
// (e.g., getup1 at 326x118 native) do not inflate beyond the grate
// silhouette. Post-shrink grate is ~170 px wide. Active-state limits
// are slightly larger to allow claws and arms to extend past the grate edge.
const FLOOR_SPRITE_MAX_WIDTH_BY_STATE: Partial<Record<JumperState, number>> = {
  dormant: 290 * FLOOR_VISUAL_SHRINK,
  peeking: 290 * FLOOR_VISUAL_SHRINK,
  fake_attacking: 320 * FLOOR_VISUAL_SHRINK,
  emerging: 320 * FLOOR_VISUAL_SHRINK,
  getting_up: 340 * FLOOR_VISUAL_SHRINK,
  crawling: 360 * FLOOR_VISUAL_SHRINK,
  attacking: 380 * FLOOR_VISUAL_SHRINK,
  retreating: 360 * FLOOR_VISUAL_SHRINK,
};

// Target on-screen width for the vent portion of emerge-prefix frames
// (floor variant). All emerge frames have native vent width ~283 px.
// scale = FLOOR_EMERGE_TARGET_VENT_WIDTH / textureWidth keeps the vent
// silhouette constant across emerge1 (284x185) through emerge6 (283x494).
const FLOOR_EMERGE_TARGET_VENT_WIDTH = 170;

const CEILING_SPRITE_HEIGHT_BY_STATE: Partial<Record<JumperState, number>> = {};

// Floor retreating plays walk frames in reverse (creature crawls backward into vent)
const FLOOR_REVERSE_PLAYBACK_STATES: JumperState[] = ["retreating"];

const FRAMES_PER_STATE = 6;

// Floor jumper audio cooldowns (ms)
const FLOOR_EMERGE_AUDIO_COOLDOWN_MS = 6000;
const FLOOR_ATTACK_AUDIO_COOLDOWN_MS = 4000;
const FLOOR_RETREAT_AUDIO_COOLDOWN_MS = 5000;

// Distance-based volume constants (px)
const AUDIO_FULL_VOLUME_DIST = 500;
const AUDIO_MUTE_DIST = 1500;

export type JumperVfxEvent = "emerge" | "attack_lunge" | "retreat";

export class Jumper {
  public container: Container;
  public state: JumperState = "dormant";
  public readonly isUpperFloor: boolean;
  public onVfxEvent: ((event: JumperVfxEvent, jumper: Jumper) => void) | null = null;

  private hotspot: JumperHotspot;
  private sprite: Sprite;
  private manifest: Manifest;
  private stateTimer = 0;
  private frameTimer = 0;
  private frameIndex = 0;
  private floorY: number;
  private fromLocker: boolean;
  private ventPosition: "ceiling" | "floor";
  private lockerDespawnTimer = 0;
  private despawned = false;
  private cooldownExpiresAt = 0;
  private playerWasInRange = false;
  private fakeHissPlayed = false;
  private grateBottomY = 0;
  private grateTopY = 0;
  private dripSprite: Sprite | undefined;
  private crawlSoundPlaying = false;
  private attackLungeTimeout: ReturnType<typeof setTimeout> | null = null;
  private soundCooldowns: Map<string, number> = new Map();
  private lastPlayerX = 0;

  // dripSprite is an optional non-owned reference. The Jumper toggles
  // its visibility but does NOT destroy it. Cleanup is handled by
  // jumperDripSprites in game.ts.
  constructor(
    hotspot: JumperHotspot,
    floorY: number,
    manifest: Manifest,
    parent: Container,
    fromLocker = false,
    dripSprite?: Sprite,
  ) {
    this.hotspot = hotspot;
    this.floorY = floorY;
    this.manifest = manifest;
    this.fromLocker = fromLocker;
    this.dripSprite = dripSprite;
    this.ventPosition = hotspot.ventPosition ?? "ceiling";
    this.grateBottomY = this.ventPosition === "floor" ? floorY - 50 : 0;
    const grateHeight = FLOOR_SPRITE_HEIGHT_BY_STATE["dormant"] ?? 0;
    this.grateTopY = this.grateBottomY - grateHeight;
    this.isUpperFloor = hotspot.floorLevel === "upper";

    this.container = new Container();
    this.container.x = hotspot.x;
    this.container.y = fromLocker
      ? floorY
      : this.ventPosition === "floor"
        ? this.grateBottomY
        : hotspot.ventY;

    // Floor variant starts hidden; updateVisibility controls alpha
    if (this.ventPosition === "floor" && !fromLocker) {
      this.container.alpha = 0;
    }

    // Hide dripSprite when the initial state uses vent-baked-in frames.
    if (this.dripSprite && this.ventPosition === "floor") {
      this.dripSprite.visible = !this.currentStateHasBakedVent();
    }

    const texture = getFrameTexture(manifest, "jumper", "idle1");
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1.0);
    this.container.addChild(this.sprite);

    parent.addChild(this.container);

    // zIndex: floor variant starts behind grate; ceiling/locker fixed at 90
    if (this.ventPosition === "floor" && !fromLocker) {
      this.container.zIndex = 15;
    } else {
      this.container.zIndex = 90;
    }

    if (fromLocker) {
      this.enterState("attacking");
    }
  }

  update(dtMS: number, playerX: number, playerY: number, playerCrouched: boolean, playerOnUpper = false): void {
    if (this.despawned) return;

    this.lastPlayerX = playerX;
    this.stateTimer += dtMS;
    this.advanceFrame(dtMS);
    this.updateVisibility(playerX);

    // Update crawl loop volume based on distance
    if (this.crawlSoundPlaying && this.ventPosition === "floor") {
      const vol = this.distanceVolume(playerX);
      audioManager.setVolume("floor_jumper_crawl" as AudioId, vol);
    }

    switch (this.state) {
      case "dormant":
        // Only trigger if player is on the same floor as this hotspot
        if (playerOnUpper !== this.isUpperFloor) break;
        this.updateDormant(playerX, playerCrouched);
        break;
      case "peeking":
        this.updatePeeking();
        break;
      case "fake_attacking":
        this.updateFakeAttacking();
        break;
      case "triggered":
        this.updateTriggered();
        break;
      case "falling":
        this.updateFalling();
        break;
      case "emerging":
        this.updateEmerging();
        break;
      case "getting_up":
        this.updateGettingUp();
        break;
      case "crawling":
        this.updateCrawling(dtMS, playerX);
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
    this.stopCrawlSound();
    this.cancelAttackLunge();
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  // State transitions

  private enterState(newState: JumperState): void {
    this.state = newState;
    this.stateTimer = 0;
    this.frameTimer = 0;

    const reversed =
      this.ventPosition === "floor" &&
      FLOOR_REVERSE_PLAYBACK_STATES.includes(newState);
    this.frameIndex = reversed ? FRAMES_PER_STATE - 1 : 0;

    this.applyFrame(this.frameIndex);

    // Defensive x-snap for floor vent-anchored states. updateCrawling
    // (line 504) is the only code that mutates container.x to chase the
    // player. No subsequent state (retreating, dormant) resets it, so
    // the vent position drifts across attack cycles. Snapping here
    // guarantees the vent returns to hotspot.x on every entry into a
    // state where the creature should be at the vent.
    if (this.ventPosition === "floor") {
      const ventAnchored =
        newState === "dormant" ||
        newState === "peeking" ||
        newState === "fake_attacking" ||
        newState === "emerging";
      if (ventAnchored) {
        this.container.x = this.hotspot.x;
        if (this.dripSprite) {
          this.dripSprite.x = this.hotspot.x;
        }
      }
    }

    switch (newState) {
      case "peeking":
        this.playAudio("jumper_peek_breath");
        break;
      case "fake_attacking":
        this.fakeHissPlayed = false;
        this.playAudio("jumper_vent_creak");
        if (this.ventPosition === "floor") {
          this.container.y = this.grateTopY;
        }
        break;
      case "triggered":
        this.playAudio("monster_alert_growl");
        break;
      case "falling":
        this.playAudio("monster_attack_lunge");
        break;
      case "emerging":
        if (this.ventPosition === "floor") {
          this.playFloorAudio("floor_jumper_emerge", FLOOR_EMERGE_AUDIO_COOLDOWN_MS);
          this.onVfxEvent?.("emerge", this);
        } else {
          this.playAudio("jumper_vent_creak");
        }
        // Top anchor on emerge frames: position at vent top edge.
        // Creature extends downward via frame progression.
        this.container.y = this.grateTopY;
        this.container.alpha = 1;
        break;
      case "getting_up":
        // Silence. The emerge sound's tail covers this transition.
        this.container.y = this.floorY;
        break;
      case "crawling":
        if (this.ventPosition === "floor") {
          this.startCrawlSound();
        } else {
          this.playAudio("monster_alert_growl");
        }
        break;
      case "attacking":
        if (this.ventPosition === "floor") {
          this.playFloorAudio("floor_jumper_attack_charge", FLOOR_ATTACK_AUDIO_COOLDOWN_MS);
          this.attackLungeTimeout = setTimeout(() => {
            this.attackLungeTimeout = null;
            if (this.state === "attacking") {
              this.playFloorAudio("floor_jumper_attack_lunge", FLOOR_ATTACK_AUDIO_COOLDOWN_MS);
              this.onVfxEvent?.("attack_lunge", this);
            }
          }, 600);
        } else {
          this.playAudio("monster_charge_roar");
        }
        this.container.y = this.floorY;
        break;
      case "retreating":
        if (this.ventPosition === "floor") {
          this.playFloorAudio("floor_jumper_retreat", FLOOR_RETREAT_AUDIO_COOLDOWN_MS);
          this.stopCrawlSound();
          this.onVfxEvent?.("retreat", this);
        }
        break;
      case "dormant":
        this.stopCrawlSound();
        this.cancelAttackLunge();
        if (this.ventPosition === "floor") {
          this.container.y = this.grateBottomY;
          this.container.alpha = 0;
        } else {
          this.container.y = this.hotspot.ventY;
        }
        break;
    }

    // Toggle dripSprite visibility: hide when sprite frames include
    // a baked-in vent (idle, emerge); show when frames are clean creature.
    if (this.dripSprite && this.ventPosition === "floor") {
      this.dripSprite.visible = !this.currentStateHasBakedVent();
    }

    this.updateZIndexForVentStacking();
  }

  // State update handlers

  private updateDormant(playerX: number, playerCrouched: boolean): void {
    if (playerCrouched) return;
    if (performance.now() < this.cooldownExpiresAt) return;

    const inRange = Math.abs(playerX - this.hotspot.x) < JUMPER_TRIGGER_RADIUS_X;
    if (!inRange) {
      this.playerWasInRange = false;
      return;
    }

    if (this.playerWasInRange) return;
    this.playerWasInRange = true;

    const roll = Math.random();
    if (roll < JUMPER_REAL_ATTACK_CHANCE) {
      // Floor variant: emerge from floor; ceiling: drop from above
      this.enterState(this.ventPosition === "floor" ? "emerging" : "triggered");
    } else if (roll < JUMPER_REAL_ATTACK_CHANCE + JUMPER_FAKE_ATTACK_CHANCE) {
      this.enterState("fake_attacking");
    } else {
      this.enterState("peeking");
    }
  }

  private updatePeeking(): void {
    if (this.stateTimer >= JUMPER_PEEK_DURATION_MS) {
      this.cooldownExpiresAt = performance.now() + JUMPER_COOLDOWN_AFTER_PEEK_MS;
      this.playerWasInRange = false;
      this.enterState("dormant");
    }
  }

  private updateFakeAttacking(): void {
    // Floor variant: container stays at vent top. Emerge frames provide
    // a 3-phase visual (push through, hold, retreat) via manual frame
    // control. No Y interpolation needed; the creature extends downward
    // through the vent as frame height increases.
    if (this.ventPosition === "floor") {
      this.container.y = this.grateTopY;

      const t1 = JUMPER_FAKE_EMERGE_DURATION_MS;
      const t2 = t1 + JUMPER_FAKE_HOLD_MS;

      let targetFrame: number;
      if (this.stateTimer < t1) {
        // Emerge phase: frames 0 -> 5
        const u = this.stateTimer / t1;
        targetFrame = Math.min(FRAMES_PER_STATE - 1, Math.floor(u * FRAMES_PER_STATE));
      } else if (this.stateTimer < t2) {
        // Hold phase: stay on last frame
        targetFrame = FRAMES_PER_STATE - 1;
      } else {
        // Retreat phase: frames 5 -> 0
        const u = Math.min(1, (this.stateTimer - t2) / JUMPER_FAKE_RETREAT_DURATION_MS);
        targetFrame = Math.max(0, FRAMES_PER_STATE - 1 - Math.floor(u * FRAMES_PER_STATE));
      }

      if (targetFrame !== this.frameIndex) {
        this.frameIndex = targetFrame;
        this.applyFrame(this.frameIndex);
      }
    }

    if (!this.fakeHissPlayed && this.stateTimer >= JUMPER_FAKE_EMERGE_DURATION_MS) {
      this.fakeHissPlayed = true;
      this.playAudio("jumper_fakeout_hiss");
    }

    const totalDuration =
      JUMPER_FAKE_EMERGE_DURATION_MS + JUMPER_FAKE_HOLD_MS + JUMPER_FAKE_RETREAT_DURATION_MS;
    if (this.stateTimer >= totalDuration) {
      this.cooldownExpiresAt = performance.now() + JUMPER_COOLDOWN_AFTER_FAKE_MS;
      this.playerWasInRange = false;
      this.enterState("dormant");
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

    if (this.ventPosition === "floor") {
      this.container.y = this.floorY;
    }

    if (this.stateTimer >= JUMPER_ATTACK_DURATION_MS) {
      this.enterState("retreating");
    }
  }

  private updateRetreating(): void {
    const duration = this.ventPosition === "floor"
      ? FLOOR_RETREAT_DURATION_MS
      : JUMPER_RETREAT_DURATION_MS;
    const t = Math.min(1, this.stateTimer / duration);

    if (this.ventPosition === "ceiling") {
      // Rise back to ceiling ventY
      this.container.y = this.floorY + (this.hotspot.ventY - this.floorY) * t;
    } else {
      // Sink back into floor vent
      this.container.y = this.floorY + (this.grateBottomY - this.floorY) * t;
      this.container.alpha = 1 - t;
    }

    if (this.stateTimer >= duration) {
      this.cooldownExpiresAt = performance.now() + JUMPER_COOLDOWN_AFTER_REAL_MS;
      this.playerWasInRange = false;
      this.enterState("dormant");
    }
  }

  // Floor variant state handlers

  private updateEmerging(): void {
    // Vent stays fixed at top; emerge frames extend creature downward.
    // No Y interpolation. Frame progression from emerge1 (vent + eyes)
    // to emerge6 (vent + full creature) provides the visual.
    this.container.y = this.grateTopY;

    if (this.stateTimer >= FLOOR_EMERGING_DURATION_MS) {
      this.enterState("getting_up");
    }
  }

  private updateGettingUp(): void {
    this.container.y = this.floorY;
    if (this.stateTimer >= FLOOR_GETTING_UP_DURATION_MS) {
      this.enterState("crawling");
    }
  }

  private updateCrawling(dtMS: number, playerX: number): void {
    this.container.y = this.floorY;
    const dx = playerX - this.container.x;
    const dir = Math.sign(dx);
    this.container.x += dir * FLOOR_CRAWLING_SPEED_PX_PER_SEC * (dtMS / 1000);

    // Face toward player
    if (dx !== 0) {
      this.sprite.scale.x = dx > 0 ? Math.abs(this.sprite.scale.x) : -Math.abs(this.sprite.scale.x);
    }

    if (Math.abs(playerX - this.container.x) < JUMPER_CATCH_DISTANCE) {
      this.enterState("attacking");
      return;
    }

    if (this.stateTimer >= FLOOR_CRAWLING_DURATION_MS) {
      this.enterState("retreating");
    }
  }

  // Visibility (floor variant proximity)

  private updateVisibility(playerX: number): void {
    if (this.ventPosition !== "floor") return;

    if (this.state === "dormant") {
      const distance = Math.abs(playerX - this.hotspot.x);
      this.container.y = this.grateBottomY;
      this.container.alpha = distance < FLOOR_VISIBILITY_RANGE_PX ? 1 : 0;
    } else if (this.state === "peeking") {
      this.container.y = this.grateBottomY;
    }
  }

  private updateZIndexForVentStacking(): void {
    if (this.ventPosition !== "floor") return;

    const peekingStates: JumperState[] = ["dormant", "peeking"];
    this.container.zIndex = peekingStates.includes(this.state) ? 15 : 90;

    if (import.meta.env?.DEV) {
      const z = this.container.zIndex;
      console.assert(
        z === 15 || z === 90,
        `Unexpected jumper zIndex ${z} in state ${this.state}`,
      );
    }
  }

  // Returns true when the current floor-variant state uses sprite frames
  // with the vent grate baked in (idle, emerge prefixes). Used to toggle
  // dripSprite visibility so only one vent source is visible at a time.
  private currentStateHasBakedVent(): boolean {
    if (this.ventPosition !== "floor") return false;
    const prefix = this.getStateFramePrefix(this.state);
    return prefix === "idle" || prefix === "emerge";
  }

  // Animation

  private advanceFrame(dtMS: number): void {
    // Floor fake_attacking uses manual frame control in updateFakeAttacking.
    if (this.ventPosition === "floor" && this.state === "fake_attacking") return;

    const interval = this.state === "peeking"
      ? FRAME_INTERVAL_MS_PEEKING
      : this.state === "crawling"
        ? FRAME_INTERVAL_MS_CRAWLING
        : FRAME_INTERVAL_MS;

    this.frameTimer += dtMS;
    if (this.frameTimer >= interval) {
      this.frameTimer -= interval;

      const reversed =
        this.ventPosition === "floor" &&
        FLOOR_REVERSE_PLAYBACK_STATES.includes(this.state);

      if (this.state === "dormant" || this.state === "peeking" || this.state === "crawling") {
        // Loop frames continuously
        this.frameIndex = (this.frameIndex + 1) % FRAMES_PER_STATE;
      } else if (reversed) {
        // Play in reverse: start from last frame, count down to 0
        if (this.frameIndex > 0) {
          this.frameIndex--;
        }
      } else {
        // Play once through the strip, hold on last frame
        if (this.frameIndex < FRAMES_PER_STATE - 1) {
          this.frameIndex++;
        }
      }
      this.applyFrame(this.frameIndex);
    }
  }

  private getStateFramePrefix(state: JumperState): string {
    return this.ventPosition === "floor"
      ? STATE_FRAME_PREFIX_FLOOR[state]
      : STATE_FRAME_PREFIX_CEILING[state];
  }

  private applyFrame(index: number): void {
    const prefix = this.getStateFramePrefix(this.state);
    const frameName = `${prefix}${index + 1}`;
    const texture = getFrameTexture(this.manifest, "jumper", frameName);
    this.sprite.texture = texture;

    const meta = getFrameMeta(this.manifest, "jumper", frameName);

    // Emerge frames on floor variant: anchor at top so the vent grate
    // stays pinned to container.y while the creature extends downward.
    if (this.ventPosition === "floor" && prefix === "emerge") {
      this.sprite.anchor.set(0.5, 0.0);
    } else {
      this.sprite.anchor.set(0.5, meta.baselineY / meta.height);
    }

    this.applyLockedSpriteSize();
  }

  private applyLockedSpriteSize(): void {
    // Emerge-prefix frames on floor variant: scale by vent width so the
    // vent silhouette stays consistent across emerge1 (284x185) through
    // emerge6 (283x494). Creature extension grows with frame height.
    const prefix = this.getStateFramePrefix(this.state);
    if (this.ventPosition === "floor" && prefix === "emerge") {
      const textureWidth = this.sprite.texture.width;
      const scale = FLOOR_EMERGE_TARGET_VENT_WIDTH / Math.max(1, textureWidth);
      this.sprite.scale.set(scale);
      return;
    }

    const map = this.ventPosition === "floor"
      ? FLOOR_SPRITE_HEIGHT_BY_STATE
      : CEILING_SPRITE_HEIGHT_BY_STATE;
    const targetHeight = map[this.state];
    if (targetHeight === undefined) {
      this.sprite.scale.set(1.0);
      return;
    }

    const textureHeight = this.sprite.texture.height;
    const textureWidth = this.sprite.texture.width;
    const heightScale = targetHeight / Math.max(1, textureHeight);

    // Apply per-state max-width cap for the floor variant only.
    const maxWidth = this.ventPosition === "floor"
      ? FLOOR_SPRITE_MAX_WIDTH_BY_STATE[this.state]
      : undefined;

    const widthScale = maxWidth !== undefined
      ? maxWidth / Math.max(1, textureWidth)
      : Infinity;

    const scale = Math.min(heightScale, widthScale);
    this.sprite.scale.set(scale);
  }

  // Audio

  private playAudio(id: AudioId): void {
    if (audioManager.has(id)) {
      audioManager.playOneShot(id);
    }
  }

  /** Play a floor-jumper sound with per-sound cooldown and distance-based volume. */
  private playFloorAudio(id: AudioId, cooldownMs: number): void {
    const now = performance.now();
    const last = this.soundCooldowns.get(id) ?? 0;
    if (now - last < cooldownMs) return;
    this.soundCooldowns.set(id, now);

    const vol = this.distanceVolume(this.lastPlayerX);
    if (vol <= 0) return;
    audioManager.playOneShot(id, vol);
  }

  private startCrawlSound(): void {
    if (this.crawlSoundPlaying) return;
    const vol = this.distanceVolume(this.lastPlayerX);
    if (vol <= 0) return;
    audioManager.setVolume("floor_jumper_crawl" as AudioId, vol);
    audioManager.loop("floor_jumper_crawl" as AudioId);
    this.crawlSoundPlaying = true;
  }

  stopCrawlSound(): void {
    if (!this.crawlSoundPlaying) return;
    audioManager.stop("floor_jumper_crawl" as AudioId);
    this.crawlSoundPlaying = false;
  }

  cancelAttackLunge(): void {
    if (this.attackLungeTimeout !== null) {
      clearTimeout(this.attackLungeTimeout);
      this.attackLungeTimeout = null;
    }
  }

  /** Compute volume multiplier 0-1 based on distance to player. */
  private distanceVolume(playerX: number): number {
    const dist = Math.abs(this.container.x - playerX);
    if (dist < AUDIO_FULL_VOLUME_DIST) return 1;
    if (dist > AUDIO_MUTE_DIST) return 0;
    return 1 - (dist - AUDIO_FULL_VOLUME_DIST) / (AUDIO_MUTE_DIST - AUDIO_FULL_VOLUME_DIST);
  }
}
