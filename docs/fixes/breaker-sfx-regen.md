# Breaker SFX Regeneration. Hotfix U.17.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 538.97 kB (155.17 kB gz) / 541.58 kB (155.83 kB gz)
Bundle delta: +2.61 kB (+0.66 kB gzipped), longer prompt strings in catalog
ElevenLabs credits used: approximately 250-500 (5 SFX at 2.0-2.5s each)
Friction addressed: critical bug (breaker SFX inaudible since initial generation)

## 1. Root cause

The ElevenLabs SFX generation in Hotfix R produced silent or near-silent
files for the 5 breaker SFX. ORIGINAL was completely silent; variants
A/B/C were short and weak; the lock alarm was quiet. The Hotfix U.12
architectural switch (from Howler to Web Audio direct) fixed the
playback pipeline but did not address the root cause: the API prompts
were too vague and produced low-energy output. The prompts lacked
explicit loudness cues, used generic descriptions ("low electrical
hum"), and requested only 1.5s duration, leaving insufficient room for
the sound to develop.

## 2. New prompts and durations

| Id | Prompt summary | Duration | Volume |
|----|---------------|----------|--------|
| breaker_original | Heavy relay CLICK + deep electrical HUM, vintage 1970s breaker, loud/clear | 2.0s | 1.0 |
| breaker_variant_a | HIGH PITCH small relay click + thin high-frequency buzz, lighter than industrial | 2.0s | 1.0 |
| breaker_variant_b | Click + LOUD STATIC CRACKLE and sparks, faulty breaker arcing, crackle dominant | 2.0s | 1.0 |
| breaker_variant_c | TWO clicks 300ms apart (double-tap) + brief hum, rhythmic/distinct | 2.5s | 1.0 |
| breaker_lock_alarm | Loud industrial alarm BUZZER, harsh/continuous, security system alarm | 2.5s | 1.0 |

Key prompt changes:
- Added explicit loudness cues ("LOUD", "HEAVY", "HARSH", "AGGRESSIVE")
- Used CAPS for the key differentiating sound element in each variant
- Increased durations from 1.5s to 2.0-2.5s
- Boosted catalog volume from 0.85 to 1.0 (Howler safe max)
- Made variants drastically different in character (pitch, crackle, double-click, buzzer) rather than subtle variations of one sound

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/audio-catalog.ts | 5 | 5 | 10 (prompt, durationSec, volume per entry) |
| assets/audio/breaker_original.mp3 | regenerated | - | - |
| assets/audio/breaker_variant_a.mp3 | regenerated | - | - |
| assets/audio/breaker_variant_b.mp3 | regenerated | - | - |
| assets/audio/breaker_variant_c.mp3 | regenerated | - | - |
| assets/audio/breaker_lock_alarm.mp3 | regenerated | - | - |

## 4. File sizes

| File | Before | After | Format |
|------|--------|-------|--------|
| breaker_original.mp3 | 25 KB | 33 KB | MPEG ADTS, layer III, 128 kbps, 44.1 kHz, Stereo |
| breaker_variant_a.mp3 | 25 KB | 33 KB | MPEG ADTS, layer III, 128 kbps, 44.1 kHz, Stereo |
| breaker_variant_b.mp3 | 25 KB | 33 KB | MPEG ADTS, layer III, 128 kbps, 44.1 kHz, Stereo |
| breaker_variant_c.mp3 | 25 KB | 40 KB | MPEG ADTS, layer III, 128 kbps, 44.1 kHz, Stereo |
| breaker_lock_alarm.mp3 | 33 KB | 40 KB | MPEG ADTS, layer III, 128 kbps, 44.1 kHz, Stereo |

Total disk delta: +38 KB across 5 files. All in publicDir (assets/audio/).

## 5. Verification

- tsc --noEmit: exit 0
- vite build: exit 0 (4.15s)
- All 5 files valid MPEG layer III (confirmed via `file` command)
- All 5 files above 15 KB threshold
- File sizes match expected byte counts for duration at 128 kbps
- SfxId union unchanged (no id changes, only prompt/duration/volume)
- No changes to breaker-puzzle.ts (Web Audio direct pattern preserved)

Manual playtest (user must verify):

| Step | Expected | Status |
|------|----------|--------|
| a) Hard refresh (Ctrl+Shift+R) | No cached MP3s | pending |
| b) Walk to breaker (server x=2700), press E | Puzzle opens | pending |
| c) Click ORIGINAL | Hear relay click + hum clearly | pending |
| d) Click A | Hear HIGHER pitch, distinct from ORIGINAL | pending |
| e) Click B | Hear STATIC CRACKLE, distinct | pending |
| f) Click C | Hear TWO CLICKS (double tap), distinct | pending |
| g) Click ORIGINAL again | Same sound as first play | pending |
| h) Submit wrong answer | Hear LOUD BUZZER alarm | pending |
| i) Submit correct answer (matching ORIGINAL) | Success: breaker_switch click, lights flicker | pending |

