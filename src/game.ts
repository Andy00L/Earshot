import {
  Application,
  Container,
  Ticker,
  Sprite,
  TilingSprite,
  Graphics,
  Text,
  Assets,
  Texture,
} from "pixi.js";
import { Howler } from "howler";
import {
  GameState,
  createInitialGameState,
  RoomId,
  MonsterState,
  ArmedRadio,
  RadioPickupDef,
  VentDef,
  JumperHotspot,
  MaterialId,
  CraftedItemId,
  InventorySlotItem,
  LoreTapeId,
  isLoreTapeId,
  LadderDef,
} from "./types";
import { Manifest } from "./assets";
import { Player } from "./player";
import { Monster } from "./monster";
import { RoomManager, ROOM_DEFINITIONS } from "./rooms";
import { HUD } from "./hud";
import { Input } from "./input";
import { fadeTransition } from "./transition";
import { Pickup } from "./pickup";
import { HidingSpot } from "./hiding";
import { audioManager } from "./audio";
import { micAnalyser } from "./mic";
import { suspicionDeltaForFrame } from "./suspicion";
import {
  BeaconState,
  createBeaconState,
  classifyVoiceBand,
  updateBeacon,
  suspicionMultiplierForBand,
  RMS_THRESHOLD_WHISPER,
  RMS_THRESHOLD_NORMAL,
  RMS_THRESHOLD_SHOUT,
} from "./beacon";
import { Flashlight } from "./flashlight";
import { Jumper } from "./jumper";
import { Whisperer } from "./whisperer";
import { AmbientId, AudioId, LORE_TAPE_TRANSCRIPTS, MAP_FRAGMENT_TRANSCRIPT, TUTORIAL_TRANSCRIPTS } from "./audio-catalog";
import { RadioPopup } from "./radio-popup";
import { synthesizeTTS } from "./tts";
import { ScreenShake } from "./screen-shake";
import { Heartbeat } from "./heartbeat";
import { Vignette } from "./vignette";
import { RECIPES, craft } from "./crafting";
import { Projectile } from "./projectile";
import { FlareEffect } from "./flare-effect";
import { SmokeBombEffect } from "./smokebomb-effect";
import { DecoyEffect } from "./decoy-effect";
import { WorkbenchMenu } from "./workbench-menu";
import { ShadeVisual } from "./shade";
import { GuidanceArrow } from "./guidance-arrow";
import { getFrameMeta } from "./assets";

/** Revoke any outstanding TTS blob URLs to prevent memory leaks. */
function revokeRadioBlobs(radios: { ttsBlobUrl?: string | null }[]): void {
  for (const r of radios) {
    if (r.ttsBlobUrl) {
      URL.revokeObjectURL(r.ttsBlobUrl);
      r.ttsBlobUrl = null;
    }
  }
}

// Survives Game restart (audio stays loaded, mic stays active)
let audioInitialized = false;

/** Mark audio as pre-loaded (called from main.ts when boot loads audio early). */
export function markAudioInitialized(): void {
  audioInitialized = true;
}

// Survives Game restart (intro plays once per page load, not per restart)
let introPlayed = false;

// localStorage key: set after all 4 tutorials complete; skips on future runs
const TUTORIAL_SEEN_KEY = "earshot.tutorialSeen";

// Per-panel click indicator layout
const INTRO_INDICATOR_CONFIG: Record<0 | 1 | 2, { height: number; y: number }> = {
  0: { height: 56, y: 560 },
  1: { height: 56, y: 700 },
  2: { height: 56, y: 700 },
};

export class Game {
  private app: Application;
  private state: GameState;
  private manifest: Manifest;

  private world!: Container;
  private player!: Player;
  private monster: Monster | null = null;
  private rooms!: RoomManager;
  private hud!: HUD;
  private input!: Input;
  private pickups: Pickup[] = [];
  private hidingSpots: HidingSpot[] = [];
  private decorativeSprites: Sprite[] = [];
  private ventSprites: Sprite[] = [];
  private doorSprites: Sprite[] = [];
  private flickerTimers: { sprite: Sprite; timer: number; nextAt: number }[] = [];
  private flashlight: Flashlight | null = null;
  private jumpers: Jumper[] = [];
  private jumperDripSprites: Sprite[] = [];
  private whisperer: Whisperer | null = null;
  private whispererSpawnCheckTimer = 0;
  private static readonly WHISPERER_SPAWN_CHECK_INTERVAL_MS = 5000;
  private static readonly WHISPERER_SPAWN_PROBABILITY = 0.30;

  // Radio bait system
  private beaconState: BeaconState = createBeaconState();
  private radioPopup: RadioPopup;
  private workbenchMenu: WorkbenchMenu;

  // Crafting projectile/effect systems
  private projectiles: Projectile[] = [];
  private flareEffects: FlareEffect[] = [];
  private smokeBombEffects: SmokeBombEffect[] = [];
  private decoyEffects: DecoyEffect[] = [];
  private armedRadioSprites: Map<string, Sprite> = new Map();
  private droppedRadioSprites: Map<string, Sprite> = new Map();
  private spentRadioSprites: Map<string, Sprite> = new Map();
  private armedRadioAborts: Map<string, AbortController> = new Map();
  private activeRafIds: Set<number> = new Set();

  // Foreground layer (dividers that render above the player for occlusion)
  private foregroundLayer!: Container;

  // Upper floor state (Server room ladder system)
  private playerFloorYOverride: number | null = null;
  private playerClimbingLadder: LadderDef | null = null;
  private ladderSprites: Sprite[] = [];
  private upperBgSprite: Sprite | null = null;
  private upperCatwalkSprite: TilingSprite | null = null;

  // Desk-hide charge roll state (reset when monster leaves CHARGE or player exits hide)
  private deskChargeRolled = false;
  private deskChargeFound = false;

  // Prevents concurrent async operations (room transitions, death fade, win fade)
  private locked = false;

  // Day 5 polish systems
  private screenShake = new ScreenShake();
  private heartbeat = new Heartbeat();
  private vignette: Vignette | null = null;

  // End-screen overlay (gameover or win)
  private overlayContainer: Container | null = null;

  // Death fade overlay (tracked for cleanup on restart)
  private deathFadeOverlay: Graphics | null = null;

  // Shade death-drop system
  private shadeVisual: ShadeVisual | null = null;
  private deathSnapshot: {
    slots: (InventorySlotItem | null)[];
    x: number;
    y: number;
    room: RoomId;
  } | null = null;

  // Guidance arrow (points player toward next objective)
  private guidanceArrow: GuidanceArrow | null = null;

  // Footstep SFX timing
  private footstepTimer = 0;

  // Dark agitation state (Beacon=0 screams)
  private darkScreamTimer = 0;
  private darkScreamInterval = 0;
  private static readonly FOOTSTEP_WALK_MS = 400;
  private static readonly FOOTSTEP_RUN_MS = 250;

  // Dark agitation: scream pool when Beacon=0
  private static readonly DARK_SCREAM_IDS: AudioId[] = [
    "monster_alert_growl",
    "monster_hunt_screech",
    "monster_charge_roar",
    "monster_attack_lunge",
    "monster_idle_howl",
  ];

  // Tutorial message timers (cleared on death/win/restart)
  private tutorialTimers: ReturnType<typeof setTimeout>[] = [];
  private tutorialT0Queued = false;
  private tutorialT1Queued = false;

  // Visibility change cleanup
  private visibilityHandler: (() => void) | null = null;

  // Intro panel sequence
  private introContainer: Container | null = null;
  private introTransitioning = false;
  private introClickHandler: ((e: PointerEvent) => void) | null = null;
  private introEscHeldMs = 0;
  private introIndicator: Sprite | null = null;
  private introIndicatorPulseTime = 0;
  private introIndicatorBaseScale = 1;
  private introPanelVoiceoverStartMs = 0;
  private introPanelVoiceoverDurationMs = 0;
  private introBackButton: Sprite | null = null;

  constructor(app: Application, manifest: Manifest) {
    this.app = app;
    this.manifest = manifest;
    this.state = createInitialGameState();
    this.state.loadedLockers = this.rollLockerJumpers();
    this.radioPopup = new RadioPopup();
    this.workbenchMenu = new WorkbenchMenu();
  }

