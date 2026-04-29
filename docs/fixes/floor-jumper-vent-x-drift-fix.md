# Floor Jumper Vent X-Drift Fix. Hotfix K.

Commit at start: 56035dfbf95f70681b1082474d3c1967c58c1791
Branch: main
Base: docs/fixes/floor-jumper-visual-resize-fix.md (Hotfix J)
Build before / after: exit 0 / exit 0
Bundle size before / after gzipped: 145.45 KB / 145.48 KB (+0.03 KB)

## 1. Bug

The floor jumper vent renders at `hotspot.x` when first created. After a full attack cycle (dormant -> emerging -> getting_up -> crawling -> attacking -> retreating -> dormant), `container.x` has drifted by up to 216 px (1200ms crawling at 180 px/s). Subsequent dormant frames render at the drifted position. The user sees the vent shifted to the right after what appears to be a fake_attacking sequence, but the actual drift occurred during a prior crawling state.

The drift is invisible during retreating (alpha fades to 0) and dormant (alpha stays 0 until proximity). It becomes visible only when the player re-approaches and the dormant state sets alpha=1, or when the next triggered state (peeking, fake_attacking, or emerging) renders at the stale x.

## 2. Root cause

**Cause B (variant): crawling mutates container.x, no state ever resets it.**

`updateCrawling` at src/jumper.ts:504 is the only line in the entire codebase that writes to `this.container.x` after construction:

```typescript
// src/jumper.ts:504
this.container.x += dir * FLOOR_CRAWLING_SPEED_PX_PER_SEC * (dtMS / 1000);
```

No other state handler, no enterState branch, and no external code in game.ts writes `container.x`. The constructor sets it once at src/jumper.ts:173:

```typescript
this.container.x = hotspot.x;
```

After crawling ends (via timeout or catch), the FSM transitions to attacking, then retreating, then dormant. None of these transitions reset `container.x`. The retreating handler (src/jumper.ts:458-478) interpolates Y and alpha back to the vent but leaves x at whatever value crawling produced.

Evidence: grep for `container\.x` in jumper.ts returns exactly two write locations (lines 173 and 504). grep for `container\.position\.x` returns zero. grep for `dripSprite\.x\s*=` in game.ts returns only the two creation-time assignments (lines 2646 and 2654). grep for `hotspot\.x\s*=` across all of src/ returns zero (hotspot is immutable config from rooms.ts).

## 3. Fix

**(a) Defensive x-snap in enterState.**

Added a block in `enterState` (src/jumper.ts, before the per-state switch) that resets both `container.x` and `dripSprite.x` to `hotspot.x` whenever the floor variant enters a vent-anchored state (dormant, peeking, fake_attacking, emerging). These are the four states where the creature should be at the vent, not at the player.

The snap is scoped to `this.ventPosition === "floor"` so ceiling jumpers are unaffected. The dripSprite write is guarded by `if (this.dripSprite)` for safety (locker jumpers have no dripSprite).

There is no separate "targeted" fix because the root cause is a missing reset, not a stray write. The defensive snap IS the targeted fix: it adds the x-reset that was always needed but never existed.

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/jumper.ts | 14 | 0 | 0 |

## 5. Diff

**src/jumper.ts, inside enterState, before the switch statement:**

BEFORE:
```typescript
    this.applyFrame(this.frameIndex);

    switch (newState) {
```

AFTER:
```typescript
    this.applyFrame(this.frameIndex);

    // Defensive x-snap for floor vent-anchored states. updateCrawling
    // (line 504) is the only code that mutates container.x to chase the
    // player. No subsequent state (retreating, dormant) resets it, so
    // the vent position drifts across attack cycles. Snapping here
    // guarantees the vent returns to hotspot.x on every entry into a
    // state where the creature should be at the vent.
    if (this.ventPosition === "floor") {
      const ventAnchored =
        newState === "dormant" ||
        newState === "peeking" ||
        newState === "fake_attacking" ||
        newState === "emerging";
      if (ventAnchored) {
        this.container.x = this.hotspot.x;
        if (this.dripSprite) {
          this.dripSprite.x = this.hotspot.x;
        }
      }
    }

    switch (newState) {
```

