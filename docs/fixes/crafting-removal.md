# Crafting Removal. Hotfix Q.

Commit at start: 2ce4720
Branch: main
Build before: tsc --noEmit + vite build, exit 0
Build after: tsc --noEmit + vite build, exit 0
Bundle size before: 504.16 kB (147.47 kB gzipped)
Bundle size after: 496.11 kB (145.50 kB gzipped)
Delta: -8.05 kB (-1.97 kB gzipped), 6 fewer modules bundled

## 1. What was removed

| Removal | Location | Method |
|---------|----------|--------|
| Workbench E-key proximity check and openWorkbench call | src/game.ts handleInteraction | Deleted block |
| WorkbenchMenu field and construction | src/game.ts Game class | Field + constructor line removed |
| WorkbenchMenu import | src/game.ts imports | Deleted |
| crafting.ts import (RECIPES, craft) | src/game.ts imports | Deleted |
| CraftedItemId import | src/game.ts imports | Deleted from types import |
| throwSelectedItem method | src/game.ts | Deleted (93 lines) |
| onItemLand method | src/game.ts | Deleted (26 lines) |
| isNearWorkbench method | src/game.ts | Deleted (5 lines) |
| openWorkbench method | src/game.ts | Deleted (20 lines) |
| MATERIAL_IDS static set | src/game.ts | Deleted (unused even before hotfix) |
| Crafted-item throw branch in G key handler | src/game.ts | else branch removed, radio throw preserved |
| Workbench "E CRAFT" prompt | src/game.ts updatePrompts | Deleted block |
| workbenchMenu.destroy() call | src/game.ts destroy | Deleted |
| Tutorial T3 crafting text | src/audio-catalog.ts | Prompt + transcript updated |

## 2. What was preserved

- src/crafting.ts (full file, dormant, no live consumer)
- src/workbench-menu.ts (full file, dormant, no live consumer)
- src/flare-effect.ts, src/smokebomb-effect.ts, src/decoy-effect.ts (orphaned, no spawn path)
- src/projectile.ts (orphaned, no spawn path)
- Materials (wire, glass_shards, battery, tape) still spawn as pickups in rooms
- Material pickup-to-inventory-slot flow unchanged (src/game.ts lines 890-911)
- Workbench prop in Reception decorativeProps (visual only, no interaction)
- Workbench HTML overlay in index.html (hidden by default, available for Hotfix T)
- Workbench CSS styles in index.html (available for Hotfix T)
- Inventory slot selection (1/2/3 keys) still works for materials
- Shade drop on death still captures inventorySlots snapshot (materials included)
- Projectile/effect update loops kept (iterate empty arrays, no-op, harmless)
- Projectile/effect cleanup in room transitions and destroy kept (same reason)
- Radio bait system completely unaffected (R to arm, G to throw, independent code path)

## 3. Files changed

| File | Lines added | Lines removed | Net |
|------|-------------|---------------|-----|
| src/game.ts | 7 | 157 | -150 |
| src/audio-catalog.ts | 2 | 2 | 0 |

## 4. Diff summary

### src/game.ts imports

BEFORE:
```
import { RECIPES, craft } from "./crafting";
import { WorkbenchMenu } from "./workbench-menu";
```

AFTER: Both import lines deleted. CraftedItemId removed from types import.

### src/game.ts Game class field + constructor

BEFORE:
```
private workbenchMenu: WorkbenchMenu;
// ...
this.workbenchMenu = new WorkbenchMenu();
```

AFTER: Field and constructor line deleted.

### src/game.ts G key throw handler

BEFORE:
```
if (hasArmedRadio) {
  this.throwCarriedArmedRadio();
} else {
  this.throwSelectedItem();
}
```

AFTER:
```
if (hasArmedRadio) {
  this.throwCarriedArmedRadio();
}
```

### src/game.ts E key handler

BEFORE:
```
// Check workbench
if (this.isNearWorkbench()) {
  this.openWorkbench();
  return;
}
```

AFTER: Block deleted entirely.

### src/game.ts workbench prompt

BEFORE:
```
// Workbench prompt
if (this.isNearWorkbench()) {
  this.hud.showSpritePrompt("key-e", "label-craft");
  return;
}
```

AFTER: Block deleted entirely.

### src/game.ts crafting methods section

BEFORE: Section contained MATERIAL_IDS, throwSelectedItem, onItemLand, updateProjectiles, updateFlareEffects, updateSmokeBombEffects, updateDecoyEffects, isNearWorkbench, openWorkbench.

AFTER: Only updateProjectiles, updateFlareEffects, updateSmokeBombEffects, updateDecoyEffects remain. Section renamed to "Projectile and effect updates (dormant after Hotfix Q)".

### src/game.ts destroy

BEFORE:
```
// Clean up radio popup and workbench menu
this.radioPopup.destroy();
this.workbenchMenu.destroy();
```

AFTER:
```
// Clean up radio popup
this.radioPopup.destroy();
```

### src/audio-catalog.ts tutorial_t3

BEFORE: "Find the keycard, flip the breaker, reach the stairwell. Find materials in other rooms and craft tools at the workbench."

AFTER: "Find the keycard, flip the breaker, reach the stairwell. Collect materials along the way."

## 5. Verification

- tsc --noEmit: pass (exit 0)
- vite build: pass (exit 0)
- No new TS errors or warnings
- Static walk-through:
  - Player spawns in Reception. Walks to workbench at x=1500. No prompt appears. Press E: nothing happens. PASS.
  - Player picks up wire in Server room. Inventory shows wire in slot. No craft hint appears. PASS.
  - Player picks up battery in Archives. Inventory shows battery in slot. PASS.
  - Player dies. Shade drops with inventorySlots snapshot (materials included). PASS (code path unchanged).
  - Player respawns. New game state. Materials gone (createInitialGameState resets inventorySlots to [null, null, null]). PASS.
  - G key with no armed radio: does nothing (throwSelectedItem removed, no else branch). PASS.
  - G key with armed radio: throws radio bait normally. PASS (throwCarriedArmedRadio path intact).
  - R key arms radio: unchanged. PASS.
- Bundle size delta: -8.05 kB (-1.97 kB gzipped)

## 6. Coupling notes

For Hotfix T (tape station), the following hooks remain available:
- WorkbenchMenu HTML overlay container (id="workbench-menu") exists in index.html, hidden by default
- Workbench CSS styles preserved in index.html
- Workbench prop in Reception decorativeProps still renders at x=1500
- workbench definition still present in rooms.ts reception (x=1500, triggerWidth=100)
- crafting.ts recipe scaffolding (Recipe interface, RECIPES array, canCraft, craft) can be repurposed
- workbench-menu.ts WorkbenchMenu class can be repurposed (show/close/destroy lifecycle intact)
- Projectile/effect update infrastructure in game.ts can be reconnected to new spawn paths
- Inventory slot system (3 slots, 1/2/3 key selection) fully operational for materials
- FlareEffect, SmokeBombEffect, DecoyEffect classes intact, just unreachable

## 7. Self-check

- [x] No em dashes anywhere.
- [x] Build is green.
- [x] No new TS errors or warnings.
- [x] No code path opens WorkbenchMenu.
- [x] Materials still pick up to inventory.
- [x] Workbench prop still renders in Reception.
- [x] Radio bait is unaffected (independent code paths for R/G keys).
- [x] src/crafting.ts not deleted.
- [x] src/workbench-menu.ts not deleted.
- [x] src/flare-effect.ts, src/smokebomb-effect.ts, src/decoy-effect.ts not deleted.
- [x] atlas.json not modified.
- [x] Material pickup spawn positions in rooms.ts not changed.
