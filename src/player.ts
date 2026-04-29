import { Container, AnimatedSprite, Texture } from 'pixi.js';
import { Manifest, getFrameTexture, getFrameMeta } from './assets';
import { Input } from './input';
import type { HidingSpotKind } from './types';

export type PlayerState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'CROUCH_IDLE'
  | 'CROUCH_WALK'
  | 'HIDING_LOCKER'
  | 'HIDING_DESK_ENTERING'
  | 'HIDING_DESK_IDLE'
  | 'HIDING_DESK_EXITING'
  | 'CAUGHT';

interface AnimDef {
  frameNames: string[];
  speed: number;
  moveSpeed: number;
  loop?: boolean;           // default true; false = play once then fire onComplete
  nextState?: PlayerState;  // auto-transition target when loop=false animation ends
  visualScale?: number;     // uniform scale factor for oversized frames (desk-hide sprites)
}

const ANIM_DEFS: Record<PlayerState, AnimDef> = {
  IDLE:           { frameNames: ['idle'],                                                         speed: 0,     moveSpeed: 0 },
  WALK:           { frameNames: ['walk1', 'walk2', 'walk3', 'walk4'],                             speed: 0.13,  moveSpeed: 3 },
  RUN:            { frameNames: ['run1', 'run2', 'run3', 'run4'],                                 speed: 0.2,   moveSpeed: 6 },
  CROUCH_IDLE:    { frameNames: ['crouch-idle1', 'crouch-idle2'],                                 speed: 0.05,  moveSpeed: 0 },
  CROUCH_WALK:    { frameNames: ['crouch-walk1', 'crouch-walk2', 'crouch-walk3', 'crouch-walk4'], speed: 0.1,   moveSpeed: 1.5 },
  HIDING_LOCKER:  { frameNames: ['crouch-idle1', 'crouch-idle2'],                                 speed: 0.03,  moveSpeed: 0 },
  HIDING_DESK_ENTERING: {
    frameNames: ['hide-desk-enter1', 'hide-desk-enter2', 'hide-desk-enter3', 'hide-desk-enter4', 'hide-desk-enter5', 'hide-desk-enter6'],
    speed: 0.15,
    moveSpeed: 0,
    loop: false,
    nextState: 'HIDING_DESK_IDLE',
    visualScale: 0.88,
  },
  HIDING_DESK_IDLE: {
    frameNames: ['hide-desk-idle1', 'hide-desk-idle2', 'hide-desk-idle3', 'hide-desk-idle4', 'hide-desk-idle5', 'hide-desk-idle6'],
    speed: 0.008,
    moveSpeed: 0,
    visualScale: 0.88,
  },
  HIDING_DESK_EXITING: {
    frameNames: ['hide-desk-exit1', 'hide-desk-exit2', 'hide-desk-exit3', 'hide-desk-exit4', 'hide-desk-exit5', 'hide-desk-exit6'],
    speed: 0.15,
    moveSpeed: 0,
    loop: false,
    nextState: 'IDLE',
    visualScale: 0.88,
  },
  CAUGHT:         { frameNames: ['caught1', 'caught2', 'caught3', 'dead-collapsed'],              speed: 0.083, moveSpeed: 0, loop: false },
};

export class Player extends Container {
  private sprite: AnimatedSprite;
  private manifest: Manifest;
  private currentState: PlayerState;
  private facing: 1 | -1 = 1;
  private activeFrameNames: string[] = [];
  private roomWidth = 3344;

  // Caught sequence state
  private stateLocked = false;
  public caughtComplete = false;

  // Desk hide animation callbacks (wired by game.ts)
  public onDeskEnterComplete: (() => void) | null = null;
  public onDeskExitComplete: (() => void) | null = null;

  constructor(manifest: Manifest) {
    super();
    this.manifest = manifest;

    const idleTexture = getFrameTexture(manifest, 'player', 'idle');
    this.sprite = new AnimatedSprite([idleTexture]);
    this.sprite.anchor.set(0.5, 0.5);
    this.addChild(this.sprite);

    this.sprite.onFrameChange = (currentFrame: number) => {
      this.updateAnchor(currentFrame);
    };

    // Force initial state setup (bypass the same-state guard by starting undefined)
    this.currentState = undefined as unknown as PlayerState;
    this.setState('IDLE');
  }

  get movementState(): PlayerState {
    return this.currentState;
  }

  get facingDirection(): 1 | -1 {
    return this.facing;
  }

  setRoomWidth(width: number) {
    this.roomWidth = width;
  }

  private updateAnchor(frameIndex: number) {
    const frameName = this.activeFrameNames[frameIndex];
    if (!frameName) return;
    const meta = getFrameMeta(this.manifest, 'player', frameName);
    this.sprite.anchor.set(0.5, meta.baselineY / meta.height);
  }

