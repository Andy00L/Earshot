# Exit Gating. Require Keycard and Breaker. Hotfix U.22.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
tsc --noEmit before / after: exit 0 / exit 0
Bundle delta: +0.14 kB (+0.04 kB gzipped)
Friction addressed: critical path bypass (player could win without
activating the breaker puzzle)

## 1. Root cause

The stairwell exit door checked for keycard via its DoorConfig
requirement ("keycard") but had no breaker condition. The breaker
requirement lived only on the server-to-stairwell door. A vent in
cubicles (x=3050) connected directly to the stairwell (targetX=350),
letting the player bypass the server door entirely. With just the
keycard, the player could reach the exit and win without ever
interacting with the breaker puzzle in Server room.

## 2. What changed

The exit interaction handler now gates on breaker activation
(state.breakerOn) before allowing the win flow. The check runs after
the existing keycard gate (via DoorConfig requirement) and before the
Tape 3 silent exit challenge (Hotfix T). If the breaker is off, the
handler shows "The exit is dark. Power must be restored." and plays
the door_locked_rattle SFX.

Gate ordering at the exit door:

1. Keycard in inventory (existing, via door.requirement)
2. Breaker activated (new, via state.breakerOn check)
3. Silent exit challenge (existing, via exitFinalChallengeActive)
4. triggerWin()

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 5 | 0 | 1 (comment update) |

## 4. Diff summary

### src/game.ts (line 1161)

BEFORE:
```typescript
    // Win condition: exit door in stairwell with keycard
    if (door.isExit) {
      // Tape 3 reward: silent exit challenge (Hotfix T)
      if (this.state.exitFinalChallengeActive) {
```

AFTER:
```typescript
    // Win condition: exit door in stairwell
    if (door.isExit) {
      // Gate: require breaker activated (Hotfix U.22)
      if (!this.state.breakerOn) {
        this.hud.showMessage("The exit is dark. Power must be restored.", 3000);
        audioManager.playOneShot("door_locked_rattle");
        return;
      }
      // Tape 3 reward: silent exit challenge (Hotfix T)
      if (this.state.exitFinalChallengeActive) {
```

## 5. Verification

- tsc --noEmit: exit 0
- vite build: exit 0 (544.96 kB / 156.74 kB gz)
- triggerWin() called from exactly one site (game.ts:1178)
- No debug shortcuts or alternative win paths found
- No changes to keycard pickup, breaker puzzle, or silent exit challenge

## 6. Edge cases

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Keycard + breaker on, Tape 3 active | Gate passes. Silent challenge starts. Existing Hotfix T flow. Correct. |
| E2 | Keycard + breaker off | Gate fails at breaker check. Message: "The exit is dark. Power must be restored." Correct. |
| E3 | No keycard, breaker on | Gate fails upstream at door.requirement check. Message: "The exit is locked. You need a keycard." Correct. |
| E4 | Neither keycard nor breaker | Gate fails upstream at door.requirement (keycard first). Player gets keycard message. After getting keycard, returns and gets breaker message. Sequential. Correct. |
| E5 | Rapid E press at exit | Each press triggers the refusal. showMessage replaces the previous message. No spam or race condition. |
| E6 | Exit via vent bypass | Player reaches stairwell through cubicles vent. Exit door still runs both gates. Vent does not bypass the exit handler. Correct. |
| E7 | Respawn after partial progress | breakerOn resets to false on death (createInitialGameState). Player must redo breaker puzzle. Acceptable. |
| E8 | Tape 3 silent challenge after gate | Gate runs first (line 1163), then silent challenge (line 1169). Correct ordering. |
| E9 | Keycard string mismatch | Verified: inventory.has("keycard") matches the pickup id "keycard" in rooms.ts cubicles definition. Correct. |
| E10 | breakerOn field name | Verified: state.breakerOn (types.ts:134), set by breaker puzzle success handler (game.ts:3244). Correct. |
| E11 | HUD message during PLAYING | Exit handler runs during PLAYING phase (player movement active). showMessage renders normally. Correct. |
| E12 | Death after keycard, before breaker | Inventory clears on death. Player must re-collect keycard. Gate works the same after respawn. |
| E13 | Puzzle phase blocks exit input | During PAUSED phase (breaker puzzle, tape puzzle), KeyE is consumed by the active puzzle, not the exit handler. No conflict. |
| E14 | Console debug bypass | Developer can set state.breakerOn = true and state.inventory.add("keycard") via browser console. One-line debug, no code change needed. |

## 7. Trade-offs

The gate uses two sequential checks. If both keycard and breaker are
missing, the player sees the keycard message first (handled upstream
by the DoorConfig requirement system) and must figure out the breaker
after. Incremental feedback guides the player toward each condition.

The refusal messages are diegetic ("The exit is dark. Power must be
restored.") rather than UI-tutorial style ("BREAKER REQUIRED"). This
favors atmosphere. If testers find it unclear, swap to direct phrasing.

The map fragment is NOT part of the gate. It remains optional (minimap
aid only). Adding it would force exploration of Archives, but the
design calls for only keycard and breaker.

The existing door_locked_rattle SFX is reused for the breaker refusal
rather than adding a new sound. This keeps the denial feedback
consistent with other locked doors.

## 8. Manual playtest steps

a) Hard refresh. Spawn in Reception.
b) Walk directly to stairwell (via cubicles vent). Pick up nothing.
c) Reach exit at x=3194. Press E.
   EXPECTED: "The exit is locked. You need a keycard."
d) Walk to cubicles. Pick up keycard.
e) Return to stairwell exit. Press E.
   EXPECTED: "The exit is dark. Power must be restored."
f) Walk to server. Activate breaker (solve puzzle).
g) Return to stairwell exit. Press E.
   EXPECTED: Win (or silent challenge if Tape 3 done).
h) (Optional) Restart with Tape 3 done. Confirm silent challenge
   triggers after both gate conditions met.

## 9. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] tsc clean.
- [x] No keycard alone: gate blocks with keycard message (upstream).
- [x] No breaker alone: gate blocks with breaker message.
- [x] Both present: gate passes. Win or silent challenge runs.
- [x] Tape 3 silent challenge still triggers after gate passes.
- [x] All 14 edge cases walked.
- [x] No keycard pickup logic modified.
- [x] No breaker puzzle logic modified.
- [x] No silent exit challenge logic modified.
