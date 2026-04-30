import { Container, Sprite, Texture } from "pixi.js";
import { MonsterState } from "./types";
import { Manifest, getFrameTexture, getFrameMeta } from "./assets";

// ── Transition table ──
// Organic transitions only. Debug forceState bypasses this.
// Room reset also bypasses (always resets to PATROL).
const VALID_TRANSITIONS: Record<MonsterState, MonsterState[]> = {
  PATROL: ["ALERT", "IDLE_HOWL"],
  ALERT: ["HUNT", "PATROL"],
  HUNT: ["CHARGE", "PATROL"],
  CHARGE: ["ATTACK", "HUNT"],
  ATTACK: ["IDLE_HOWL"],
  IDLE_HOWL: ["PATROL"],
};

// ── Speeds (pixels per frame at 60 fps) ──
const PATROL_SPEED = 1.5;
const HUNT_SPEED = PATROL_SPEED * 1.4;
const CHARGE_SPEED = PATROL_SPEED * 3;

// ── Suspicion ──
const SUSPICION_MAX = 100;
const SUSPICION_DECAY_PER_SEC = 5;
const SUSPICION_ALERT = 30;
const SUSPICION_HUNT = 60;
const SUSPICION_LOST = 20;

// ── Timing (ms) ──
const ALERT_WINDUP_MS = 1500;
const CHARGE_MAX_MS = 1000;
const ATTACK_DURATION_MS = 800;
const HOWL_DURATION_MS = 3000;
const PATROL_PAUSE_MS = 2000;
const HOWL_RANDOM_MS = 20000;

// ── Distances (px) ──
const CHARGE_TRIGGER = 200;
const ATTACK_TRIGGER = 80;
const CATCH_DIST = 80;

// Dash burst: 25% chance during CHARGE state
const DASH_PROBABILITY = 0.25;
const DASH_SPEED_MULT = 1.5;
const DASH_DURATION_MS = 600;

// States where the monster can catch the player
const CATCH_STATES: MonsterState[] = ["HUNT", "CHARGE", "ATTACK", "IDLE_HOWL"];

// ── Frame configs per state ──
interface FrameConfig {
  frames: string[];
  intervalMS: number;
}

const STATE_FRAMES: Record<MonsterState, FrameConfig> = {
  PATROL: { frames: ["walk1", "walk2", "walk3", "walk4"], intervalMS: 150 },
  ALERT: { frames: ["alert1", "alert2"], intervalMS: 300 },
  HUNT: { frames: ["hunt1", "hunt2", "hunt3", "hunt4"], intervalMS: 150 },
  CHARGE: { frames: ["charge1", "charge2", "charge3", "charge4"], intervalMS: 100 },
  ATTACK: { frames: ["attack1", "attack2", "attack3"], intervalMS: 267 },
  IDLE_HOWL: { frames: ["howl1", "howl2"], intervalMS: 400 },
};

const PATROL_IDLE_FRAMES: FrameConfig = {
  frames: ["idle1", "idle2"],
  intervalMS: 300,
};

export class Monster extends Container {
  public state: MonsterState = "PATROL";
  private _suspicion = 0;

  // Lure target (radio bait mechanic)
  private lureTargetX: number | null = null;
  private lureExpiresAt: number = 0;

  // Temporary difficulty buff (applied on puzzle fail)
  private speedMultiplier: number = 1.0;
  private dashChanceMultiplier: number = 1.0;
  private buffExpiresAt: number = 0;

  // Sprite and animation
  private sprite: Sprite;
  private manifest: Manifest;
  private currentFrames: string[] = [];
  private currentInterval = 150;
  private frameIndex = 0;
  private frameTimer = 0;

  // Direction
  private facing: 1 | -1 = -1;

  // Patrol
  private patrolPath: [number, number];
  private patrolTarget: number;
  private patrolPaused = false;
  private patrolPauseTimer = 0;
  private howlCountdown: number;

  // Generic state timer (reset on every state enter)
  private stateTimer = 0;

  // Dash sub-mode of CHARGE
  private isDashing = false;

  // Player reference for tracking
  private playerRef: { x: number };

  // Room bounds
  private roomLeft = 60;
  private roomRight = 3000;

