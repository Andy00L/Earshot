# Silent Exit Reminder. Hotfix U.9.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: +0.10 kB (+0.04 kB gz)
Friction addressed: F8 (MEDIUM)

## 1. What changed

The stairwell exit door prompt now reads "E  EXIT (silent)" when the
silent exit challenge (Tape 3 reward) is active. When the challenge is
not active, the prompt shows the standard sprite-based "E INTERACT" as
before. The door open logic, mic RMS check, and "Too loud. Approach in
silence." failure message are all unchanged.

The problem: after completing Tape 3 at the workbench, the player sees
a HUD message "Recording restored. The exit listens for silence." This
message disappears after 4 seconds. The player may reach the stairwell
exit many minutes later, having forgotten the requirement. The
"(silent)" qualifier on the approach prompt serves as an in-context
reminder at the moment the player is about to interact.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 4 | 1 | 1 |

## 3. Diff summary

BEFORE (game.ts, door prompt section):
```typescript
    // Door prompt
    const door = this.rooms.getNearbyDoor(this.player.x);
    if (door) {
      this.hud.showSpritePrompt("key-e", "label-interact");
      return;
    }
```

AFTER:
```typescript
    // Door prompt (silent exit qualifier when Tape 3 challenge is active)
    const door = this.rooms.getNearbyDoor(this.player.x);
    if (door) {
      if (door.isExit && this.state.exitFinalChallengeActive) {
        this.hud.showPrompt("E  EXIT (silent)");
      } else {
        this.hud.showSpritePrompt("key-e", "label-interact");
      }
      return;
    }
```

The exit case uses hud.showPrompt (text) because no sprite label exists
for "exit-silent." All other doors continue to use the sprite-based
prompt. The double-space in "E  EXIT" matches the text prompt style
used by Hotfix U.2 prompts (E  TUNE, E  WHISPER, E  REBUILD).

The door interaction handler (game.ts:1126-1138) is completely
unchanged. The RMS check, threshold, failure message, and win trigger
remain as implemented in Hotfix T.

## 4. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.32s

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Approach exit loud with challenge active | Prompt says "(silent)". Player presses E. "Too loud." message. Door stays closed. Existing behavior. |
| E2 | Die after tape 3, respawn | exitFinalChallengeActive persists (tapesReconstructed persists). Prompt still shows "(silent)". |
| E3 | Use charm then approach exit | Charm does not affect exitFinalChallengeActive. Prompt persists. |
| E4 | Pre-tape-3 exit approach | Flag is false. Prompt shows standard "E INTERACT" via sprite. |
| E5 | Prompt text fits HUD | "E  EXIT (silent)" is 16 chars. HUD auto-sizes (hud.ts:252). Fits. |
| E6 | Higher-priority prompt active | Door prompt is last in priority chain. Only fires when no other prompt applies. Same as before. |
| E7 | English-only | No i18n concern. |
| E8 | Bundle size | +0.04 kB gz. Trivial. |

## 5. Trade-offs

The "(silent)" qualifier is a minimal text cue. A more prominent
approach (e.g., a colored prompt background, a pulsing icon, or a
distinct sound on approach) would communicate stronger but adds scope
beyond a copy change. The text cue is sufficient: players who read
the prompt before pressing E will notice the qualifier. Players who
skip reading prompts will still hit the "Too loud" failure message,
which is the existing fallback behavior.

The exit prompt switches from sprite-based (showSpritePrompt) to
text-based (showPrompt) when the silent challenge is active. This
creates a minor visual inconsistency between the exit prompt and other
door prompts. The text style matches U.2's puzzle prompts (E TUNE,
E WHISPER, E REBUILD), so the inconsistency is within the established
pattern for conditional prompts.

## 6. Manual playtest steps

1. Start a run. Walk to stairwell exit. Confirm prompt shows
   "E INTERACT" (standard sprite prompt, no challenge active).
2. Collect all 3 broken tapes. Reconstruct tape 3 at the workbench.
   Confirm "Recording restored. The exit listens for silence." message.
3. Walk to stairwell exit. Confirm prompt reads "E  EXIT (silent)".
4. Press E while speaking normally. Confirm "Too loud. Approach in
   silence." rejection message.
5. Approach again in silence. Press E. Confirm door opens and win
   triggers.
6. Die before reaching exit (after tape 3). Respawn. Walk to exit.
   Confirm "(silent)" qualifier still appears.

## 7. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] All 8 edge cases walked.
- [x] Door open logic unchanged.
- [x] Mic calibration unchanged.
- [x] Tape station internals unchanged.
