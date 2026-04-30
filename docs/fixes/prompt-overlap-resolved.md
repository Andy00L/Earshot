# Prompt Overlap Resolution. Hotfix U.7.

Commit at start: 2ce47201ffd982cfa815193630ff4f1e9121f8d3
Branch: main
Build before / after: exit 0 / exit 0
Bundle size delta: 0 (single number change)
Friction addressed: F15 (MEDIUM), F17 (HIGH)

## 1. What changed

The desk hiding spot in Archives moved from x=1500 to x=1700. The
whisper trapdoor at x=1500 shares the same position, and the prompt
priority chain shows "E HIDE" before "E WHISPER". A player standing
at x=1500 saw only the hide prompt and could not discover the trapdoor.
After the move, the two trigger zones are 80px apart with no overlap.

The originally proposed x=1800 was rejected because lore tape_04
occupies that position (rooms.ts archives pickups). x=1700 provides
200px center distance from the trapdoor and 100px from tape_04.

## 2. Files changed

| File | Lines added | Lines removed | Lines modified |
|------|-------------|---------------|----------------|
| src/rooms.ts | 0 | 0 | 1 |

## 3. Diff summary

BEFORE (rooms.ts archives hidingSpots):
```typescript
      { id: "desk_arch_1", kind: "desk", x: 1500, y: 708, triggerWidth: 80 },
```

AFTER:
```typescript
      { id: "desk_arch_1", kind: "desk", x: 1700, y: 708, triggerWidth: 80 },
```

No game.ts changes. The hiding spot position is read dynamically from
the rooms config by getNearestHidingSpot (game.ts:2453) and
isPlayerInRange (hiding.ts:28). No hardcoded x=1500 reference exists
for the desk.

## 4. Spacing verification

Archives interactable positions after move:

| Element | x | Trigger half-width | Trigger zone |
|---------|---|--------------------|--------------|
| Door | 200 | 100 (door range) | [100, 300] |
| tape_05 | 500 | 100 (pickupRange) | [400, 600] |
| Battery | 1100 | 100 (pickupRange) | [1000, 1200] |
| Whisper trap | 1500 | 80 (WHISPER_TRAP_RANGE) | [1420, 1580] |
| Desk (moved) | 1700 | 40 (triggerWidth/2) | [1660, 1740] |
| tape_04 | 1800 | 100 (pickupRange) | [1700, 1900] |
| Map fragment | 2000 | 100 (pickupRange) | [1900, 2100] |

Pairwise distances for moved desk:

| Pair | Center dist | Trigger gap | Overlap? |
|------|-------------|-------------|----------|
| Whisper trap to desk | 200 | 80 px | No |
| Desk to tape_04 | 100 | 0 (40px overlap at [1700,1740]) | Minor |
| Desk to map fragment | 300 | 160 px | No |

The desk-to-tape_04 overlap is 40px. In that zone the hide prompt has
priority (checked first in the prompt chain). The player picks up
tape_04 by walking to x>1740 (outside desk trigger, inside tape
pickupRange). This is a minor UX tradeoff. No lore content is blocked.

## 5. Verification

- tsc --noEmit: exit 0
- vite build: exit 0, 4.66s
- Archives has no Listener (hasMonster: false). No patrol range concern.

| # | Edge case | Result |
|---|-----------|--------|
| E1 | Exit desk, trapdoor prompt | Player at x=1700 post-exit. Trapdoor at 1500 is 200px away, outside trigger. Walk left to reach it. Correct separation. |
| E2 | Listener patrol | Archives has no Listener. Safe. |
| E3 | Desk overlaps another prop | tape_04 at 1800. 40px trigger overlap. Hide prompt takes priority in overlap zone. tape_04 accessible at x>1740. |
| E4 | Background art mismatch | Archives background may show desk at old position. Acceptable; gameplay clarity over background fidelity. |
| E5 | Trapdoor + desk visual | Trapdoor at 1415-1585 (est), desk at 1660-1740. 75px visual gap. Distinct. |
| E6 | Respawn re-enters archives | Desk at 1700 on all visits. Config-driven. |
| E7 | Hide animation at new x | Animation logic is position-independent. Safe. |
| E8 | Map fragment not blocked | Desk at 1700, map at 2000. Player walks through desk (not a wall). |
| E9 | Bundle size | Zero delta. |
| E10 | No save persistence | Rooms rebuilt from config every session. |

## 6. Trade-offs

The desk at x=1700 introduces a 40px trigger overlap with lore tape_04
at x=1800. This is a downgrade from zero overlap at the original x=1500
(where the desk had no tape neighbor). But the original position caused
a HIGH friction (F17) by completely blocking the trapdoor prompt.
Trading a total prompt block for a 40px priority zone where hide
beats lore-tape pickup is a clear improvement.

x=1800 was rejected because tape_04 occupies that exact position.
x=1300 was considered (clean spacing between battery at 1100 and trap
at 1500) but places the desk leftward, farther from the room's
interactive area. x=1700 keeps the desk near the action zone where
the player is already exploring for the trapdoor and map fragment.

## 7. Manual playtest steps

1. Walk to Archives. Approach x=1500 (trapdoor). Confirm "E WHISPER"
   prompt appears. No "E HIDE" visible.
2. Walk to x=1700. Confirm "E HIDE" prompt appears. Press E to hide.
3. Exit desk. Walk to x=1800. Confirm lore tape pickup prompt appears.
4. Walk to x=2000. Confirm map fragment pickup prompt.
5. Walk back to x=1500. Confirm "E WHISPER" prompt still works.
6. Die. Respawn. Re-enter Archives. Confirm desk is at x=1700.

## 8. Self-check

- [x] No em dashes.
- [x] Build green.
- [x] Spacing verified (trigger gap table above).
- [x] No Listener patrol range broken (no Listener in Archives).
- [x] Desk visual not overlapping trapdoor or map fragment.
- [x] Whisper trap unaffected (x=1500, trigger [1420,1580]).
- [x] Map fragment unaffected (x=2000, trigger [1900,2100]).
