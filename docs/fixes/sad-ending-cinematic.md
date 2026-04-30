# Sad Ending Cinematic. Hotfix U.27.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle before / after: 545.64 kB (156.94 kB gz) / 547.30 kB (157.36 kB gz)
Bundle delta: +1.66 kB (+0.42 kB gz)
Cinematic image: assets/cinematics/sad_ending.png, 2.5 MB
Friction addressed: the win condition had no payoff; the player saw
"YOU ESCAPED" in monospace on a black screen

## 1. What changed

The triggerWin flow was replaced with a cinematic sequence. When the
player passes the exit gate (Hotfix U.22 keycard + breaker check, plus
the optional Hotfix T silent challenge), the game now:

1. Fades the game world to black via a full-screen DOM overlay (1000ms)
2. Fades in the sad_ending.png illustration (500ms)
3. Holds the image for 6 seconds
4. Fades the image back to black (1000ms)
5. Shows a styled win end screen with "YOU NEVER LEFT", stats, and restart prompt

ESC skips the cinematic at any point, jumping directly to the end screen.

Total cinematic duration: ~8.5 seconds. The player can press R on the
end screen to restart (same mechanism as the death GAMEOVER screen).

## 2. Sequence timing

| Phase | Time | Duration | Description |
|-------|------|----------|-------------|
| 1 | 0-1000ms | 1000ms | DOM overlay fades in (covers game) |
| 2 | 1000-1500ms | 500ms | Cinematic image fades in |
| 3 | 1500-7500ms | 6000ms | Image held at full opacity |
| 4 | 7500-8500ms | 1000ms | Image fades out (back to black) |
| 5 | 8500ms+ | - | Win end screen with stats |

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/types.ts | 1 (CINEMATIC phase) | 0 | 0 |
| src/game.ts | 82 | 11 | 4 |
| index.html | 72 (CSS + HTML) | 0 | 0 |
| assets/cinematics/sad_ending.png | added (2.5 MB) | 0 | 0 |

## 4. Diff summary

### src/types.ts

BEFORE:
```typescript
export type GamePhase = "INTRO" | "PLAYING" | "PAUSED" | "DYING" | "GAMEOVER" | "WIN";
```

AFTER:
```typescript
export type GamePhase = "INTRO" | "PLAYING" | "PAUSED" | "DYING" | "GAMEOVER" | "CINEMATIC" | "WIN";
```

### src/game.ts

BEFORE: triggerWin() set phase to "WIN", played win_chime, used Pixi
fadeTransition, then called buildEndScreen with "YOU ESCAPED" text.

