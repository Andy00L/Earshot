> This audit was generated on 2026-04-26. Many sprite usages and audio catalog entries have changed since (41 hotfixes shipped after this date). Treat as historical context only.

# Earshot Asset Usage Audit

Date: 2026-04-26
Total assets on disk: 278
Total disk size: 75 MB (images ~71 MB, audio ~4.1 MB, other ~74 KB)

## Summary

- Assets used: 193 (142 images, 50 audio, 1 other)
- Assets unused on disk: 83 (76 images, 6 audio, 1 other)
- Assets ambiguous: 6 (whisperer idle frames)
- Code references missing files: 3 (all audio)
- Estimated recoverable disk space from unused assets: ~22.5 MB

## Section 1. Unused Assets (Candidates for Deletion)

### 1a. Unused Images

#### Debug artifacts (not in atlas, not referenced in code)

| File | Size | Reason |
|------|------|--------|
| `assets/_debug/player-caught_debug.png` | 1.4 MB | Debug-only sprite sheet preview, not in atlas.json |
| `assets/_debug/radio_debug.png` | 1.6 MB | Debug-only sprite sheet preview, not in atlas.json |

#### Backgrounds (in atlas, loaded, never displayed)

(None remaining after Phase 9. `gameover.png` and `server-upper.png` are now USED.)

#### Entire entity groups (in atlas, no code references any frame)

| Entity | Files | Total Size | Reason |
|--------|-------|------------|--------|
| `bookshelves/` | 6 (normal, fake, ajar-30, ajar-90, cabinet, storage-rack) | ~1.9 MB | In atlas, but no room `decorativeProps` or code references any bookshelf frame |

#### Entity groups wired in Phase 9 (DO NOT DELETE)

| Entity | Files | Total Size | Status |
|--------|-------|------------|--------|
| `cubicle-dividers/` | 6 frames | ~1.3 MB | USED. Phase 9 wired as foreground props in Cubicles room |
| `traversal/` | 6 frames | ~770 KB | USED. Phase 9 wired for Server room ladder (ladder-bottom, ladder-mid, ladder-top, hatch) |
| `server-upper.png` | 1 file | 2.7 MB | USED. Phase 9 renders as upper floor background in Server room |
| `gameover.png` | 1 file | 1.2 MB | USED. Phase 9 renders in death overlay via HTML img element |
| `intro/` | 3 files (intro-panel-1/2/3.png) | ~6.3 MB | USED. Phase B intro panels, loaded directly via Assets.load (not in atlas.json) |

#### Partial entity groups (some frames used, some not)

**Jumper** - 6 of 48 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `jumper/run1-6` | ~640 KB | No JumperState maps to "run" prefix |

Note: `jumper/getup1-6` USED by floor variant states `emerging`, `fake_attacking`, `getting_up` (per-variant frame remap, Hotfix H). `jumper/walk1-6` USED by floor `crawling` and `retreating` (reversed playback). `jumper/emerge1-6` and `jumper/retreat1-6` now ceiling-variant only.

**Player** - 12 of 49 frames unused (18 new hide-desk frames are USED, wired in Prompt 2):

| Frames | Size | Reason |
|--------|------|--------|
| `player/crouch` | 83 KB | Not in any PLAYER_ANIM state definition. States use `crouch-idle1/2` and `crouch-walk1-4` instead |
| `player/dead` | 91 KB | Not in any animation state. CAUGHT uses `caught1-3, dead-collapsed` |
| `player/dead-blood` | 98 KB | Not in any animation state |
| `player/dead-flashlight-out` | 101 KB | Not in any animation state |
| `player/run-look-back` | 124 KB | Not in any animation state |
| `player/run-stop` | 130 KB | Not in any animation state |
| `player/scared-idle1, scared-idle2` | ~242 KB | Not in any animation state. Possibly planned for high-suspicion variant |
| `player/scared-walk1-4` | ~525 KB | Not in any animation state. Possibly planned for high-suspicion variant |

**Flare** - 2 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `flare/igniting` | 152 KB | `FlareEffect` goes straight to `burn1` on creation; no ignition animation implemented |
| `flare/dying` | 108 KB | `FlareEffect` transitions from burn directly to `burnt-out`; no dying animation implemented |

**Smokebomb** - 1 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `smokebomb/ignited` | 74 KB | `SmokeBombEffect` starts at `smoke1` and ends at `dissipating`; ignited frame not referenced |

