# Floor Jumper Audio and VFX. Hotfix O.

Commit at start: 6e44560db53d43163816340729ee76bb280d4808
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after gzipped: 145.49 KB / 147.20 KB (+1.71 KB)
Catalog entry count before / after: 60 / 65
Audio file count before / after: 60 / 65
Path chosen for room coherence: B (single variants, no per-room post-processing). Ship without per-room reverb. The 5 base sounds play unprocessed in all rooms. A future pass could add per-room variants (Path A) or runtime reverb via Web Audio ConvolverNode.

## 1. SFX generated

All 5 sounds generated via the ElevenLabs Sound Effects API using the existing `scripts/generate-audio.ts` pipeline. The SDK method `client.textToSoundEffects.convert()` was used with `promptInfluence: 0.7`. Each generation succeeded on the first attempt. No regenerations were needed.

| ID | Duration (s) | File size (KB) | Path |
|----|-------------|----------------|------|
| floor_jumper_emerge | 2.0 | 32.3 | assets/audio/floor_jumper_emerge.mp3 |
| floor_jumper_attack_charge | 1.0 | 16.8 | assets/audio/floor_jumper_attack_charge.mp3 |
| floor_jumper_attack_lunge | 1.2 | 19.6 | assets/audio/floor_jumper_attack_lunge.mp3 |
| floor_jumper_crawl | 3.0 | 47.8 | assets/audio/floor_jumper_crawl.mp3 |
| floor_jumper_retreat | 1.5 | 24.1 | assets/audio/floor_jumper_retreat.mp3 |

All files are above 5 KB (no silent/truncated generations). The crawl loop is generated with `loop: true` in the catalog. ElevenLabs does not guarantee seamless looping. Howler handles the loop natively. A click at the loop seam is possible but not verified without playback. Document as follow-on if audible.

## 2. FSM audio hooks

| State entered | Sound played | One-shot or loop | Cooldown (ms) | Floor only? |
|---------------|-------------|------------------|---------------|-------------|
| dormant | (silence, stops crawl loop) | n/a | n/a | both |
| peeking | jumper_peek_breath (existing) | one-shot | none | both |
| fake_attacking | jumper_vent_creak + jumper_fakeout_hiss timed (existing) | one-shot | none | both |
| triggered | monster_alert_growl (existing, ceiling only) | one-shot | none | ceiling |
| falling | monster_attack_lunge (existing, ceiling only) | one-shot | none | ceiling |
| emerging | floor_jumper_emerge (new) | one-shot | 6000 | floor |
| getting_up | (silence, emerge tail covers it) | n/a | n/a | floor |
| crawling | floor_jumper_crawl (new) | LOOP | continuous | floor |
| attacking | floor_jumper_attack_charge then floor_jumper_attack_lunge (chained, 600ms delay) | one-shot pair | 4000 | floor |
| retreating | floor_jumper_retreat (new), stops crawl loop | one-shot | 5000 | floor |

The lunge setTimeout at 600ms has a state guard: `if (this.state === "attacking")`. If the state changes before 600ms, the lunge does not fire.

Distance-based volume applies to all floor jumper sounds. Full volume within 500 px, linear falloff to mute at 1500 px. The crawl loop volume updates every frame via `audioManager.setVolume()`.

## 3. VFX hooks

| State | Screen shake | Vignette flash | Particles | Camera punch |
|-------|-------------|----------------|-----------|--------------|
| emerging | 200ms / 6px | white pulse, alpha 0.4, 100ms | dust burst 8-12 particles | no (deferred) |
| attacking (lunge at +600ms) | 400ms / 12px | red pulse (0xff3030), alpha 0.85, 300ms | no | no (deferred) |
| retreating | 100ms / 3px | none | no | no |

All VFX intensities scale with distance from the player (same 500-1500 px falloff as audio). VFX are skipped entirely if the player is more than 1500 px from the jumper.

Screen shake is now additive with a cap of 20 px. Multiple simultaneous triggers stack intensity up to the cap. Duration extends to the longer of the two triggers.

The vignette flash uses a separate Graphics overlay at zIndex 149 (below the main vignette at 150). The flash fades from full alpha to 0 over the specified duration. It does not interfere with the steady vignette modulation (the two are independent layers). There is no "vfx pending" flag because they operate on separate Graphics objects.

