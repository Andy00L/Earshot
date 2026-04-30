# Path A Sprite Swaps. Hotfix U.0bis.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 537.08 kB (154.90 kB gz) / 538.03 kB (155.04 kB gz)
Delta: +0.95 kB (+0.14 kB gz)
Friction reinforced: F1 (HIGH), F3 (HIGH), F7 (MEDIUM)

## 1. Atlas verification

Atlas namespace is `puzzle-props:` (not `props:`). The U.0 report
documents why: the `props` entity is a tileset (grid-based, 12 tiles).
Using it for single_chroma entries would overwrite the grid.

All 3 frames confirmed in atlas.json:

| Frame | Actual dimensions |
|-------|-------------------|
| puzzle-props:trapdoor_sealed | 933x1124 |
| puzzle-props:tape_recorder | 1396x807 |
| puzzle-props:broken_tape | 1258x953 |

## 2. Trapdoor (Phase 1)

Replaced `vents:sealed` + tint 0x4a3838 with `puzzle-props:trapdoor_sealed`,
no tint. Scale changed from 0.5 (for 318px source) to 0.17 (for 933px
source), yielding ~159px display width (matching the original footprint).

Open state: dimmed to alpha 0.4 on the same sprite. The previous
approach swapped to `vents:open` + tint reset. The custom sprite has
no "open" variant, so alpha dimming signals "opened, no longer
threatening" without a texture swap.

BEFORE (createWhisperTrapSprite):
```typescript
    const frameKey = this.state.whisperTrapUnlocked ? "vents:open" : "vents:sealed";
    const tex = Assets.get<Texture>(frameKey);
    ...
    this.whisperTrapSprite.scale.set(0.5);
    if (!this.state.whisperTrapUnlocked) {
      this.whisperTrapSprite.tint = 0x4a3838;
    }
```

AFTER:
```typescript
    const tex = Assets.get<Texture>("puzzle-props:trapdoor_sealed");
    ...
    this.whisperTrapSprite.scale.set(0.17);
    if (this.state.whisperTrapUnlocked) {
      this.whisperTrapSprite.alpha = 0.4;
    }
```

BEFORE (handleWhisperResult success):
```typescript
        if (this.whisperTrapSprite) {
          const openTex = Assets.get<Texture>("vents:open");
          if (openTex && openTex !== Texture.WHITE) {
            this.whisperTrapSprite.texture = openTex;
          }
          this.whisperTrapSprite.tint = 0xffffff;
        }
```

AFTER:
```typescript
        if (this.whisperTrapSprite) {
          this.whisperTrapSprite.alpha = 0.4;
        }
```

## 3. Workbench overlay (Phase 2)

Added `puzzle-props:tape_recorder` sprite at the workbench position
(x=1500, y=floorY-50) in Reception. Visible only when broken tapes
exist in inventory (same predicate as the U.3 PulseRing). Scale 0.1
yields ~140px wide display. zIndex 81 (above bench at 80).

New field: `workbenchTapeRecorderSprite: Sprite | null`
New methods: `createWorkbenchOverlay()`, `destroyWorkbenchOverlay()`,
`updateWorkbenchOverlay()`

Lifecycle hooks:
- Created in createPulseRings (alongside the PulseRing)
- Destroyed in destroyPulseRings (room change, death)
- Updated in handleTapeResult success (alongside pulse setActive)

## 4. Broken tapes (Phase 3)

Replaced `shade-tape:recorder` + tint 0xff8844 with
`puzzle-props:broken_tape`, no tint. Added `scale` field to
PickupConfig (types.ts) and scale override in pickup.ts constructor
(`config.scale ?? 0.3`). Broken tapes use scale 0.08 (yielding ~101px
wide from 1258px source, matching the original shade-tape:recorder at
scale 0.3 = 102px).

Lore tapes (6 entries) remain on `shade-tape:recorder` with no tint
and no scale override (default 0.3). Verified: 6 entries still match.

## 5. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 30 | 8 | 4 |
| src/rooms.ts | 0 | 3 | 6 |
| src/types.ts | 1 | 0 | 0 |
| src/pickup.ts | 0 | 0 | 1 |

