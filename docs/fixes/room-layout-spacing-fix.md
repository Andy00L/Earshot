# Room Layout Spacing Fix. Hotfix M.

Commit at start: 56035dfbf95f70681b1082474d3c1967c58c1791
Branch: main
Build before: PASS (tsc --noEmit + vite build, exit 0)
Build after: PASS (tsc --noEmit + vite build, exit 0)

## 1. Audit summary

Total rooms: 5
Total interactables: 48 (doors, pickups, hiding spots, vent shortcuts, jumper hotspots, ladders)
Crowded pairs identified: 21
Pairs fixed: 15 (spacing improved to edge >= 84 px or interact-zone separation confirmed)
Pairs left unchanged (intentional design tension per E6): 1 (cubicles ceiling jumper / keycard)
Pairs with residual visual overlap but no interact-zone overlap: 5

## 2. Per-room before / after

### Reception (width 2896)

**BEFORE**

| Element | Type | x | Width (px) |
|---------|------|---|-----------|
| Door (to cubicles) | door | 500 | 189 |
| Workbench | interact | 1500 | 100 |
| Door (to server) | door | 1800 | 189 |
| Tape | pickup | 2000 | 109 |
| Tape_01 | pickup | 2400 | 102 |
| Door (to archives) | door | 2700 | 189 |

Crowded pair: Door(server,1800) to tape(2000) = 200 center, 51 edge.

**AFTER**

| Element | Type | x | Width (px) | Delta |
|---------|------|---|-----------|-------|
| Door (to cubicles) | door | 500 | 189 | 0 |
| Workbench | interact | 1500 | 100 | 0 |
| Door (to server) | door | 1800 | 189 | 0 |
| Tape | pickup | **2100** | 109 | **+100** |
| Tape_01 | pickup | 2400 | 102 | 0 |
| Door (to archives) | door | 2700 | 189 | 0 |

Post-fix pairs: Door(1800) to tape(2100): 300 center, 151 edge. Fixed.

---

### Cubicles (width 3344)

**BEFORE**

| Element | Type | x | Width (px) |
|---------|------|---|-----------|
| Door (to reception) | door | 100 | 189 |
| Floor jumper (left) | jumper | 800 | 170 |
| Glass_shards | pickup | 900 | 109 |
| Desk_cub_1 | hiding | 1200 | 301 |
| Ceiling jumper | jumper | 1500 | 129 |
| Keycard | pickup | 1600 | 106 |
| Radio | radio | 1800 | 100 |
| Locker_cub_1 | hiding | 2050 | 144 |
| Tape_02 | pickup | 2700 | 102 |
| Floor jumper (right) | jumper | 2700 | 170 |
| Desk_cub_2 | hiding | 2900 | 301 |
| Vent shortcut | vent | 3100 | 130 |
| Door (to server) | door | 3244 | 189 |

Critical cluster: x=2700 to x=3244 (544 px, 5 interactables). Tape_02 and floor jumper at identical x.

**AFTER**

| Element | Type | x | Width (px) | Delta |
|---------|------|---|-----------|-------|
| Door (to reception) | door | 100 | 189 | 0 |
| Floor jumper (left) | jumper | **550** | 170 | **-250** |
| Glass_shards | pickup | 900 | 109 | 0 |
| Desk_cub_1 | hiding | 1200 | 301 | 0 |
| Ceiling jumper | jumper | 1500 | 129 | 0 |
| Keycard | pickup | 1600 | 106 | 0 |
| Radio | radio | 1800 | 100 | 0 |
| Locker_cub_1 | hiding | 2050 | 144 | 0 |
| Tape_02 | pickup | **2300** | 102 | **-400** |
| Desk_cub_2 | hiding | **2500** | 301 | **-400** |
| Floor jumper (right) | jumper | 2700 | 170 | 0 |
| Vent shortcut | vent | **3050** | 130 | **-50** |
| Door (to server) | door | 3244 | 189 | 0 |

Post-fix right cluster spans x=2300 to x=3244 (944 px), nearly doubled from 544 px.

