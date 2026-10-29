# Mission 3 — dormant snowy mountain composition

Implementation consumes [m03.md](m03.md) and the [mission spec](../missions/m03.md), without newly inspecting video or claiming visual correspondence. World key `m03_snow_radar` is registered in `MissionWorld`; no catalog entry selects it. Practice and mission 1 retain their existing builders, presets, limits and report counts. No combat, mission data, catalog, flight math, streaming settings, uploaded assets or human documents change.

## Scale, coordinate system and flight band

The terrain footprint is **29,952 × 25,856 studs**, X ±14,976 and Z ±12,928. North is −Z; all coordinates below are world studs. The reference origin maps to (12,000, 9,120). This translation preserves the approximately 17.7 km ingress and 11.7 km inter-site leg at 0.96 studs/metre. Site 1 is north-west of the start; site 2 is west-north-west of site 1. Limits exported separately use soft/hard half-widths 14,000/15,360, spawn limit 13,500 and radar range 18,000. This square airspace extends beyond the rectangular terrain in Z; all targets, the start and runway fit both terrain and the soft airspace. Mission author must opt into both world and limits at cutover.

Valley floor is 80; the provisional summit band is **80–944 studs absolute**, giving up to **864 studs / 900 reference metres** relief. Numerous ridges reach 600–900 m above the deepest valleys; not every local hill has that relief. Site 1 crest is about 736–780; site 2 saddle is 656, surrounded by lower valley sides and higher outer peaks. The gorge is cut after the saddle shaping so that the compound's foothills cannot fill it.

Current `FlightMath.SoftAltitude=3000`, `MaxAltitude=3600`: the highest terrain plus a 200-stud clearance allowance is 1,144, well below the soft ceiling. **No flight-ceiling increase is needed.** The older mission spec's 40–900 authored-point restriction is separate from the physical flight ceiling: engine author must choose route points with terrain clearance, or review that authoring constraint. No flight math change is made here. The daytime moon is scenery above the flight band, not terrain or a flight-solid obstacle.

The exported airborne start is **(12000, 640, 9120)**, CFrame yaw **+47.3°**, pointing approximately compass 313° toward site 1. Start clearance is checked offline. These are exported composition coordinates; mission data still owns activation.

## Terrain and detail

The full footprint uses **512-stud distant cells**, **128-stud cells** around ingress, both sites, inter-site route, gorge and the entire southbound return corridor, and **64-stud cells** around each target (including sheds and helicopter rotors). Corridor half-width remains 640; gorge reservation remains 768 either side. Selection samples each 512-stud tile on a 128-stud grid and replaces complete tiles; target refinement replaces whole 128-stud cells. Edge cells clip to the original footprint. All levels sample the same height function at cell centres. **These are geometry sampling widths; native terrain resolution stays 4 studs.** Target cells retain the old 64-stud grid and all table heights are unchanged.

Mountains are **hollow shells**, rather than solid columns from Y=0. Each cell writes one 8-stud cap of Snow, Rock or lowland Ground. Shared height steps receive a 4-stud vertical Rock curtain from the lower cap to the higher cap; edges are grouped into runs of equal neighboring height. Each edge is emitted once, including fine/coarse joins; the outside perimeter closes down to Y=0. Curtains occupy the taller cell's edge and overlap its cap. There is no second Rock body under snow and no separate cap/body overlay. The interior is deliberately empty; flight collision concerns the exterior surface. This preserves the sampled mountain relief while removing invisible solid volume. The 128/512-stud silhouettes and thin-wall collision still need Studio inspection.

Gradient magnitude over 0.65 exposes dark Rock; selected uphill-facing surfaces over 0.32/0.1 gradient approximate shaded/scoured faces. This is a static aspect heuristic, not a shadow simulation. The home lowland has Ground caps.
Targets snap to the exact sampled column height, not the ideal continuous height. Their small structural foundations stay within each 64-stud cell; radar sheds use the adjacent sampled cell. No trees or settlements are added to the combat mountains. All targets use primitive stand-ins, with stable IDs, `TargetType`, `TargetGroup` and `StandIn` attributes; `groundTargets` returns all 14 models in table order. The engine must attach typed behavior and choose required/optional targets. These stand-ins do not fire or award points.

