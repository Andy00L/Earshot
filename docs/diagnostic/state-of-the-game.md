# Earshot. State of the Game Diagnostic.

Commit: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Date generated: 2026-04-30
Build status: pass (tsc --noEmit exit 0, vite build exit 0, 4.49s)
Bundle size: 532.75 kB / 153.59 kB gzipped
Audio file count: 86
Catalog entry count: 86 (all present on disk)

This diagnostic was generated without modifying any source file. It surfaces the gap between what the code does and what the player perceives. A separate hotfix will address the friction points identified here.

---

## 0. Project recon

### 0.1 Git state

HEAD: 2ce47201ffd982cfa815193630ff4f1e9121f8d3

Last 10 commits:
```
2ce4720 feat: floor jumper audio + VFX (hotfix O)
6e44560 feat: floor jumper visual + room spacing + z-order (hotfixes I-bis, J, K, M, N)
56035df audit hotfix + path 6.B + intro voiceover
d0c644f readme
f191e02 reamde
996fc4a Fix: regenerate full atlas.json after monster_confused slice overwrite
5314cf0 Day 4 Part 2: radio bait with ElevenLabs TTS runtime
07044c2 Day 4 Part 1: props + hiding spots + crouch decay
6745e73 Day 3 final: clean codebase ready for Day 4 features
035c530 Day 3 complete: Earshot game with audio pipeline
```

Hotfixes Q/R/S/T are staged but uncommitted (git status shows modified files and 5 new source files: breaker-puzzle.ts, frame-freeze.ts, impact-bass.ts, tape-puzzle.ts, whisper-puzzle.ts). 21 new audio files are untracked in assets/audio/.

### 0.2 File inventory

TypeScript source files in src/: 40
Audio files on disk: 86
Python pipeline scripts: 4
HTML entry point: 1 (index.html)

### 0.3 Build check

tsc --noEmit: exit 0, no errors, no warnings.
vite build: exit 0, 4.49s.
Main bundle: index-pBVOFlFE.js, 532.75 kB (153.59 kB gzipped).
Vite warning: chunk exceeds 500 kB. Not a blocker.

### 0.4 Dependencies

| Package | package.json | Expected (handoff) | Drift |
|---------|-------------|---------------------|-------|
| pixi.js | ^8.0.0 | 8.18.1 (README says 8.0) | None (semver range) |
| howler | ^2.2.4 | ^2.2.4 | None |
| vite | ^6.0.0 | 6.4.2 (resolved) | None |
| typescript | ^5.0.0 | ^5.0.0 | None |
| @elevenlabs/elevenlabs-js | ^2.44.0 | ^2.44.0 | None |

Source: package.json:1-28.

### 0.5 Audio file verification

All 86 catalog entries in src/audio-catalog.ts (line 100-805) have corresponding .mp3 files in assets/audio/. Cross-referenced by listing all 86 filenames on disk against every AudioId union member in audio-catalog.ts.

Hotfix R added 5 files (breaker_original, breaker_variant_a/b/c, breaker_lock_alarm). Hotfix S added 2 files (whisper_trap_ambient, whisper_trap_fail). Hotfix T added 14 files (tape_01_seg_1 through tape_03_seg_4, tape_garbled, tape_unlock). Total new: 21 files. All 21 confirmed present on disk.

---

## 1. Game phases and flow

### 1.1 GamePhase enum

Source: src/types.ts:82.

```
"INTRO" | "PLAYING" | "PAUSED" | "DYING" | "GAMEOVER" | "WIN"
```

Six phases. The LOADING and TITLE phases exist in main.ts but are not part of the GamePhase type. They are handled before the Game class is instantiated.

### 1.2 Phase transitions

**LOADING (main.ts).** Assets and audio loaded. Loading screen (HTML div, z-index 9500) is removed after boot. No player action required.

**TITLE (main.ts).** Title screen with "Click to start" and headphones warning. Player clicks. First visit: transitions to INTRO. Subsequent visits (after restart): transitions directly to PLAYING.

**INTRO (game.ts:1931-2170).** Three hand-drawn panels displayed sequentially. Each has voiceover narration (Adam voice, intro_panel_1/2/3). Click or Space/Enter advances to the next panel. Back button on panels 2 and 3. Hold Escape 1 second to skip all panels. After panel 3, transitions to PLAYING. Intro plays once per page load (game.ts:96, `introPlayed` flag).

**PLAYING (game.ts:478-479).** Main game loop. All systems active: player input, monster AI, mic sampling, beacon, suspicion, prompts, HUD, flashlight, vignette, heartbeat, guidance arrow.

**PAUSED (game.ts:482-484).** Entered when a puzzle overlay opens (breaker, whisper, tape) or when the radio popup opens. The Pixi ticker is stopped (`this.app.ticker.stop()` at game.ts:3092, 3150, 3267, 3331). No gameplay updates occur. Monster AI, suspicion, beacon, and heartbeat all freeze.

**DYING (game.ts:1478).** Triggered by monster catch (triggerDeath at game.ts:1475). Runs an async cinematic sequence: monster looms (400ms), close growl SFX, red-then-black fade (1500ms), gameover stats overlay (2.5s or until R pressed), then respawn at reception.

**GAMEOVER / WIN (game.ts:490-495).** End screen displayed. Press R to restart. The difference: GAMEOVER shows stats (time survived, rooms reached, encounters) in an HTML overlay (index.html:410). WIN shows "YOU ESCAPED" text in a Pixi overlay (game.ts:1879).

### 1.3 State diagram

```
TITLE --> INTRO (first visit, click)
TITLE --> PLAYING (restart visit, click)
INTRO --> PLAYING (3 panels completed, or Esc held 1s)
PLAYING --> PAUSED (puzzle open, radio popup open)
PAUSED --> PLAYING (puzzle close, radio popup close)
PLAYING --> DYING (monster catch at 80px range)
DYING --> GAMEOVER (cinematic complete, stats shown 2.5s)
GAMEOVER --> PLAYING (R key, respawn at reception)
PLAYING --> WIN (exit door in stairwell with keycard)
WIN --> PLAYING (R key, full restart)
```

### 1.4 Player knowledge requirements per phase

**INTRO panels.** Panel 1 narration (audio-catalog.ts:758): "You shouldn't be here. But you are." Panel 2 (audio-catalog.ts:767): "It hunts by sound. Your microphone is the controller. Whisper. Or don't speak at all." Panel 3 (audio-catalog.ts:775): "Get out. Three things stand between you and the door. One. Keycard. Find it first. Two. Breaker. Power needed. Three. Stairwell exit. Your way out."

Panel 3 tells the player the three main objectives. It does NOT mention the three puzzles (breaker audio match, whisper trap, tape reconstruction). It does NOT mention radios, hiding, materials, or any secondary mechanic. The skip mechanism (hold Escape 1 second) is not communicated visually.

