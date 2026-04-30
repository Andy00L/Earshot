# Changelog

Detailed reports for each hotfix are in [docs/fixes/](fixes/).

## U.28. Scared animation fix
Wired SCARED_IDLE and SCARED_WALK into ANIM_DEFS with a periodic look-back interrupt for nervous walking near monsters.
## U.27. Sad ending cinematic
Replaced the plain win screen with a cinematic: fade to illustration, hold, stats screen with "YOU NEVER LEFT." Added CINEMATIC to GamePhase.
## U.26. Crouch mechanic
Holding CTRL sets mic gain to 0.2 via GainNode, making the crouching player nearly silent to the Listener.
## U.25. Run mechanic
Inserted a GainNode into the mic pipeline. SHIFT amplifies mic input 3x. Added RUN_STOP deceleration state.
## U.23. Locker hide sprite
Integrated locker-hide sprite into the atlas and player state machine for HIDING_LOCKER.
## U.22. Exit gating
Exit now requires both keycard and breaker, closing a vent-shortcut bypass.
## U.21. Whisper charm chroma fix
Fixed magenta chroma bleed on the whisper charm HUD icon.
## U.20. Whisper charm popup and icon
Added whisper charm explainer popup and inventory icon sprites to the atlas.
## U.19. Broken tape respawn fix
Reconstructed tapes no longer respawn after death.
## U.18. Trapdoor visibility fix
Made the sealed trapdoor sprite visible during normal gameplay, not just during the puzzle.
## U.17. Breaker SFX regeneration
Regenerated all breaker puzzle SFX that had gone silent since Hotfix R.
## U.16. Sprite label prompts
Replaced text labels with sprite-based labels (TUNE, REBUILD, WHISPER) on puzzle prompts.
## U.15. Back button for puzzles
Added a clickable BACK button to breaker and tape puzzle overlays.
## U.14. Tape volume indication
Tape fragments now play at decreasing volumes by position, turning the puzzle into a loud-to-quiet ordering task.
## U.13. Monster difficulty on fail
Listener gets a 40% speed boost and doubled dash probability for 8 seconds after a breaker puzzle failure.
## U.12. Breaker audio bug fix
Switched breaker puzzle audio from Howler to raw Web Audio API so it plays during the PAUSED phase.
## U.11. Tape 2 message fix
Changed the tape 2 reward text to "The recording is intact" since whisper radio mode was deferred.
## U.10. Tape wrong order message
Added a "Wrong order. Try again." message when tape fragments are submitted incorrectly.
## U.9. Silent exit reminder
Updated stairwell exit prompt to show "E EXIT (silent)" when the silent challenge is active.
## U.8. Materials cleanup
Removed four orphaned material pickups left over from crafting removal.
## U.7. Prompt overlap fix
Moved a desk hiding spot to stop its prompt from overlapping the whisper trapdoor prompt.
## U.6. Broken tape distinction
Added an orange runtime tint to broken tape pickups so they look different from lore tapes.
## U.5. Workbench affordance
Verified the workbench PulseRing was already configured correctly. No code changes.
## U.4. Trapdoor sprite and audio
Added a visible sprite and audio cue to the whisper trapdoor in Archives.
## U.3. PulseRing affordance
Built a reusable PulseRing class for pulsing circle animations on interactable props.
## U.2. Prompt copy rewrite
Rewrote puzzle interaction labels from DECIPHER/LISTEN/PLAY TAPE to TUNE/WHISPER/REBUILD.
## U.1. Arrow priority extended
Guidance arrow stays visible after map fragment pickup, pointing toward tapes, station, and trapdoor.
## U.0bis. Path A sprite swaps
Applied atlas sprite swaps for puzzle props using the puzzle-props namespace.
## U.0. Atlas integration
Integrated three new puzzle prop sprites into the atlas using flat dict pattern and green chroma pipeline.
## T. Tape reconstruction station
Built the tape puzzle at the Reception workbench. Three broken tapes with four shuffled audio fragments each. Rewards: minimap threat markers, silent exit challenge.
## S. Whisper lock minigame
Sealed trapdoor in Archives opens when the player whispers a phrase. ElevenLabs TTS generates the challenge line.
## R. Audio match breaker puzzle
Four labeled sound clips at the breaker switch. Pick the correct one. Wrong answers trigger Listener aggression.
## Q. Crafting removal
Stripped all crafting interaction code. Workbench, recipes, material-to-tool pipeline removed. Dormant files kept.
## P. Jumper lunge impact
Added a 40 Hz sub-bass sine wave and 50ms frame freeze on floor jumper lunge.
## O. Floor jumper audio and VFX
Generated five floor jumper SFX via ElevenLabs. Added screen shake and vignette flash on jumper events.
## N. Wall vent z-order fix
Lowered wall vent grate from zIndex 75 to 25 so it renders behind the player.
## M. Room layout spacing
Audited element spacing across all five rooms. Moved 15 of 21 crowded pairs to minimum 84px separation.
## L. Loot bag resize
Shrunk the loot bag sprite from 220px to 143px so it reads as a dropped item.
## K. Floor jumper vent x-drift fix
Fixed a per-tick x-position drift of up to 216px on floor jumper containers.
## J. Floor jumper visual resize
Resized floor jumper sprites with per-state width caps for environmental coherence.
## I-bis. Floor jumper visual state fix
Fixed width inflation on getup frames and corrected zIndex for fake_attacking state.
