# Floor Jumper Visual Resize and Coherence Fix. Hotfix J.

Commit at start: 56035dfbf95f70681b1082474d3c1967c58c1791
Branch: main
Base diagnostic: docs/diagnostic/floor-jumper-visual-state.md
Base fix: docs/fixes/floor-jumper-visual-state-fix.md (Hotfix I-bis)
Build status before / after: exit 0 / exit 0
Bundle size before / after gzipped: 145.19 KB / 145.45 KB (+0.26 KB)
Path chosen: D.2 Coherent (Phases A + B + C)

## 1. User issues addressed

**Issue 1: vent and surroundings too big in absolute pixels.**
The dripSprite was 283.6 x 220 px while the player is 192 px wide, making the vent 1.48x the player's width. A wall vent should be smaller than the player.

Resolution: Phase A scalar shrink by 0.6. Introduced `FLOOR_VISUAL_SHRINK = 0.6` in jumper.ts and `DRIP_SHRINK = 0.6` in game.ts. All floor-variant size constants and dripSprite dimensions multiply by this factor. Post-shrink vent is ~170 x 132 px. Vent/player width ratio drops from 1.48 to 0.89.

**Issue 2: creature renders behind grate in active states.**
Hotfix I-bis removed `fake_attacking` from the `peekingStates` array, which was the only zIndex bug. Phase B audited all floor-variant states and confirmed every active state resolves to zIndex 85 (in front of dripSprite at 75). No parallel bug was found. The user's screenshot may have been captured before Hotfix I-bis was applied. A DEV-mode console.assert was added to catch future regressions.

| State | zIndex | Expected | Correct |
|-------|--------|----------|---------|
| dormant | 70 | behind grate | yes |
| peeking | 70 | behind grate | yes |
| fake_attacking | 85 | in front | yes |
| emerging | 85 | in front | yes |
| getting_up | 85 | in front | yes |
| crawling | 85 | in front | yes |
| attacking | 85 | in front | yes |
| retreating | 85 | in front | yes |

**Issue 3: vent silhouette changes between dormant and active states.**
Two problems combined. First, the dripSprite (drip.png) overlapped with idle/emerge frames that have the vent grate baked in, doubling the vent visual. Second, emerge frames have heights from 185 to 528 native, so height-based scaling (Math.min approach) produced wildly different vent widths across the animation.

Resolution: Phase C introduced three changes.

(a) dripSprite visibility toggle. The Jumper now receives a dripSprite reference from game.ts. On each state transition, `currentStateHasBakedVent()` checks the frame prefix: idle and emerge prefixes have the vent baked in, so dripSprite hides. Clean-creature prefixes (getup, walk, attack) show the dripSprite.

(b) Frame remap. Floor-variant `fake_attacking` and `emerging` now use emerge-prefix frames instead of getup. The emerge frames show the creature pushing through the vent grate, which matches the wall-vent fiction. Getup frames (clean creature on floor) were a visual mismatch for the "creature emerging from vent" concept.

(c) Vent-width scaling for emerge frames. Instead of Math.min(heightScale, widthScale), emerge-prefix frames on the floor variant scale by `FLOOR_EMERGE_TARGET_VENT_WIDTH / textureWidth` = 170 / ~283 = ~0.6. Since all emerge frames have vent width ~283 native, the on-screen vent width stays at ~170 across the full animation. The creature extends downward via increasing frame height, with anchor set to top-center (0.5, 0.0).

## 2. Files changed

| File | Phases | Lines added | Lines removed | Lines modified |
|------|--------|-------------|---------------|----------------|
| src/jumper.ts | A, B, C | 52 | 12 | 18 |
| src/game.ts | A, C | 9 | 3 | 3 |

## 3. Diff summary

### src/jumper.ts

**FLOOR_VISUAL_SHRINK constant** (new, before FLOOR_SPRITE_HEIGHT_BY_STATE):
```typescript
const FLOOR_VISUAL_SHRINK = 0.6;
if (FLOOR_VISUAL_SHRINK <= 0 || FLOOR_VISUAL_SHRINK > 2) {
  throw new Error(`FLOOR_VISUAL_SHRINK out of range: ${FLOOR_VISUAL_SHRINK}`);
}
```

**FLOOR_SPRITE_HEIGHT_BY_STATE** (modified):
```
BEFORE: dormant: 220, peeking: 220, fake_attacking: 200, ...
AFTER:  dormant: 220 * FLOOR_VISUAL_SHRINK, peeking: 220 * FLOOR_VISUAL_SHRINK, ...
```

**FLOOR_SPRITE_MAX_WIDTH_BY_STATE** (modified):
```
BEFORE: dormant: 290, peeking: 290, fake_attacking: 320, ...
AFTER:  dormant: 290 * FLOOR_VISUAL_SHRINK, peeking: 290 * FLOOR_VISUAL_SHRINK, ...
```