**PLAYING start.** Four tutorial voice memos (tutorial_t0 through tutorial_t3) play in sequence on first entering certain rooms. These tell the player: stay quiet (t0), flashlight is voice-activated (t1), whisper safely / talk for light / never shout (t2), find keycard / flip breaker / reach stairwell / collect materials (t3). The tutorials fire only once (tutorialPlayed flags, game.ts:142). No visual tutorial exists. No controls overlay exists. The player must discover A/D for movement, E for interaction, Shift for running, Ctrl for crouching, R for radio, G for throwing, F for whisper charm, and 1/2/3 for slot selection.

**PUZZLE overlays.** Each puzzle has a hint bar at the bottom of its overlay. Breaker (breaker-puzzle.ts:375): "1/2/3/4 select. SPACE replay original. ENTER submit. ESC leave." Whisper (whisper-puzzle.ts:393): "ESC to leave. Speak too loud and you fail." Tape (tape-puzzle.ts:373): "1-4 listen. A-D place. SPACE play full. ENTER submit. ESC leave." These are 11px text at 0.4-0.6 opacity. They exist, but they are not prominent.

**DEATH.** The gameover stats screen (index.html:410) shows time survived, rooms reached, and monster encounters. It does NOT explain what killed the player (Listener vs Jumper vs beacon zero). The "PRESS R TO RESTART" prompt is in the stats overlay (index.html:424). The death screen does not differentiate between death-by-monster and death-by-beacon-zero (both trigger the same triggerDeath path at game.ts:1475).

**WIN.** "YOU ESCAPED" text and "PRESS R TO RESTART" displayed via Pixi text (game.ts:1879).

---

## 2. Interactable inventory

### 2.1 Complete table

Every player-interactable element across all 5 rooms, evaluated for discoverability (player knows it exists), affordance (player knows it is interactive), and activation (player knows how to trigger it).

Color key: GREEN = clearly conveyed, YELLOW = partially conveyed, RED = not conveyed.

**Reception** (2896x1086, no monsters, spawn room)

| Element | x | Discoverability | Affordance | Activation |
|---------|---|-----------------|------------|------------|
| Door to Cubicles | 500 | YELLOW: door sprite visible but blends with background | GREEN: "E INTERACT" sprite prompt at 100px range | GREEN: prompt shows key |
| Door to Server | 1800 | YELLOW: same | GREEN: same | GREEN: same |
| Door to Archives | 2700 | YELLOW: same | GREEN: same | GREEN: same |
| Tape material pickup | 2100 | YELLOW: small sprite "materials:tape" on floor | GREEN: "E PICK UP" sprite prompt at 100px | GREEN: prompt shows key |
| Lore tape 01 | 2400 | YELLOW: "shade-tape:recorder" sprite, small | GREEN: "E PICK UP" prompt | GREEN: prompt shows key |
| Workbench (tape station) | 1500 | GREEN: "workbench:bench" decorative sprite at scale 0.4 | RED: no glow, no ambient sound, no visual indicator until player is within 100px | RED: prompt says "E PLAY TAPE" only if player has a broken tape. If not, says "E EXAMINE", but player does not know what examining does |

**Cubicles** (3344x941, Listener + 1 ceiling jumper + 2 floor jumpers)

| Element | x | Discoverability | Affordance | Activation |
|---------|---|-----------------|------------|------------|
| Door to Reception | 100 | YELLOW: door at room edge | GREEN: sprite prompt | GREEN: E key shown |
| Door to Server | 3244 | YELLOW: same | GREEN: same | GREEN: same |
| Keycard | 1600 | YELLOW: "keycard" sprite on floor, small | GREEN: "E PICK UP" prompt | GREEN: prompt |
| Glass shards material | 900 | YELLOW: "materials:glass" on floor | GREEN: "E PICK UP" prompt | GREEN: prompt |
| Lore tape 02 | 2300 | YELLOW: "shade-tape:recorder" | GREEN: prompt | GREEN: prompt |
| Broken tape 01 | 2100 | YELLOW: "shade-tape:recorder" sprite, same visual as lore tapes | RED: identical sprite to lore tapes, player cannot distinguish broken tape from lore tape until pickup | GREEN: "E PICK UP" prompt |
| Desk hide 1 | 1200 | GREEN: desk sprite visible | GREEN: "E HIDE" sprite prompt | GREEN: prompt |
| Locker hide | 2050 | GREEN: locker sprite visible | GREEN: "E HIDE" prompt | GREEN: prompt |
| Desk hide 2 | 2500 | GREEN: desk visible | GREEN: prompt | GREEN: prompt |
| Radio | 1800 | YELLOW: "radio-table" decorative prop | GREEN: "E PICK UP" prompt | GREEN: prompt |
| Vent shortcut | 3050 | YELLOW: vent sprite at top of screen | GREEN: "E CLIMB" prompt at 80px | GREEN: prompt |

**Server** (3344x941, Listener + 2 ceiling jumpers + 1 floor jumper, upper floor)

| Element | x | Discoverability | Affordance | Activation |
|---------|---|-----------------|------------|------------|
| Door to Cubicles | 100 | YELLOW: room edge | GREEN: sprite prompt | GREEN: E key |
| Door to Stairwell | 3244 | YELLOW: room edge, locked until breaker | YELLOW: prompt shows "E INTERACT" but door is locked, fail message "The door is locked. Power must be on." plays | YELLOW: player might not connect "power" to "breaker" |
| Breaker switch | 2700 | YELLOW: "breaker-off" sprite at y=-100 (above floor), small | YELLOW: text prompt "E DECIPHER" appears at 100px range, but the word "DECIPHER" does not match the puzzle mechanic (which is audio matching, not deciphering) | YELLOW: the prompt shows the E key, but the verb misleads |
| Wire material | 2000 | YELLOW: "materials:wire" on floor | GREEN: "E PICK UP" prompt | GREEN: prompt |
| Lore tape 03 | 400 | YELLOW: small sprite | GREEN: prompt | GREEN: prompt |
| Broken tape 02 | 1100 | YELLOW: same sprite as lore tapes | RED: indistinguishable from lore tapes visually | GREEN: prompt |
| Locker 1 | 700 | GREEN: visible | GREEN: prompt | GREEN: prompt |
| Locker 2 | 2900 | GREEN: visible | GREEN: prompt | GREEN: prompt |
| Radio | 2200 | YELLOW: radio-table prop | GREEN: prompt | GREEN: prompt |
| Ladder | 1400 | YELLOW: ladder sprites rendered, but player must know W/S to climb | YELLOW: no explicit "W/S to climb" prompt | RED: W/S climb not communicated anywhere in-game |

**Stairwell** (3344x941, Listener + 2 ceiling + 1 floor jumper + Whisperer 40%)

| Element | x | Discoverability | Affordance | Activation |
|---------|---|-----------------|------------|------------|
| Door to Server | 100 | YELLOW: room edge | GREEN: prompt | GREEN: E key |
| Exit door | 3194 | YELLOW: at room right edge | YELLOW: requires keycard, fail message "The exit is locked. You need a keycard." but also has silent exit challenge after Tape 3 with "Too loud. Approach in silence." that is totally unexplained | YELLOW: E key shown, but silent exit mechanic has no prior explanation |
| Broken tape 03 | 1900 | YELLOW: shade-tape:recorder sprite | RED: indistinguishable from lore tape | GREEN: prompt |
| Lore tape 06 | 2400 | YELLOW: same sprite | GREEN: prompt | GREEN: prompt |
| Desk hide | 1400 | GREEN: visible | GREEN: prompt | GREEN: prompt |
| Vent shortcut | 350 | YELLOW: vent sprite | GREEN: "E CLIMB" prompt | GREEN: prompt |

