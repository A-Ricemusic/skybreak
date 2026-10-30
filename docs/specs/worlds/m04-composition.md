# M04 world composition

Built against [world reference](m04.md) and [mission reference](../missions/m04.md). Pure plan: `src/shared/M04WorldPlan.ts`; server adapter: `src/server/M04World.ts`. Key `m04_inland_hills` is selected by mission 4 on the unmerged integration branch. The world originated as dormant scenery; runtime evidence and limitations are in `docs/qa/m04/README.md`.

Forest hills across a 32,768-stud square, north = −Z. No coast, settlement or base. A winding mid-map river valley, clearings and pale dirt tracks are scenery; sparse Pine silhouettes sit on the exact sampled terrain. Relief is assumed, with a 24-stud channel floor and hill tops below 600 studs. Start is shifted to (−7000,1202,10000) so the recommended NE/east/SE hook fits inside hard airspace. The active compiled transport route is 57,166.079 studs at 140 studs/s: escape at 408.329 s (6:48.33), per D-096. It starts at the first transport pose, follows the NE/east/SE hook, then turns south and west inside soft airspace. The 12:00 countdown is a separate upper bound. Initial transports are about 5,500 studs NNE; jammers are higher. All ten escort poses are exported: nine ordinary escorts and one explicit ace (`m04_ace`, initial per mission spec A3); five ordinary escorts plus the ace initially and four ordinary reinforcement reservations; scenery does not implement their spawn schedule.

Environment: 12:26, 15% sparse cloud, no rain, strong cool-blue haze. Cloud base reference 5,500 ft is metadata; native Clouds cannot place that altitude exactly. Screen colours inform atmosphere rather than being copied into terrain albedo.

LOD: 1,024-stud far tiles, 128-stud detail around the central transport route band. Distant route ends remain coarse because this fight is predominantly airborne. Each 10×100 rotated track is centred inside one 128/1,024-stud sampled tile, with all corners supported. Its terrain tile uses Ground rather than grass so native grass blades cannot obscure the one-stud strip. Pine centres are likewise snapped inside sampled cells to support their rotated footprints. No paved foundations are needed.

## Terrain closure and placement

M03-style eight-stud terrain caps and four-stud shared-edge curtains, without M03's continuous rock floor (D-120). Every one of the 65,536 finest-address columns has a cap whose bottom is at or above Y=0, and perimeter curtains outside hard airspace reach Y=0, so any path from hard airspace into the hollow interior crosses a cap; the floor below Y=0 added nothing reachable but cost a whole extra layer of terrain chunks. Tests check every column, every exposed step, coarse/fine join and perimeter, and that no terrain op reaches below Y=0. Terrain operations may exceed 2,048 studs and are chunked into ≤65,536-voxel native jobs; every rendered Part dimension is ≤2,048.

The dormant authoring plan exports target poses by exact id. The active M04 builder omits static aircraft; combat creates all moving contacts exactly once. Builders return `groundTargets: []`. Layout Y is base/waterline for ground/naval targets and the scenery reference pose for air contacts. Exported yaw follows CFrame convention. Mission data is integrated in unmerged PR #149.

`WorldAssets.PlaceUploaded` uses already-wired assets; missing assets have primitive stand-ins. Optional future manifest names are checked before placement, so asset PR #142 can land independently. No asset is created, exported, modified or uploaded here. Earlier Studio evidence is in `docs/qa/m04/README.md`; the lifecycle and pacing revision needs an orchestrator Studio re-check.

## Budget and verification

| Measure | Planned | Cap |
|---|---:|---:|
| Voxel writes |150,028,992|240,000,000|
| Terrain jobs |11,584|17,300|
| 128-stud chunk touches |98,831|—|
| Parts (including air stand-ins) |92|200|
| Props |120|120|
| Estimated descendants |3,228|3,600|
| Estimated seconds (Studio Play calibrated) |16.16|20|

Actual descendants are guarded at runtime; uploaded props reserve 24 descendants each even for single-mesh Pine, covering fallback Parts, wrappers, mesh/appearance descendants and future approved template changes. Four Parts per air/naval target plus 256 fixed descendants reserve target wrappers and template overhead; these are conservative allowances, not measured counts. Offline/Jest tests cover deterministic plans, counts, target ids, positions, supported footprints, dimensions, all shell seams, environmental metadata and budgets.

## Load-time calibration (D-120)

