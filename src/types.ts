// Monster states. Order matches debug key bindings (1=PATROL, 2=ALERT, etc.)
export type MonsterState =
  | "PATROL"
  | "ALERT"
  | "HUNT"
  | "CHARGE"
  | "ATTACK"
  | "IDLE_HOWL";

// Jumper states (ceiling ambush predator)
export type JumperState = "dormant" | "triggered" | "falling" | "attacking" | "retreating";

// Whisperer states (psychological drain ghost)
export type WhispererState = "spawning" | "idle" | "fading" | "despawned";

// Lore tape IDs (collectible voice memos)
export type LoreTapeId =
  | "tape_01" | "tape_02" | "tape_03"
  | "tape_04" | "tape_05" | "tape_06";

export function isLoreTapeId(id: string): id is LoreTapeId {
  return id.startsWith("tape_0") && id.length === 7;
}

export interface JumperHotspot {
  x: number;
  ventY: number;
  floorLevel?: "ground" | "upper"; // default "ground"
}

// Room IDs. Hub (reception) plus spokes.
export type RoomId = "reception" | "cubicles" | "server" | "stairwell" | "archives";

// Pickups. Each maps to a props or materials atlas frame.
export type PickupId =
  | "keycard"
  | "breaker_switch"
  | "wire"
  | "glass_shards"
  | "battery"
  | "tape"
  | "map_fragment"
  | LoreTapeId;

// Phase 5: Crafting inventory
export type MaterialId = "wire" | "glass_shards" | "battery" | "tape";
export type CraftedItemId = "flare" | "smoke_bomb" | "decoy_radio";

export type InventorySlotItem =
  | { kind: "material"; id: MaterialId }
  | { kind: "crafted"; id: CraftedItemId }
  | { kind: "radio" };

export interface WorkbenchDef {
  x: number;
  triggerWidth: number;
}

export interface Shade {
  inventorySnapshot: (InventorySlotItem | null)[];
  position: { x: number; y: number };
  roomId: RoomId;
  spawnTime: number;
}

// Game phases. Drives main loop branching.
export type GamePhase = "PLAYING" | "PAUSED" | "DYING" | "GAMEOVER" | "WIN";

// Door unlock requirements.
export type DoorRequirement = "none" | "press_e" | "keycard" | "breaker_on";

export interface DoorConfig {
  fromRoom: RoomId;
  toRoom: RoomId;
  fromX: number;
  toX: number;
  requirement: DoorRequirement;
  failMessage?: string;
  isExit?: boolean;
}

export interface VentDef {
  x: number;          // world x in current room
  target: RoomId;     // destination room
  targetX: number;    // x to spawn the player at in the target room
}

export interface PickupConfig {
  id: PickupId;
  room: RoomId;
  x: number;
  y: number;         // offset from floor (0 = on the floor, negative = above)
  frame: string;     // props atlas frame name
  pickupRange: number;
  togglesTo?: string; // if set, interaction swaps frame instead of collecting
}

export interface HidingState {
  active: boolean;
  spotId: string | null;
  kind: HidingSpotKind | null;
}

export interface RunStats {
  startTimeMs: number;
  roomsReached: Set<RoomId>;
  monsterEncounters: number;
}

export interface GameState {
  phase: GamePhase;
  currentRoom: RoomId;
  inventory: Set<PickupId>;
  breakerOn: boolean;
  hasMapFragment: boolean;
  hasShownReceptionTutorial: boolean;
  hidingState: HidingState;
  radio: RadioState;
  runStats: RunStats;
  loadedLockers: Record<string, boolean>;
  inventorySlots: (InventorySlotItem | null)[];
  selectedSlot: number;
  activeShade: Shade | null;
  tapesCollected: Set<LoreTapeId>;
  tutorialPlayed: { t0: boolean; t1: boolean; t2: boolean; t3: boolean };
}

