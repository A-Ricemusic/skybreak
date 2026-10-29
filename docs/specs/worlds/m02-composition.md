# Mission 2 farmland and lake airbase

> **Update 2026-10-29 (mission 2 PR):** mission 2 now selects this world. Pavement is an 8-stud slab
> from the terrain (32) to `M02_PAVEMENT_TOP` = 40 (D-056, measured in Studio), so bomber, tower and
> substation contacts sit at 40 and the rest on terrain at 32. The world draws each target once,
> tagged by id, and combat adopts those models (D-053). Text below is the original dormant record.

`m02_farm_airbase` is a deterministic procedural composition, following M01's
sampled-column plan, TerrainWriter, environment executor and cooperative builder.
No mission selects it. Practice and M01, mission data, catalog, combat, uploads,
streaming and existing presets are unchanged. No Studio or Player test was run.
The source mission/world specs are the evidence baseline; no video was newly
inspected. All uncertain positions below are builder allocations, not readings.

## Footprint and terrain

32,768 × 32,768 studs, ±16,384; north is −Z. Conversion is 0.96 studs/reference
metre (D-016/019/028). Airspace soft/hard half-widths are 14,500/15,360, spawns
14,000, radar 18,000. Start is (0,500,12500), airborne heading north at 160
studs/s, approximately 468 studs above the lowland datum. Start → base is
25,000 studs northward (156.25 seconds at cruise), a documented compression of
the uncertain 27–32 reference km estimate, following the world spec recommendation.
Base offset west is 1,024 studs; exact offset is unmeasured.

The 1,536-stud-wide corridor follows (0,12500) → (0,3200) → (−1024,−12500).
The substation is 9,300 studs north of start (9.69 reference km). Extra detail
covers the base's 2,816 × 3,840 rectangle plus a 256-stud skirt, and the
512 × 512 substation. Whole coarse cells touching reservations are refined.
Coarse/detailed sampling is 256/64 studs; shoreline cells refine to 16 studs.
Native Terrain voxels remain 4 studs. The lake is centred near (−3500,−11700),
approximately 6,800 × 1,700, with a curved shore, bed at 8 and water surface 24.
Wooded rounded ridges west/NW include a shallow diagonal valley. Lowlands vary
about 24–40 studs; the base/substation terraces are exactly 32.

Terrain uses a shallow connected crust: at least eight studs deep, extended down
to the minimum neighbouring sampled height minus eight. It is a surface world,
not a deep solid geology simulation; inspect LOD transitions and undersides in
Studio before selecting. This avoids spending full-footprint voxels below the
visible farmland. Identical consecutive columns are coalesced into fills, without
changing sampling or top surfaces; each merged native fill remains ≤65,536 cells.
Patchwork terrain materials supply fields; 18 hedgerows, six farm buildings and
seeded sparse trees supply near-route texture. Dense distant woods rely primarily
on terrain tint, as in M01, rather than thousands of clones.

## Exported contact layout

`m02TargetLayout()` returns stable IDs, type, x/y/z, yaw radians and group.
All contact y values are 32, matching actual terrain and pavement top. Targets
are reserved sites and visual dressing, not registered combat actors. The
engine integration must own target lifecycle and avoid duplicating these visuals.
The substation is intentionally outside the airbase: the spec places it en route.

| Type | Count | x, z positions (studs) | Yaw/group |
|---|---:|---|---|
| Bomber | 4 | x −1500; z −12950, −12770, −12590, −12410 | π/2, A/main apron |
| Bomber | 3 | x −200; z −13700, −13480, −13260 | 0, B/NE loops |
| Bomber | 2 | x −1600; z −11400, −11220 | 0, C/south |
| Bomber | 2 | x −1800; z −13800, −13620 | 0, D/NW loops |
| Hangar | 7 | x −2000; z −14000, −13750, −13500, −11750, −11500, −11250, −11000 | −π/2, west |
| AA | 4 | x −2200 or 100; z −14000 or −11000 | 0, perimeter |
| Control tower | 1 | −1700, −12400 | 0, terminal |
| Substation | 1 | 0, 3200 | 0, power_line |

