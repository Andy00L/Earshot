# Trapdoor Sprite Visibility Fix. Hotfix U.18.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 541.58 kB (155.83 kB gz) / 541.76 kB (155.86 kB gz)
Bundle delta: +0.18 kB (+0.03 kB gzipped)
Friction addressed: F1 follow-on (sprite swap from U.0bis was not
visible during normal gameplay)

## 1. Diagnostic findings

Atlas frame name: `puzzle-props:trapdoor_sealed` (entity `puzzle-props`,
type `character`, frame `trapdoor_sealed`). Confirmed in atlas.json
lines 369-389.

Code reference name: `Assets.get<Texture>("puzzle-props:trapdoor_sealed")`
at game.ts:3367.

Match: yes. Frame name mismatch (Fix Path A) ruled out.

Source PNG: `assets/puzzle-props/trapdoor_sealed.png` exists, 2.3 MB.

Loading pipeline: `src/assets.ts` correctly registers character entity
frames as `entityName:frameName` aliases. The `puzzle-props:trapdoor_sealed`
alias is included in the `Assets.load()` batch. Texture is available
before game init.

Identified path: **E** (sprite never created during room transitions).

## 2. Root cause

`createWhisperTrapSprite()` was missing from the `transitionToRoom()`
method. The method is the main room-change path used during normal
gameplay. It was present in two other call sites (constructor at
line 312, respawn at line 1858), but both of those always start in
reception, where `createWhisperTrapSprite()` returns early because
`this.state.currentRoom !== "archives"`.

When the player walked from Reception to Archives, `transitionToRoom()`
ran: destroyed old room contents, swapped to Archives background,
created pickups, monster, doors, decorative props, foreground props,
hiding spots, vents, jumpers, radio sprites, shade visual, and pulse
rings. It never called `createWhisperTrapSprite()`. The PulseRing
appeared because `createPulseRings()` IS called and independently
checks `this.state.currentRoom === "archives"`.

A secondary bug: `destroyRoomContents()` never destroyed the
`whisperTrapSprite`. Since the sprite was never created during
transitions, this never manifested, but after the fix it would cause
a sprite leak if the player left Archives without cleanup.

## 3. Fix applied

Two changes to `src/game.ts`:

1. Added `this.createWhisperTrapSprite()` to `transitionToRoom()` in
   the "Populate new room" block, between `createDecorativeProps()` and
   `createForegroundProps()`. Matches the call order in the constructor
   and respawn paths.

2. Added `whisperTrapSprite` cleanup to `destroyRoomContents()`, before
   `destroyPulseRings()`. Removes the sprite from its parent, destroys
   it, and sets the field to null.

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 6 | 0 | 0 |

## 5. Diff summary

### src/game.ts - transitionToRoom()

BEFORE (lines 1415-1417):
```typescript
      this.createDoors();
      this.createDecorativeProps();
      this.createForegroundProps();
```

AFTER:
```typescript
      this.createDoors();
      this.createDecorativeProps();
      this.createWhisperTrapSprite();
      this.createForegroundProps();
```

### src/game.ts - destroyRoomContents()

BEFORE (lines 1537-1539):
```typescript
    this.destroyPulseRings();
    this.stopWhisperTrapAmbient();
  }
```

AFTER:
```typescript
    if (this.whisperTrapSprite) {
      this.whisperTrapSprite.parent?.removeChild(this.whisperTrapSprite);
      this.whisperTrapSprite.destroy();
      this.whisperTrapSprite = null;
    }

    this.destroyPulseRings();
    this.stopWhisperTrapAmbient();
  }
```

## 6. Verification

- tsc --noEmit: exit 0
- vite build: exit 0 (4.05s)

Manual playtest (user must verify):

| Step | Expected | Status |
|------|----------|--------|
| a) Hard refresh browser | No cached JS | pending |
| b) Walk to Archives from Reception | Room transition, arrive at x=200 | pending |
| c) Walk to x=1500 | Trapdoor sprite visible (chained metal door), PulseRing behind it | pending |
| d) PulseRing renders | Pale green pulsing circle at zIndex 19, behind sprite at zIndex 20 | pending |
| e) "E WHISPER" prompt appears | At close approach | pending |
| f) Press E | Whisper puzzle opens | pending |
| g) Solve puzzle | Sprite dims to alpha 0.4, PulseRing destroyed | pending |
| h) Leave and re-enter Archives | Sprite shows unlocked state (alpha 0.4), no PulseRing | pending |

## 7. Edge cases (E1-E10)

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Multiple atlas namespaces | N/A. atlas.json uses `puzzle-props` entity. Code matches. |
| E2 | Texture not loaded at creation time | Pass. `Assets.load()` awaited before game init. All aliases loaded. |
| E3 | Sprite not added to world | Pass. `createWhisperTrapSprite` calls `this.world.addChild(sprite)` at line 3381. |
| E4 | Destroyed parent container | Pass. World container is alive during room transitions. |
| E5 | PulseRing covers sprite | Pass. Ring zIndex 19, sprite zIndex 20. Sprite renders on top. |
| E6 | Sprite too small | Pass. Scale 0.17 on 933px source = ~159px display width. Visible. |
| E7 | DevTools unavailable | N/A. Diagnostic done via code review. Root cause identified without runtime inspection. |
| E8 | Sealed vs unlocked branch | Pass. Both branches handle alpha correctly. Sealed: 1.0. Unlocked: 0.4. |
| E9 | User already solved puzzle | N/A. User reports PulseRing visible, which only renders when `!whisperTrapUnlocked`. Puzzle is unsolved. |
| E10 | HMR stale state | N/A. Bug is in room transition code, not HMR-specific. Production build has same behavior. |

## 8. Trade-offs

The fix adds one function call and one cleanup block. No architectural
changes. The `createWhisperTrapSprite()` function is already designed
to be called per-room (it checks `this.state.currentRoom !== "archives"`
and returns early for non-Archives rooms). The cleanup mirrors the
pattern used for other sprite fields (`upperBgSprite`, `shadeVisual`):
removeChild, destroy, null.

The call placement between `createDecorativeProps()` and
`createForegroundProps()` matches the constructor order. The trapdoor
sprite at zIndex 20 renders above decorative props (zIndex varies) and
below the foreground layer (zIndex 80).

## 9. Self-check

- [x] No em dashes.
- [x] Build green (tsc + vite exit 0).
- [x] Trapdoor sprite will render at x=1500 in Archives.
- [x] PulseRing unmodified (still creates at zIndex 19).
- [x] Whisper puzzle internals untouched.
- [x] Cleanup added to prevent sprite leaks on room exit.
- [x] All 10 edge cases walked.
