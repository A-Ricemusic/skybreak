# Mission 3 — dormant snowy mountain composition

> Pending loading optimization (2026-10-31): current proposed estimate **14.734 s**, gate **16 s**. Older counts/timings below are historical. Native reachable surfaces and scenery are preserved; M03 alone drops its unreachable buried floor. Shared fill cap is now 262,144 voxels; loading slices M03/M04/M05 = 0.5/0.3/3 s. These extrapolate prior calibration and are not fresh Studio/device measurements. See D-666; orchestrator measures actual builds.

Implementation consumes [m03.md](m03.md) and the [mission spec](../missions/m03.md), without newly inspecting video or claiming visual correspondence. World key `m03_snow_radar` is registered in `MissionWorld`; no catalog entry selects it. Practice and mission 1 retain their existing builders, presets, limits and report counts. No combat, mission data, catalog, flight math, streaming settings, uploaded assets change. The README, next steps, blockers and decisions now record this dormant PR; shipped.md remains unchanged.

## Scale, coordinate system and flight band

The terrain footprint is **30,976 × 30,976 studs**, X/Z ±15,488. North is −Z; all coordinates below are world studs. The reference origin maps to (12,000, 9,120). This translation preserves the approximately 17.7 km ingress and 11.7 km inter-site leg at 0.96 studs/metre. Site 1 is north-west of the start; site 2 is west-north-west of site 1. Limits exported separately use soft/hard half-widths 14,000/15,360, spawn limit 13,500 and radar range 18,000. The terrain extends 128 studs beyond the entire hard airspace; all targets, the start and runway fit the soft airspace. Mission author must opt into both world and limits at cutover.

Valley floor is 80; the provisional summit band is **80–944 studs absolute**, giving up to **864 studs / 900 reference metres** relief. Numerous ridges reach 600–900 m above the deepest valleys; not every local hill has that relief. Site 1 crest is about 736–780; site 2 saddle is 656, surrounded by lower valley sides and higher outer peaks. The gorge is cut after the saddle shaping so that the compound's foothills cannot fill it.

Current `FlightMath.SoftAltitude=3000`, `MaxAltitude=3600`: the highest terrain plus a 200-stud clearance allowance is 1,144, well below the soft ceiling. **No flight-ceiling increase is needed.** The older mission spec's 40–900 authored-point restriction is separate from the physical flight ceiling: engine author must choose route points with terrain clearance, or review that authoring constraint. No flight math change is made here. The daytime moon is scenery above the flight band, not terrain or a flight-solid obstacle.

The exported airborne start is **(12000, 640, 9120)**, CFrame yaw **+47.3°**, pointing approximately compass 313° toward site 1. Start clearance is checked offline. These are exported composition coordinates; mission data still owns activation.

## Terrain and detail

The full footprint uses **512-stud distant cells**, **128-stud cells** around ingress, both sites, inter-site route, gorge and the entire southbound return corridor, and **64-stud cells** around each target (including sheds and helicopter rotors). Corridor half-width remains 640; gorge reservation remains 768 either side. Selection samples each 512-stud tile on a 128-stud grid and replaces complete tiles; target refinement replaces whole 128-stud cells. Edge cells clip to the expanded footprint. A blended flat exterior skirt avoids extra distant ridges; a 1,024-stud-wide lowland corridor reserves the southern landing approach. All levels sample the same height function at cell centres. **These are geometry sampling widths; native terrain resolution stays 4 studs.** Target support samples the complete 48-stud-square foundation footprint at 4-stud intervals and uses its highest column; foundations extend below the lowest column.