## 6. Verification

- tsc --noEmit: exit 0 (after each phase)
- vite build: exit 0
- Lore tape check: 6 entries in rooms.ts use shade-tape:recorder, no
  tint, no scale override. Confirmed unchanged.

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Atlas frame missing | Phase 0 verified all 3 present. |
| E2 | Sprite dimensions mismatch brief | Actual dimensions used for scale. |
| E3 | Trapdoor open visual | Alpha 0.4 dimming. Conservative, tunable. |
| E4 | Workbench overlay z-fighting | zIndex 81 vs bench 80. No conflict. |
| E5 | Overlay covers other props | Recorder at x=1500. No other prop at this x in reception. |
| E6 | Broken tape pickup y | Pickup y=-10 unchanged. Anchor (0.5, 1.0). Floor-seated. |
| E7 | shouldShowWorkbenchPulse consistency | Overlay and pulse gate on same predicate. |
| E8 | Death cleanup | destroyWorkbenchOverlay runs in destroyPulseRings chain. |
| E9 | Room change cleanup | destroyPulseRings runs in destroyRoomContents. |
| E10 | Pickup respawn after death | rooms.ts config drives respawn. New frame applied. |
| E11 | One broken tape per room | No layering concern. |
| E12 | Chain detail on trapdoor | Sprite includes chains. Extends slightly beyond door body. |
| E13 | Prompt on broken tapes | Prompt reads pickup.config.id, not frame. Safe. |
| E14 | HUD inventory icon | Inventory uses separate icon system, not pickup frame. |
| E15 | Vignette tint on custom sprites | Custom sprites tint normally. |
| E16 | Scale field on PickupConfig | Added as optional. Default 0.3 preserved. |
| E17 | Build per phase | Phase 1: exit 0. Phase 2: exit 0. Phase 3: exit 0. |

## 7. Trade-offs

Trapdoor open state uses alpha dimming instead of a custom "open"
sprite. A dedicated `puzzle-props:trapdoor_open` would be more
expressive but requires another ChatGPT sprite generation. The dimming
reads as "resolved, no longer active" and is tunable (raise alpha to
0.6 for subtler fade, lower to 0.2 for stronger).

The workbench overlay is static. The U.3 PulseRing provides the
animated layer. Combined, a pulsing ring + a tape recorder sprite
reads as "active tape station."

Broken tape scale 0.08 is calculated from 1258px source to ~101px
display. The calculation assumes the atlas.json dimensions are
authoritative (they are). If the source PNGs are regenerated at
different sizes, the scale must be recalculated.

The tint field on PickupConfig (from U.6) is preserved as a generic
mechanism even though broken tapes no longer use it.

## 8. Manual playtest steps

1. Walk to Archives. Confirm the trapdoor renders the custom
   puzzle-props:trapdoor_sealed sprite (chains, metal, sealed look).
   Visually distinct from generic vents.
2. Solve whisper puzzle. Confirm trapdoor dims to alpha 0.4.
3. Walk to Reception with no broken tapes. Confirm no tape recorder
   overlay on workbench.
4. Pick up broken_tape_01 in cubicles. Confirm the custom
   puzzle-props:broken_tape sprite renders (cracked cassette, visually
   distinct from nearby lore tape shade-tape:recorder).
5. Return to Reception. Confirm tape recorder overlay appears on
   the workbench.
6. Reconstruct all 3 tapes. Confirm overlay disappears.
7. Die. Respawn. Confirm broken tapes use custom sprite on respawn.

## 9. Self-check

- [x] No em dashes.
- [x] Build green at each phase.
- [x] All 17 edge cases walked.
- [x] Trapdoor visual updated (custom sprite, alpha dim on open).
- [x] Workbench overlay wired with correct lifecycle.
- [x] Broken tapes use new frame, no tint.
- [x] Lore tapes unchanged (6 entries verified).
- [x] No tape puzzle internals modified.
- [x] No whisper puzzle internals modified.
- [x] No breaker puzzle internals modified.
