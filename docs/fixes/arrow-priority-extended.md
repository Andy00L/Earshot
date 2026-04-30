# Guidance Arrow Extended Priority. Hotfix U.1.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 532.75 kB (153.59 kB gz) / 533.68 kB (153.92 kB gz)
Delta: +0.93 kB (+0.33 kB gz)
Friction addressed: F2 (HIGH)

## 1. What changed

The guidance arrow previously vanished the moment the player picked up
the map_fragment in Archives. After that, no navigation aid existed for
the three broken tape pickups, the tape reconstruction station in
Reception, the whisper trapdoor in Archives, or the stairwell exit. The
arrow's priority chain now extends past map_fragment acquisition with
four new target types (broken_tape, tape_station, whisper_trap, exit).
The arrow never goes silent until the WIN phase.

The room routing function (getDoorXTowardRoom) gained multi-hop support
for rooms not directly connected to the reception hub: server, stairwell,
and the reception-to-stairwell path. Previously, the arrow would hide
when the routing returned null for non-adjacent rooms. All 20 possible
room pairs now resolve to a valid first-step door.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/guidance-arrow.ts | 73 | 0 | 1 (import line) |
| src/game.ts | 15 | 15 | 3 |

## 3. Diff summary

### src/guidance-arrow.ts

BEFORE: 82 lines. The file contained only the GuidanceArrow rendering
class (show, hide, setDirection, update, destroy). No game logic. No
imports from types.ts.

AFTER: 157 lines. New import of GameState, RoomId, TapeId from types.ts.
New exports: ArrowTargetType (7-member string union), ArrowTarget
(interface with type, room, x), and getArrowTarget (pure function
accepting GameState, returning ArrowTarget or null). Internal helper
getNextBrokenTape selects the nearest uncollected tape by preferring the
player's current room. Location constants for broken tapes, tape station,
whisper trap, and exit are defined at module scope.

The getArrowTarget priority chain:

```
1. keycard not in inventory       -> cubicles x=1600
2. breaker off                    -> server x=2600
3. map_fragment not acquired      -> archives x=2000
4. uncollected broken tape exists -> nearest tape location
5. collected > reconstructed      -> reception x=1500 (workbench)
6. whisper trap unsolved AND
   player is in archives          -> archives x=1500 (trapdoor)
7. fallback                       -> stairwell x=3194 (exit)
```

Steps 1-3 preserve the original behavior exactly. Steps 4-7 are new.

### src/game.ts

BEFORE: The private getArrowTarget method (10 lines) returned null when
hasMapFragment was true. getDoorXTowardRoom handled direct neighbors and
one-hop hub routing. computeArrowTargetX used the old method's return
shape (roomId, itemX).

AFTER: The private getArrowTarget method is removed. computeArrowTargetX
calls the imported getArrowTarget(this.state) and uses the new field
names (room, x). getDoorXTowardRoom gains a multi-hop section that
handles three cases: reception to stairwell (via server), server to
reception or archives (via cubicles), and stairwell to any non-server
room (via server).

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.40s
- Static walk-through: pass (see below)
- Edge cases E1-E17: all pass

Static walk-through scenario:

1. Spawn in reception. Arrow points right toward cubicles door (x=500).
2. Enter cubicles. Arrow points to keycard (x=1600). Same as before.
3. Pick up keycard. Arrow points to breaker (server x=2600). Same as before.
4. Enter server. Arrow points to breaker (x=2600). Same as before.
5. Solve breaker. Arrow points to map_fragment (archives x=2000). Same as before.
6. Pick up map_fragment. PREVIOUSLY: arrow vanished. NOW: arrow points
   to the nearest uncollected broken tape. If player is in archives, the
   arrow points toward the reception door (x=200), routing toward the
   nearest tape.
7. Player collects broken_tape_01 (cubicles x=2100). Arrow updates to
   the next uncollected tape.
8. Player collects all 3 tapes. Arrow points to tape_station (reception
   x=1500).
