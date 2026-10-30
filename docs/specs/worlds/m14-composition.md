# M14 Aurora shield — procedural world in review

Implements the dormant world slice of [world spec](m14.md) and [mission spec](../missions/m14.md). Decisions D-250–D-255. Starts from latest fetched origin/main; no stacked feature dependency.

Dark polar coast with western black-water ice fields, eastern Snow glacier wall and rough 512–640-stud ridges. Southern station shelf is128. Night02:56,10% thin cirrus proxy,14,000ft cloud metadata and aurora. Native Roblox cloud optics are a proxy, not a physical cirrus layer.

The16 missile ids represent15 ordinary/child credited-kill slots and one200-point final weapon, never16 initial carriers. Three optional stealth fighters and one strategic bomber are review silhouettes; split predicates and operational routes remain mission work. Four low flight tubes run north-to-south atY150 fromZ−7680 to8800. Station(1920,9600) is friendly scenery, not a score actor. Sparse floes stay west of the intercept tubes. Crown support is44 above water32; dish pedestal and reflector form one id-owned model.

## Ownership, geometry and validation

`m14TargetLayout` exports stable ids; exact id-named Parts are grouped by CompositionWorld into scenery models. No catalog entry selects this key, missions remain unavailable, and the builder returns `groundTargets: []`. WorldEnvironment owns the environment once and registerWorldClear participates in the existing lifecycle gate. No existing mission, engine snapshot, controls, physics, approved assets or combat code changes. Temporary original procedural silhouettes are review geometry, not asset replacements. There are no Blender assets, uploads or new external dependencies.

CompactWorldSurface covers the32768-square envelope with1024-stud caps and shared-edge/perimeter curtains at/aboveY0. Sea uses only bounded distant `Sea` Parts interpreted as water; no solid seabed. Connected water is flood-filled from emitted cells; every128-stud column/edge is tested for sealing. All Part dimensions≤2048. Full foundation footprints remain≥8 above terrain, embedded at their bottoms; airfield approaches include terrain, Parts and props. No uploaded props are used.

Offline chunk/yield model at0.25-second terrain slices:0.07ms solid/0.2ms water chunk touches, modeled frame yields and3s overhead. Gate≤15s reserves≥1s against16s. Limits600M writes,15000jobs,1000Parts,0props,1800descendants. Estimates are not measurements. Plan Parts+target wrappers+scene folder total **241** instances before shared environment overhead; reserved descendant budget estimate **475** includes256 overhead. Phone suitability still requires runtime observation.

## Offline build budget

58628608 voxel writes · 1909 jobs · 31736 solid / 0 native-water chunk touches · 9 modeled yields · 219 Parts ·0props ·475 reserved descendants · **7.02152s** estimate · **8.978480s** headroom.

Offline tests cover deterministic/checkpointed plans, dormant selection, inventories, foundations, sealing, water connectivity, approach/flight obstruction, swept M18 trench/vent and open duel geometry, negative-control obstruction and budgets. Validation: frozen dependency install and build passed; full offline validator exited 0 (856 Luau contracts, 124 Python tests, plus document/UI/voice/radio/place gates). No Studio lease, Player test, phone performance measurement, audio listening or new footage inspection is claimed. Accepted specs supply reference evidence; coordinate/layout/count proposals remain labelled assumptions. Rendered comparison, real flight feel and owner acceptance remain future review gates.

Shared weather review correction: all M01–M18 world keys now resolve through the client environment registry, including the previously broken M05–M13 keys. Offline weather tests iterate every registered environment and verify effects, safe unknown names and phone cloud trimming; static coverage is checked against the server world registrations.

## Complete exported scenery layout

Coordinates in studs; yaw radians. Ground rows reserve generic geometry where subtypes are unknown; air rows are static staging/route review silhouettes. No score or spawn semantics are implied.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m14_cruise_1 | cruise_slot | intercept | 1200.000 | 150.000 | -7680.000 | 0.000 |
| m14_cruise_2 | cruise_slot | intercept | 1440.000 | 150.000 | -7040.000 | 0.000 |
| m14_cruise_3 | cruise_slot | intercept | 1680.000 | 150.000 | -6400.000 | 0.000 |
| m14_cruise_4 | cruise_slot | intercept | 1200.000 | 150.000 | -5760.000 | 0.000 |
| m14_cruise_5 | cruise_slot | intercept | 1440.000 | 150.000 | -5120.000 | 0.000 |
| m14_cruise_6 | cruise_slot | intercept | 1680.000 | 150.000 | -4480.000 | 0.000 |
| m14_cruise_7 | cruise_slot | intercept | 1200.000 | 150.000 | -3840.000 | 0.000 |
| m14_cruise_8 | cruise_slot | intercept | 1440.000 | 150.000 | -3200.000 | 0.000 |
| m14_cruise_9 | cruise_slot | intercept | 1680.000 | 150.000 | -2560.000 | 0.000 |
| m14_cruise_10 | cruise_slot | intercept | 1200.000 | 150.000 | -1920.000 | 0.000 |
| m14_cruise_11 | cruise_slot | intercept | 1440.000 | 150.000 | -1280.000 | 0.000 |
| m14_cruise_12 | cruise_slot | intercept | 1680.000 | 150.000 | -640.000 | 0.000 |
| m14_cruise_13 | cruise_slot | intercept | 1200.000 | 150.000 | 0.000 | 0.000 |
| m14_cruise_14 | cruise_slot | intercept | 1440.000 | 150.000 | 640.000 | 0.000 |
| m14_cruise_15 | cruise_slot | intercept | 1680.000 | 150.000 | 1280.000 | 0.000 |
| m14_cruise_16 | high_value_cruise | intercept | 1200.000 | 150.000 | 1920.000 | 0.000 |
| m14_air_1 | stealth_fighter | optional_air | -4800.000 | 900.000 | -6000.000 | 0.000 |
| m14_air_2 | stealth_fighter | optional_air | -3600.000 | 900.000 | -6000.000 | 0.000 |
| m14_air_3 | stealth_fighter | optional_air | -2400.000 | 900.000 | -6000.000 | 0.000 |
| m14_air_4 | strategic_bomber | optional_air | -1200.000 | 1800.000 | -6000.000 | 0.000 |
| m14_crown_station | friendly_dish | protected | 1920.000 | 80.000 | 9600.000 | 0.000 |
