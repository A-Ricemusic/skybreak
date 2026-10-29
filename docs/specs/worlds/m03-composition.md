# Mission 3 — dormant snowy mountain composition

Implementation consumes [m03.md](m03.md) and the [mission spec](../missions/m03.md), without newly inspecting video or claiming visual correspondence. World key `m03_snow_radar` is registered in `MissionWorld`; no catalog entry selects it. Practice and mission 1 retain their existing builders, presets, limits and report counts. No combat, mission data, catalog, flight math, streaming settings, uploaded assets or human documents change.

## Scale, coordinate system and flight band

The terrain footprint is **29,952 × 25,856 studs**, X ±14,976 and Z ±12,928. North is −Z; all coordinates below are world studs. The reference origin maps to (12,000, 9,120). This translation preserves the approximately 17.7 km ingress and 11.7 km inter-site leg at 0.96 studs/metre. Site 1 is north-west of the start; site 2 is west-north-west of site 1. Limits exported separately use soft/hard half-widths 14,000/15,360, spawn limit 13,500 and radar range 18,000. This square airspace extends beyond the rectangular terrain in Z; all targets, the start and runway fit both terrain and the soft airspace. Mission author must opt into both world and limits at cutover.

Valley floor is 80; the provisional summit band is **80–944 studs absolute**, giving up to **864 studs / 900 reference metres** relief. Numerous ridges reach 600–900 m above the deepest valleys; not every local hill has that relief. Site 1 crest is about 736–780; site 2 saddle is 656, surrounded by lower valley sides and higher outer peaks. The gorge is cut after the saddle shaping so that the compound's foothills cannot fill it.

Current `FlightMath.SoftAltitude=3000`, `MaxAltitude=3600`: the highest terrain plus a 200-stud clearance allowance is 1,144, well below the soft ceiling. **No flight-ceiling increase is needed.** The older mission spec's 40–900 authored-point restriction is separate from the physical flight ceiling: engine author must choose route points with terrain clearance, or review that authoring constraint. No flight math change is made here. The daytime moon is scenery above the flight band, not terrain or a flight-solid obstacle.

The exported airborne start is **(12000, 640, 9120)**, CFrame yaw **+47.3°**, pointing approximately compass 313° toward site 1. Start clearance is checked offline. These are exported composition coordinates; mission data still owns activation.

## Terrain and detail

Whole-footprint 256-stud sampled columns, replaced by 64-stud columns around the ingress, both sites, inter-site route, gorge and entire southbound return route. Corridor half-width is 640; gorge detail extends 768 either side. Coarse-tile selection samples corners, edge midpoints and centre. LOD uses a single height function; detail replaces whole coarse cells rather than overlaying terrain. Native voxels remain 4 studs. The terrain body is solid Rock from Y=0, with an 8-stud Snow cap on gentle combat-area surfaces; gradient magnitude over 0.65 exposes dark Rock, and selected uphill-facing surfaces over 0.32/0.1 gradient approximate shaded/scoured faces. This is a static aspect heuristic, not a shadow simulation. The home lowland has Ground caps.

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

Explicit provisional budgets: **8 billion voxel writes, 180,000 bounded fill jobs, 340 parts, 450 descendants**; zero uploaded props. Terrain fills cap at **65,536 voxels/job**, execution slices at 8 ms with yields, planning checkpoints at each coarse tile (4 ms target). These are limits on planned work, not measured memory or heartbeat guarantees. Solid volume under a full mountain range is much more expensive than mission 1's island/sea world; these large terrain allowances are local to this dormant composition and do not raise shared budgets.

Default-plan audit: **5,135,175,680 voxel writes; 144,493 jobs; 26,800 detail cells; 10,142 coarse cells; 116 parts; 131 descendants**.

The offline estimate doubles the measured 35k coarse-spike job-rate extrapolation (`2 × jobs / 14124 × 13.78 s`). It estimates **281.95 seconds (about 4.7 minutes)**, **not a demonstrated 30-second terrain-ready pass**. It excludes network replication, cold-client visibility and rendering. Selection must wait for Studio measurement and either acceptance of loading time or further construction optimization/baking. No claim of acceptable mobile memory/performance follows from passing the count budgets.

Required offline commands: frozen Bun install, build, validate:offline with the local Luau binary, and diff whitespace check. The new pure specs cover dormancy, deterministic/cooperative planning, count and exact terrain grounding, crest/saddle geometry, AA sides, bounds, distances, runway flatness, altitude, corridor coverage, materials, job limits and distinct preset. The existing world-report check verifies unchanged practice and mission 1 rows. Frozen install and build passed; `validate:offline` passed with `OFFLINE_LUAU_RESULT passed=649 failed=0`, radio delivery 4/0, 119 Python tests OK, and `world counts up to date`. `git diff --check` passed. No Studio or Roblox Jest run is performed by this task.

## What Studio must measure

Before selecting this world, measure terrain-ready and total build seconds, longest planner/fill stall, peak server/client memory, cold-client replication and initial visibility. Traverse ingress, both sites, the gorge, return corridor and LOD transitions at combat speed, checking stair steps and missing terrain, target contact/occlusion, slope material balance, moon/horizon/sun direction and snow exposure. Check low-angle views of every foundation, helicopter rotor footprint and saddle valley sides. Verify the scripted landing approach, threshold clearance and runway rollout with the engine's real aircraft. Test a real phone with combat and targets; do not infer phone acceptance from offline tests or an emulator. No upload, Studio, Player, visual-quality or device-performance verification is claimed.

## Human documentation payload (orchestrator applies)

- README: M03 world composition implemented in an unmerged dormant PR; mission/engine integration and visual/performance acceptance remain outstanding. No Player verification.
- shipped: no entry until merge; on merge state that the dormant world is available to code but changes no currently selected sortie.
- next: integrate the exported key, start, airspace, target layout, return crossing and landing deck with the engine agent; first profile the several-minute build estimate and reduce or accept loading cost before activation.
- blockers: no physical altitude ceiling blocker (944 summit, 3000 soft/3600 hard). Runtime loading, replication, LOD appearance, daytime moon and real-phone performance are unmeasured. Review the separate 900-stud authored-point constraint for mountain clearance.
- decisions: implementation assumptions only, owner may override: valley Y=80, summit cap944, static aspect-based rock, 64/256 sampling, separate eastern lowland base and procedural daytime moon; provisional terrain budgets are not production approval. Preserve D-001/016/019/028/033 and streaming policy.
