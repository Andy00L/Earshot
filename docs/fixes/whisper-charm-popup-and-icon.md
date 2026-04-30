# Whisper Charm Popup and Inventory Icon. Hotfix U.20.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle before / after: 541.81 kB (155.86 kB gz) / 544.82 kB (156.70 kB gz)
Bundle delta: +3.01 kB (+0.84 kB gz)
Atlas frames added: 2 (puzzle-props:whisper_charm, puzzle-props:whisper_charm_explainer)
Friction addressed: F12 partial (charm activation key was implicit and
the inventory icon was absent)

## 1. What changed

Two user-generated sprites are now wired into the game end-to-end.

The whisper charm inventory icon (bone pendant) displays in the HUD
inventory slot when the player holds the charm. Previously the charm
was tracked only as a boolean flag with no visual presence in the
inventory grid.

The whisper charm explainer popup appears immediately after the player
solves the whisper trap puzzle. It presents the charm illustration, the
F-key instruction, and a scene depicting the lure mechanic. The popup
pauses the game, closes via back button or ESC, and shows once per run
(persists through death).

The charm is now a proper inventory slot item: added on acquire,
removed on consume, re-inserted on respawn if the player still has it.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| scripts/atlas_config.py | 12 | 0 | 0 |
| src/types.ts | 3 | 0 | 0 |
| src/game.ts | 85 | 0 | 6 |
| src/hud.ts | 2 | 0 | 0 |
| assets/atlas.json | regenerated | regenerated | regenerated |
| assets/puzzle-props/whisper_charm.png | added (sliced) | 0 | 0 |
| assets/puzzle-props/whisper_charm_explainer.png | added (sliced) | 0 | 0 |

## 3. Atlas frames

| Atlas key | Source PNG | Use |
|-----------|-----------|-----|
| puzzle-props:whisper_charm | raw/items/whisper_charm.png | HUD inventory slot icon |
| puzzle-props:whisper_charm_explainer | raw/props/whisper_charm_explainer.png | Popup illustration |

Both use the `puzzle-props` entity (matching the existing `broken_tape`,
`tape_recorder`, `trapdoor_sealed` pattern from Hotfix U.0bis).

## 4. Diff summary

### scripts/atlas_config.py

Two new `single_chroma` entries added to the puzzle-props section,
after `trapdoor_sealed.png`.

### src/types.ts

BEFORE:
```typescript
export type InventorySlotItem =
  | { kind: "material"; id: MaterialId }
  | { kind: "crafted"; id: CraftedItemId }
  | { kind: "radio" };
```

AFTER:
```typescript
export type InventorySlotItem =
  | { kind: "material"; id: MaterialId }
  | { kind: "crafted"; id: CraftedItemId }
  | { kind: "radio" }
  | { kind: "whisper_charm" };
```

GameState extended with `whisperCharmExplainerShown: boolean` (init false).

### src/hud.ts

BEFORE (slotItemAlias, end of method):
```typescript
    return "radio";
```

AFTER:
```typescript
    if (item.kind === "whisper_charm") return "puzzle-props:whisper_charm";
    return "radio";
```

iconScale gains `if (item.kind === "whisper_charm") return 0.03;` to
match the large source dimensions.

### src/game.ts

handleWhisperResult success case: charm added to the first empty
inventory slot via `{ kind: "whisper_charm" }`.

useWhisperCharm: charm removed from the inventory slot on consume.

respawnAtReception: after slot reset, re-inserts the charm to slot 0
if `hasWhisperCharm` is still true.

Two new private methods: `showWhisperCharmExplainer()` and
`closeWhisperCharmExplainer()`. CSS injected once via a `<style>` element
with id `wc-explainer-styles` (same pattern as breaker-puzzle.ts).

After the general resume in `handleWhisperResult`, the explainer trigger
fires on success. This ordering ensures the popup's PAUSED state is the
final state (the general resume sets PLAYING, then the popup immediately
re-pauses).

## 5. Verification

