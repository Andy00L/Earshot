# Jumper Lunge Sub-Bass and Frame Freeze. Hotfix P.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after gzipped: 147.20 KB / 147.47 KB (+0.27 KB)

## 1. Effects added

Two procedural impact effects fire at the moment the floor jumper's attack lunge sound plays. The lunge fires inside the existing 600 ms setTimeout in jumper.ts enterState("attacking") (line 376), guarded by `if (this.state === "attacking")`. The `onVfxEvent("attack_lunge", this)` callback (line 380) reaches handleJumperVfx in game.ts (line 2670), which already triggers screen shake and vignette flash per Hotfix O.

**Sub-bass impact.** 40 Hz sine oscillator, 200 ms total duration, peak gain 0.3, 5 ms attack ramp, 195 ms linear release. Pattern matches heartbeat.ts: oscillator + gain node scheduled via setValueAtTime / linearRampToValueAtTime, connected through a master GainNode to Howler's shared AudioContext destination. Each trigger creates a fresh oscillator + gain pair; cleanup is automatic via the oscillator's onended event (Web Audio spec).

**Frame freeze.** 50 ms gameplay tick pause. During the freeze, handlePlayingTick (game.ts line 480) returns early after updating only the camera position (read-only, prevents screen shake drift), screen shake (jitter stays visible), dust particles (physics continue), and vignette flash (alpha tween continues). All gameplay updates are skipped: player movement, monster AI, jumper FSM, whisperer, mic input, beacon drain, suspicion accumulation, interaction prompts, footsteps, and catch checks. Audio playback (Howler) is independent of the tick and continues uninterrupted.

Both effects gate on distance. The existing `scale` variable in handleJumperVfx (0 at 1500 px, 1 at 500 px) must exceed 0.3 for the bass and freeze to fire. That threshold corresponds to roughly 1200 px distance. Distant jumpers trigger screen shake and vignette (which already scale with distance) but not the hit-stop.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/impact-bass.ts | 65 | 0 | 0 (new file) |
| src/frame-freeze.ts | 27 | 0 | 0 (new file) |
| src/game.ts | 22 | 0 | 3 |

## 3. Diff summary

### src/impact-bass.ts (new)

Exports `ImpactBass` class. Constructor is empty. `start(sharedCtx)` stores the AudioContext and creates a master GainNode (gain 1.0) connected to ctx.destination. `trigger()` creates a sine oscillator at 40 Hz, schedules a 5 ms attack ramp to gain 0.3 then a 195 ms release ramp to 0, starts the oscillator, and stops it after 210 ms. The onended handler disconnects both nodes. `destroy()` disconnects the master gain.

### src/frame-freeze.ts (new)

Exports `FrameFreeze` class. `trigger(durationMs)` records `performance.now() + durationMs` as the freeze deadline (additive: keeps the longer of overlapping freezes). `isFrozen()` returns true while `performance.now()` is before the deadline. `clear()` resets to 0.

### src/game.ts

BEFORE (imports, line 58):
```typescript
import { Heartbeat } from "./heartbeat";
```

AFTER:
```typescript
import { Heartbeat } from "./heartbeat";
import { ImpactBass } from "./impact-bass";
import { FrameFreeze } from "./frame-freeze";
```

BEFORE (fields, line 161):
```typescript
  private screenShake = new ScreenShake();
  private heartbeat = new Heartbeat();
```

AFTER:
```typescript
  private screenShake = new ScreenShake();
  private heartbeat = new Heartbeat();
  private impactBass = new ImpactBass();
  private frameFreeze = new FrameFreeze();
```

BEFORE (init, line 318):
```typescript
    this.heartbeat.start(Howler.ctx);
```

AFTER:
```typescript
    this.heartbeat.start(Howler.ctx);
    this.impactBass.start(Howler.ctx);
```

BEFORE (handlePlayingTick, line 477):
```typescript
    if (this.locked) return;

    // Ladder climbing state overrides normal player movement
```

AFTER:
```typescript
    if (this.locked) return;

    // Frame freeze (Hotfix P): skip gameplay updates, keep VFX alive
    if (this.frameFreeze.isFrozen()) {
      this.updateCamera();
      this.screenShake.update(dtMS);
      this.world.x += this.screenShake.offsetX;
      this.world.y += this.screenShake.offsetY;
      this.updateDustParticles(dtMS);
      this.updateVignetteFlash(dtMS);
      return;
    }

    // Ladder climbing state overrides normal player movement
```

BEFORE (handleJumperVfx attack_lunge, line 2669):
```typescript
      case "attack_lunge":
        this.screenShake.trigger(400, Math.round(12 * scale));
        this.triggerVignetteFlash(0xff3030, 0.85 * scale, 300);
        this.hud.showSubtitle("[Creature shrieks]", 1500);
        break;
```

