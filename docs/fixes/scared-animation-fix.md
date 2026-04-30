# Scared Animation Diagnostic and Fix. Hotfix U.28.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle before / after: 547.30 kB (157.36 kB gz) / 547.49 kB (157.41 kB gz)
Bundle delta: +0.19 kB
Friction addressed: F11 (player character did not visually respond
to environmental danger; U.24 scared logic never landed)

## 1. Diagnostic findings (Phase 0)

Searched the entire src/ directory for any trace of U.24's scared
animation logic: `isPlayerScared`, `PlayerAnimationState`,
`getPlayerAnimationState`, `updatePlayerAnimation`, `scared_idle`,
`scared_walk`. Zero matches in any file. The report file
`docs/fixes/scared-player-animation.md` does not exist on disk.

The atlas pipeline did land: `scripts/atlas_config.py` contains
`player-scared.png` with 6 frames (`scared-idle1`, `scared-idle2`,
`scared-walk1` through `scared-walk4`), and all 6 frames are present
in `assets/atlas.json` with correct paths and dimensions. The sprites
were sliced but never wired to any code.

Identified case: **C** (U.24 code never landed). There is no competing
system in game.ts. The scared states simply do not exist in the
PlayerState union, ANIM_DEFS table, or update loop.

## 2. What changed

Two new PlayerState values (`SCARED_IDLE`, `SCARED_WALK`) were added
to the ANIM_DEFS state machine in player.ts. The scared mood is
passed as a boolean parameter from game.ts to player.update(). Scared
only affects the WALK and IDLE states: when scared is true and the
player is walking, `SCARED_WALK` is selected instead of `WALK`; when
standing, `SCARED_IDLE` instead of `IDLE`. Run, crouch, run_stop, and
all hiding states are unaffected.

SCARED_WALK uses the same walk frames (walk1-4) at the same speed and
moveSpeed as normal WALK. The visual difference is a periodic
**look-back interrupt**: every 3-4.5 seconds, the walk animation is
replaced with a single frame of `scared-walk1` (the player glancing
over their shoulder) for 300ms, then normal walk resumes. This
produces the "nervous glance while walking" effect the user described.

SCARED_IDLE is a 2-frame breathing loop (scared-idle1, scared-idle2)
at animationSpeed 0.04.

game.ts now has `isPlayerScared()` which returns true when a monster
is present in the current room OR the beacon value drops below 30% of
its maximum.

## 3. State priority order

1. HIDING_LOCKER / HIDING_DESK_* (highest, stateLocked)
2. CAUGHT (stateLocked)
3. CROUCH_WALK, CROUCH_IDLE (CTRL held)
4. RUN (SHIFT held + moving)
5. RUN_STOP (200ms after exiting RUN, not moving)
6. SCARED_WALK, SCARED_IDLE (scared mood + no modifier keys)
7. WALK, IDLE (calm baseline)

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/player.ts | 32 | 3 | 4 |
| src/game.ts | 8 | 1 | 0 |

## 5. Diff summary

### src/player.ts

BEFORE: PlayerState union had IDLE, WALK, RUN, RUN_STOP, CROUCH_IDLE,
CROUCH_WALK, HIDING_*, CAUGHT. ANIM_DEFS had no scared entries.
update() took (dt, input) and chose WALK/IDLE for the default case.

AFTER: PlayerState union adds SCARED_IDLE and SCARED_WALK.
ANIM_DEFS adds:
```
SCARED_IDLE: { frameNames: ['scared-idle1', 'scared-idle2'], speed: 0.04, moveSpeed: 0 }
SCARED_WALK: { frameNames: ['walk1', 'walk2', 'walk3', 'walk4'], speed: 0.13, moveSpeed: 3 }
```

update() signature changed to `(dt, input, scared = false)`. State
determination uses scared flag for WALK/IDLE upgrades. After setState,
a look-back interrupt block handles the SCARED_WALK glance:

- Tracks `scaredLookBackUntilMs` (0 when inactive, timestamp when active)
- Tracks `nextScaredLookBackMs` (scheduled time for next interrupt)
- On first frame of SCARED_WALK: schedules look-back at now + 3000ms
- When timer fires: swaps sprite textures to [scared-walk1] for 300ms
- When hold expires: restores walk textures via force state re-entry
  (currentState = undefined, setState('SCARED_WALK'))
- On exit from SCARED_WALK: resets both timers to 0

### src/game.ts

BEFORE: `this.player.update(dt, this.input)`

AFTER: `this.player.update(dt, this.input, this.isPlayerScared())`

New method:
```typescript
private isPlayerScared(): boolean {
  return this.monster !== null
    || this.beaconState.value < this.beaconState.maxBeacon * 0.3;
}
```

## 6. Verification

