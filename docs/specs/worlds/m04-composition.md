# M04 world composition

Built against [world reference](m04.md) and [mission reference](../missions/m04.md). Pure plan: `src/shared/M04WorldPlan.ts`; server adapter: `src/server/M04World.ts`. Key `m04_inland_hills` is selected by mission 4 on the unmerged integration branch. The world originated as dormant scenery; runtime evidence and limitations are in `docs/qa/m04/README.md`.

Forest hills across a 32,768-stud square, north = −Z. No coast, settlement or base. A winding mid-map river valley, clearings and pale dirt tracks are scenery; sparse Pine silhouettes sit on the exact sampled terrain. Relief is assumed, with a 24-stud channel floor and hill tops below 600 studs. Start is shifted to (−7000,1202,10000) so the recommended NE/east/SE hook fits inside hard airspace. The active compiled transport route is 57,166.079 studs at 140 studs/s: escape at 408.329 s (6:48.33), per D-096. It starts at the first transport pose, follows the NE/east/SE hook, then turns south and west inside soft airspace. The 12:00 countdown is a separate upper bound. Initial transports are about 5,500 studs NNE; jammers are higher. All ten escort poses are exported: nine ordinary escorts and one explicit ace (`m04_ace`, initial per mission spec A3); five ordinary escorts plus the ace initially and four ordinary reinforcement reservations; scenery does not implement their spawn schedule.

Environment: 12:26, 15% sparse cloud, no rain, strong cool-blue haze. Cloud base reference 5,500 ft is metadata; native Clouds cannot place that altitude exactly. Screen colours inform atmosphere rather than being copied into terrain albedo.

LOD: 1,024-stud far tiles, 128-stud detail around the central transport route band. Distant route ends remain coarse because this fight is predominantly airborne. Each 10×100 rotated track is centred inside one 128/1,024-stud sampled tile, with all corners supported. Its terrain tile uses Ground rather than grass so native grass blades cannot obscure the one-stud strip. Pine centres are likewise snapped inside sampled cells to support their rotated footprints. No paved foundations are needed.

## Terrain closure and placement

M03-style eight-stud terrain caps, four-stud shared-edge curtains and a continuous rock floor from −4 to0. Perimeter curtains outside hard airspace meet the floor. Tests index all 65,536 finest-address columns and check every exposed step, coarse/fine join and perimeter; underside flight cannot reach the hollow interior from inside hard airspace. Terrain operations may exceed 2,048 studs and are chunked into ≤65,536-voxel native jobs; every rendered Part dimension is ≤2,048.

The dormant authoring plan exports target poses by exact id. The active M04 builder omits static aircraft; combat creates all moving contacts exactly once. Builders return `groundTargets: []`. Layout Y is base/waterline for ground/naval targets and the scenery reference pose for air contacts. Exported yaw follows CFrame convention. Mission data is integrated in unmerged PR #149.

`WorldAssets.PlaceUploaded` uses already-wired assets; missing assets have primitive stand-ins. Optional future manifest names are checked before placement, so asset PR #142 can land independently. No asset is created, exported, modified or uploaded here. Earlier Studio evidence is in `docs/qa/m04/README.md`; the lifecycle and pacing revision needs an orchestrator Studio re-check.

## Budget and verification

| Measure | Planned | Cap |
|---|---:|---:|
| Voxel writes |217,137,856|240,000,000|
| Terrain jobs |12,608|17,300|
| Parts (including air stand-ins) |92|200|
| Props |120|120|
| Estimated descendants |3,228|3,600|
| Estimated seconds |9.259|12|

Estimates use M01 measured 7.915 s /27,494 jobs, with M02's 2× reserve and one-second overhead: `2 * (jobs /27494 *7.915 +1)`. Hard estimate cap12 s leaves margin below20 s; M02's estimate10.5 s measured16 s. These are planning estimates, not measurements. Earlier integration measured 40.01–45.69 s with live assets (latest 45.077 s); full Roblox Jest reported 865/865 on that earlier revision. This revision ran no Studio or Player test; real-phone performance is unmeasured. Actual descendants are guarded at runtime; uploaded props reserve 24 descendants each even for single-mesh Pine, covering fallback Parts, wrappers, mesh/appearance descendants and future approved template changes. Four Parts per air/naval target plus 256 fixed descendants reserve target wrappers and template overhead; these are conservative allowances, not measured counts. Offline/Jest tests cover deterministic plans, counts, target ids, positions, supported non-overlapping industrial footprints, pavement clearance, dimensions, all shell seams, environmental metadata and budgets.

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

Review-fix validation: frozen Bun install and build passed; full offline gate passed (`OFFLINE_LUAU_RESULT passed=701 failed=0`). Budget unchanged:217,137,856 voxel writes,12,608 jobs,92 Parts,120 props,3,228 estimated descendants,9.259 s estimate. M02’s approximate1.5 correction gives13.89 s; The earlier live-asset Studio measurement was 45.077 s; revised lifecycle/pacing still needs Studio verification.

Mission integration on `feat/m04-mission` activates this key. The active M04 adapter builds terrain/dressing with an empty scenery-contact list; combat owns all 15 moving models using these exact ids. Exported dormant layout remains available for authoring/tests.
