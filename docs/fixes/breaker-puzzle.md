# Audio Match Breaker Puzzle. Hotfix R.

Commit at start: 2ce4720
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 496.11 kB (145.50 kB gz) / 506.07 kB (148.07 kB gz)
Delta: +9.96 kB (+2.57 kB gzipped), 1 new module bundled
Catalog entries before / after: 65 / 70

## 1. What was added

The breaker switch in Server room is now an audio-matching puzzle. The
player listens to an original electrical relay sound, then picks which
of four labeled options (A/B/C/D) matches it. One option plays the
identical sample; the other three are subtle variations (pitch-shifted,
static overlay, double-click). The correct letter is randomized per
attempt. 15-second timer. Success engages the breaker and unlocks the
stairwell door. Failure plays an alarm, applies +60 suspicion to the
Server Listener, and forces an 8-second HUNT toward the breaker
position. Each audio playback during the puzzle adds +5 suspicion.

## 2. SFX entries added

| ID | Duration | Prompt summary | Volume |
|----|----------|---------------|--------|
| breaker_original | 1.5s | Relay click + low hum, vintage industrial | 0.85 |
| breaker_variant_a | 1.5s | Same, slightly higher pitch | 0.85 |
| breaker_variant_b | 1.5s | Same, brief static crackle overlay | 0.85 |
| breaker_variant_c | 1.5s | Two relay clicks + low hum | 0.85 |
| breaker_lock_alarm | 2.0s | Harsh industrial alarm buzzer | 0.95 |

Audio files not yet generated. Run:
```
npx tsx scripts/generate-audio.ts --only breaker_original,breaker_variant_a,breaker_variant_b,breaker_variant_c,breaker_lock_alarm
```
The `--only` flag now accepts comma-separated IDs (updated in this hotfix).

Distinguishability test: pending generation. If variants come back too
similar, refine prompts or fall back to procedural approach (Howler rate
shifting + overlay mixing) documented in the prompt.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/breaker-puzzle.ts | 359 | 0 | 0 (new file) |
| src/audio-catalog.ts | 42 | 0 | 1 (SfxId type extended) |
| src/game.ts | 48 | 4 | 5 |
| scripts/generate-audio.ts | 1 | 1 | 0 |

## 4. Diff summary

### src/audio-catalog.ts

SfxId union extended with 5 new members: `breaker_original`,
`breaker_variant_a`, `breaker_variant_b`, `breaker_variant_c`,
`breaker_lock_alarm`. AUDIO_CATALOG gains 5 entries in a "BREAKER
PUZZLE SFX" section after the floor jumper block, before radio voice.

### src/breaker-puzzle.ts (new file)

Self-contained puzzle module. Public API: `BreakerPuzzle` class with
`open()`, `close()`, `isOpen()`. Config takes `onResult` callback,
optional `onAudioPlay` callback, optional `timerMs`.

Internal state tracks selected letter, correct letter (randomized per
open), letter-to-SFX mapping. Builds DOM dynamically on open(), removes
on close(). Injects CSS once via a `<style id="bp-styles">` element.

Timer uses `performance.now()` with pause-duration tracking for tab
visibility (E4). setInterval updates the timer bar every 100ms.
setTimeout fires the timeout after timerMs.

Keyboard: 1-4 select letters, Space replays original, Enter submits,
Escape cancels. Mouse: click buttons directly.

Audio playback stops the previous sound before starting a new one via
`audioManager.stop(id)` (E8).

### src/game.ts

BEFORE (breaker handler):
```typescript
if (pickup.config.togglesTo) {
  pickup.setToggled();
  if (pickup.config.id === "breaker_switch") {
    this.state.breakerOn = true;
    this.hud.showMessage("Power restored.");
    audioManager.playOneShot("breaker_switch");
  }
```

AFTER:
```typescript
if (pickup.config.togglesTo) {
  if (pickup.config.id === "breaker_switch" && !this.state.breakerOn) {
    this.breakerPickupRef = pickup;
    this.openBreakerPuzzle();
    return;
  }
  pickup.setToggled();
```

BEFORE (breaker prompt):
```typescript
this.hud.showSpritePrompt("key-e", "label-interact");
```

AFTER (for breaker only):
```typescript
this.hud.showPrompt("E  DECIPHER");
```

New methods: `openBreakerPuzzle()`, `handleBreakerResult()`,
`onBreakerAudioPlay()`. New fields: `breakerPuzzle: BreakerPuzzle`,
`breakerPickupRef: Pickup | null`.

Destroy path gains `this.breakerPuzzle.close()`.

### scripts/generate-audio.ts

`--only` flag now splits on comma to support multiple IDs in one run.

## 5. Verification

- tsc --noEmit: pass (exit 0)
- vite build: pass (exit 0, 3.96s)
- No new TS errors or warnings
- Static walk-through:

| Step | Expected | Pass? |
|------|----------|-------|
| Spawn. Walk to breaker x=2700 in Server. | Prompt shows "E DECIPHER" | yes (code path verified) |
| Press E near breaker. | Overlay appears. Original auto-plays after 500ms. | yes (code path verified) |
| Click ORIGINAL button. | breaker_original replays. +5 suspicion. | yes |
| Click A, B, C, D. | Each plays its assigned variant. +5 each. | yes |
| Select correct letter. SUBMIT. | Success: breakerOn = true, breaker_switch SFX, vignette flash, pickup toggles. | yes |
| Select wrong letter. SUBMIT. | Fail: breaker_lock_alarm, +60 suspicion, 8s force-HUNT to x=2700. | yes |
| Wait 15 seconds without submitting. | Timeout: same fail path as wrong choice. | yes |
| Press Esc. | Cancel: no penalty, overlay closes, game resumes. | yes |
| Retry after failure. | Correct letter re-randomized. Overlay works again. | yes |
| Breaker already on. Press E. | No puzzle (guard on !breakerOn). | yes |

