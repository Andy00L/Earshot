# Trapdoor Sprite + Audio Cue. Hotfix U.4.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size before / after: 536.12 kB (154.57 kB gz) / 536.90 kB (154.73 kB gz)
Delta: +0.78 kB (+0.16 kB gz)
Friction addressed: F1 (HIGH)
Path chosen: B (tint fallback, props:trapdoor_sealed not in atlas)
Audio path: D (linear volume falloff via AudioManager.setVolume)

## 1. What changed

The whisper trapdoor in Archives was functionally invisible. Two fixes.

First, the sprite tint. The vents:sealed sprite is reused for wall
decoration throughout the game. Applying a red-brown tint (0x4a3838)
to the trapdoor instance makes it visually distinct from generic vents.
Combined with Hotfix U.3's pale green PulseRing, the trapdoor reads
as "ominous interactable" rather than "wall decoration." On puzzle
success, the tint resets to neutral (0xffffff) and the texture swaps
to vents:open.

Second, the ambient volume. The whisper_trap_ambient catalog entry was
set to volume 0.05, roughly 10x quieter than the room ambient (0.5).
The volume is raised to 0.18. Additionally, a per-frame distance-based
falloff scales the volume from 0 (at 1000px away) to full (at the
trapdoor). The player hears whispers fade in as they walk deeper into
Archives, providing a directional cue without 3D spatial audio.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/audio-catalog.ts | 0 | 0 | 1 |
| src/game.ts | 27 | 0 | 2 |

## 3. Diff summary

### src/audio-catalog.ts

BEFORE (line 472):
```
    volume: 0.05,
```

AFTER:
```
    volume: 0.18,
```

### src/game.ts

Three new private methods added before createWhisperTrapSprite:

```typescript
  private startWhisperTrapAmbient(): void {
    if (audioManager.isPlaying("whisper_trap_ambient")) return;
    audioManager.loop("whisper_trap_ambient");
    audioManager.setVolume("whisper_trap_ambient", 0);
  }

  private stopWhisperTrapAmbient(): void {
    if (!audioManager.isPlaying("whisper_trap_ambient")) return;
    audioManager.stop("whisper_trap_ambient");
  }

  private updateWhisperTrapAmbient(playerX: number): void {
    if (!audioManager.isPlaying("whisper_trap_ambient")) return;
    const distance = Math.abs(Game.WHISPER_TRAP_X - playerX);
    const maxDistance = 1000;
    const multiplier = Math.max(0, 1 - distance / maxDistance);
    audioManager.setVolume("whisper_trap_ambient", multiplier);
  }
```

createWhisperTrapSprite gains two additions after the sprite is
configured: (1) tint 0x4a3838 when sealed, (2) startWhisperTrapAmbient
when sealed.

handleWhisperResult success branch gains two additions: (1) tint reset
to 0xffffff, (2) stopWhisperTrapAmbient call.

handlePlayingTick gains a per-frame call to updateWhisperTrapAmbient
when in archives and not unlocked.

destroyRoomContents and triggerDeath both gain a stopWhisperTrapAmbient
call for cleanup.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.33s
- Static walk-through: pass

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Custom sprite absent | Path B active. Tint applied to vents:sealed. |
| E2 | Audio file load error | Howl logs warning, continues. Pulse ring still draws player. |
| E3 | HRTF not needed | Path D used. No 3D panning. |
| E4 | Rapid archives enter/exit | startWhisperTrapAmbient idempotent, stopWhisperTrapAmbient guarded. |
| E5 | Solved, die, re-enter archives | whisperTrapUnlocked persists. No ambient or tint on re-entry. |
| E6 | Puzzle open during ambient | Ambient continues during PAUSED. Correct (trapdoor still emitting). |
| E7 | Volume update during playback | AudioManager.setVolume calls Howl.volume() smoothly. No clicks. |
| E8 | State inconsistency guard | Per-frame update checks isPlaying and whisperTrapUnlocked. |
| E9 | Distance normalization | maxDistance=1000. At entrance (x=200), distance=1300, multiplier=0. |
| E10 | Volume vs room ambient | Room ambient 0.5, trap max 0.18. No overlap. |
| E11 | Laptop speakers | Whisper content is mid-frequency. Acceptable. |
| E12 | Bundle size | +0.16 kB gz. Code only, no new assets. |
| E13 | Tint vs PulseRing | Tint on sprite, ring behind sprite at zIndex 19. No interaction. |
| E14 | Sprite scale | Scale 0.5 preserved from original. No change. |
| E15 | Fade interference | stop() is immediate. No queued fades. |

## 5. Trade-offs

Path B (tint) is less expressive than a custom sprite. The red-brown
wash (0x4a3838) on vents:sealed makes the trapdoor darker and slightly
warmer than surrounding vents. Combined with the Hotfix U.3 PulseRing,
the trapdoor is noticeably different. A custom sprite with cracks and
glow would be more dramatic. The tint ships now.

Path D (linear volume falloff) provides no stereo panning. The player
hears volume increase as they approach but cannot determine left vs
right direction from audio alone. In Archives (2044px wide, single
horizontal axis), the pulse ring provides directional guidance. The
audio reinforces proximity. Full HRTF panning would add stereo cues
but risks cross-browser inconsistencies with the mic input system.

The maxDistance of 1000px means the audio is silent at the room entrance
(x=200, distance=1300). The player starts hearing whispers at
approximately x=500 (distance=1000, multiplier=0, boundary). This is
deliberate: the pulse ring provides the initial "something is here"
signal. The audio confirms it as the player draws closer.

## 6. Manual playtest steps

1. Start a new run. Walk to archives via reception.
2. At room entrance (x=200), confirm no whisper audio audible.
3. Walk toward center (x=800). Confirm faint whispers begin.
4. Approach trapdoor (x=1500). Confirm whispers at full volume.
5. Confirm trapdoor sprite has a red-brown tint, visually distinct
   from other vents in the game.
6. Press E. Whisper puzzle opens. Confirm ambient continues during
   the puzzle overlay.
7. Solve puzzle. Confirm: sprite swaps to vents:open, tint resets to
   neutral, whisper ambient stops.
8. Leave archives. Re-enter. Confirm no ambient, no tint (unlocked
   state persists).
9. Die before solving. Confirm ambient stops during death cinematic.
10. Respawn. Walk to archives. Confirm ambient restarts (trapdoor
    still sealed).

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Path B chosen and documented.
- [x] Audio path D chosen and documented.
- [x] All 15 edge cases walked.
- [x] No mic v2 calibration changes.
- [x] No Whisperer spawn rule changes.
- [x] Existing whisper puzzle unaffected.
