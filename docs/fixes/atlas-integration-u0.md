# Atlas Integration for New Sprites. Hotfix U.0.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3

Build before: exit 0 (baseline, no new sprites in atlas)
Build after: exit 0 (tsc --noEmit + vite build)

Atlas profile pattern: flat dict keyed by PNG basename (Pattern A).
Entity used: `puzzle-props` (separate from existing `props` tileset to avoid overwrite).
Chroma pipeline: green HSV removal (H:35-85). Source PNGs had magenta backgrounds, pre-converted to green before slicing.

## 1. What was added

Three new atlas frames sourced from raw/props/:

| Frame | Source size | Sliced size | Entity |
|-------|-----------|-------------|--------|
| puzzle-props:broken_tape | 1448x1086 | 1258x953 | puzzle-props |
| puzzle-props:tape_recorder | 1536x1024 | 1396x807 | puzzle-props |
| puzzle-props:trapdoor_sealed | 1254x1254 | 933x1124 | puzzle-props |

Each uses the existing `single_chroma` profile type with green chroma key removal and 2px feathered edges.

TypeScript access pattern: `getFrameTexture(manifest, "puzzle-props", "broken_tape")` or `Assets.get("puzzle-props:broken_tape")`.

## 2. Background color conversion

The source PNGs had impure magenta backgrounds (corner samples: (249,2,251), (244,2,243), (250,1,252)). The existing chroma pipeline targets green (HSV H:35-85), not magenta (HSV H ~150). The raw PNGs were pre-processed to convert magenta pixels to pure green (0,255,0) using an HSV mask (H:125-175, S:60+, V:60+). Conversion rates: 51.0%, 39.2%, 33.7% of pixels per file.

This is input preparation, not a slicer modification. The slicer code (slice.py, chroma.py) was not changed.

## 3. Files changed

| File | Change |
|------|--------|
| scripts/atlas_config.py | +18 lines (3 new single_chroma entries) |
| assets/atlas.json | regenerated (1 new entity, 3 new frames) |
| assets/puzzle-props/broken_tape.png | added |
| assets/puzzle-props/tape_recorder.png | added |
| assets/puzzle-props/trapdoor_sealed.png | added |
| assets/preview.html | regenerated (includes puzzle-props section) |

## 4. Diff summary

BEFORE (atlas_config.py, line 518):
```python
    # ── New full-scene backgrounds ───────────────────────────────────────
```

AFTER (atlas_config.py, lines 518-537):
```python
    # ── Puzzle prop sprites (single chroma-keyed objects) ──────────────

    "broken_tape.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["broken_tape"],
        "chroma_key": True,
    },
    "tape_recorder.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["tape_recorder"],
        "chroma_key": True,
    },
    "trapdoor_sealed.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["trapdoor_sealed"],
        "chroma_key": True,
    },

    # ── New full-scene backgrounds ───────────────────────────────────────
```

## 5. Verification

File presence: 3 PNGs in raw/props/ confirmed (broken_tape.png, tape_recorder.png, trapdoor_sealed.png).

File sizes (raw): 2,426,031 bytes, 2,989,745 bytes, 2,551,561 bytes.

Image dimensions (actual vs brief):

| Sprite | Brief | Actual source | Sliced (trimmed) |
|--------|-------|---------------|------------------|
| broken_tape | 200x150 | 1448x1086 | 1258x953 |
| tape_recorder | 300x200 | 1536x1024 | 1396x807 |
| trapdoor_sealed | 400x400 | 1254x1254 | 933x1124 |

ChatGPT generated at higher resolution than the briefs specified. Downstream code must use the atlas.json dimensions, not the brief dimensions.

Corner pixel (5,5) after green conversion: (0, 255, 0) for all 3 files.

Slicer output:

| File | Present | Transparent | Opaque | Green remnants |
|------|---------|-------------|--------|----------------|
| broken_tape.png | yes | 35.3% | 62.7% | 0 |
| tape_recorder.png | yes | 15.1% | 84.1% | 0 |
| trapdoor_sealed.png | yes | 0.9% | 98.0% | 0 |

