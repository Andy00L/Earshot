# Crouch Mechanic. Hotfix U.26.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle before / after: 545.64 kB (156.94 kB gz) / 545.64 kB (156.94 kB gz)
Bundle delta: 0 kB (crouch gain logic shares the GainNode from U.25;
the CROUCH_IDLE and CROUCH_WALK states were pre-existing)
Atlas frames added: 0 (all 6 crouch frames already present from prior
atlas integration: player:crouch-idle1/2, crouch-walk1/2/3/4, plus
the static crouch frame in player-base.png)
Friction addressed: F4 partial (lacking stealth movement; player had
no way to bypass the Listener silently)

## 1. What changed

Holding CTRL while moving was already wired to CROUCH_WALK (moveSpeed
1.5, vs WALK's 3 = 50% slower). Holding CTRL while standing already
triggered CROUCH_IDLE. The CTRL-over-SHIFT priority was already
enforced in player.ts update().

The missing piece was the mic gain reduction. Using the GainNode added
in U.25, the crouch states now set mic gain to 0.2 (80% reduction).
This makes the crouching player effectively silent to the Listener.

The gain modulation in game.ts was implemented as part of U.25. The
check is: movementState === "CROUCH_WALK" or "CROUCH_IDLE" sets gain
to 0.2.

## 2. Constants

| Constant | Value | Location |
|----------|-------|----------|
| CROUCH_WALK moveSpeed | 1.5 | player.ts ANIM_DEFS (pre-existing) |
| CROUCH_IDLE moveSpeed | 0 | player.ts ANIM_DEFS (pre-existing) |
| Mic gain (crouch) | 0.2 | game.ts inline |

## 3. Files changed

U.26 changes were delivered together with U.25 in the same edit pass.
All crouch-specific code was the gain modulation branch in game.ts.

| File | Lines added (U.26 specific) | Notes |
|------|-------------|-------|
| src/game.ts | 2 | CROUCH_WALK/CROUCH_IDLE branch in gain logic |

The movement states, input handling, atlas config, and animation system
for crouch were all pre-existing.

## 4. Diff summary

### src/game.ts (mic gain modulation block, shared with U.25)

BEFORE: No mic gain modulation.

AFTER:
```typescript
if (micAnalyser.state === "active") {
  const ms = this.player.movementState;
  if (ms === "RUN") {
    micAnalyser.setGain(3.0);
  } else if (ms === "CROUCH_WALK" || ms === "CROUCH_IDLE") {
    micAnalyser.setGain(0.2);
  } else {
    micAnalyser.setGain(1.0);
  }
}
```

## 5. Verification

- tsc --noEmit: exit 0
- npx vite build: exit 0
- Atlas: all crouch frames present in atlas.json (player:crouch-idle1,
  crouch-idle2, crouch-walk1 through crouch-walk4, crouch)

Edge cases:

| # | Edge case | Status |
|---|-----------|--------|
| E1 | CTRL held during PAUSED | Safe. Ticker stopped, player.update() not called. Gain stays at last value. |
| E2 | CTRL held while hidden in locker | Safe. stateLocked = true, update() returns early. movementState stays HIDING_LOCKER. Gain set to 1.0. |
| E3 | Both SHIFT and CTRL held | CTRL wins. player.ts line 228: isCrouching() checked before isRunning(). Gain set to 0.2. |
| E4 | CTRL held + standing | CROUCH_IDLE animation plays. Mic gain 0.2 applied. Player effectively silent while crouched and still. |
| E5 | CTRL released while crouching | Next frame: movementState evaluates to IDLE or WALK. Gain set to 1.0. |
| E6 | Speed 0.5 still allows crossing rooms | CROUCH_WALK moveSpeed is 1.5 (half of WALK's 3). Cubicles crossing at 1.5px/frame: ~37 seconds at 60fps. Slow but feasible. |
| E7 | Mic gain 0.2 makes Listener completely deaf | Nearly. Normal speech RMS ~0.03 becomes 0.006 after 0.2x gain. Below silence floor (0.01125). The Listener cannot detect a crouched player speaking at normal volume. Intended stealth reward. |
| E8 | Crouched whisper in mic | RMS ~0.011 at 0.2x = 0.0022. Far below silence floor. Listener unaware. Intended. |
| E9 | Crouch + whisper trap puzzle | PAUSED phase prevents crouch gain from applying during puzzle. Whisper puzzle reads from the same analyser, but ticker is stopped during PAUSED so gain is not set to 0.2. On resume, gain re-evaluates from IDLE = 1.0. |
| E10 | Crouch + tape puzzle | Same as E9. PAUSED blocks. |
| E11 | Crouch + radio bait | Radio bait uses TTS audio at throw position. Not mic-dependent. Compose cleanly. |
| E12 | Crouch + charm activation (F) | Charm uses pre-recorded audio. Not affected by gain. |
| E13 | Crouch released, monster nearby | Gain returns to 1.0 on next frame. Player's actual voice RMS is now read at full volume. Listener may hunt immediately. Matches expectation: standing up is loud. |
| E14 | Rapid CTRL toggle | Each frame re-evaluates. Set operations are idempotent. Animation switches per frame. Acceptable user input quality. |
| E15 | CTRL+key combos (CTRL+R, CTRL+W) | Browser handles these before game's keydown listener. input.ts does not preventDefault on CTRL. |
| E16 | Crouch and beacon drain | Beacon drain rate unchanged. Crouching does not affect beacon. Player still loses light over time. |
| E17 | Walk -> crouch_walk transition | Snaps immediately. No transition animation. Acceptable. |
| E18 | crouch (static) frame | The single "crouch" frame from player-base.png is in the atlas but not used as a separate state. Available for future polish (one-shot crouch-down transition before crouch_idle starts). |

## 6. Trade-offs

Crouch at 0.2x gain makes the player effectively invisible to the
Listener. Normal speech at 0.2x reads below the silence floor. Only
shouting (RMS > 0.05625 raw = 0.01125 after gain) would register. This
is the intended stealth reward. If playtesters find it overpowered,
increase CROUCH_MIC_GAIN toward 0.4.

CTRL-over-SHIFT priority is an arbitrary design choice. Crouch wins
because stealth is the more deliberate action. Players who hold both
keys accidentally get the safer behavior.

The existing suspicion decay bonus for crouching (3x decay multiplier,
game.ts line 582) stacks with the reduced mic gain. A crouched player
has both lower suspicion input AND faster suspicion decay. Combined,
the Listener forgets the player almost immediately while crouched. This
double benefit is intentional for the stealth fantasy.

## 7. Manual playtest steps

a) Hard refresh browser.
b) In Reception, walk normally. Confirm WALK animation.
c) Hold CTRL while walking. Confirm:
   - Player slows visibly (1.5px/frame vs 3px/frame)
   - Animation switches to crouch_walk (4-frame cycle)