**Archives** (2044x769, Whisperer 30%, beacon drain 1.5x, no main monster)

| Element | x | Discoverability | Affordance | Activation |
|---------|---|-----------------|------------|------------|
| Door to Reception | 200 | YELLOW: room edge | GREEN: prompt | GREEN: E key |
| Battery material | 1100 | YELLOW: small sprite | GREEN: prompt | GREEN: prompt |
| Map fragment | 2000 | YELLOW: "materials:keycard" sprite (shares keycard visual) | GREEN: prompt | GREEN: prompt |
| Lore tape 04 | 1800 | YELLOW: small sprite | GREEN: prompt | GREEN: prompt |
| Lore tape 05 | 500 | YELLOW: small sprite | GREEN: prompt | GREEN: prompt |
| Desk hide | 1500 | GREEN: visible | GREEN: prompt | GREEN: prompt |
| Whisper trapdoor | 1500 | RED: "vents:sealed" sprite rendered at zIndex 20, looks like a wall vent, not like a door or interactable. No glow, no pulse. Only visible on approach. | RED: text prompt "E LISTEN" appears at 80px range, but player has no reason to walk to a sealed vent | RED: player must guess that a sealed vent is interactive. The verb "LISTEN" does not hint at a puzzle. |

### 2.2 Summary counts

| Axis | GREEN | YELLOW | RED |
|------|-------|--------|-----|
| Discoverability | 11 | 22 | 2 |
| Affordance | 21 | 9 | 5 |
| Activation | 26 | 5 | 4 |

The worst scores cluster on the three NEW puzzle interactables (breaker, whisper trap, tape station) and on materials/broken tapes (which look identical to other pickups but serve different purposes).

---

## 3. HUD and visual indicators

### 3.1 Persistent HUD elements

Source: src/hud.ts.

| Element | When visible | What it conveys | Position | Prominence |
|---------|-------------|-----------------|----------|------------|
| Beacon meter | Always during PLAYING | Voice energy level (0-100), flashlight radius | Top center (x=640, y=~88), 200px wide | HIGH: labeled "BEACON" at 14px, fill bar with frame sprite, eroded overlay for Whisperer drain |
| Inventory slots | Always during PLAYING | 3 material/item slots, selected slot highlighted | Top-left (16, 16), 3 slots at 56px spacing, each ~50px wide | LOW: tiny (scale 0.08), no labels, no explanation of what materials do |
| Minimap | After map_fragment pickup | 5-room layout, visited rooms, player dot, objective highlights, threat markers after Tape 1 | Top-right (1024, 16), 240x180px | MEDIUM: visible once acquired, parchment style, room connections drawn |
| Subtitle bar | Transient | Narration text (tutorials, lore tapes, map fragment) | Bottom center (x=640, y=600), word-wrap 1080px | MEDIUM: 22px monospace white on dark bg, auto-fades after duration |
| Prompts | Near interactables | "E PICK UP", "E HIDE", "E INTERACT", "E DECIPHER", "E LISTEN", "E PLAY TAPE", "E EXAMINE" | Bottom center (x=640, y=580) | MEDIUM: 18px monospace light-blue on dark bg. Sprite prompts use key icon sprites + label sprites at 48px height. Text prompts use plain text. |
| HIDDEN indicator | While in hiding spot | "HIDDEN" text | Top-right (1280-width-30, 10) | LOW: 14px light-blue, easy to miss |
| RADIO [R] indicator | While carrying radio | "RADIO [R]" text | Top-left (16, 10) | LOW: 14px orange, only appears when radio carried |
| Armed timer | While radio is armed | "ARMED: X.Xs [G] throw" | Top center (510, 40) | MEDIUM: 16px red, countdown visible |
| Heartbeat | Suspicion > 30 | Auditory tension cue | Audio only, no visual | LOW: audio-only, player may not realize it maps to suspicion |
| Vignette | Always (scales with threat) | Edge darkening proportional to monster state | Full screen overlay, z-index 150 | MEDIUM: subtle at low threat, strong at CHARGE/ATTACK |

### 3.2 Guidance arrow

Source: src/guidance-arrow.ts, game.ts:742-821.

The arrow is a floating sprite (56px tall) positioned above the player's head. It points left or right toward the next objective. It pulses vertically (6px amplitude, 1200ms period) and fades in/out over 400ms.

**Priority list (game.ts:744-753, getArrowTarget):**
1. If player does NOT have map_fragment: point to keycard (cubicles x=1600)
2. If player HAS keycard but breaker is OFF: point to breaker (server x=2600)
3. If player HAS keycard and breaker is ON: point to map_fragment (archives x=2000)
4. If player HAS map_fragment: return null (arrow hidden)

**Critical gap: the arrow does NOT point to any Hotfix R/S/T content.** After the map_fragment is acquired, the arrow disappears permanently. It never points to:
- The trapdoor in Archives (whisper puzzle)
- Broken tape pickups in Cubicles, Server, or Stairwell
- The workbench/tape station in Reception
- The stairwell exit

The minimap's objective room highlighting (getObjectiveRooms at game.ts:787-794) shows cubicles (for keycard), server (for breaker), and stairwell (for exit). It does NOT highlight:
- Archives (for whisper trap)
- Reception (for tape station)
- Rooms containing broken tapes

### 3.3 Prompt evaluation

| Prompt | Verb | Intuitive? | Problem |
|--------|------|-----------|---------|
| "E PICK UP" | PICK UP | Yes | None. Clear. |
| "E HIDE" | HIDE | Yes | None. |
| "E INTERACT" | INTERACT | Acceptable | Generic, but doors are the expected interactable. |
| "E CLIMB" | CLIMB | Yes | Works for vents and ladders. |
| "E DECIPHER" | DECIPHER | No | The puzzle is "listen to sounds and match them". DECIPHER implies reading or decoding text. The player expects a cipher puzzle, not an audio puzzle. |
| "E LISTEN" | LISTEN | Partially | The player expects to hear ambient sound, not to perform a whisper challenge. The verb is passive ("listen") but the puzzle requires active whispering. |
| "E PLAY TAPE" | PLAY TAPE | Partially | Implies passive listening, but the puzzle requires active reordering. The player might expect a lore tape playback. |
| "E EXAMINE" | EXAMINE | No | Shows at workbench when player has no broken tapes. Examining does nothing useful. Player may think the workbench is decorative. |
| "E GRAB" (shade) | GRAB | Yes | Clear for shade recovery. |
| "Press E to leave hiding spot" | leave | Yes | Text prompt, not sprite. Functional. |