export function createInitialGameState(): GameState {
  return {
    phase: "PLAYING",
    currentRoom: "reception",
    inventory: new Set(),
    breakerOn: false,
    hasMapFragment: false,
    hasShownReceptionTutorial: false,
    hidingState: { active: false, spotId: null, kind: null },
    radio: {
      carriedRadioId: null,
      armedRadios: [],
      collectedRadioIds: new Set(),
      droppedRadios: [],
      spentRadios: [],
    },
    runStats: {
      startTimeMs: 0,
      roomsReached: new Set<RoomId>(["reception"]),
      monsterEncounters: 0,
    },
    loadedLockers: {},
    inventorySlots: [null, null, null],
    selectedSlot: 0,
    activeShade: null,
    tapesCollected: new Set<LoreTapeId>(),
    tutorialPlayed: { t0: false, t1: false, t2: false, t3: false },
  };
}

// Radio pickup definition (separate from regular pickups)
export interface RadioPickupDef {
  radioId: string;
  x: number;
  y: number;
  pickupRange: number;
}

// Radio bait state
export interface ArmedRadio {
  id: string;
  message: string;
  timerMs: number;
  remainingMs: number;
  ttsState: "loading" | "ready" | "failed";
  ttsBlobUrl: string | null;
  position: { x: number; y: number };
  thrown: boolean;
  velocity: { x: number; y: number };
  roomId: RoomId;
}

export interface DroppedRadio {
  radioId: string;
  roomId: RoomId;
  x: number;
}

export interface SpentRadio {
  roomId: RoomId;
  x: number;
  y: number;
}

export interface RadioState {
  carriedRadioId: string | null;
  armedRadios: ArmedRadio[];
  collectedRadioIds: Set<string>;
  droppedRadios: DroppedRadio[];
  spentRadios: SpentRadio[];
}

// Hiding spot types
export type HidingSpotKind = "locker" | "desk";

export interface HidingSpotDef {
  id: string;
  kind: HidingSpotKind;
  x: number;
  y: number;
  triggerWidth: number;
}

// Decorative prop types (no interaction, visual only)
export interface DecorativePropDef {
  id: string;
  frameName: string;
  x: number;
  y: number;
  scale?: number;
  alpha?: number;
  flickerAnimation?: boolean;
}

// Foreground prop (renders ABOVE the player for occlusion depth)
export interface ForegroundPropDef {
  readonly key: string;            // atlas frame, e.g. "cubicle-dividers:straight"
  readonly x: number;              // world X
  readonly anchorBottomY: number;  // floor Y (typically room.floorY)
  readonly scale?: number;
  readonly tint?: number;
}

// Ladder definition (vertical traversal between floors)
export interface LadderDef {
  readonly x: number;
  readonly bottomY: number;        // ground floor Y
  readonly topY: number;           // upper floor Y
  readonly triggerWidth: number;   // X-range for press-up entry
}

export interface RoomDefinition {
  id: RoomId;
  background: string;
  hasMonster: boolean;
  monsterSpawn: number;
  monsterPatrolPath: [number, number];
  playerSpawnFromLeft: number;
  playerSpawnFromRight: number;
  pickups: PickupConfig[];
  doors: DoorConfig[];
  hidingSpots?: HidingSpotDef[];
  decorativeProps?: DecorativePropDef[];
  foregroundProps?: ForegroundPropDef[];
  radioPickups?: RadioPickupDef[];
  vents?: VentDef[];
  jumperHotspots?: JumperHotspot[];
  beaconDrainMultiplier?: number; // default 1.0, Archives uses 1.5
  whispererCanSpawn?: boolean;    // true for archives, stairwell
  whispererSpawnChance?: number;  // override per-room (default 0.30)
  workbench?: WorkbenchDef;
  // Upper floor (Server room only)
  upperBg?: string;               // atlas key for upper floor background
  upperFloorY?: number;           // pixel Y of upper floor
  upperFloorXMin?: number;        // left edge of upper walkable area
  upperFloorXMax?: number;        // right edge of upper walkable area
  ladders?: LadderDef[];
}
