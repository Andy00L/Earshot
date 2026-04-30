# Tape Wrong Order Message. Hotfix U.10.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: +0.49 kB (+0.23 kB gz)
Friction addressed: F9 (MEDIUM)

## 1. What changed

When the player submits fragments in the wrong order during the tape
reconstruction puzzle, a text message "Wrong order. Try again." now
appears for 2.5 seconds. Previously, only the tape_garbled SFX played
and the slots reshuffled silently. Players reported thinking the puzzle
had broken.

The message renders as a temporary HTML element at CSS z-index 9000,
above the puzzle overlay (z-index 8000). This was necessary because the
HUD's showMessage creates a Pixi container inside the canvas (z-index
5000), which would be hidden behind the HTML puzzle overlay. The HTML
approach avoids modifying the locked tape-puzzle.ts module.

Each new wrong submission removes the previous message before creating
a fresh one (via class selector .tape-wrong-msg). No stacking.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 9 | 0 | 0 |

## 3. Diff summary

BEFORE (game.ts handleTapeResult, fail_wrong_order branch):
```typescript
    if (result === "fail_wrong_order") {
      audioManager.playOneShot("tape_garbled");
      return;
    }
```

AFTER:
```typescript
    if (result === "fail_wrong_order") {
      audioManager.playOneShot("tape_garbled");
      // Show feedback above the puzzle overlay (z-index 9000 > puzzle 8000)
      document.querySelector(".tape-wrong-msg")?.remove();
      const msg = document.createElement("div");
      msg.className = "tape-wrong-msg";
      msg.textContent = "Wrong order. Try again.";
      msg.style.cssText =
        "position:fixed;top:18%;left:50%;transform:translateX(-50%);" +
        "color:#ffcc88;font-family:'Courier New',monospace;font-size:18px;" +
        "z-index:9000;pointer-events:none;";
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 2500);
      return;
    }
```

The puzzle reshuffle logic (internal to tape-puzzle.ts) is completely
unchanged. The SFX still plays. The message is purely additive feedback.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.34s

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Rapid wrong submissions | Previous message removed via class selector before new one appears. No stacking. |
| E2 | HUD vs puzzle overlay z-index | HTML element at z-index 9000 renders above puzzle overlay at 8000. Visible. |
| E3 | Close puzzle before message expires | setTimeout fires, msg.remove() is a no-op on a detached element. Safe. |
| E4 | Solve on retry within 2.5s | Previous wrong-order message may briefly linger. Auto-removes. Acceptable. |
| E5 | Bundle size | +0.23 kB gz. |
| E6 | English only | No i18n. |

## 5. Trade-offs

Using an inline HTML element for the message is unconventional compared
to the Pixi-based HUD system. The alternative (routing the message
through the puzzle module's own DOM) would require modifying
tape-puzzle.ts, which is locked per hotfix rules. Raising the HUD's
Pixi z-index would not help because the puzzle overlay is HTML, not
Pixi. The HTML message element is the minimal working solution.

The message style (Courier New monospace, amber color #ffcc88) matches
the tape puzzle's visual theme. The fixed positioning at top 18%
places the message above the puzzle panel, visible without obscuring
the fragment buttons or slot area.

## 6. Manual playtest steps

1. Pick up a broken tape. Walk to Reception workbench. Press E.
2. Place fragments in the wrong order. Press Enter (or click Submit).
3. Confirm tape_garbled SFX plays.
4. Confirm "Wrong order. Try again." appears above the puzzle panel
   for 2.5 seconds.
5. Confirm slots clear and fragments reshuffle (existing behavior).
6. Submit wrong a second time quickly. Confirm the previous message
   is replaced, not stacked.
7. Place fragments in the correct order. Submit. Confirm tape_unlock
   SFX and puzzle closes. Any lingering wrong-order message fades
   on its own.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] All 6 edge cases walked.
- [x] HUD message visible above puzzle overlay (z-index verified).
- [x] Tape puzzle internals unchanged.
- [x] Reshuffle behavior unchanged.
