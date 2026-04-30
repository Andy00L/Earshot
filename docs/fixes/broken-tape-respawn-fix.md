# Broken Tape Respawn Fix. Hotfix U.19.

Commit at start: 2ce4720
Build before / after: exit 0 / exit 0
Bundle before / after: 541.76 kB (155.86 kB gz) / 541.81 kB (155.86 kB gz)
Bundle delta: +0.05 kB (+0.00 kB gzipped)
Friction addressed: gameplay clarity (reconstructed tapes respawning
after death is misleading)

## 1. What changed

The pickup spawn loop in `createPickups()` now skips broken tape entries
whose ids exist in `state.tapesReconstructed`. One line added to the
existing skip predicate block. Lore tapes, keycard, breaker switch, and
map fragment are unaffected.

## 2. Root cause

`createPickups()` (game.ts:1548) iterates the room's pickup config and
creates a `Pickup` instance for each. Two skip predicates existed:

1. Non-toggle pickups in `state.inventory` (skips keycard, materials)
2. Lore tapes in `state.tapesCollected` (persists across deaths)

Broken tapes use a separate collection mechanism: they are added to
`state.brokenTapesCollected` on pickup (not `state.inventory`), and
moved to `state.tapesReconstructed` on successful reconstruction.
Neither Set was checked during pickup spawning.

On death, `tapesReconstructed` persists (never cleared in the respawn
flow). But `createPickups()` had no check for it, so the broken tape
pickup respawned regardless of reconstruction status. The pickup
handler at line 1048 handled re-pickup silently (collected without
message), but the visible sprite in the room was misleading.

## 3. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/game.ts | 2 | 0 | 0 |

## 4. Diff summary

### src/game.ts - createPickups()

BEFORE (lines 1551-1554):
```typescript
      // Skip collected non-toggle pickups
      if (!pc.togglesTo && this.state.inventory.has(pc.id)) continue;
      // Skip collected lore tapes (persist across deaths)
      if (isLoreTapeId(pc.id) && this.state.tapesCollected.has(pc.id)) continue;
```

AFTER:
```typescript
      // Skip collected non-toggle pickups
      if (!pc.togglesTo && this.state.inventory.has(pc.id)) continue;
      // Skip collected lore tapes (persist across deaths)
      if (isLoreTapeId(pc.id) && this.state.tapesCollected.has(pc.id)) continue;
      // Skip reconstructed broken tapes (persist across deaths)
      if (this.state.tapesReconstructed.has(pc.id as TapeId)) continue;
```

The `as TapeId` cast is safe: `Set.has()` returns false for any string
not in the Set. Non-tape pickup ids ("keycard", "breaker_switch", etc.)
pass through without matching. `TapeId` is already imported at
game.ts:68.

## 5. Verification

- tsc --noEmit: exit 0
- vite build: exit 0 (4.68s)
- Only one `new Pickup` instantiation in the codebase (game.ts:1558
  inside `createPickups()`). No other spawn paths to patch.

Phase 2 (no other spawn path): confirmed via `grep -n "new Pickup"` across
src/. Single call site in `createPickups()`. Both `transitionToRoom()`
(line 1413) and `respawnAtReception()` (line 1861) call `createPickups()`.

Phase 3 (within-run removal): broken tape pickup calls `pickup.collect()`
at line 1049/1052, which sets `collected = true` and `sprite.visible = false`.
Pickup is removed from interaction. Within a single life, collected pickups
do not respawn. The bug was only after death/respawn.

## 6. Edge cases (E1-E10)

| # | Edge case | Status |
|---|-----------|--------|
| E1 | Picked up but not reconstructed, then die | Pass. `tapesReconstructed` does not contain the tape. Pickup respawns. Player re-collects. |
| E2 | Tape 01 reconstructed, die, tape 02 not | Pass. Only tape 01 skipped. Tape 02/03 spawn normally. |
| E3 | All 3 reconstructed | Pass. All 3 ids in `tapesReconstructed`. None spawn in any room. |
| E4 | Pickup id casing | Pass. Both rooms.ts and TapeId use snake_case. Exact string match. |
| E5 | TapeId type cast | Pass. `Set.has()` returns false for non-matching strings. No false positives. |
| E6 | Performance | Pass. One `Set.has()` per pickup per room init. Negligible. |
| E7 | Save persistence | Pass. No save system. `tapesReconstructed` persists within a run. |
| E8 | HMR stale state | N/A for production. Dev mode may keep stale Sets. |
| E9 | Reconstruct then die: reward preserved | Pass. Rewards apply at reconstruction time. Death does not revoke minimap markers or silent exit flag. |
| E10 | Skip predicate vs pickup handler | Pass. The skip prevents instantiation entirely. The pickup handler (line 1048) is a fallback for edge cases where the sprite somehow exists. Both paths agree. |

## 7. Trade-offs

The skip is at spawn time. The broken tape pickup is never created,
never added to `this.pickups`, never added to the world container. No
alpha hacks or visibility flags. Clean skip.

The `as TapeId` cast is type-level only. It does not narrow at runtime.
`Set.has()` performs a strict equality check. If a non-TapeId string is
passed, the Set returns false. The cast exists to satisfy TypeScript's
type checker because `pc.id` is `PickupId` (a wider union) and the Set
expects `TapeId`. No runtime risk.

The 3 tape ids are implicitly encoded in the `TapeId` type and the
`tapesReconstructed` Set. If a future hotfix adds `broken_tape_04`, it
must extend `TapeId` and add the id to the reconstruction flow. The
skip predicate requires no changes because it checks the Set directly.

## 8. Manual playtest steps

1. Pick up broken_tape_01 in cubicles (x=2100).
2. Walk to Reception workbench. Reconstruct tape 1.
3. Confirm reward: minimap threat markers appear.
4. Die (let the Listener catch you).
5. Respawn in Reception.
6. Walk to cubicles. Confirm: NO broken_tape_01 at x=2100.
7. Walk to server. Confirm: broken_tape_02 still at x=1100.
8. Walk to stairwell. Confirm: broken_tape_03 still at x=1900.
9. Reconstruct tapes 2 and 3. Die again.
10. Walk through all rooms. Confirm: no broken tape pickups anywhere.

## 9. Self-check

- [x] No em dashes.
- [x] Build green (tsc + vite exit 0).
- [x] All 10 edge cases walked.
- [x] Reconstructed tapes do not respawn after death.
- [x] Unreconstructed tapes still respawn correctly.
- [x] Lore tapes, keycard, breaker switch, map fragment unaffected.
- [x] No tape puzzle internals modified.
- [x] No tapesReconstructed persistence behavior changed.
- [x] No commit.