Mountains are **hollow shells**, rather than solid columns from Y=0. Each cell writes one 8-stud cap of Snow, Rock or lowland Ground. Shared height steps receive a 4-stud vertical Rock curtain from the lower cap to the higher cap; edges are grouped into runs of equal neighboring height. Each edge is emitted once, including fine/coarse joins; the outside perimeter closes down to Y=0. Curtains occupy the taller cell's edge and overlap its cap. There is no second Rock body under snow and no separate cap/body overlay. A continuous 4-stud Rock floor spans the entire footprint from Y=-4 to 0 and meets the perimeter curtains outside the hard airspace. Its interior is inaccessible from above, below or the sides within the hard airspace, including negative-altitude flight. This preserves the sampled mountain relief while removing invisible solid volume. The 128/512-stud silhouettes and thin-wall collision still need Studio inspection.

Gradient magnitude over 0.65 exposes dark Rock; selected uphill-facing surfaces over 0.32/0.1 gradient approximate shaded/scoured faces. This is a static aspect heuristic, not a shadow simulation. The home lowland has Ground caps.
Targets snap to the highest sampled terrain across their full foundation footprint; radar sheds use the adjacent sampled cell. No trees or settlements are added to the combat mountains. All targets use primitive stand-ins, with stable IDs, `TargetType`, `TargetGroup` and `StandIn` attributes; `groundTargets` returns an empty array, matching M02. All 14 target-id models are scenery under the world scene folder. Engine batch A creates typed targets with GroundTargetFactory from later mission data authored using the exported layout; mission data chooses required/optional targets. These stand-ins do not fire or award points.

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

Separate landing base: flat lowland centred at **(6000,80,11264)**, far east of the mountain return route. Runway is **128 × 2,304 studs**, heading **0° (north, −Z)**, deck top **Y=84**, north/south ends **Z=10112/12416**. It spans the return latitude geographically; the cinematic cuts laterally to this separate base rather than continuing straight down the mountain return corridor. Two contiguous 128 × 1,152 pavement parts preserve the footprint and threshold positions within Roblox’s 2,048-stud native size cap. Offline tests sweep a 96-stud-wide southern 3° glide path from the hard boundary to the threshold, using 12-stud aircraft datum clearance and an 8-stud lower envelope. Actual approach/cinematic clearance must still be measured before activation. Includes centre markings, paired edge lights, apron, three primitive hangars and tower. No new asset uploads or external dependencies.

## Environment

Separate `M03_ENVIRONMENT`, clear **16:28**, no clouds/precipitation, strong sun/rays, low-density white horizon haze, blue atmosphere decay and cool snow fill. Existing presets remain unchanged. The shared weather and phone-cloud resolver explicitly recognizes the new key. Standard sky exposes celestial bodies. A small non-solid untextured sphere high above the northern mountains supplements the native moon, whose direction is tied to the sun and may otherwise be below the afternoon horizon. This is a procedural daytime-moon approximation with parallax, not a new skybox texture. Shadow maps remain disabled under existing phone policy; aspect-based rock coloration supplies the shaded-face cue. Deep-blue overhead, moon readability and snow exposure require Studio image review.

## Budgets, offline estimate and activation gate

Budgets live in `src/shared/M03Limits.ts`: **208 million voxel writes, 31,000 bounded fill jobs, 118 parts, 134 descendants and a 20-second estimate ceiling**. The floor increases writes over the open shell; jobs, parts and descendants have explicit tight caps. Every fill stays within 65,536 voxels/job; execution yields on 8 ms slices, planning checkpoints on 4 ms slices. No uploaded assets.

The estimate is `2 × (jobs / 27494 × 7.915 s + 1 s)`, extrapolated from tuned M01 with a 2× reserve. It is not a measured Studio/Player load time and excludes replication, cold-client visibility and rendering. Thin curtains and the fixed allowance require runtime measurement.

Offline contracts cover empty returned targets (static builder source contract), unique mission-prefixed target IDs, full target-footprint support/non-overlap, native part sizes, runway coverage and thresholds above terrain, continuous floor coverage beyond hard airspace, shell/LOD closure, swept southern landing clearance and budgets. Frozen install, build and offline validation are required; the final result is recorded below. The default plan is **206,784,672 voxel writes, 30,590 jobs, 117 parts, 132 descendants, 7,923 detail cells and 3,247 coarse cells**, with a **19.613-second offline estimate**. Practice and mission 1 report counts remain unchanged.