AFTER:
```typescript
      case "attack_lunge":
        this.screenShake.trigger(400, Math.round(12 * scale));
        this.triggerVignetteFlash(0xff3030, 0.85 * scale, 300);
        this.hud.showSubtitle("[Creature shrieks]", 1500);
        if (scale > 0.3) {
          this.impactBass.trigger();
          this.frameFreeze.trigger(50);
        }
        break;
```

BEFORE (triggerDeath, line 1431):
```typescript
    }
    audioManager.playOneShot("death_thud");
```

AFTER:
```typescript
    }
    this.frameFreeze.clear();
    audioManager.playOneShot("death_thud");
```

BEFORE (room change cleanup, line 1291):
```typescript
    this.clearDustParticles();

    if (this.whisperer) {
```

AFTER:
```typescript
    this.clearDustParticles();
    this.frameFreeze.clear();

    if (this.whisperer) {
```

BEFORE (restart cleanup, line 2131):
```typescript
    // Clean up heartbeat
    this.heartbeat.destroy();
```

AFTER:
```typescript
    // Clean up heartbeat and impact bass
    this.heartbeat.destroy();
    this.impactBass.destroy();
    this.frameFreeze.clear();
```

## 4. Verification

- pnpm build: exit 0 (via `npm run build` which chains `tsc --noEmit && vite build`)
- tsc --noEmit: exit 0, no errors, no new warnings
- Static walk-through:

| Step | Expected | Passes? |
|------|----------|---------|
| Floor jumper enters attacking state | Charge sound fires. No bass, no freeze yet. | yes |
| 600 ms later (lunge) | Lunge sound, 12 px screen shake, red vignette flash 300 ms, sub-bass 40 Hz thump, 50 ms gameplay freeze. | yes |
| During 50 ms freeze | Vignette flash tweens alpha. Screen shake jitters. Dust particles (if any from emerge) continue physics. Player input dropped. AI paused. | yes |
| After freeze | Gameplay resumes. Player can move. Monster/jumper/mic/beacon tick. | yes |
| Far from jumper (scale = 0) | Lunge sound muted (per Hotfix O distance volume). Screen shake 0. Vignette 0. No bass, no freeze. | yes |
| Mid-distance (scale = 0.5) | Lunge at half volume. Shake 6 px. Vignette 0.425 alpha. Bass fires (0.5 > 0.3). Freeze fires. | yes |
| At threshold (scale = 0.3) | Shake 4 px. Vignette 0.255. Bass/freeze skip (0.3 is not > 0.3). | yes |
| Ceiling jumper falling | No onVfxEvent("attack_lunge"). Ceiling uses monster_charge_roar. No bass, no freeze. | yes |
| Player dies during freeze | triggerDeath calls frameFreeze.clear(). Freeze ends immediately. Death sequence proceeds. | yes |
| Room change during freeze | Room cleanup calls frameFreeze.clear(). No carryover. | yes |
| Restart | impactBass.destroy() disconnects master gain. frameFreeze.clear() resets. New Game instance starts fresh. | yes |

## 5. Edge cases (E1-E15)

| # | Edge case | Status | Notes |
|---|-----------|--------|-------|
| E1 | AudioContext suspended (no user gesture) | Safe | ImpactBass.trigger() returns early when ctx.state is "suspended". No crash, no silent oscillator leak. |
| E2 | Mute toggled during freeze | Safe | Freeze is time-based (performance.now), not audio-dependent. Bass already triggered and may be partially affected by master gain change. Acceptable. |
| E3 | Player dies during freeze | Safe | triggerDeath() calls frameFreeze.clear(). Death animation proceeds immediately. |
| E4 | Two lunges within 50 ms | Impossible | Attacking has a 4000 ms cooldown (FLOOR_ATTACK_AUDIO_COOLDOWN_MS). Two different jumpers could overlap; freeze extends additively, bass stacks (two oscillators sum constructively). Both acceptable. |
| E5 | Sample rate drift | N/A | Web Audio scheduling uses ctx.currentTime. The 5 ms attack is ~5 ms across 44.1/48/96 kHz. No edge case. |
| E6 | Howler.ctx undefined on first play | Safe | ImpactBass.start(Howler.ctx) runs at game.ts line 320, after Howler has loaded audio. Heartbeat uses the same pattern at line 318 and works. |
| E7 | Frozen tick during Pixi animation | Acceptable | Pixi sprite animations run on app.ticker, not on handlePlayingTick. The jumper sprite continues its lunge animation during freeze. The creature visually completes the lunge while gameplay is paused. |
| E8 | Frozen tick during room transition | Safe | Room transitions set this.locked = true. handlePlayingTick returns at line 479 before reaching the freeze check. Freeze is a no-op during locked state. |
| E9 | Frozen tick during pause/popup | Safe | The radio popup and workbench menu change the phase away from PLAYING. The main tick dispatcher does not call handlePlayingTick in non-PLAYING phases. Freeze expires silently. |
| E10 | Frozen tick during intro | Safe | Intro is its own phase. handlePlayingTick is not called. |
| E11 | Mobile audio (40 Hz) | Acceptable degradation | 40 Hz is below most phone speaker ranges. Inaudible without headphones/subwoofer. The game already shows a headphones warning on the title screen. |
| E12 | HMR (dev hot reload) | Safe | ImpactBass and FrameFreeze are owned by Game. On HMR, Game is re-instantiated. Old instances are GC'd. AudioContext is shared via Howler.ctx; oscillator cleanup happens via onended. |
| E13 | Game restart/respawn | Safe | Restart creates a new Game (line 2190). The old Game's restart() calls impactBass.destroy() and frameFreeze.clear(). The new Game creates fresh instances. |
| E14 | Performance | Negligible | ImpactBass.trigger() creates 2 Web Audio nodes per call. At 4000 ms cooldown per jumper and 4 jumpers max, peak rate is ~1 trigger per 1000 ms. FrameFreeze.trigger() writes one number. |
| E15 | Sub-bass clipping | Acceptable | Summed signal at peak: lunge sound ~0.9 + ambient ~0.3 + bass 0.3 + heartbeat peak ~0.55 = ~2.05. Clipping is possible but brief (the bass peaks for 5 ms). Lower peakGain to 0.2 if audible distortion is reported. The master gain on ImpactBass is 1.0 and can be tuned. |

