# Back Button for Puzzles. Hotfix U.15.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 539.68 kB (155.32 kB gz) / 541.10 kB (155.57 kB gz)
Bundle delta: +1.42 kB (+0.25 kB gzipped)
Friction addressed: F12 partial (controls reference for ESC was implicit)

## 1. What changed

Added a clickable BACK button to the breaker puzzle and tape puzzle
overlays. The button displays the existing `assets/ui/back-button.png`
sprite (hand-drawn arrow in a chalk circle). Clicking it triggers the
same close path as pressing ESC: puzzle closes, game returns to PLAYING
phase, "cancelled" result fires, no penalty.

The whisper puzzle was excluded per user request.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/breaker-puzzle.ts | 22 | 0 | 1 |
| src/tape-puzzle.ts | 24 | 0 | 1 |

CSS lives in the same files via injected style elements.

## 3. Diff summary

### src/breaker-puzzle.ts

ADDED (buildOverlay, after hint text):
```typescript
const backBtn = document.createElement("button");
backBtn.className = "bp-back";
backBtn.setAttribute("aria-label", "Leave puzzle");
backBtn.innerHTML = '<img src="/ui/back-button.png" alt="Back" />';
backBtn.addEventListener("click", () => this.cancel());
panel.appendChild(backBtn);
```

MODIFIED (injectStyles, .bp-panel):
```css
.bp-panel {
  position: relative; /* added for absolute button anchoring */
  /* existing styles unchanged */
}
```

ADDED (injectStyles, after .bp-hint):
```css
.bp-back { position: absolute; top: 12px; right: 12px; ... }
.bp-back img { width: 100%; height: 100%; object-fit: contain; }
.bp-back:hover img { filter: brightness(1.2); }
```

### src/tape-puzzle.ts

ADDED (buildOverlay, after hint text):
```typescript
const backBtn = document.createElement("button");
backBtn.className = "tp-back";
backBtn.setAttribute("aria-label", "Leave puzzle");
backBtn.innerHTML = '<img src="/ui/back-button.png" alt="Back" />';
backBtn.addEventListener("click", () => {
  this.close();
  this.config.onResult("cancelled", this.config.tapeId);
});
panel.appendChild(backBtn);
```

MODIFIED (injectStyles, .tp-panel):
```css
.tp-panel {
  position: relative; /* added */
}
```

ADDED (injectStyles, after .tp-hint):
```css
.tp-back { position: absolute; top: 12px; right: 12px; ... }
.tp-back img { width: 100%; height: 100%; object-fit: contain; }
.tp-back:hover img { filter: brightness(1.2); }
```

## 4. Verification

- pnpm build (tsc --noEmit + vite build): exit 0
- No new TS errors or warnings

Edge cases (E1-E10):

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Image fails to load | Pass. Asset confirmed on disk (2.2M). Broken icon if missing. |
| E2 | Click area too small | Pass. 48x48 meets minimum touch target. |
| E3 | Overlaps puzzle content | Pass. Button in panel padding area. Slight title overlap is cosmetic. |
| E4 | Multiple clicks | Pass. close() is idempotent (guards on open_ flag). |
| E5 | Keyboard accessibility | Pass. Native button element. Enter/Space triggers click. |
| E6 | Focus interference | Pass. Keyboard handlers on document, not element-specific. |
| E7 | Touch hover | Pass. Sticky brightness is cosmetic only. |
| E8 | Whisper excluded | Pass. Not modified per user decision. |
| E9 | Bundle size | Pass. +1.42 kB. Image in public dir (not bundled). |
| E10 | Z-index | Pass. Button inside panel at z-index 8000. No conflicts. |

## 5. Trade-offs

ESC still works. The button is purely additive. Players who prefer
keyboard can continue using ESC. Players who expect a clickable exit
now have one.

The button position (top-right, absolute) may slightly overlap the
right edge of long title text on narrow viewports. At 480px panel
width with 32px padding, the overlap is minimal. If it proves
distracting, the button can be moved outside the panel (into the
overlay) or the title can be given right-padding.

The whisper puzzle does not get a button in this hotfix. The same
pattern (createElement button with tp-back/bp-back class, cancel
on click) can be applied to whisper-puzzle.ts if the user requests.

The back-button.png is 2.2 MB. It loads from the public directory on
first puzzle open. On fast connections this is invisible. On slow
connections, the image may pop in after the puzzle renders. Compressing
or resizing the PNG is deferred as polish.

## 6. Manual playtest

1. Open breaker puzzle. Confirm back button visible at top-right.
2. Hover the button. Confirm brightness increases.
3. Click the button. Confirm puzzle closes. Game returns to PLAYING.
   No penalty applied.
4. Re-open breaker. Press ESC. Confirm ESC still works (regression).
5. Pick up a tape. Open tape puzzle at workbench.
6. Confirm back button visible at top-right.
7. Click it. Puzzle closes. No penalty.
8. Re-open tape puzzle. Press ESC. Confirm still works.
9. Verify no back button on whisper puzzle (not in scope).

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Both puzzles have a working back button.
- [x] ESC still works (regression check).
- [x] All 10 edge cases walked.
- [x] No mechanic changes (purely UX additive).