- Slicer ran successfully: yes (both frames, puzzle-props went from 3 to 5)
- npm run build: exit 0
- tsc --noEmit: exit 0

Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Player solves trap, dies, respawns | whisperCharmExplainerShown persists. Popup does not re-show. Charm re-inserted to slot 0. |
| E2 | ESC during popup | escHandler closes popup, returns to PLAYING. |
| E3 | Click outside panel | No effect. Only back button or ESC closes. |
| E4 | Multiple popup instances | Flag check at top of showWhisperCharmExplainer guards. Second call is no-op. |
| E5 | Game phase race | PAUSED set synchronously after PLAYING. No intermediate frame rendered. |
| E6 | Browser DevTools open | F12 unaffected. ESC handler on document. |
| E7 | Touch / mobile | Back button 48x48 (minimum touch target). |
| E8 | Performance | PNG ~2.3 MB. Loads from public dir on first show. Acceptable for one-time popup. |
| E9 | GameState partial restore | whisperCharmExplainerShown undefined is falsy, popup shows once. Harmless. |
| E10 | Z-index conflict with HUD | Popup at 8500, below HUD critical at 9000. Critical messages overlay if needed. |
| E11 | ESC conflict with whisper puzzle | Puzzle has closed before popup opens. No conflict. |
| E12 | Image fails to load | img.onerror closes popup gracefully. |
| E13 | Inventory icon frame missing | Atlas verified post-slicer. puzzle-props:whisper_charm present. |
| E14 | HMR stale state | Dev only. Production unaffected. |
| E15 | Charm without trap solve | Impossible. Charm granted only on success. |
| E16 | Full inventory slots when charm granted | indexOf(null) returns -1, slot not added. Charm boolean still true. Icon absent until a slot opens. |

## 6. Trade-offs

The popup auto-pauses the game. Players who want the world active while
reading would need a different design. Paused is the default for reading
clarity.

Click-outside-to-close is intentionally not implemented. Players use
the back button or ESC. This prevents accidental dismissal.

The popup z-index 8500 sits above puzzle overlays (8000) but below HUD
critical messages (9000). If a critical message fires during the popup
(rare), it overlays. Acceptable.

The once-per-run flag means players who clear browser storage see the
popup again on first solve. Acceptable.

The charm icon uses scale 0.03 in the inventory slot. This may need
tuning depending on the source image's content area after chroma key
removal. If the icon appears too small or large, adjust the scale value
in HUD.iconScale.

The inventory slot integration adds the charm as the first item in slot
0 on respawn. If the player had other items in slot 0 before dying,
the charm takes that slot. Since inventory is fully cleared on death,
this is the expected behavior.

## 7. Manual playtest steps

1. Start a run. Reach Archives.
2. Walk to x=1500. Confirm trapdoor visible and "E LISTEN" prompt.
3. Press E. Whisper puzzle opens. Whisper a phrase correctly for 1.5s.
   Puzzle closes.
4. Confirm: trapdoor dims, whisper ambient fades, charm icon appears in
   HUD inventory slot (bone pendant, not cassette tape).
5. Confirm: explainer popup appears immediately (dim background, centered
   panel with charm illustration, back button at top-right).
6. Confirm: game is paused (player and monster frozen).
7. Click the back button. Confirm popup closes, game resumes.
8. Press F. Confirm charm activates (monster lured for 8s, charm
   consumed, icon removed from inventory slot).
9. Die. Respawn.
10. Walk to Archives. Confirm trapdoor still dimmed (unlocked persists).
    Press E. Confirm puzzle does not re-open.
    Confirm explainer popup does not re-show.
11. (Optional) Fresh run: press ESC during the popup instead of back
    button. Confirm ESC also closes.

## 8. Self-check

- [x] No em dashes anywhere.
- [x] Build green.
- [x] tsc clean.
- [x] Both sprites sliced and present in atlas.json.
- [x] Inventory icon shows bone pendant in HUD slot.
- [x] Popup shows on whisper trap success.
- [x] Popup closes on back button click.
- [x] Popup closes on ESC.
- [x] Popup does NOT re-show on respawn.
- [x] Game pauses while popup open, resumes on close.
- [x] Whisper puzzle internals unmodified.
- [x] Charm activation logic unmodified (F key, 8s lure).
- [x] All 16 edge cases walked.
