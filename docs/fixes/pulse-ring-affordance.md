# PulseRing Visual Affordance. Hotfix U.3.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 533.68 kB (153.92 kB gz) / 536.12 kB (154.57 kB gz)
Delta: +2.44 kB (+0.65 kB gz)
Friction addressed: F1 (HIGH), F3 (HIGH)

## 1. What was added

A reusable PulseRing class (src/pulse-ring.ts, 76 lines) renders a
softly pulsing circle behind interactable props using Pixi 8 Graphics.
The circle expands and contracts via a sine wave, with configurable
color, radius, period, alpha range, and stroke width. Three instances
are wired in game.ts:

- Breaker (Server x=2700, warm tan, 2.2s period, until breakerOn)
- Trapdoor (Archives x=1500, pale green-teal, 2.4s period, until
  whisperTrapUnlocked)
- Workbench (Reception x=1500, amber, 1.8s period, while unreconstructed
  tapes exist in inventory)

Each pulse lives in the world container at zIndex 19 (behind dripSprite
at 20, behind player at 50). Pulses are created on room entry when the
prop's condition is met, destroyed on room exit, death, and puzzle
completion.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/pulse-ring.ts | 76 | 0 | 0 (new file) |
| src/game.ts | 62 | 0 | 0 |

## 3. Diff summary

### src/pulse-ring.ts (new file)

Self-contained module exporting PulseRingOptions (interface) and
PulseRing (class). Constructor takes a parent Container, world
coordinates, and visual tuning parameters. The render() method is
called each frame via update(deltaMs): it clears the Graphics, draws
a circle at the current sine-wave phase, and strokes it with the
interpolated alpha and radius. setActive(boolean) toggles visibility
and resets the animation phase. destroy() removes the Graphics from
its parent and releases it.

Pixi 8 Graphics API used: graphics.circle(0, 0, radius) followed by
graphics.stroke({ width, color, alpha }). No legacy lineStyle calls.

### src/game.ts

New import: PulseRing from "./pulse-ring" (line 71).

Three new fields: breakerPulse, trapdoorPulse, workbenchPulse (lines
212-214). All nullable, initialized to null.

Three new private methods (lines 845-896):
- shouldShowWorkbenchPulse(): iterates brokenTapesCollected, returns
  true if any tape has not yet been reconstructed.
- createPulseRings(): destroys existing pulses, then conditionally
  creates new ones based on currentRoom and game state.
- destroyPulseRings(): destroys and nulls all three pulse fields.

Per-frame update (lines 556-558): three optional-chain update calls
after the guidance arrow update.

Room lifecycle hooks:
- start() line 318: createPulseRings (initial reception room setup)
- transitionToRoom() line 1383: createPulseRings (after room props)
- destroyRoomContents() line 1496: destroyPulseRings
- triggerDeath() line 1601: destroyPulseRings

Puzzle result handlers:
- handleBreakerResult success (lines 3187-3188): destroy breakerPulse
- handleWhisperResult success (lines 3250-3251): destroy trapdoorPulse
- handleTapeResult success (lines 3376-3377): toggle workbenchPulse
  via shouldShowWorkbenchPulse

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.65s
- Static walk-through: pass

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Multiple pulses across rooms | Only one room's world visible at a time. At most one pulse rendered. |
| E2 | Stale breakerOn on room init | Room init runs after state restoration. Guard reads current state. |
| E3 | Solve breaker, re-enter server | breakerOn = true. createPulseRings skips breaker. No pulse. |
| E4 | Solve trapdoor, re-enter archives | whisperTrapUnlocked = true. No pulse. |
| E5 | Pick up tape in cubicles | workbenchPulse is null (not in reception). Created on next reception entry. |
| E6 | Reconstruct all 3 tapes | shouldShowWorkbenchPulse returns false. Pulse hides via setActive. |
| E7 | zIndex 19 under player (50) | Player walks in front of the ring. Correct. |
| E8 | Performance: clear+circle per frame | One geometry rebuild per visible pulse per frame. Negligible. |
| E9 | Ring extends beyond room | Max radius 75+6=81 px. Room width 2044+. No clipping. |
| E10 | Player occludes ring | zIndex 19 < 50. Ring behind player sprite. |
| E11 | Subtlety on dark backgrounds | minAlpha 0.3, maxAlpha 0.7. Tune in playtest if needed. |
| E12 | Double destroy | Fields set to null after destroy. No double call. |
| E13 | HMR leak in dev | Acceptable. Production unaffected. |
| E14 | Missed cleanup | destroyPulseRings called in destroyRoomContents, triggerDeath, and createPulseRings. |
| E15 | DYING phase pulse visible | destroyPulseRings called in triggerDeath before cinematic. |
| E16 | Pixi 8 stroke API | graphics.stroke({ width, color, alpha }) used. No legacy lineStyle. |
| E17 | alpha = 1 rendering | maxAlpha capped at 0.7. No risk. |

## 5. Trade-offs

Pulses freeze during PAUSED (ticker stopped). The puzzle overlay covers
the prop area, so the static ring is not visible in practice.

Default alpha range (0.3 to 0.7) may be too subtle on the darkest room
backgrounds (stairwell, archives). The values are tunable per instance.
Raising minAlpha to 0.4 is a safe first adjustment if playtesters miss
the pulse.

The geometric ring beside hand-drawn sprites creates a slight style
mismatch. A hand-drawn "glow" sprite would be more cohesive but requires
atlas slots. The Graphics approach costs zero assets and ships now.

The pulse ring Y positions are hardcoded offsets from floorY. If room
layouts change, the pulse positions need manual adjustment. A more robust
approach would read the prop's actual Y from the sprite, but the current
props are static.

## 6. Manual playtest steps

1. Start a new run. Spawn in reception. Confirm no pulse visible (no
   broken tapes yet, breaker/trapdoor in other rooms).
2. Walk to server room. Confirm warm tan pulse visible around breaker
   switch at x=2700.
3. Solve the breaker puzzle. Confirm pulse disappears immediately.
4. Re-enter server. Confirm no pulse (breakerOn is true).
5. Walk to archives. Confirm pale green pulse visible around trapdoor
   at x=1500.
6. Solve the whisper puzzle. Confirm pulse disappears. Trapdoor sprite
   changes to vents:open.
7. Re-enter archives. Confirm no pulse (whisperTrapUnlocked is true).
8. Pick up broken_tape_01 in cubicles. Walk to reception.
   Confirm amber pulse visible around workbench at x=1500.
9. Reconstruct tape_01 at workbench. If unreconstructed tapes remain
   in inventory, confirm pulse persists. If none remain, confirm pulse
   disappears.
10. Pick up remaining tapes. Return to reception. Reconstruct all.
    Confirm pulse disappears after the last reconstruction.
11. Die. Confirm all pulses destroyed during death cinematic.
12. Respawn. Walk to server. Confirm breaker pulse does NOT return
    (breakerOn persists).

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] No new TS errors or warnings.
- [x] All 17 edge cases walked.
- [x] PulseRing class is reusable (no per-prop coupling).
- [x] Conditional logic (workbench predicate) is correct.
- [x] Cleanup paths handle room change, death, restart.
- [x] Pixi 8 Graphics API used correctly (stroke, not lineStyle).