9. Player reconstructs all 3 tapes. Arrow points to exit (stairwell
   x=3194).
10. If player wanders into archives at any point after step 8 with the
    whisper trap still sealed, arrow temporarily points to the trapdoor
    (x=1500). On leaving archives or solving the trap, arrow reverts to
    the next priority.
11. Player reaches stairwell exit. Phase changes to WIN. Arrow hides.

Edge case table:

| # | Case | Result |
|---|------|--------|
| E1 | Keycard via vent shortcut | Arrow updates to breaker. No issue. |
| E2 | Tape in inventory, uncollected tape in same room | Arrow prefers current room. Correct. |
| E3 | All tapes collected, 1 reconstructed | Arrow stays on tape station. Correct. |
| E4 | All tapes done, never visited archives | Arrow points to exit. Enters archives: points to trap. |
| E5 | Charm not used | Not an arrow target. No effect. |
| E6 | All done, player at exit | Arrow points to x=3194. Same room. |
| E7 | Death and respawn | State resets. tapesReconstructed persists. Arrow skips reconstructed tapes. |
| E8 | Save/load | No save persistence. N/A. |
| E9 | Tape in different room | getNextBrokenTape defaults to array order. |
| E10 | All done, back in archives | Whisper trap if unsolved, exit otherwise. |
| E11 | Server upper floor for tape_02 | Arrow points to x=1100. Horizontal only. |
| E12 | Target changes mid-frame | Computed per frame. Clean transition. |
| E13 | PAUSED hides arrow | Phase check at line 803. Arrow hidden. |
| E14 | Circular import | guidance-arrow.ts imports from types.ts only. Safe. |
| E15 | getArrowTarget called outside render | Pure function. No side effects. |
| E16 | Player in target room | getDoorXTowardRoom returns null. Arrow points to target x. |
| E17 | Invalid room id | TypeScript enforces RoomId union at compile time. |

## 5. Trade-offs

The arrow now never goes silent until WIN. Players who want to explore
freely can ignore it. The arrow does not lock out any action, it only
suggests direction.

The whisper trap arrow is gated on currentRoom === "archives". This
prevents the arrow from luring players across the map toward optional
content. A player who never enters Archives will never see the arrow
point to the trapdoor. Tunable by removing the room gate if the trap
should be signposted globally.

Broken tape collection order defaults to array order (01, 02, 03) when
no tape is in the current room. This means cubicles is prioritized
over server and stairwell. In practice, the current-room preference
overrides this whenever the player is near an uncollected tape.

The getDoorXTowardRoom multi-hop routing is specific to the current
5-room topology. Adding a new room would require updating the three
routing conditions. A BFS approach would be more general but adds
allocation per frame for a 5-node graph.

## 6. Manual playtest steps

1. Start a new run. Confirm arrow points to cubicles door from reception.
2. Pick up keycard. Confirm arrow switches to breaker (server direction).
3. Solve breaker. Confirm arrow switches to map_fragment (archives).
4. Pick up map_fragment. Confirm arrow does NOT vanish. Should point
   toward the nearest broken tape.
5. From archives, confirm arrow points to reception door (x=200), since
   the nearest tape is in cubicles or server.
6. Collect all 3 broken tapes. Confirm arrow points to reception
   workbench (x=1500).
7. Reconstruct one tape. Confirm arrow still points to workbench.
8. Reconstruct all 3. Confirm arrow points toward stairwell exit.
9. Walk into archives. Confirm arrow points to whisper trapdoor (x=1500)
   if unsolved.
10. Solve whisper trap. Confirm arrow points to exit.
11. Navigate to stairwell exit. Confirm arrow points to x=3194.
12. Exit. Confirm arrow vanishes on WIN phase.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] No new TS errors or warnings.
- [x] All 17 edge cases walked.
- [x] Existing critical path (keycard, breaker, map_fragment) unchanged.
- [x] Arrow visible during PLAYING when target is non-null.
- [x] Arrow hidden during PAUSED, INTRO, hidingState.