All prompts appear only within close range: 80-100px from the interactable. No medium-distance indication exists.

---

## 4. Audio cues for discoverability

### 4.1 Ambient sounds per room

Source: audio-catalog.ts:101-141. Each room has one looping ambient track crossfaded on room entry.

| Room | Ambient ID | Description | Volume |
|------|-----------|-------------|--------|
| Reception | reception_ambient | Eerie drone, fluorescent buzz | 0.4 |
| Cubicles | cubicles_ambient | Tense drone, subtle creaks | 0.4 |
| Server | server_ambient | Loud electrical hum, fan noise | 0.5 |
| Stairwell | stairwell_ambient | Dread drone, metallic creaks | 0.5 |
| Archives | archives_ambient | Oppressive drone, paper rustling, water drips | 0.5 |

### 4.2 Positional audio for puzzle elements

**Breaker switch (Server x=2700).** No unique audio. The server_ambient hum plays room-wide. The breaker sprite has no proximity sound. The player discovers it visually only.

**Whisper trapdoor (Archives x=1500).** whisper_trap_ambient plays as a looping SFX at volume 0.05 (audio-catalog.ts:468). This is extremely faint. The Archives room ambient plays at volume 0.5. The trap ambient is 10x quieter than the room ambient. At a typical 2044px room width, the player would need to be very close to notice it. There is no Howler 3D positional configuration in the whisper-puzzle.ts or game.ts for this sound. It appears to play at global volume, not spatially. At 0.05, it is likely inaudible over the room ambient.

**Workbench / tape station (Reception x=1500).** No unique audio. The workbench is a decorative prop (rooms.ts:82-87) with no sound emission. The player has no audio reason to approach it.

### 4.3 Audio cues on puzzle success/failure

| Event | Audio | When it plays |
|-------|-------|---------------|
| Breaker success | breaker_switch SFX (0.7 vol) | After correct match |
| Breaker failure | breaker_lock_alarm SFX (0.95 vol) | After wrong choice or timeout |
| Whisper success | (none confirmed in whisper-puzzle.ts) | Overlay closes |
| Whisper failure | whisper_trap_fail SFX (0.9 vol) | Whisperer spawns |
| Tape success | tape_unlock SFX (0.85 vol) | After correct order |
| Tape wrong order | tape_garbled SFX (0.8 vol) | Reshuffles for retry |

These cues play AFTER the player has already found and started the puzzle. They do not aid discoverability.

### 4.4 Verdict per mechanic

**Breaker puzzle.** No positional audio draws the player to x=2700 in Server. The guidance arrow points there (before map_fragment acquisition), which partially compensates. After map_fragment is acquired, the arrow disappears. If the player has not yet engaged the breaker at that point, they have no navigation aid.

**Whisper trap.** The whisper_trap_ambient at 0.05 volume is functionally silent. Archives is a small room (2044px), so the player may stumble into range. But the audio cue is not doing its job.

**Tape station.** No audio whatsoever draws the player to the workbench. The workbench is in Reception, the spawn room. The player passes through Reception frequently, but the workbench is just another prop.

---

## 5. The first 10 minutes walkthrough

### 5.1 Player opens the URL

**Loading screen.** An HTML div (index.html, z-index 9500) covers the canvas. It shows the game loading. Removed after assets load. No explanation of controls or mechanics.

**Title screen.** Handled by main.ts. Shows the game title and a "Click to start" prompt. A headphones warning is shown. On click, transitions to INTRO (first visit) or PLAYING (after restart).

**Intro panels.** Three hand-drawn panels with voiceover. Panel 1: "You shouldn't be here. But you are." Panel 2: "It hunts by sound. Your microphone is the controller." Panel 3: "Get out. Three things: Keycard, Breaker, Stairwell exit." Click or Space/Enter advances. Skip: hold Escape for 1 second. The skip mechanism has NO visual indicator. A player who wants to skip must discover the hold-Escape behavior on their own.

The intro panels do not mention the three audio puzzles, broken tapes, the workbench, materials, radios, hiding spots, the minimap, or any secondary mechanic.

### 5.2 PLAYING begins. Player spawns in Reception.

Spawn x: 200 (rooms.ts:20, playerSpawnFromLeft).

**Visible on screen at spawn.** The Reception background (2896px wide). The player character at x=200 (left side of room). The beacon meter at top center. Three inventory slots at top-left (empty, tiny). An exit-sign decorative prop at x=2200. A flickerlight prop at x=200 (blinking). The workbench prop at x=1500 (center of room). A tape material at x=2100 and a lore tape at x=2400 (both require walking right to see).

**Audible at spawn.** reception_ambient at 0.4 volume. Heartbeat (silent, suspicion is 0). No tutorial voice yet.

**HUD.** Beacon meter (starts full at 100). Inventory slots (3 empty, very small). No minimap (requires map_fragment). No prompts (player is not near any interactable).

**Guidance arrow.** Points right, toward the door at x=500 (which leads to Cubicles, where the keycard is). The arrow is the primary onboarding mechanism.

### 5.3 Player walks right, exploring Reception

At x=500 (door to Cubicles), a sprite prompt appears: "E [door icon]" (showSpritePrompt "key-e", "label-interact"). Player presses E. Fade transition. Player enters Cubicles.

If the player walks right past the door, they encounter the workbench at x=1500. No prompt appears (crafting was removed in Hotfix Q, and the tape station prompt only shows if the player has broken tapes or is within triggerWidth=100 AND the function `isNearTapeStation` fires, which requires `currentRoom === "reception"`). Actually, looking at the code more carefully: `isNearTapeStation` (game.ts:3233-3237) checks `currentRoom === "reception"` and proximity to wb.x (1500) within wb.triggerWidth (100). The prompt "E EXAMINE" DOES appear (game.ts:2328-2335) even without broken tapes. So the player sees "E EXAMINE" at the workbench, presses E, and gets... the tape station opening. With no tapes available, it shows "Nothing to play." (game.ts:3255). The player walks away confused.

At x=2100, a tape material pickup with "E PICK UP" prompt. Player picks it up. It goes into inventory slot 0. The player sees a tiny icon in the top-left slot. They have no idea what it is for, since crafting was removed (Hotfix Q) and the tutorial_t3 only says "Collect materials along the way" (audio-catalog.ts:747).

### 5.4 Player follows the guidance arrow to Cubicles

**First impressions.** 7 foreground dividers create a maze-like layout that occludes the player behind cubicle walls. The Listener monster is somewhere between x=600 and x=2800 (patrol path). The room ambient (cubicles_ambient) plays. Two vent decorative props at top of screen.

**Keycard location.** x=1600, middle of the room. The sprite "keycard" sits on the floor. The guidance arrow points toward it. However, the foreground dividers may occlude the player's view. The keycard is a small pickup sprite.

**Jumpers.** 1 ceiling jumper at x=1500, 2 floor jumpers at x=550 and x=2700. The floor jumpers are visible when the player is within 250px (idle peeking frames). The ceiling jumper is dormant (invisible until triggered). The player encounters these without any prior warning except the lore tapes (if collected).

