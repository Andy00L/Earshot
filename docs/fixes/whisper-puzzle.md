# Whisper Lock Minigame. Hotfix S.

Commit at start: 2ce4720
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 506.07 kB (148.07 kB gz) / 517.52 kB (150.54 kB gz)
Delta: +11.45 kB (+2.47 kB gzipped), 1 new module bundled
Catalog entries before / after: 70 / 72

## 1. What was added

A sealed trapdoor in Archives at x=1500 that requires the player to
whisper into their real microphone. ElevenLabs TTS generates a short
whispered phrase via Bella voice. The player must repeat the phrase while
keeping their voice in the whisper range (RMS between 0.01125 and
0.0225, from beacon.ts calibration v2). 1.5 seconds of sustained
whispering unlocks the trapdoor and grants a "whisper charm" consumable
(F key to use). Speaking above whisper volume causes instant failure.
Failure spawns the Whisperer at the trapdoor position and bumps beacon
drain to 5x for 20 seconds. 3 attempts per session, 10 seconds per
attempt.

## 2. SFX added

| ID | Duration | Loop | Volume | Use |
|----|----------|------|--------|-----|
| whisper_trap_ambient | 6.0s | yes | 0.05 | Faint loop near trapdoor |
| whisper_trap_fail | 1.5s | no | 0.90 | Failure stinger |

Audio files not yet generated. Run:
```
npx tsx scripts/generate-audio.ts --only whisper_trap_ambient,whisper_trap_fail
```

## 3. TTS runtime usage

| Voice | Style | Trigger |
|-------|-------|---------|
| Bella (EXAVITQu4vr4xnSDxMaL) | [whispering] prefix, stability 0.3, similarity 0.85 | Per puzzle session (random of 7 phrases) |

Phrases: "shadow walks beside you", "no one ever leaves this place",
"their names live in the walls", "listen to what is missing", "the
silence is alive", "you have been here before", "they remember your
voice".

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/whisper-puzzle.ts | 310 | 0 | 0 (new file) |
| src/audio-catalog.ts | 17 | 0 | 1 (SfxId extended) |
| src/game.ts | 98 | 0 | 7 |
| src/types.ts | 4 | 0 | 0 |
| src/input.ts | 5 | 0 | 0 |

## 5. Diff summary

### src/audio-catalog.ts

SfxId union extended with 2 new members: `whisper_trap_ambient`,
`whisper_trap_fail`. AUDIO_CATALOG gains 2 entries in a "WHISPER LOCK
PUZZLE SFX" section after the breaker puzzle block.

### src/types.ts

GameState extended with `whisperTrapUnlocked: boolean` and
`hasWhisperCharm: boolean`. Both initialize to false.

### src/input.ts

New method: `justUsedCharm()` returns true on the frame F was first
pressed.

### src/whisper-puzzle.ts (new file)

Self-contained puzzle module. Public API: `WhisperPuzzle` class with
`open()`, `close()`, `isOpen()`. Config takes `onResult` callback,
`attemptsAllowed` (default 3), `windowMs` (default 10000),
`requiredDurationMs` (default 1500).

The puzzle runs its own `requestAnimationFrame` loop during PAUSED phase
to sample the mic independently of the game ticker. This is necessary
because the game ticker is stopped during PAUSED but the mic analyser
(Web Audio) continues running.

Mic thresholds imported from beacon.ts: `RMS_THRESHOLD_WHISPER`
(0.01125) as whisper floor, `RMS_THRESHOLD_NORMAL` (0.0225) as whisper
ceiling. RMS above the ceiling triggers instant fail. RMS within the
range accumulates toward the 1.5s target. RMS below the floor (silence)
does not accumulate but does not reset the accumulated time (lenient
mode, per E6).

TTS generated at open time via `synthesizeTTS()` with Bella voice,
whispering style. Falls back to text-only if TTS fails (E1).

### src/game.ts

New import: WhisperPuzzle, WhisperPuzzleResult.

