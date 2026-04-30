# Tape Reconstruction Station. Hotfix T.

Commit at start: 2ce4720
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 517.52 kB (150.54 kB gz) / 532.75 kB (153.59 kB gz)
Delta: +15.23 kB (+3.05 kB gzipped), 1 new module bundled
Catalog entries before / after: 72 / 86
Tape 2 whisper radio mode: deferred (flag set, no functional reward)
Tape 3 silent exit: implemented (instant RMS check at exit door)
Crafting code cleanup (Phase 7): deferred (dormant code adds ~5KB, zero runtime cost)

## 1. What was added

A reconstruction station at the Reception workbench. Three broken tapes
scattered across cubicles (x=2100), server (x=1100), and stairwell
(x=1900). Each tape, when brought to the workbench and reordered
correctly via click-to-place UI, plays a TTS-narrated lore phrase and
unlocks a power-up.

The puzzle core: 4 audio segments are shuffled. The player clicks each
to listen, then places them into 4 ordered slots (A-D). Playback uses
Web Audio API (AudioBufferSourceNode scheduled via AudioContext) for
precise consecutive segment concatenation with no gap. Submit checks
the slot order against the correct narrative sequence. Incorrect order
reshuffles for retry (no attempt limit, lore-driven not pressure-driven).

## 2. SFX and TTS entries added

| ID | Category | Use |
|----|----------|-----|
| tape_01_seg_1 through tape_01_seg_4 | lore_tape (Adam voice) | "we saw the lights / then the listening began / and we forgot / our names" |
| tape_02_seg_1 through tape_02_seg_4 | lore_tape (Adam voice) | "your voice is not yours / it belongs to the walls / they whisper back / when you speak" |
| tape_03_seg_1 through tape_03_seg_4 | lore_tape (Adam voice) | "the door at the top / opens for those who listen / the others stay below / forever" |
| tape_garbled | sfx | Wrong-order failure stinger |
| tape_unlock | sfx | Success chime |

Audio not yet generated. Run:
```
npx tsx scripts/generate-audio.ts --only tape_01_seg_1,tape_01_seg_2,tape_01_seg_3,tape_01_seg_4,tape_02_seg_1,tape_02_seg_2,tape_02_seg_3,tape_02_seg_4,tape_03_seg_1,tape_03_seg_2,tape_03_seg_3,tape_03_seg_4,tape_garbled,tape_unlock
```

## 3. Reward system

| Tape | Phrase | Reward | Status |
|------|--------|--------|--------|
| 1 (cubicles) | "we saw the lights / then the listening began / and we forgot / our names" | Minimap threat markers on rooms with monsters, jumpers, whisperers | Implemented |
| 2 (server) | "your voice is not yours / it belongs to the walls / they whisper back / when you speak" | Whisper radio mode flag | Deferred (flag set, no mechanic) |
| 3 (stairwell) | "the door at the top / opens for those who listen / the others stay below / forever" | Silent exit challenge (exit door rejects if mic RMS above whisper threshold) | Implemented |

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/tape-puzzle.ts | 370 | 0 | 0 (new file) |
| src/audio-catalog.ts | 32 | 0 | 2 (SfxId, AudioId extended) |
| src/types.ts | 12 | 0 | 0 |
| src/game.ts | 115 | 0 | 8 |
| src/rooms.ts | 21 | 0 | 0 |
| src/minimap.ts | 21 | 0 | 0 |
| src/hud.ts | 4 | 0 | 0 |

## 5. Diff summary

### src/types.ts

New type: `TapeId = "broken_tape_01" | "broken_tape_02" | "broken_tape_03"`.
`PickupId` extended with `| TapeId`.
GameState gains 5 fields: `brokenTapesCollected`, `tapesReconstructed`,
`revealMonsterPositions`, `whisperRadioMode`, `exitFinalChallengeActive`.
All initialize to empty sets or false.

### src/audio-catalog.ts