Validation on the rebased revision: `bun install --frozen-lockfile`, `bun run build` and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` passed. Result lines: `M03_BUILDER_CONTRACT passed=1 failed=0` (static source contract), `OFFLINE_LUAU_RESULT passed=677 failed=0`, `MISSION_CATALOG_SNAPSHOT passed=19 failed=0`, `PLAYTEST_RELAY_REGRESSION passed=3 failed=0`, `AUDIO_LIFECYCLE_SIMULATION passed=11 failed=0`, `VOICE_CONSUMER_RESULT passed=8` (simulation only), `RADIO_DELIVERY passed=4 failed=0`, 119 Python tests OK, and `world counts up to date`. Whitespace check passed. No Studio, Roblox Jest, Player or device test was run.

## What Studio must measure

Before selecting this world, measure terrain-ready and total build seconds, longest planner/fill stall, peak server/client memory, cold-client replication and initial visibility. Traverse ingress, both sites, the gorge, return corridor and LOD transitions at combat speed, checking stair steps and missing terrain, target contact/occlusion, slope material balance, moon/horizon/sun direction and snow exposure. Check low-angle views of every foundation, helicopter rotor footprint and saddle valley sides. Verify the scripted landing approach, threshold clearance and runway rollout with the engine's real aircraft. Test a real phone with combat and targets; do not infer phone acceptance from offline tests or an emulator. No upload, Studio, Player, visual-quality or device-performance verification is claimed.

## Human documentation

README records the dormant world in unmerged PR #139, not playable. Next and blockers retain engine batch B (mission update banner, clock reset, return-line objective, automatic skippable landing and terrain-relative LOW ALTITUDE), mission data/unlock and Studio/phone acceptance. Decisions D-045–D-047 record sealed shell LOD/budgets, separate landing placement and unchanged flight ceiling, all provisional. D-039–D-041 belong to #140; D-042–D-044 are reserved for #138. shipped.md is unchanged because this PR is unmerged.

## Update from the mission 3 PR (2026-10-29)

Mission 3 now selects this world. Changes: runway and apron are 8-stud slabs from the lowland (80) to **Y=88** (D-064, the D-056 lesson); every target model is adopted by id as its combat target, gaining an invisible aim root, so the part and descendant caps rise to **132 / 148** (131 / 146 used). The shell test now checks every 64-stud column along every cap edge (164,504 columns, 130,544 height steps) and the floor's Rock material, block shape and zero yaw. Studio measurements (desktop, not a phone): Play builds of 42.5–87.5 s and a headless 35.3 s against the 19.6 s estimate; the lowland surface reads Y≈82 beside the runway; at maximum quality the mountains read as large terraces, and at low quality distant terrain is not drawn. Clearing this terrain natively takes 17.6–46 s (Studio, load-dependent); it runs through the shared world gate (D-067), isolated and bounded, with any next launch queued until it completes. A chunked Air clear was measured and dropped: the emptied extent still needed a 9–23 s native clear. See the mission 3 PR and Blockers.


## Second live-crash mitigation (2026-11-01, proposed)

Owner reports M03 crashing on phone and PC on main 36e949d0 despite #220. This hotfix removes the continuous bottom floor described above, following M04/M05: all caps and edge/perimeter curtains remain, with the playable shell closed above Y=0. Planned writes fall from 206,784,672 to 146,815,136. Part/descendant limits remain 132/148. M3 always retains procedural target visuals and does not request or place military assets. Historical timings above are not a measurement of this change. See [investigation](../../qa/m03-crash-second-hotfix.md). Not Studio/Player tested; live root cause remains unconfirmed.