**Decoy-radio** - 2 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `decoy-radio/armed` | 159 KB | `DecoyEffect` starts at `broadcasting1`; armed frame not referenced |
| `decoy-radio/peak` | 235 KB | Broadcast animation alternates `broadcasting1/2` only; peak not referenced |

**Shade-tape** - 2 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `shade-tape/recorder-active` | 258 KB | Rooms use `shade-tape:recorder` for pickup frame; no code transitions to `recorder-active` |
| `shade-tape/recorder-finished` | 250 KB | No code transitions to `recorder-finished` |

**Materials** - 1 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `materials/fuse` | 131 KB | In atlas but "fuse" is not a valid `MaterialId` (type is `wire | glass_shards | battery | tape`). Not placed in any room, not in any crafting recipe |

**Vents** - 4 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `vents/closed` | 213 KB | Code only uses `vents:open` (vent sprites) and `vents:drip` (jumper drip sprites) |
| `vents/eyes` | 208 KB | Same |
| `vents/bent` | 199 KB | Same |
| `vents/sealed` | 219 KB | Same |

**Workbench** - 5 of 6 frames unused:

| Frames | Size | Reason |
|--------|------|--------|
| `workbench/bench-glow` | 200 KB | Only `workbench:bench` is used in rooms.ts `decorativeProps`. No code transitions to other workbench frames |
| `workbench/crafting` | 226 KB | Same |
| `workbench/finished-item` | 207 KB | Same |
| `workbench/tool-rack` | 170 KB | Same |
| `workbench/crate` | 229 KB | Same |

**UI** - 7 of 28 frames unused (16 new indicator frames + arrow-guidance are USED, wired in Prompt 3):

| Frames | Size | Reason |
|--------|------|--------|
| `ui/craft-button-available` | 685 KB | Workbench menu is HTML-based (`WorkbenchMenu` class). No code references these atlas textures |
| `ui/craft-button-locked` | 614 KB | Same |
| `ui/craft-menu-bg` | 1.4 MB | Same |
| `ui/flare-light-overlay` | 1.3 MB | `FlareEffect` uses a Graphics circle for glow; this texture is unreferenced |
| `ui/minimap-frame` | 427 KB | `Minimap` class draws everything with Graphics primitives; these atlas textures are unreferenced |
| `ui/minimap-player-dot` | 5.7 KB | Same |
| `ui/minimap-room-tile` | 58 KB | Same |

### 1b. Unused Audio (on disk, loaded by audioManager, never played)

| File | Size | Reason |
|------|------|--------|
| `assets/audio/flashlight_click.mp3` | 17 KB | In catalog, loaded. No code calls `playOneShot("flashlight_click")` or `loop("flashlight_click")` |
| `assets/audio/player_breath_normal.mp3` | 64 KB | In catalog, loaded. No code calls `playOneShot("player_breath_normal")` or `loop("player_breath_normal")` |
| `assets/audio/radio_intro.mp3` | 109 KB | In catalog, loaded. Radio system now uses runtime TTS (`synthesizeTTS`); no code plays these pre-recorded radio hints |
| `assets/audio/radio_keycard_hint.mp3` | 61 KB | Same |
| `assets/audio/radio_breaker_hint.mp3` | 92 KB | Same |
| `assets/audio/radio_exit_hint.mp3` | 90 KB | Same |

### 1c. Unused Other

| File | Size | Reason |
|------|------|--------|
| `assets/preview.html` | 31 KB | Generated by atlas slicer for visual preview. Not loaded by game |

## Section 2. Missing Assets (Referenced in Code, Absent on Disk)

3 missing assets remain, all audio. The `audioManager.loadAll()` method logs a warning and continues for each missing file. Call sites either use `audioManager.has()` to guard playback (silent skip) or call `playOneShot()` directly (returns `null`, no sound plays).

| Code reference | Missing key | has() guard? | Impact |
|----------------|-------------|-------------|--------|
| `game.ts:989` (dynamic: `` `${toRoom}_ambient` ``) | `archives_ambient` | No (crossfadeAmbient warns) | Archives room has no ambient music. Console warning on enter |
| `game.ts:2159`, `decoy-effect.ts:39` | `static_burst` | Yes (`has()` check) | Fallback to random monster vocal. Decoy radio uses monster growl instead |
| `game.ts:2100, 2363` | `radio_throw` | Yes (`has()` check) | Silent skip. Radio throw has no sound |

