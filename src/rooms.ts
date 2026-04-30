import { Container } from "pixi.js";
import { Room } from "./room";
import { RoomId, RoomDefinition, DoorConfig, VentDef, JumperHotspot } from "./types";

// Room dimensions from atlas.json:
// reception: 2896 x 1086
// cubicles:  3344 x 941
// server:    3344 x 941
// stairwell: 3344 x 941
// archives:  2044 x 769

export const ROOM_DEFINITIONS: Record<RoomId, RoomDefinition> = {
  reception: {
    id: "reception",
    background: "reception",
    hasMonster: false,
    monsterSpawn: 0,
    monsterPatrolPath: [0, 0],
    playerSpawnFromLeft: 200,
    playerSpawnFromRight: 2750,
    pickups: [
      {
        id: "tape_01",
        room: "reception",
        x: 2400,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
    ],
    doors: [
      {
        fromRoom: "reception",
        toRoom: "cubicles",
        fromX: 500,
        toX: 150,
        requirement: "press_e",
      },
      {
        fromRoom: "reception",
        toRoom: "server",
        fromX: 1800,
        toX: 1672,
        requirement: "press_e",
      },
      {
        fromRoom: "reception",
        toRoom: "archives",
        fromX: 2700,
        toX: 200,
        requirement: "press_e",
      },
    ],
    hidingSpots: [],
    decorativeProps: [
      {
        id: "exit_sign_recep",
        frameName: "exit-sign",
        x: 2200,
        y: 350,
        scale: 0.6,
      },
      {
        id: "flickerlight_recep",
        frameName: "flickerlight",
        x: 200,
        y: 350,
        scale: 0.7,
        flickerAnimation: true,
      },
      {
        id: "workbench_recep",
        frameName: "workbench:bench",
        x: 1500,
        y: 999,
        scale: 0.4,
      },
    ],
    workbench: { x: 1500, triggerWidth: 100 },
  },

  cubicles: {
    id: "cubicles",
    background: "cubicles",
    hasMonster: true,
    monsterSpawn: 2200,
    monsterPatrolPath: [600, 2800],
    playerSpawnFromLeft: 150,
    playerSpawnFromRight: 3194,
    pickups: [
      {
        id: "keycard",
        room: "cubicles",
        x: 1600,
        y: 0,
        frame: "keycard",
        pickupRange: 100,
      },
      {
        id: "tape_02",
        room: "cubicles",
        x: 2300,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
      {
        id: "broken_tape_01",
        room: "cubicles",
        x: 2100,
        y: -10,
        frame: "puzzle-props:broken_tape",
        pickupRange: 100,
        scale: 0.08,
      },
    ],
    doors: [
      {
        fromRoom: "cubicles",
        toRoom: "reception",
        fromX: 100,
        toX: 500,
        requirement: "press_e",
      },
      {
        fromRoom: "cubicles",
        toRoom: "server",
        fromX: 3244,
        toX: 150,
        requirement: "press_e",
      },
    ],
    hidingSpots: [
      { id: "desk_cub_1", kind: "desk", x: 1200, y: 866, triggerWidth: 100 },
      { id: "locker_cub_1", kind: "locker", x: 2050, y: 866, triggerWidth: 80 },
      { id: "desk_cub_2", kind: "desk", x: 2500, y: 866, triggerWidth: 100 },
    ],
    decorativeProps: [
      { id: "vent_cub_1", frameName: "vent", x: 600, y: 200, scale: 0.5 },
      { id: "vent_cub_2", frameName: "vent", x: 2400, y: 200, scale: 0.5 },
      { id: "exit_sign_cub", frameName: "exit-sign", x: 3300, y: 350, scale: 0.5, alpha: 0.8 },
      { id: "radio_table_cub", frameName: "radio-table", x: 1800, y: 866, scale: 0.5 },
    ],
    foregroundProps: [
      { key: "cubicle-dividers:straight", x: 500, anchorBottomY: 866 },
      { key: "cubicle-dividers:l-corner", x: 1000, anchorBottomY: 866 },
      { key: "cubicle-dividers:half-height", x: 1400, anchorBottomY: 866 },
      { key: "cubicle-dividers:straight-damaged", x: 1900, anchorBottomY: 866 },
      { key: "cubicle-dividers:gap", x: 2250, anchorBottomY: 866 },
      { key: "cubicle-dividers:l-corner-damaged", x: 2600, anchorBottomY: 866 },
      { key: "cubicle-dividers:straight", x: 3050, anchorBottomY: 866 },
    ],
    radioPickups: [
      { radioId: "radio_cub", x: 1800, y: 866, pickupRange: 100 },
    ],
    vents: [
      { x: 3050, target: "stairwell", targetX: 350 },
    ],
    jumperHotspots: [
      { x: 1500, ventY: 100, ventPosition: "ceiling" },
      { x: 550, ventY: 100, ventPosition: "floor" },
      { x: 2700, ventY: 100, ventPosition: "floor" },
    ],
  },

  server: {
    id: "server",
    background: "server",
    hasMonster: true,
    monsterSpawn: 1800,
    monsterPatrolPath: [600, 2800],
    playerSpawnFromLeft: 150,
    playerSpawnFromRight: 3194,
    pickups: [
      {
        id: "breaker_switch",
        room: "server",
        x: 2700,
        y: -100,
        frame: "breaker-off",
        pickupRange: 100,
        togglesTo: "breaker-on",
      },
      {
        id: "tape_03",
        room: "server",
        x: 400,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
      {
        id: "broken_tape_02",
        room: "server",
        x: 1100,
        y: -10,
        frame: "puzzle-props:broken_tape",
        pickupRange: 100,
        scale: 0.08,
      },
    ],
    doors: [
      {
        fromRoom: "server",
        toRoom: "cubicles",
        fromX: 100,
        toX: 3194,
        requirement: "press_e",
      },
      {
        fromRoom: "server",
        toRoom: "stairwell",
        fromX: 3244,
        toX: 150,
        requirement: "breaker_on",
        failMessage: "The door is locked. Power must be on.",
      },
    ],
    hidingSpots: [
      { id: "locker_server_1", kind: "locker", x: 700, y: 866, triggerWidth: 80 },
      { id: "locker_server_2", kind: "locker", x: 2900, y: 866, triggerWidth: 80 },
    ],
    decorativeProps: [
      { id: "corpse_server", frameName: "corpse", x: 1500, y: 866, scale: 1.0 },
      { id: "flickerlight_server_1", frameName: "flickerlight", x: 800, y: 250, scale: 0.6, flickerAnimation: true },
      { id: "vent_server", frameName: "vent", x: 2700, y: 200, scale: 0.5 },
      { id: "radio_table_server", frameName: "radio-table", x: 2200, y: 866, scale: 0.5 },
    ],
    radioPickups: [
      { radioId: "radio_server", x: 2200, y: 866, pickupRange: 100 },
    ],
    jumperHotspots: [
      { x: 1800, ventY: 100, floorLevel: "upper", ventPosition: "ceiling" },
      { x: 950, ventY: 100, ventPosition: "ceiling" },
      { x: 2450, ventY: 100, ventPosition: "floor" },
    ],
    // Upper floor (two-story Server room)
    upperBg: "server-upper",
    upperFloorY: 486,
    upperFloorXMin: 800,
    upperFloorXMax: 2900,
    ladders: [
      { x: 1400, bottomY: 866, topY: 486, triggerWidth: 60 },
    ],
  },

  stairwell: {
    id: "stairwell",
    background: "stairwell",
    hasMonster: true,
    monsterSpawn: 2000,
    monsterPatrolPath: [600, 2800],
    playerSpawnFromLeft: 150,
    playerSpawnFromRight: 3194,
    pickups: [
      {
        id: "broken_tape_03",
        room: "stairwell",
        x: 1900,
        y: -10,
        frame: "puzzle-props:broken_tape",
        pickupRange: 100,
        scale: 0.08,
      },
      {
        id: "tape_06",
        room: "stairwell",
        x: 2400,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
    ],
    doors: [
      {
        fromRoom: "stairwell",
        toRoom: "server",
        fromX: 100,
        toX: 3194,
        requirement: "press_e",
      },
      {
        fromRoom: "stairwell",
        toRoom: "stairwell",
        fromX: 3194,
        toX: 3194,
        requirement: "keycard",
        failMessage: "The exit is locked. You need a keycard.",
        isExit: true,
      },
    ],
    hidingSpots: [
      { id: "desk_stair", kind: "desk", x: 1400, y: 866, triggerWidth: 100 },
    ],
    decorativeProps: [
      { id: "exit_sign_stairwell", frameName: "exit-sign", x: 2700, y: 350, scale: 0.7, alpha: 0.9 },
    ],
    vents: [
      { x: 350, target: "cubicles", targetX: 3050 },
    ],
    jumperHotspots: [
      { x: 1750, ventY: 100, ventPosition: "ceiling" },
      { x: 2700, ventY: 100, ventPosition: "ceiling" },
      { x: 600, ventY: 100, ventPosition: "floor" },
    ],
    whispererCanSpawn: true,
    whispererSpawnChance: 0.40,
  },

  archives: {
    id: "archives",
    background: "archives",
    hasMonster: false,
    monsterSpawn: 0,
    monsterPatrolPath: [0, 0],
    playerSpawnFromLeft: 200,
    playerSpawnFromRight: 1900,
    pickups: [
      {
        id: "map_fragment",
        room: "archives",
        x: 2000,
        y: 0,
        frame: "materials:keycard",
        pickupRange: 100,
      },
      {
        id: "tape_04",
        room: "archives",
        x: 1800,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
      {
        id: "tape_05",
        room: "archives",
        x: 500,
        y: -20,
        frame: "shade-tape:recorder",
        pickupRange: 100,
      },
    ],
    doors: [
      {
        fromRoom: "archives",
        toRoom: "reception",
        fromX: 200,
        toX: 2700,
        requirement: "press_e",
      },
    ],
    hidingSpots: [
      { id: "desk_arch_1", kind: "desk", x: 1700, y: 708, triggerWidth: 80 },
    ],
    decorativeProps: [],
    beaconDrainMultiplier: 1.5,
    whispererCanSpawn: true,
  },
};

export class RoomManager {
  public currentRoom: Room;
  public currentDef: RoomDefinition;
  private world: Container;

  constructor(world: Container, initialRoomId: RoomId) {
    this.world = world;
    this.currentDef = ROOM_DEFINITIONS[initialRoomId];
    this.currentRoom = new Room(this.currentDef.background);
    this.world.addChild(this.currentRoom);
  }

  swapRoom(roomId: RoomId): void {
    this.world.removeChild(this.currentRoom);
    this.currentRoom.destroy({ children: true });

    this.currentDef = ROOM_DEFINITIONS[roomId];
    this.currentRoom = new Room(this.currentDef.background);
    this.world.addChildAt(this.currentRoom, 0);
  }

  getNearbyDoor(playerX: number): DoorConfig | null {
    const DOOR_RANGE = 100;
    let closest: DoorConfig | null = null;
    let closestDist = Infinity;

    for (const door of this.currentDef.doors) {
      const dist = Math.abs(playerX - door.fromX);
      if (dist <= DOOR_RANGE && dist < closestDist) {
        closest = door;
        closestDist = dist;
      }
    }

    return closest;
  }

  getNearbyVent(playerX: number): VentDef | null {
    const VENT_RANGE = 80;
    const vents = this.currentDef.vents;
    if (!vents) return null;

    let closest: VentDef | null = null;
    let closestDist = Infinity;

    for (const vent of vents) {
      const dist = Math.abs(playerX - vent.x);
      if (dist <= VENT_RANGE && dist < closestDist) {
        closest = vent;
        closestDist = dist;
      }
    }

    return closest;
  }

  destroy(): void {
    this.world.removeChild(this.currentRoom);
    this.currentRoom.destroy({ children: true });
  }
}
