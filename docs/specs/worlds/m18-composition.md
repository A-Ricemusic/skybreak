# M18 The voice breaks — procedural world in review

Implements the dormant world slice of [world spec](m18.md) and [mission spec](../missions/m18.md). Decisions D-250–D-255. Starts from latest fetched origin/main; no stacked feature dependency.

Grey storm08:00,90% cloud cover,9000ft metadata and rain environment. Water surrounds a low original angular coastal works. Three covered grooves atX−1920/0/1920 lead2880studs from mouths to distinct generators. FloorsY104, roofs underside244, width180 and clear height140. Original buttresses remain belowY320.

Three generator ids and the separate central core are exported. The core is at(−130,174,−4000), intentionally moved from the centreline to the vent wall to keep an aircraft escape tube open. Central entry is a separate vertical aperture at(0,−3400); descend617→174, pass the core, exit independently north toZ−7000, then climb to(0,1000,−7600). Covered central stretch is−4200…−6000; entry/exit roof gaps are explicit. Swept24-stud envelope tests every segment plus terrain; generator grooves use a40-stud swept envelope ending before each solid target. The central clear width is328, widened for the independent core-side clearance. No target is an aircraft checkpoint.11 optional elite fighters, one named-ace slot and four ascending-missile slots are review capacity, not proven full deployed counts. Original Rusk duel arena centre(0,−2880),radius5760,Y800–2400,5:00; solid geometry/terrain is tested throughout. Rusk is spawned by future mission logic, never as a second pre-duel enemy world model. Generator/core dependency, roof weapon occlusion, safe exit objective, no-other-fire cleanup, player damage/rack/charge/regeneration continuity and finale gating are not implemented by scenery. Assault20:00/core30:00 are metadata.

## Ownership, geometry and validation

`m18TargetLayout` exports stable ids; exact id-named Parts are grouped by CompositionWorld into scenery models. No catalog entry selects this key, missions remain unavailable, and the builder returns `groundTargets: []`. WorldEnvironment owns the environment once and registerWorldClear participates in the existing lifecycle gate. No existing mission, engine snapshot, controls, physics, approved assets or combat code changes. Temporary original procedural silhouettes are review geometry, not asset replacements. There are no Blender assets, uploads or new external dependencies.

CompactWorldSurface covers the32768-square envelope with1024-stud caps and shared-edge/perimeter curtains at/aboveY0. Sea uses only bounded distant `Sea` Parts interpreted as water; no solid seabed. Connected water is flood-filled from emitted cells; every128-stud column/edge is tested for sealing. All Part dimensions≤2048. Full foundation footprints remain≥8 above terrain, embedded at their bottoms; airfield approaches include terrain, Parts and props. No uploaded props are used.

Offline chunk/yield model at0.25-second terrain slices:0.07ms solid/0.2ms water chunk touches, modeled frame yields and3s overhead. Gate≤15s reserves≥1s against16s. Limits600M writes,15000jobs,1000Parts,0props,1800descendants. Estimates are not measurements. Plan Parts+target wrappers+scene folder total **345** instances before shared environment overhead; reserved descendant budget estimate **580** includes256 overhead. Phone suitability still requires runtime observation.

## Offline build budget

6653952 voxel writes · 348 jobs · 4320 solid / 0 native-water chunk touches · 2 modeled yields · 324 Parts ·0props ·580 reserved descendants · **3.7024s** estimate · **12.297600s** headroom.

Offline tests cover deterministic/checkpointed plans, dormant selection, inventories, foundations, sealing, water connectivity, approach/flight obstruction, swept M18 trench/vent and open duel geometry, negative-control obstruction and budgets. Validation: frozen dependency install and build passed; full offline validator exited 0 (856 Luau contracts, 124 Python tests, plus document/UI/voice/radio/place gates). No Studio lease, Player test, phone performance measurement, audio listening or new footage inspection is claimed. Accepted specs supply reference evidence; coordinate/layout/count proposals remain labelled assumptions. Rendered comparison, real flight feel and owner acceptance remain future review gates.

## Independent-review corrections

All13 groove/vent floor modules are now grounded structural columns from Y0 to the unchanged deckY104. Groove width244 carries both wall footprints; vent width392 carries its full walls/core and local over-water exit foundation. Generator-end supports extend40studs beyond the groove end to carry the complete generator footprint. The core extends from deck104 to ceiling244, off the aircraft tube. This adds no ocean-wide solid seabed and preserves water-only Sea Parts. Explicit structural-role tests cover full sampled footprints, count13, wall/target/buttress support, plus the existing swept groove/vent/duel checks; they cannot pass by finding zero Parts named foundation. Part/descendant counts and terrain estimator remain unchanged.

Shared weather resolution now handles all18 registered world keys, including M18 storm/phone overcast and M14 aurora. M05–M13 also crashed under the old client lookup; the registry fixes them in this PR.

## Complete exported scenery layout

Coordinates in studs; yaw radians. Ground rows reserve generic geometry where subtypes are unknown; air rows are static staging/route review silhouettes. No score or spawn semantics are implied.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m18_generator_1 | generator | groove_1 | -1920.000 | 104.000 | -2880.000 | 0.000 |
| m18_generator_2 | generator | groove_2 | 0.000 | 104.000 | -2880.000 | 0.000 |
| m18_generator_3 | generator | groove_3 | 1920.000 | 104.000 | -2880.000 | 0.000 |
| m18_core | core | vent | -130.000 | 174.000 | -4000.000 | 0.000 |
| m18_air_1 | elite_fighter | optional_air | -10000.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_2 | elite_fighter | optional_air | -9300.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_3 | elite_fighter | optional_air | -8600.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_4 | elite_fighter | optional_air | -7900.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_5 | elite_fighter | optional_air | -7200.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_6 | elite_fighter | optional_air | -6500.000 | 500.000 | 4000.000 | 0.000 |
| m18_air_7 | elite_fighter | optional_air | -10000.000 | 500.000 | 4800.000 | 0.000 |
| m18_air_8 | elite_fighter | optional_air | -9300.000 | 500.000 | 4800.000 | 0.000 |
| m18_air_9 | elite_fighter | optional_air | -8600.000 | 500.000 | 4800.000 | 0.000 |
| m18_air_10 | elite_fighter | optional_air | -7900.000 | 500.000 | 4800.000 | 0.000 |
| m18_air_11 | elite_fighter | optional_air | -7200.000 | 500.000 | 4800.000 | 0.000 |
| m18_air_12 | named_ace_slot | optional_air | -6500.000 | 500.000 | 4800.000 | 0.000 |
| m18_ascending_1 | ascending_missile_slot | optional_missile | 5000.000 | 400.000 | -4000.000 | 0.000 |
| m18_ascending_2 | ascending_missile_slot | optional_missile | 5400.000 | 400.000 | -4000.000 | 0.000 |
| m18_ascending_3 | ascending_missile_slot | optional_missile | 5800.000 | 400.000 | -4000.000 | 0.000 |
| m18_ascending_4 | ascending_missile_slot | optional_missile | 6200.000 | 400.000 | -4000.000 | 0.000 |
