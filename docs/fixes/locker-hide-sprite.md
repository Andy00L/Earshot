# Locker Hide Sprite Integration. Hotfix U.23.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle delta: 0 kB (no new runtime code, only atlas frame added)
Atlas frame added: 1 (player:locker-hide, 518x1494, baselineY 1493)
Friction addressed: gameplay clarity (the locker-hide visual showed
the player's crouch-idle animation in front of the locker, not inside it)

## 1. What changed

A new sprite (locker door with eyes visible through a vent slit)
replaces the crouch-idle animation during the HIDING_LOCKER player
state. The world-space locker prop now hides while the player occupies
it and reappears on exit. The hide system internals (proximity, AI
effects, exit behavior) are unchanged.

## 2. Path taken

Path B: no existing sprite swap for locker hiding. The HIDING_LOCKER
AnimDef pointed at crouch-idle1/crouch-idle2 (the generic crouch frames).
Changed the AnimDef to use the new locker-hide frame.

The new frame was added to the player entity (not puzzle-props) so it
integrates directly with the existing player state system. The slicer's
build_atlas_json merges single_chroma results into character entries
(slice.py:518), so this required no manifest schema changes.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| scripts/atlas_config.py | 7 | 0 | 0 |
| src/player.ts | 0 | 0 | 1 |
| src/game.ts | 1 | 0 | 2 |
| assets/atlas.json | regenerated | regenerated | regenerated |
| assets/player/locker-hide.png | added (sliced) | 0 | 0 |

## 4. Diff summary

### scripts/atlas_config.py

Added entry in the player character section:
```python
"locker_hide.png": {
    "type": "single_chroma",
    "entity": "player",
    "frames": ["locker-hide"],
    "chroma_key": True,
    "chroma_color": "magenta",
},
```

### src/player.ts (line 33)

BEFORE:
```typescript
HIDING_LOCKER:  { frameNames: ['crouch-idle1', 'crouch-idle2'], speed: 0.03,  moveSpeed: 0 },
```

AFTER:
```typescript
HIDING_LOCKER:  { frameNames: ['locker-hide'], speed: 0, moveSpeed: 0, visualScale: 0.21 },
```

### src/game.ts (enterHide, line 2546)

BEFORE:
```typescript
if (spot.kind === "desk") spot.sprite.visible = false;
```

AFTER:
```typescript
spot.sprite.visible = false;
```

Now hides the world prop for both desk and locker, preventing a
double-locker visual overlap when the player's locker-hide sprite
renders at the same position.

### src/game.ts (tryExitHide, line 2602)

Added `spot.sprite.visible = true;` after `spot.isOccupied = false;`
in the locker instant-exit block. Restores the world locker prop on
exit. The death cleanup at line 1632 already handles the death-while-hidden
case.

## 5. Verification

- Slicer: 26 entities, 266 frames, all OK. Player entity: 50 frames (was 49).
- pnpm build (vite): exit 0 (544.96 kB / 156.75 kB gz)
- tsc --noEmit: exit 0

Chroma key verification (sampled via PIL):

| Location | Pixel value | Alpha | Status |
|----------|-------------|-------|--------|
| Top-left (5,5) | (7, 2, 8) | 0 | transparent |
| Top-right (513,5) | (8, 3, 9) | 0 | transparent |
| Center (259,747) | (132, 111, 76) | 255 | opaque content |

## 6. Edge cases

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Rapid E press enter/exit | Safe. setHidingPose sets stateLocked=true. Input blocked until setStandingPose. |
| E2 | Player movement while hidden | Safe. stateLocked=true in player.update returns early. No movement. |
| E3 | Monster catches player while hidden in locker | Impossible. Locker sets suspicion to 0 and decayMult to 999. Monster cannot detect player. |
| E4 | Player dies while hidden (beacon zero) | Safe. Death handler (line 1626-1638) restores spot.sprite.visible=true, resets hidingState. |
| E5 | Room transition while hidden | Impossible. stateLocked=true blocks movement input. |
| E6 | Multiple hide spots in one room | Safe. Each spot tracks its own isOccupied and sprite.visible. Only the active spot is affected. |
| E7 | Sprite asset missing (locker-hide frame not in atlas) | Slicer verified: frame present. If missing, player.ts setState filters it out, activeFrameNames is empty, setState returns early (no visual change). |
| E8 | Hot module reload | Texture cache may stale in dev. Acceptable. Production unaffected. |
| E9 | Sprite too tall for room | visualScale 0.21 renders at 518*0.21=109 x 1494*0.21=314. Similar to world locker prop (144x317). Fits within room visible area. |
| E10 | Z-index conflict | Player sprite renders at its existing zIndex (above world props). The world locker prop is hidden during hide, so no z-conflict. |
| E11 | Player faces left, locker-hide always faces front | Scale.x reflects facing direction (1 or -1). The locker sprite is roughly symmetric, so horizontal flip is not visually jarring. |
| E12 | Hide prompt shows after entering hide | Safe. When hidingState.active is true, prompt display shows "Press E to leave hiding spot" (game.ts:2432). Not the enter-hide prompt. |

## 7. Tuning notes

- Final visualScale: 0.21
  - Calculated from: world locker prop height (317px) / locker-hide frame height (1494px) = 0.212
  - Display size at 0.21: 109x314 px (vs world locker prop 144x317)
- Anchor: (0.5, baselineY/height) = (0.5, ~1.0), bottom-center. Matches the world locker prop anchor (0.5, 1.0).
- World locker prop: hidden during hide (spot.sprite.visible = false). Prevents double-draw.

If the visual is too small or large in practice, adjust visualScale
in player.ts. Range 0.18 to 0.28 is reasonable.

## 8. Trade-offs

The locker-hide sprite uses entity "player" rather than "puzzle-props"
so it integrates with the existing player state system (AnimDef,
setState, setHidingPose). This means it shares the player entity's
character manifest entry and boundingBox calculation. The large
native size (518x1494) inflates the player entity's boundingBox, but
the boundingBox is used only for debug visualization (not gameplay).

The world-space locker prop is hidden while the player hides. This
avoids visual overlap but means the room loses its locker visual
during hide. The player's locker-hide sprite fills the gap. On exit,
the world prop reappears instantly (no animation). An exit animation
(locker door opening) would polish this but requires additional frames.

The visualScale 0.21 is calculated from the world locker prop's height.
If the source PNG is regenerated at a different resolution, the scale
must be recalculated.

## 9. Manual playtest steps

a) Hard refresh. Walk to cubicles. Find locker_cub_1 at x=2050.
b) Press E to hide. Verify:
   - Player sprite changes to locker with eyes in slit
   - Sprite positioned at the locker (x=2050)
   - Scale looks correct (roughly same height as the former world locker)
   - World-space locker prop is hidden (no double-locker)
   - "HIDDEN" indicator visible in HUD
c) Press E to exit. Verify:
   - Player sprite returns to idle
   - World locker prop reappears
   - Position is at the locker x (ready to walk away)
d) Repeat 3 times to confirm stability.
e) Walk away, return, re-enter. Consistent behavior.
f) (Optional) Trigger Listener nearby while hidden. Confirm Listener
   does not detect the player (suspicion drops to 0 on enter).

## 10. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] Sprite sliced and present in atlas.json with transparent background.
- [x] Hide state visual swap works (locker-hide frame in HIDING_LOCKER AnimDef).
- [x] Exit state restores normal sprite (setStandingPose resets to IDLE).
- [x] World locker prop hidden during hide, restored on exit.
- [x] Death cleanup restores world prop (line 1632 spot.sprite.visible = true).
- [x] Listener AI behavior unchanged (locker hide still zeroes suspicion).
- [x] All 12 edge cases walked.
- [x] No hide proximity logic modified.
- [x] No AI thresholds modified.
- [x] Magenta chroma_color flag used per Hotfix U.21 pattern.