  constructor(
    manifest: Manifest,
    patrolPath: [number, number],
    spawnX: number,
    playerRef: { x: number },
    roomWidth: number,
  ) {
    super();

    this.manifest = manifest;
    this.patrolPath = patrolPath;
    this.playerRef = playerRef;
    this.roomLeft = 60;
    this.roomRight = roomWidth - 60;

    // Create sprite with initial idle frame
    const texture = getFrameTexture(manifest, "monster", "idle1");
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.5);
    this.addChild(this.sprite);

    this.x = spawnX;
    this.patrolTarget = patrolPath[0];
    this.howlCountdown = HOWL_RANDOM_MS * (0.5 + Math.random() * 0.5);

    this.applySpriteAnchor("idle1");
    this.enterState("PATROL", true);
  }

  get suspicion(): number {
    return this._suspicion;
  }

  addSuspicion(amount: number): void {
    this._suspicion = Math.min(SUSPICION_MAX, Math.max(0, this._suspicion + amount));
  }

  setSuspicion(value: number): void {
    this._suspicion = Math.min(SUSPICION_MAX, Math.max(0, value));
  }

  /** Apply suspicion decay with a multiplier. Called from Game each frame.
   *  Decay applies in PATROL, ALERT, HUNT, CHARGE. Not in ATTACK or IDLE_HOWL. */
  applyDecay(dtMS: number, multiplier: number = 1): void {
    if (this.state === "ATTACK" || this.state === "IDLE_HOWL") return;
    this._suspicion = Math.max(
      0,
      this._suspicion - SUSPICION_DECAY_PER_SEC * multiplier * (dtMS / 1000),
    );
  }

  /** Divert the monster toward a world position for a duration (radio bait). */
  public startLure(opts: { targetX: number; durationMs: number }): void {
    this.lureTargetX = opts.targetX;
    this.lureExpiresAt = performance.now() + opts.durationMs;
    if (this.state !== "HUNT" && this.state !== "CHARGE") {
      this.enterState("HUNT", true);
    }
  }

  /** Temporarily boost speed and dash chance (decays after durationMs). */
  public applyDifficultyBuff(opts: {
    speedMultiplier: number;
    dashChanceMultiplier: number;
    durationMs: number;
  }): void {
    this.speedMultiplier = opts.speedMultiplier;
    this.dashChanceMultiplier = opts.dashChanceMultiplier;
    this.buffExpiresAt = performance.now() + opts.durationMs;
  }

  private updateBuff(): void {
    if (this.buffExpiresAt > 0 && performance.now() >= this.buffExpiresAt) {
      this.speedMultiplier = 1.0;
      this.dashChanceMultiplier = 1.0;
      this.buffExpiresAt = 0;
    }
  }

  /** Returns lure target if active, otherwise player position. */
  private getHuntTargetX(): number {
    if (this.lureTargetX !== null && performance.now() < this.lureExpiresAt) {
      return this.lureTargetX;
    }
    this.lureTargetX = null;
    return this.playerRef.x;
  }

  public onStateChange: ((state: MonsterState) => void) | null = null;
  public onDashStart: (() => void) | null = null;

  update(dt: number, dtMS: number): void {
    this.updateBuff();

    // Confused animation overrides normal frame cycling when lured
    if (this.isLured) {
      this.updateLureAnimation(dtMS);
    } else {
      this.advanceFrame(dtMS);
    }
    this.stateTimer += dtMS;

    switch (this.state) {
      case "PATROL":
        this.updatePatrol(dt, dtMS);
        break;
      case "ALERT":
        this.updateAlert();
        break;
      case "HUNT":
        this.updateHunt(dt);
        break;
      case "CHARGE":
        this.updateCharge(dt);
        break;
      case "ATTACK":
        this.updateAttack();
        break;
      case "IDLE_HOWL":
        this.updateHowl();
        break;
    }

    this.sprite.scale.x = this.facing;
    this.x = Math.max(this.roomLeft, Math.min(this.roomRight, this.x));
  }

  isPlayerCaught(): boolean {
    const inSet = CATCH_STATES.includes(this.state);
    const px = this.playerRef.x;
    const dx = Math.abs(this.x - px);
    return inSet && dx <= CATCH_DIST;
  }

  // ── State enter ──

  private enterState(newState: MonsterState, force = false): void {
    if (!force) {
      const allowed = VALID_TRANSITIONS[this.state];
      if (allowed && !allowed.includes(newState)) {
        const msg = `Monster: invalid transition ${this.state} -> ${newState} (allowed: ${allowed.join(", ")})`;
        if (import.meta.env.DEV) {
          throw new Error(msg);
        }
        console.warn(msg);
      }
    }

    const prevState = this.state;

    this.state = newState;
    this.stateTimer = 0;

    // Dash sub-mode: roll once per CHARGE entry
    if (newState === "CHARGE") {
      this.isDashing = Math.random() < DASH_PROBABILITY * this.dashChanceMultiplier;
      if (this.isDashing) {
        this.onDashStart?.();
      }
    } else {
      this.isDashing = false;
    }

    if (newState !== prevState) {
      this.onStateChange?.(newState);
    }

    if (newState === "PATROL") {
      this.patrolPaused = false;
      this.patrolPauseTimer = 0;
      this.setAnim(STATE_FRAMES.PATROL);
    } else {
      this.setAnim(STATE_FRAMES[newState]);
    }
  }

  // ── State updates ──

  private updatePatrol(dt: number, dtMS: number): void {
    // Decay is now handled externally via applyDecay() called from Game

    // Check alert threshold
    if (this._suspicion >= SUSPICION_ALERT) {
      this.enterState("ALERT");
      return;
    }

    // Random howl countdown
    this.howlCountdown -= dtMS;
    if (this.howlCountdown <= 0) {
      this.howlCountdown = HOWL_RANDOM_MS * (0.5 + Math.random() * 0.5);
      this.enterState("IDLE_HOWL");
      return;
    }

    // Paused at waypoint
    if (this.patrolPaused) {
      this.patrolPauseTimer -= dtMS;
      if (this.patrolPauseTimer <= 0) {
        this.patrolPaused = false;
        this.setAnim(STATE_FRAMES.PATROL);
        this.patrolTarget =
          this.patrolTarget === this.patrolPath[0]
            ? this.patrolPath[1]
            : this.patrolPath[0];
      }
      return;
    }

    // Walk toward target
    const dx = this.patrolTarget - this.x;
    if (Math.abs(dx) < 5) {
      this.patrolPaused = true;
      this.patrolPauseTimer = PATROL_PAUSE_MS;
      this.setAnim(PATROL_IDLE_FRAMES);
      return;
    }

    this.facing = dx > 0 ? 1 : -1;
    this.x += this.facing * PATROL_SPEED * this.speedMultiplier * dt;
  }

  private updateAlert(): void {
    // Face player
    const dx = this.playerRef.x - this.x;
    this.facing = dx > 0 ? 1 : -1;

    // Suspicion frozen during alert. After windup, decide.
    if (this.stateTimer >= ALERT_WINDUP_MS) {
      if (this._suspicion >= SUSPICION_HUNT) {
        this.enterState("HUNT");
      } else {
        this.enterState("PATROL");
      }
    }
  }

  private updateHunt(dt: number): void {
    // Suspicion frozen. Check if lost track (skip if lure active).
    if (this._suspicion < SUSPICION_LOST && this.lureTargetX === null) {
      this.enterState("PATROL");
      return;
    }

    // Move toward hunt target (player or lure)
    const targetX = this.getHuntTargetX();
    const dx = targetX - this.x;
    this.facing = dx > 0 ? 1 : -1;
    this.x += this.facing * HUNT_SPEED * this.speedMultiplier * dt;

    // Close enough to charge
    if (Math.abs(dx) <= CHARGE_TRIGGER) {
      this.enterState("CHARGE");
    }
  }

  private updateCharge(dt: number): void {
    let chargeSpeed = CHARGE_SPEED;
    if (this.isDashing && this.stateTimer <= DASH_DURATION_MS) {
      chargeSpeed = CHARGE_SPEED * DASH_SPEED_MULT;
    }
    const targetX = this.getHuntTargetX();
    const dx = targetX - this.x;
    this.facing = dx > 0 ? 1 : -1;
    this.x += this.facing * chargeSpeed * this.speedMultiplier * dt;

    if (Math.abs(dx) <= ATTACK_TRIGGER) {
      this.enterState("ATTACK");
      return;
    }

    if (this.stateTimer >= CHARGE_MAX_MS) {
      this.enterState("HUNT");
    }
  }

  private updateAttack(): void {
    if (this.stateTimer >= ATTACK_DURATION_MS) {
      this.enterState("IDLE_HOWL");
    }
  }

  private updateHowl(): void {
    if (this.stateTimer >= HOWL_DURATION_MS) {
      this.enterState("PATROL");
    }
  }

  // ── Animation helpers ──

  private setAnim(cfg: FrameConfig): void {
    this.currentFrames = cfg.frames;
    this.currentInterval = cfg.intervalMS;
    this.frameIndex = 0;
    this.frameTimer = 0;
    if (cfg.frames.length > 0) {
      this.applyFrame(cfg.frames[0]);
    }
  }

  private advanceFrame(dtMS: number): void {
    if (this.currentFrames.length <= 1) return;
    this.frameTimer += dtMS;
    if (this.frameTimer >= this.currentInterval) {
      this.frameTimer -= this.currentInterval;
      this.frameIndex = (this.frameIndex + 1) % this.currentFrames.length;
      this.applyFrame(this.currentFrames[this.frameIndex]);
    }
  }

  private applyFrame(frameName: string): void {
    const texture = getFrameTexture(this.manifest, "monster", frameName);
    if (texture === Texture.WHITE) {
      console.error(`Missing monster frame: monster:${frameName}`);
    }
    this.sprite.texture = texture;
    this.applySpriteAnchor(frameName);
  }

  private applySpriteAnchor(frameName: string): void {
    const meta = getFrameMeta(this.manifest, "monster", frameName);
    this.sprite.anchor.set(0.5, meta.baselineY / meta.height);
  }

  // ── Confused animation (lure state) ──

  private confusedFrameNames: string[] = [];
  private confusedFrameIdx = 0;
  private confusedFrameTimer = 0;
  private hasConfusedFrames = false;

  /** Check if confused frames exist in the manifest. Call once after construction. */
  loadConfusedFrames(): void {
    const entry = this.manifest["monster"];
    if (!entry || entry.type !== "character") return;
    this.confusedFrameNames = Object.keys(entry.frames)
      .filter((n) => n.startsWith("confused"))
      .sort();
    this.hasConfusedFrames = this.confusedFrameNames.length > 0;
    if (this.hasConfusedFrames) {
      console.info(
        `[monster] confused frames loaded: ${this.confusedFrameNames.length}`,
      );
    }
  }

  /** Returns true when the monster is actively lured by radio bait. */
  get isLured(): boolean {
    return (
      this.lureTargetX !== null && performance.now() < this.lureExpiresAt
    );
  }

  updateLureAnimation(dtMs: number): void {
    if (!this.isLured) {
      // Clear tint/rotation when lure ends
      this.sprite.tint = 0xffffff;
      this.sprite.rotation = 0;
      return;
    }

    if (this.hasConfusedFrames) {
      this.confusedFrameTimer += dtMs;
      if (this.confusedFrameTimer > 200) {
        this.confusedFrameTimer = 0;
        this.confusedFrameIdx =
          (this.confusedFrameIdx + 1) % this.confusedFrameNames.length;
        const frameName = this.confusedFrameNames[this.confusedFrameIdx];
        this.applyFrame(frameName);
      }
    } else {
      // Fallback: purple tint + slow rotation oscillation
      this.sprite.tint = 0xaa88cc;
      this.sprite.rotation = Math.sin(performance.now() / 300) * 0.05;
    }
  }

  // ── Sprite scale access for death cinematic ──

  get spriteScaleX(): number {
    return Math.abs(this.sprite.scale.x);
  }

  setSpriteScale(s: number): void {
    this.sprite.scale.set(this.facing * s, s);
  }

  override destroy(): void {
    this.sprite.destroy();
    super.destroy();
  }
}