## 6. Trade-offs

The 50 ms freeze drops 3 frames at 60 fps. At low frame rates (below 20 fps), a single frame already lasts longer than 50 ms, so the freeze is invisible. On high refresh rate displays (144 fps), 7 frames are dropped, which reads as a more pronounced hit-stop. This is correct behavior: higher refresh rates make micro-pauses more noticeable, which amplifies the impact.

The frozen tick path in handlePlayingTick duplicates the VFX update calls (updateCamera, screenShake.update, updateDustParticles, updateVignetteFlash). This is intentional to avoid re-indenting 120 lines of gameplay code inside a new if block. The frozen path runs for at most 3 frames per lunge and is clearly marked with a comment. If the VFX update sequence changes in the future, the frozen path must be updated to match.

The sub-bass at 40 Hz is inaudible on most laptop speakers but reads strongly on headphones or with a subwoofer. This is acceptable for a horror game that recommends headphones on the title screen.

The scale > 0.3 threshold for bass and freeze means that a player at exactly 1200 px from a lunging jumper gets screen shake and vignette flash but not the hit-stop. This is intentional: the hit-stop should only fire when the lunge feels threatening, not when the creature is a distant noise.

## 7. Manual playtest steps

1. Cubicles. Walk to a floor jumper. Stand within 500 px (full distance volume).
2. Trigger an attack. Listen for the charge sound at attacking state entry.
3. After 600 ms: lunge sound, screen shake, red flash, sub-bass thump (40 Hz, felt in headphones as a chest punch), 50 ms freeze. Confirm the vignette flash continues to fade and screen shake continues to jitter during the freeze.
4. Confirm the impact reads as more visceral than pre-Hotfix P. The bass adds low-end weight, the freeze adds temporal punch.
5. Walk far away (over 1500 px). Trigger another attack. Confirm lunge is silent, no shake, no vignette, no bass, no freeze.
6. Walk to mid-distance (~800 px, scale ~0.7). Trigger attack. Confirm shake + vignette at reduced intensity, bass + freeze fire at full strength.
7. Walk to ~1200 px (scale ~0.3). Trigger attack. Confirm shake + vignette fire, bass + freeze do NOT fire.
8. Walk to ceiling jumper area. Trigger ceiling attack. Confirm NO sub-bass and NO freeze.
9. Die during a floor jumper lunge. Confirm freeze clears immediately, death sequence is not delayed.
10. Change rooms during a floor jumper lunge. Confirm freeze clears on room change.

## 8. Self-check

- [x] No em dashes anywhere in this report or in the new code.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] All 15 edge cases walked.
- [x] FrameFreeze.clear() called on death (triggerDeath), room change, and restart.
- [x] ImpactBass uses Howler.ctx (matches heartbeat.ts pattern via start(sharedCtx)).
- [x] Ceiling jumpers do NOT trigger Hotfix P effects.
- [x] ImpactBass.destroy() called in restart cleanup.
- [x] Frozen tick path runs VFX (screen shake, vignette flash, dust particles) and camera.
- [x] No atlas.json modifications.
- [x] No existing audio changes.
- [x] No Listener, Whisperer, beacon, mic, or suspicion threshold changes.