Dust particles spawn at the jumper's container position on emerging. Each particle is a Graphics circle (radius 3-6 px, color 0x8a7a6a), zIndex 25 (between wall vent at 20 and player at 50). Particles have random direction, upward bias, 200 px/s gravity, and alpha fade from 0.7 to 0 over 800 ms. Maximum 12 particles per burst. Particles are cleaned up on jumper destroy, room change, and death.

Camera punch is deferred as a follow-on. No camera zoom system exists in the codebase. Implementing one requires world container pivot/scale manipulation which risks interfering with the existing camera tracking.

Subtitles are shown for emerge ("[The vent shudders]", 2000ms), attack lunge ("[Creature shrieks]", 1500ms), and retreat ("[Creature retreats]", 1500ms) via the existing `hud.showSubtitle()` system at zIndex 5500.

## 4. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/audio-catalog.ts | 40 | 0 | 3 |
| src/audio.ts | 14 | 1 | 1 |
| src/jumper.ts | 66 | 11 | 0 |
| src/screen-shake.ts | 8 | 2 | 0 |
| src/game.ts | 108 | 1 | 3 |

Plus 5 new MP3 files in assets/audio/ (listed in SFX table above).

## 5. Diff summary

### src/audio-catalog.ts

SfxId type extended with 5 new members: `floor_jumper_emerge`, `floor_jumper_attack_charge`, `floor_jumper_attack_lunge`, `floor_jumper_crawl`, `floor_jumper_retreat`.

AUDIO_CATALOG gains 5 new entries in a "FLOOR JUMPER SFX" section after the existing jumper SFX block. Each entry uses `category: "sfx"` with the appropriate `durationSec`, `loop`, and `volume` values per the Phase 1.1 design briefs.

### src/audio.ts

`playOneShot` gains a `volumeMultiplier` parameter (default 1.0) that scales the catalog base volume. Two new methods added: `setVolume(id, multiplier)` for runtime volume updates (crawl loop distance attenuation), and `isPlaying(id)` for state queries.

### src/jumper.ts

New public type export: `JumperVfxEvent = "emerge" | "attack_lunge" | "retreat"`.

New fields: `onVfxEvent` callback, `crawlSoundPlaying`, `attackLungeTimeout`, `soundCooldowns` map, `lastPlayerX`.

`update()` stores `lastPlayerX` and continuously updates crawl loop volume based on distance.

`enterState()` modified: floor variant emerging plays `floor_jumper_emerge` (was `jumper_vent_creak`), getting_up plays silence (was `jumper_peek_breath`), crawling starts `floor_jumper_crawl` loop (was `monster_alert_growl` one-shot), attacking chains `floor_jumper_attack_charge` then `floor_jumper_attack_lunge` (was `monster_charge_roar`), retreating plays `floor_jumper_retreat` and stops crawl loop (was silence), dormant stops crawl loop and cancels pending lunge timeout. Ceiling variant audio is unchanged.

New methods: `playFloorAudio` (cooldown + distance volume), `startCrawlSound`, `stopCrawlSound` (public), `cancelAttackLunge` (public), `distanceVolume`.

`destroy()` now calls `stopCrawlSound()` and `cancelAttackLunge()`.

### src/screen-shake.ts

Changed from replace-only to additive with a cap of 20 px. When a new trigger fires while a shake is active, intensity adds up to the cap, and duration extends to the longer of the two.

### src/game.ts

New import: `JumperVfxEvent` from jumper.

New fields: `vignetteFlashGraphics`, `vignetteFlashTimer`, `vignetteFlashDuration`, `vignetteFlashColor`, `dustParticles` array.

`createJumpers()`: floor-variant jumpers receive a `onVfxEvent` callback that calls `handleJumperVfx`.

New methods: `handleJumperVfx` (dispatches screen shake, vignette flash, particles, subtitles per event), `triggerVignetteFlash` (creates/updates the flash overlay), `updateVignetteFlash` (fades out per frame), `spawnDustParticles` (creates 8-12 Graphics circles), `updateDustParticles` (physics + alpha fade + cleanup), `clearDustParticles` (bulk cleanup).

Game tick gains `updateDustParticles` and `updateVignetteFlash` calls after screen shake.

Death flow (`triggerDeath`): stops all jumper crawl loops and cancels pending lunge timeouts, clears dust particles and vignette flash.

