# Day 4 Part 1: Props Integration, Hiding Spots, Crouch Decay

## Props system

Two categories:

- **Decorative** (`DecorativePropDef`): visual only, no collision, no interaction. Added to the Room container (behind player). Includes vent, flickerlight, exit-sign, corpse.
- **Interactive** (`HidingSpotDef`): proximity-triggered via E key. Added to world container. Includes locker-hide and desk-hide.

All props use the `props:` tileset from `assets/atlas.json`.

## Hiding mechanics

### Locker (100% hidden)

- Suspicion drops to 0 instantly on entry.
- Screen darkens to ~95% opacity with a thin horizontal slit (locker louvers).
- Monster cannot detect the player in any state.
- Player cannot exit while monster is within 100px (door would clang).
- Audio: locker_close on enter, locker_open on exit, locker_door_creak on blocked exit attempt.

### Desk (80% hidden)

- Suspicion decay rate multiplied by 4 while hiding. The 4x decay kicks in immediately on E press (during the entering animation), not after the animation completes.
- Flashlight shrinks to 70% (slightly dimmer).
- Monster in PATROL, ALERT, or HUNT walks past without detecting the player.
- Monster in CHARGE has a 50% chance to find the player (rolled once when monster x crosses desk x boundary within 50px).
- Audio: desk_crouch on enter.
- Animation: 3-phase sequence using 18 dedicated frames (6 per phase).
  - ENTERING: 6 frames, plays once (~250ms). Player is locked during this animation.
  - IDLE: 6 frames, loops slowly (breathing/listening).
  - EXITING: 6 frames, plays once (~250ms). Player is locked during this animation.
- Input is blocked during ENTERING and EXITING transitions (no movement, no interaction).

### Shared behavior

- Press E near a hiding spot to enter, E again to exit.
- Press left/right movement keys while hiding to exit (locker exit constraint still applies).
- Player snaps to spot position and enters a locked animation state.
- "HIDDEN" indicator shown in top-right corner of HUD while hiding.
- Hiding state is cleared on death, room transition, and restart.

## Crouch decay multiplier

Suspicion decay (base: 5/sec) is multiplied by player state:

| State | Multiplier | Effect |
|---|---|---|
| Standing | 1x | Normal decay |
| Crouching (Ctrl) | 3x | Faster decay in all active monster states |
| Desk hide | 4x | Fast decay while hidden under desk |
| Locker hide | 999x | Effectively instant (suspicion zeroed on entry anyway) |

Decay now applies in PATROL, ALERT, HUNT, and CHARGE states. Does NOT apply during ATTACK or IDLE_HOWL (short fixed-duration states).

## Room layouts

### Reception (2896px)

- Decorative: exit-sign (x:2200), flickerlight with flicker animation (x:200)
- Hiding spots: none (safe room)

### Cubicles (3344px)

- Decorative: 2 vents (x:600, x:2400), exit-sign (x:3300)
- Hiding spots: desk (x:1200), locker (x:2050), desk (x:2900)

### Server (3344px)

- Decorative: corpse (x:1500), flickerlight with flicker animation (x:800), vent (x:2700)
- Hiding spots: locker (x:700), locker (x:2900)

### Stairwell (3344px)

- Decorative: exit-sign (x:2700)
- Hiding spots: desk (x:1400)

## Audio assets

Four new SFX entries added to audio-catalog.ts: `locker_close`, `locker_open`, `locker_door_creak`, `desk_crouch`. These require generation via `npm run audio:generate` or manual sourcing. The game works without them (audioManager.playOneShot returns null for missing assets).

## Asset names reference

Props tileset frames: `desk-hide`, `locker-hide`, `vent`, `flickerlight`, `exit-sign`, `corpse`, `radio-table` (radio-table reserved for Part 2).