  // _internal: bypasses stateLocked guard (used by auto-transitions and startExitDeskHide)
  private setState(newState: PlayerState, _internal = false) {
    if (!_internal && this.stateLocked && newState !== 'CAUGHT') return;
    if (this.currentState === newState) return;
    this.currentState = newState;

    const def = ANIM_DEFS[newState];
    const entry = this.manifest['player'];
    if (!entry || entry.type !== 'character') return;

    // Use only frames that exist in the manifest
    this.activeFrameNames = def.frameNames.filter((name) => name in entry.frames);
    if (this.activeFrameNames.length === 0) return;

    const textures = this.activeFrameNames.map((name) =>
      getFrameTexture(this.manifest, 'player', name),
    );

    this.sprite.textures = textures;
    this.sprite.animationSpeed = def.speed;

    // Apply visual scale (desk-hide frames contain player+desk at larger native size)
    const vs = def.visualScale ?? 1.0;
    this.sprite.scale.set(this.facing * vs, vs);

    if (def.loop === false) {
      // Non-looping: play once then auto-transition or signal completion
      this.sprite.loop = false;
      this.sprite.onComplete = () => {
        if (newState === 'CAUGHT') {
          this.caughtComplete = true;
        } else if (def.nextState) {
          const wasExiting = newState === 'HIDING_DESK_EXITING';
          if (wasExiting) this.stateLocked = false;
          this.setState(def.nextState, true);
          if (newState === 'HIDING_DESK_ENTERING') this.onDeskEnterComplete?.();
          if (wasExiting) this.onDeskExitComplete?.();
        }
      };
      this.sprite.gotoAndPlay(0);
    } else {
      this.sprite.loop = true;
      this.sprite.onComplete = undefined;
      if (textures.length > 1 && def.speed > 0) {
        this.sprite.play();
      } else {
        this.sprite.gotoAndStop(0);
      }
    }

    // onFrameChange does not fire for gotoAndStop, so set anchor manually
    this.updateAnchor(0);
  }

  /** Trigger the caught/death animation sequence. Input is locked until restart. */
  startCaughtSequence(): void {
    this.stateLocked = true;
    this.caughtComplete = false;
    // Reset state identity so setState will accept CAUGHT
    this.currentState = undefined as unknown as PlayerState;
    this.setState('CAUGHT');
  }

  /** Enter a hiding pose (locks input until setStandingPose). */
  setHidingPose(kind: HidingSpotKind): void {
    this.caughtComplete = false;
    this.currentState = undefined as unknown as PlayerState;
    this.setState(kind === "locker" ? "HIDING_LOCKER" : "HIDING_DESK_ENTERING");
    this.stateLocked = true;
  }

  /** Exit hiding, return to idle. */
  setStandingPose(): void {
    this.stateLocked = false;
    this.caughtComplete = false;
    this.currentState = undefined as unknown as PlayerState;
    this.setState("IDLE");
  }

  /** Trigger the desk-exit animation. Called by game.ts when player presses E to leave desk. */
  startExitDeskHide(): void {
    if (this.currentState !== 'HIDING_DESK_IDLE' && this.currentState !== 'HIDING_DESK_ENTERING') return;
    this.setState('HIDING_DESK_EXITING', true);
  }

  /** True when crouching or hiding under a desk (used for decay multiplier). */
  isCrouching(): boolean {
    return (
      this.currentState === "CROUCH_IDLE" ||
      this.currentState === "CROUCH_WALK" ||
      this.currentState === "HIDING_DESK_ENTERING" ||
      this.currentState === "HIDING_DESK_IDLE" ||
      this.currentState === "HIDING_DESK_EXITING"
    );
  }

  /** True when in any hiding state (locker or any desk sub-state). */
  isHiding(): boolean {
    return (
      this.currentState === "HIDING_LOCKER" ||
      this.currentState === "HIDING_DESK_ENTERING" ||
      this.currentState === "HIDING_DESK_IDLE" ||
      this.currentState === "HIDING_DESK_EXITING"
    );
  }

  update(dt: number, input: Input) {
    // During caught sequence, AnimatedSprite auto-plays via Ticker.shared.
    if (this.stateLocked) return;

    const moving = input.isLeft() || input.isRight();

    // Ctrl wins over Shift when both held simultaneously
    let newState: PlayerState;
    if (moving) {
      if (input.isCrouching()) {
        newState = 'CROUCH_WALK';
      } else if (input.isRunning()) {
        newState = 'RUN';
      } else {
        newState = 'WALK';
      }
    } else {
      newState = input.isCrouching() ? 'CROUCH_IDLE' : 'IDLE';
    }

    this.setState(newState);

    const speed = ANIM_DEFS[this.currentState].moveSpeed;
    let dx = 0;
    if (input.isLeft()) dx -= 1;
    if (input.isRight()) dx += 1;

    if (dx !== 0) {
      this.facing = dx > 0 ? 1 : -1;
      this.x += dx * speed * dt;
    }

    this.sprite.scale.x = this.facing;
    this.x = Math.max(60, Math.min(this.roomWidth - 60, this.x));
  }
}
