# Broken Tape Visual Distinction. Hotfix U.6.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 536.90 kB (154.73 kB gz) / 536.98 kB (154.75 kB gz)
Delta: +0.08 kB (+0.02 kB gz)
Friction addressed: F7 (MEDIUM)
Path chosen: B (runtime tint 0xff8844, props:broken_tape absent from atlas)

## 1. What changed

The 3 broken tape pickups (cubicles x=2100, server x=1100, stairwell
x=1900) shared the same shade-tape:recorder sprite as the 6 lore tapes.
Players could not distinguish quest-critical items from collectible
lore. An amber tint (0xff8844) is now applied to broken tape sprites
at creation time via a new optional tint field on PickupConfig. Lore
tapes render at default white (no tint) and are visually unchanged.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/types.ts | 1 | 0 | 0 |
| src/pickup.ts | 4 | 0 | 0 |
| src/rooms.ts | 3 | 0 | 0 |

## 3. Diff summary

### src/types.ts

PickupConfig interface extended with an optional tint field:

```typescript
  tint?: number;      // optional 0xRRGGBB tint applied to pickup sprite
```

### src/pickup.ts

Constructor applies tint after scale, before addChild:

```typescript
    if (config.tint !== undefined) {
      this.sprite.tint = config.tint;
    }
```

### src/rooms.ts

Three broken tape entries gain `tint: 0xff8844`:

```
broken_tape_01 (cubicles):  tint: 0xff8844
broken_tape_02 (server):    tint: 0xff8844
broken_tape_03 (stairwell): tint: 0xff8844
```

No lore tape entry has a tint field set.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.46s
- Lore tape check: 6 lore tape entries in rooms.ts use
  shade-tape:recorder with no tint field. Confirmed unaffected.

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Custom sprite too large | N/A (Path B, same frame, same scale 0.3). |
| E2 | Tint on lore tape | No tint field on lore tape configs. Default white. |
| E3 | Pickup respawn after death | Config-driven. Re-spawned broken tapes keep tint. |
| E4 | Tape puzzle internals | Unaffected. Puzzle reads tape ID, not sprite tint. |
| E5 | Shade death-drop icon | Shade renders inventory slots, not pickup sprites. No tint propagation. |
| E6 | HUD inventory icon | Broken tapes go to brokenTapesCollected (state), not inventorySlots (HUD). No icon. |
| E7 | Wrong atlas frame name | N/A (Path B uses existing shade-tape:recorder). |
| E8 | Tint under vignette | Amber tint multiplies with vignette red. Renders orange-red. Acceptable. |
| E9 | No save persistence | Pickups respawn from rooms.ts. Safe. |
| E10 | Atlas hot-reload | N/A (Path B, no new atlas entry). |

## 5. Trade-offs

The amber tint (0xff8844) signals "different from lore tape" but does
not specifically communicate "broken." A custom sprite with visible
cracks and exposed tape ribbon would be more expressive. The tint is
sufficient for distinguishing the two pickup types at a glance. When
props:broken_tape is added to the atlas, replacing the frame field in
rooms.ts is a one-line change per entry.

The tint field on PickupConfig is generic and reusable. Any future
pickup that needs a color shift can use the same mechanism without
touching the Pickup class.

## 6. Manual playtest steps

1. Walk to cubicles. Find broken_tape_01 at x=2100. Confirm amber tint.
2. Find lore tape_02 at x=2300 in the same room. Confirm default color.
   Both tapes are visually distinct at a glance.
3. Walk to server. Find broken_tape_02 at x=1100. Confirm amber tint.
4. Find lore tape_03 at x=400. Confirm default color.
5. Walk to stairwell. Find broken_tape_03 at x=1900. Confirm amber tint.
6. Find lore tape_06 at x=2400. Confirm default color.
7. Collect a broken tape. Confirm pickup message says "Picked up broken
   tape." (from Hotfix T).
8. Die. Respawn. Re-enter cubicles. Confirm broken_tape_01 has amber
   tint on respawn.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Path B documented.
- [x] Lore tapes unaffected (6 entries verified, no tint field).
- [x] All 10 edge cases walked.
- [x] No tape puzzle internals modified.