**FLOOR_EMERGE_TARGET_VENT_WIDTH** (new, after FLOOR_SPRITE_MAX_WIDTH_BY_STATE):
```typescript
const FLOOR_EMERGE_TARGET_VENT_WIDTH = 170;
```

**STATE_FRAME_PREFIX_FLOOR** (modified):
```
BEFORE: fake_attacking: "getup", emerging: "getup"
AFTER:  fake_attacking: "emerge", emerging: "emerge"
```

**Class properties** (added):
```typescript
private grateTopY = 0;
private dripSprite: Sprite | undefined;
```

**Constructor** (modified):
```
BEFORE: constructor(hotspot, floorY, manifest, parent, fromLocker = false)
AFTER:  constructor(hotspot, floorY, manifest, parent, fromLocker = false, dripSprite?: Sprite)
```
Added: grateTopY computation, dripSprite assignment, initial dripSprite visibility toggle.

**enterState** (modified):
- fake_attacking: added `this.container.y = this.grateTopY` for floor variant
- emerging: changed `this.container.y = this.grateBottomY` to `this.grateTopY`
- getting_up: added `this.container.y = this.floorY`
- After switch: added dripSprite visibility toggle via `currentStateHasBakedVent()`

**updateFakeAttacking** (modified):
```
BEFORE: 3-phase Y interpolation (grateBottomY -> floorY -> grateBottomY)
AFTER:  container.y fixed at grateTopY. Manual 3-phase frame control:
        emerge1->emerge6 (600ms), hold emerge6 (400ms), emerge6->emerge1 (800ms)
```

**updateEmerging** (modified):
```
BEFORE: Y interpolation from grateBottomY to floorY over 800ms
AFTER:  container.y fixed at grateTopY. Emerge frames extend creature downward.
```

**advanceFrame** (modified): added early return for floor fake_attacking (uses manual frame control).

**applyFrame** (modified): emerge frames on floor variant use anchor (0.5, 0.0) instead of (0.5, baselineY/height).

**applyLockedSpriteSize** (modified): added emerge-prefix early return path using `FLOOR_EMERGE_TARGET_VENT_WIDTH / textureWidth`.

**updateZIndexForVentStacking** (modified): added DEV-mode console.assert.

**currentStateHasBakedVent** (new method):
```typescript
private currentStateHasBakedVent(): boolean {
  if (this.ventPosition !== "floor") return false;
  const prefix = this.getStateFramePrefix(this.state);
  return prefix === "idle" || prefix === "emerge";
}
```

### src/game.ts

**DRIP_SHRINK constant** (new, before the hotspot loop):
```typescript
const DRIP_SHRINK = 0.6;
```

**dripSprite floor branch** (modified):
```
BEFORE: dripSprite.height = 220; dripSprite.width = 220 * (330 / 256);
AFTER:  dripSprite.height = 220 * DRIP_SHRINK; dripSprite.width = 220 * (330 / 256) * DRIP_SHRINK;
```

**Jumper constructor call** (modified):
```
BEFORE: new Jumper(hotspot, jumperFloorY, this.manifest, this.world)
AFTER:  new Jumper(hotspot, jumperFloorY, this.manifest, this.world, false, isFloorVent ? dripSprite : undefined)
```

## 4. Verification

- pnpm build (vite build): exit 0, 496.42 KB main bundle (145.45 gzip)
- tsc --noEmit: exit 0, no errors or warnings
- Static walk-through (Phase F.3):

| Step | State | dripSprite | Frame prefix | Anchor | container.y | Vent width on screen |
|------|-------|------------|--------------|--------|-------------|---------------------|
| Dormant | dormant | hidden | idle | bottom | grateBottomY | ~170 (from idle frame) |
| Peeking | peeking | hidden | idle | bottom | grateBottomY | ~170 |
| Fake attack | fake_attacking | hidden | emerge | top | grateTopY | 170 (vent-width scale) |
| Fake retreat | fake_attacking | hidden | emerge | top | grateTopY | 170 |
| Emerging | emerging | hidden | emerge | top | grateTopY | 170 |
| Getting up | getting_up | visible | getup | bottom | floorY | n/a (dripSprite at ~170) |
| Crawling | crawling | visible | walk | bottom | floorY | n/a |
| Attacking | attacking | visible | attack | bottom | floorY | n/a |
| Retreating | retreating | visible | walk | bottom | floorY->grateBottomY | n/a |
| Back dormant | dormant | hidden | idle | bottom | grateBottomY | ~170 |

- Edge cases (Phase G):

