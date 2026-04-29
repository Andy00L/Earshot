# Loot Bag Visual Resize. Hotfix L.

Commit at start: 56035dfbf95f70681b1082474d3c1967c58c1791
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after gzipped: 145.48 KB / 145.49 KB (+0.01 KB)
Shrink ratio: 0.65 (tunable in one place: LOOT_VISUAL_SHRINK)

## 1. Bug

The loot bag (shade) dropped on death rendered at a 220 px target height (set by Hotfix E). The shade sprite plus its 400x400 blue glow halo occupied roughly 25% of screen width. The bag silhouette was comparable to the player's (357 px tall), making it look like a second character rather than a dropped item.

## 2. Fix

Introduced `LOOT_VISUAL_SHRINK = 0.65` at the top of src/shade.ts. Applied to two rendering sites:

**Shade sprite (src/shade.ts:50).** The target height clamp drops from 220 to 143 px. The scale is uniform (width derived from height), so width shrinks proportionally. For shade1 (325x363 native), the on-screen size goes from ~197 x 220 to ~128 x 143.

**Glow halo (src/shade.ts:43).** The glow is a separate Sprite using a 400x400 canvas-generated radial gradient texture. Previously it rendered at native size (400x400) with no explicit scale. Now `this.glow.scale.set(LOOT_VISUAL_SHRINK)` reduces it to 260x260 on screen. The anchor stays at (0.5, 0.5), so the glow remains centered on the bag's floor position. The gradient stops, alpha pulse, and animation timing are unchanged.

No pickup prompt offset was needed. The shade recovery prompt (game.ts:2204-2208) uses `isPlayerInRange` which checks a fixed 80 px world-coordinate radius. The HUD prompt is positioned by the HUD system, not relative to the bag's sprite bounds.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/shade.ts | 8 | 0 | 2 |

## 4. Diff

**src/shade.ts, module scope (new, before class declaration):**

BEFORE:
```typescript
import { Container, Sprite, Texture } from "pixi.js";

/**
 * Visual representation of the shade (death-drop inventory pile).
```

AFTER:
```typescript
import { Container, Sprite, Texture } from "pixi.js";

// Visual shrink factor for the loot bag. Reduces the shade sprite and
// glow halo proportionally. Tune in one place if the bag footprint
// needs adjustment. Does NOT affect pickup hitbox (fixed 80 px radius).
const LOOT_VISUAL_SHRINK = 0.65;
if (LOOT_VISUAL_SHRINK <= 0 || LOOT_VISUAL_SHRINK > 2) {
  throw new Error(`LOOT_VISUAL_SHRINK out of range: ${LOOT_VISUAL_SHRINK}`);
}

/**
 * Visual representation of the shade (death-drop inventory pile).
```

**src/shade.ts, glow sprite setup (line 43, added scale):**

BEFORE:
```typescript
    this.glow.alpha = 0.7;
    this.stageContainer.addChild(this.glow);
```

AFTER:
```typescript
    this.glow.alpha = 0.7;
    this.glow.scale.set(LOOT_VISUAL_SHRINK);
    this.stageContainer.addChild(this.glow);
```

**src/shade.ts, shade sprite scale (line 50, modified):**

BEFORE:
```typescript
    const shadeScale = 220 / this.sprite.texture.height;
```

AFTER:
```typescript
    const shadeScale = (220 * LOOT_VISUAL_SHRINK) / this.sprite.texture.height;
```

## 5. Pickup mechanics verification

Hitbox is defined in src/shade.ts:87-90:
```typescript
isPlayerInRange(playerX: number, playerY: number): boolean {
    const dx = playerX - this.worldX;
    const dy = playerY - this.worldY;
    return Math.hypot(dx, dy) < 80;
}
```

The radius (80 px) uses worldX/worldY coordinates, not sprite bounds or dimensions. grep for `getBounds`, `bag.width`, `sprite.width`, `glow.width` in shade.ts returns zero matches. The hitbox is completely independent of the visual size.

| Metric | Before | After | Changed |
|--------|--------|-------|---------|
| Pickup radius | 80 px | 80 px | no |
| Prompt visibility threshold | 80 px (same isPlayerInRange call) | 80 px | no |
| Prompt positioning | HUD system, not bag-relative | same | no |

## 6. Edge cases

| ID | Edge case | Status |
|----|-----------|--------|
| E1 | Bag near wall/door | Safe. Smaller footprint (143 vs 220). Less likely to clip, never more. |
| E2 | Multiple bags from multiple deaths | Each ShadeVisual uses the same constant. All shrink together. |
| E3 | Animated flame timing | Glow pulse uses elapsed time and Math.sin. Scale change does not affect timing. |
| E4 | Bag on upper floor | stageContainer positioning uses worldX/worldY + camera offset. Anchor and positioning logic unchanged. |
| E5 | Pickup at death (respawn race) | Pre-existing behavior. Out of scope. |
| E6 | Asset preload / loading | Shade textures load from atlas. Atlas unchanged. Glow texture generated from canvas at runtime. Canvas size unchanged (400). Only the sprite scale changes. |
| E7 | Sprite vs Container scaling | Shade sprite is a direct Sprite with `sprite.scale.set()`. Glow is a direct Sprite with `glow.scale.set()`. Both are children of stageContainer. No container-level scale. Each scales independently. |
| E8 | Per-particle scale on glow | The glow is a single Sprite (not a particle emitter). The radial gradient is baked into a canvas texture. `scale.set(0.65)` on the Sprite reduces the entire gradient proportionally. No per-particle concern. |
| E9 | Pickup prompt icon + text | The prompt uses `hud.showSpritePrompt("key-e", "label-grab")` at game.ts:2207. Positioned by the HUD system. No bag-relative offset. |
| E10 | Shade destroyed before pickup | `destroy()` at shade.ts:93-96 removes stageContainer from parent and destroys children. Unchanged by this fix. |

## 7. Trade-offs

The 0.65 ratio is heuristic. At 220 * 0.65 = 143 px target height, the bag is roughly 40% of the player's 357 px height. This reads as a small item on the floor. If the bag still feels too large or too small after a playtest, change `LOOT_VISUAL_SHRINK` in one place (src/shade.ts:6).

The glow shrinks proportionally from 400x400 to 260x260. The glow-to-sprite ratio stays similar (before: 400/220 = 1.82x, after: 260/143 = 1.82x). If the halo should specifically stay larger to create a more visible aura around a smaller bag, a separate constant could be introduced. Out of scope for this fix.

The glow center is at the container origin (floor point), while the sprite extends upward from the floor (anchor 0.5, 1.0). After shrink, the glow extends 130 px in each direction from the floor, while the sprite extends 143 px upward. The glow does not quite cover the top of the sprite, which is the same proportional relationship as before shrink (200 vs 220).

## 8. Self-check

- [x] No em dashes anywhere.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] Pickup hitbox unchanged (fixed 80 px radius, src/shade.ts:90).
- [x] All 10 edge cases walked.
- [x] LOOT_VISUAL_SHRINK constant exists with runtime guard (src/shade.ts:6-9).
