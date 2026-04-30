# Workbench Affordance. Hotfix U.5.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: 0 (no code changes)
Friction addressed: F3 (HIGH), verification pass
Sprite path: B (no overlay, props:tape_recorder absent from atlas)
Audio: skipped (workbench_tape_loop.mp3 not generated)

## 1. What changed

No code changes. This hotfix verified that the workbench affordance
from Hotfix U.3 (PulseRing) is correctly configured and that the
visibility predicate is unified with the intended behavior.

The two additional affordance layers described in the spec (tape
recorder overlay sprite, mechanical reel-tape audio loop) require
assets that do not yet exist. The custom sprite props:tape_recorder
is absent from atlas.json. The audio file workbench_tape_loop.mp3 has
not been generated via the ElevenLabs Sound Effects API. Both are
deferred until those assets are created.

The existing affordance stack for the workbench after Hotfixes U.2
through U.4:

1. PulseRing (U.3): amber pulse at x=1500 in Reception, visible when
   unreconstructed broken tapes exist in inventory.
2. Prompt copy (U.2): "E REBUILD" prompt at close range when broken
   tapes are available. Hidden when none available.
3. Guidance arrow (U.1): points to the workbench when all broken tapes
   are collected but not yet reconstructed.

These three layers provide functional affordance for F3. The sprite
overlay and audio loop would add further discoverability but are not
blocking.

## 2. Predicate verification

The workbench visibility predicate in Hotfix U.3
(shouldShowWorkbenchPulse, game.ts:850-855) iterates
brokenTapesCollected and returns true if any tape is not yet in
tapesReconstructed. This matches the E5 decision (Option B): hide
after all tapes are done.

The predicate chain:

```
Player has no broken tapes -> false (no pulse, no prompt)
Player has 1+ broken tapes, 0 reconstructed -> true
Player has 1+ broken tapes, some reconstructed -> true (unreconstructed remain)
All 3 reconstructed -> false (brokenTapesCollected is empty after delete on success)
```

This is consistent across U.3 (pulse), U.2 (prompt), and U.1 (arrow
priority B). No unification change was needed.

## 3. Files changed

None.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0
- Bundle: 536.90 kB (154.73 kB gz), unchanged from U.4

Edge case table:

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Sprite absent | Path B. PulseRing is sole visual affordance. |
| E2 | Audio file absent | Skipped. Visual affordance only. |
| E3 | Tape pickup outside Reception | Pulse created on next Reception entry. |
| E4 | Tape pickup inside Reception | Not possible. Broken tapes only in cubicles/server/stairwell. |
| E5 | All 3 tapes reconstructed | Predicate returns false. Pulse hides. Workbench goes quiet. |
| E6 | Partial reconstruction | Predicate true while unreconstructed tapes remain. |
| E7 | Death and respawn | brokenTapesCollected resets. Predicate false until new pickup. |
| E8 | All affordance layers missing | U.2 prompt still shows at proximity. Minimum viable. |
| E9 | Multiple calls | shouldShowWorkbenchPulse is stateless, safe to call repeatedly. |
| E10 | N/A (audio not wired) | Skipped. |
| E11 | N/A (audio not wired) | Skipped. |
| E12 | zIndex collision | N/A (no overlay sprite). |
| E13 | Sprite size | N/A (no overlay sprite). |
| E14 | N/A (audio not wired) | Skipped. |
| E15 | Bundle size | Zero delta. |

## 5. Trade-offs

Path B with audio skipped means the workbench relies on the PulseRing
(U.3) and the prompt copy (U.2) for all affordance. No medium-distance
audio cue exists. The player must visually notice the pulse ring or
walk close enough for the text prompt. In the worst case (player
sprinting through Reception), they may miss both signals. The guidance
arrow (U.1) compensates by pointing to the workbench when tapes are
collected but not yet reconstructed.

When the tape recorder sprite and audio file are available, the
additional layers can be wired without predicate changes. The existing
shouldShowWorkbenchPulse predicate (game.ts:850) serves as the unified
condition for all workbench affordance systems.

## 6. Asset generation steps (deferred)

When ready to add the additional layers:

1. Generate or add props:tape_recorder to atlas.json via the slicer
   pipeline. Re-run this hotfix's Phase 1.1 for the overlay sprite.

2. Generate workbench_tape_loop.mp3:
   ```
   npx tsx scripts/generate-audio.ts --only workbench_tape_loop
   ```
   Prompt: "Quiet vintage cassette tape mechanism, gentle reels turning,
   soft electrical hum, looping, mono, 4 seconds."

3. Add the catalog entry to src/audio-catalog.ts under TAPE STATION:
   ```
   workbench_tape_loop: {
     id: "workbench_tape_loop",
     category: "sfx",
     prompt: "...",
     durationSec: 4.0,
     loop: true,
     volume: 0.10,
   },
   ```

4. Wire the audio loop in game.ts using the same pattern as
   Hotfix U.4's whisper trap ambient (startWhisperTrapAmbient,
   stopWhisperTrapAmbient, updateWhisperTrapAmbient), adapted for
   the workbench position and the shouldShowWorkbenchPulse predicate.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Path B documented.
- [x] Audio skipped documented.
- [x] All 15 edge cases walked (applicable ones verified, N/A noted).
- [x] Predicate unified with U.3 PulseRing (already correct).
- [x] Asset generation steps documented for future use.
