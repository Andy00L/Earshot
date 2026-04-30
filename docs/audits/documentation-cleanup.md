# Documentation Cleanup. 2026-04-30.

## What changed

- **Rewrote README.md** (was 448 lines, now 49 lines). Replaced badge-heavy technical spec with a hook-first player-facing README. Removed crafting references. Fixed package manager to npm. Added docs navigation.
- **Updated ARCHITECTURE.md** (was 557 lines, now 379 lines, 32% reduction). Added CINEMATIC game phase, 5 new player states (RUN_STOP, SCARED_IDLE, SCARED_WALK, and corrected move speeds for all), GainNode in mic pipeline, tape-puzzle.ts module. Marked crafting.ts/workbench-menu.ts as dormant. Updated audio catalog count from 56/60 to 86. Trimmed minimap, rooms, rendering layers, and data flow sections. Replaced detailed radio bait sequence diagram with prose.
- **Created docs/CHANGELOG.md** (86 lines) consolidating all 41 hotfix reports into reverse-chronological single-sentence entries.
- **Moved DAY*.md to docs/journal/** (5 files) with an index README explaining the folder's purpose.
- **Moved ASSET_USAGE_AUDIT_REPORT.md to docs/audits/** with a staleness note (audit predates 41 hotfixes).
- **Updated .env.example** comment to correctly state server-side usage via Vercel proxy (was incorrectly claiming Vite client bundle injection).

## What was kept

- REFERENCE_DOCUMENTATION_AUDIT.md at root (prompt standard)
- REFERENCE_SECURITY_AUDIT.md at root (prompt standard)
- All 41 hotfix reports in docs/fixes/ (preserved as deep history)
- scripts/README.md (asset pipeline docs)
- Source code untouched (0 .ts/.py/.json files modified)

## What's still rough

- No demo URL in README. The game deploys to Vercel but the production URL is not documented. A human should add the URL once known.
- CHANGELOG uses no blank lines between entries to fit the 100-line target. Readable on GitHub but may look dense in some editors.
- ARCHITECTURE.md audio catalog count says 86 (matching MP3 files on disk). The AUDIO_CATALOG constant in source may define a different number of entries. A human should verify the count matches if the catalog was modified after the last audio generation run.
- No SOCIAL_POSTS_EARSHOT.md or Submission_guide found for tone/submission reference. Phase 6 (submission materials) was largely skipped.
- The minimap section in ARCHITECTURE.md now says "Graphics primitives" based on the asset usage audit, which noted the atlas minimap textures are unreferenced. If the minimap was later rewired to use atlas sprites, this should be updated.
- ARCHITECTURE.md still references the old "Items & Crafting" subgraph label as "tape-puzzle.ts" in the system overview diagram. The subgraph label itself was not renamed (only the node was updated).

## Files modified

| File | Before | After | Delta |
|------|--------|-------|-------|
| README.md | 448 lines | 49 lines | -399 |
| ARCHITECTURE.md | 557 lines | 379 lines | -178 |
| .env.example | 5 lines | 5 lines | 0 (comment fix) |
| docs/audits/ASSET_USAGE_AUDIT_REPORT.md | 392 lines | 394 lines | +2 (staleness note) |

## Files created

| File | Lines |
|------|-------|
| docs/CHANGELOG.md | 86 |
| docs/journal/README.md | 1 |
| docs/audits/documentation-cleanup.md | (this file) |

## Files moved (git mv)

| From | To |
|------|-----|
| docs/DAY2_GAMEPLAY.md | docs/journal/DAY2_GAMEPLAY.md |
| docs/DAY3_AUDIO.md | docs/journal/DAY3_AUDIO.md |
| docs/DAY4_HIDING_AND_PROPS.md | docs/journal/DAY4_HIDING_AND_PROPS.md |
| docs/DAY4_RADIO_BAIT.md | docs/journal/DAY4_RADIO_BAIT.md |
| docs/DAY5_POLISH.md | docs/journal/DAY5_POLISH.md |
| ASSET_USAGE_AUDIT_REPORT.md | docs/audits/ASSET_USAGE_AUDIT_REPORT.md |

## Build verification

`npm run build` (tsc --noEmit + vite build): exit 0 before and after. No source files touched.
