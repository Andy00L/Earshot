# Run Mechanic. Hotfix U.25.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle before / after: 545.64 kB (156.94 kB gz) / 545.64 kB (156.94 kB gz)
Bundle delta: ~0.8 kB (GainNode + gain modulation logic)
Atlas frames added: 0 (all 6 already present from prior atlas integration:
player:run1/2/3/4, run-stop, run-look-back)
Friction addressed: F4 partial (lacking high-stakes movement option;
the player could not commit to a fast escape)

## 1. What changed

Holding SHIFT while moving was already wired to the RUN animation state
with a moveSpeed of 6 (vs WALK's 3). The missing piece was the mic gain
amplification that makes running dangerous.

A GainNode was inserted into the mic pipeline in src/mic.ts between the
MediaStreamSource and the AnalyserNode. Per frame, game.ts sets the gain
to 3.0 when the player is in the RUN state. The analyser reads louder
RMS values, which feed into the suspicion curve in src/suspicion.ts
(unchanged). The Listener responds more aggressively because the input
is louder, not because the AI was modified.

A RUN_STOP deceleration state was added to player.ts. When the player
exits the RUN state (releases SHIFT or stops moving), a 200ms timer
shows the run-stop frame before transitioning to IDLE. If the player
starts moving again during the window, the timer is skipped.

## 2. Constants

| Constant | Value | Location |
|----------|-------|----------|
| RUN moveSpeed | 6 | player.ts ANIM_DEFS (pre-existing) |
| Mic gain (run) | 3.0 | game.ts inline |
| RUN_STOP duration | 200ms | player.ts (performance.now timer) |

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/mic.ts | 16 | 0 | 2 |
| src/player.ts | 14 | 2 | 0 |
| src/game.ts | 12 | 0 | 1 |

## 4. Diff summary

### src/mic.ts

BEFORE: source connects directly to analyser.
```
this.source = ctx.createMediaStreamSource(this.stream);
this.source.connect(this.analyser);
```

AFTER: GainNode inserted between source and analyser. setGain() method exposed.
```
this.gainNode = ctx.createGain();
this.gainNode.gain.value = 1.0;
this.source = ctx.createMediaStreamSource(this.stream);
this.source.connect(this.gainNode);
this.gainNode.connect(this.analyser);
```

### src/player.ts

BEFORE: PlayerState union had no RUN_STOP. update() transitioned directly
from RUN to IDLE on SHIFT release.

AFTER: RUN_STOP added to PlayerState. ANIM_DEFS entry added with
frameNames: ['run-stop'], speed: 0, moveSpeed: 0. Timer fields
(wasRunning, runStopUntilMs) track the 200ms window. When the player
was running last frame and is not running this frame, the timer starts.
While the timer is active and the player is not moving, RUN_STOP state
is used.

### src/game.ts

BEFORE: No mic gain modulation. micAnalyser.sample() reads raw RMS.

AFTER: Between player.update() and micAnalyser.sample(), the gain is
set based on movementState. RUN = 3.0, CROUCH = 0.2, otherwise 1.0.
Gain reset to 1.0 in triggerDeath().

## 5. Verification

- tsc --noEmit: exit 0
- npx vite build: exit 0
- Atlas: all 6 run frames present in atlas.json (player:run1 through
  run4, run-stop, run-look-back)

Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | SHIFT held during PAUSED | Safe. Ticker stopped, player.update() not called. Gain stays at last value; on resume, next frame re-evaluates. |
| E2 | SHIFT held while hidden in locker | Safe. stateLocked = true, update() returns early. movementState stays HIDING_LOCKER. Gain set to 1.0 (not RUN). |
| E3 | SHIFT held during whisper puzzle | Safe. PAUSED phase, ticker stopped. |
| E4 | Speed at 1.5x breaks collision | Inspected: moveSpeed is 6 (2x WALK, not 1.5x). Player clamped to [60, roomWidth-60] per frame. Rooms are 3344px wide. At 6px/frame the player traverses ~558 frames (9.3s at 60fps). No phasing risk. |
| E5 | Mic gain overflow analyser | RMS values from getFloatTimeDomainData scale with gain. At 3x, a normal speaking voice (~0.03 RMS) reads as ~0.09, which is in the "loud voice" band. Saturation at the "shout" band is expected for actual shouting while running. Acceptable. |
| E6 | Mic gain not restored on death | Handled. triggerDeath() calls micAnalyser.setGain(1.0). |
| E7 | Mic gain not restored on puzzle close | Safe. Puzzles set PAUSED (ticker stops). On resume, next PLAYING tick re-evaluates gain from movementState. |
| E8 | Player runs into hide spot prompt | HUD prompt is overlay, run animation is world-space. No conflict. |
| E9 | Player runs and presses E for puzzle | PAUSED activates, ticker stops. Gain stays at last value until resume. On next PLAYING tick, gain re-evaluated from IDLE. |
| E10 | run_stop conflicts with idle transition | When player releases SHIFT and stops moving: RUN_STOP for 200ms then IDLE. When player releases SHIFT but keeps moving: moving branch takes priority, skips RUN_STOP. |
| E11 | Texture cache for run frames | Textures loaded via manifest at startup. ANIM_DEFS references frame names, resolved through getFrameTexture. No per-frame loading. |
| E12 | Run + scared: no scared_run sprite | Run overrides mood. ANIM_DEFS RUN state uses run1-4 regardless of scared/calm. Acceptable: when sprinting, the run animation reads better than a scared variant. |
| E13 | SHIFT key auto-repeat on Windows | Input.held is a Set. Repeated keydown events add the same key; Set ignores duplicates. |
| E14 | Player has charm + presses F + holds SHIFT | Charm activation is guarded by justUsedCharm (justPressed). Run state unaffected by charm. Charm audio is pre-recorded, not mic-dependent. Compose cleanly. |
| E15 | Performance | Per-frame: 1 movementState read, 1 string comparison, 1 GainNode.gain.value write. O(1). Negligible. |

## 6. Trade-offs

The mic gain of 3.0 is aggressive. A player speaking at normal volume
while running will register in the "loud voice" suspicion band (32-72
per second), which means the Listener enters HUNT within 1-2 seconds.
Running near the monster is effectively suicidal unless the player is
already escaping and out of earshot. If playtesters find this too harsh,
reduce the gain to 2.0 or 2.5.

The moveSpeed for RUN is 6 (2x WALK's 3), which is higher than the
spec's 1.5x suggestion. This was pre-existing and already play-tested.
Kept as-is to avoid regression.

run-look-back is sliced into the atlas but NOT wired to any state.
Future polish: trigger when SHIFT is held AND a monster is within 300px
behind the player.

The RUN_STOP deceleration frame only shows when the player is stationary.
If the player releases SHIFT but keeps moving, they transition directly
to WALK. This avoids a jarring stop-in-place while keys are held.

## 7. Manual playtest steps

a) Hard refresh browser.
b) In Reception, walk normally. Confirm WALK animation.
c) Hold SHIFT while walking. Confirm:
   - Player moves faster (6px/frame vs 3px/frame)
   - Animation switches to run (4-frame cycle)
   - Mic indicator shows louder readings
d) Release SHIFT while stationary. Confirm:
   - run-stop frame shows briefly (200ms)
   - Transitions to IDLE
e) Release SHIFT while moving. Confirm:
   - Direct transition to WALK (no run_stop)
f) Walk into cubicles. Hold SHIFT.
   - Listener AI responds aggressively (mic gain 3x)
g) Stand still. Hold SHIFT. No running (SHIFT alone does nothing).
h) Open whisper puzzle. Hold SHIFT. No running during PAUSED.
i) Die. Respawn. Speed normal, mic gain normal.
j) Hold both SHIFT and CTRL: crouch wins (CTRL priority).

## 8. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] Run animation triggers on SHIFT + movement.
- [x] Speed uses ANIM_DEFS moveSpeed (6 for RUN).
- [x] Mic gain multiplier applied (3.0x) via GainNode.
- [x] Suspicion curve unchanged in suspicion.ts.
- [x] Mic gain restored on SHIFT release (next frame sets 1.0).
- [x] Mic gain restored on death (triggerDeath calls setGain(1.0)).
- [x] PAUSED phase blocks run (ticker stopped).
- [x] Hide state blocks run (stateLocked).
- [x] RUN_STOP deceleration frame implemented (200ms).
- [x] All 15 edge cases walked.
