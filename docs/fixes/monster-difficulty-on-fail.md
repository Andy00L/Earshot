# Monster Difficulty on Puzzle Fail. Hotfix U.13.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 538.97 kB (155.17 kB gz) / 539.55 kB (155.32 kB gz)
Bundle delta: +0.58 kB (+0.15 kB gzipped)
Friction addressed: gameplay difficulty (post-fail penalty was insufficient)

## 1. What changed

The Listener gains a temporary difficulty buff when the player fails the
breaker puzzle. For 8 seconds after failure, movement speed increases by
40% across all states (PATROL, HUNT, CHARGE) and dash probability during
CHARGE doubles from 25% to 50%. Both multipliers revert to 1.0 when the
buff expires.

The 8000ms buff duration matches the existing forceHunt duration from
Hotfix R. Both timers start at the same moment in handleBreakerResult
and expire together.

Whisper and tape puzzle fails were evaluated and excluded. The whisper
trap is in Archives (hasMonster: false), so no Listener is available to
receive the buff. The tape station is in Reception (hasMonster: false),
and tape fail is a silent reshuffle with no penalty by design.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/monster.ts | 22 | 0 | 4 |
| src/game.ts | 4 | 0 | 0 |

## 3. Diff summary

### src/monster.ts

BEFORE (fields):
```typescript
// Lure target (radio bait mechanic)
private lureTargetX: number | null = null;
private lureExpiresAt: number = 0;
```
AFTER:
```typescript
// Lure target (radio bait mechanic)
private lureTargetX: number | null = null;
private lureExpiresAt: number = 0;

// Temporary difficulty buff (applied on puzzle fail)
private speedMultiplier: number = 1.0;
private dashChanceMultiplier: number = 1.0;
private buffExpiresAt: number = 0;
```

NEW METHOD (applyDifficultyBuff):
```typescript
public applyDifficultyBuff(opts: {
  speedMultiplier: number;
  dashChanceMultiplier: number;
  durationMs: number;
}): void {
  this.speedMultiplier = opts.speedMultiplier;
  this.dashChanceMultiplier = opts.dashChanceMultiplier;
  this.buffExpiresAt = performance.now() + opts.durationMs;
}
```

NEW METHOD (updateBuff):
```typescript
private updateBuff(): void {
  if (this.buffExpiresAt > 0 && performance.now() >= this.buffExpiresAt) {
    this.speedMultiplier = 1.0;
    this.dashChanceMultiplier = 1.0;
    this.buffExpiresAt = 0;
  }
}
```

BEFORE (update entry):
```typescript
update(dt: number, dtMS: number): void {
    // Confused animation overrides ...
```
AFTER:
```typescript
update(dt: number, dtMS: number): void {
    this.updateBuff();
    // Confused animation overrides ...
```

BEFORE (PATROL speed, line ~307):
```typescript
this.x += this.facing * PATROL_SPEED * dt;
```
AFTER:
```typescript
this.x += this.facing * PATROL_SPEED * this.speedMultiplier * dt;
```

BEFORE (HUNT speed, line ~336):
```typescript
this.x += this.facing * HUNT_SPEED * dt;
```
AFTER:
```typescript
this.x += this.facing * HUNT_SPEED * this.speedMultiplier * dt;
```

BEFORE (CHARGE speed, line ~352):
```typescript
this.x += this.facing * chargeSpeed * dt;
```
AFTER:
```typescript
this.x += this.facing * chargeSpeed * this.speedMultiplier * dt;
```

BEFORE (CHARGE dash roll, line ~243):
```typescript
this.isDashing = Math.random() < DASH_PROBABILITY;
```
AFTER:
```typescript
this.isDashing = Math.random() < DASH_PROBABILITY * this.dashChanceMultiplier;
```

### src/game.ts

