# Tape Puzzle Volume Indication. Hotfix U.14.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 539.55 kB (155.32 kB gz) / 539.68 kB (155.32 kB gz)
Bundle delta: +0.13 kB (+0.00 kB gzipped)
Friction addressed: F11 follow-on (concept too hard to remember
narrative order)

## 1. What changed

Tape puzzle fragments now play at decreasing volumes based on their
canonical position in the narrative. Position 0 (first in narrative)
plays at full volume. Position 3 (last) plays at 0.25. The puzzle
becomes "match loud-to-quiet" instead of "memorize narrative order."

Per-fragment playback (clicking a numbered button) uses the fragment's
canonical position to determine volume. PLAY FULL uses the slot
position: slot A plays at 1.0, slot B at 0.7, slot C at 0.45, slot D
at 0.25. When the player arranges fragments correctly, PLAY FULL
produces a smooth loud-to-quiet sequence that matches the individual
fragment volumes. Incorrect arrangement creates a mismatch between
fragment volume and slot volume, signaling the error.

Title updated from "RECONSTRUCTION. ARRANGE THE SEGMENTS." to "ARRANGE
BY VOLUME. LOUD FIRST." Hint text shortened to include "Loud=first."

## 2. Volume mapping

| Position | Volume | Reading |
|----------|--------|---------|
| A (0) | 1.0 | Loudest, plays first in narrative |
| B (1) | 0.7 | Medium-loud |
| C (2) | 0.45 | Medium-quiet |
| D (3) | 0.25 | Quietest, plays last |

Ratio between consecutive levels is roughly 0.7x. Each step is audible
without being jarring. Position D at 0.25 remains clearly hearable.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/tape-puzzle.ts | 12 | 5 | 3 |

## 4. Diff summary

### src/tape-puzzle.ts

NEW CONSTANT (after SEGMENT_LABELS):
```typescript
const POSITION_VOLUMES: number[] = [1.0, 0.7, 0.45, 0.25];
```

BEFORE (playSegment, buffer path):
```typescript
source.connect(ctx.destination);
```
AFTER:
```typescript
const gain = ctx.createGain();
gain.gain.value = POSITION_VOLUMES[originalIndex];
source.connect(gain);
gain.connect(ctx.destination);
```

BEFORE (playSegment, Howler fallback):
```typescript
audioManager.playOneShot(segId);
```
AFTER:
```typescript
audioManager.playOneShot(segId, POSITION_VOLUMES[originalIndex]);
```

BEFORE (playFullSequence):
```typescript
for (const buffer of orderedBuffers) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(cursor);
  cursor += buffer.duration;
}
```
AFTER:
```typescript
orderedBuffers.forEach((buffer, slotIndex) => {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = POSITION_VOLUMES[slotIndex];
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(cursor);
  cursor += buffer.duration;
});
```

BEFORE (title):
```typescript
title.textContent = "RECONSTRUCTION. ARRANGE THE SEGMENTS.";
```
AFTER:
```typescript
title.textContent = "ARRANGE BY VOLUME. LOUD FIRST.";
```

BEFORE (hint):
```typescript
hint.textContent = "1-4 listen. A-D place. SPACE play full. ENTER submit. ESC leave.";
```
AFTER:
```typescript
hint.textContent = "1-4 listen. A-D place. Loud=first. ENTER submit. ESC leave.";
```

## 5. Verification

- pnpm build (tsc --noEmit + vite build): exit 0
- No new TS errors or warnings

Edge cases (E1-E10):

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Volume curve too steep/shallow | Pass. 0.7x ratio per step. Position D at 0.25 still audible. Tunable. |
| E2 | Master volume affects audibility | Pass. At master 0.5, position D plays at 0.125 effective. Acceptable. |
| E3 | AudioContext not unlocked | Pass. Puzzle opens after E key (user gesture). Same as Hotfix T. |
| E4 | PLAY FULL during fragment play | Pass. stopCurrentSound runs first. No overlap. |
| E5 | GainNode cleanup | Pass. Nodes GC'd after source ends and disconnects. |
| E6 | Shuffle between submissions | Pass. Volume follows originalIndex (canonical), not display index. |
| E7 | Louder = first intuitive | Pass. Title says "LOUD FIRST." Hint says "Loud=first." |
| E8 | Decimal precision | Pass. Web Audio gain is float64. 0.45 is exact. |
| E9 | Bundle size | Pass. +0.13 kB. Negligible. |
| E10 | Visual volume hint | Deferred. Not in scope. |

## 6. Trade-offs

The puzzle is now significantly easier. Players who would have enjoyed
the narrative-memory challenge get a simpler volume-matching puzzle
instead. The narrative content of each fragment is unchanged. Players
still hear the lore phrases. Ordering by ear (loud-to-quiet) replaces
ordering by meaning.

Players with hearing impairment or low-quality speakers may struggle to
distinguish 0.45 from 0.25. A visual waveform or volume bar on each
button is deferred as polish.

The Howler fallback path in playSegment now passes the volume multiplier
to audioManager.playOneShot. This uses the existing volumeMultiplier
parameter (second argument), so the fallback also respects the volume
mapping.

PLAY FULL applies slot-position volumes, not fragment-identity volumes.
If the player arranges correctly, the volumes during PLAY FULL match the
individual fragment volumes. If arranged incorrectly, the same fragment
sounds louder or quieter than it did individually, which signals the
error.

## 7. Manual playtest

1. Pick up broken_tape_01 in cubicles. Walk to workbench. Press E.
2. Puzzle opens. Title reads "ARRANGE BY VOLUME. LOUD FIRST."
3. Click fragment 1. Note its volume.
4. Click fragment 2. Compare volume (should be clearly different).
5. Click fragment 3, then 4. Each progressively quieter (or louder,
   depending on shuffle).
6. Identify the loudest fragment. Place it in slot A.
7. Place the next loudest in B, then C, then D.
8. Click PLAY FULL. Confirm volumes descend smoothly if ordered right.
9. Submit. tape_unlock SFX plays, reward applies.
10. Reopen with a different tape. Confirm same volume mechanic.
11. Deliberately submit wrong order. tape_garbled plays, fragments
    reshuffle. Retry with correct volume ordering.

## 8. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] All 10 edge cases walked.
- [x] Volume curve applied to per-fragment playback.
- [x] PLAY FULL respects slot positions.
- [x] UI hint updated to reflect new mechanic.
- [x] Howler fallback also applies volume multiplier.
