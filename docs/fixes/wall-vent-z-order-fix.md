# Wall Vent Z-Order Fix. Hotfix N.

Commit at start: 56035dfbf95f70681b1082474d3c1967c58c1791
Branch: main
Build before: PASS (tsc --noEmit + vite build, exit 0, 145.49 KB gzip)
Build after: PASS (tsc --noEmit + vite build, exit 0, 145.49 KB gzip)

## 1. Bug

The wall vent grate (dripSprite) rendered at zIndex 75, above the player at zIndex 50. When the player stood near a floor jumper's x position, the vent visibly obscured the player's body. Wall fixtures should render behind the player.

This was not visible before Hotfix M because element spacing kept the player from standing at the vent's x position. After Hotfix M repositioned several elements (cubicles left floor jumper from x=800 to x=550, server floor jumper from x=2400 to x=2450), the player could walk directly through the vent's visual footprint, exposing the layering error.

## 2. Fix

Three zIndex values reordered to place the wall vent behind the player while preserving the peek-through and active-emerge visuals.

| Object | Before | After | Rationale |
|--------|--------|-------|-----------|
| dripSprite (vent grate) | 75 | 20 | Wall fixture, now part of wall layer behind player (50) |
| Jumper container, peeking states (dormant, peeking) | 70 | 15 | Still behind dripSprite (15 < 20), peek-through preserved |
| Jumper container, active states (all others) | 85 | 90 | Still above foreground props (90 > 80), emerge-in-front preserved |

Additional change: the Hotfix J DEV-mode console.assert in updateZIndexForVentStacking expected z === 70 or z === 85. Updated to expect z === 15 or z === 90. Without this update, the assert would fire on every floor jumper state transition during development.

ARCHITECTURE.md zIndex map updated to include the jumper and dripSprite rows with post-fix values.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 0 | 0 | 2 |
| src/jumper.ts | 0 | 0 | 5 |
| ARCHITECTURE.md | 2 | 0 | 0 |

## 4. Diff summary

### src/game.ts:2650 (floor dripSprite)

BEFORE:
```typescript
dripSprite.zIndex = 75;
```

AFTER:
```typescript
dripSprite.zIndex = 20;
```

### src/game.ts:2657 (ceiling dripSprite)

BEFORE:
```typescript
dripSprite.zIndex = 75;
```

AFTER:
```typescript
dripSprite.zIndex = 20;
```

### src/jumper.ts:197-202 (constructor)

BEFORE:
```typescript
// zIndex: floor variant starts behind grate; ceiling fixed at 85
if (this.ventPosition === "floor" && !fromLocker) {
  this.container.zIndex = 70;
} else {
  this.container.zIndex = 85;
}
```

AFTER:
```typescript
// zIndex: floor variant starts behind grate; ceiling/locker fixed at 90
if (this.ventPosition === "floor" && !fromLocker) {
  this.container.zIndex = 15;
} else {
  this.container.zIndex = 90;
}
```

### src/jumper.ts:558-559 (updateZIndexForVentStacking ternary)

BEFORE:
```typescript
this.container.zIndex = peekingStates.includes(this.state) ? 70 : 85;
```

AFTER:
```typescript
this.container.zIndex = peekingStates.includes(this.state) ? 15 : 90;
```

### src/jumper.ts:563-565 (DEV assert)

BEFORE:
```typescript
console.assert(
  z === 70 || z === 85,
  `Unexpected jumper zIndex ${z} in state ${this.state}`,
);
```

AFTER:
```typescript
console.assert(
  z === 15 || z === 90,
  `Unexpected jumper zIndex ${z} in state ${this.state}`,
);
```

### ARCHITECTURE.md (rendering layers table, lines 303-311)

BEFORE:
```
| 0 | Room background, decorative props, door sprites |
| 5 | Upper floor background (Server) |
| 10 | Catwalk surface strip (TilingSprite, Server upper floor) |
| 30 | Ladder sprites |
| 50 | Player |
| 55 | Guidance arrow, hatch sprite (above player at ladder top) |
| 80 | Foreground props (cubicle dividers) |
```

AFTER:
```
| 0 | Room background, decorative props, door sprites |
| 5 | Upper floor background (Server) |
| 10 | Catwalk surface strip (TilingSprite, Server upper floor) |
| 15 | Jumper container, peeking states (dormant, peeking) |
| 20 | dripSprite (wall vent grate overlay) |
| 30 | Ladder sprites |
| 50 | Player |
| 55 | Guidance arrow, hatch sprite (above player at ladder top) |
| 80 | Foreground props (cubicle dividers) |
| 90 | Jumper container, active states (fake_attacking, emerging, getting_up, crawling, attacking, retreating) |
```

## 5. Verified layering