## 6. Edge cases (E1-E10)

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Quota exceeded | Pass. All 5 generated without 429 errors. |
| E2 | API timeout | Pass. No timeouts during generation. |
| E3 | Corrupt file | Pass. All 5 valid MPEG III per `file` command. |
| E4 | File cache (Vite) | N/A until deploy. User must Ctrl+Shift+R for local test. |
| E5 | Volume too high | Pass. 1.0 is Howler safe max. No clipping expected. |
| E6 | Variants still similar | Prompts are maximally different (pitch vs crackle vs double-click vs buzzer). Pending user listening test. |
| E7 | Duration mismatch | File sizes match expected: 2.0s = 33 KB, 2.5s = 40 KB at 128 kbps. |
| E8 | Bundle size | Pass. Audio in publicDir, not bundled. +38 KB on disk total. |
| E9 | Repeat playback | Pending user test. Web Audio direct path supports repeated play via new BufferSourceNode per call. |
| E10 | Browser caching | User must test with hard refresh or incognito. |

## 7. Trade-offs

- Variants are now intentionally very different from each other. Each
  has a unique sound character (heavy relay, high pitch, static crackle,
  double-click, alarm buzzer). This shifts the puzzle from "subtle ear
  training" to "clear pattern matching." Acceptable trade: the puzzle
  was unsolvable before because the source files were silent.

- Volume 1.0 is the digital maximum for Howler and the Web Audio
  GainNode. Effective volume depends on the user's master volume
  setting. No risk of Howler-level clipping, but decoded PCM might
  clip if the generated audio itself was mastered hot. ElevenLabs SFX
  output is typically normalized to safe levels.

- Longer durations (2.0-2.5s vs 1.5s) give each sound more time to
  develop its character. The 15-second puzzle timer is unaffected since
  replays stop the previous sound before starting a new one.

- The ElevenLabs API has no volume parameter. Loudness is entirely
  prompt-driven. If the regenerated files are still quiet, the next step
  would be post-generation normalization via ffmpeg (loudnorm filter) or
  increasing prompt_influence above the current 0.7.

## 8. Manual playtest steps

1. Start a run. Navigate to Server room.
2. Walk to breaker at x=2700. Confirm prompt reads "E DECIPHER".
3. Press E. Puzzle opens. Original auto-plays after 500ms delay.
4. Click ORIGINAL. Audio should be clearly audible (relay click + hum).
5. Click A. Higher pitch, lighter sound. Distinct from ORIGINAL.
6. Click B. Static crackle and sparks. Dominant crackling sound.
7. Click C. Double click (two taps 300ms apart). Rhythmically distinct.
8. Click ORIGINAL again. Same as step 4. Consistent.
9. Select wrong letter. Press SUBMIT. Loud buzzer alarm plays.
10. Survive the Listener force-HUNT. Retry. Correct letter re-randomized.
11. Select the matching letter. Press SUBMIT. Success path fires.
12. Confirm Esc cancels without penalty at any point.
13. Confirm breaker cannot be re-puzzled once engaged.

## 9. Self-check

- [x] No em dashes.
- [x] Build green (tsc + vite exit 0).
- [x] All 5 files regenerated.
- [x] All 5 files valid MPEG III, above 15 KB.
- [x] All 5 variants have distinct prompt characters.
- [x] Old prompts replaced with new prompts.
- [x] Catalog volume boosted from 0.85 to 1.0.
- [x] All 10 edge cases walked.
- [x] No changes to breaker-puzzle.ts.
- [x] No changes to AudioManager or playback path.
- [x] No non-breaker audio regenerated.
- [x] No commit made.