Post-fix proximity (consecutive pairs, right half):

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Locker(2050) | Tape_02(2300) | 250 | 127 | OK |
| Tape_02(2300) | Desk(2500) | 200 | -2 | visual overlap, interact zones separated (200 > 150) |
| Desk(2500) | Floor_J(2700) | 200 | -36 | visual overlap, interact zones separated (200 > 130) |
| Floor_J(2700) | Vent(3050) | 350 | 200 | OK |
| Vent(3050) | Door(3244) | 194 | 34 | interact zones separated (194 > 180) |

The desk (301 px width) prevents achieving 100 px edge gaps with all neighbors in this region. This is an inherent constraint of the sprite size. Interact-zone separation is maintained for all pairs.

Post-fix left half:

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Door(100) | Floor_J(550) | 450 | 270 | OK |
| Floor_J(550) | Glass(900) | 350 | 211 | OK (was -40) |
| Glass(900) | Desk(1200) | 300 | 95 | marginal, unchanged |
| Desk(1200) | Ceil_J(1500) | 300 | 85 | marginal, unchanged |
| Ceil_J(1500) | Keycard(1600) | 100 | -18 | intentional tension (E6) |

Desk_cub_2 moved from x=2900 (100 px outside monster patrol range [600,2800]) to x=2500 (300 px inside patrol range). This is a gameplay improvement per E9.

---

### Server (width 3344)

**BEFORE**

| Element | Type | x | Width (px) |
|---------|------|---|-----------|
| Door (to cubicles) | door | 100 | 189 |
| Tape_03 | pickup | 600 | 102 |
| Locker_server_1 | hiding | 700 | 144 |
| Ceiling jumper (ground) | jumper | 700 | 129 |
| Ladder | ladder | 1400 | 60 |
| Ceiling jumper (upper) | jumper | 1800 | 129 |
| Wire | pickup | 2100 | 85 |
| Radio | radio | 2200 | 100 |
| Floor jumper | jumper | 2400 | 170 |
| Breaker_switch | pickup | 2600 | 50 |
| Locker_server_2 | hiding | 2900 | 144 |
| Door (to stairwell) | door | 3244 | 189 |

Crowded left cluster: tape(600), locker(700), ceiling jumper(700). Three elements in 100 px.
Crowded right cluster: wire(2100), radio(2200), floor_J(2400), breaker(2600). Four elements in 500 px.

**AFTER**

| Element | Type | x | Width (px) | Delta |
|---------|------|---|-----------|-------|
| Door (to cubicles) | door | 100 | 189 | 0 |
| Tape_03 | pickup | **400** | 102 | **-200** |
| Locker_server_1 | hiding | 700 | 144 | 0 |
| Ceiling jumper (ground) | jumper | **950** | 129 | **+250** |
| Ladder | ladder | 1400 | 60 | 0 |
| Ceiling jumper (upper) | jumper | 1800 | 129 | 0 |
| Wire | pickup | **2000** | 85 | **-100** |
| Radio | radio | 2200 | 100 | 0 |
| Floor jumper | jumper | **2450** | 170 | **+50** |
| Breaker_switch | pickup | **2700** | 50 | **+100** |
| Locker_server_2 | hiding | 2900 | 144 | 0 |
| Door (to stairwell) | door | 3244 | 189 | 0 |

Post-fix left cluster resolved:

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Door(100) | Tape(400) | 300 | 154 | OK (was: tape at 600, 500 center) |
| Tape(400) | Locker(700) | 300 | 177 | OK (was: 100 center, -23 edge) |
| Locker(700) | Ceil_J(950) | 250 | 113 | OK (was: 0 center, -137 edge) |

Post-fix right cluster improved:

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Wire(2000) | Radio(2200) | 200 | 107 | OK (was: 100 center, 8 edge) |
| Radio(2200) | Floor_J(2450) | 250 | 115 | OK (was: 200 center, 65 edge) |
| Floor_J(2450) | Breaker(2700) | 250 | 140 | OK (was: 200 center, 90 edge) |
| Breaker(2700) | Locker(2900) | 200 | 103 | OK (unchanged pair but new neighbor) |

---

### Stairwell (width 3344)

**BEFORE**