## Section 3. Ambiguous (Manual Review Required)

### 3a. Whisperer idle frames (6 frames)

Files: `whisperer/idle1-6` (~1.3 MB total)

The `STATE_FRAME_PREFIX` maps the "despawned" state to the "idle" prefix, so `whisperer:idle1-6` are technically the frame set for the despawned state. However, by the time the whisperer reaches "despawned", its sprite alpha is already 0 (faded out in "fading" state), and `game.ts:1926-1928` immediately destroys it. These frames are never visually displayed to the player.

The "idle" state uses an override: `this.state === "idle" ? "glide" : STATE_FRAME_PREFIX[this.state]`, so the visible idle animation uses `glide1-6`, not `idle1-6`.

**Verdict**: Functionally unused but technically referenced. Safe to remove if the despawned state prefix is changed to any other valid set (or left as-is since the sprite is invisible).

### 3b. Dynamic atlas key patterns

The codebase has several patterns that build atlas keys at runtime, making static grep analysis incomplete:

1. **Entity + state animations**: `player.ts`, `monster.ts`, `jumper.ts`, `whisperer.ts` build frame names like `` `${prefix}${index + 1}` ``. All possible prefix+index combinations were audited above by tracing the state machines.

2. **Room ambient mapping**: `game.ts:988` builds `` `${toRoom}_ambient` `` where `toRoom` is a `RoomId`. All 5 rooms were checked; only `archives_ambient` is missing on disk.

3. **Decorative prop frame names**: `game.ts:1790` resolves `` propDef.frameName.includes(":") ? propDef.frameName : "props:" + propDef.frameName ``. All `decorativeProps` entries in `rooms.ts` were audited - they reference only: exit-sign, flickerlight, vent, radio-table, corpse, workbench:bench.

4. **Pickup frame names**: `pickup.ts:13` similarly resolves frame names. All room `pickups` entries were audited.

5. **Hiding spot frame resolution**: `hiding.ts:21` resolves `"props:" + frameName`. The only hiding spot frame names are `desk-hide` and `locker-hide` (from `HidingSpotDef.kind`).

### 3c. `gameover` texture - may be intentionally retained

The `gameover` background was likely used before the death flow was changed to `respawnAtReception()`. It may be needed if the gameover screen is re-enabled in a future phase. Risk of deletion is low (easy to regenerate) but intent is ambiguous.

## Section 4. Asset Categories Breakdown

### Sprites - Player
- Total frames in atlas: 49
- Used in animation states: 37 (19 existing + 18 new hide-desk frames: enter1-6, idle1-6, exit1-6)
- Unused: 12 (scared variants, extra death frames, run-stop, run-look-back, standalone crouch)

### Sprites - Monster (Listener)
- Total frames in atlas: 27
- Used: 27 (all states + confused animation)
- Unused: 0

### Sprites - Jumper
- Total frames in atlas: 48
- Used: 42 (idle, emerge, fall, attack, retreat, getup, walk - 6 frames each)
- Unused: 6 (run - 6 frames)

### Sprites - Whisperer
- Total frames in atlas: 24
- Used: 18 (spawn, glide, fade - 6 frames each)
- Ambiguous: 6 (idle - assigned to despawned state but never visible)

### Sprites - Props
- Total frames in atlas: 12
- Used: 12

### Sprites - Decoy Radio
- Total: 6 | Used: 4 (broadcasting1/2, spent, idle) | Unused: 2 (armed, peak)

### Sprites - Flare
- Total: 6 | Used: 4 (burn1/2, burnt-out, unlit) | Unused: 2 (igniting, dying)

### Sprites - Smokebomb
- Total: 6 | Used: 5 (smoke1/2/3, dissipating, idle) | Unused: 1 (ignited)

### Sprites - Shade/Tape
- Total: 6 | Used: 4 (shade1-3, recorder) | Unused: 2 (recorder-active, recorder-finished)

### Sprites - Materials
- Total: 6 | Used: 5 (wire, glass, battery, tape, keycard) | Unused: 1 (fuse)

### Sprites - Vents
- Total: 6 | Used: 2 (open, drip) | Unused: 4 (closed, eyes, bent, sealed)

### Sprites - Workbench
- Total: 6 | Used: 1 (bench) | Unused: 5 (bench-glow, crafting, finished-item, tool-rack, crate)