BEFORE (handleBreakerResult fail branch):
```typescript
if (this.monster) {
  this.monster.addSuspicion(60);
  this.monster.startLure({ targetX: 2700, durationMs: 8000 });
}
```
AFTER:
```typescript
if (this.monster) {
  this.monster.addSuspicion(60);
  this.monster.startLure({ targetX: 2700, durationMs: 8000 });
  this.monster.applyDifficultyBuff({
    speedMultiplier: 1.4,
    dashChanceMultiplier: 2.0,
    durationMs: 8000,
  });
}
```

## 4. Verification

- pnpm build (tsc --noEmit + vite build): exit 0
- No new TS errors or warnings

Edge cases (E1-E12):

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Re-fail resets buff | Pass. applyDifficultyBuff overwrites. Timer resets. |
| E2 | Buff on wrong monster | Pass. this.monster is Server room Listener. Correct target. |
| E3 | Buff across room change | Pass. Monster destroyed on room exit. Buff lost. |
| E4 | Compounding with difficulty curve | Pass. No separate difficulty system. No compounding. |
| E5 | Dash cooldown | Pass. One roll per CHARGE entry. Multiplier raises probability, not frequency. |
| E6 | Animation desync | Pass. STATE_FRAMES intervals fixed. Speed and animation decoupled. |
| E7 | Death mid-buff | Pass. New Monster constructor resets all fields to 1.0/0. |
| E8 | Listener outruns player | Pass. Buffed HUNT=2.94 px/frame. Player sprint is faster. Intentionally aggressive. |
| E9 | Performance | Pass. 3 fields, 1 comparison, 3 multiplications per frame. Negligible. |
| E10 | Multiple buffs queued | Pass. Overwrites. No queue. Last call wins. |
| E11 | Buff during PAUSED | Pass. Buff set after close, before ticker restart. Active on first update. |
| E12 | Buff/lure expiry sync | Pass. Both use performance.now() + 8000 in same handler. |

## 5. Trade-offs

The 1.4x speed multiplier makes the Listener noticeably faster. Buffed
HUNT speed is 2.94 px/frame (vs 2.1 baseline). The player can still
outrun by sprinting, but the margin shrinks. Buffed CHARGE speed is 6.3
px/frame (vs 4.5 baseline), but CHARGE only lasts 1000ms.

The 2.0x dash multiplier raises the per-CHARGE dash probability from 25%
to 50%. Dashes add a burst of CHARGE_SPEED * 1.5 for 600ms. With the
speed buff stacking on top, a buffed dash reaches 6.3 * 1.5 = 9.45
px/frame. This is extremely fast but lasts under a second. The intent is
to punish players who stay near the breaker after a failed attempt.

Both multipliers are constants in the handleBreakerResult call. Tuning
requires changing two numbers: 1.4 and 2.0. If playtesting shows 1.4 is
too harsh, lower to 1.25. If 2.0 dash is too punishing, lower to 1.5.

Whisper and tape fails produce no Listener buff because their rooms
(Archives, Reception) lack a Listener. Adding a buff that transfers to
adjacent rooms would be cross-room state manipulation and scope creep.

The buff overwrites rather than stacking. If the player fails the
breaker twice within 8 seconds, the second fail resets the timer. This
prevents the monster from accumulating permanent speed gains.

## 6. Manual playtest

1. Start a run. Navigate to Server room.
2. Confirm Listener is patrolling at normal speed.
3. Open breaker puzzle. Submit a wrong answer.
4. Observe Listener: moves toward breaker at higher speed, dashes more.
5. Survive 8 seconds. Listener returns to baseline speed.
6. Open breaker again. Submit wrong. Buff reapplies.
7. Submit correct answer. Confirm success path executes without buff.
8. In a separate run, fail breaker and get caught. Confirm death resets.
9. Navigate to Archives. Fail whisper puzzle. Confirm no speed change
   on the next Listener encounter (no buff was applied).

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Buff applies on breaker fail.
- [x] Buff expires after 8000ms.
- [x] Baseline AI unchanged outside buff window.
- [x] No effect on whisper/tape fails (documented).
- [x] All 12 edge cases walked.
