# Puzzle Prompt Copy Rewrite. Hotfix U.2.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: negligible (string literal changes only)
Friction addressed: F4, F5

## 1. Changes

| Location | Before | After | Reason |
|----------|--------|-------|--------|
| Breaker prompt (game.ts:2323) | E  DECIPHER | E  TUNE | Puzzle is audio matching, not decryption. "TUNE" suggests dialing in the correct signal. |
| Whisper prompt (game.ts:2345) | E  LISTEN | E  WHISPER | Puzzle requires the player to whisper into their microphone. "WHISPER" names the action. |
| Tape station, tapes available (game.ts:2339) | E  PLAY TAPE | E  REBUILD | Puzzle is segment reordering, not passive playback. "REBUILD" names the reconstruction task. |
| Tape station, no tapes (game.ts:2341) | E  EXAMINE | (hidden) | Empty workbench interaction shows "No tape to play" which misleads. Hiding the prompt prevents luring. |
| Whisper prompt guard (game.ts:2345) | No unlocked check | Gated on !whisperTrapUnlocked | Prompt no longer appears after the trapdoor is solved. |

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 0 | 2 | 4 |

## 3. Diff summary

### Breaker prompt

BEFORE (game.ts:2323):
```typescript
          this.hud.showPrompt("E  DECIPHER");
```

AFTER:
```typescript
          this.hud.showPrompt("E  TUNE");
```

### Tape station prompt

BEFORE (game.ts:2335-2344):
```typescript
    // Tape station prompt
    if (this.isNearTapeStation()) {
      const available = this.getAvailableBrokenTapes();
      if (available.length > 0) {
        this.hud.showPrompt("E  PLAY TAPE");
      } else {
        this.hud.showPrompt("E  EXAMINE");
      }
      return;
    }
```

AFTER:
```typescript
    // Tape station prompt (hidden when no broken tapes in inventory)
    if (this.isNearTapeStation()) {
      const available = this.getAvailableBrokenTapes();
      if (available.length > 0) {
        this.hud.showPrompt("E  REBUILD");
        return;
      }
    }
```

The else branch and outer return are removed. When no tapes are
available, the function falls through to subsequent prompt checks. At
reception x=1500, no other interactable is in range, so no prompt
appears. The E-key handler for the tape station (game.ts:997) is
unchanged; pressing E at an empty workbench still shows "No tape to
play" or "All recordings restored" via openTapeStation.

### Whisper trap prompt

BEFORE (game.ts:2346-2350):
```typescript
    // Whisper trap prompt
    if (this.isNearWhisperTrap()) {
      this.hud.showPrompt("E  LISTEN");
      return;
    }
```

AFTER:
```typescript
    // Whisper trap prompt (hidden after trapdoor is unlocked)
    if (this.isNearWhisperTrap() && !this.state.whisperTrapUnlocked) {
      this.hud.showPrompt("E  WHISPER");
      return;
    }
```

The added guard prevents the prompt from reappearing after the
trapdoor is solved. isNearWhisperTrap itself did not check
whisperTrapUnlocked, so without this guard the old "E LISTEN" prompt
persisted after success.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0
- grep for old strings ("DECIPHER", "LISTEN", "PLAY TAPE", "EXAMINE")
  in src/: zero matches. The only remaining "LISTEN" is inside the
  word "LISTENER" in an audio-catalog comment.
- Static walk-through: pass per scenario

Edge case table:

| # | Case | Result |
|---|------|--------|
| E1 | Near multiple interactables | Prompt priority chain unchanged. String-only change. |
| E2 | Near workbench during INTRO | Prompt logic runs in PLAYING only. No impact. |
| E3 | Pick up tape while at workbench | Next frame: prompt switches from none to "E  REBUILD". |
| E4 | Breaker solved | Guard !breakerOn fails. No "E  TUNE" after success. |
| E5 | Whisper trap solved | Guard !whisperTrapUnlocked fails. No "E  WHISPER" after success. |
| E6 | All 3 tapes reconstructed | getAvailableBrokenTapes returns empty. No prompt. |
| E7 | Translation / i18n | Single-language project. Direct string swap is safe. |
| E8 | Prompt box width | "E  REBUILD" = 10 chars, "E  TUNE" = 7, "E  WHISPER" = 10. All fit. |
| E9 | Esc cancel during puzzle | Returns to PLAYING. Prompt reappears with new copy. |
| E10 | Respawn after death | State resets. Prompts recompute from fresh state. |

## 5. Trade-offs

The empty workbench now shows no prompt at all. A player walking through
Reception has no visual indication that the workbench is interactive.
This is intentional per F4/F5: the old "E EXAMINE" prompt lured players
into a dead-end interaction. Workbench discoverability will be addressed
separately by visual affordance (pulse ring, conditional overlay).

All four prompts use hud.showPrompt (plain text, 18px monospace). The
other interactable prompts use hud.showSpritePrompt (key icon + label
sprite). This mixes visual styles. Generating atlas label sprites for
TUNE, WHISPER, and REBUILD would restore consistency but requires the
slicer pipeline and is out of scope for a copy hotfix.

## 6. Manual playtest steps

1. Walk to Server room. Approach breaker switch (x=2700) before solving.
   Confirm prompt reads "E  TUNE".
2. Solve breaker. Re-approach. Confirm no prompt appears.
3. Walk to Archives. Approach trapdoor (x=1500) before solving.
   Confirm prompt reads "E  WHISPER".
4. Solve whisper trap. Re-approach. Confirm no prompt appears.
5. Walk to Reception workbench (x=1500) with no broken tapes.
   Confirm no prompt appears.
6. Pick up broken_tape_01 in cubicles. Return to workbench.
   Confirm prompt reads "E  REBUILD".
7. Reconstruct all 3 tapes. Return to workbench.
   Confirm no prompt appears.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] No new TS errors or warnings.
- [x] All 10 edge cases walked.
- [x] All 4 prompts updated correctly.
- [x] Empty workbench shows no prompt.
- [x] Solved puzzles do not re-show prompts.
- [x] No other code references to old prompt strings remain.