The ambiguous bomber instruction is resolved as **11 total**, allocated 4/3/2/2
per the source spec, not 44. Lake west, runway north/south, hill heights, precise
layout and pad spacing are assumptions. All base targets fit inside its terrace
and soft airspace; the substation fits its own flat detailed reservation.
`M02_RUNWAY` separately exports centreline (−1024,32,−12500), length 2,880,
width 64, south threshold z −11060 and north threshold z −13940, heading/yaw 0.
These are future scramble contact poses; airborne clearance belongs to the engine.

Runway and parallel/west taxiways use slabs below Roblox's 2,048-stud size cap.
The terminal, apron, hardstands, square taxi loops, AA silhouettes, transformers,
fences, five shore fuel cylinders and 18 red/white lattice pylons are procedural.
Approved Hangar, ControlTower, Broadleaf, Barn, Farmhouse and HeavyBomber uploads
are cloned only; no new export/upload or parked-bomber variant is created.
Bomber existing airborne geometry is bounds-grounded for a static parked pose;
landing gear fidelity is unverified. Missing cached templates are counted on the
world parent; readiness must require zero missing props before future selection.

## Environment and lake continuity

A separate dry grey-green preset uses 13:29, cover 0.8/density 0.28 (phone density
0.18), desaturated grade and moderate haze 0.19/1.2. Eight transparent, non-solid
mist ellipsoids at y=530 occur only in the early southern route, not over the
base. They are spatial early-route mist, not a timed weather transition.
The 8,000-ft reference cloud base is exported and recorded as metadata; native
Roblox Clouds has no altitude control, so this is not an exact cloud-deck claim.
Existing preset values remain untouched.

One opaque lake surface representation covers native lake water using overlapping
400-stud strips at top 24.25, following M01's sea-join fix. Land hides strip
edges; shoreline curvature/joins still need low-angle inspection. Native water
stays bounded to sampled basin cells; no full-world water slab. No artificial
foam strips. Shallow mist and moderate haze require exact-start visibility checks.

## Budgets, estimate and acceptance

Local ceilings retain M01's **260M filled voxel writes, 30,000 jobs, 340 primitive
parts including eight mist wisps, 240 props, 1,300 descendants**. `m02Counts`
prints the current estimate in the offline spec, reserving four descendants per
world prop and twenty per bomber; the server asserts actual scene descendants.
Cold assets are started asynchronously during terrain work, without a second
30-second preload stall; missing assets are reported, never silently approved.

The terrain plan has **175,062,192 voxel writes and 14,706 jobs**, with
41,943 detailed and 15,586 coarse samples. Coalescing preserves the sampled
surfaces and reduces job count from the rejected 70,027-call first version.
Current estimates are **308 primitive parts, 169 props including eleven bombers,
and 1,164 descendants**. Estimated warm composition time is **10.47 seconds**, using twice
`jobs / 27,494 × 7.915 + 1` from M01's tuned cold result. This is an offline
extrapolation, not a measured bound; cold downloads, replication and renderer
costs remain unmeasured. Planning checkpoints target 4 ms; terrain batches 8 ms;
parts/beams yield every 32 and props every eight. Schedule allocation is still
synchronous. These settings do not guarantee whole-build heartbeat gaps.

Before selection, Studio must measure cold/warm whole build and terrain-ready
seconds, planning/scheduling/native-call durations, largest heartbeat/yield gap,
actual descendants and missing templates. Inspect exact-start visibility, full
corridor at cruise and 600 studs/s, 64/256 LOD joins, 16-stud shoreline, lake strip
edges, hill steps/valley, tree and uploaded-building contacts, bomber bounds and
gear, runway/loop connectivity, pylon silhouettes and low mist. Verify target
separation and scramble threshold clearance with the production engine; mission
clock must remain behind completion and zero missing critical assets. Measure
client readiness, network-delay foreground availability, sustained real-phone
FPS, memory and thermals. M01's unpassed heartbeat/mobile gates remain relevant;
offline checks establish none of these visual or production results.
