# Materials Cleanup. Hotfix U.8.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 536.98 kB (154.75 kB gz) / 536.59 kB (154.68 kB gz)
Delta: -0.39 kB (-0.07 kB gz)
Friction addressed: F6 (MEDIUM)
Tutorial regen: B (subtitle-only, audio file unchanged)

## 1. What changed

Four material pickups removed from rooms.ts. Players no longer collect
wire, glass_shards, battery, or tape into inventory slots that lead
nowhere. The crafting code (src/crafting.ts, src/workbench-menu.ts)
remains dormant per Hotfix Q's preservation policy. The MaterialId type
in types.ts is also preserved.

The tutorial_t3 transcript was updated to remove the "Collect materials
along the way" sentence. The audio file was NOT regenerated (Path B).
The recorded audio still includes the old sentence. The subtitle shows
the updated text. This mismatch is documented as a known trade-off.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/rooms.ts | 0 | 28 | 0 |
| src/audio-catalog.ts | 0 | 0 | 2 |

## 3. Diff summary

### src/rooms.ts

Four pickup entries removed (7 lines each):

| Room | Material | x | Lines removed |
|------|----------|---|---------------|
| Reception | tape | 2100 | 7 |
| Cubicles | glass_shards | 900 | 7 |
| Server | wire | 2000 | 7 |
| Archives | battery | 1100 | 7 |

Remaining pickups in each room verified:
- Reception: tape_01 (lore tape, x=2400)
- Cubicles: keycard (x=1600), tape_02 (x=2300), broken_tape_01 (x=2100)
- Server: breaker_switch (x=2700), tape_03 (x=400), broken_tape_02 (x=1100)
- Archives: map_fragment (x=2000), tape_04 (x=1800), tape_05 (x=500)

The map_fragment pickup at archives x=2000 uses frame "materials:keycard"
(visual similarity to keycard sprite). This is NOT a material pickup; it
is a quest item gated by hasMapFragment. Preserved correctly.

### src/audio-catalog.ts

Two string updates:

BEFORE (line 746, tutorial_t3 prompt):
```
    prompt: "Find the keycard, flip the breaker, reach the stairwell. Collect materials along the way.",
```

AFTER:
```
    prompt: "Find the keycard, flip the breaker, reach the stairwell.",
```

BEFORE (line 791, TUTORIAL_TRANSCRIPTS):
```
  tutorial_t3: "Find the keycard, flip the breaker, reach the stairwell. Collect materials along the way.",
```

AFTER:
```
  tutorial_t3: "Find the keycard, flip the breaker, reach the stairwell.",
```

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.27s
- Material grep in rooms.ts: zero matches for wire, glass_shards,
  battery, or bare "tape" material pickup.
- Only remaining "materials:" frame reference is materials:keycard for
  the map_fragment (preserved correctly).

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Mid-game stale materials | Persist until respawn. GameState resets on death. Temporary. |
| E2 | Shade death-drop with materials | Shade snapshots inventorySlots. No materials after respawn. |
| E3 | Tutorial audio mismatch | Path B. Audio says "Collect materials." Subtitle does not. Documented. |
| E4 | MaterialId unused import | MaterialId not imported in rooms.ts. Used by PickupId union in types.ts. No unused import. |
| E5 | PickupId union still includes materials | Preserved per Hotfix Q policy. Union members never spawn. |
| E6 | Bundle delta | -0.39 kB. Smaller. |
| E7 | Rooms visually emptier | One fewer sprite per room. Net clarity gain per diagnostic. |
| E8 | Inventory slot rendering | Dynamic (hud.ts reads inventorySlots array). Empty slots render as empty. No breakage. |
| E9 | No save persistence | Rooms rebuilt from config. |
| E10 | HMR dev reload | Existing materials in memory persist until page refresh. Acceptable. |
| E11 | Accessibility | Material icons removed. Charm and radio remain. No regression. |
| E12 | Tutorial audio regen | Path B chosen. Audio file unchanged. Subtitle updated. |

## 5. Trade-offs

Rooms are slightly emptier with one fewer pickup sprite each. The
diagnostic rated this as net positive: players no longer collect items
expecting a crafting payoff that was removed in Hotfix Q.

The tutorial audio mismatch (Path B) is audible. Players who listen
and read subtitles simultaneously will notice the audio says "Collect
materials along the way" while the subtitle omits it. Regenerating the
audio (Path A) costs approximately 150 ElevenLabs credits. If budget
allows, run:
```
npx tsx scripts/generate-audio.ts --only tutorial_t3 --force
```

The inventory slot count remains at 3. With materials gone, slots are
typically empty or hold at most 1 item (whisper charm or radio). The
extra empty slots are not distracting and allow room for future items.

## 6. Manual playtest steps

1. Spawn in reception. Confirm NO tape material at x=2100. Lore tape
   at x=2400 still visible.
2. Walk to cubicles. Confirm NO glass_shards at x=900. Keycard at
   x=1600 and broken_tape_01 at x=2100 still visible.
3. Walk to server. Confirm NO wire at x=2000. Breaker at x=2700 and
   broken_tape_02 at x=1100 still visible.
4. Walk to archives. Confirm NO battery at x=1100. Map fragment at
   x=2000 still visible.
5. Trigger tutorial_t3. Confirm subtitle reads "Find the keycard, flip
   the breaker, reach the stairwell." without materials reference.
6. Pick up keycard, solve breaker, collect broken tapes. Confirm
   inventory slots show only relevant items (no materials).
7. Die. Confirm shade drops only non-material items. Respawn. Confirm
   no materials appear in any room.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] No new TS errors or warnings.
- [x] All 12 edge cases walked.
- [x] No material pickups in any room.
- [x] Crafting code untouched (src/crafting.ts, src/workbench-menu.ts preserved).
- [x] Tutorial transcript updated.
- [x] Audio regen decision documented (Path B).