Measured 2026-10-30 in Studio 0.745.563 Play on a MacBook Air M1 (8 GB) with `tools/spikes/terrain-bench.server.luau`. The bench times each scheduled job of the real plan through the real `TerrainWriter`, and runs one configuration per fresh Play session unless noted. It is not the campaign path: plan, environment, parts and props (about 2–3 s on #149's campaign runs) are excluded. Earlier campaign-path runs on #149 measured 40.0–45.7 s (terrain-ready 42.8 s) with the floor and the 8 ms budget.

| World and configuration | Wall s | Lua terrain work s | Yields | Native clear after, s |
|---|---:|---:|---:|---:|
| M04 with floor, 8 ms budget (as #149 shipped) | 66.2 | 21.5 | 1,752 | over 10 (script timeout) |
| M04 floorless, 30 ms (second run in session) | 42.4 | 7.4 | 199 | — |
| M04 floorless, 0.1 s | 16.7 | 6.4–6.5 | 57–59 | 11.6; 8.2 after a 14.3 s Air fill |
| **M04 floorless, 0.25 s (shipped)** | **11.7** | 6.4 | 24 | 12.1 |
| M05 with floor, 8 ms (first session) | 107.4 | 35.2 | 2,720 | over 10 (script timeout) |
| M05 floorless, 0.25 s | 37.0 | 14.0 | 55 | 11.2 |
| M02 (live), 0.1 s | 13.6 | 5.3 | 52 | 4.6 after an 11.3 s Air fill |

Two causes dominate. First, every yield costs a whole engine frame once a 32k-stud world exists: about 0.16–0.22 s on land and 0.42 s for M05's sea, against 8 ms of terrain work per resumption at the old budget. Second, terrain work scales with the 128-stud chunks each fill touches, not with voxels: about 0.07 ms per solid touch and 0.2 ms per water touch. The rock floor was a second world-wide chunk layer (46–49% of all touched chunks). Air-filling before a native clear does not free chunks, so it only adds its own time; a single native clear is the cheapest.

`worldCounts` now estimates `work + yields × frame + 3 s`. Here work is touches × 0.07 ms (water 0.2 ms), yields is work / 0.25 s, and frame is 0.2 s plus 0.45 s × the water share of work. This is calibrated at the shipped 0.25 s budget only: the frame cost at much smaller budgets was lower (25 ms per yield at 8 ms), so the model does not extrapolate to other budgets. It gives M04 16.2 s, against the bench's 11.7 s terrain plus about 3 s of other phases, and M05 42.8 s.

The 0.25 s budget means the server can stall up to about 0.6 s (one resumption plus the longest job, 0.33–0.37 s) while the loading screen is up. The world is single-player and no combat runs during this phase. Studio Play shares one machine between server and client; a live server and a phone client split this differently, and phone load time remains unmeasured.

## Target layout

Individual positions below are assumed within the reference's site geometry; exact per-type inventories were unreadable. The active mission uses these poses and spawns four reserves after the first transport kill.

| ID | Type | Group | X | Y | Z | Yaw (rad) |
|---|---|---|---:|---:|---:|---:|
| m04_transport_1 | transport | transports | -4550 | 1202 | 5100 | -π/4 |
| m04_transport_2 | transport | transports | -4310 | 1202 | 5260 | -π/4 |
| m04_transport_3 | transport | transports | -4070 | 1202 | 5420 | -π/4 |
| m04_jammer_1 | jammer | jammers | -5100 | 1524 | 4800 | -π/4 |
| m04_jammer_2 | jammer | jammers | -3600 | 1524 | 4800 | -π/4 |
| m04_escort_1 | escort | initial_escorts | -5500 | 1000 | 3800 | -π/4 |
| m04_escort_2 | escort | initial_escorts | -5020 | 1160 | 3800 | -π/4 |
| m04_escort_3 | escort | initial_escorts | -4540 | 1320 | 3800 | -π/4 |
| m04_escort_4 | escort | initial_escorts | -4060 | 1000 | 3800 | -π/4 |
| m04_escort_5 | escort | initial_escorts | -3580 | 1160 | 3800 | -π/4 |
| m04_escort_6 | escort | reinforcements | -5500 | 1320 | 4700 | -π/4 |
| m04_escort_7 | escort | reinforcements | -5020 | 1000 | 4700 | -π/4 |
| m04_escort_8 | escort | reinforcements | -4540 | 1160 | 4700 | -π/4 |
| m04_escort_9 | escort | reinforcements | -4060 | 1320 | 4700 | -π/4 |
| m04_ace | ace | initial_escorts | -3580 | 1000 | 4700 | -π/4 |


## Maximum score ledger

| Type | Count | Points each | Total |
|---|---:|---:|---:|
| Transport | 3 | 160 | 480 |
| Jammer | 2 | 140 | 280 |
| Ordinary escort | 9 | 60 | 540 |
| Ace | 1 | 240 | 240 |
| **Total** | **15** | | **1,540** |

Points follow the mission spec; active mission data owns scoring and spawn timing.

Earlier review-fix validation (before D-120) planned 217,137,856 voxel writes and 12,608 jobs; its live-asset Studio measurement was 45.077 s. The current budget is in the table above; the campaign-path re-measure of the D-120 revision is still pending.

Mission integration on `feat/m04-mission` activates this key. The active M04 adapter builds terrain/dressing with an empty scenery-contact list; combat owns all 15 moving models using these exact ids. Exported dormant layout remains available for authoring/tests.