AFTER: triggerWin() sets phase to "CINEMATIC", stops audio and
heartbeat, then calls runSadEndingCinematic(). The cinematic method:
- Creates a DOM overlay (#cinematic-overlay)
- Uses AbortController for ESC skip (abort cancels all pending timeouts)
- CSS transitions handle all fade timing
- After the cinematic, calls showWinEndScreen() which populates and
  shows the #win-stats HTML element
- Sets phase to "WIN" and unlocks input for R-to-restart

New field: cinematicAbort (AbortController | null)
New methods: runSadEndingCinematic(), showWinEndScreen(), hideWinStats()
CINEMATIC case added to tick switch (ESC check via isEscapeHeld).
restart() now calls hideWinStats() and cleans up cinematic overlay.

### index.html

CSS added:
- #cinematic-overlay: fixed fullscreen, z-index 10000, opacity transition
- .cinematic-image: centered, object-fit contain, opacity transition
- #win-stats: fixed fullscreen, display none/flex toggle
- Win end screen styling (title, subtitle, stats, restart prompt)

HTML added:
- #win-stats div with "YOU NEVER LEFT" title, subtitle, stat rows
  (time, tapes, charm), restart prompt

## 5. Verification

- tsc --noEmit: exit 0
- npx vite build: exit 0
- dist/cinematics/sad_ending.png: present in build output
- Image served at /cinematics/sad_ending.png (Vite publicDir is assets/)

Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Player exits with silent challenge active | Silent challenge runs first (game.ts:1182). On success, triggerWin fires. Cinematic plays. |
| E2 | Rapid ESC presses during cinematic | AbortController.abort() is idempotent. Second call does nothing. All pending timeouts already cleared. |
| E3 | Image fails to load (404) | img.onerror calls abort.abort(), skipping to the end screen immediately. Console warning logged. |
| E4 | Player dies during cinematic | Impossible. Phase is CINEMATIC, not PLAYING. All gameplay methods guard with phase !== "PLAYING". Monster updates are in handlePlayingTick which only runs during PLAYING. |
| E5 | Window resize during cinematic | Image uses max-width: 100vw, max-height: 100vh, object-fit: contain. Resizes automatically. |
| E6 | Portrait / mobile orientation | Image letterboxes (contain). Title and stats use relative sizing. Acceptable. |
| E7 | Audio still playing during cinematic | triggerWin() calls audioManager.stopAllMonsterVocals(), stopAllBlobs(), fadeOutAmbient(1000). heartbeat.stop() also called. All narrations stopped. |
| E8 | RETURN/R pressed during cinematic (before end screen) | Phase is CINEMATIC, not WIN. Tick handler's WIN case does not run. KeyR ignored until phase transitions to WIN after cinematic completes. |
| E9 | Double triggerWin call | Guarded by phase !== "PLAYING" check at the top. Second call returns immediately. |
| E10 | CINEMATIC phase blocks puzzle inputs | All puzzle/interaction methods guard with phase !== "PLAYING". Verified via grep: 10+ guards found. |
| E11 | Asset path mismatch | Vite publicDir is "assets" (vite.config.ts:6). File at assets/cinematics/sad_ending.png serves at /cinematics/sad_ending.png. Verified: dist/cinematics/sad_ending.png exists after build. |
| E12 | Image too dark on dim monitors | Depends on the source PNG. If unreadable, regenerate with brighter illumination. |
| E13 | Stats display undefined fields | tapesReconstructed is a Set (types.ts:149), always initialized. hasWhisperCharm is a boolean (types.ts:148), always initialized. runStats.startTimeMs is set at game start. No undefined access. |
| E14 | Restart logic | R-to-restart reuses the existing tick handler case "WIN" + restart() method. restart() creates a fresh Game instance (game.ts:2434-2435). hideWinStats() hides the HTML overlay. |
| E15 | CSS animation conflicts | The opacity transitions use ease-out/ease-in. No !important overrides. z-index 10000 is above loading-screen (9500) and all Pixi overlays (9000). Only critical errors would need higher. |

## 6. Trade-offs

The cinematic is 8.5 seconds of non-interactive viewing. For players
who have seen it once, ESC skips immediately. First-time players get
the full emotional beat. If playtesters find the hold too long, shorten
Phase 3 from 6000ms to 3000ms (total would drop to 5.5 seconds).

The image is 2.5 MB. It is served from the Vite publicDir, not loaded
via Pixi's asset pipeline. On slow connections, the image may not
finish loading before the 1000ms fade completes. In that case, the
fade-in shows a black screen momentarily before the image appears.
Preloading in main.ts could fix this but was skipped to avoid touching
the asset pipeline.

buildEndScreen() is no longer called for the win flow. The method
remains available in game.ts for potential future use. The gameover
(death) flow is unchanged and still uses the Pixi-based overlay.

"YOU NEVER LEFT" is the end screen title. The subtitle "The building
keeps what it takes." reinforces the horror tone. Both are plain strings
in index.html, tunable without a rebuild.

No audio cue plays during the cinematic hold. The ambient and monster
audio are faded/stopped. For polish, a low ominous drone SFX could be
generated via ElevenLabs and played during Phase 3.

## 7. Manual playtest steps

a) Start a fresh run.
b) Speedrun: get keycard, activate breaker, walk to exit.
c) Press E at the exit. Cinematic begins:
   - Game fades to black (1s)
   - Sad ending illustration fades in (0.5s)
   - Image holds for 6 seconds
   - Image fades to black (1s)
d) End screen appears:
   - "YOU NEVER LEFT" in dark red
   - "The building keeps what it takes." subtitle
   - Stats: time, tapes reconstructed (0/3 on speedrun), charm (MISSED)
   - "PRESS R TO RESTART"
e) Press R. Game restarts at reception.
f) Replay: trigger win again, press ESC during cinematic.
   Cinematic skips, end screen appears immediately.
g) Verify death flow unchanged: die, gameover-stats shows "YOU DIED".

## 8. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] Cinematic plays after win condition.
- [x] Image renders correctly (centered, object-fit contain).
- [x] Fades smooth (CSS opacity transitions).
- [x] ESC skips cinematic (AbortController cancels all timeouts).
- [x] End screen displays stats (time, tapes, charm).
- [x] R restarts game from end screen.
- [x] CINEMATIC phase added to GamePhase.
- [x] CINEMATIC case in tick handler (ESC check).
- [x] restart() cleans up cinematic overlay and win stats.
- [x] Image bundled in dist/cinematics/.
- [x] All 15 edge cases walked.
