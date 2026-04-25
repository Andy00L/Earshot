// Monster states. Order matches debug key bindings (1=PATROL, 2=ALERT, etc.)
export type MonsterState =
  | "PATROL"
  | "ALERT"
  | "HUNT"
  | "CHARGE"
  | "ATTACK"
  | "IDLE_HOWL";

// Room IDs. Ordered left to right through the building.
export type RoomId = "reception" | "cubicles" | "server" | "stairwell";

// Pickups. Each maps to a props atlas frame.
export type PickupId = "keycard" | "breaker_switch";

// Game phases. Drives main loop branching.
export type GamePhase = "PLAYING" | "DYING" | "GAMEOVER" | "WIN";

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

export interface GameState {
  phase: GamePhase;
  currentRoom: RoomId;
  inventory: Set<PickupId>;
  breakerOn: boolean;
  hasShownReceptionTutorial: boolean;
  hidingState: HidingState;
}

export function createInitialGameState(): GameState {
  return {
    phase: "PLAYING",
    currentRoom: "reception",
    inventory: new Set(),
    breakerOn: false,
    hasShownReceptionTutorial: false,
    hidingState: { active: false, spotId: null, kind: null },
  };
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
}
