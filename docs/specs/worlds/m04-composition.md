# M04 dormant world composition

Built against [world reference](m04.md) and [mission reference](../missions/m04.md). Pure plan: `src/shared/M04WorldPlan.ts`; server adapter: `src/server/M04World.ts`. New key `m04_inland_hills` is registered but no mission selects it. Not playable, merged or visually verified by this PR.

Forest hills across a 32,768-stud square, north = −Z. No coast, settlement or base. A winding mid-map river valley, clearings and pale dirt tracks are scenery; sparse Pine silhouettes sit on the exact sampled terrain. Relief is assumed, with a 24-stud channel floor and hill tops below 600 studs. Start is shifted to (−7000,1202,10000) so the recommended NE/east/SE hook fits inside hard airspace. The route is about 44,237 studs, for later engine-owned flight near 140 studs/s. Initial transports are about 5,500 studs NNE; jammers are higher. All ten escort poses are exported: nine ordinary escorts and one explicit ace (`m04_ace`, the last reinforcement); six initial and four reinforcement reservations; scenery does not implement their spawn schedule.

Environment: 12:26, 15% sparse cloud, no rain, strong cool-blue haze. Cloud base reference 5,500 ft is metadata; native Clouds cannot place that altitude exactly. Screen colours inform atmosphere rather than being copied into terrain albedo.

LOD: 1,024-stud far tiles, 128-stud detail around the central transport route band. Distant route ends remain coarse because this fight is predominantly airborne. Each 10×100 rotated track is centred inside one 128/1,024-stud sampled tile, with all corners supported. Its terrain tile uses Ground rather than grass so native grass blades cannot obscure the one-stud strip. Pine centres are likewise snapped inside sampled cells to support their rotated footprints. No paved foundations are needed.

## Terrain closure and placement

M03-style eight-stud terrain caps, four-stud shared-edge curtains and a continuous rock floor from −4 to0. Perimeter curtains outside hard airspace meet the floor. Tests index all 65,536 finest-address columns and check every exposed step, coarse/fine join and perimeter; underside flight cannot reach the hollow interior from inside hard airspace. Terrain operations may exceed 2,048 studs and are chunked into ≤65,536-voxel native jobs; every rendered Part dimension is ≤2,048.

Target scenery is grouped in Models named by exact target id, with `TargetType` and `LayoutGroup`. Builders return `groundTargets: []`. Layout Y is base/waterline for ground/naval targets and the scenery reference pose for air contacts. Exported yaw follows CFrame convention. Mission data and adoption are separate work.

`WorldAssets.PlaceUploaded` uses already-wired assets; missing assets have primitive stand-ins. Optional future manifest names are checked before placement, so asset PR #142 can land independently. No asset is created, exported, modified or uploaded here. Terrain, scenery and uploaded load behavior still need Studio review.

## Budget and verification

| Measure | Planned | Cap |
|---|---:|---:|
| Voxel writes |217,137,856|240,000,000|
| Terrain jobs |12,608|17,300|
| Parts (including air stand-ins) |92|200|
| Props |120|120|
| Estimated descendants |3,228|3,600|
| Estimated seconds |9.259|12|

Estimates use M01 measured 7.915 s /27,494 jobs, with M02's 2× reserve and one-second overhead: `2 * (jobs /27494 *7.915 +1)`. Hard estimate cap12 s leaves margin below20 s; M02's estimate10.5 s measured16 s. No Studio, Player, Roblox Jest or real-phone measurement was performed. Actual descendants are guarded at runtime; uploaded props reserve 24 descendants each even for single-mesh Pine, covering fallback Parts, wrappers, mesh/appearance descendants and future approved template changes. Four Parts per air/naval target plus 256 fixed descendants reserve target wrappers and template overhead; these are conservative allowances, not measured counts. Offline/Jest tests cover deterministic plans, counts, target ids, positions, supported non-overlapping industrial footprints, pavement clearance, dimensions, all shell seams, environmental metadata and budgets.

## Target layout

Individual positions below are assumed within the reference's site geometry; exact per-type inventories were unreadable. Air reinforcements are poses for integration, not active spawns.

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
| m04_escort_6 | escort | initial_escorts | -5500 | 1320 | 4700 | -π/4 |
| m04_escort_7 | escort | reinforcements | -5020 | 1000 | 4700 | -π/4 |
| m04_escort_8 | escort | reinforcements | -4540 | 1160 | 4700 | -π/4 |
| m04_escort_9 | escort | reinforcements | -4060 | 1320 | 4700 | -π/4 |
| m04_ace | ace | reinforcements | -3580 | 1000 | 4700 | -π/4 |


## Maximum score ledger

| Type | Count | Points each | Total |
|---|---:|---:|---:|
| Transport | 3 | 160 | 480 |
| Jammer | 2 | 140 | 280 |
| Ordinary escort | 9 | 60 | 540 |
| Ace | 1 | 240 | 240 |
| **Total** | **15** | | **1,540** |

Points follow the mission spec; poses do not implement scoring or spawn timing.

Review-fix validation: frozen Bun install and build passed; full offline gate passed (`OFFLINE_LUAU_RESULT passed=701 failed=0`). Budget unchanged:217,137,856 voxel writes,12,608 jobs,92 Parts,120 props,3,228 estimated descendants,9.259 s estimate. M02’s approximate1.5 correction gives13.89 s; Studio measurement remains pending.