**Listener.** Patrolling between x=600-2800. If the player is making noise, suspicion builds. The Listener is visible when in the flashlight radius. The heartbeat kicks in above suspicion 30.

**What guides the player.** The guidance arrow points to keycard at x=1600. Tutorial t0 fires on first room with a monster: "If you can hear this, get out. It hunts by sound. Stay quiet. Stay hidden." Tutorial t1 fires in Cubicles: flashlight is voice-activated. Tutorial t2: whisper safely, talk for light.

### 5.5 Player picks up keycard

**Sound.** keycard_pickup SFX (0.5 volume).
**HUD.** The keycard goes into state.inventory (Set), not into inventorySlots. No visual change to the 3-slot inventory. The keycard is a quest item, not a material.
**Guidance arrow.** Updates. Now points to breaker (server x=2600), since keycard is acquired but breaker is off (game.ts:749-750).
**Subtitle.** Radio hint plays: "There should be a keycard somewhere on this floor" (radio_keycard_hint). This plays on first entering Cubicles, not on pickup. By the time the player picks up the keycard, the hint may have already played and faded.
**Message.** None shown for keycard pickup specifically. The pickup handler at game.ts:897-899 plays SFX and adds to inventory but does not show a message for keycard.

### 5.6 Player walks to Server. Where is the breaker?

Player exits Cubicles (door at x=3244 or back to Reception at x=100, then to Server at x=1800). The guidance arrow adapts: in Cubicles it points to the door to Server (x=3244). In Server, it points to x=2600 (near the breaker at x=2700).

**Breaker visibility.** The breaker sprite "breaker-off" is at x=2700, y=-100 (above floor level). Scale is default (1.0 from the atlas). The sprite is small. The server_ambient hum (0.5 volume, industrial) masks any subtle cue. The player must walk right to find it.

**Approach.** At 100px range, the prompt "E DECIPHER" appears (game.ts:2315). This is a TEXT prompt, not a sprite prompt. It uses showPrompt (plain text, 18px monospace, light blue) rather than showSpritePrompt (key icon + label sprite). The text "DECIPHER" is unusual and does not describe the puzzle mechanic.

### 5.7 BREAKER PUZZLE OPENS

Player presses E. Phase changes to PAUSED. Ticker stops. Overlay appears (breaker-puzzle.ts:319-380).

**First frame the player sees.** A dark panel (480px wide) with the title "BREAKER LOCK. MATCH THE SIGNAL." (breaker-puzzle.ts:329). Below it, a "PLAY ORIGINAL" button. Below that, a 2x2 grid of buttons labeled "A", "B", "C", "D". Below that, a disabled "SUBMIT" button. A thin timer bar. And the hint text at 11px, 0.6 opacity: "1/2/3/4 select. SPACE replay original. ENTER submit. ESC leave."

**Is "MATCH THE SIGNAL" intuitive?** Partially. The player understands they must match something. But what is the "signal"? The original auto-plays after 500ms (game.ts:3093, breaker-puzzle.ts:121-123). The player hears a relay click + hum. They must then click A/B/C/D to hear variants and find the match.

**Can the player figure out the workflow?** The ORIGINAL button is labeled clearly. The A/B/C/D buttons are labeled clearly. Clicking one plays a sound and highlights it. The SUBMIT button enables when a letter is selected. The timer bar counts down. The hint text exists but is very small. The keyboard shortcuts (1-4, Space, Enter, Esc) are not discoverable without reading the hint.

**Friction points in the breaker puzzle.**
1. "DECIPHER" prompt does not match "MATCH THE SIGNAL" title. The player was told to decipher, but the puzzle asks them to match.
2. The auto-play of the original after 500ms may be missed if the player is reading the UI.
3. The 15-second timer creates pressure, but the variants are designed to be subtly different. The player needs to listen carefully, which is hard under time pressure.
4. Failure adds +60 suspicion and forces an 8-second HUNT. The player may not connect "I got the puzzle wrong" with "the monster is now hunting me."

### 5.8 Player solves or fails the breaker

**Success path.** breakerOn = true. breaker_switch SFX plays. Pickup sprite toggles to "breaker-on". hud.showMessage("Power restored.") for 2000ms (game.ts:3103-3105). Phase returns to PLAYING. The stairwell door is now unlockable.

**Guidance arrow after breaker.** Arrow now points to map_fragment in Archives (x=2000). The player has no reason to know why they should go to Archives. The arrow just points there.

**Stairwell door.** Visually, the door at Server x=3244 is the same sprite. The player must attempt it to discover it is now passable.

### 5.9 Player explores Archives. Trapdoor at x=1500.

**From room entrance (x=200).** The room is 2044px wide. The trapdoor is at x=1500, about 1300px from the entrance. The vents:sealed sprite renders at zIndex 20 (wall layer, game.ts:3217-3228). It is a reused vent grate sprite. It does not look like a door or an interactable puzzle location.

**Whisper ambient.** whisper_trap_ambient is cataloged at 0.05 volume (audio-catalog.ts:468). This is inaudible at room scale. The archives_ambient plays at 0.5 volume, 10x louder. The faint whisper does not draw the player to x=1500. There is no positional panning configured for this sound.

**On approach (within 80px).** The prompt "E LISTEN" appears (game.ts:2340). The player must be within 80 pixels of x=1500. Given the desk hiding spot is ALSO at x=1500 (rooms.ts:383), the desk prompt "E HIDE" may compete with the whisper trap prompt. Looking at the prompt priority order in updatePrompts (game.ts:2283-2365): hiding spots are checked first (line 2297), then radio pickups (2303), then regular pickups (2309), then tape station (2328), then whisper trap (2339). So if the player is near both the desk and the trapdoor, the HIDE prompt takes priority over the LISTEN prompt. The player may never see "E LISTEN".

### 5.10 WHISPER PUZZLE OPENS

Player presses E near x=1500 (assuming they see the LISTEN prompt). Phase changes to PAUSED. Overlay appears.

**First frame.** Dark green panel. Title: "THE WHISPERER SPEAKS. REPEAT." A large mic emoji (64px). The phrase text shows "..." while TTS generates. Instruction text at 11px: "WHISPER ONLY. DO NOT SPEAK ABOVE A WHISPER." Progress bar (empty). 3 attempt dots. Hint at 11px, 0.4 opacity: "ESC to leave. Speak too loud and you fail."

**Does the player understand they must speak into their mic?** The mic emoji is visible. The instruction says "WHISPER ONLY." But the player may not realize their real microphone is being used for the puzzle (as opposed to in-game audio). The phrase text appears after TTS generation (2.5s delay). During the delay, the player sees "..." and may be confused.

**Does the player understand they must repeat the phrase?** The title says "REPEAT." The phrase appears as italic text. The Bella voice whispers the phrase. If the player misses the audio (common in noisy environments or if TTS is slow), they have only the text. The connection between "the game is listening to my real voice" and "I need to whisper this phrase" is not explicit. The player might try clicking buttons that do not exist.

