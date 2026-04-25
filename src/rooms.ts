import { Container } from "pixi.js";
import { Room } from "./room";
import { RoomId, RoomDefinition, DoorConfig } from "./types";

// Room dimensions from atlas.json:
// reception: 2896 x 1086
// cubicles:  3344 x 941
// server:    3344 x 941
// stairwell: 3344 x 941

export const ROOM_DEFINITIONS: Record<RoomId, RoomDefinition> = {
  reception: {
    id: "reception",
    background: "reception",
    hasMonster: false,
    monsterSpawn: 0,
    monsterPatrolPath: [0, 0],
    playerSpawnFromLeft: 200,
    playerSpawnFromRight: 2750,
    pickups: [],
    doors: [
      {
        fromRoom: "reception",
        toRoom: "cubicles",
        fromX: 2796,
        toX: 150,
        requirement: "press_e",
      },
    ],
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
    ],
    doors: [
      {
        fromRoom: "cubicles",
        toRoom: "reception",
        fromX: 100,
        toX: 2700,
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
        x: 2600,
        y: -100,
        frame: "breaker-off",
        pickupRange: 100,
        togglesTo: "breaker-on",
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
  },

  stairwell: {
    id: "stairwell",
    background: "stairwell",
    hasMonster: true,
    monsterSpawn: 2000,
    monsterPatrolPath: [600, 2800],
    playerSpawnFromLeft: 150,
    playerSpawnFromRight: 3194,
    pickups: [],
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

  destroy(): void {
    this.world.removeChild(this.currentRoom);
    this.currentRoom.destroy({ children: true });
  }
}