  async start(): Promise<void> {
    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    this.rooms = new RoomManager(this.world, "reception");

    // Align room bottom with canvas bottom
    this.world.y =
      this.app.screen.height - this.rooms.currentRoom.roomHeight;

    this.player = new Player(this.manifest);
    this.player.zIndex = 50;
    this.player.setRoomWidth(this.rooms.currentRoom.roomWidth);
    this.player.x = this.rooms.currentDef.playerSpawnFromLeft;
    this.player.y = this.rooms.currentRoom.floorY;
    this.world.addChild(this.player);

    // Wire desk hide animation callbacks
    this.player.onDeskEnterComplete = () => {
      this.state.hidingState.transitioning = false;
    };
    this.player.onDeskExitComplete = () => this.onDeskExitComplete();

    // Foreground layer renders above player (cubicle dividers, etc.)
    this.foregroundLayer = new Container();
    this.foregroundLayer.zIndex = 80;
    this.world.addChild(this.foregroundLayer);

    // Reception has no monster
    this.monster = null;

    this.input = new Input();
    this.hud = new HUD(this.app.stage);

    // Create room-specific props for reception
    this.createDoors();
    this.createDecorativeProps();
    this.createForegroundProps();
    this.createLadderAndUpperFloor();
    this.createHidingSpots();
    this.createVents();
    this.createJumpers();
    this.createRadioWorldSprites();

    // Lock gameplay until audio loaded and user clicks
    this.locked = true;
    this.app.ticker.add(this.tick, this);

    // First launch: load audio, show click-to-start, request mic
    if (!audioInitialized) {
      await this.initAudio();
      audioInitialized = true;
    } else if (micAnalyser.state !== "active" && micAnalyser.state !== "idle" && micAnalyser.state !== "requesting") {
      // Mic was initialized externally (main.ts pre-load). Show status if not active.
      this.hud.showMessage(micAnalyser.lastErrorMessage, 4000);
    }

    // Guidance arrow (above player head, points toward next objective)
    const playerIdleMeta = getFrameMeta(this.manifest, "player", "idle1");
    this.guidanceArrow = new GuidanceArrow(playerIdleMeta.height);
    this.world.addChild(this.guidanceArrow.container);

    // Flashlight darkness overlay
    this.flashlight = new Flashlight(
      this.app.stage,
      this.app.screen.width,
      this.app.screen.height,
    );
    // Position flashlight immediately so first frame isn't misaligned
    {
      const screenX = this.player.x + this.world.x;
      const screenY = this.player.y + this.world.y;
      this.flashlight.update(screenX, screenY);
    }

    // Vignette overlay (above flashlight zIndex=100, below HUD zIndex=5000)
    this.vignette = new Vignette(this.app.screen.width, this.app.screen.height);
    this.vignette.container.zIndex = 150;
    this.app.stage.addChild(this.vignette.container);

    // Start heartbeat (share Howler's AudioContext to avoid browser cap)
    this.heartbeat.start(Howler.ctx);

    // Tab visibility: pause/resume audio
    this.visibilityHandler = () => {
      if (document.hidden) {
        audioManager.suspend();
      } else {
        audioManager.resume();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    // Start ambient music for reception
    audioManager.crossfadeAmbient("reception_ambient");

    // Intro sequence (once per page load)
    if (!introPlayed) {
      this.runIntroSequence();
      return; // endIntroSequence() will unlock and continue setup
    }

    this.locked = false;

    // Record run start time
    this.state.runStats.startTimeMs = performance.now();

    this.maybeShowReceptionTutorial();
    this.maybePlayTutorialT0();
  }

  // ── Audio initialization (first launch only) ──

  private async initAudio(): Promise<void> {
    // Loading overlay
    const loadingContainer = new Container();
    loadingContainer.zIndex = 9500;
    this.app.stage.sortableChildren = true;

    const loadingBg = new Graphics();
    loadingBg.rect(0, 0, this.app.screen.width, this.app.screen.height);
    loadingBg.fill({ color: 0x0a0a0a });
    loadingContainer.addChild(loadingBg);

    const loadingText = new Text({
      text: "LOADING... 0%",
      style: { fontFamily: "monospace", fontSize: 24, fill: 0xffffff },
    });
    loadingText.anchor.set(0.5);
    loadingText.x = this.app.screen.width / 2;
    loadingText.y = this.app.screen.height / 2;
    loadingContainer.addChild(loadingText);

    this.app.stage.addChild(loadingContainer);

    await audioManager.loadAll((loaded, total) => {
      const pct = Math.floor((loaded / total) * 100);
      loadingText.text = `LOADING... ${pct}%`;
    });

    this.app.stage.removeChild(loadingContainer);
    loadingContainer.destroy({ children: true });

    // Click-to-start overlay (satisfies browser autoplay policy)
    await this.waitForClick();

    // Request microphone
    await micAnalyser.start();
    if (micAnalyser.state !== "active") {
      this.hud.showMessage(micAnalyser.lastErrorMessage, 4000);
    }
  }

  private waitForClick(): Promise<void> {
    return new Promise((resolve) => {
      const container = new Container();
      container.zIndex = 9500;

      const bg = new Graphics();
      bg.rect(0, 0, this.app.screen.width, this.app.screen.height);
      bg.fill({ color: 0x0a0a0a, alpha: 0.92 });
      container.addChild(bg);

      const title = new Text({
        text: "CLICK TO START",
        style: { fontFamily: "monospace", fontSize: 36, fill: 0xffffff },
      });
      title.anchor.set(0.5);
      title.x = this.app.screen.width / 2;
      title.y = this.app.screen.height / 2;
      container.addChild(title);

      const sub = new Text({
        text: "Microphone access required for full experience",
        style: { fontFamily: "monospace", fontSize: 16, fill: 0x888888 },
      });
      sub.anchor.set(0.5);
      sub.x = this.app.screen.width / 2;
      sub.y = this.app.screen.height / 2 + 50;
      container.addChild(sub);

      this.app.stage.addChild(container);

      const handler = async () => {
        this.app.canvas.removeEventListener("pointerdown", handler);
        // Resume AudioContext (browser autoplay policy)
        if (Howler.ctx?.state === "suspended") {
          await Howler.ctx.resume();
        }
        this.app.stage.removeChild(container);
        container.destroy({ children: true });
        resolve();
      };
      this.app.canvas.addEventListener("pointerdown", handler);
    });
  }

  // ── Main loop ──

  private tick(ticker: Ticker): void {
    const dt = ticker.deltaTime;
    const dtMS = ticker.deltaMS;

    switch (this.state.phase) {
      case "INTRO":
        this.handleIntroTick(dtMS);
        break;

      case "PLAYING":
        this.handlePlayingTick(dt, dtMS);
        break;

      case "PAUSED":
        // Ticker should be stopped during PAUSED, but guard anyway
        break;

      case "DYING":
        // Death cinematic runs via runDeathCinematic(); tick just advances animation
        break;

      case "GAMEOVER":
      case "WIN":
        if (!this.locked && this.input.justPressed("KeyR")) {
          this.restart();
        }
        break;
    }

    this.hud.update(dtMS);
    this.input.endFrame();
  }

  /** Returns the player's effective floor Y (upper floor override or room ground). */
  private currentFloorY(): number {
    return this.playerFloorYOverride ?? this.rooms.currentRoom.floorY;
  }

  private static readonly CLIMB_SPEED = 2.0; // px per frame

  private handlePlayingTick(dt: number, dtMS: number): void {
    if (this.locked) return;

    // Ladder climbing state overrides normal player movement
    if (this.playerClimbingLadder) {
      this.handleClimbing(dt);
    } else {
      this.player.update(dt, this.input);
      // Clamp player to upper floor X bounds if on upper floor
      if (this.playerFloorYOverride !== null) {
        const def = this.rooms.currentDef;
        if (def.upperFloorXMin !== undefined && def.upperFloorXMax !== undefined) {
          this.player.x = Math.max(def.upperFloorXMin, Math.min(def.upperFloorXMax, this.player.x));
        }
        // Check if player walks onto a ladder from the upper floor
        this.checkLadderEntryFromUpper();
      } else {
        // Check if player walks onto a ladder from ground floor (press Up/W)
        this.checkLadderEntryFromGround();
      }
    }
    this.monster?.update(dt, dtMS);

    // Guidance arrow
    this.updateGuidanceArrow(dtMS);

    // Update Jumpers
    const playerCrouched = this.player.isCrouching();
    const playerOnUpper = this.playerFloorYOverride !== null;
    for (const jumper of this.jumpers) {
      jumper.update(dtMS, this.player.x, this.player.y, playerCrouched, playerOnUpper);
      if (jumper.isPlayerCaught(this.player.x, this.player.y)) {
        this.triggerDeath();
      }
    }

    // Update Whisperer
    this.updateWhisperer(dtMS);

    // Apply suspicion decay with crouch/hiding multiplier
    if (this.monster) {
      let decayMult = 1;
      if (this.player.isCrouching()) decayMult = 3;
      if (this.state.hidingState.active && this.state.hidingState.kind === "desk") decayMult = 4;
      if (this.state.hidingState.active && this.state.hidingState.kind === "locker") decayMult = 999;
      this.monster.applyDecay(dtMS, decayMult);
    }

    // Voice-driven beacon and suspicion
    const rms = micAnalyser.state === "active" ? micAnalyser.sample() : 0;
    const band = classifyVoiceBand(rms, {
      whisper: RMS_THRESHOLD_WHISPER,
      normal: RMS_THRESHOLD_NORMAL,
      shout: RMS_THRESHOLD_SHOUT,
    });
    const drainMult = this.rooms.currentDef.beaconDrainMultiplier ?? 1.0;
    updateBeacon(this.beaconState, band, dtMS, drainMult);

    if (this.monster && micAnalyser.state === "active") {
      const delta = suspicionDeltaForFrame(rms, dtMS);
      let mult = suspicionMultiplierForBand(band);
      // Smoke bomb dampening: 30% rate while player is inside smoke
      if (this.smokeBombEffects.some((sb) => sb.containsPlayer(this.player.x, this.player.y))) {
        mult *= 0.3;
      }
      this.monster.addSuspicion(delta * mult);
    }

    // Dark agitation: passive suspicion bleed and monster screams at Beacon=0
    if (this.beaconState.value <= 0) {
      if (this.monster) {
        this.monster.addSuspicion(5 * (dtMS / 1000));
      }
      if (this.darkScreamInterval === 0) {
        this.darkScreamInterval = 2000 + Math.random() * 2000;
      }
      this.darkScreamTimer += dtMS;
      if (this.darkScreamTimer >= this.darkScreamInterval) {
        this.playDarkScream();
        this.darkScreamTimer = 0;
        this.darkScreamInterval = 2000 + Math.random() * 2000;
      }
    } else {
      this.darkScreamTimer = 0;
      this.darkScreamInterval = 0;
    }

    // Inventory slot selection (1/2/3 keys)
    const slotPick = this.input.justSelectedSlot();
    if (slotPick !== -1) this.state.selectedSlot = slotPick;

    // Radio: arm (R key) and throw (G key)
    if (this.input.justArmedRadio()) {
      this.armCarriedRadio();
    }
    if (this.input.justThrew()) {
      const hasArmedRadio = this.state.radio.armedRadios.some(
        (r) => !r.thrown && r.roomId === this.state.currentRoom,
      );
      if (hasArmedRadio) {
        this.throwCarriedArmedRadio();
      } else {
        this.throwSelectedItem();
      }
    }
    this.updateArmedRadios(dtMS);
    this.syncArmedRadioSprites();

    // Update crafted-item projectiles and effects
    this.updateProjectiles(dtMS);
    this.updateFlareEffects(dtMS);
    this.updateSmokeBombEffects(dtMS);
    this.updateDecoyEffects(dtMS);

    // Hiding prompts and movement-exit (also shows radio pickup prompts)
    this.updateHidingPrompts();

    this.handleInteraction();
    this.handleFootsteps(dtMS);
    this.checkCaught();
    this.updateCamera();

    // Screen shake offset applied after camera
    this.screenShake.update(dtMS);
    this.world.x += this.screenShake.offsetX;
    this.world.y += this.screenShake.offsetY;

    // Update shade visual position (follows world camera)
    if (this.shadeVisual) {
      this.shadeVisual.update(dtMS, this.world.x, this.world.y);
    }

    // Heartbeat scales with suspicion
    this.heartbeat.setSuspicion(this.monster?.suspicion ?? 0);
    this.heartbeat.tick();

    // Vignette scales with monster state
    if (this.vignette) {
      this.vignette.setIntensity(
        this.monster?.state ?? null,
        this.monster?.suspicion ?? 0,
      );
      this.vignette.update(dtMS);
    }

    // Flicker animations for decorative lights
    for (const ft of this.flickerTimers) {
      ft.timer += dtMS;
      if (ft.timer >= ft.nextAt) {
        ft.sprite.alpha = 0.4 + Math.random() * 0.6;
        ft.timer = 0;
        ft.nextAt = 200 + Math.random() * 600;
      }
    }

    // Flashlight follows player screen position, radius and brightness driven by beacon
    if (this.flashlight) {
      this.flashlight.setBeaconVisuals(this.beaconState.visionRadius, this.beaconState.visionBrightness);
      const screenX = this.player.x + this.world.x;
      const screenY = this.player.y + this.world.y;
      this.flashlight.update(screenX, screenY);
    }

    // Beacon meter
    this.hud.updateBeaconMeter(this.beaconState.value, this.beaconState.maxBeacon);

    // Tutorial triggers
    // T1: queue on first movement input in reception
    if (!this.state.tutorialPlayed.t1 && this.state.currentRoom === "reception" &&
        (this.input.isLeft() || this.input.isRight())) {
      this.maybeQueueTutorialT1();
    }
    // T2 early trigger: beacon drops below 70
    if (this.state.tutorialPlayed.t1 && !this.state.tutorialPlayed.t2 &&
        this.beaconState.value < 70) {
      this.playTutorialT2();
    }
    // T3 early trigger: player near workbench (within 150px)
    if (this.state.tutorialPlayed.t2 && !this.state.tutorialPlayed.t3 &&
        this.state.currentRoom === "reception") {
      const wb = ROOM_DEFINITIONS.reception.workbench;
      if (wb && Math.abs(this.player.x - wb.x) < 150) {
        this.playTutorialT3();
      }
    }

    // Minimap
    this.hud.updateMinimap(this.state.currentRoom, this.state.hasMapFragment, this.getObjectiveRooms());

    // Inventory slots HUD
    this.hud.updateInventorySlots(this.state.inventorySlots, this.state.selectedSlot);
    const activeArmed = this.state.radio.armedRadios.find(
      (r) => r.roomId === this.state.currentRoom && r.remainingMs > 0,
    );
    if (activeArmed) {
      this.hud.showRadioTimer(activeArmed.remainingMs, activeArmed.thrown);
    } else {
      this.hud.clearRadioTimer();
    }
  }

  // ── Dark agitation SFX (Beacon=0) ──

  private playDarkScream(): void {
    const ids = Game.DARK_SCREAM_IDS;
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (audioManager.has(id)) {
      audioManager.playOneShot(id);
    }
  }

  // ── Guidance arrow ──

  private getArrowTarget(): { roomId: RoomId; itemX: number } | null {
    if (this.state.hasMapFragment) return null;
    if (!this.state.inventory.has("keycard")) {
      return { roomId: "cubicles", itemX: 1600 };
    }
    if (!this.state.breakerOn) {
      return { roomId: "server", itemX: 2600 };
    }
    return { roomId: "archives", itemX: 2000 };
  }

  private getDoorXTowardRoom(currentRoom: RoomId, targetRoom: RoomId): number | null {
    if (currentRoom === targetRoom) return null;

    const def = this.rooms.currentDef;
    for (const door of def.doors ?? []) {
      if (door.toRoom === targetRoom) {
        return door.fromX;
      }
    }

    // Indirect: route through reception (the hub)
    if (currentRoom !== "reception") {
      for (const door of def.doors ?? []) {
        if (door.toRoom === "reception") {
          return door.fromX;
        }
      }
    }

    return null;
  }

  private computeArrowTargetX(): number | null {
    const target = this.getArrowTarget();
    if (!target) return null;

    if (target.roomId === this.state.currentRoom) {
      return target.itemX;
    }
    return this.getDoorXTowardRoom(this.state.currentRoom, target.roomId);
  }

  private getObjectiveRooms(): Set<RoomId> {
    const rooms = new Set<RoomId>();
    if (!this.state.hasMapFragment) return rooms;
    // Once map is acquired, highlight remaining objectives + exit
    if (!this.state.inventory.has("keycard")) rooms.add("cubicles");
    if (!this.state.breakerOn) rooms.add("server");
    rooms.add("stairwell");
    return rooms;
  }

  private updateGuidanceArrow(dtMs: number): void {
    if (!this.guidanceArrow) return;

    if (this.state.phase !== "PLAYING") {
      this.guidanceArrow.hide();
      this.guidanceArrow.update(this.player.x, this.player.y, dtMs);
      return;
    }

    if (this.state.hidingState.active) {
      this.guidanceArrow.hide();
      this.guidanceArrow.update(this.player.x, this.player.y, dtMs);
      return;
    }

    const targetX = this.computeArrowTargetX();
    if (targetX === null) {
      this.guidanceArrow.hide();
    } else {
      this.guidanceArrow.show();
      this.guidanceArrow.setDirection(targetX > this.player.x ? "right" : "left");
    }

    this.guidanceArrow.update(this.player.x, this.player.y, dtMs);
  }

  // ── Footstep SFX ──

  private handleFootsteps(dtMS: number): void {
    const state = this.player.movementState;
    if (state === "WALK" || state === "RUN") {
      const interval =
        state === "RUN" ? Game.FOOTSTEP_RUN_MS : Game.FOOTSTEP_WALK_MS;
      this.footstepTimer += dtMS;
      if (this.footstepTimer >= interval) {
        this.footstepTimer -= interval;
        audioManager.playOneShot(
          state === "RUN" ? "footstep_concrete_run" : "footstep_concrete",
        );
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  // ── Monster state -> vocals ──

  private handleMonsterStateChange(newState: MonsterState): void {
    audioManager.stopAllMonsterVocals();
    switch (newState) {
      case "PATROL":
        audioManager.loop("monster_patrol_breath");
        break;
      case "ALERT":
        audioManager.playOneShot("monster_alert_growl");
        break;
      case "HUNT":
        audioManager.loop("monster_hunt_screech");
        this.screenShake.trigger(600, 12);
        this.state.runStats.monsterEncounters++;
        break;
      case "CHARGE":
        audioManager.playOneShot("monster_charge_roar");
        this.screenShake.trigger(400, 8);
        break;
      case "ATTACK":
        audioManager.playOneShot("monster_attack_lunge");
        this.screenShake.trigger(300, 16);
        break;
      case "IDLE_HOWL":
        audioManager.playOneShot("monster_idle_howl");
        break;
    }
  }

  // ── Interaction (E key) ──

  private handleInteraction(): void {
    if (!this.input.justInteracted()) return;
    if (this.state.hidingState.transitioning) return;

    // Exit hide (E while hiding)
    if (this.state.hidingState.active) {
      this.tryExitHide();
      return;
    }

    // Enter hide (E near a hiding spot)
    const nearestSpot = this.getNearestHidingSpot();
    if (nearestSpot) {
      this.enterHide(nearestSpot);
      return;
    }

    // Radio pickup (before regular pickups)
    const nearbyRadio = this.getNearbyRadioPickup();
    if (nearbyRadio) {
      this.pickUpRadio(nearbyRadio);
      return;
    }

    // Pickups win over doors when both are nearby
    for (const pickup of this.pickups) {
      if (!pickup.isInteractable()) continue;
      if (!pickup.isInRange(this.player.x)) continue;

      if (pickup.config.togglesTo) {
        // Toggle pickup (breaker switch)
        pickup.setToggled();
        if (pickup.config.id === "breaker_switch") {
          this.state.breakerOn = true;
          this.hud.showMessage("Power restored.");
          audioManager.playOneShot("breaker_switch");
        }
      } else {
        // Collect pickup
        const pickupId = pickup.config.id;

        // Lore tapes: play audio + subtitle, do not add to inventory
        if (isLoreTapeId(pickupId)) {
          pickup.collect();
          this.state.tapesCollected.add(pickupId);
          this.playLoreTape(pickupId);
          return;
        }

        const isMaterial =
          pickupId === "wire" ||
          pickupId === "glass_shards" ||
          pickupId === "battery" ||
          pickupId === "tape";

        if (isMaterial) {
          // Route materials to inventory slots
          const emptySlot = this.state.inventorySlots.indexOf(null);
          if (emptySlot === -1) {
            this.hud.showMessage("Inventory full.", 2000);
            return;
          }
          pickup.collect();
          this.state.inventory.add(pickupId); // track for respawn
          this.state.inventorySlots[emptySlot] = {
            kind: "material",
            id: pickupId as MaterialId,
          };
          const name = pickupId.replace(/_/g, " ");
          this.hud.showMessage(`Picked up ${name}.`);
          audioManager.playOneShot("keycard_pickup");
        } else {
          // Quest items (keycard, map_fragment)
          pickup.collect();
          this.state.inventory.add(pickupId);
          if (pickupId === "keycard") {
            this.hud.showMessage("Picked up keycard.");
            audioManager.playOneShot("keycard_pickup");
          } else if (pickupId === "map_fragment") {
            this.state.hasMapFragment = true;
            this.hud.showMessage("Picked up map fragment.");
            audioManager.playOneShot("keycard_pickup");
            // Phase 9D Issue 1: TTS narration on map_fragment pickup.
            // Reuses Phase 7 lore tape pattern (playOneShot + subtitle).
            this.playMapFragmentNarration();
          } else {
            const name = pickupId.replace(/_/g, " ");
            this.hud.showMessage(`Picked up ${name}.`);
            audioManager.playOneShot("keycard_pickup");
          }
        }
      }
      return; // E press consumed
    }

    // Check workbench
    if (this.isNearWorkbench()) {
      this.openWorkbench();
      return;
    }

    // Shade recovery
    if (this.shadeVisual && this.state.activeShade &&
        this.shadeVisual.isPlayerInRange(this.player.x, this.player.y)) {
      this.recoverShade();
      return;
    }

    // Vents and doors are ground-floor only
    if (this.playerFloorYOverride !== null) return;

    const vent = this.rooms.getNearbyVent(this.player.x);
    if (vent) {
      audioManager.playOneShot("door_open_creak");
      this.transitionToRoom(vent.target, vent.targetX);
      return;
    }

    // Check doors
    const door = this.rooms.getNearbyDoor(this.player.x);
    if (!door) return;

    // Verify requirement
    let canPass = false;
    switch (door.requirement) {
      case "none":
      case "press_e":
        canPass = true;
        break;
      case "keycard":
        canPass = this.state.inventory.has("keycard");
        break;
      case "breaker_on":
        canPass = this.state.breakerOn;
        break;
    }

    if (!canPass) {
      if (door.failMessage) {
        this.hud.showMessage(door.failMessage);
      }
      audioManager.playOneShot("door_locked_rattle");
      return;
    }

    // Win condition: exit door in stairwell with keycard
    if (door.isExit) {
      this.triggerWin();
      return;
    }

    audioManager.playOneShot("door_open_creak");
    this.transitionToRoom(door.toRoom, door.toX);
  }

  // ── Catch detection ──

  private checkCaught(): void {
    if (!this.monster) return;

    // Reset desk charge roll when monster is not in CHARGE
    if (this.monster.state !== "CHARGE") {
      this.deskChargeRolled = false;
      this.deskChargeFound = false;
    }

    const hiding = this.state.hidingState;

    // Locker: fully hidden, monster cannot detect player
    if (hiding.active && hiding.kind === "locker") return;

    // Desk: hidden from PATROL/ALERT/HUNT. CHARGE has 50/50 roll.
    if (hiding.active && hiding.kind === "desk") {
      if (this.monster.state !== "CHARGE") return;

      const spot = this.hidingSpots.find((s) => s.id === hiding.spotId);
      if (!spot) return;

      const dx = Math.abs(this.monster.x - spot.x);
      if (dx < 50 && !this.deskChargeRolled) {
        this.deskChargeRolled = true;
        this.deskChargeFound = Math.random() < 0.5;
      }

      if (this.deskChargeFound) {
        this.triggerDeath();
      }
      return;
    }

    // Normal catch
    if (!this.monster.isPlayerCaught()) return;
    this.triggerDeath();
  }

  // ── Reception tutorial ──

  private maybeShowReceptionTutorial(): void {
    if (this.state.currentRoom !== "reception") return;
    if (this.state.hasShownReceptionTutorial) return;
    if (this.state.phase !== "PLAYING") return;
    this.state.hasShownReceptionTutorial = true;

    this.hud.showMessage("Walk with A/D or arrow keys.", 4000);
    this.tutorialTimers.push(
      setTimeout(() => {
        if (this.state.phase !== "PLAYING") return;
        this.hud.showMessage("Press E or Up to interact.", 4000);
      }, 4500),
    );
  }

  private clearTutorialTimers(): void {
    this.tutorialTimers.forEach(clearTimeout);
    this.tutorialTimers = [];
  }

  // ── Voice tutorial (T0/T1/T2/T3) ──

  private shouldSkipVoiceTutorial(): boolean {
    // Skip if localStorage flag set (returning player)
    try {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY) === "true") return true;
    } catch { /* localStorage unavailable */ }
    // Skip if player already collected a lore tape this run
    if (this.state.tapesCollected.size > 0) return true;
    return false;
  }

  /** Called from start() to play the opening transmission. */
  private maybePlayTutorialT0(): void {
    if (this.state.tutorialPlayed.t0) return;
    if (this.shouldSkipVoiceTutorial()) return;

    this.tutorialT0Queued = true;
    this.tutorialTimers.push(
      setTimeout(() => this.playTutorialT0(), 1500),
    );
  }

  private playTutorialT0(): void {
    if (this.state.tutorialPlayed.t0) return;
    if (this.state.phase !== "PLAYING") return;
    this.state.tutorialPlayed.t0 = true;

    audioManager.playOneShot("tutorial_t0");
    const dur = audioManager.getDuration("tutorial_t0") || 6000;
    this.hud.showSubtitle(TUTORIAL_TRANSCRIPTS.tutorial_t0, dur);

    // Chain T1 after T0 finishes + 2 seconds
    this.tutorialTimers.push(
      setTimeout(() => this.playTutorialT1(), dur + 2000),
    );
  }

  /** Called from handlePlayingTick on first movement input in reception. */
  private maybeQueueTutorialT1(): void {
    if (this.tutorialT1Queued) return;
    if (this.state.tutorialPlayed.t1) return;
    if (this.tutorialT0Queued) return; // T0 chain will schedule T1
    if (this.shouldSkipVoiceTutorial()) return;
    if (this.state.currentRoom !== "reception") return;

    this.tutorialT1Queued = true;
    this.tutorialTimers.push(
      setTimeout(() => this.playTutorialT1(), 2000),
    );
  }

  private playTutorialT1(): void {
    if (this.state.tutorialPlayed.t1) return;
    if (this.state.phase !== "PLAYING") return;
    this.state.tutorialPlayed.t1 = true;

    audioManager.playOneShot("tutorial_t1");
    const dur = audioManager.getDuration("tutorial_t1") || 8000;
    this.hud.showSubtitle(TUTORIAL_TRANSCRIPTS.tutorial_t1, dur);

    // Schedule T2 after T1 finishes + 10 seconds
    this.tutorialTimers.push(
      setTimeout(() => this.playTutorialT2(), dur + 10000),
    );
  }

  private playTutorialT2(): void {
    if (this.state.tutorialPlayed.t2) return;
    if (this.state.phase !== "PLAYING") return;
    this.state.tutorialPlayed.t2 = true;

    audioManager.playOneShot("tutorial_t2");
    const dur = audioManager.getDuration("tutorial_t2") || 8000;
    this.hud.showSubtitle(TUTORIAL_TRANSCRIPTS.tutorial_t2, dur);

    // Schedule T3 after T2 finishes + 10 seconds
    this.tutorialTimers.push(
      setTimeout(() => this.playTutorialT3(), dur + 10000),
    );
  }

  private playTutorialT3(): void {
    if (this.state.tutorialPlayed.t3) return;
    if (this.state.phase !== "PLAYING") return;
    this.state.tutorialPlayed.t3 = true;

    audioManager.playOneShot("tutorial_t3");
    const dur = audioManager.getDuration("tutorial_t3") || 8000;
    this.hud.showSubtitle(TUTORIAL_TRANSCRIPTS.tutorial_t3, dur);

    // Mark tutorials as seen in localStorage
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
    } catch { /* localStorage unavailable */ }
  }

  // ── Lore tape playback ──

  private playLoreTape(tapeId: LoreTapeId): void {
    this.stopAllNarrations();
    audioManager.playOneShot(tapeId);
    const durationMs = audioManager.getDuration(tapeId) || 8000;
    const transcript = LORE_TAPE_TRANSCRIPTS[tapeId];
    this.hud.showSubtitle(transcript, durationMs);
  }

  private playMapFragmentNarration(): void {
    // Map fragment narration takes priority over any in-progress narration.
    this.stopAllNarrations();

    if (!audioManager.has("tape_map_fragment")) {
      // Audio asset not available (generation failed or not loaded).
      // Degrade to subtitle-only so the pickup is not blocked.
      this.hud.showSubtitle(MAP_FRAGMENT_TRANSCRIPT, 8000);
      return;
    }

    audioManager.playOneShot("tape_map_fragment");
    const durationMs = audioManager.getDuration("tape_map_fragment") || 8000;
    // +500ms tail so the text lingers slightly past the audio end.
    this.hud.showSubtitle(MAP_FRAGMENT_TRANSCRIPT, durationMs + 500);
  }

  /** Stop all lore tape and map-fragment narration audio, clear subtitle. */
  private stopAllNarrations(): void {
    const ids: AudioId[] = [
      "tape_01", "tape_02", "tape_03", "tape_04", "tape_05", "tape_06",
      "tape_map_fragment",
      "intro_panel_1", "intro_panel_2", "intro_panel_3",
    ];
    for (const id of ids) {
      audioManager.stop(id);
    }
    this.hud.hideSubtitle();
  }

  // ── Room transitions ──

  private async transitionToRoom(
    toRoom: RoomId,
    spawnX: number,
  ): Promise<void> {
    this.locked = true;

    await fadeTransition(this.app.stage, this.app.ticker, () => {
      // At peak black: swap room contents
      this.destroyRoomContents();

      this.rooms.swapRoom(toRoom);
      this.state.currentRoom = toRoom;
      this.state.runStats.roomsReached.add(toRoom);

      // Adjust world.y for rooms with different heights
      this.world.y =
        this.app.screen.height - this.rooms.currentRoom.roomHeight;

      // Reposition player
      this.player.x = spawnX;
      this.player.y = this.rooms.currentRoom.floorY;
      this.player.setRoomWidth(this.rooms.currentRoom.roomWidth);

      // Snap camera and flashlight to new player position during fade
      this.updateCamera();
      if (this.flashlight) {
        const screenX = this.player.x + this.world.x;
        const screenY = this.player.y + this.world.y;
        this.flashlight.update(screenX, screenY);
      }

      // Populate new room
      this.createPickups();
      this.createMonster();
      this.createDoors();
      this.createDecorativeProps();
      this.createForegroundProps();
      this.createLadderAndUpperFloor();
      this.createHidingSpots();
      this.createVents();
      this.createJumpers();
      this.createRadioWorldSprites();
      this.maybeCreateShadeVisual();

      // Reset upper floor state on room change
      this.playerFloorYOverride = null;
      this.playerClimbingLadder = null;

      // Crossfade ambient to new room
      const ambientId = `${toRoom}_ambient` as AmbientId;
      audioManager.crossfadeAmbient(ambientId);
    });

    this.locked = false;

    // Show tutorial if returning to reception (only fires once per play session)
    this.maybeShowReceptionTutorial();
  }

  private destroyRoomContents(): void {
    this.pickups.forEach((p) => p.destroy());
    this.pickups = [];

    this.hidingSpots.forEach((h) => h.destroy());
    this.hidingSpots = [];

    this.decorativeSprites.forEach((s) => {
      s.parent?.removeChild(s);
      s.destroy();
    });
    this.decorativeSprites = [];
    this.flickerTimers = [];

    // Foreground layer children (cubicle dividers, etc.)
    this.foregroundLayer.removeChildren();

    // Upper floor sprites (ladder, upper bg)
    this.ladderSprites.forEach((s) => {
      s.parent?.removeChild(s);
      s.destroy();
    });
    this.ladderSprites = [];
    if (this.upperBgSprite) {
      this.upperBgSprite.parent?.removeChild(this.upperBgSprite);
      this.upperBgSprite.destroy();
      this.upperBgSprite = null;
    }
    if (this.upperCatwalkSprite) {
      this.upperCatwalkSprite.parent?.removeChild(this.upperCatwalkSprite);
      this.upperCatwalkSprite.destroy();
      this.upperCatwalkSprite = null;
    }

    this.ventSprites.forEach((s) => {
      s.parent?.removeChild(s);
      s.destroy();
    });
    this.ventSprites = [];

    this.doorSprites.forEach((s) => {
      s.parent?.removeChild(s);
      s.destroy();
    });
    this.doorSprites = [];

    this.jumpers.forEach((j) => j.destroy());
    this.jumpers = [];
    this.jumperDripSprites.forEach((s) => {
      s.parent?.removeChild(s);
      s.destroy();
    });
    this.jumperDripSprites = [];

    if (this.whisperer) {
      this.whisperer.destroy();
      this.whisperer = null;
    }
    this.whispererSpawnCheckTimer = 0;

    if (this.monster) {
      this.world.removeChild(this.monster);
      this.monster.destroy();
      this.monster = null;
    }
    audioManager.stopAllMonsterVocals();

    // Reset hiding state
    this.state.hidingState = { active: false, spotId: null, kind: null, transitioning: false };
    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    if (this.flashlight) this.flashlight.setHidingMode("none");
    this.hud.clearPrompt();
    this.hud.setHiddenVisible(false);

    // Clean up radio sprites (armed, dropped, spent) for old room
    this.destroyRadioSprites();

    // Clean up crafting projectiles and effects
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles = [];
    this.flareEffects.forEach((f) => f.destroy());
    this.flareEffects = [];
    this.smokeBombEffects.forEach((s) => s.destroy());
    this.smokeBombEffects = [];
    this.decoyEffects.forEach((d) => d.destroy());
    this.decoyEffects = [];

    // Clean up shade visual (data persists on gameState)
    if (this.shadeVisual) {
      this.shadeVisual.destroy();
      this.shadeVisual = null;
    }
  }

  private createPickups(): void {
    const def = this.rooms.currentDef;
    for (const pc of def.pickups) {
      // Skip collected non-toggle pickups
      if (!pc.togglesTo && this.state.inventory.has(pc.id)) continue;
      // Skip collected lore tapes (persist across deaths)
      if (isLoreTapeId(pc.id) && this.state.tapesCollected.has(pc.id)) continue;

      const pickup = new Pickup(
        this.world,
        pc,
        this.rooms.currentRoom.floorY,
      );

      // Apply existing toggle state (breaker already flipped)
      if (pc.id === "breaker_switch" && this.state.breakerOn) {
        pickup.setToggled();
      }

      this.pickups.push(pickup);
    }
  }

  private createMonster(): void {
    const def = this.rooms.currentDef;
    if (!def.hasMonster) {
      this.monster = null;
      return;
    }

    this.monster = new Monster(
      this.manifest,
      def.monsterPatrolPath,
      def.monsterSpawn,
      this.player,
      this.rooms.currentRoom.roomWidth,
    );
    this.monster.y = this.rooms.currentRoom.floorY;
    this.world.addChild(this.monster);

    // Wire vocal coupling (audio stays in Game, Monster stays pure)
    this.monster.onStateChange = (state) => this.handleMonsterStateChange(state);
    this.monster.onDashStart = () => {
      audioManager.playOneShot("monster_dash_screech");
      this.screenShake.trigger(300, 10);
    };
    // Start patrol breath for initial PATROL state
    audioManager.loop("monster_patrol_breath");

    // Load confused animation frames from manifest
    this.monster.loadConfusedFrames();
  }

  // ── Death flow ──

  private triggerDeath(): void {
    if (this.state.phase !== "PLAYING") return;

    this.state.phase = "DYING";
    this.locked = true;

    // Capture inventory for shade before any cleanup
    this.deathSnapshot = {
      slots: this.state.inventorySlots.map(s => s ? { ...s } : null),
      x: this.player.x,
      y: this.player.y,
      room: this.state.currentRoom,
    };

    // Clear hiding state if dying while hidden (desk 50/50 caught)
    if (this.state.hidingState.active) {
      const spot = this.hidingSpots.find(
        (s) => s.id === this.state.hidingState.spotId,
      );
      if (spot) {
        spot.isOccupied = false;
        spot.sprite.visible = true;
      }
      this.state.hidingState = { active: false, spotId: null, kind: null, transitioning: false };
      if (this.flashlight) this.flashlight.setHidingMode("none");
      this.hud.setHiddenVisible(false);
      this.hud.clearPrompt();
    }

    this.clearTutorialTimers();
    this.stopAllNarrations();
    if (this.whisperer) {
      this.whisperer.destroy();
      this.whisperer = null;
    }
    this.player.startCaughtSequence();
    audioManager.stopAllMonsterVocals();
    audioManager.stopAllBlobs();
    audioManager.playOneShot("death_thud");
    this.screenShake.trigger(800, 20);

    // Cancel any pending TTS calls
    for (const [, ctrl] of this.armedRadioAborts) {
      ctrl.abort();
    }
    this.armedRadioAborts.clear();
    revokeRadioBlobs(this.state.radio.armedRadios);
    this.state.radio.armedRadios = [];
    this.hud.clearRadioTimer();
    this.hud.showRadioInventory(false);

    // Extended cinematic death sequence
    this.runDeathCinematic();
  }

  private async runDeathCinematic(): Promise<void> {
    // Layer 1: monster looms toward player (400ms)
    if (this.monster) {
      const startMX = this.monster.x;
      const targetMX = this.player.x + 30;
      const startScale = this.monster.spriteScaleX;
      const targetScale = startScale * 1.15;
      await this.animateOverTime(400, (t) => {
        if (!this.monster) return;
        this.monster.x = startMX + (targetMX - startMX) * t;
        this.monster.setSpriteScale(
          startScale + (targetScale - startScale) * t,
        );
      });
    }

    // Layer 2: close growl
    if (audioManager.has("monster_growl_close")) {
      audioManager.playOneShot("monster_growl_close");
    }

    // Layer 3: red-then-black fade (1500ms)
    await this.fadeToRedThenBlack(1500);

    // Stop heartbeat
    this.heartbeat.stop();

    // Layer 4: show gameover overlay with stats for 2.5s or until R pressed
    const stats = this.computeRunStats();
    this.showGameOverWithStats(stats);
    // Dismiss radio popup if it was open during death
    document.getElementById("radio-popup")?.classList.add("radio-popup-hidden");
    await this.waitForDismissOrTimeout(2500);
    this.hideGameOverStats();

    // Respawn at reception
    await this.respawnAtReception();
  }

  private animateOverTime(
    durMs: number,
    onTick: (t: number) => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / durMs);
        onTick(t);
        if (t < 1) {
          const id = requestAnimationFrame(tick);
          this.activeRafIds.add(id);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  private cancelAllRafs(): void {
    for (const id of this.activeRafIds) {
      cancelAnimationFrame(id);
    }
    this.activeRafIds.clear();
  }

  /** Wait until either timeout or R key is pressed. */
  private waitForDismissOrTimeout(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener("keydown", onKey);
        resolve();
      }, timeoutMs);
      const onKey = (e: KeyboardEvent) => {
        if (e.code === "KeyR" && !resolved) {
          resolved = true;
          clearTimeout(timer);
          window.removeEventListener("keydown", onKey);
          resolve();
        }
      };
      window.addEventListener("keydown", onKey);
    });
  }

  private async fadeToRedThenBlack(durMs: number): Promise<void> {
    // Clean up any previous death overlay (safety for rapid deaths)
    if (this.deathFadeOverlay) {
      this.app.stage.removeChild(this.deathFadeOverlay);
      this.deathFadeOverlay.destroy();
      this.deathFadeOverlay = null;
    }

    const overlay = new Graphics();
    overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.fill({ color: 0xaa0000, alpha: 0 });
    overlay.zIndex = 8999;
    this.app.stage.addChild(overlay);
    this.deathFadeOverlay = overlay;

    await this.animateOverTime(durMs, (t) => {
      overlay.clear();
      let alpha: number;
      let color: number;
      if (t < 0.5) {
        alpha = t * 2 * 0.7;
        color = 0xaa0000;
      } else {
        alpha = 0.7 + (t - 0.5) * 2 * 0.3;
        const redChannel = Math.floor((1 - (t - 0.5) * 2) * 0xaa);
        color = redChannel << 16;
      }
      overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
      overlay.fill({ color, alpha });
    });
  }

  private async respawnAtReception(): Promise<void> {
    // MAP FRAGMENT AND MINIMAP PERSIST THROUGH DEATH BY DESIGN (Phase 9D Issue 2, decision A).
    // hasMapFragment stays true, minimap stays visible, visited rooms stay in the Set.
    // Knowledge is permanent. Death costs time and inventory, not information.
    // If the design changes, the fix is: add map_fragment to the death-drop list,
    // set hasMapFragment = false, and call hud.minimap.reset() here.

    // Create shade from death snapshot (overwrites any existing shade)
    const snap = this.deathSnapshot;
    if (snap && snap.slots.some(s => s !== null)) {
      this.state.activeShade = {
        inventorySnapshot: snap.slots,
        position: { x: snap.x, y: snap.y },
        roomId: snap.room,
        spawnTime: performance.now(),
      };
    } else {
      // Empty inventory death: overwrite to nothing
      this.state.activeShade = null;
    }
    this.deathSnapshot = null;

    // Tear down current room
    this.destroyRoomContents();

    // Reset inventory slots (empty); keep quest items in state.inventory
    this.state.inventorySlots = [null, null, null];
    this.state.selectedSlot = 0;

    // Remove materials so they respawn as pickups
    this.state.inventory.delete("wire");
    this.state.inventory.delete("glass_shards");
    this.state.inventory.delete("battery");
    this.state.inventory.delete("tape");

    // Reset radio state (world radios lost; carried radios went into shade)
    revokeRadioBlobs(this.state.radio.armedRadios);
    this.state.radio = {
      carriedRadioId: null,
      armedRadios: [],
      collectedRadioIds: new Set(),
      droppedRadios: [],
      spentRadios: [],
    };

    // Reroll loaded lockers
    this.state.loadedLockers = this.rollLockerJumpers();

    // Reset beacon value but preserve maxBeacon (Whisperer erosion persists)
    this.beaconState.value = this.beaconState.maxBeacon;
    updateBeacon(this.beaconState, "silent", 0);

    // Reset dark agitation timers
    this.darkScreamTimer = 0;
    this.darkScreamInterval = 0;

    // Swap to reception
    this.rooms.swapRoom("reception");
    this.state.currentRoom = "reception";
    this.world.y = this.app.screen.height - this.rooms.currentRoom.roomHeight;

    // Reset player from CAUGHT back to IDLE
    this.player.setStandingPose();
    this.player.x = 1500; // near workbench
    this.player.y = this.rooms.currentRoom.floorY;
    this.player.setRoomWidth(this.rooms.currentRoom.roomWidth);
    this.updateCamera();

    // Populate reception
    this.createPickups();
    this.createMonster();
    this.createDoors();
    this.createDecorativeProps();
    this.createForegroundProps();
    this.createLadderAndUpperFloor();
    this.createHidingSpots();
    this.createVents();
    this.createJumpers();
    this.createRadioWorldSprites();
    this.maybeCreateShadeVisual();

    // Reset upper floor state
    this.playerFloorYOverride = null;
    this.playerClimbingLadder = null;

    // Restore world visibility (buildEndScreen sets it false)
    this.world.visible = true;

    // Flashlight
    if (this.flashlight) {
      this.flashlight.setVisible(true);
      this.flashlight.setHidingMode("none");
      this.flashlight.setBeaconVisuals(
        this.beaconState.visionRadius,
        this.beaconState.visionBrightness,
      );
      const screenX = this.player.x + this.world.x;
      const screenY = this.player.y + this.world.y;
      this.flashlight.update(screenX, screenY);
    }

    // Audio
    audioManager.crossfadeAmbient("reception_ambient");
    this.heartbeat.start(Howler.ctx);

    // Reset run stats for new life
    this.state.runStats.startTimeMs = performance.now();
    this.state.runStats.monsterEncounters = 0;
    this.state.runStats.roomsReached = new Set<RoomId>(["reception"]);

    // Fade out death overlay to reveal reception
    if (this.deathFadeOverlay) {
      await this.animateOverTime(800, (t) => {
        if (this.deathFadeOverlay) {
          this.deathFadeOverlay.clear();
          this.deathFadeOverlay.rect(
            0, 0, this.app.screen.width, this.app.screen.height,
          );
          this.deathFadeOverlay.fill({ color: 0x000000, alpha: 1 - t });
        }
      });
      this.app.stage.removeChild(this.deathFadeOverlay);
      this.deathFadeOverlay.destroy();
      this.deathFadeOverlay = null;
    }

    // Resume gameplay
    this.state.phase = "PLAYING";
    this.locked = false;
    this.hud.showMessage("Your belongings remain where you fell.", 4000);
  }

  private maybeCreateShadeVisual(): void {
    if (this.shadeVisual) {
      this.shadeVisual.destroy();
      this.shadeVisual = null;
    }

    const shade = this.state.activeShade;
    if (!shade || shade.roomId !== this.state.currentRoom) return;

    const frames = [
      Assets.get<Texture>("shade-tape:shade1") || Texture.WHITE,
      Assets.get<Texture>("shade-tape:shade2") || Texture.WHITE,
      Assets.get<Texture>("shade-tape:shade3") || Texture.WHITE,
    ];

    this.shadeVisual = new ShadeVisual(
      this.app.stage,
      shade.position.x,
      shade.position.y,
      frames,
    );
  }

  private recoverShade(): void {
    if (!this.state.activeShade) return;
    this.state.inventorySlots = this.state.activeShade.inventorySnapshot.map(
      s => s ? { ...s } : null,
    );
    this.state.activeShade = null;
    if (this.shadeVisual) {
      this.shadeVisual.destroy();
      this.shadeVisual = null;
    }
    this.hud.showMessage("Inventory recovered.");
    audioManager.playOneShot("keycard_pickup");
  }

  private computeRunStats(): {
    timeSurvivedSec: number;
    roomsReached: number;
    monsterEncounters: number;
  } {
    const elapsedMs = performance.now() - this.state.runStats.startTimeMs;
    return {
      timeSurvivedSec: Math.floor(elapsedMs / 1000),
      roomsReached: this.state.runStats.roomsReached.size,
      monsterEncounters: this.state.runStats.monsterEncounters,
    };
  }

  private showGameOverWithStats(stats: {
    timeSurvivedSec: number;
    roomsReached: number;
    monsterEncounters: number;
  }): void {
    const statTime = document.getElementById("stat-time");
    const statRooms = document.getElementById("stat-rooms");
    const statEnc = document.getElementById("stat-encounters");
    if (statTime) {
      const mins = Math.floor(stats.timeSurvivedSec / 60);
      const secs = stats.timeSurvivedSec % 60;
      statTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
    }
    if (statRooms) statRooms.textContent = `${stats.roomsReached}/5`;
    if (statEnc) statEnc.textContent = String(stats.monsterEncounters);
    document.getElementById("gameover-stats")?.classList.add("visible");
  }

  private hideGameOverStats(): void {
    document.getElementById("gameover-stats")?.classList.remove("visible");
  }

  // ── Win flow ──

  private async triggerWin(): Promise<void> {
    if (this.state.phase !== "PLAYING") return;
    this.state.phase = "WIN";
    this.clearTutorialTimers();
    this.locked = true;

    audioManager.playOneShot("win_chime");
    audioManager.stopAllMonsterVocals();

    await fadeTransition(this.app.stage, this.app.ticker, () => {
      this.buildEndScreen(null, "YOU ESCAPED\n\nPRESS R TO RESTART");
      if (this.flashlight) this.flashlight.setVisible(false);
      audioManager.fadeOutAmbient();
    });

    this.locked = false;
  }

  // ── End screen (shared by gameover and win) ──

  private buildEndScreen(
    bgTextureName: string | null,
    message: string,
  ): void {
    this.world.visible = false;

    this.overlayContainer = new Container();
    this.overlayContainer.zIndex = 9000;
    this.app.stage.sortableChildren = true;

    if (bgTextureName) {
      const bgTexture = Assets.get<Texture>(bgTextureName);
      if (bgTexture) {
        const bg = new Sprite(bgTexture);
        bg.width = this.app.screen.width;
        bg.height = this.app.screen.height;
        this.overlayContainer.addChild(bg);
      }
    } else {
      const bg = new Graphics();
      bg.rect(0, 0, this.app.screen.width, this.app.screen.height);
      bg.fill({ color: 0x0a0a0a });
      this.overlayContainer.addChild(bg);
    }

    const label = new Text({
      text: message,
      style: {
        fontFamily: "monospace",
        fontSize: 32,
        fill: 0xffffff,
        align: "center",
      },
    });
    label.anchor.set(0.5, 0.5);
    label.x = this.app.screen.width / 2;
    label.y = this.app.screen.height / 2;
    this.overlayContainer.addChild(label);

    this.app.stage.addChild(this.overlayContainer);
  }

  // ── Intro panel sequence ──

  private runIntroSequence(): void {
    this.state.phase = "INTRO";
    this.state.introPanelIndex = 0;
    this.introTransitioning = false;
    this.introEscHeldMs = 0;

    this.introContainer = new Container();
    this.introContainer.zIndex = 7000;
    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(this.introContainer);

    this.showIntroPanel(0);
    audioManager.playOneShot("intro_panel_1");

    // Canvas click advances panels
    this.introClickHandler = () => {
      if (!this.introTransitioning && this.state.phase === "INTRO") {
        this.advanceIntroPanel();
      }
    };
    this.app.canvas.addEventListener("pointerdown", this.introClickHandler);
  }

  private showIntroPanel(index: number): void {
    if (!this.introContainer) return;

    // Remove previous children
    while (this.introContainer.children.length > 0) {
      this.introContainer.removeChildAt(0);
    }

    const panelNames = ['panel-1', 'panel-2', 'panel-3'];
    const alias = `intro:${panelNames[index]}`;
    const texture = Assets.get<Texture>(alias);

    if (!texture || texture === Texture.WHITE) {
      console.error(`Missing intro panel texture: ${alias}`);
      // Fallback: solid black panel
      const fallback = new Graphics();
      fallback.rect(0, 0, 1280, 720);
      fallback.fill({ color: 0x000000 });
      this.introContainer.addChild(fallback);
      return;
    }

    const sprite = new Sprite(texture);
    sprite.width = 1280;
    sprite.height = 720;
    sprite.x = 0;
    sprite.y = 0;
    this.introContainer.addChild(sprite);

    this.addIntroIndicator();
    this.addIntroBackButton();

    // Track voiceover timing for indicator animation
    this.introPanelVoiceoverStartMs = performance.now();
    const panelAudioId = `intro_panel_${index + 1}` as AudioId;
    this.introPanelVoiceoverDurationMs = audioManager.getDuration(panelAudioId) || 5000;
  }

  private addIntroIndicator(): void {
    if (!this.introContainer) return;

    const tex = Assets.get<Texture>("ui:click-to-continue");
    if (!tex || tex === Texture.WHITE) {
      console.warn("Missing intro click-to-continue sprite");
      return;
    }

    const cfg = INTRO_INDICATOR_CONFIG[this.state.introPanelIndex];
    this.introIndicator = new Sprite(tex);
    this.introIndicator.height = cfg.height;
    this.introIndicator.scale.x = this.introIndicator.scale.y;
    this.introIndicatorBaseScale = this.introIndicator.scale.y;
    this.introIndicator.anchor.set(0.5, 1);
    this.introIndicator.x = 640;
    this.introIndicator.y = cfg.y;
    this.introIndicator.alpha = 0.4;
    this.introContainer.addChild(this.introIndicator);
    this.introIndicatorPulseTime = 0;
  }

  private addIntroBackButton(): void {
    if (!this.introContainer) return;
    if (this.state.introPanelIndex === 0) return;

    const tex = Assets.get<Texture>("ui:back-button");
    if (!tex || tex === Texture.WHITE) {
      console.warn("Missing intro back-button sprite");
      return;
    }

    this.introBackButton = new Sprite(tex);
    this.introBackButton.height = 56;
    this.introBackButton.scale.x = this.introBackButton.scale.y;
    this.introBackButton.anchor.set(0, 0);
    this.introBackButton.x = 24;
    this.introBackButton.y = 24;
    this.introBackButton.eventMode = "static";
    this.introBackButton.cursor = "pointer";

    this.introBackButton.on("pointerdown", (e: PointerEvent) => {
      e.stopPropagation();
      this.goBackIntroPanel();
    });

    this.introContainer.addChild(this.introBackButton);
  }

  private goBackIntroPanel(): void {
    if (this.introTransitioning) return;
    if (this.state.introPanelIndex === 0) return;

    this.stopAllNarrations();
    const prevIndex = (this.state.introPanelIndex - 1) as 0 | 1 | 2;

    this.introTransitioning = true;
    fadeTransition(
      this.app.stage,
      this.app.ticker,
      () => {
        this.state.introPanelIndex = prevIndex;
        this.showIntroPanel(prevIndex);
      },
      600,
    ).then(() => {
      this.introTransitioning = false;
      audioManager.playOneShot(`intro_panel_${prevIndex + 1}` as AudioId);
    });
  }

  private advanceIntroPanel(): void {
    if (this.introTransitioning) return;
    this.stopAllNarrations();

    const currentIndex = this.state.introPanelIndex;

    if (currentIndex >= 2) {
      // Panel 3 was showing, end intro
      this.endIntroSequence();
      return;
    }

    // Fade to next panel
    this.introTransitioning = true;
    const nextIndex = (currentIndex + 1) as 0 | 1 | 2;

    fadeTransition(
      this.app.stage,
      this.app.ticker,
      () => {
        this.state.introPanelIndex = nextIndex;
        this.showIntroPanel(nextIndex);
      },
      600,
    ).then(() => {
      this.introTransitioning = false;
      audioManager.playOneShot(`intro_panel_${nextIndex + 1}` as AudioId);
    });
  }

  private endIntroSequence(): void {
    if (this.introTransitioning) return;
    this.stopAllNarrations();
    this.introTransitioning = true;

    fadeTransition(
      this.app.stage,
      this.app.ticker,
      () => {
        // Remove intro container
        if (this.introContainer) {
          this.app.stage.removeChild(this.introContainer);
          this.introContainer.destroy({ children: true });
          this.introContainer = null;
        }

        // Remove canvas click handler
        if (this.introClickHandler) {
          this.app.canvas.removeEventListener("pointerdown", this.introClickHandler);
          this.introClickHandler = null;
        }

        // Transition to PLAYING
        this.state.phase = "PLAYING";
        introPlayed = true;
        this.introTransitioning = false;

        // Clear any held keys from the intro
        this.input.clearAll();

        // Finish the setup that start() deferred
        this.locked = false;
        this.state.runStats.startTimeMs = performance.now();
        this.maybeShowReceptionTutorial();
        this.maybePlayTutorialT0();
      },
      600,
    );
  }

  private handleIntroTick(dtMS: number): void {
    // Space or Enter to advance
    if (!this.introTransitioning) {
      if (this.input.justPressed("Space") || this.input.justPressed("Enter")) {
        this.advanceIntroPanel();
      }
    }

    // Pulse the click-to-continue indicator
    if (this.introIndicator && !this.introTransitioning) {
      this.introIndicatorPulseTime += dtMS;
      const elapsed = performance.now() - this.introPanelVoiceoverStartMs;
      const voiceoverPlaying = elapsed < this.introPanelVoiceoverDurationMs;
      if (voiceoverPlaying) {
        const cycle = (this.introIndicatorPulseTime % 1500) / 1500;
        this.introIndicator.alpha = 0.4 + 0.3 * Math.sin(cycle * Math.PI * 2);
        this.introIndicator.scale.set(this.introIndicatorBaseScale);
      } else {
        this.introIndicator.alpha = Math.min(1.0, this.introIndicator.alpha + dtMS / 400);
        const pulseFactor = 1.05 + 0.05 * Math.sin(this.introIndicatorPulseTime / 600);
        this.introIndicator.scale.set(this.introIndicatorBaseScale * pulseFactor);
      }
    }

    // Hold Escape for 1 second to skip
    if (this.input.isEscapeHeld()) {
      this.introEscHeldMs += dtMS;
      if (this.introEscHeldMs >= 1000) {
        this.endIntroSequence();
      }
    } else {
      this.introEscHeldMs = 0;
    }
  }

  // ── Restart ──

  private restart(): void {
    this.app.ticker.remove(this.tick, this);
    this.cancelAllRafs();
    this.hud.cancelFade();
    this.clearTutorialTimers();

    // Hide gameover stats
    this.hideGameOverStats();

    // Remove end-screen overlay
    if (this.overlayContainer) {
      this.app.stage.removeChild(this.overlayContainer);
      this.overlayContainer.destroy({ children: true });
      this.overlayContainer = null;
    }

    // Remove death fade overlay (prevents permanent black screen on restart)
    if (this.deathFadeOverlay) {
      this.app.stage.removeChild(this.deathFadeOverlay);
      this.deathFadeOverlay.destroy();
      this.deathFadeOverlay = null;
    }

    // Clean up flashlight
    if (this.flashlight) {
      this.flashlight.destroy();
      this.flashlight = null;
    }

    // Clean up vignette
    if (this.vignette) {
      this.app.stage.removeChild(this.vignette.container);
      this.vignette.destroy();
      this.vignette = null;
    }

    // Clean up heartbeat
    this.heartbeat.destroy();

    // Clean up visibility listener
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    // Stop audio (not unload; assets persist)
    audioManager.stopAllMonsterVocals();
    audioManager.stopAllBlobs();
    this.stopAllNarrations();
    audioManager.fadeOutAmbient(100);

    // Cancel pending TTS calls
    for (const [, ctrl] of this.armedRadioAborts) {
      ctrl.abort();
    }
    this.armedRadioAborts.clear();

    // Clean up radio popup and workbench menu
    this.radioPopup.destroy();
    this.workbenchMenu.destroy();

    // Clean up crafting effects
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles = [];
    this.flareEffects.forEach((f) => f.destroy());
    this.flareEffects = [];
    this.smokeBombEffects.forEach((s) => s.destroy());
    this.smokeBombEffects = [];
    this.decoyEffects.forEach((d) => d.destroy());
    this.decoyEffects = [];

    // Clean up shade visual (stage child, not world child)
    if (this.shadeVisual) {
      this.shadeVisual.destroy();
      this.shadeVisual = null;
    }

    // Clean up HUD (lives on stage, not world)
    this.hud.destroy();

    // Clean up input event listeners
    this.input.destroy();

    // Destroy world and all children (room, player, monster, pickups)
    this.app.stage.removeChild(this.world);
    this.world.destroy({ children: true });

    this.pickups = [];
    this.monster = null;

    // Build fresh game
    const fresh = new Game(this.app, this.manifest);
    fresh.start();
  }

  // ── Hiding spots ──

  private updateHidingPrompts(): void {
    // No prompts or movement-exit during enter/exit animation
    if (this.state.hidingState.transitioning) return;

    if (this.state.hidingState.active) {
      this.hud.showPrompt("Press E to leave hiding spot");
      // Movement keys exit hide
      if (this.input.isLeft() || this.input.isRight()) {
        this.tryExitHide();
      }
      return;
    }

    const nearestSpot = this.getNearestHidingSpot();
    if (nearestSpot) {
      this.hud.showSpritePrompt("key-e", "label-hide");
      return;
    }

    const nearbyRadio = this.getNearbyRadioPickup();
    if (nearbyRadio) {
      this.hud.showSpritePrompt("key-e", "label-pickup");
      return;
    }

    // Interactable pickup prompt
    for (const pickup of this.pickups) {
      if (!pickup.isInteractable()) continue;
      if (!pickup.isInRange(this.player.x)) continue;
      if (pickup.config.togglesTo) {
        this.hud.showSpritePrompt("key-e", "label-interact");
      } else if (isLoreTapeId(pickup.config.id)) {
        this.hud.showSpritePrompt("key-e", "label-pickup");
      } else {
        this.hud.showSpritePrompt("key-e", "label-pickup");
      }
      return;
    }

    // Workbench prompt
    if (this.isNearWorkbench()) {
      this.hud.showSpritePrompt("key-e", "label-craft");
      return;
    }

    // Shade recovery prompt
    if (this.shadeVisual && this.state.activeShade &&
        this.shadeVisual.isPlayerInRange(this.player.x, this.player.y)) {
      this.hud.showSpritePrompt("key-e", "label-grab");
      return;
    }

    // Vent prompt
    const vent = this.rooms.getNearbyVent(this.player.x);
    if (vent) {
      this.hud.showSpritePrompt("key-e", "label-climb");
      return;
    }

    // Door prompt
    const door = this.rooms.getNearbyDoor(this.player.x);
    if (door) {
      this.hud.showSpritePrompt("key-e", "label-interact");
      return;
    }

    this.hud.clearPrompt();
  }

  private getNearestHidingSpot(): HidingSpot | null {
    for (const spot of this.hidingSpots) {
      if (spot.isPlayerInRange(this.player.x)) {
        return spot;
      }
    }
    return null;
  }

  private enterHide(spot: HidingSpot): void {
    // Locker Jumper risk check
    if (spot.kind === "locker") {
      const spotIndex = this.getLockerSpotIndex(spot);
      const key = `${this.state.currentRoom}:${spotIndex}`;
      if (this.state.loadedLockers[key]) {
        // Jumper ambush from locker. Player does NOT enter.
        this.state.loadedLockers[key] = false;
        const floorY = this.rooms.currentRoom.floorY;
        const hotspot: JumperHotspot = { x: spot.x, ventY: floorY };
        const lockerJumper = new Jumper(hotspot, floorY, this.manifest, this.world, true);
        this.jumpers.push(lockerJumper);
        audioManager.playOneShot("locker_open");
        return;
      }
    }

    this.state.hidingState = {
      active: true,
      spotId: spot.id,
      kind: spot.kind,
      transitioning: spot.kind === "desk",
    };
    spot.isOccupied = true;
    if (spot.kind === "desk") spot.sprite.visible = false;

    // Snap player to spot position
    this.player.x = spot.x;
    this.player.setHidingPose(spot.kind);

    if (spot.kind === "locker") {
      // Locker: instant suspicion drop, darken screen
      this.monster?.setSuspicion(0);
      if (this.flashlight) this.flashlight.setHidingMode("locker");
      audioManager.playOneShot("locker_close");
    } else {
      // Desk: boost decay rate (handled in handlePlayingTick), dim flashlight
      if (this.flashlight) this.flashlight.setHidingMode("desk");
      audioManager.playOneShot("desk_crouch");
    }

    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    this.hud.setHiddenVisible(true);
  }

  private getLockerSpotIndex(spot: HidingSpot): number {
    const def = this.rooms.currentDef;
    if (!def.hidingSpots) return -1;
    return def.hidingSpots.findIndex((s) => s.id === spot.id);
  }

  private tryExitHide(): void {
    if (!this.state.hidingState.active) return;
    if (this.state.hidingState.transitioning) return;
    const spotId = this.state.hidingState.spotId!;
    const kind = this.state.hidingState.kind!;
    const spot = this.hidingSpots.find((s) => s.id === spotId);
    if (!spot) return;

    // Locker constraint: cannot exit if monster is within 100px
    if (kind === "locker" && this.monster) {
      const dx = Math.abs(this.monster.x - spot.x);
      if (dx < 100) {
        this.hud.showPrompt("Too risky. Wait.");
        audioManager.playOneShot("locker_door_creak");
        return;
      }
    }

    if (kind === "desk") {
      // Desk: trigger exit animation. State stays active until animation completes.
      this.state.hidingState.transitioning = true;
      this.player.startExitDeskHide();
      return;
    }

    // Locker: instant exit (unchanged)
    this.state.hidingState = { active: false, spotId: null, kind: null, transitioning: false };
    spot.isOccupied = false;
    this.player.setStandingPose();
    if (this.flashlight) this.flashlight.setHidingMode("none");

    audioManager.playOneShot("locker_open");

    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    this.hud.setHiddenVisible(false);
  }

  private onDeskExitComplete(): void {
    const spotId = this.state.hidingState.spotId;
    const spot = spotId ? this.hidingSpots.find((s) => s.id === spotId) : null;
    if (spot) {
      spot.isOccupied = false;
      spot.sprite.visible = true;
    }

    this.state.hidingState = { active: false, spotId: null, kind: null, transitioning: false };
    if (this.flashlight) this.flashlight.setHidingMode("none");
    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    this.hud.setHiddenVisible(false);
    this.input.clearAll();
  }

  // ── Door sprites ──

  private createDoors(): void {
    const def = this.rooms.currentDef;
    const floorY = this.rooms.currentRoom.floorY;

    for (const door of def.doors) {
      const texture = Assets.get<Texture>("props:door-closed");
      const sprite = new Sprite(texture || Texture.WHITE);
      sprite.anchor.set(0.5, 1.0);
      sprite.x = door.fromX;
      sprite.y = floorY;
      this.rooms.currentRoom.addChild(sprite);
      this.doorSprites.push(sprite);
    }
  }

  // ── Decorative props ──

  private createDecorativeProps(): void {
    const def = this.rooms.currentDef;
    if (!def.decorativeProps) return;

    for (const propDef of def.decorativeProps) {
      const alias = propDef.frameName.includes(":") ? propDef.frameName : "props:" + propDef.frameName;
      const texture = Assets.get<Texture>(alias);
      const sprite = new Sprite(texture || Texture.WHITE);
      sprite.anchor.set(0.5, 1.0);
      sprite.x = propDef.x;
      sprite.y = propDef.y;
      if (propDef.scale !== undefined) sprite.scale.set(propDef.scale);
      if (propDef.alpha !== undefined) sprite.alpha = propDef.alpha;
      this.rooms.currentRoom.addChild(sprite);
      this.decorativeSprites.push(sprite);

      if (propDef.flickerAnimation) {
        this.flickerTimers.push({
          sprite,
          timer: 0,
          nextAt: 200 + Math.random() * 600,
        });
      }
    }
  }

  // ── Ladder / climbing system ──

  private handleClimbing(dt: number): void {
    const ladder = this.playerClimbingLadder!;
    const speed = Game.CLIMB_SPEED * dt;

    // Up moves player toward topY (lower screen Y)
    if (this.input.isUp()) {
      this.player.y -= speed;
    }
    // Down moves player toward bottomY (higher screen Y)
    if (this.input.isDown()) {
      this.player.y += speed;
    }

    // Clamp Y within ladder bounds
    this.player.y = Math.max(ladder.topY, Math.min(ladder.bottomY, this.player.y));

    // Reached the top: step onto upper floor
    if (this.player.y <= ladder.topY && this.input.isUp()) {
      this.playerFloorYOverride = ladder.topY;
      this.playerClimbingLadder = null;
      this.player.y = ladder.topY;
      this.player.setStandingPose();
    }

    // Reached the bottom: step onto ground floor
    if (this.player.y >= ladder.bottomY && this.input.isDown()) {
      this.playerFloorYOverride = null;
      this.playerClimbingLadder = null;
      this.player.y = ladder.bottomY;
      this.player.setStandingPose();
    }
  }

  private checkLadderEntryFromGround(): void {
    const def = this.rooms.currentDef;
    if (!def.ladders) return;
    if (this.state.hidingState.active) return;
    // Player must hold W/Up near a ladder
    if (!this.input.isUp()) return;

    for (const ladder of def.ladders) {
      if (Math.abs(this.player.x - ladder.x) < ladder.triggerWidth / 2) {
        this.playerClimbingLadder = ladder;
        this.player.x = ladder.x;
        this.player.y = ladder.bottomY;
        this.player.setHidingPose("locker"); // reuse crouch pose for climbing
        return;
      }
    }
  }

  private checkLadderEntryFromUpper(): void {
    const def = this.rooms.currentDef;
    if (!def.ladders) return;
    if (this.state.hidingState.active) return;
    // Player must hold S/Down near a ladder while on upper floor
    if (!this.input.isDown()) return;

    for (const ladder of def.ladders) {
      if (Math.abs(this.player.x - ladder.x) < ladder.triggerWidth / 2) {
        this.playerClimbingLadder = ladder;
        this.player.x = ladder.x;
        this.player.y = ladder.topY;
        this.player.setHidingPose("locker"); // reuse crouch pose for climbing
        return;
      }
    }
  }

  /** Render ladder sprites and upper background for the current room if applicable. */
  private createLadderAndUpperFloor(): void {
    const def = this.rooms.currentDef;
    if (!def.ladders || !def.upperBg) return;

    const floorY = this.rooms.currentRoom.floorY;
    const upperFloorY = def.upperFloorY ?? floorY - 380;

    // Upper background sprite -- positioned at upper floor left edge
    const upperTex = Assets.get<Texture>(def.upperBg);
    const xMin = def.upperFloorXMin ?? 0;
    const xMax = def.upperFloorXMax ?? this.rooms.currentRoom.roomWidth;
    if (upperTex) {
      const upperSprite = new Sprite(upperTex);
      upperSprite.anchor.set(0, 1.0);
      upperSprite.x = xMin;
      upperSprite.y = upperFloorY;
      upperSprite.zIndex = 5; // above room bg (0), below player (50)
      upperSprite.eventMode = "none";
      this.world.addChild(upperSprite);
      this.upperBgSprite = upperSprite;
    }

    // Catwalk surface strip (tiled metal grating at the upper floor line).
    // Pixi v8 TilingSprite: https://pixijs.com/8.x/guides/components/sprite-tiling-tilingsprite
    const catwalkTex = Assets.get<Texture>("traversal:catwalk");
    if (catwalkTex) {
      const catwalkStrip = new TilingSprite({
        texture: catwalkTex,
        width: xMax - xMin,
        height: catwalkTex.height,
      });
      catwalkStrip.anchor.set(0, 1.0);
      catwalkStrip.x = xMin;
      catwalkStrip.y = upperFloorY;
      catwalkStrip.zIndex = 10; // above upper-bg (5), below ladder (30)
      catwalkStrip.eventMode = "none";
      this.world.addChild(catwalkStrip);
      this.upperCatwalkSprite = catwalkStrip;
    }

    // Render ladders
    for (const ladder of def.ladders) {
      // Bottom piece
      const bottomTex = Assets.get<Texture>("traversal:ladder-bottom");
      if (bottomTex) {
        const bottomSprite = new Sprite(bottomTex);
        bottomSprite.anchor.set(0.5, 1.0);
        bottomSprite.x = ladder.x;
        bottomSprite.y = ladder.bottomY;
        bottomSprite.zIndex = 30; // behind player (50)
        this.world.addChild(bottomSprite);
        this.ladderSprites.push(bottomSprite);
      }

      // Mid pieces (tiled vertically)
      const midTex = Assets.get<Texture>("traversal:ladder-mid");
      if (midTex) {
        const totalHeight = ladder.bottomY - ladder.topY;
        const midHeight = midTex.height;
        // Leave space for top and bottom pieces (~260px each)
        const midStart = ladder.bottomY - 260;
        const midEnd = ladder.topY + 270;
        const midSpan = midStart - midEnd;
        const midCount = Math.max(0, Math.floor(midSpan / midHeight));
        for (let i = 0; i < midCount; i++) {
          const midSprite = new Sprite(midTex);
          midSprite.anchor.set(0.5, 1.0);
          midSprite.x = ladder.x;
          midSprite.y = midStart - i * midHeight;
          midSprite.zIndex = 30;
          this.world.addChild(midSprite);
          this.ladderSprites.push(midSprite);
        }
      }

      // Top piece
      const topTex = Assets.get<Texture>("traversal:ladder-top");
      if (topTex) {
        const topSprite = new Sprite(topTex);
        topSprite.anchor.set(0.5, 1.0);
        topSprite.x = ladder.x;
        topSprite.y = ladder.topY + 20;
        topSprite.zIndex = 30;
        this.world.addChild(topSprite);
        this.ladderSprites.push(topSprite);
      }

      // Hatch at top
      const hatchTex = Assets.get<Texture>("traversal:hatch");
      if (hatchTex) {
        const hatchSprite = new Sprite(hatchTex);
        hatchSprite.anchor.set(0.5, 1.0);
        hatchSprite.x = ladder.x;
        hatchSprite.y = ladder.topY;
        hatchSprite.zIndex = 55; // slightly above player
        this.world.addChild(hatchSprite);
        this.ladderSprites.push(hatchSprite);
      }
    }
  }

  // ── Foreground props (render above player for depth occlusion) ──

  private createForegroundProps(): void {
    const def = this.rooms.currentDef;
    if (!def.foregroundProps || def.foregroundProps.length === 0) return;

    const roomWidth = this.rooms.currentRoom.roomWidth;

    for (const prop of def.foregroundProps) {
      const tex = Assets.get<Texture>(prop.key);
      if (!tex) {
        console.warn(`[room] foreground prop missing texture: ${prop.key}`);
        continue;
      }
      // Clamp x to room bounds
      const x = Math.min(prop.x, roomWidth - 50);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1.0);
      sprite.x = x;
      sprite.y = prop.anchorBottomY;
      if (prop.scale !== undefined) sprite.scale.set(prop.scale);
      if (prop.tint !== undefined) sprite.tint = prop.tint;
      sprite.eventMode = "none"; // skip hit-testing for performance
      this.foregroundLayer.addChild(sprite);
    }
  }

  private createHidingSpots(): void {
    const def = this.rooms.currentDef;
    if (!def.hidingSpots) return;
    const floorY = this.rooms.currentRoom.floorY;

    for (const spotDef of def.hidingSpots) {
      const spot = new HidingSpot(spotDef, floorY);
      this.world.addChild(spot.sprite);
      this.hidingSpots.push(spot);
    }
  }

  // ── Vent sprites ──

  private createVents(): void {
    const def = this.rooms.currentDef;
    if (!def.vents) return;
    const floorY = this.rooms.currentRoom.floorY;

    for (const ventDef of def.vents) {
      const texture = Assets.get<Texture>("vents:open");
      const sprite = new Sprite(texture || Texture.WHITE);
      sprite.anchor.set(0.5, 1.0);
      sprite.x = ventDef.x;
      sprite.y = floorY;
      sprite.scale.set(0.4);
      this.world.addChild(sprite);
      this.ventSprites.push(sprite);
    }
  }

  // ── Jumper system ──

  private createJumpers(): void {
    const def = this.rooms.currentDef;
    if (!def.jumperHotspots) return;
    const floorY = this.rooms.currentRoom.floorY;

    // Mirror of FLOOR_VISUAL_SHRINK in jumper.ts. Kept as a local
    // constant because game.ts does not import jumper internals.
    // MUST stay equal to FLOOR_VISUAL_SHRINK.
    const DRIP_SHRINK = 0.6;

    for (const hotspot of def.jumperHotspots) {
      // Upper-floor jumpers use the upper floor Y as their landing floor
      const jumperFloorY = (hotspot.floorLevel === "upper" && def.upperFloorY)
        ? def.upperFloorY
        : floorY;

      const isFloorVent = hotspot.ventPosition === "floor";

      // Place vent sprite at the hotspot
      const dripTexture = Assets.get<Texture>("vents:drip");
      const dripSprite = new Sprite(dripTexture || Texture.WHITE);
      if (isFloorVent) {
        // Wall-mounted floor vent: match jumper idle sprite footprint,
        // scaled down by DRIP_SHRINK.
        dripSprite.anchor.set(0.5, 1.0);
        dripSprite.x = hotspot.x;
        dripSprite.y = jumperFloorY - 50;
        dripSprite.height = 220 * DRIP_SHRINK;
        dripSprite.width = 220 * (330 / 256) * DRIP_SHRINK;
        dripSprite.zIndex = 20;
      } else {
        // Ceiling vent: existing behavior preserved
        dripSprite.anchor.set(0.5, 0.0);
        dripSprite.x = hotspot.x;
        dripSprite.y = hotspot.ventY;
        dripSprite.scale.set(0.4);
        dripSprite.zIndex = 20;
      }
      this.world.addChild(dripSprite);
      this.jumperDripSprites.push(dripSprite);

      // Create the Jumper entity. Floor variants receive the dripSprite
      // reference so the Jumper can toggle its visibility per state.
      const jumper = new Jumper(
        hotspot, jumperFloorY, this.manifest, this.world,
        false, isFloorVent ? dripSprite : undefined,
      );
      this.jumpers.push(jumper);
    }
  }

  private rollLockerJumpers(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [roomId, def] of Object.entries(ROOM_DEFINITIONS)) {
      if (!def.hidingSpots) continue;
      def.hidingSpots.forEach((spot, idx) => {
        if (spot.kind !== "locker") return;
        const key = `${roomId}:${idx}`;
        result[key] = Math.random() < 0.25;
      });
    }
    return result;
  }

  // ── Whisperer system ──

  private updateWhisperer(dtMS: number): void {
    const room = ROOM_DEFINITIONS[this.state.currentRoom];
    if (!room.whispererCanSpawn) {
      // Player is in a non-whisperer room; despawn if active
      if (this.whisperer) {
        this.whisperer.destroy();
        this.whisperer = null;
      }
      this.whispererSpawnCheckTimer = 0;
      return;
    }

    if (this.whisperer === null) {
      // Try to spawn
      this.whispererSpawnCheckTimer += dtMS;
      if (this.whispererSpawnCheckTimer >= Game.WHISPERER_SPAWN_CHECK_INTERVAL_MS) {
        this.whispererSpawnCheckTimer = 0;
        const chance = room.whispererSpawnChance ?? Game.WHISPERER_SPAWN_PROBABILITY;
        if (Math.random() < chance) {
          this.spawnWhisperer();
        }
      }
    } else {
      // Compute camera viewport in world coords
      const cameraLeft = -this.world.x;
      const cameraRight = cameraLeft + this.app.screen.width;

      this.whisperer.update(
        dtMS,
        this.player.x,
        this.player.facingDirection,
        this.beaconState,
        cameraLeft,
        cameraRight,
      );

      // Flare repel: any active flare within range forces fading (no beacon penalty)
      if (this.whisperer.state === "idle") {
        for (const flare of this.flareEffects) {
          if (flare.isWhispererRepelled(this.whisperer.container.x, this.whisperer.container.y)) {
            this.whisperer.forceFade();
            break;
          }
        }
      }

      if (this.whisperer.isDespawned()) {
        this.whisperer.destroy();
        this.whisperer = null;
      }
    }
  }

  private spawnWhisperer(): void {
    const playerX = this.player.x;
    const roomWidth = this.rooms.currentRoom.roomWidth;
    // Spawn 600px to the left or right of the player, clamped to room bounds
    const side = Math.random() < 0.5 ? -1 : 1;
    let spawnX = playerX + side * 600;
    spawnX = Math.max(60, Math.min(roomWidth - 60, spawnX));
    const floorY = this.rooms.currentRoom.floorY;
    this.whisperer = new Whisperer(this.manifest, this.world, spawnX, floorY);
  }

  // ── Radio bait system ──

  private getNearbyRadioPickup(): RadioPickupDef | null {
    const def = this.rooms.currentDef;
    if (!def.radioPickups) return null;
    for (const rp of def.radioPickups) {
      // Skip collected originals
      if (this.state.radio.collectedRadioIds.has(rp.radioId)) continue;
      if (Math.abs(this.player.x - rp.x) <= rp.pickupRange) return rp;
    }
    // Check dropped radios in this room
    for (const dr of this.state.radio.droppedRadios) {
      if (dr.roomId !== this.state.currentRoom) continue;
      if (Math.abs(this.player.x - dr.x) <= 100) {
        return { radioId: dr.radioId, x: dr.x, y: 0, pickupRange: 100 };
      }
    }
    return null;
  }

  private pickUpRadio(rpDef: RadioPickupDef): void {
    // If already carrying a radio, drop it at current position
    if (this.state.radio.carriedRadioId !== null) {
      const oldId = this.state.radio.carriedRadioId;
      // Remove from droppedRadios if it was a dropped one
      this.state.radio.droppedRadios = this.state.radio.droppedRadios.filter(
        (d) => d.radioId !== oldId,
      );
      // Add old radio as dropped
      this.state.radio.droppedRadios.push({
        radioId: oldId,
        roomId: this.state.currentRoom,
        x: this.player.x,
      });
      // Create dropped sprite
      this.createDroppedRadioSprite(oldId, this.player.x);
      // Free the old radio's inventory slot
      const oldSlot = this.state.inventorySlots.findIndex(
        (s) => s !== null && s.kind === "radio",
      );
      if (oldSlot !== -1) this.state.inventorySlots[oldSlot] = null;
    } else {
      // Not carrying a radio - need an empty slot
      const emptySlot = this.state.inventorySlots.indexOf(null);
      if (emptySlot === -1) {
        this.hud.showMessage("Inventory full.", 2000);
        return;
      }
    }

    // Pick up the new radio
    this.state.radio.carriedRadioId = rpDef.radioId;
    this.state.radio.collectedRadioIds.add(rpDef.radioId);

    // Place radio in first empty inventory slot
    const newSlot = this.state.inventorySlots.indexOf(null);
    if (newSlot !== -1) {
      this.state.inventorySlots[newSlot] = { kind: "radio" };
    }

    // Remove from droppedRadios if picking up a dropped one
    this.state.radio.droppedRadios = this.state.radio.droppedRadios.filter(
      (d) => d.radioId !== rpDef.radioId,
    );
    // Remove dropped sprite if exists
    const droppedSprite = this.droppedRadioSprites.get(rpDef.radioId);
    if (droppedSprite) {
      this.world.removeChild(droppedSprite);
      droppedSprite.destroy();
      this.droppedRadioSprites.delete(rpDef.radioId);
    }

    this.hud.showMessage("Radio acquired. Press R to arm.", 3000);
    audioManager.playOneShot("keycard_pickup");
  }

  private async armCarriedRadio(): Promise<void> {
    if (this.state.phase !== "PLAYING") return;
    if (this.state.radio.carriedRadioId === null) return;
    if (this.state.hidingState.active) return;

    // Pause game
    this.state.phase = "PAUSED";
    this.app.ticker.stop();

    const result = await this.radioPopup.show();

    // Clear input state accumulated during popup
    this.input.clearAll();

    if (result === null) {
      // Cancelled: resume, radio still in inventory
      this.state.phase = "PLAYING";
      this.app.ticker.start();
      return;
    }

    // Commit arm
    const armedId = `armed_${Date.now()}`;
    const armed: ArmedRadio = {
      id: armedId,
      message: result.message,
      timerMs: result.timerSec * 1000,
      remainingMs: result.timerSec * 1000,
      ttsState: "loading",
      ttsBlobUrl: null,
      position: { x: this.player.x, y: this.currentFloorY() },
      thrown: false,
      velocity: { x: 0, y: 0 },
      roomId: this.state.currentRoom,
    };
    this.state.radio.armedRadios.push(armed);
    this.state.radio.carriedRadioId = null;

    // Remove radio from inventory slot
    const radioSlot = this.state.inventorySlots.findIndex(
      (s) => s !== null && s.kind === "radio",
    );
    if (radioSlot !== -1) this.state.inventorySlots[radioSlot] = null;

    // Resume game
    this.state.phase = "PLAYING";
    this.app.ticker.start();

    // Fire TTS request (async, non-blocking)
    const abortCtrl = new AbortController();
    this.armedRadioAborts.set(armedId, abortCtrl);
    synthesizeTTS(result.message, abortCtrl.signal)
      .then((blobUrl) => {
        if (blobUrl) {
          armed.ttsState = "ready";
          armed.ttsBlobUrl = blobUrl;
        } else {
          armed.ttsState = "failed";
        }
      })
      .catch(() => {
        armed.ttsState = "failed";
      });
  }

  private throwCarriedArmedRadio(): void {
    if (this.state.phase !== "PLAYING") return;
    // Find the most recent armed radio in player's hand (not yet thrown)
    const armed = this.state.radio.armedRadios.find(
      (r) => !r.thrown && r.roomId === this.state.currentRoom,
    );
    if (!armed) return;

    armed.thrown = true;
    const dir = this.player.facingDirection;
    armed.velocity.x = dir * 600;
    armed.velocity.y = -500;
    if (audioManager.has("radio_throw")) {
      audioManager.playOneShot("radio_throw");
    }
  }

  private updateArmedRadios(dtMS: number): void {
    const floorY = this.rooms.currentRoom.floorY;

    for (const armed of this.state.radio.armedRadios) {
      if (armed.remainingMs <= 0) continue;

      armed.remainingMs -= dtMS;

      if (armed.thrown) {
        // Parabolic motion
        const dtSec = dtMS / 1000;
        armed.position.x += armed.velocity.x * dtSec;
        armed.position.y += armed.velocity.y * dtSec;
        armed.velocity.y += 1500 * dtSec; // gravity
        // Floor clamp
        if (armed.position.y > floorY) {
          armed.position.y = floorY;
          armed.velocity.x = 0;
          armed.velocity.y = 0;
        }
      } else {
        // In hand: track player
        armed.position.x = this.player.x;
        armed.position.y = floorY;
      }

      if (armed.remainingMs <= 0) {
        this.detonateArmedRadio(armed);
      }
    }

    // Remove fully detonated radios from active list
    this.state.radio.armedRadios = this.state.radio.armedRadios.filter(
      (r) => r.remainingMs > 0,
    );
  }

  private detonateArmedRadio(armed: ArmedRadio): void {
    // Cancel any pending TTS request
    const abortCtrl = this.armedRadioAborts.get(armed.id);
    if (abortCtrl) {
      abortCtrl.abort();
      this.armedRadioAborts.delete(armed.id);
    }

    // Skip audio if player is dead
    if (this.state.phase === "DYING" || this.state.phase === "GAMEOVER") return;

    // Play audio: TTS if ready, else fallback
    if (armed.ttsState === "ready" && armed.ttsBlobUrl) {
      audioManager.loadAndPlayBlob(`tts_${armed.id}`, armed.ttsBlobUrl, {
        volume: 1.0,
      });
    } else {
      if (audioManager.has("static_burst")) {
        audioManager.playOneShot("static_burst");
      }
    }

    if (armed.thrown) {
      // Lure: divert monster toward radio position for 5 seconds
      if (this.monster && armed.roomId === this.state.currentRoom) {
        this.monster.startLure({
          targetX: armed.position.x,
          durationMs: 5000,
        });
        this.monster.addSuspicion(40);
        if (audioManager.has("confused_growl")) {
          audioManager.playOneShot("confused_growl");
        }
      }
      // Mark as spent radio (visual floor prop)
      this.state.radio.spentRadios.push({
        roomId: armed.roomId,
        x: armed.position.x,
        y: armed.position.y,
      });
    } else {
      // Exploded in hand: massive suspicion + screen flash
      if (this.monster) {
        this.monster.addSuspicion(50);
      }
      this.hud.showMessage("RADIO MALFUNCTIONED", 1500);
      this.flashScreen(0xff0000, 0.4);
    }
  }

  private flashScreen(color: number, peakAlpha: number): void {
    const overlay = new Graphics();
    overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.fill({ color, alpha: peakAlpha });
    overlay.zIndex = 9000;
    this.app.stage.addChild(overlay);

    let elapsed = 0;
    const duration = 400;
    const handler = (tk: Ticker) => {
      elapsed += tk.deltaMS;
      const t = Math.min(elapsed / duration, 1);
      overlay.alpha = peakAlpha * (1 - t);
      if (t >= 1) {
        this.app.ticker.remove(handler);
        this.app.stage.removeChild(overlay);
        overlay.destroy();
      }
    };
    this.app.ticker.add(handler);
  }

  private syncArmedRadioSprites(): void {
    const radioTexture = Assets.get<Texture>("radio");

    for (const armed of this.state.radio.armedRadios) {
      if (armed.roomId !== this.state.currentRoom) continue;

      let sprite = this.armedRadioSprites.get(armed.id);
      if (!sprite) {
        sprite = new Sprite(radioTexture || Texture.WHITE);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(0.08);
        this.world.addChild(sprite);
        this.armedRadioSprites.set(armed.id, sprite);
      }
      sprite.x = armed.position.x;
      sprite.y = armed.position.y;

      // Pulsing red tint
      const pulse = Math.sin(performance.now() / 100) * 0.5 + 0.5;
      const r = 0xff;
      const g = Math.floor(pulse * 0x40);
      const b = Math.floor(pulse * 0x40);
      sprite.tint = (r << 16) | (g << 8) | b;
    }

    // Remove sprites for detonated or out-of-room radios
    const activeIds = new Set(
      this.state.radio.armedRadios
        .filter((r) => r.roomId === this.state.currentRoom)
        .map((r) => r.id),
    );
    for (const [id, sprite] of this.armedRadioSprites) {
      if (!activeIds.has(id)) {
        this.world.removeChild(sprite);
        sprite.destroy();
        this.armedRadioSprites.delete(id);
      }
    }
  }

  private createDroppedRadioSprite(radioId: string, x: number): void {
    const radioTexture = Assets.get<Texture>("radio");
    const sprite = new Sprite(radioTexture || Texture.WHITE);
    sprite.anchor.set(0.5, 1.0);
    sprite.scale.set(0.08);
    sprite.x = x;
    sprite.y = this.rooms.currentRoom.floorY;
    sprite.tint = 0xaaaaaa;
    this.world.addChild(sprite);
    this.droppedRadioSprites.set(radioId, sprite);
  }

  private createRadioWorldSprites(): void {
    const floorY = this.rooms.currentRoom.floorY;
    const radioTexture = Assets.get<Texture>("radio");

    // Dropped radios in this room
    for (const dr of this.state.radio.droppedRadios) {
      if (dr.roomId !== this.state.currentRoom) continue;
      const sprite = new Sprite(radioTexture || Texture.WHITE);
      sprite.anchor.set(0.5, 1.0);
      sprite.scale.set(0.08);
      sprite.x = dr.x;
      sprite.y = floorY;
      sprite.tint = 0xaaaaaa;
      this.world.addChild(sprite);
      this.droppedRadioSprites.set(dr.radioId, sprite);
    }

    // Spent radios in this room (visual only, non-interactive)
    for (const sr of this.state.radio.spentRadios) {
      if (sr.roomId !== this.state.currentRoom) continue;
      const sprite = new Sprite(radioTexture || Texture.WHITE);
      sprite.anchor.set(0.5, 1.0);
      sprite.scale.set(0.08);
      sprite.x = sr.x;
      sprite.y = sr.y;
      sprite.tint = 0x444444;
      sprite.alpha = 0.6;
      this.world.addChild(sprite);
      this.spentRadioSprites.set(`spent_${sr.x}`, sprite);
    }
  }

  private destroyRadioSprites(): void {
    for (const [, sprite] of this.armedRadioSprites) {
      this.world.removeChild(sprite);
      sprite.destroy();
    }
    this.armedRadioSprites.clear();
    for (const [, sprite] of this.droppedRadioSprites) {
      this.world.removeChild(sprite);
      sprite.destroy();
    }
    this.droppedRadioSprites.clear();
    for (const [, sprite] of this.spentRadioSprites) {
      this.world.removeChild(sprite);
      sprite.destroy();
    }
    this.spentRadioSprites.clear();
  }

  // ── Crafting: throw, effects, workbench ──

  private static readonly MATERIAL_IDS = new Set([
    "wire",
    "glass_shards",
    "battery",
    "tape",
  ]);

  private throwSelectedItem(): void {
    const slot = this.state.inventorySlots[this.state.selectedSlot];
    if (!slot || slot.kind !== "crafted") return;

    const itemId = slot.id;
    this.state.inventorySlots[this.state.selectedSlot] = null;

    const dir = this.player.facingDirection;
    const floorY = this.currentFloorY();

    let textureAlias: string;
    switch (itemId) {
      case "flare":
        textureAlias = "flare:unlit";
        break;
      case "smoke_bomb":
        textureAlias = "smokebomb:idle";
        break;
      case "decoy_radio":
        textureAlias = "decoy-radio:idle";
        break;
    }

    const texture = Assets.get<Texture>(textureAlias) || Texture.WHITE;
    const projectile = new Projectile(
      this.world,
      texture,
      this.player.x,
      floorY - 40,
      dir * 600,
      -500,
      1500,
      floorY,
      0.12,
      (landX, landY) => this.onItemLand(itemId, landX, landY),
    );
    this.projectiles.push(projectile);

    if (audioManager.has("radio_throw")) {
      audioManager.playOneShot("radio_throw");
    }
  }

  private onItemLand(itemId: CraftedItemId, x: number, y: number): void {
    switch (itemId) {
      case "flare": {
        const flare = new FlareEffect(this.world, x, y);
        this.flareEffects.push(flare);
        // Listener attraction on ignition
        if (this.monster) this.monster.addSuspicion(30);
        break;
      }
      case "smoke_bomb": {
        const smoke = new SmokeBombEffect(this.world, x, y);
        this.smokeBombEffects.push(smoke);
        break;
      }
      case "decoy_radio": {
        const decoy = new DecoyEffect(this.world, x, y);
        this.decoyEffects.push(decoy);
        // Lure monster toward decoy for 3 seconds
        if (this.monster) {
          this.monster.startLure({ targetX: x, durationMs: 3000 });
          this.monster.addSuspicion(30);
        }
        break;
      }
    }
  }

  private updateProjectiles(dtMS: number): void {
    for (const p of this.projectiles) p.update(dtMS);
    this.projectiles = this.projectiles.filter((p) => {
      if (p.landed) {
        p.destroy();
        return false;
      }
      return true;
    });
  }

  private updateFlareEffects(dtMS: number): void {
    for (const f of this.flareEffects) {
      f.update(dtMS, this.beaconState, this.player.x, this.player.y);
    }
    this.flareEffects = this.flareEffects.filter((f) => {
      if (f.expired) {
        f.destroy();
        return false;
      }
      return true;
    });
  }

  private updateSmokeBombEffects(dtMS: number): void {
    for (const sb of this.smokeBombEffects) sb.update(dtMS);
    this.smokeBombEffects = this.smokeBombEffects.filter((sb) => {
      if (sb.expired) {
        sb.destroy();
        return false;
      }
      return true;
    });
  }

  private updateDecoyEffects(dtMS: number): void {
    for (const d of this.decoyEffects) d.update(dtMS);
    this.decoyEffects = this.decoyEffects.filter((d) => {
      if (d.done) {
        d.destroy();
        return false;
      }
      return true;
    });
  }

  private isNearWorkbench(): boolean {
    const def = ROOM_DEFINITIONS[this.state.currentRoom];
    if (!def.workbench) return false;
    return Math.abs(this.player.x - def.workbench.x) < def.workbench.triggerWidth;
  }

  private async openWorkbench(): Promise<void> {
    if (this.state.phase !== "PLAYING") return;

    this.state.phase = "PAUSED";
    this.app.ticker.stop();

    const result = await this.workbenchMenu.show(this.state.inventorySlots);
    this.input.clearAll();

    if (result !== null) {
      const recipe = RECIPES[result.recipeIndex];
      if (craft(this.state.inventorySlots, recipe)) {
        this.hud.showMessage(`Crafted ${recipe.name}.`, 2000);
        audioManager.playOneShot("keycard_pickup");
      }
    }

    this.state.phase = "PLAYING";
    this.app.ticker.start();
  }

  // ── Camera ──

  private updateCamera(): void {
    const halfScreen = this.app.screen.width / 2;
    const roomWidth = this.rooms.currentRoom.roomWidth;
    const maxScrollX = -(roomWidth - this.app.screen.width);
    this.world.x = Math.max(
      maxScrollX,
      Math.min(0, halfScreen - this.player.x),
    );
  }
}