**Mic feedback.** When RMS is in whisper range (0.01125-0.0225), the mic icon turns green with a glow (CSS filter: brightness(1.3) drop-shadow). The progress bar fills. When RMS is too high, the icon gets a red glow. When silent, the icon stays gray. This feedback is visible but requires the player to understand the connection.

**Friction points in the whisper puzzle.**
1. The player does not expect a mic-based puzzle inside a sealed vent.
2. "LISTEN" prompt suggests passive hearing, not active speaking.
3. The 2.5s TTS generation delay creates dead air.
4. The phrase "shadow walks beside you" must be whispered (not spoken normally). The RMS threshold for whisper (0.01125-0.0225) is narrow. Many microphones will exceed it with normal quiet speech.
5. If the player fails, a Whisperer spawns at x=1500 and beacon drain goes to 5x for 20 seconds. This is a harsh penalty without clear connection to the puzzle failure.

### 5.11 Player picks up broken tapes. Returns to Reception.

Broken tapes are at: Cubicles x=2100, Server x=1100, Stairwell x=1900. All use the "shade-tape:recorder" sprite (rooms.ts:125-130, 218-222, 278-283). This is the SAME sprite as lore tapes (tape_01 through tape_06). The player cannot distinguish a broken tape from a lore tape by visual appearance. On pickup, the message "Picked up broken tape." appears (not confirmed in game.ts, but per Hotfix T verification table). The tape goes into brokenTapesCollected (game.ts:930-936 area).

**On approach to workbench (x=1500 in Reception).** If the player has at least one broken tape: prompt shows "E PLAY TAPE" (game.ts:2331). If no broken tapes: "E EXAMINE" (game.ts:2333).

**Is "PLAY TAPE" intuitive?** The player expects to hear a tape playback (passive). The actual puzzle requires active reordering of 4 audio segments. "PLAY TAPE" undersells the interaction.

### 5.12 TAPE PUZZLE OPENS

Player presses E. Phase PAUSED. Overlay appears.

**First frame.** Dark amber panel. Title: "RECONSTRUCTION. ARRANGE THE SEGMENTS." Four fragment buttons in a 2x2 grid, each labeled with a play icon and the segment text (e.g., "1. we saw the lights"). Below, 4 empty slots labeled A through D with "___". Below, a "PLAY FULL" button and a "SUBMIT ORDER" button (disabled until all slots filled). Hint at 11px: "1-4 listen. A-D place. SPACE play full. ENTER submit. ESC leave."

**Does the player understand the workflow?** The title says "ARRANGE THE SEGMENTS." This is clearer than the other puzzles. The workflow is: click a fragment button to hear it, then click a slot to place it. However, the visual distinction between fragments (top, 2x2 grid) and slots (bottom, vertical column) is subtle. Both are styled similarly (same brown palette). A first-time player may not immediately understand that fragments go INTO slots.

**Confusing labels.** Fragments are numbered 1-4. Slots are lettered A-D. This helps distinguish them, but the relationship between numbers and letters is not explained. The keyboard shortcut hint says "1-4 listen. A-D place." which maps correctly, but requires reading the 11px hint.

**PLAY FULL button.** Positioned between the slots and the submit button. It concatenates all placed segments in slot order and plays them back-to-back. The player may not discover this button before submitting. If they submit wrong, the puzzle reshuffles and all slots clear. The reshuffle is not accompanied by a clear "Wrong order, try again" message (only the tape_garbled SFX plays). The result callback fires "fail_wrong_order" which only plays the garbled sound, does not close the puzzle, and reshuffles (tape-puzzle.ts:221-230). The player may think the puzzle broke.

### 5.13 Friction point summary from first-10-minutes

At each puzzle, the player encounters a gap between what the game presents and what the game expects.

1. The player does not know the trapdoor exists (RED discoverability).
2. The player does not know broken tapes are different from lore tapes (RED distinction).
3. The player does not know the workbench is now a tape station (RED affordance, no audio/visual cue).
4. "DECIPHER" misleads about the breaker puzzle mechanic.
5. "LISTEN" misleads about the whisper puzzle mechanic.
6. "PLAY TAPE" undersells the tape reordering mechanic.
7. The guidance arrow stops helping after map_fragment pickup.
8. Materials fill inventory slots but serve no purpose (crafting removed).
9. The silent exit challenge (Tape 3 reward) activates with no prior explanation.
10. Tape 2 reward does nothing (deferred whisper radio mode).

---

## 6. Friction inventory

Ranked by severity (blocking > high > medium > low), then by frequency.

| # | Stage | Description | Severity | Cause | Fix category |
|---|-------|-------------|----------|-------|-------------|
| F1 | Archives, whisper trap | Player does not know the trapdoor exists. The vents:sealed sprite looks like a wall decoration. No glow, no pulse, no positional audio loud enough to guide. | HIGH | Reused vent sprite at low zIndex, whisper_trap_ambient at 0.05 vol (effectively silent) | Sprite affordance + positional audio |
| F2 | Post-map-fragment | Guidance arrow disappears after map_fragment pickup. Player has no navigation aid for puzzles, broken tapes, or the tape station. | HIGH | getArrowTarget returns null when hasMapFragment is true (game.ts:745). Arrow was never updated for Hotfix R/S/T content. | Guidance arrow priority list |
| F3 | Reception, tape station | Player does not know the workbench is interactive for tapes. No audio cue, no visual change when broken tapes are in inventory. "E EXAMINE" prompt when no tapes. | HIGH | Workbench is a decorativeProps entry with no interactive indicator. Tape station reuses the workbench silently. | Sprite affordance + prompt copy |
| F4 | Server, breaker | "E DECIPHER" does not match the puzzle (audio matching). Player expects a text/code puzzle. | MEDIUM | Prompt string at game.ts:2315 | Prompt copy rewrite |
| F5 | Archives, whisper trap | "E LISTEN" does not hint at active whisper requirement. Player expects passive audio. | MEDIUM | Prompt string at game.ts:2340 | Prompt copy rewrite |
| F6 | All rooms | Materials (wire, glass_shards, battery, tape) pick up into inventory slots but serve no purpose. Player collects them expecting a payoff. | MEDIUM | Hotfix Q removed crafting but preserved material pickups and inventory flow (game.ts:890-911). Tutorial t3 says "Collect materials along the way." | Remove material pickups or repurpose |
| F7 | Cubicles/Server/Stairwell | Broken tapes are visually identical to lore tapes. Player cannot distinguish quest-critical items from lore collectibles. | MEDIUM | Both use "shade-tape:recorder" sprite (rooms.ts) | Distinct sprite or glow for broken tapes |
| F8 | Stairwell, exit door | Silent exit challenge (Tape 3 reward) activates with only a HUD message "Recording restored. The exit listens for silence." Player forgets by the time they reach the exit. | MEDIUM | exitFinalChallengeActive set silently in applyTapeReward (game.ts:3312). Exit door check at game.ts:1047-1054 shows "Too loud" message. | In-game reminder at exit door approach |
| F9 | Tape puzzle | Wrong order reshuffle plays tape_garbled SFX but no text message. Player may think the puzzle broke. | MEDIUM | handleTapeResult returns on fail_wrong_order without showing a message (game.ts:3278-3280) | HUD message on wrong order |
| F10 | Whisper puzzle | 2.5s dead air during TTS generation. Phrase text shows "..." then appears. Player confused. | MEDIUM | TTS async call at whisper-puzzle.ts:112-125 | Show phrase text immediately, play audio when ready |
| F11 | Tape puzzle, Tape 2 | Tape 2 reward is deferred (whisperRadioMode flag set, no mechanic). Player sees "Whisper radio mode unlocked" but nothing changes. | MEDIUM | Deferred implementation per Hotfix T design (tape-station.md section 3) | Either implement or remove the message |
| F12 | All rooms | No in-game controls reference. F key (whisper charm), R (arm radio), G (throw), 1/2/3 (slot select), Shift (run), Ctrl (crouch), W/S (ladder) are undocumented in-game. | MEDIUM | No controls overlay or input hint system exists | HUD key hints or pause-menu controls list |
| F13 | Death screen | Player does not know what killed them (Listener, Jumper, beacon drain). Stats show time/rooms/encounters but not cause of death. | LOW | triggerDeath does not track death source (game.ts:1475-1539) | Death cause text on gameover screen |
| F14 | Breaker puzzle | 15-second timer + subtle audio variants = high difficulty. First-time players may fail repeatedly without understanding why. | LOW | Design choice (tunable via timerMs parameter) | Increase timer or make variants more distinct |
| F15 | Whisper puzzle | Desk hiding spot at x=1500 in Archives competes with whisper trap at x=1500. "E HIDE" prompt takes priority over "E LISTEN" (game.ts:2297 vs 2339). | MEDIUM | Both interactables at same x coordinate, prompt priority favors hiding | Separate x positions or check for whisper trap before hiding |
| F16 | Server, ladder | W/S controls for ladder climbing are never communicated. Player may stand at ladder and press E, getting no response. | LOW | No prompt for ladder interaction (game.ts does not show a ladder prompt) | Show "W/S CLIMB" prompt near ladder |
| F17 | Archives, trapdoor | Desk hide and whisper trap share x=1500. If player is near both, they can only see the HIDE prompt. They cannot discover the whisper trap prompt unless they are NOT near the desk. | HIGH | Overlapping trigger zones at identical x coordinates | Move one interactable or add priority logic |