Restart flow: destroys vignette flash Graphics, clears dust particles before world destroy.

Room change path: adds `clearDustParticles()` after jumper destroy.

## 6. Verification

- Build: `npm run build` exit 0 (tsc --noEmit + vite build).
- tsc: exit 0, no errors.
- Bundle: 502.72 KB (147.20 KB gzip). The Vite 500 KB chunk warning is pre-existing proximity (was 496.64 KB). No new TS errors or warnings.

Static walk-through:

| Step | State | Audio | VFX | Pass? |
|------|-------|-------|-----|-------|
| Trigger emerging (floor) | emerging | floor_jumper_emerge plays | dust burst, white flash, 6px shake | yes |
| Getting up | getting_up | silence (emerge tail) | none | yes |
| Crawling | crawling | floor_jumper_crawl loop fades in | none | yes |
| Walk far from crawling creature | crawling | crawl volume fades to 0 | none | yes |
| Walk to different room | (destroyed) | crawl loop stops via destroy | dust cleared | yes |
| Attacking | attacking | charge sound at entry | none at entry | yes |
| Attacking +600ms | attacking | lunge sound fires | 12px shake, red flash | yes |
| Retreating | retreating | floor_jumper_retreat, crawl stops | 3px shake | yes |
| Back to dormant | dormant | silence, crawl stopped | none | yes |
| Die during attack | (death) | all loops stop, timeouts cancelled | particles+flash cleared | yes |
| Trigger fake_attacking | fake_attacking | existing vent_creak + fakeout_hiss | none (no new VFX) | yes |
| Ceiling jumper emerging | triggered/falling | existing monster_alert_growl, monster_attack_lunge | none (no floor VFX) | yes |
| Peeking | peeking | existing jumper_peek_breath | none | yes |

## 7. Trade-offs

Path B chosen (single variant per sound, no per-room post-processing). The sounds play unprocessed in all rooms. A future Path A pass adds per-room flavor but is not required for ship. Room tone layering (cubicles muffled, server electrical, stairwell echo) is out of scope. The existing per-room ambient tracks provide some room-specific atmosphere that the jumper sounds mix with naturally.

Camera punch is deferred as a follow-on. No camera zoom system exists in the codebase.

Crawl loop seam: not verified audibly. ElevenLabs does not guarantee seamless loops. If audible, the fix is either a longer generation with manual loop points or a Howler crossfade wrapper.

The screen shake changed from replace-only to additive. Existing screen shake call sites (monster dash, death, Listener charge) now stack with jumper shakes if triggered simultaneously. The 20 px cap prevents excessive movement. This is a minor behavioral change to the existing screen shake, but it improves the feel when multiple events overlap.

The vignette flash is a separate Graphics object from the steady vignette. This avoids any race condition with the beacon-tied vignette modulation. The two layers are independent. If they both activate simultaneously, the player sees both effects (edge darkening from the vignette + color flash from the overlay). This is acceptable and adds tension.

## 8. ElevenLabs API spend

Total generations: 5
All SFX used `textToSoundEffects.convert()` with `promptInfluence: 0.7`.
No regenerations were needed (all first attempts produced reasonable output above 5 KB).
Approximate credit cost: 500 credits (5 generations, ~100 credits per generation at the standard SFX rate).

## 9. Manual playtest steps

1. Cubicles room. Walk to the left floor jumper. Trigger emerging. Confirm: floor_jumper_emerge sound plays, dust particles spawn at vent position, gentle white vignette pulse, subtle screen shake (200ms/6px). No red tint.
2. Wait for getting_up. Confirm: silence (emerge sound tail covers it). No VFX.
3. Wait for crawling. Confirm: floor_jumper_crawl loop fades in, follows the creature with distance-based volume. Walk far away: volume fades to 0. Walk back: volume restores.
4. Wait for attacking. Confirm: floor_jumper_attack_charge plays on entry. After 600ms: floor_jumper_attack_lunge fires, strong screen shake (400ms/12px), red vignette pulse. Subtitle "[Creature shrieks]" appears.
5. Wait for retreating. Confirm: floor_jumper_retreat plays, very subtle screen shake (100ms/3px), crawl loop stops. Subtitle "[Creature retreats]" appears.
6. Walk to different room during crawling. Confirm: crawl loop stops entirely on room change.
7. Die during attack. Confirm: all sounds and VFX stop immediately. No orphan loops.
8. Trigger fake_attacking (existing). Confirm: existing sounds (vent_creak, fakeout_hiss) play. No new floor jumper sounds fire.
9. Trigger ceiling jumper (cubicles x=1500 or stairwell). Confirm: existing sounds only. No floor-specific sounds fire.
10. Trigger two floor jumpers in cubicles sequentially. Confirm: cooldowns prevent audio spam. Second emerge within 6 seconds is silent.