## 6. Verification

- tsc --noEmit: exit 0, no errors
- vite build: exit 0, 496.60 KB main bundle (145.48 KB gzip)
- Static walk-through of the full attack cycle with the snap:

| Step | State | container.x | x-snap fires? | Notes |
|------|-------|-------------|---------------|-------|
| Constructor | dormant | hotspot.x | n/a | Set once at creation |
| Player approaches | dormant | hotspot.x | no (already dormant) | updateVisibility shows creature |
| Trigger (25% real) | emerging | hotspot.x | yes | Snap confirms x at vent |
| Timer expires | getting_up | (unchanged) | no | Not vent-anchored |
| Timer expires | crawling | hotspot.x + drift | no | Chase logic mutates x |
| Catch or timeout | attacking | (unchanged) | no | Creature at player |
| Timer expires | retreating | (unchanged) | no | Alpha fades, Y interps, x stays |
| Timer expires | dormant | hotspot.x | **yes** | **Fix: x resets here** |
| Player re-approaches | dormant | hotspot.x | no | Vent visible at correct position |
| Trigger (40% fake) | fake_attacking | hotspot.x | yes | Snap confirms x at vent |

- Static walk-through of the fake_attacking cycle (no prior crawling):

| Step | State | container.x | x-snap fires? |
|------|-------|-------------|---------------|
| dormant | dormant | hotspot.x | no |
| Trigger (40% fake) | fake_attacking | hotspot.x | yes (no-op, already correct) |
| Timer expires | dormant | hotspot.x | yes (no-op) |

- Edge cases:

| ID | Edge case | Status |
|----|-----------|--------|
| E1 | fake_attacking interrupted, jumps to dormant | Safe. Dormant x-snap fires. |
| E2 | Multiple floor jumpers in same room | Safe. Each uses its own this.hotspot.x. |
| E3 | Locker jumpers | Safe. ventPosition is "ceiling", snap block skipped. |
| E4 | Ceiling jumpers | Safe. Same gate. Unaffected. |
| E5 | dripSprite.x for ceiling variant | Safe. dripSprite snap inside ventPosition === "floor" block. |
| E6 | Same-value assignment cost | Negligible. Pixi treats same-value writes as no-op. |
| E7 | fake_attacking re-entered | Safe. Snap is idempotent. |
| E8 | Player respawn / room transition | Safe. Jumpers destroyed and recreated with fresh hotspot.x. |
| E9 | Hotspot.x mutated at runtime | Impossible. Grep confirms zero writes to hotspot.x in src/. |
| E10 | x snap during sprite scale.x flip | Independent. Snap sets container.x; facing flip sets sprite.scale.x. |

## 7. Trade-offs

The fix adds one `container.x` assignment and one conditional `dripSprite.x` assignment per state transition into a vent-anchored state. Four states are affected: dormant, peeking, fake_attacking, emerging. The cost is negligible (two property writes per transition, transitions happen at most every few seconds).

The snap is a guardrail. If a future feature wants the floor jumper to drift sideways during peeking (e.g., creature looking left and right inside the vent), the snap would prevent it. That feature does not exist today. If it is added, the snap should be removed for the specific state that needs lateral movement.

The retreating state does not reset container.x by design. During retreating, the creature fades out at its current position (wherever crawling left it). The visual is a fade-to-invisible at the drifted location. This looks correct because the creature is retreating from where it was, not teleporting back to the vent. The x-snap fires only on the subsequent dormant entry, which is invisible (alpha=0). By the time the creature becomes visible again (dormant proximity trigger or next state), x is already correct.

## 8. Self-check

- [x] No em dashes anywhere.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green.
- [x] No new TS errors or warnings.
- [x] Crawling behavior unchanged (updateCrawling still mutates x for player chase).
- [x] Ceiling jumper unchanged (snap gated on ventPosition === "floor").
- [x] All 10 edge cases walked.