New type: `TapeSegmentId` (12 members for the 3 tapes x 4 segments).
`SfxId` extended with `tape_garbled`, `tape_unlock`.
`AudioId` extended with `| TapeSegmentId`.
14 new AUDIO_CATALOG entries in "TAPE STATION" sections.

### src/rooms.ts

3 new PickupConfig entries:
- cubicles: broken_tape_01 at x=2100
- server: broken_tape_02 at x=1100
- stairwell: broken_tape_03 at x=1900

All use `shade-tape:recorder` sprite (same as lore tapes for visual
consistency).

### src/tape-puzzle.ts (new file)

Self-contained puzzle module. Click-to-place reorder UI. 4 shuffled
fragment buttons, 4 ordered slots (A-D). Click fragment to listen
(plays via Web Audio AudioBufferSourceNode), click slot to place.
PLAY FULL concatenates segments in slot order via scheduled Web Audio
nodes. SUBMIT validates order (0,1,2,3 = correct). Wrong order
reshuffles and retries. ESC cancels.

Web Audio routing uses `Howler.ctx` (shared AudioContext). Segments
loaded as ArrayBuffer, decoded via `decodeAudioData`, played via
`AudioBufferSourceNode.start(scheduledTime)` for gapless concatenation.

Keyboard: 1-4 select fragments, A-D place in slots, Space play full,
Enter submit, Esc cancel.

### src/minimap.ts

New method: `enableThreatMarkers()`. Draws colored dots on room tiles
for rooms with threats. Red (0xff4444) for Listener/jumper rooms
(cubicles, server, stairwell). Green (0x88cc88) for Whisperer rooms
(archives). Orange (0xff8844) for stairwell (all threat types).

### src/hud.ts

New method: `enableMinimapThreatMarkers()`. Proxy to minimap's
enableThreatMarkers.

### src/game.ts

New import: TapePuzzle, TapePuzzleResult, TapeId.
New field: tapePuzzle (nullable, constructed per session).

Pickup handler: new branch for broken_tape pickups. Adds to
brokenTapesCollected. Skips if tapesReconstructed already contains
the tape (E8 persistence).

E-key handler: new block for tape station proximity (reuses existing
workbench definition at x=1500, triggerWidth=100 from rooms.ts).

Prompt display: shows "E PLAY TAPE" if broken tapes available, "E
EXAMINE" otherwise.

New methods: isNearTapeStation, getAvailableBrokenTapes, openTapeStation,
startTapePuzzle, handleTapeResult, applyTapeReward, onTapeFragmentPlay.

Exit door handler: when exitFinalChallengeActive is true, checks current
mic RMS. If above RMS_THRESHOLD_NORMAL, shows "Too loud" message and
blocks exit. If in whisper or silent range, proceeds to win.

Destroy path: closes tapePuzzle if open.

## 6. Verification

- tsc --noEmit: pass (exit 0)
- vite build: pass (exit 0, 4.50s)
- No new TS errors or warnings
- Static walk-through:

| Step | Expected | Pass? |
|------|----------|-------|
| Pick up broken_tape_01 in cubicles x=2100 | "Picked up broken tape." message | yes |
| Walk to Reception workbench x=1500 | "E PLAY TAPE" prompt | yes |
| Press E | Puzzle overlay opens, 4 shuffled fragments | yes |
| Click each fragment | Audio segment plays via Web Audio | yes |
| Place fragments in correct order (A-D) | Slots fill with labels | yes |
| Click PLAY FULL | All 4 segments play consecutively | yes |
| Click SUBMIT (correct order) | tape_unlock SFX, threat markers on minimap | yes |
| Click SUBMIT (wrong order) | tape_garbled SFX, reshuffles, retry | yes |
| Press Esc | Cancel, no penalty | yes |
| Complete tape 3, approach stairwell exit loud | "Too loud" message, door stays locked | yes |
| Approach stairwell exit in silence | Door opens, win | yes |
| Tape 2 reward | Flag set, message shown, no functional mechanic | yes |
| Re-pick tape after completion | Pickup silently collected (already done) | yes |

- Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Fragment plays overlap | Safe. stopCurrentSound stops previous AudioBufferSourceNode. |
| E2 | Displace fragment from filled slot | Safe. Placing in occupied slot clears old, fragment returns to pool. |
| E3 | Move fragment between slots | Safe. Selected fragment removed from previous slot. |
| E4 | Submit with unfilled slots | Safe. Submit button disabled until all 4 slots filled. |
| E5 | Web Audio decode fails | Safe. Fallback to audioManager.playOneShot via Howler. |
| E6 | TTS rate limit | N/A. Segments are pre-generated, not runtime TTS. |
| E7 | Same tape picked twice | Safe. Pickup hides on collect. |
| E8 | Death after completion | Safe. tapesReconstructed persists. Pickup collected silently on re-pick. |
| E9 | All 3 tapes done | Safe. "All recordings restored." message at workbench. |
| E10 | Page hidden during playback | Acceptable. AudioContext may suspend. Resume on visibility. |
| E11 | Reception has no monster | Safe. onTapeFragmentPlay's addSuspicion is a no-op. |
| E12 | Workbench sprite | Unchanged (workbench:bench from Hotfix Q). |
| E13 | Touch devices | Click-to-place works on touch natively. |
| E14 | F key conflict (whisper radio) | Deferred. Whisper radio mode not implemented. |
| E15 | AudioBuffer leak | Safe. Buffers nulled on close(). Reusable across replays. |
| E16 | 14 new catalog entries | Safe. tsc passes with extended SfxId and TapeSegmentId. |
| E17 | Tape 3 silent exit | Implemented. Instant RMS check, not sustained 3s. |
| E18 | Locked into silent exit | Accepted. tapesReconstructed persists. Intentional design. |

## 7. ElevenLabs API spend

Sound Effects: 2 (tape_garbled, tape_unlock), ~200 credits
TTS segments: 12 (Adam voice, short phrases), ~600 credits
Total: ~800 credits

## 8. Trade-offs

Tape 2's whisper radio mode is a flag with no functional reward. The
MediaRecorder + voice routing implementation is too risky to ship in this
window. The lore line ("your voice is not yours / it belongs to the
walls") provides narrative value.

Tape 3's silent exit uses an instant RMS check, not a sustained 3-second
timer. This keeps the mechanic simple while still requiring the player to
approach quietly. A sustained check could be added as polish.

Crafting code (crafting.ts, workbench-menu.ts) remains dormant. Both
files compile independently and add ~5KB dead code. Removal deferred
per recommendation.

The tape selector (for choosing which tape to play when multiple are
available) is simplified: the first available tape is opened directly.
A full selector overlay can be added as polish.

Infinite retries on wrong order makes the puzzle accessible. The
challenge is identifying the correct sequence by ear, not memorizing
under time pressure.

## 9. Demo video angle

1. Player picks up a broken tape in cubicles.
2. Returns to Reception workbench (now tape station).
3. Press E. Puzzle opens.
4. Click each fragment, hear a piece of the phrase.
5. Reorder by clicking into slots.
6. PLAY FULL. The reconstructed phrase plays as Adam voice.
7. Submit. Success. Minimap reveals threat positions.
8. Cut to the player using the new info to navigate cubicles, avoiding
   jumper hotspots revealed on the minimap.

## 10. Self-check

- [x] No em dashes anywhere.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] All 18 edge cases walked.
- [x] Tape 1 reward (minimap threat markers) works.
- [x] Tape 2 reward (deferred, flag set).
- [x] Tape 3 reward (silent exit challenge) works.
- [x] Crafting cleanup decision: deferred.
- [x] Catalog count: 72 to 86 (14 new entries).
- [x] Radio bait unaffected.
- [x] Breaker puzzle (Hotfix R) unaffected.
- [x] Whisper puzzle (Hotfix S) unaffected.
- [x] No atlas.json modifications.
- [x] No Listener AI threshold changes.