### Sprites - UI
- Total: 28 | Used: 21 (4 existing + 16 new indicator + arrow-guidance: back-button, click-to-continue, key-ctrl/e/g/r, label-climb/craft/crouch/grab/hide/interact/pickup/restart/throw, mouse-click, arrow-guidance) | Unused: 7

### Sprites - Bookshelves
- Total: 6 | Used: 0 | Unused: 6

### Sprites - Cubicle Dividers
- Total: 6 | Used: 0 | Unused: 6

### Sprites - Traversal
- Total: 6 | Used: 0 | Unused: 6

### Backgrounds
- Total: 9 | Used: 7 (5 rooms + title + radio) | Unused: 2 (gameover, server-upper)

### Audio - Ambient
- Total in catalog: 5 | On disk: 4 | Missing: 1 (archives_ambient) | Used: 4

### Audio - Monster Vocals
- Total in catalog: 8 (6 standard + 2 confused) | On disk: 8 | Missing: 0 | Used: 8

### Audio - SFX
- Total in catalog: 20 | On disk: 18 | Missing: 2 (static_burst, radio_throw) | Used: 16 | On disk but never played: 2 (flashlight_click, player_breath_normal)
- New in Prompt 1: monster_dash_screech (Listener dash), jumper_vent_creak, jumper_peek_breath, jumper_fakeout_hiss (Jumper peek/fake-out). USED. Wired in Prompt 2 + Prompt 3.

### Audio - Radio Voice (pre-recorded hints)
- Total in catalog: 4 | On disk: 4 | Used: 0 (radio system switched to runtime TTS)

### Audio - Whisperer Voice
- Total in catalog: 9 | On disk: 9 | Used: 9

### Audio - Lore Tapes
- Total in catalog: 6 | On disk: 6 | Used: 6

### Audio - Tutorials
- Total in catalog: 4 | On disk: 4 | Used: 4

### Audio - Intro Narration
- Total in catalog: 3 | On disk: 3 | Used: 3

## Section 5. Bundle Size

### Total sizes

| Category | Size |
|----------|------|
| `assets/` total | 75 MB |
| `assets/audio/` | 4.1 MB |
| Images (estimated) | ~71 MB |

### Top 15 largest files

| File | Size |
|------|------|
| `assets/stairwell.png` | 5.2 MB |
| `assets/reception.png` | 4.7 MB |
| `assets/server.png` | 4.4 MB |
| `assets/cubicles.png` | 4.4 MB |
| `assets/server-upper.png` | 2.7 MB |
| `assets/archives.png` | 2.4 MB |
| `assets/title.png` | 2.2 MB |
| `assets/_debug/radio_debug.png` | 1.6 MB |
| `assets/ui/craft-menu-bg.png` | 1.4 MB |
| `assets/_debug/player-caught_debug.png` | 1.4 MB |
| `assets/ui/flare-light-overlay.png` | 1.3 MB |
| `assets/gameover.png` | 1.2 MB |
| `assets/radio.png` | 727 KB |
| `assets/ui/craft-button-available.png` | 685 KB |
| `assets/ui/craft-button-locked.png` | 614 KB |

### Unused files in top 15

5 of the 15 largest files are unused:
- `server-upper.png` (2.7 MB)
- `_debug/radio_debug.png` (1.6 MB)
- `ui/craft-menu-bg.png` (1.4 MB)
- `_debug/player-caught_debug.png` (1.4 MB)
- `ui/flare-light-overlay.png` (1.3 MB)
- `gameover.png` (1.2 MB)

These 6 files alone total ~9.6 MB.

## Section 6. Recommendations

### Safe to delete (high confidence)

| Category | Files | Savings | Rationale |
|----------|-------|---------|-----------|
| `_debug/` directory | 2 | ~3.0 MB | Debug artifacts, not in atlas, no code refs |
| `assets/preview.html` | 1 | 31 KB | Slicer tooling artifact, not loaded by game |
| `bookshelves/` | 6 | ~1.9 MB | Entire entity unused. Also remove from atlas.json |
| `cubicle-dividers/` | 6 | ~1.3 MB | Entire entity unused. Also remove from atlas.json |
| `traversal/` | 6 | ~770 KB | Entire entity unused. Also remove from atlas.json |
| `ui/minimap-*` | 3 | ~490 KB | Minimap uses Graphics, not textures. Remove from atlas.json |
| `ui/craft-button-*`, `ui/craft-menu-bg` | 3 | ~2.7 MB | Workbench menu is HTML-based. Remove from atlas.json |
| Radio voice audio | 4 | ~350 KB | Radio system uses runtime TTS. Remove from catalog too |