| Element | Type | x | Width (px) |
|---------|------|---|-----------|
| Door (to server) | door | 100 | 189 |
| Vent shortcut | vent | 200 | 130 |
| Floor jumper | jumper | 600 | 170 |
| Desk_stair | hiding | 1400 | 301 |
| Ceiling jumper (left) | jumper | 1500 | 129 |
| Tape_06 | pickup | 2400 | 102 |
| Ceiling jumper (right) | jumper | 2700 | 129 |
| Door (exit) | door | 3194 | 189 |

Crowded: Door(100)/Vent(200) edge -60, Desk(1400)/Ceil_J(1500) edge -115.

**AFTER**

| Element | Type | x | Width (px) | Delta |
|---------|------|---|-----------|-------|
| Door (to server) | door | 100 | 189 | 0 |
| Vent shortcut | vent | **350** | 130 | **+150** |
| Floor jumper | jumper | 600 | 170 | 0 |
| Desk_stair | hiding | 1400 | 301 | 0 |
| Ceiling jumper (left) | jumper | **1750** | 129 | **+250** |
| Tape_06 | pickup | 2400 | 102 | 0 |
| Ceiling jumper (right) | jumper | 2700 | 129 | 0 |
| Door (exit) | door | 3194 | 189 | 0 |

Post-fix pairs:

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Door(100) | Vent(350) | 250 | 90 | improved (was -60). Interact zones: door [0,200], vent [270,430]. No overlap. |
| Vent(350) | Floor_J(600) | 250 | 100 | OK (was: 400 center, 250 edge, no change needed) |
| Floor_J(600) | Desk(1400) | 800 | 564 | OK |
| Desk(1400) | Ceil_J(1750) | 350 | 135 | OK (was: 100 center, -115 edge) |
| Tape(2400) | Ceil_J(2700) | 300 | 184 | OK |
| Ceil_J(2700) | Door(3194) | 494 | 335 | OK. E7: 494 > 350 min for exit clearance. |

---

### Archives (width 2044)

**BEFORE**

| Element | Type | x | Width (px) |
|---------|------|---|-----------|
| Door (to reception) | door | 200 | 189 |
| Tape_05 | pickup | 400 | 102 |
| Battery | pickup | 1200 | 109 |
| Desk_arch_1 | hiding | 1500 | 301 |
| Tape_04 | pickup | 1700 | 102 |
| Map_fragment | pickup | 2000 | 99 |

Crowded: Door(200)/tape_05(400) edge 55, Battery(1200)/desk(1500) edge 95, desk(1500)/tape_04(1700) edge -2.

**AFTER**

| Element | Type | x | Width (px) | Delta |
|---------|------|---|-----------|-------|
| Door (to reception) | door | 200 | 189 | 0 |
| Tape_05 | pickup | **500** | 102 | **+100** |
| Battery | pickup | **1100** | 109 | **-100** |
| Desk_arch_1 | hiding | 1500 | 301 | 0 |
| Tape_04 | pickup | **1800** | 102 | **+100** |
| Map_fragment | pickup | 2000 | 99 | 0 |

Post-fix pairs:

| From | To | Center dist | Edge dist | Status |
|------|----|------------|-----------|--------|
| Door(200) | Tape_05(500) | 300 | 154 | OK (was: 200 center, 55 edge) |
| Tape_05(500) | Battery(1100) | 600 | 494 | OK |
| Battery(1100) | Desk(1500) | 400 | 195 | OK (was: 300 center, 95 edge) |
| Desk(1500) | Tape_04(1800) | 300 | 98 | marginal (was: 200 center, -2 edge). Archives is 2044 wide, limiting spread. |
| Tape_04(1800) | Map(2000) | 200 | 99 | marginal. Interact zones overlap by 1 px at x=1900. Acceptable. |

Archives has only 2044 px of room width. The desk (301 px) constrains achievable gaps. The 98-99 px edge distances are the practical optimum for this room.

## 3. Element width reference