## Exported layout

`m03TargetLayout()` returns a fresh pure array with id, type, group, x/y/z and yaw. Y is ground contact; yaw is radians about +Y, front −Z. Values below are the default deterministic plan; offline tests print the authoritative values.

| ID suffix | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| s1_radar_1 | radar | site1 | -1248 | 736 | -2784 | 0 |
| s1_radar_2 | radar | site1 | -864 | 756 | -2592 | 0 |
| s1_radar_3 | radar | site1 | -480 | 780 | -2400 | 0 |
| s1_radar_4 | radar | site1 | -96 | 756 | -2208 | 0 |
| s1_radar_5 | radar | site1 | 288 | 736 | -2016 | 0 |
| s2_radar_1 | radar | site2 | -10400 | 656 | -8160 | 0 |
| s2_radar_2 | radar | site2 | -10176 | 656 | -7968 | 0 |
| s2_radar_3 | radar | site2 | -9952 | 656 | -8160 | 0 |
| s2_radar_4 | radar | site2 | -9728 | 656 | -7968 | 0 |
| s1_aa_1 | aaGun | site1 | -160 | 736 | -2272 | π/4 |
| s2_aa_1 | aaGun | site2 | -11552 | 452 | -7520 | 0 |
| s2_aa_2 | aaGun | site2 | -8544 | 424 | -7520 | π |
| s2_aa_3 | aaGun | site2 | -10528 | 520 | -6496 | π/2 |
| s2_helicopter | helicopter | site2 | -10080 | 656 | -8480 | π/2 |

Every ID has prefix `m03_`. Layout deliberately accounts for exactly the observed 9 radars, 4 AA and one helicopter; the reference roster's unaccounted ground units are not invented.

Return line: **X −13,500 to +13,500 at Z=11,040**, east–west, **19,200 studs / 20 km south** of site 2. This is an exported crossing definition; rendering and mission phase transition belong to the engine agent.

Separate landing base: flat lowland centred at **(6000,80,11264)**, far east of the mountain return route. Runway is **128 × 2,304 studs**, heading **0° (north, −Z)**, deck top **Y=84**, north/south ends **Z=10112/12416**. It spans the return latitude geographically; the cinematic cuts laterally to this separate base rather than continuing straight down the mountain return corridor. Approach/cinematic clearance must be measured before activation. Includes centre markings, paired edge lights, apron, three primitive hangars and tower. No new asset uploads or external dependencies.

## Environment

Separate `M03_ENVIRONMENT`, clear **16:28**, no clouds/precipitation, strong sun/rays, low-density white horizon haze, blue atmosphere decay and cool snow fill. Existing presets remain unchanged. The shared weather and phone-cloud resolver explicitly recognizes the new key. Standard sky exposes celestial bodies. A small non-solid untextured sphere high above the northern mountains supplements the native moon, whose direction is tied to the sun and may otherwise be below the afternoon horizon. This is a procedural daytime-moon approximation with parallax, not a new skybox texture. Shadow maps remain disabled under existing phone policy; aspect-based rock coloration supplies the shaded-face cue. Deep-blue overhead, moon readability and snow exposure require Studio image review.

## Budgets, offline estimate and activation gate

Budgets live in `src/shared/M03Limits.ts` as `M03_BUILD_LIMITS`: **130 million voxel writes, 29,000 bounded fill jobs, 120 parts, 140 descendants and a 20-second estimate ceiling**. Tests enforce every limit. Terrain fills still cap at **65,536 voxels/job**, execution slices at 8 ms with yields, and planning checkpoints target 4 ms while populating the adaptive grid and emitting shells. Zero uploaded props. Counts represent planned writes including overlaps, not unique occupied cells, measured memory or heartbeat guarantees.

