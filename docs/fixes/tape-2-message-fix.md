# Tape 2 Message Fix. Hotfix U.11.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: 0 (string length change only)
Friction addressed: F11 (MEDIUM)

## 1. What changed

Replaced the misleading message "Recording restored. Whisper radio mode
unlocked." with "Recording restored. The recording is intact." in the
tape 2 reward branch. The whisperRadioMode flag remains set on
GameState for future implementation. No mechanic was added or removed.

The original message promised a "whisper radio mode" that was deferred
per Hotfix T's design. The flag is set but no code reads it. The new
message acknowledges the reconstruction without claiming a feature.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 0 | 0 | 1 |

## 3. Diff summary

BEFORE (game.ts applyTapeReward, broken_tape_02 case):
```typescript
      case "broken_tape_02":
        this.state.whisperRadioMode = true;
        this.hud.showMessage("Recording restored. Whisper radio mode unlocked.", 4000);
        break;
```

AFTER:
```typescript
      case "broken_tape_02":
        this.state.whisperRadioMode = true;
        this.hud.showMessage("Recording restored. The recording is intact.", 4000);
        break;
```

Tape 1 and Tape 3 reward messages are unchanged. The flag assignment
(`this.state.whisperRadioMode = true`) is preserved.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.32s
- whisperRadioMode grep: set at game.ts:3442, defined in types.ts:149,
  initialized in types.ts:186. Zero consumers. Confirmed.

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Tape 2 then tape 3 in sequence | Each shows its own message. No conflict. |
| E2 | Only tape 2 completed | Lore message shows. No mechanical reward. Matches deferred design. |
| E3 | whisperRadioMode read elsewhere | Zero consumers confirmed via grep. Flag is write-only. |
| E4 | Future implementation | Flag remains set. Future code can read it without rename. |
| E5 | Bundle size | Zero delta. |
| E6 | English only | No i18n. |

## 5. Trade-offs

Tape 2 now has no mechanical reward. The player completes the puzzle
for narrative payoff only ("The recording is intact."). Tapes 1 and 3
still grant real rewards (minimap threat markers and silent exit
challenge respectively). This asymmetry is acceptable because the
deferred mechanic was never functional, and a false promise is worse
than no promise.

The flag stays in case the whisper radio mechanic is implemented. A
future hotfix can replace the message again and add the behavior
without any flag-rename churn.

## 6. Manual playtest steps

1. Collect broken_tape_02 (server x=1100).
2. Walk to Reception workbench. Press E.
3. Reconstruct tape 2 (correct fragment order).
4. Confirm tape_unlock SFX plays.
5. Confirm HUD message reads "Recording restored. The recording is
   intact." for 4 seconds.
6. Confirm no whisper radio behavior triggers on any key press.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] All 6 edge cases walked.
- [x] No tape puzzle internals modified.
- [x] No mechanic added.
- [x] Flag remains set for future use.