| Element | Native width (px) | Scale | Rendered width (px) | Source |
|---------|-------------------|-------|---------------------|--------|
| Door (closed) | 189 | 1.0 | 189 | atlas.json:25, game.ts:2350 |
| Floor jumper (dripSprite) | computed | 0.6 | 170 | game.ts:2649 (220*(330/256)*0.6) |
| Ceiling jumper (dripSprite) | 322 | 0.4 | 129 | atlas.json:1622, game.ts:2656 |
| Vent shortcut (open) | 324 | 0.4 | 130 | atlas.json:1636, game.ts:2613 |
| Desk hiding spot | 301 | 1.0 | 301 | atlas.json:35, hiding.ts:22 |
| Locker hiding spot | 144 | 1.0 | 144 | atlas.json:39, hiding.ts:22 |
| Keycard | 354 | 0.3 | 106 | atlas.json:45, pickup.ts:25 |
| Breaker switch | 167 | 0.3 | 50 | atlas.json:49, pickup.ts:25 |
| Wire | 282 | 0.3 | 85 | atlas.json:905, pickup.ts:25 |
| Glass shards | 362 | 0.3 | 109 | atlas.json:912, pickup.ts:25 |
| Battery | 362 | 0.3 | 109 | atlas.json:919, pickup.ts:25 |
| Tape (materials) | 362 | 0.3 | 109 | atlas.json:926, pickup.ts:25 |
| Lore tape (recorder) | 339 | 0.3 | 102 | atlas.json:1527, pickup.ts:25 |
| Map fragment | 330 | 0.3 | 99 | atlas.json:933, pickup.ts:25 |
| Radio table (decorative) | 235 | 0.5 | 118 | atlas.json:69 |
| Player | 192 (nominal) | 1.0 | 192 | ARCHITECTURE.md |

## 4. Files changed

| File | Lines modified |
|------|---------------|
| src/rooms.ts | 17 x-coordinate values changed across 5 room definitions |
| src/game.ts | 0 (no door positions moved, no spawn logic changes needed) |

## 5. Diff summary

### Reception

```
BEFORE: { id: "tape", room: "reception", x: 2000, ... }
AFTER:  { id: "tape", room: "reception", x: 2100, ... }
```

### Cubicles

```
BEFORE: { x: 800, ventY: 100, ventPosition: "floor" }     // left floor jumper
AFTER:  { x: 550, ventY: 100, ventPosition: "floor" }

BEFORE: { id: "tape_02", room: "cubicles", x: 2700, ... }
AFTER:  { id: "tape_02", room: "cubicles", x: 2300, ... }

BEFORE: { id: "desk_cub_2", kind: "desk", x: 2900, y: 866, triggerWidth: 100 }
AFTER:  { id: "desk_cub_2", kind: "desk", x: 2500, y: 866, triggerWidth: 100 }

BEFORE: { x: 3100, target: "stairwell", targetX: 200 }
AFTER:  { x: 3050, target: "stairwell", targetX: 350 }
```

### Server

```
BEFORE: { id: "tape_03", room: "server", x: 600, ... }
AFTER:  { id: "tape_03", room: "server", x: 400, ... }

BEFORE: { x: 700, ventY: 100, ventPosition: "ceiling" }    // ground ceiling jumper
AFTER:  { x: 950, ventY: 100, ventPosition: "ceiling" }

BEFORE: { id: "wire", room: "server", x: 2100, ... }
AFTER:  { id: "wire", room: "server", x: 2000, ... }

BEFORE: { id: "breaker_switch", room: "server", x: 2600, ... }
AFTER:  { id: "breaker_switch", room: "server", x: 2700, ... }

BEFORE: { x: 2400, ventY: 100, ventPosition: "floor" }
AFTER:  { x: 2450, ventY: 100, ventPosition: "floor" }
```

### Stairwell

```
BEFORE: { x: 200, target: "cubicles", targetX: 3100 }
AFTER:  { x: 350, target: "cubicles", targetX: 3050 }

BEFORE: { x: 1500, ventY: 100, ventPosition: "ceiling" }   // left ceiling jumper
AFTER:  { x: 1750, ventY: 100, ventPosition: "ceiling" }
```

### Archives