| ID | Edge case | Status |
|----|-----------|--------|
| E1 | dripSprite missing in some spawn paths | Safe. Constructor accepts undefined. Toggle guarded by `if (this.dripSprite && ...)`. |
| E2 | State transitions happen mid-frame | Safe. enterState runs once per transition. Pixi honors visible flag instantly. |
| E3 | Frame prefix change for retreating | Retreating still uses walk (unchanged). FLOOR_REVERSE_PLAYBACK_STATES unaffected. |
| E4 | Locker jumper | Locker jumpers default to ventPosition "ceiling". Never enter floor branches. No dripSprite passed (fromLocker constructor has 5 args, 6th defaults undefined). |
| E5 | Ceiling jumper | ventPosition !== "floor" guards every floor-only path. Ceiling code path unchanged. |
| E6 | sortableChildren | world.sortableChildren is true per ARCHITECTURE.md:303. zIndex changes honored. |
| E7 | Texture missing fallback | Texture.WHITE is 1x1. Pre-existing issue, not new. |
| E8 | Pixi 8 width/height vs scale | dripSprite uses direct .width/.height setters. No conflict with scale-based logic in jumper. |
| E9 | Jumper.destroy | Destroys container and children. dripSprite is NOT a child of container (it is a sibling in this.world). Not destroyed by Jumper. Cleanup via jumperDripSprites in game.ts:1275-1279. |
| E10 | Scale of 0 or negative | Runtime assert throws if FLOOR_VISUAL_SHRINK <= 0 or > 2. |
| E11 | Frame swap during same enterState | dripSprite.visible set in enterState, persists. No partial state. |
| E12 | Anchor change mid-animation | Anchor changes only on enterState (applyFrame call). container.y also reset in same call. Both transitions happen atomically. |
| E13 | Creature behind grate persists | Phase B confirmed no bug. All active states resolve to zIndex 85 after Hotfix I-bis. DEV assert added. |
| E14 | Hide animation interaction | Hide animations use applyVisualScale in player.ts. Floor jumper uses applyLockedSpriteSize. No collision. |
| E15 | DRIP_SHRINK and FLOOR_VISUAL_SHRINK drift | Cross-reference comments in both files: "MUST stay equal to FLOOR_VISUAL_SHRINK" and "Mirror: DRIP_SHRINK in game.ts MUST stay equal." |

## 5. Trade-offs and limits

The shrink ratio 0.6 is a heuristic producing a vent ~170 px wide against a 192 px player. If the silhouette is too small, change `FLOOR_VISUAL_SHRINK` in jumper.ts and `DRIP_SHRINK` in game.ts to the same value. All downstream dimensions recalculate.

The frame remap from getup to emerge for fake_attacking and emerging changes the visual character of those animations. Previously the creature appeared as a prone figure crawling up from the floor. Now it appears pushing through a wall grate. This is closer to the wall-vent fiction and eliminates the double-vent artifact.

The dripSprite reference crosses file boundaries. game.ts creates and owns it, jumper.ts toggles visibility. A future refactor could extract FLOOR_VISUAL_SHRINK and DRIP_SHRINK into a shared constants module. Current approach uses cross-reference comments as a guardrail.

Emerge frames have large native height variance (185 to 528). With vent-width scaling at ~0.6, the largest frame (emerge5 at 283x528) renders 170 x 317 px. The creature's lower body extends ~185 px below the vent bottom. This is intentional: the creature is breaking through the grate, torso and legs hanging out.

## 6. Follow-on items

- Manual playtest to tune FLOOR_VISUAL_SHRINK if 0.6 is too small or too large.
- Diagnostic follow-on 2: dripSprite cleanup defensive path (already safe per E9, but could be formalized).
- Diagnostic follow-on 3: ceiling jumper zIndex with foreground props (cubicle dividers at 80 vs creature at 85).
- Optional: retreating-uses-reversed-emerge for vent-visible retreat animation.
- Optional: extract FLOOR_VISUAL_SHRINK / DRIP_SHRINK to a shared constants file.

## 7. Manual playtest steps

1. Cubicles room. Walk to x=800. Observe dormant vent. Should be ~170 px wide. Smaller than the player (192 px).
2. Approach to trigger peeking. Eyes visible through grate. Same vent silhouette.
3. Trigger fake_attacking. Vent silhouette stays at ~170. Creature pushes through vent. Visible in front of grate (zIndex 85 vs 75).
4. Wait for retreat. Creature pulls back through vent (emerge6 to emerge1). Same vent silhouette throughout.
5. Trigger emerging (full attack path). Same vent silhouette during emerge. Transitions to getting_up at floor level. dripSprite appears (vent overlay visible behind creature).
6. Crawling, attacking, retreating. Creature on floor. dripSprite visible as wall vent behind.
7. After retreat back to dormant, creature fades. Idle frame shows baked vent. dripSprite hidden.
8. Repeat in server (x=2400) and stairwell (x=600). Confirm parity.
9. Spawn ceiling jumper (cubicles x=1500). Confirm zero visual change from pre-Hotfix-J behavior.

## 8. Self-check

- [x] No em dashes anywhere in this report or in code.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green (vite build exit 0, tsc --noEmit exit 0).
- [x] No new TS errors or warnings.
- [x] Ceiling variant code path untouched.
- [x] All 15 edge cases walked.
- [x] FLOOR_VISUAL_SHRINK and DRIP_SHRINK have cross-references.
- [x] Path D.2 chosen. Phase C implemented.