### Probably safe to delete (medium confidence)

| Category | Files | Savings | Rationale |
|----------|-------|---------|-----------|
| `gameover.png` | 1 | 1.2 MB | Death flow uses respawn, not gameover screen. May want to retain if gameover screen is re-enabled |
| `server-upper.png` | 1 | 2.7 MB | No code reference found. May have been planned for a split-level server room |
| `ui/flare-light-overlay.png` | 1 | 1.3 MB | FlareEffect uses Graphics for glow. Texture appears unused |
| Jumper run | 6 | ~640 KB | No JumperState maps to "run" prefix. getup and walk now USED by floor variant |
| Player scared/dead variants | 12 | ~1.4 MB | Not in any animation state. May be planned for future phases |
| Partial effect frames (flare igniting/dying, smokebomb ignited, decoy armed/peak, shade recorder-active/finished) | 9 | ~1.3 MB | Effect classes don't use these transition frames |
| Vent variants (closed/eyes/bent/sealed) | 4 | ~840 KB | Only `open` and `drip` are used |
| Workbench non-bench frames | 5 | ~1.0 MB | Only `bench` is referenced |
| `materials/fuse` | 1 | 131 KB | Not a valid MaterialId, not in any room or recipe |
| `flashlight_click.mp3`, `player_breath_normal.mp3` | 2 | ~81 KB | In catalog but never played. Remove from catalog too |

### Generate these missing audio files

| Missing ID | Call sites | Has guard? | Impact |
|------------|-----------|------------|--------|
| `archives_ambient` | Dynamic ambient crossfade | Warn + skip | Archives room is silent |
| `static_burst` | `game.ts:2159`, `decoy-effect.ts:39` | Yes | Decoy falls back to monster growl |
| `radio_throw` | `game.ts:2100, 2363` | Yes | Radio throw is silent |

Command to generate all missing audio:
```bash
npx tsx scripts/generate-audio.ts --only archives_ambient,static_burst,radio_throw
```

### Code cleanup (out of scope for this audit, noted for reference)

- Remove unused audio IDs from catalog: `flashlight_click`, `player_breath_normal`, `radio_intro`, `radio_keycard_hint`, `radio_breaker_hint`, `radio_exit_hint`
- Remove unused entities from atlas.json: `bookshelves`, `cubicle-dividers`, `traversal`
- Remove unused frames from atlas.json entities that have partial usage
- Add `has()` guards to `static_burst`, `radio_throw` call sites (or generate the files)

## Section 7. Audit Methodology

### Disk inventory
- `find assets -type f` for complete file listing
- `ls -lh` for file sizes
- `du -sh` for directory totals

### Code reference collection
- `atlas.json` parsed to extract all registered entity:frame aliases
- `Assets.get<Texture>(...)` calls grepped across all src/*.ts files
- `getFrameTexture(manifest, entity, frame)` calls traced through player.ts, monster.ts, jumper.ts, whisperer.ts
- Animation state machines traced: `STATE_FRAMES`, `PLAYER_ANIM`, `STATE_FRAME_PREFIX` maps resolved to determine which frame prefixes are reachable
- `audioManager.playOneShot()`, `audioManager.loop()`, `audioManager.crossfadeAmbient()` calls grepped
- `audioManager.has()` guard patterns identified at each call site
- `AUDIO_CATALOG` entries enumerated and cross-referenced with disk files
- Room definitions in `rooms.ts` traced for: `background`, `pickups[].frame`, `decorativeProps[].frameName`, `hidingSpots`
- `index.html` checked for direct file path references (found: `/title.png` in CSS)

### Limitations
- Dynamic string construction (`"props:" + frameName`, `` `${entity}:${frame}` ``) was traced manually through all call sites. If a future code change introduces new dynamic patterns, this audit would miss them.
- The whisperer `isDespawned()` -> destroy flow was verified in game.ts, but edge cases (e.g., tab-away during fade) could theoretically display idle frames briefly.
- Atlas loading (`assets.ts:loadGameAssets`) loads ALL entries from atlas.json regardless of usage. "Unused" means "loaded into texture cache but never assigned to a visible Sprite", not "never loaded."
- The `audioManager.loadAll()` method loads ALL catalog entries. Failed loads (missing files) log a warning but don't throw. "Missing" audio causes silent skips, not crashes.