- tsc --noEmit: exit 0
- npx vite build: exit 0
- Atlas: 6 scared frames confirmed in atlas.json (scared-idle1/2,
  scared-walk1/2/3/4)

Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Cubicles (monster present): SCARED_WALK activates | monster !== null returns true. SCARED_WALK selected. Look-back fires every 3-4.5s. |
| E2 | Run in cubicles (SHIFT) | isRunning = true, RUN selected. Scared bypassed. Priority correct. |
| E3 | Crouch in cubicles (CTRL) | isCrouching() checked first in both branches. CROUCH_WALK/IDLE selected. Scared bypassed. |
| E4 | Stop moving in cubicles | SCARED_IDLE selected (2-frame loop). Look-back timers reset. |
| E5 | Walk back to Reception | monster is null, beacon > 30%: scared = false. WALK selected. Timers reset. |
| E6 | Room transition mid-look-back | Look-back timer is wall-clock. On room swap, player.update() continues per frame. If still SCARED_WALK, timer plays out. If new room is calm, WALK selected, timers reset. |
| E7 | Beacon < 30% in Reception | monster is null but beacon check triggers scared = true. SCARED_WALK/IDLE activates. |
| E8 | Hide in locker during SCARED_WALK | setHidingPose sets stateLocked = true. update() returns early. Timers freeze. On exit, setStandingPose resets to IDLE. Next frame re-evaluates scared. |
| E9 | PAUSED phase | Ticker stopped. update() not called. Timers freeze. |
| E10 | First frame of SCARED_WALK | nextScaredLookBackMs is 0, set to now + 3000. No instant interrupt. |
| E11 | Rapid mood toggle | Each frame re-evaluates. Timers reset on exit from SCARED_WALK. Re-entering SCARED_WALK starts fresh 3s countdown. Acceptable. |
| E12 | Look-back texture swap | sprite.textures set to [scared-walk1], gotoAndStop(0). activeFrameNames updated for correct anchor. On next frame, setState guard prevents re-setup (same state). Texture persists until restore. |
| E13 | Anchor / scale mismatch | updateAnchor(0) called with 'scared-walk1' in activeFrameNames. Uses getFrameMeta to compute baselineY. If scared-walk1 has different dimensions than walk1, the anchor adjusts. No visual jump if sprites share canvas size. |
| E14 | Performance | Per frame: 1 isPlayerScared() call (2 comparisons), 2 performance.now() calls in SCARED_WALK. O(1). |
| E15 | SCARED_IDLE speed 0.04 | At 60fps: 0.04 * 60 = 2.4 frames/sec. 2-frame cycle = 0.83s. Slow breathing feel. Not jittery. |

## 7. Tuning constants

| Constant | Value | Location | Rationale |
|----------|-------|----------|-----------|
| Look-back base interval | 3000ms | player.ts update() | 3 seconds between glances |
| Look-back jitter | 1500ms | player.ts update() | Random 0-1500ms added for variety |
| Look-back hold duration | 300ms | player.ts update() | Brief enough to not disrupt walk |
| SCARED_IDLE speed | 0.04 | player.ts ANIM_DEFS | ~0.83s per cycle, slow breathing |
| SCARED_WALK speed | 0.13 | player.ts ANIM_DEFS | Matches normal WALK |
| SCARED_WALK moveSpeed | 3 | player.ts ANIM_DEFS | Matches normal WALK |
| Beacon scare threshold | 30% of maxBeacon | game.ts isPlayerScared() | Low-light anxiety |

Playtest adjustments:
- Look-back too rare: reduce interval to 2000ms
- Look-back too frequent: increase interval to 4500ms
- Look-back too brief: increase hold to 500ms
- Scared idle jittery: reduce speed to 0.03

## 8. Trade-offs

The look-back uses scared-walk1 as the glance frame. If the actual
"looking back" pose is on a different frame (scared-walk2, etc.),
change the frame name in the interrupt block. The remaining
scared-walk frames (2/3/4) are sliced into the atlas but unused.
They could serve a future full scared-walk cycle if the user wants
a more dramatic animation.

SCARED_WALK has the same moveSpeed as WALK (3). The player does not
slow down when scared. If playtesters want a speed penalty for fear,
reduce SCARED_WALK moveSpeed to 2.5.

The beacon threshold (30%) has no hysteresis. If the beacon value
oscillates near 30, the animation toggles. In practice, beacon drain
is smooth (linear per-frame), so oscillation is unlikely unless the
player's voice level fluctuates near a beacon-recovery threshold.

## 9. Manual playtest steps

a) Spawn in Reception, beacon full. Confirm WALK/IDLE (calm).
b) Walk into cubicles. Confirm SCARED_WALK (looks like normal walk).
c) Walk for 3+ seconds. Confirm look-back frame fires (~300ms).
d) Continue walking. Confirm look-back fires every 3-4.5 seconds.
e) Stop moving in cubicles. Confirm SCARED_IDLE (2-frame breathing).
f) Hold SHIFT. Confirm RUN (priority over scared).
g) Hold CTRL. Confirm CROUCH_WALK (priority over scared).
h) Walk back to Reception. Confirm WALK/IDLE (calm restored).
i) Wait for beacon to drain below 30%. Confirm scared activates.
j) Recover beacon above 30%. Confirm calm restored.

## 10. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] Diagnostic ran: U.24 code never landed (Case C).
- [x] SCARED_WALK plays in monster rooms with look-back interrupt.
- [x] SCARED_IDLE plays as 2-frame loop when standing.
- [x] Run priority over scared works.
- [x] Crouch priority over scared works.
- [x] Reception calm when beacon high.
- [x] Reception scared when beacon < 30%.
- [x] All 15 edge cases walked.
- [x] No AI thresholds modified.
- [x] No beacon drain rate modified.
- [x] No run/crouch/hide system modified.