---

## 7. Asset audit

### 7.1 Existing UI sprites

Based on ARCHITECTURE.md and hud.ts/guidance-arrow.ts references:
- key-e, key-r, key-g, key-ctrl (keyboard key icons)
- label-interact, label-hide, label-pickup, label-climb, label-craft, label-grab (action labels)
- arrow-guidance (floating objective arrow)
- beacon-meter-frame, beacon-meter-fill (beacon bar)
- inventory-slot-empty, inventory-slot-selected (inventory slots)
- minimap-frame, minimap-room-tile, minimap-player-dot (minimap)
- intro:panel-1, intro:panel-2, intro:panel-3 (intro sequence)

### 7.2 Visual gaps

| Gap | Current state | Impact | Solution |
|-----|--------------|--------|----------|
| Whisper trapdoor sprite | vents:sealed (atlas reuse). Looks like a wall vent. Not readable as an interactable. | HIGH (F1, F17) | New sprite: sealed trapdoor with faint glow cracks. Or, Pixi Graphics pulse overlay on the existing sprite. |
| Broken tape sprite | shade-tape:recorder (same as lore tapes). Indistinguishable. | MEDIUM (F7) | Tint the broken tape sprite differently (e.g., red tint via Pixi Sprite.tint). Or new sprite with a cracked cassette visual. |
| Workbench interactive indicator | workbench:bench (decorative, static). No visual cue that it accepts tapes. | HIGH (F3) | Add a Pixi Graphics pulse ring around the workbench when broken tapes are in inventory. Or overlay a small cassette icon sprite on the workbench. |
| Breaker interactive indicator | breaker-off (small, above floor). No glow. | MEDIUM (F4) | Pixi Graphics pulse or tint shift on proximity. |
| Interactable glow/pulse | No existing sprite or graphics primitive for pulsing interactable indicators. | HIGH (F1, F3) | Implement a reusable pulse ring using Pixi Graphics (cheapest, no asset). Ellipse at sprite base, alpha oscillating 0.2-0.6, color keyed to interactable type. |
| Mic icon for whisper puzzle | Emoji character (U+1F399) at 64px font size (whisper-puzzle.ts:357). Not a custom sprite. | LOW | Acceptable. The emoji renders cross-browser. A custom sprite would be more polished but is not blocking. |

### 7.3 Ranking by player impact

**HIGH impact (addresses F1, F2, F3, F17):**
1. Pulse ring for interactable props (Pixi Graphics, no asset, ~2 hours code)
2. Distinct trapdoor sprite or tint (DALL-E generation or Pixi tint, ~1 hour)
3. Guidance arrow update for post-map-fragment objectives (code only, ~1 hour)

**MEDIUM impact (addresses F4, F5, F7, F8):**
4. Broken tape visual distinction (Pixi tint, ~30 min code)
5. Prompt copy rewrites (code only, ~30 min)
6. Silent exit reminder prompt (code only, ~30 min)

**LOW impact (polish):**
7. Custom mic icon sprite (DALL-E, ~1 hour including atlas slice)
8. Ladder climb prompt sprite (code only, ~30 min)

---

## 8. Hand-off notes

### 8.1 Recommended scope ordering

a) **Update guidance arrow priority list.** Cheapest change, highest impact. After map_fragment is acquired, the arrow should continue to point to remaining objectives: breaker (if not done), broken tapes (if not collected), tape station (if tapes collected but not reconstructed), exit (if all done). This directly addresses F2. Estimated code effort: 2 hours.

b) **Rewrite puzzle prompt verbs.** Replace "E DECIPHER" with "E TUNE" or "E MATCH SIGNAL". Replace "E LISTEN" with "E WHISPER" or "E OPEN TRAPDOOR". Replace "E PLAY TAPE" with "E RECONSTRUCT" or "E REBUILD TAPE". Replace "E EXAMINE" with nothing (hide prompt when no tapes available, or show a passive "Workbench" label). Addresses F4, F5. Estimated code effort: 30 minutes.

c) **Add positional audio cues to puzzle locations.** Raise whisper_trap_ambient volume from 0.05 to 0.15-0.20 and configure Howler 3D panning so it plays from the trapdoor's position. Add a faint electrical hum loop near the breaker (can reuse server_ambient at reduced volume or add a new short loop). Add a faint mechanical creak or tape whir loop near the workbench when broken tapes are in inventory. Addresses F1, F3. Estimated code effort: 2 hours. Estimated asset effort: 1 hour (2 new short loops via ElevenLabs Sound Effects).

