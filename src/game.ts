import {
  Application,
  Container,
  Ticker,
  Sprite,
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
} from "./types";
import { Manifest } from "./assets";
import { Player } from "./player";
import { Monster } from "./monster";
import { RoomManager } from "./rooms";
import { HUD } from "./hud";
import { Input } from "./input";
import { fadeTransition } from "./transition";
import { Pickup } from "./pickup";
import { HidingSpot } from "./hiding";
import { audioManager } from "./audio";
import { micAnalyser } from "./mic";
import { suspicionDeltaForFrame } from "./suspicion";
import { Flashlight } from "./flashlight";
import { AmbientId } from "./audio-catalog";

// Survives Game restart (audio stays loaded, mic stays active)
let audioInitialized = false;

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
  private flickerTimers: { sprite: Sprite; timer: number; nextAt: number }[] = [];
  private flashlight: Flashlight | null = null;

  // Desk-hide charge roll state (reset when monster leaves CHARGE or player exits hide)
  private deskChargeRolled = false;
  private deskChargeFound = false;

  // Prevents concurrent async operations (room transitions, death fade, win fade)
  private locked = false;

  // End-screen overlay (gameover or win)
  private overlayContainer: Container | null = null;

  // Footstep SFX timing
  private footstepTimer = 0;
  private static readonly FOOTSTEP_WALK_MS = 400;
  private static readonly FOOTSTEP_RUN_MS = 250;

  // Tutorial message timers (cleared on death/win/restart)
  private tutorialTimers: ReturnType<typeof setTimeout>[] = [];

  // Visibility change cleanup
  private visibilityHandler: (() => void) | null = null;

  constructor(app: Application, manifest: Manifest) {
    this.app = app;
    this.manifest = manifest;
    this.state = createInitialGameState();
  }

  async start(): Promise<void> {
    this.world = new Container();
    this.app.stage.addChild(this.world);

    this.rooms = new RoomManager(this.world, "reception");

    // Align room bottom with canvas bottom
    this.world.y =
      this.app.screen.height - this.rooms.currentRoom.roomHeight;

    this.player = new Player(this.manifest);
    this.player.setRoomWidth(this.rooms.currentRoom.roomWidth);
    this.player.x = this.rooms.currentDef.playerSpawnFromLeft;
    this.player.y = this.rooms.currentRoom.floorY;
    this.world.addChild(this.player);

    // Reception has no monster
    this.monster = null;

    this.input = new Input();
    this.hud = new HUD(this.app.stage);

    // Create room-specific props for reception
    this.createDecorativeProps();
    this.createHidingSpots();

    // Lock gameplay until audio loaded and user clicks
    this.locked = true;
    this.app.ticker.add(this.tick, this);

    // First launch: load audio, show click-to-start, request mic
    if (!audioInitialized) {
      await this.initAudio();
      audioInitialized = true;
    }

    // Flashlight darkness overlay
    this.flashlight = new Flashlight(
      this.app.stage,
      this.app.screen.width,
      this.app.screen.height,
    );

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

    this.locked = false;

    this.maybeShowReceptionTutorial();
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
      case "PLAYING":
        this.handlePlayingTick(dt, dtMS);
        break;

      case "DYING":
        if (this.player.caughtComplete && !this.locked) {
          this.showGameover();
        }
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

  private handlePlayingTick(dt: number, dtMS: number): void {
    if (this.locked) return;

    this.player.update(dt, this.input);
    this.monster?.update(dt, dtMS);

    // Apply suspicion decay with crouch/hiding multiplier
    if (this.monster) {
      let decayMult = 1;
      if (this.player.isCrouching()) decayMult = 3;
      if (this.state.hidingState.active && this.state.hidingState.kind === "desk") decayMult = 4;
      if (this.state.hidingState.active && this.state.hidingState.kind === "locker") decayMult = 999;
      this.monster.applyDecay(dtMS, decayMult);
    }

    // Mic-driven suspicion
    if (this.monster && micAnalyser.state === "active") {
      const rms = micAnalyser.sample();
      const delta = suspicionDeltaForFrame(rms, dtMS);
      this.monster.addSuspicion(delta);
    }

    // Hiding prompts and movement-exit
    this.updateHidingPrompts();

    this.handleInteraction();
    this.handleFootsteps(dtMS);
    this.checkCaught();
    this.updateCamera();

    // Flicker animations for decorative lights
    for (const ft of this.flickerTimers) {
      ft.timer += dtMS;
      if (ft.timer >= ft.nextAt) {
        ft.sprite.alpha = 0.4 + Math.random() * 0.6;
        ft.timer = 0;
        ft.nextAt = 200 + Math.random() * 600;
      }
    }

    // Flashlight follows player screen position
    if (this.flashlight) {
      const screenX = this.player.x + this.world.x;
      const screenY = this.player.y + this.world.y;
      this.flashlight.update(screenX, screenY);
    }

    // Suspicion meter
    this.hud.updateSuspicionMeter(this.monster?.suspicion ?? 0);
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
        break;
      case "CHARGE":
        audioManager.playOneShot("monster_charge_roar");
        break;
      case "ATTACK":
        audioManager.playOneShot("monster_attack_lunge");
        break;
      case "IDLE_HOWL":
        audioManager.playOneShot("monster_idle_howl");
        break;
    }
  }

  // ── Interaction (E key) ──

  private handleInteraction(): void {
    if (!this.input.justInteracted()) return;

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
        // Collect pickup (keycard)
        pickup.collect();
        this.state.inventory.add(pickup.config.id);
        if (pickup.config.id === "keycard") {
          this.hud.showMessage("Picked up keycard.");
          audioManager.playOneShot("keycard_pickup");
        }
      }
      return; // E press consumed
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
      setTimeout(() => {
        if (this.state.phase !== "PLAYING") return;
        this.hud.showMessage("It can hear you. Whisper.", 5000);
      }, 9000),
    );

    // Play radio intro voiceover if the asset loaded successfully
    if (audioManager.has("radio_intro")) {
      audioManager.playOneShot("radio_intro");
    }
  }

  private clearTutorialTimers(): void {
    this.tutorialTimers.forEach(clearTimeout);
    this.tutorialTimers = [];
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
      this.createDecorativeProps();
      this.createHidingSpots();

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

    if (this.monster) {
      this.world.removeChild(this.monster);
      this.monster.destroy();
      this.monster = null;
    }
    audioManager.stopAllMonsterVocals();

    // Reset hiding state
    this.state.hidingState = { active: false, spotId: null, kind: null };
    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    if (this.flashlight) this.flashlight.setHidingMode("none");
    this.hud.clearPrompt();
    this.hud.setHiddenVisible(false);
  }

  private createPickups(): void {
    const def = this.rooms.currentDef;
    for (const pc of def.pickups) {
      // Skip collected non-toggle pickups
      if (!pc.togglesTo && this.state.inventory.has(pc.id)) continue;

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
    // Start patrol breath for initial PATROL state
    audioManager.loop("monster_patrol_breath");
  }

  // ── Death flow ──

  private triggerDeath(): void {
    if (this.state.phase !== "PLAYING") return;

    this.state.phase = "DYING";

    // Clear hiding state if dying while hidden (desk 50/50 caught)
    if (this.state.hidingState.active) {
      const spot = this.hidingSpots.find(
        (s) => s.id === this.state.hidingState.spotId,
      );
      if (spot) spot.isOccupied = false;
      this.state.hidingState = { active: false, spotId: null, kind: null };
      if (this.flashlight) this.flashlight.setHidingMode("none");
      this.hud.setHiddenVisible(false);
      this.hud.clearPrompt();
    }

    this.clearTutorialTimers();
    this.player.startCaughtSequence();
    audioManager.stopAllMonsterVocals();
    audioManager.playOneShot("death_thud");
  }

  private async showGameover(): Promise<void> {
    this.locked = true;

    await fadeTransition(this.app.stage, this.app.ticker, () => {
      this.buildEndScreen("gameover", "PRESS R TO RESTART");
      if (this.flashlight) this.flashlight.setVisible(false);
      audioManager.fadeOutAmbient();
    });

    this.state.phase = "GAMEOVER";
    this.locked = false;
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

  // ── Restart ──

  private restart(): void {
    this.app.ticker.remove(this.tick, this);
    this.clearTutorialTimers();

    // Remove end-screen overlay
    if (this.overlayContainer) {
      this.app.stage.removeChild(this.overlayContainer);
      this.overlayContainer.destroy({ children: true });
      this.overlayContainer = null;
    }

    // Clean up flashlight
    if (this.flashlight) {
      this.flashlight.destroy();
      this.flashlight = null;
    }

    // Clean up visibility listener
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    // Stop audio (not unload; assets persist)
    audioManager.stopAllMonsterVocals();
    audioManager.fadeOutAmbient(100);

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
    if (this.state.hidingState.active) {
      this.hud.showPrompt("Press E to leave hiding spot");
      // Movement keys exit hide
      if (this.input.isLeft() || this.input.isRight()) {
        this.tryExitHide();
      }
    } else {
      const nearestSpot = this.getNearestHidingSpot();
      if (nearestSpot) {
        const label =
          nearestSpot.kind === "locker" ? "in locker" : "under desk";
        this.hud.showPrompt(`Press E to hide ${label}`);
      } else {
        this.hud.clearPrompt();
      }
    }
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
    this.state.hidingState = {
      active: true,
      spotId: spot.id,
      kind: spot.kind,
    };
    spot.isOccupied = true;

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

  private tryExitHide(): void {
    if (!this.state.hidingState.active) return;
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

    this.state.hidingState = { active: false, spotId: null, kind: null };
    spot.isOccupied = false;
    this.player.setStandingPose();
    if (this.flashlight) this.flashlight.setHidingMode("none");

    if (kind === "locker") {
      audioManager.playOneShot("locker_open");
    }

    this.deskChargeRolled = false;
    this.deskChargeFound = false;
    this.hud.setHiddenVisible(false);
  }

  // ── Decorative props ──

  private createDecorativeProps(): void {
    const def = this.rooms.currentDef;
    if (!def.decorativeProps) return;

    for (const propDef of def.decorativeProps) {
      const texture = Assets.get<Texture>("props:" + propDef.frameName);
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