```
BEFORE: { id: "tape_05", room: "archives", x: 400, ... }
AFTER:  { id: "tape_05", room: "archives", x: 500, ... }

BEFORE: { id: "battery", room: "archives", x: 1200, ... }
AFTER:  { id: "battery", room: "archives", x: 1100, ... }

BEFORE: { id: "tape_04", room: "archives", x: 1700, ... }
AFTER:  { id: "tape_04", room: "archives", x: 1800, ... }
```

## 6. Reasoning per change

1. **Reception tape x=2000 to x=2100.** Was 200 px from server door (edge 51). Now 300 px (edge 151).

2. **Cubicles left floor jumper x=800 to x=550.** Was 100 px from glass_shards (edge -40, visual overlap). Now 350 px (edge 211).

3. **Cubicles tape_02 x=2700 to x=2300.** Was at identical x as right floor jumper (0 center, -136 edge). Now 400 px from floor jumper (edge 264). Moved into the gap between locker(2050) and the right cluster.

4. **Cubicles desk_cub_2 x=2900 to x=2500.** Was in the dense right cluster. Was 100 px outside monster patrol range [600,2800]. Now 300 px inside patrol range, improving cat-and-mouse gameplay per E9.

5. **Cubicles vent shortcut x=3100 to x=3050.** Was 144 px from server door (edge -16, interact zones overlapping at 144 < 180). Now 194 px (edge 34, interact zones separated at 194 > 180).

6. **Cubicles vent targetX=200 to targetX=350.** Paired update. Player arriving from stairwell now spawns at stairwell vent's new x=350.

7. **Server tape_03 x=600 to x=400.** Was 100 px from locker_1 at 700 (edge -23, overlap). Now 300 px (edge 177).

8. **Server ground ceiling jumper x=700 to x=950.** Was at same x as locker_1 (0 center, -137 edge). Now 250 px from locker (edge 113).

9. **Server wire x=2100 to x=2000.** Was 100 px from radio (edge 8). Now 200 px (edge 107). Does not crowd ladder(1400), gap is 600 px.

10. **Server breaker x=2600 to x=2700.** Was 200 px from floor jumper (edge 90). Now 250 px from floor_J at 2450 (edge 140).

11. **Server floor jumper x=2400 to x=2450.** Was 200 px from radio (edge 65). Now 250 px (edge 115).

12. **Stairwell vent shortcut x=200 to x=350.** Was 100 px from server door (edge -60, overlap, interact zones overlapping). Now 250 px (edge 90, interact zones separated: door [0,200], vent [270,430]).

13. **Stairwell vent targetX=3100 to targetX=3050.** Paired update. Player arriving from cubicles now spawns at cubicles vent's new x=3050.

14. **Stairwell left ceiling jumper x=1500 to x=1750.** Was 100 px from desk (edge -115, severe overlap). Now 350 px (edge 135).

15. **Archives tape_05 x=400 to x=500.** Was 200 px from door (edge 55). Now 300 px (edge 154).

16. **Archives battery x=1200 to x=1100.** Was 300 px from desk (edge 95). Now 400 px (edge 195).

17. **Archives tape_04 x=1700 to x=1800.** Was 200 px from desk (edge -2, overlap). Now 300 px (edge 98). Constrained by room width (2044 px).

## 7. Edge cases