d) **Improve in-overlay instructions.** Increase hint text from 11px to 14px. Increase opacity from 0.4-0.6 to 0.7. Add a brief instruction sentence above the hint: "Listen to the original, then find the match" (breaker). "Whisper the phrase into your microphone" (whisper). "Click fragments to listen, then place them in order" (tape). Add a "Wrong order. Try again." message on tape puzzle failure. Addresses F9, F10. Estimated code effort: 1 hour.

e) **Add visual affordance (pulse) to interactable props.** Implement a reusable PulseRing class using Pixi Graphics. Apply to breaker switch, whisper trapdoor, and workbench when tapes are available. The pulse should be visible when the player is in the same room, not just at interaction range. Addresses F1, F3. Estimated code effort: 2 hours.

f) **Differentiate broken tape sprites.** Apply a distinct tint (e.g., 0xff8844 amber) to broken tape pickup sprites via Pixi Sprite.tint. Or generate a cracked-cassette sprite in the hand-drawn dark style. Addresses F7. Estimated code effort: 30 minutes (tint) or 2 hours (new sprite including atlas integration).

g) **Resolve prompt overlap at Archives x=1500.** Move the desk hiding spot from x=1500 to x=1300 or x=1700, or add priority logic that shows the whisper trap prompt over the hide prompt when the trapdoor is sealed. Addresses F15, F17. Estimated code effort: 30 minutes.

h) **Remove or repurpose materials.** Either remove wire, glass_shards, battery, tape from room pickups (simplest), or give them a purpose (e.g., each material collected provides a small beacon bonus, or materials are required to repair broken tapes). Addresses F6. Estimated code effort: 1-3 hours depending on approach.

### 8.2 Effort summary

| Item | Code (hours) | Asset (hours) |
|------|-------------|---------------|
| a) Arrow priority | 2 | 0 |
| b) Prompt copy | 0.5 | 0 |
| c) Positional audio | 2 | 1 |
| d) Overlay instructions | 1 | 0 |
| e) Pulse ring | 2 | 0 |
| f) Broken tape visual | 0.5 | 0-2 |
| g) Prompt overlap fix | 0.5 | 0 |
| h) Materials | 1-3 | 0 |
| **Total** | **9.5-13.5** | **1-3** |

### 8.3 Hard constraints

- No new tutorials. The user explicitly rejected tutorial popups.
- No new game phases. The existing INTRO/PLAYING/PAUSED/DYING/GAMEOVER/WIN flow is preserved.
- The existing guidance arrow continues to work for its current targets (keycard, breaker, map_fragment).
- All three puzzle overlays (breaker, whisper, tape) continue to function as designed.
- All Hotfix Q/R/S/T behavior is preserved exactly.
- Materials may be removed from rooms but crafting.ts and workbench-menu.ts files must not be deleted (per Hotfix Q preservation policy).

### 8.4 Open questions for the next prompt

1. Should the arrow point to the trapdoor and workbench as optional objectives, or only main path? If optional, the arrow priority list becomes complex (main path first, then side content). If main path only, the arrow still hides after map_fragment.

2. Should puzzle props pulse permanently (always discoverable in the room) or only when the player is within a certain distance (e.g., 500px)? Permanent pulsing is more discoverable but may reduce the horror atmosphere. Distance-gated pulsing is subtler.

3. Should the whisper_trap_ambient volume be raised so the player hears it from farther away? The current 0.05 is inaudible. A value of 0.15-0.20 would be audible from approximately half the room width. This trades discoverability for atmosphere (a louder ambient may break immersion).

4. Should materials be removed entirely, or should they be given a minor purpose (e.g., auto-consumed when solving tape puzzles as a gating mechanism)?

5. Should the death screen differentiate between Listener catch, Jumper attack, and beacon-zero death? This requires tracking the death source in triggerDeath.

6. Should the Tape 2 reward message be suppressed until the mechanic is implemented? Currently it says "Whisper radio mode unlocked" but does nothing.

---

## Verdict

The three audio puzzles (breaker, whisper, tape) are well-designed mechanically. The underlying code is solid: the breaker randomizes correctly, the whisper mic detection works within calibrated thresholds, and the tape reordering with Web Audio concatenation is functional. The puzzles themselves are not confusing.

What is confusing is the complete absence of spatial guidance toward them. The guidance arrow, the game's only onboarding mechanism, was never updated for Hotfix R/S/T content. After the map_fragment is acquired, the arrow vanishes. No positional audio leads the player to the breaker, the trapdoor, or the workbench. The trapdoor uses a reused vent sprite that is indistinguishable from a wall decoration. The workbench sits silently in the spawn room with no indicator that it has changed function. Broken tapes look identical to lore tapes. The prompt verbs ("DECIPHER", "LISTEN", "PLAY TAPE") mislead about the actual puzzle mechanics.

The root cause is not bad puzzle design. It is that the three puzzles were added as self-contained modules (breaker-puzzle.ts, whisper-puzzle.ts, tape-puzzle.ts) that integrate with game.ts for phase management and result handling, but the surrounding UX systems (guidance arrow, minimap objectives, prompt copy, positional audio, sprite affordance) were not updated to account for their existence. The puzzles work. The player cannot find them.

---

## Appendix A. Files read

- REFERENCE_SECURITY_AUDIT.md (full)
- REFERENCE_DOCUMENTATION_AUDIT.md (full)
- ARCHITECTURE.md (full, 558 lines)
- README.md (full, 448 lines)
- docs/fixes/crafting-removal.md (full, 191 lines)
- docs/fixes/breaker-puzzle.md (full, 240 lines)
- docs/fixes/whisper-puzzle.md (full, 250 lines)
- docs/fixes/tape-station.md (full, 244 lines)
- docs/fixes/jumper-lunge-impact-fix.md (full, 242 lines)
- src/types.ts (full, 298 lines)
- src/rooms.ts (full, 452 lines)
- src/hud.ts (full, 578 lines)
- src/input.ts (full, 121 lines)
- src/minimap.ts (full, 277 lines)
- src/guidance-arrow.ts (full, 82 lines)
- src/audio-catalog.ts (full, 805 lines)
- src/breaker-puzzle.ts (full, 468 lines)
- src/whisper-puzzle.ts (full, 488 lines)
- src/tape-puzzle.ts (full, 477 lines)
- src/game.ts (partial reads: lines 1-200, 470-530, 742-840, 1470-1590, 1630-1710, 1850-1930, plus grep results for prompts/puzzles/phases/arrow/death/exit)
- package.json (full, 28 lines)

## Appendix B. Commands run

- git rev-parse HEAD
- git log --oneline -25
- ls assets/audio/ (count: 86 files)
- ls src/*.ts (count: 40 files)
- npx tsc --noEmit (exit 0)
- npx vite build (exit 0, 532.75 kB / 153.59 kB gzipped)
- mkdir -p docs/diagnostic
- grep searches across game.ts for: updatePrompts, showPrompt, showSpritePrompt, guidance, computeArrowTargetX, isNearWhisperTrap, isNearTapeStation, openBreakerPuzzle, handleBreakerResult, handleWhisperResult, handleTapeResult, applyTapeReward, exitFinalChallenge, phase/GAMEOVER/DYING/WIN
