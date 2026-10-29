# C1 dormant mission 1 composition

Implementation: `shared/M01WorldPlan.ts`, explicit server executor `server/M01World.ts`.
WeatherRules recognizes the new attribute for dry weather and phone cloud trimming.
No mission selects `m01_sea_island`; C2 and campaign cutover must wire it. Current
WorldPlanner, mission files, airspace, streaming settings and 18 presets are unchanged.
The separate environment value uses the existing environment executor via ApplySpec.
No asset uploads, Studio sessions or Player tests were performed.

## Geometry and scale

Bounds are **32,768 × 32,768 studs**, ±16,384, approximately 34.13 reference km
at **0.96 studs/metre** (D-016, D-019, D-022). Edge-to-edge cruise is 204.8 seconds
at the unchanged 160 studs/s. The island is **9,600 × 3,840 studs**, centred at
(0,-600), with southern tip z=4,200. Start (0,622,10,000) is 5,800 studs south
of that tip (~36 seconds at cruise). North is -Z. These retain the world spec's
full map-derived footprint rather than scaling the old ±4,000 terrain square.
Islets sit outside that outline. Sea level remains 32.

The **1,536-stud-wide** spatial corridor joins start → south coast → east bay
city (1,280,256) → west/north airbase (-1,280,-3,200) → northern exit
(-1,280,-8,000). Its centreline is approximately 18,942 studs, with 768-stud
clearance on either side. Additional detailed rectangles cover the city
**896 × 1,536**, airbase **896 × 3,072**, launch lane **768 × 3,200** and
carrier reservation **1,024 × 1,536**, centred at (0,11,200).
These are spatial reservations, not invented encounter timings. The reference
spec explicitly leaves the bomber's long route versus island-size discrepancy
unresolved (§2). E1/E2 must reconcile their timed route with these reservations
before cutover; C1 does not slow bombers, compress distances or add a timing dogleg.
The reserved route band is y=622–832 (590–800 above the sea), with at least
48 studs of conservative terrain/structure clearance. No carrier proxy is built;
D1 supplies its independently approved asset and escort placement.

Terrain has a dark forested mountain spine, steep rock coast, pale beach caps,
east bay, west river inlet, and small islets. Civic terraces are land, with a
2,880-stud runway and apron, eight hangars, tower, 64 city buildings, streets
and two quays. Uploaded library props only; forest coverage primarily comes
from LeafyGrass tint, with seeded sparse individual trees. Surf strokes follow
sampled shore crossings. Original generic geography has no identifying text
or copied landmarks (D-001/D-012).

## Production method and estimate

Runtime **sampled columns**, through the existing TerrainWriter/TerrainSchedule.
Coarse sampling is **256 studs**, refined sampling **64 studs**; both write
native **4-stud Terrain voxels**, not a fictitious larger voxel resolution.
Refinement replaces entire coarse cells, never adds overlapping heightfields.
Each column has a rock body and 8-stud forest/sand cap. The same analytic
height function spans both levels. This deliberately follows the measured
LOD candidate rather than generating a full-resolution heightfield. It is not
native 4-stud horizontal detail: stepped silhouettes and low passes need review.
No baking step/artifact or TerrainRegion restoration lifecycle is required.

Voxel water is bounded to **7,168 × 12,288 × 64 studs** around the coasts and
**2,048 × 4,096 × 128** at the carrier/start. Sea elsewhere uses disjoint visual
Parts at the exact same waterline, with maximum dimensions 2,048. Those Parts
are non-solid and not physical water: future ship/swim queries must stay inside
the voxel regions. Carrier berth bottom is -96, surface 32; D1 must check keel
clearance against its exact approved hull. Streaming stays disabled.

`m01Counts` reports filled-cell writes and scheduler jobs; the pure spec prints
`M01_ESTIMATE`. Approximately **208M voxel writes / 8,517 jobs** are expected.
The offline estimate is **10.33 s terrain**, using twice
`jobs / 6104 × 1.55 s + 3 s bounded water` from the 16k sampled-column spike.
This extrapolation reserves a factor of two for layering/cache variability;
it is not a measured upper bound. Unlike bump loops, these are native FillBlock
writes. Plan generation, scheduling allocation, replication, asset downloads
and client rendering still require measurement. There is room inside the
**20–30 s server ready target**, not proof that this target passes.

