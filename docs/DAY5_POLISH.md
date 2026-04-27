# Day 5: Polish Pass

Eight cinematic and atmospheric systems added for the demo video shoot.

## Systems

### 1. Screen Shake (`src/screen-shake.ts`)
Camera offset with random jitter and linear decay. Triggered on monster HUNT (600ms, 12px), CHARGE (400ms, 8px), ATTACK (300ms, 16px), and death (800ms, 20px). A weaker shake does not override a stronger one in progress.

### 2. Heartbeat Audio (`src/heartbeat.ts`)
Procedural Web Audio API heartbeat. Two-thump lub-dub pattern via sine oscillators at 60Hz and 80Hz with envelope shaping. BPM and volume scale with suspicion: silent below 30, 50 BPM at 30, up to 160 BPM at 100. Smooth lerp transitions prevent jarring jumps.

### 3. Vignette Overlay (`src/vignette.ts`)
Black border overlay that tightens based on monster threat. PIXI Graphics rectangles on all four edges. Intensity: ATTACK=0.30, CHARGE=0.45, HUNT=0.65, ALERT=0.85, default=1.0. Layered at zIndex=150 (above flashlight, below HUD).

### 4. Extended Death Sequence
Death flow extended from instant to ~4.7 seconds. Sequence: (1) death thud + heavy screen shake, (2) monster loom animation (400ms, scale up 1.15x), (3) close growl SFX, (4) red-then-black screen fade (1500ms), (5) gameover stats overlay with `gameover.png` background (2.5s or press R), (6) respawn at Reception with shade drop.

### 5. Death Stats Screen
HTML overlay showing time survived, rooms reached (out of 5), and monster encounters. Background image `gameover.png` rendered behind stats at 50% opacity with `object-fit: contain`. Stats tracked via `GameState.runStats`. Encounters increment on each HUNT transition. Rooms tracked via Set on room transitions. Styled with monospace font and red accents. Overlay at z-index 1100 (above radio popup).

### 6. Title Screen
HTML overlay with EARSHOT title (CSS glitch animation), tagline, click-to-start prompt, and headphones warning. Procedural ambient drone via Web Audio starts after first click: sawtooth oscillator at 55Hz (gain 0.08) and sine oscillator at 82.4Hz (gain 0.06), mixed through a master gain of 0.25. Drone stops when asset loading completes. Title screen click satisfies browser autoplay policy by calling `Howler.ctx.resume()`.

### 7. Tutorial Radio
Two seconds after game start, auto-fires ElevenLabs TTS: "If you can hear this, get out. It hunts by sound. Stay quiet. Stay hidden." HUD shows "INCOMING TRANSMISSION". Falls back to static_burst SFX on TTS failure. Only plays once per session via `tutorialPlayed` flag.

### 8. Monster Confused Animation
When radio bait lures the monster, cycles through 6 confused frames from `monster_confused` atlas at 5 fps. If atlas frames are missing, falls back to purple tint (0xaa88cc) with slow rotation oscillation. Plays `confused_growl` SFX on lure start. Tint and rotation reset when lure expires.

## Missing Assets (game runs without them)

- `audio/confused_growl.mp3`: Confused monster growl. Generate via ElevenLabs Sound Effects API.
- `audio/monster_growl_close.mp3`: Close-range death growl. Generate via ElevenLabs Sound Effects API.
- `assets/title-bg.jpg`: Optional title screen background image (currently solid black).

## Performance Notes

- Screen shake: trivial (2 random() calls per frame, only when active)
- Heartbeat: Web Audio scheduling, no per-frame allocations (oscillators self-clean via stop())
- Vignette: PIXI Graphics redraw only when alpha changes (lerp converges quickly)
- Death sequence: one-shot animations via requestAnimationFrame, no ticker overhead
- Stats tracking: Set.add and counter increment, negligible cost

## Disabling Individual Systems

Each system can be removed by commenting out its initialization and update calls in `game.ts`. They are independent.

- Screen shake: remove `screenShake` field and offset application in handlePlayingTick
- Heartbeat: remove `heartbeat` field and setSuspicion/tick calls
- Vignette: remove `vignette` field and setIntensity/update calls
- Death cinematic: replace `runDeathCinematic()` call with the old `showGameover()` flow
- Stats: remove `runStats` from GameState and the HTML overlay
- Title screen: remove `showTitleScreen()` call in main.ts
- Tutorial radio: remove `playTutorialTransmission()` setTimeout in start()
- Confused animation: remove `loadConfusedFrames()` call and `updateLureAnimation()` in monster.ts