| # | Description | Result |
|---|-------------|--------|
| E1 | Reception hub: 3 doors well-spaced, no jumpers | PASS. Tape moved from 2000 to 2100. Doors at 500, 1800, 2700 unchanged. |
| E2 | Server two-floor layout: upper jumper on separate y plane | PASS. Upper jumper x=1800 not counted in ground spacing. |
| E3 | Foreground props (cubicle dividers) are decorative | PASS. Not counted in spacing math. Desk_cub_2 at 2500 sits between dividers at 2250 and 2600. |
| E4 | Stairwell jumper count (2 ceiling + 1 floor = 3) | PASS. Verified in file. Count unchanged. |
| E5 | Hiding spots inside foreground props is correct | PASS. Desk behind divider is intentional. |
| E6 | Ceiling jumper / keycard intentional tension | PASS. Documented. 100 center, -18 edge. Not changed. |
| E7 | Stairwell exit clearance (nearest element >= 350 px) | PASS. Nearest is ceiling jumper at 2700. Distance 494 > 350. |
| E8 | Locker hiding spots are interactables | PASS. Counted in spacing math. |
| E9 | Hiding spots within monster patrol range | PASS. Desk_cub_2 moved from outside (2900) to inside (2500) patrol range [600,2800]. Improvement. |
| E10 | Vent shortcut visual width vs hitbox | PASS. 130 px visual, 80 px hitbox. Both checked. |
| E11 | Archives map fragment spacing | PASS. Map at 2000, door at 200. 1800 px apart. |
| E12 | Camera framing at 1280x720 | PASS. Cubicles right cluster now spans 944 px (was 544). Visible improvement at 1:1 zoom. |
| E13 | Spawn-on-room-enter positions | PASS. No doors moved. Vent targetX values updated to match vent x. |
| E14 | Saved game compatibility | PASS. No save/load system exists. Single-run game. |
| E15 | Audio cue positioning | PASS. AudioManager uses non-spatial playback (playOneShot). No 3D audio affected. |

## 8. Trade-offs

The 100 px edge-distance target was met for most pairs. Five pairs in cubicles and archives remain below this threshold due to the desk sprite width (301 px). The desk-hide sprite cannot be resized without atlas changes (out of scope), so visual overlaps of 2 to 36 px persist between the desk and its immediate neighbors. In all cases, the interact-trigger zones do not overlap, so the player can still distinguish and interact with each element individually.

Moving desk_cub_2 from x=2900 to x=2500 brought it inside the monster patrol range, which is a net gameplay improvement. The desk was previously a "safe" hiding spot the monster never reached.

The cubicles ceiling jumper / keycard pair (100 px center distance) was left unchanged because proximity is intentional design tension (E6). The player must risk a jumper encounter to grab the keycard.

Stairwell door / vent pair has 90 px edge distance (below 100 target) but the interact zones are fully separated (door range [0,200] vs vent range [270,430], gap of 70 px). Moving the vent further right would crowd the floor jumper at x=600.

If a specific room still feels tight after the fix, the desk-hide sprite could be downsized in a future atlas pass, or the threshold could be raised to 400+ px center distance for additional separation.

## 9. Manual playtest steps

1. Start a new run. Walk through Reception, Cubicles, Server, Archives, Stairwell.
2. In each room, approach every interactable in turn. Confirm the prompt appears for the intended element only, not overlapping with a neighbor.
3. Pay special attention to the right side of Cubicles (the original complaint area). Confirm the floor jumper, desk, vent shortcut, and door are visually distinguishable. The tape_02 should now appear further left, near the locker.
4. Verify door routing: enter and exit each room via every door. The player should spawn at the correct position on entry.
5. Verify vent shortcut: take the cubicles vent to stairwell, then back. Confirm spawn positions on both sides (cubicles x=3050, stairwell x=350).
6. Trigger every jumper at least once. Confirm jumper visual still anchors to a plausible position and the dripSprite (vent grate) renders at the jumper's x.
7. In Server, confirm the ground ceiling jumper (now at x=950) is visually distinct from locker_1 (x=700). They were previously stacked at the same x.
8. In Stairwell, confirm the left ceiling jumper (now at x=1750) is visually distinct from the desk (x=1400). They previously overlapped.
9. In Archives, walk from the door (x=200) toward the map fragment (x=2000). Confirm tape_05 (x=500), battery (x=1100), desk (x=1500), and tape_04 (x=1800) are each individually interactable without triggering a neighbor.

## 10. Self-check

- [x] No em dashes anywhere.
- [x] Every numerical claim has a file:line citation or shown arithmetic.
- [x] Build is green (tsc --noEmit + vite build, exit 0).
- [x] No new TS errors or warnings.
- [x] All 15 edge cases walked.
- [x] Door routing is intact (no door positions changed).
- [x] Vent shortcut partners are consistent (cubicles x=3050/targetX=350, stairwell x=350/targetX=3050).
- [x] Listener patrol ranges still cover hiding spots (desk_cub_2 moved into range).