| Default plan | Before (solid columns) | After (shell LOD) |
|---|---:|---:|
| Voxel writes | 5,135,175,680 | 124,670,496 |
| Bounded terrain jobs | 144,493 | 28,824 |
| Detail cells | 26,800 | 7,859 |
| Coarse cells | 10,142 | 2,535 |
| Parts | 116 | 116 |
| Descendants | 131 | 131 |
| Offline estimate | 281.95 s | 18.60 s |

Voxel writes fall **97.6%**, jobs **80.1%**. The revised estimate uses the same formula as M02: `2 × (jobs / 27494 × 7.915 s + 1 s)`, based on the tuned M01 cold measurement (27,494 jobs / 207,739,968 writes, 7.915 s), reserving twice the extrapolated job time and twice a fixed one-second allowance. This replaces the old generic coarse-spike formula `2 × jobs / 14124 × 13.78 s`; the old plan would estimate **85.19 s** under the revised formula. The improvement is therefore both actual work reduction and a changed calibration, not a measured 15× speedup. M03's job count is comparable to tuned M01, with lower write volume. Thin curtains have a different workload mix and the fixed allowance is unverified for this planner.

**18.60 seconds is an offline estimate, not an observed Studio/Player load time.** It excludes replication, cold-client visibility and rendering. Runtime measurement and real-phone acceptance remain required before activation. No mobile memory/performance acceptance follows from passing count budgets.

Required offline commands: frozen Bun install, build, validate:offline with the local Luau binary, and diff whitespace check. Pure specs retain all existing contracts and add fixed target-height regression values, full-footprint cap area, 4-stud alignment, absence of solid mountain columns, sampled shell closure across LOD edges and the estimate ceiling. The existing world-report check verifies unchanged practice and mission 1 rows. Frozen Bun install and build passed. Full `validate:offline` passed: `OFFLINE_LUAU_RESULT passed=650 failed=0`, `MISSION_CATALOG_SNAPSHOT passed=19 failed=0`, `RADIO_DELIVERY passed=4 failed=0`, 119 Python tests OK, and `world counts up to date`. `git diff --check` passed. No Studio or Roblox Jest run is performed by this task.

## What Studio must measure

Before selecting this world, measure terrain-ready and total build seconds, longest planner/fill stall, peak server/client memory, cold-client replication and initial visibility. Traverse ingress, both sites, the gorge, return corridor and LOD transitions at combat speed, checking stair steps and missing terrain, target contact/occlusion, slope material balance, moon/horizon/sun direction and snow exposure. Check low-angle views of every foundation, helicopter rotor footprint and saddle valley sides. Verify the scripted landing approach, threshold clearance and runway rollout with the engine's real aircraft. Test a real phone with combat and targets; do not infer phone acceptance from offline tests or an emulator. No upload, Studio, Player, visual-quality or device-performance verification is claimed.

## Human documentation payload (orchestrator applies)

- README: M03 world composition implemented in an unmerged dormant PR; mission/engine integration and visual/performance acceptance remain outstanding. No Player verification.
- shipped: no entry until merge; on merge state that the dormant world is available to code but changes no currently selected sortie.
- next: integrate the exported key, start, airspace, target layout, return crossing and landing deck with the engine agent; profile the optimized 18.60-second estimate and inspect shell/LOD appearance before activation.
- blockers: no physical altitude ceiling blocker (944 summit, 3000 soft/3600 hard). Runtime loading, replication, LOD appearance, daytime moon and real-phone performance are unmeasured. Review the separate 900-stud authored-point constraint for mountain clearance.
- decisions: implementation assumptions only, owner may override: valley Y=80, summit cap944, static aspect-based rock, 64/128/512 sampling and hollow shell construction, separate eastern lowland base and procedural daytime moon; tighter terrain budgets and offline estimates are not production approval. Preserve D-001/016/019/028/033 and streaming policy.