Budgets: **260M filled voxel writes, 30,000 scheduled jobs, 240 props,
340 primitive parts (including eight cloud wisps), 1,300 scene descendants**.
The descendant estimate reserves four descendants per library prop; the server
also checks actual cloned descendants. This budget is local to the dormant
plan, leaving every current world limit/report unchanged. Asset downloads start
ahead of terrain; placement uses only cached approved templates and reports
missing props instead of waiting another 30 seconds. A cold build can therefore
omit props; require zero missing city/airbase props at cutover or add a preload
readiness gate upstream. No replacement assets are uploaded.

Environment: 14:05 daylight, blue-grey haze, 0.65 cloud cover / 0.28 density,
calm dark sea, dry weather, subtle SunRays. Native Clouds has no altitude control;
eight non-solid translucent wisps provide the broken lower layer at
**1,787.648 studs** (6,000 reference ft ×0.3048×0.96 +32), with native Clouds
above. This approximation needs visual approval, especially low graphics quality.

## Required Studio work before selection

The orchestrator holds the only Studio lease. Run Roblox Jest world/environment
integration tests there; offline contracts do not verify engine rendering or loading.
In an isolated unpublished place, clear/build/rebuild this exact composition and:

- Measure cold and warm server wall time to terrain-ready and complete-world-ready
  (including plan generation/template preload); both must finish before the clock.
  Check 20–30 s target and capture maximum heartbeat/yield gap (target 33 ms),
  longest terrain call, peak server memory and actual descendant/mesh counts.
- Measure cold client join-to-visible terrain and props, replication volume/time,
  server/client memory independently, and missing props. Traverse at 160 and
  600 studs/s with the real jet, targets/radar and network delay; inspect ahead
  terrain availability and visible popping with streaming disabled.
- Inspect all LOD seams, beach/river water joins, surf placement, cliff silhouette,
  city foundations/quays, runway grounding and the full approved carrier keel/
  launch corridor. Check bomber formation clearance against the final timed route,
  not merely the C1 centreline. Confirm physical water expectations.
- Compare sky/haze/cloud altitude/light shafts and calm water to spec timestamps
  0:07:42, 0:08:18–0:08:23, 0:10:19–0:10:47, 0:11:16; inspect cloud ellipsoids
  from above/below and low graphics settings. This PR claims no frame comparison.
- Test a real mid-range phone for sustained FPS, memory, draw cost and thermals;
  the spike's viewport emulator is not mobile hardware evidence.

If the runtime detail or visual acceptance fails, prebuilding is the documented
fallback, requiring a new terrain artifact/restore lifecycle and measurement.
Do not silently select this plan as a completed measured world.

## Coast/sea tuning (2026-10-28)

The tuning pass retains the dormant world key, scale, route reservation and budgets.
The coast now replaces whole cells with adaptive 32-stud shore bands and 16-stud
waterline samples, while corridor interiors remain 64 studs and distant interiors
256. Slope selects rock versus sand/forest caps; 192-stud rounded skirts blend
the civic terraces. Rectangular surf Parts are removed. Identical opaque sea Parts cover the whole
world, overlapping four studs and sitting 0.25 studs above native water/waves.
Native coastal and deep launch water remain underneath. No visible Part/voxel
material boundary remains. The visual sea is flat (no native wave animation or
water reflections); open sea outside the native regions is visual only, as before.
No mission currently uses this world.

Planning accepts a cooperative checkpoint, used only by the M01 server executor
at a 4 ms target. Prop grounding uses the containing coarse tile's actual ops.
M01 terrain execution caps native fills at 65,536 voxels (one quarter of
the shared default), uses an 8 ms batch target, and dressing yields every eight
props; the shared writer's default is unchanged. Atmosphere density/offset/haze
are reduced; 14:05, cloud cover/density, the 6,000 ft wisps and light shafts stay.
See the measurement report's Tuning pass for observed results and limitations.