| # | Scenario | Key zIndex relationships | Result |
|---|----------|------------------------|--------|
| 2.1 | Player walks past a wall vent (dormant jumper) | peeking 15 < dripSprite 20 < player 50 | Player in front of vent. Bug fixed. |
| 2.2 | Floor jumper triggers fake_attacking | active 90 > player 50, dripSprite hidden (Hotfix J toggle) | Creature in front, grate hidden. Unchanged behavior. |
| 2.3 | Floor jumper full attack cycle (emerging through retreating) | active 90 > foreground 80 > player 50 > dripSprite 20 | Creature above all room elements. dripSprite visible at 20 behind player during getting_up/crawling/attacking/retreating. Correct. |
| 2.4 | Ceiling jumper | dripSprite 20 < player 50 < active 90 | Ceiling vent behind player. Player rarely overlaps in Y with ceiling. No visible change. |
| 2.5 | Ladder interaction | dripSprite 20 < ladder 30 | Ladder renders in front of wall vent. Correct (ladders mount on walls in front of fixtures). |
| 2.6 | Catwalk strip (Server) | catwalk 10 < dripSprite 20 | Wall vents render in front of catwalk strip. Correct (vents on upper-floor walls sit above the floor strip). |
| 2.7 | Foreground props (cubicle dividers) | player 50 < dividers 80 < active jumper 90 | Dividers obscure player. Active jumper renders in front of dividers. Same as pre-fix (85 > 80, now 90 > 80). |
| 2.8 | Guidance arrow | dripSprite 20 < player 50 < arrow 55 | Arrow now above vent (was below at 55 < 75). Arrow is a HUD-like room overlay, rendering above wall decoration is more consistent with its role. |
| 2.9 | Hatch sprite | dripSprite 20 < hatch 55 | Same logic as guidance arrow. Acceptable. |

## 6. Edge cases

| # | Description | Status |
|---|-------------|--------|
| E1 | Multiple floor jumpers visible on screen at once | Safe. Each has its own dripSprite, all at zIndex 20. Rendering order between equal-zIndex siblings determined by addChild order (Pixi default). Unchanged from pre-fix. |
| E2 | Wall vent at player's x position (the screenshot bug) | Fixed. dripSprite at 20 is now behind player at 50. Vent visible on wall, player walks in front. |
| E3 | Locker jumpers (ventPosition "ceiling" per diagnostic E13) | Safe. Constructor sets zIndex 90 (was 85). Locker jumpers are always in active states (enterState "attacking" at construction). No visual change. |
| E4 | sortableChildren on world container | Confirmed true at game.ts:231. zIndex changes are honored. |
| E5 | Tests or snapshot images hard-coding 70, 75, or 85 | None found. Grep confirmed zero matches in test files. |
| E6 | Creature behind grate during fake_attacking (Hotfix I-bis fix) | Still fixed. fake_attacking returns active zIndex 90 (was 85). dripSprite hidden by Hotfix J visibility toggle. Both guards active. |
| E7 | DEV-mode console.assert for unexpected zIndex | Updated from 70/85 to 15/90. Assert will not fire on valid state transitions. |
| E8 | Save game compatibility | No save persistence in the project. zIndex is runtime-only. Safe. |
| E9 | Ceiling jumper dripSprite at top of screen | Pre-fix at 75, post-fix at 20. Ceiling vent rarely overlaps player vertically. zIndex change mostly invisible in practice. |
| E10 | Catwalk on Server upper floor | Catwalk at 10, dripSprite at 20. Vents on upper-floor walls render in front of catwalk floor strip. Correct. |
| E11 | Server upper floor jumper at x=1800 ventPosition top | Ceiling-style jumper follows ceiling-variant rules. dripSprite 20, active 90. Same logic as ground floor. |
| E12 | Performance | Pixi sorts children when sortableChildren is true and a child's zIndex changes. The sort is O(n log n) per dirty marker. Pattern unchanged from pre-fix (same number of zIndex mutations per state transition). |

## 7. Trade-offs

The guidance arrow (zIndex 55) and hatch sprite (zIndex 55) now render in front of wall vents instead of behind them. Pre-fix, both were below dripSprite (55 < 75). Post-fix, both are above (55 > 20). The arrow is a player-guidance overlay that should be visible at all times. Rendering it above wall decoration is more consistent with its purpose. If the user reports an arrow rendering issue in a specific room, the arrow could be moved to a HUD layer (>1000) in a follow-on fix.

The active jumper zIndex changed from 85 to 90 but the relationship with foreground props (80) is preserved. The gap widened from 5 to 10, which has no visual effect (Pixi uses integer comparison, not distance).

Ceiling dripSprite dropped from 75 to 20. For ceiling jumpers, the dripSprite is positioned near the top of the room (at hotspot.ventY). The player is almost never vertically close enough for the zIndex change to produce a visible difference. In the rare case where a ceiling vent overlaps the player in Y, the vent now renders behind the player, which is the correct behavior for a wall fixture.

## 8. Manual playtest steps

1. Walk through cubicles. Stop at the left floor jumper (x=550 post-Hotfix-M). Stand on top of the vent x position. Confirm vent renders BEHIND the player.
2. Trigger the jumper to peek. Confirm eyes appear THROUGH the grate slats (peeking jumper at 15 < dripSprite at 20).
3. Trigger the jumper to emerge. Confirm creature renders IN FRONT of the player and the cubicle dividers (active at 90 > player 50, foreground 80).
4. Walk through stairwell. Approach a ceiling jumper. Confirm visual is unchanged from pre-fix.
5. Spawn a locker hiding event. Confirm locker visuals are unchanged.
6. Walk through every room confirming no vent renders in front of the player.

## 9. Self-check

- [x] No em dashes anywhere.
- [x] Build is green (tsc --noEmit + vite build, exit 0).
- [x] No new TS errors or warnings.
- [x] All 12 edge cases walked.
- [x] ARCHITECTURE.md zIndex map matches code.
- [x] Hotfix J DEV assert updated (15/90 replacing 70/85).
- [x] Ceiling jumper visual unchanged.
- [x] Active jumper still above foreground props (90 > 80).
- [x] Peeking jumper still behind dripSprite (15 < 20, peek-through preserved).
