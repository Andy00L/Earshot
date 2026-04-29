# Floor Jumper Visual State Fix. Hotfix I-bis.

Commit at start: `56035dfbf95f70681b1082474d3c1967c58c1791`
Branch: `main`
Base diagnostic: `docs/diagnostic/floor-jumper-visual-state.md`
Build status before: exit 0, tsc clean, vite build clean
Build status after: exit 0, tsc clean, vite build clean
Bundle size before / after gzipped: 145.09 KB / 145.19 KB (+100 bytes)


## 1. Bugs fixed

**Bug 1: width inflation on getup-based states.** The `applyLockedSpriteSize` method (`src/jumper.ts:534`) applied a uniform scale `targetHeight / nativeHeight`. For `getup1` (326x118 native) clamped to height 220, scale became 1.864, inflating width to 607.7 px (2.14x the grate's 283.6 px). Fixed by adding a per-state max-width cap (`FLOOR_SPRITE_MAX_WIDTH_BY_STATE`). The method now computes both `heightScale` and `widthScale`, takes the smaller via `Math.min`. The creature scales uniformly (no horizontal squash) but the width cap prevents inflation beyond 290-380 px depending on state.

**Bug 2: fake_attacking zIndex placed creature behind grate.** The `peekingStates` array in `updateZIndexForVentStacking` (`src/jumper.ts:477`) included `"fake_attacking"`, giving it zIndex 70 while the dripSprite is 75. Removed `"fake_attacking"` from the array. The creature now gets zIndex 85 during fake_attacking, rendering in front of the grate.

**Bug 3: descent looked horrible while retreat looked fine.** Same root cause as Bug 1. Emerging uses `getup` frames (118-208 native, scaled UP to height 220, producing wild width inflation). Retreating uses `walk` frames (203-223 native, near-unity scale at clamp 200). The width cap from Bug 1 resolves this.

**Hardening: defensive container.y = floorY in updateCrawling.** The `updateCrawling` method (`src/jumper.ts:441`) never set `container.y`, relying on `getting_up` having set it. Added `this.container.y = this.floorY` at the top of the method body. One assignment per frame for crawling creatures. Pixi handles same-value writes as a no-op for transform updates.


## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/jumper.ts | 23 | 3 | 0 |

No edits to src/game.ts, src/rooms.ts, atlas.json, or any asset.


## 3. Diff summary

### 3.1 FLOOR_SPRITE_MAX_WIDTH_BY_STATE constant (added after line 85)

BEFORE:
```typescript
const CEILING_SPRITE_HEIGHT_BY_STATE: Partial<Record<JumperState, number>> = {};
```

AFTER:
```typescript
// Per-state max on-screen width for the floor variant. Caps the uniform
// scale produced by applyLockedSpriteSize so wide-but-short frames
// (e.g., getup1 at 326x118 native) do not inflate beyond the grate
// silhouette. The grate (dripSprite) is 283.6 px wide. Active-state
// limits are slightly larger to allow claws and arms to extend past
// the grate edge.
const FLOOR_SPRITE_MAX_WIDTH_BY_STATE: Partial<Record<JumperState, number>> = {
  dormant: 290,
  peeking: 290,
  fake_attacking: 320,
  emerging: 320,
  getting_up: 340,
  crawling: 360,
  attacking: 380,
  retreating: 360,
};

const CEILING_SPRITE_HEIGHT_BY_STATE: Partial<Record<JumperState, number>> = {};
```

### 3.2 peekingStates array (was line 461)

BEFORE:
```typescript
const peekingStates: JumperState[] = ["dormant", "peeking", "fake_attacking"];
```

AFTER:
```typescript
const peekingStates: JumperState[] = ["dormant", "peeking"];
```

### 3.3 updateCrawling (was line 424)

BEFORE:
```typescript
private updateCrawling(dtMS: number, playerX: number): void {
    const dx = playerX - this.container.x;
```

AFTER:
```typescript
private updateCrawling(dtMS: number, playerX: number): void {
    this.container.y = this.floorY;
    const dx = playerX - this.container.x;
```

### 3.4 applyLockedSpriteSize (was lines 518-529)

BEFORE:
```typescript
private applyLockedSpriteSize(): void {
    const map = this.ventPosition === "floor"
      ? FLOOR_SPRITE_HEIGHT_BY_STATE
      : CEILING_SPRITE_HEIGHT_BY_STATE;
    const targetHeight = map[this.state];
    if (targetHeight === undefined) {
      this.sprite.scale.set(1.0);
      return;
    }
    const scale = targetHeight / Math.max(1, this.sprite.texture.height);
    this.sprite.scale.set(scale);
  }
```

AFTER:
```typescript
private applyLockedSpriteSize(): void {
    const map = this.ventPosition === "floor"
      ? FLOOR_SPRITE_HEIGHT_BY_STATE
      : CEILING_SPRITE_HEIGHT_BY_STATE;
    const targetHeight = map[this.state];
    if (targetHeight === undefined) {
      this.sprite.scale.set(1.0);
      return;
    }

    const textureHeight = this.sprite.texture.height;
    const textureWidth = this.sprite.texture.width;
    const heightScale = targetHeight / Math.max(1, textureHeight);

    // Apply per-state max-width cap for the floor variant only.
    const maxWidth = this.ventPosition === "floor"
      ? FLOOR_SPRITE_MAX_WIDTH_BY_STATE[this.state]
      : undefined;

    const widthScale = maxWidth !== undefined
      ? maxWidth / Math.max(1, textureWidth)
      : Infinity;

    const scale = Math.min(heightScale, widthScale);
    this.sprite.scale.set(scale);
  }
```


## 4. Verification

- `npm run build`: exit 0, no errors, no warnings
- `tsc --noEmit`: exit 0, no errors
- Static walk-through (Phase 5.3 checklist):

| State | Width cap | Expected scale | Expected width | Pass? |
|-------|-----------|----------------|----------------|-------|
| dormant (idle1, 330x256, clamp 220) | 290 | heightScale=0.859, widthScale=0.879, min=0.859 | 283.6 px | Yes (unchanged) |
| peeking (idle1, 330x256, clamp 220) | 290 | same as dormant | 283.6 px | Yes |
| fake_attacking t=0 (getup1, 326x118, clamp 200) | 320 | heightScale=1.695, widthScale=0.982, min=0.982 | 320.0 px | Yes (was 552.6) |
| emerging t=0 (getup1, 326x118, clamp 220) | 320 | heightScale=1.864, widthScale=0.982, min=0.982 | 320.0 px | Yes (was 607.7) |
| getting_up (getup6, 352x198, clamp 220) | 340 | heightScale=1.111, widthScale=0.966, min=0.966 | 340.0 px | Yes (was 391.1) |
| crawling (walk6, 351x203, clamp 200) | 360 | heightScale=0.985, widthScale=1.026, min=0.985 | 345.7 px | Yes (unchanged, height governs) |
| attacking (attack1, 340x192, clamp 220) | 380 | heightScale=1.146, widthScale=1.118, min=1.118 | 380.0 px | Yes (was 389.6) |
| retreating (walk6, 351x203, clamp 200) | 360 | heightScale=0.985, widthScale=1.026, min=0.985 | 345.7 px | Yes (unchanged) |

- Edge cases (Phase 6):

| ID | Description | Status |
|----|-------------|--------|
| E1 | State not in max-width map (triggered, falling) | Safe. ventPosition guard skips map for ceiling. Floor variant never enters these states. |
| E2 | Texture width or height is 0 | Safe. Math.max(1, ...) guards division by zero in both scales. |
| E3 | Texture is null / Texture.WHITE fallback | Pre-existing. 1x1 white sprite scales to 220x220. Fails loud. Not new. |
| E4 | dripSprite uses direct width/height setters | Independent path in game.ts:2642-2643. No interaction. |
| E5 | sortableChildren on world container | Confirmed true at game.ts:231 per diagnostic 4.2. |
| E6 | Re-entry into same state | applyLockedSpriteSize runs per frame. Same-value scale.set is a Pixi no-op. No accumulation. |
| E7 | State transition mid-frame | applyLockedSpriteSize runs once per render with new state. No half-applied scale. |
| E8 | Frame swap during animation | applyLockedSpriteSize recomputes both scales against new frame natives. Smooth transitions. |
| E9 | Four floor jumpers in different rooms | Each has its own floorY. Fix does not touch floorY. Safe. |
| E10 | Hide animation interaction | Hide uses separate applyVisualScale path (DAY4_HIDING_AND_PROPS.md). No collision. |
| E11 | Player respawn / room change | Jumper.destroy is unchanged. dripSprite cleanup via game.ts. Out of scope. |
| E12 | Ceiling jumper unaffected | Width cap gated on ventPosition === "floor". Ceiling jumpers use CEILING_SPRITE_HEIGHT_BY_STATE (empty), so applyLockedSpriteSize returns at the undefined check. Never reaches width logic. |
| E13 | Locker jumper | Created with ventPosition "ceiling" (hotspot has no ventPosition field, defaults via `?? "ceiling"` at src/jumper.ts:126). applyLockedSpriteSize uses CEILING_SPRITE_HEIGHT_BY_STATE (empty), returns early. Width cap never consulted. Safe. |
| E14 | Width cap below height-derived width | Verified for idle1: heightScale=0.859, widthScale=290/330=0.879. min=0.859. Width=283.6 px. Same as before. |
| E15 | Audio cue timing for fake_attacking | Phase 1 only changes zIndex. enterState audio (jumper_vent_creak + jumper_fakeout_hiss) untouched. No regression. |


## 5. Trade-offs and limits

The width cap preserves aspect ratio via uniform scale-down. There is no horizontal squashing. For getup1 (326x118), the creature appears prone and slightly smaller than the height target (rendered height = 118 * 0.982 = 115.8 px instead of 220 px). This is closer to the natural proportions of the source frame.

The cap values (290 to 380 by state) are derived from arithmetic against the grate width (283.6 px) and frame natives, not measured against pixel-perfect mockups. Tuning may be needed after a manual playtest.

The ceiling variant is untouched. If the ceiling jumper has a similar width-blow-out at any frame, that bug remains. Out of scope per the diagnostic.

The crawling direction flip (`sprite.scale.x = -Math.abs(...)` at line 447) reads the magnitude of scale.x set by applyLockedSpriteSize. Because applyLockedSpriteSize calls `scale.set(scale)` (uniform, positive), and the flip happens after in the same frame, there is no sign accumulation. Each frame: applyLockedSpriteSize sets positive uniform scale, then updateCrawling flips x for facing direction.


## 6. Follow-on items not addressed

- Diagnostic follow-on 2 (dripSprite cleanup on Jumper.destroy): not changed because the game.ts cleanup path covers the practical case.
- Diagnostic follow-on 3 (ceiling jumper zIndex 85 always vs foreground layer 80): not changed because no current visual bug is reported for the ceiling variant.
- No Hotfix G/H/I comment blocks exist in jumper.ts, so no consolidation was needed. Grep for `Hotfix [A-Z]` returned zero matches.


## 7. Manual playtest steps

After deploying this fix, run:

1. Cubicles room. Walk to x=800. Verify creature renders BEHIND grate at peeking, IN FRONT during fake_attacking emerge.
2. Trigger emerging (full attack). Creature width should never exceed approximately 340 px on screen. Compare against player width (192 px). The creature is roughly 1.7x the player width at peak, not 3x.
3. Watch retreat animation. Confirm no behavior change (retreat already worked correctly at near-unity scale).
4. Repeat in server (x=2400) and stairwell (x=600). Confirm parity.
5. Spawn ceiling jumpers (cubicles x=1500). Confirm no visual change vs pre-fix behavior.


## 8. Self-check

- [x] No em dashes anywhere in this report or in the new code.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green (exit 0).
- [x] No new TS errors or warnings (tsc --noEmit exit 0).
- [x] Ceiling variant code path untouched (gated on ventPosition === "floor").
- [x] Hotfix I status: APPLIED+PATCHED (rename complete, no grateCenterY references, width cap and z-fix added).
- [x] All 15 edge cases walked.