- Edge cases (E1-E15):

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Audio asset missing | Safe. Puzzle checks audioManager.has() for all 4 samples. Falls back to "cancelled" result which resumes game. |
| E2 | Player dies during puzzle | Safe. Phase is PAUSED, ticker stopped. Monster does not update. Player cannot be caught. |
| E3 | Room change during puzzle | Safe. PAUSED phase blocks player movement. Room change requires walking to a door. |
| E4 | Page hidden during puzzle | Safe. visibilitychange handler pauses/resumes timer and timeout. |
| E5 | Multiple puzzle sessions | Safe. Correct letter re-randomized per open(). DOM rebuilt. No state bleed. |
| E6 | Puzzle open while breaker on | Safe. Handler guards on !breakerOn. |
| E7 | Timer spans tick stutters | Safe. Timer uses performance.now(), not deltaMS accumulation. |
| E8 | Multiple clicks during playback | Safe. stopCurrentSound() stops previous via audioManager.stop() before new play. |
| E9 | Timer expires before submit | Safe. onTimeout fires fail_timeout. Selected letter irrelevant. |
| E10 | Browser autoplay restriction | Safe. Player presses E (user gesture) before puzzle opens. Howler already unlocked. |
| E11 | Suspicion overflow from spam | Safe. Monster suspicion caps at 100 (SUSPICION_MAX). Existing threshold logic handles it. |
| E12 | TTS narration on success fails | N/A. No TTS narration added in this hotfix. Deferred as polish. |
| E13 | Correct answer in DOM | Acceptable. Letter-to-SFX mapping in JS memory, not DOM attributes. data-letter only stores A/B/C/D. |
| E14 | Repeated puzzle API calls | Safe. Audio generated once at build time. Runtime never calls ElevenLabs. |
| E15 | Variants too obvious/subtle | Pending audio generation. Tunable via prompt rewording and regeneration. |

## 6. ElevenLabs API spend

Total Sound Effects generations planned: 5
Approximate credit cost: 500 credits (5 x ~100 credits at standard SFX rate)
Audio files not yet generated (no API key in this session).

## 7. Trade-offs

The 15-second timer is a single constant in the BreakerPuzzle config
(game.ts constructor). Adjustable without touching puzzle internals.

The +5 suspicion per audio play is called via the onAudioPlay callback.
If too punishing, lower to +3 in onBreakerAudioPlay. If too lax, raise
to +10.

The 8-second force-HUNT on failure uses the existing startLure method
(same mechanism as radio bait). Duration is longer than radio bait's 5s
because the player initiated the interaction.

The PAUSED phase stops the game ticker entirely. During the puzzle, the
monster AI, vignette, and heartbeat do not update. This creates a "calm
before the storm" effect. If background tension during the puzzle is
desired, a separate PUZZLE phase that keeps atmosphere systems running
could be added as follow-on.

The puzzle DOM is built and torn down on each open/close cycle. No
persistent DOM pollution. CSS is injected once and stays.

TTS narration on success ("Power restored. The stairwell is unlocked.")
was deferred. The existing hud.showMessage + breaker_switch SFX provide
sufficient feedback.

## 8. Demo video angle

The breaker puzzle is the showcase moment. Frame the demo:
1. Player approaches the breaker in Server room.
2. "E DECIPHER" prompt appears.
3. Overlay opens. Original relay sound auto-plays.
4. Player listens to A, B, C, D. Each subtly different.
5. Tense pause. Player picks. Submit.
6. Outcome: either the success vignette flash and breaker engage, or
   the alarm blares and the Listener charges in from across the room.

The distinctive aspect: the ElevenLabs Sound Effects API generates four
procedural variations of one industrial sound prompt that the player
must distinguish by ear. The puzzle mechanic itself is the API demo.

## 9. Manual playtest steps

1. Start a run. Navigate to Server room.
2. Walk to breaker at x=2700. Confirm prompt reads "E DECIPHER".
3. Press E. Overlay appears. Original plays after brief delay.
4. Click each letter. Each plays a slightly different sound.
5. Pick the one that matches. Press SUBMIT (or Enter).
6. Verify success or failure path executes correctly.
7. If fail, survive the Listener. Retry: confirm correct letter changed.
8. Confirm Esc cancels without penalty at any point.
9. Confirm timer expires at 15s with no input.
10. Confirm breaker cannot be re-puzzled once engaged.

## 10. Self-check

- [x] No em dashes anywhere.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] All 15 edge cases walked.
- [x] Catalog count: 65 to 70 (5 new SfxId entries).
- [x] Existing breaker_switch SFX still plays on success.
- [x] Listener force-HUNT uses startLure (8s duration, x=2700).
- [x] Player can retry after failure (no permanent lockout).
- [x] Esc cancellation works without applying penalty.
- [x] Radio bait system unaffected.
- [x] No atlas.json modifications.
- [x] No Listener AI threshold changes.
- [x] No crafting code changes.
- [x] No beacon, mic, hide-animation, or jumper FSM changes.