d) Stop moving with CTRL held. Confirm crouch_idle (2-frame breathing).
e) Release CTRL. Confirm speed and animation return to normal.
f) Walk into cubicles. Hold CTRL. Listener does not detect normal speech.
g) Hold SHIFT+CTRL: crouch wins. Player crouches, no run.
h) Release CTRL, keep SHIFT: player runs. Mic gain goes to 3.0.
i) Release SHIFT: player walks. Mic gain goes to 1.0.
j) Open whisper puzzle. CTRL has no effect (PAUSED).
k) Die. Respawn. Mic gain restored to 1.0.

## 8. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] Crouch animation triggers on CTRL (pre-existing).
- [x] Speed multiplier applied (0.5x via moveSpeed 1.5, pre-existing).
- [x] Mic gain multiplier applied (0.2x) via GainNode.
- [x] Suspicion curve unchanged in suspicion.ts.
- [x] Mic gain restored on CTRL release (next frame sets 1.0).
- [x] Mic gain restored on death (triggerDeath calls setGain(1.0)).
- [x] PAUSED phase blocks crouch gain (ticker stopped).
- [x] Hide state blocks crouch (stateLocked).
- [x] Crouch overrides run if both held (pre-existing priority).
- [x] Run mechanic from U.25 still works alone.
- [x] Whisper puzzle still works (PAUSED prevents crouch interference).
- [x] All 18 edge cases walked.