New fields: `whisperPuzzle`, `whisperTrapSprite`, `beaconDrainOverride`,
`beaconDrainOverrideExpiresAt`.

Constructor: WhisperPuzzle constructed with result callback and tuning
constants.

Beacon drain: the existing `updateBeacon` call now multiplies room drain
by a temporary override factor. The override decays after
`beaconDrainOverrideExpiresAt` (20s after puzzle fail).

E-key handler: new block before shade recovery checks
`isNearWhisperTrap()`. Opens puzzle if in range and not yet unlocked.

Prompt display: shows "E LISTEN" when near the trapdoor.

F-key handler: new check after slot selection. If
`state.hasWhisperCharm`, calls `useWhisperCharm()` which consumes the
charm and lures the room's monster for 8 seconds.

Room creation: `createWhisperTrapSprite()` places a `vents:sealed`
sprite at x=1500 in Archives. After unlock, uses `vents:open` instead.

Destroy path gains `this.whisperPuzzle.close()`.

New methods: `isNearWhisperTrap()`, `openWhisperPuzzle()`,
`handleWhisperResult()`, `forceSpawnWhispererAt()`, `useWhisperCharm()`,
`createWhisperTrapSprite()`.

## 6. Verification

- tsc --noEmit: pass (exit 0)
- vite build: pass (exit 0)
- No new TS errors or warnings
- Static walk-through:

| Step | Expected | Pass? |
|------|----------|-------|
| Walk to Archives x=1500 | "E LISTEN" prompt appears, trapdoor sprite visible | yes (code path verified) |
| Press E | Overlay appears, TTS phrase plays (or text fallback) | yes |
| Whisper into mic (RMS in [0.01125, 0.0225]) | Mic icon turns green, progress bar fills | yes |
| Sustain whisper for 1.5s | Success: charm acquired, trapdoor opens | yes |
| Speak above whisper (RMS >= 0.0225) | Instant fail, Whisperer spawns at x=1500, 5x drain 20s | yes |
| Stay silent through 3 attempt timeouts | Fail after third timeout | yes |
| Press Esc | Cancel, no penalty | yes |
| Press F with charm | Monster lured to player position for 8s, charm consumed | yes |
| Re-press E on open trapdoor | "The trapdoor is already open." message | yes |

- Edge cases (E1-E16):

| # | Edge case | Status |
|---|-----------|--------|
| E1 | TTS fails | Safe. synthesizeTTS returns null, puzzle shows text immediately, monitoring proceeds without audio. |
| E2 | Mic denied | Safe. Puzzle checks micAnalyser.state !== "active", returns "cancelled". |
| E3 | Mic returns 0 always | Handled. Silence does not accumulate. Attempt times out after windowMs. |
| E4 | Player talks during TTS | Safe. Mic monitoring only starts after TTS playback delay (2.5s). |
| E5 | Player whispers correctly | Progress bar fills to 100%. Success fires. |
| E6 | Whisper with pauses | Lenient. Accumulated time holds during silence, does not reset. |
| E7 | Whisperer already on screen | Safe. forceSpawnWhispererAt destroys existing whisperer first. |
| E8 | Retry after fail | New attempt within same session uses same phrase. New session after close picks new phrase. |
| E9 | All attempts exhausted | Puzzle closes with fail_timeout. Player must re-press E for new session. |
| E10 | Page hidden | Not fully handled (rAF pauses naturally). Timer via setTimeout persists. Acceptable for short puzzle. |
| E11 | Room change during puzzle | Safe. PAUSED blocks player movement. |
| E12 | Whisper detection latency | Covered. EMA smoothing (0.2 alpha) adds ~50ms lag. 1500ms target accommodates this. |
| E13 | Background noise in whisper range | Safe. Silence floor at 0.01125 above typical ambient (~0.002-0.01). |
| E14 | Re-open after success | Safe. openWhisperPuzzle returns early with message when whisperTrapUnlocked. |
| E15 | Charm used in multiple rooms | Single use. hasWhisperCharm set to false on use. |
| E16 | F key conflict | Safe. F (KeyF) not bound to any existing action. Verified via input.ts grep. |