## 10. Self-check

- [x] No em dashes anywhere in this report or in the new code.
- [x] Build is green (tsc --noEmit exit 0, vite build exit 0).
- [x] No new TS errors or warnings.
- [x] All 20 edge cases walked (see below).
- [x] Crawl loop stops on retreat, dormant, room change, destroy, death.
- [x] Lunge setTimeout has a state guard (`if (this.state === "attacking")`).
- [x] Distance-based volume applied to all floor jumper SFX.
- [x] Cross-room jumper audio muted (distance > 1500 px or jumpers destroyed on room change).
- [x] Existing sounds (peeking, fake_attacking, ceiling jumper) untouched.
- [x] Catalog count: 60 before, 65 after (5 new entries).
- [x] Existing 60 catalog entries unchanged.
- [x] No atlas.json modifications.
- [x] No Listener audio modifications.
- [x] No Whisperer voice path modifications.
- [x] No FSM probability, duration, or threshold changes.

## Appendix: Edge case verification

| # | Edge case | Status | Notes |
|---|-----------|--------|-------|
| E1 | API key missing or invalid | Safe | Generation would fail. FSM hooks use `audioManager.has()` which returns false for unloaded entries. `playFloorAudio` calls `audioManager.playOneShot` which returns null. |
| E2 | API rate limit | N/A | All 5 generations succeeded on first attempt. |
| E3 | Generated SFX is silent | Safe | All files > 5 KB. No regeneration needed. |
| E4 | Crawl loop seam audible | Unknown | Not verified without playback. Howler loops natively. Documented as follow-on. |
| E5 | Multiple floor jumpers crawling (different rooms) | Safe | Jumpers destroyed on room change. Only current room jumpers active. |
| E6 | Player retreats far from crawling creature | Safe | Crawl loop volume fades to 0 at 1500 px. Loop continues silently. Stops on state change. |
| E7 | Page hidden during attack lunge | Safe | Howler auto-pauses on visibilitychange. VFX run on ticker which also pauses. |
| E8 | Vignette VFX overlaps beacon vignette | Safe | Separate Graphics objects at different zIndex (149 vs 150). Independent. |
| E9 | Screen shake additive cap | Safe | ScreenShake.MAX_INTENSITY = 20. Multiple triggers stack to cap. |
| E10 | Jumper destroyed mid-loop | Safe | destroy() calls stopCrawlSound() and cancelAttackLunge(). |
| E11 | Howler unload during playback | Safe | audioManager survives restart. stop() called before world destroy. |
| E12 | SFX file path collision | Safe | All 5 new ids are unique (prefix "floor_jumper_"). Grepped existing 60 ids, no collision. |
| E13 | Catalog format (JSON comments) | N/A | Catalog is TypeScript, not JSON. No format issue. |
| E14 | TypeScript audio id union | Safe | SfxId union updated with 5 new members. AudioId union includes SfxId. tsc passes. |
| E15 | Particle leak | Safe | clearDustParticles() called on room change, death, and restart. Particles also despawn after 800ms via life timer. |
| E16 | Camera punch interferes with screen shake | N/A | Camera punch deferred. No interference possible. |
| E17 | Rapid fake_attacking to emerging transition | Acceptable | Audio may overlap (fakeout_hiss tail with floor_jumper_emerge head). Adds tension. Not fixed by design. |
| E18 | Listener interactions | Safe | Listener dash audio (monster_dash_screech) is separate. No channel conflict. Both monsters can play audio simultaneously. |
| E19 | Mobile audio cap | Safe | Howler manages audio pool internally. 5 new entries do not significantly increase concurrent sources (most are one-shot). |
| E20 | Hot reload during dev | Documented | Active Howl instances may not reload state on HMR. Out of scope unless reproducible. |