atlas.json frames: 3 new entries under entity "puzzle-props" (type: "character").

preview.html: puzzle-props section present (4 references).

Visual QA: all 3 sprites render with transparent backgrounds, no halos, no color bleed. Trapdoor chain/padlock details intact. Tape recorder cable and VU meters preserved. Broken tape ribbon detail preserved.

npm run build: exit 0 (tsc --noEmit + vite build).

## 6. Entity naming decision

The existing `props` entity (atlas type "tileset", 12 tiles) could not be shared with the new single_chroma entries. In build_atlas_json(), single_chroma results are grouped as "character" type. Using entity="props" would overwrite the tileset, destroying all 12 existing prop sprites.

Resolution: entity "puzzle-props" was chosen. Downstream code (Hotfix U.4, U.5, U.6) must reference frames as `puzzle-props:broken_tape`, `puzzle-props:tape_recorder`, `puzzle-props:trapdoor_sealed`.

## 7. Edge cases walked

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Source dimensions differ from brief | Actual sizes 5-7x larger. Documented for downstream. |
| E2 | RGBA with existing transparency | Source was RGB mode, no pre-existing alpha. Safe. |
| E3 | Stray magenta in sprite content | No magenta-colored content in any sprite. All browns/grays/metals. |
| E4 | Tolerance variation across sprites | Green conversion uniform. Pipeline HSV thresholds handled all 3. |
| E5 | Slicer overwrites existing sprites | New entity, no overwrites. Existing entries preserved. |
| E6 | atlas.json regeneration order | Existing entries intact. 26 entities total (was 25). |
| E7 | Build fails after slicing | Build exit 0 confirmed. |
| E8 | Python dependencies missing | All installed (Pillow, numpy, scipy, opencv). Slicer ran. |
| E9 | Windows path backslashes | pathlib handles cross-platform. No issues. |
| E10 | Filename mismatch (hyphen vs underscore) | Config keys match raw filenames exactly. |
| E11 | Slicer cache/skip | No caching. All entries processed fresh. |
| E12 | Teal glow near magenta HSV | Trapdoor metallic frame preserved. HSV distance from magenta is large. |
| E13 | PNG color profile shifts | Impure magenta (up to 15 units drift) covered by HSV mask width. |
| E14 | Slicer performance | Completed in < 20 seconds. No hang. |
| E15 | Preview HTML broken | preview.html generated, puzzle-props section present. |

## 8. Trade-offs

The 3 sprites use single_chroma profile, matching existing single-object entries. No new profile type introduced.

The magenta-to-green pre-processing is a one-time operation on the raw PNGs. If the raw PNGs are regenerated, the conversion must be re-applied before slicing. The slicer itself does not understand magenta backgrounds.

Entity "puzzle-props" is separate from "props". This avoids the overwrite conflict but means downstream code uses a different entity name than "props".

## 9. Path A unlocked

After this hotfix, Hotfix U.4 (trapdoor affordance), U.5 (workbench affordance), and U.6 (broken tape distinct) can use Path A (custom sprites) instead of Path B (code-only fallback). The atlas frames are:

- `puzzle-props:broken_tape` (1258x953 sliced)
- `puzzle-props:tape_recorder` (1396x807 sliced)
- `puzzle-props:trapdoor_sealed` (933x1124 sliced)

## 10. Self-check

- [x] No em dashes anywhere.
- [x] No TypeScript code modified.
- [x] Atlas profile pattern matches existing single_chroma convention.
- [x] All 15 edge cases walked.
- [x] Slicer ran successfully.
- [x] preview.html shows 3 clean sprites.
- [x] Build green.
- [x] 3 new frames in atlas.json: puzzle-props:broken_tape, puzzle-props:tape_recorder, puzzle-props:trapdoor_sealed.
- [x] Existing props tileset (12 tiles) preserved.
- [x] No commit made.