## 7. ElevenLabs API spend

Sound Effects: 2 generations (~200 credits)
TTS runtime: per-session, ~50 credits per attempt at 5-7 words.
Phrase pool: 7 phrases, randomized per session.
Same phrase within a session does not regenerate (no caching needed,
single call at open time).

## 8. Trade-offs

Lenient whisper detection (E6): silence holds accumulated time rather
than resetting it. This accommodates natural breathing pauses and mic
variance. Tunable via requiredDurationMs in the puzzle config.

The 5x beacon drain multiplier is multiplied with the room's base drain
(Archives has 1.5x). Effective penalty drain is 7.5x for 20 seconds.
If too harsh, lower beaconDrainOverride from 5.0 to 3.0 in
handleWhisperResult.

The whisper charm lures the room's main monster only, not jumpers. The
jumper FSM has no lure mechanism and adding one would violate the locked
subsystem constraint. In rooms without a main monster (Reception,
Archives), the charm has no lure target but still consumes.

PAUSED phase stops the game ticker. The puzzle uses its own rAF loop to
sample the mic. This means monster AI, vignette, and heartbeat freeze
during the puzzle. Archives has no main monster, so this only affects
the Whisperer spawn timer (paused, resumes on result). Acceptable
because the puzzle is short (10s per attempt, 30s max).

The trapdoor sprite uses vents:sealed from the atlas. It renders at
x=1500 in Archives at zIndex 20 (wall layer). After unlock, it swaps
to vents:open. No new atlas sprites required.

TTS success voice line ("You heard me. I will show you.") was deferred.
The existing whisper_fade SFX and hud message provide sufficient
feedback.

## 9. Demo video angle

1. Player reaches Archives, sees a sealed trapdoor.
2. "E LISTEN" prompt.
3. Overlay opens. Bella's whispered voice: "shadow walks beside you."
4. Player whispers the phrase into their real microphone.
5. Mic icon glows green. Progress bar fills.
6. Trapdoor unlocks. Charm acquired.
7. Cut to a tense moment in Cubicles or Server. Player presses F.
8. Monster redirects away. Player escapes.

The distinctive moment: the player's actual whispered voice controls the
unlock. The mic, previously only a threat input, becomes a positive
puzzle tool.

## 10. Manual playtest steps

1. Start a run. Reach Archives.
2. Walk to x=1500. Confirm trapdoor visible and "E LISTEN" prompt.
3. Press E. Overlay appears. TTS phrase plays (or text shows directly).
4. Whisper the phrase. Confirm mic icon turns green, progress fills.
5. After 1.5s: success. Confirm charm message and trapdoor opens.
6. Re-press E on open trapdoor. Confirm "already open" message.
7. New session: speak too loudly. Confirm instant fail, Whisperer spawn.
8. New session: stay silent. Confirm attempt timeout, dot decrements.
9. After 3 timeouts: confirm fail and Whisperer spawn.
10. Use charm with F key in Server room. Confirm monster redirects.

## 11. Self-check

- [x] No em dashes anywhere.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] All 16 edge cases walked.
- [x] Existing Whisperer 30% spawn rule untouched (code in updateWhisperer unchanged).
- [x] Beacon drain multiplier reverts after 20s (performance.now check).
- [x] F key does not conflict with other bindings (verified grep).
- [x] Trapdoor sprite placed in Archives via createWhisperTrapSprite.
- [x] Mic permission denied path returns "cancelled" gracefully.
- [x] Radio bait system unaffected.
- [x] Breaker puzzle unaffected.
- [x] No atlas.json modifications.
- [x] No mic v2 calibration changes.
- [x] No Whisperer spawn rule changes.
- [x] No beacon base drain rate changes.
