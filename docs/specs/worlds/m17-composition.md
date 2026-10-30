# M17 Capital assault — procedural world in review

Implements the dormant world slice of [world spec](m17.md) and [mission spec](../missions/m17.md). Decisions D-250–D-255. Starts from latest fetched origin/main; no stacked feature dependency.

Gold low sun over a partially drowned capital, open western bay, two connected channel arms, sparse submerged shells around(−4800,0), eastern downtown, parliament/quay at(1920,−6720) and distinct friendly(3840,−960)/enemy(−1920,−4800) bridges. Channel raster and enemy-bank islands are authored coarse collision adaptations.

55 generic credited-ground slots remain distinct from34 initial ground contacts. Four hull slots deliberately leave unresolved ship identities unresolved; they own no weapon subtarget or duplicate score.18 ordinary air review slots, four Rusk wingmen and Rusk's separate retreat silhouette are exported. Open elite battle(0,1200,−3840) to retreat(−13440,1200,−3840) has a swept100-stud clearance tube. Retreat≤25% health/lethal clamping, no retreat score and surviving-wingmen requirements remain mission-owned. City uses simple primitive shells with no per-window lights.

## Ownership, geometry and validation

`m17TargetLayout` exports stable ids; exact id-named Parts are grouped by CompositionWorld into scenery models. No catalog entry selects this key, missions remain unavailable, and the builder returns `groundTargets: []`. WorldEnvironment owns the environment once and registerWorldClear participates in the existing lifecycle gate. No existing mission, engine snapshot, controls, physics, approved assets or combat code changes. Temporary original procedural silhouettes are review geometry, not asset replacements. There are no Blender assets, uploads or new external dependencies.

CompactWorldSurface covers the32768-square envelope with1024-stud caps and shared-edge/perimeter curtains at/aboveY0. Sea uses only bounded distant `Sea` Parts interpreted as water; no solid seabed. Connected water is flood-filled from emitted cells; every128-stud column/edge is tested for sealing. All Part dimensions≤2048. Full foundation footprints remain≥8 above terrain, embedded at their bottoms; airfield approaches include terrain, Parts and props. No uploaded props are used.

Offline chunk/yield model at0.25-second terrain slices:0.07ms solid/0.2ms water chunk touches, modeled frame yields and3s overhead. Gate≤15s reserves≥1s against16s. Limits600M writes,15000jobs,1000Parts,0props,1800descendants. Estimates are not measurements. Plan Parts+target wrappers+scene folder total **432** instances before shared environment overhead; reserved descendant budget estimate **605** includes256 overhead. Phone suitability still requires runtime observation.

## Offline build budget

63863296 voxel writes · 2153 jobs · 32616 solid / 0 native-water chunk touches · 10 modeled yields · 349 Parts ·0props ·605 reserved descendants · **7.28312s** estimate · **8.716880s** headroom.

Offline tests cover deterministic/checkpointed plans, dormant selection, inventories, foundations, sealing, water connectivity, approach/flight obstruction, swept M18 trench/vent and open duel geometry, negative-control obstruction and budgets. Validation: frozen dependency install and build passed; full offline validator exited 0 (854 Luau contracts, 124 Python tests, plus document/UI/voice/radio/place gates). No Studio lease, Player test, phone performance measurement, audio listening or new footage inspection is claimed. Accepted specs supply reference evidence; coordinate/layout/count proposals remain labelled assumptions. Rendered comparison, real flight feel and owner acceptance remain future review gates.

## Complete exported scenery layout

Coordinates in studs; yaw radians. Ground rows reserve generic geometry where subtypes are unknown; air rows are static staging/route review silhouettes. No score or spawn semantics are implied.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m17_ground_slot_1 | unresolved_ground | capital | 1300.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_2 | unresolved_ground | capital | 2100.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_3 | unresolved_ground | capital | 2900.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_4 | unresolved_ground | capital | 3700.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_5 | unresolved_ground | capital | 4500.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_6 | unresolved_ground | capital | 5300.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_7 | unresolved_ground | capital | 6100.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_8 | unresolved_ground | capital | 6900.000 | 92.000 | -7200.000 | 0.000 |
| m17_ground_slot_9 | unresolved_ground | capital | 1300.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_10 | unresolved_ground | capital | 2100.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_11 | unresolved_ground | capital | 2900.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_12 | unresolved_ground | capital | 3700.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_13 | unresolved_ground | capital | 4500.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_14 | unresolved_ground | capital | 5300.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_15 | unresolved_ground | capital | 6100.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_16 | unresolved_ground | capital | 6900.000 | 44.000 | -5800.000 | 0.000 |
| m17_ground_slot_17 | unresolved_ground | capital | 1300.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_18 | unresolved_ground | capital | 2100.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_19 | unresolved_ground | capital | 2900.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_20 | unresolved_ground | capital | 3700.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_21 | unresolved_ground | capital | 4500.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_22 | unresolved_ground | capital | 5300.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_23 | unresolved_ground | capital | 6100.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_24 | unresolved_ground | capital | 6900.000 | 44.000 | -4400.000 | 0.000 |
| m17_ground_slot_25 | unresolved_ground | capital | 1300.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_26 | unresolved_ground | capital | 2100.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_27 | unresolved_ground | capital | 2900.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_28 | unresolved_ground | capital | 3700.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_29 | unresolved_ground | capital | 4500.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_30 | unresolved_ground | capital | 5300.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_31 | unresolved_ground | capital | 6100.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_32 | unresolved_ground | capital | 6900.000 | 92.000 | -3000.000 | 0.000 |
| m17_ground_slot_33 | unresolved_ground | capital | 1300.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_34 | unresolved_ground | capital | 2100.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_35 | unresolved_ground | capital | 2900.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_36 | unresolved_ground | capital | 3700.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_37 | unresolved_ground | capital | 4500.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_38 | unresolved_ground | capital | 5300.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_39 | unresolved_ground | capital | 6100.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_40 | unresolved_ground | capital | 6900.000 | 44.000 | -1600.000 | 0.000 |
| m17_ground_slot_41 | unresolved_ground | capital | 1300.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_42 | unresolved_ground | capital | 2100.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_43 | unresolved_ground | capital | 2900.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_44 | unresolved_ground | capital | 3700.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_45 | unresolved_ground | capital | 4500.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_46 | unresolved_ground | capital | 5300.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_47 | unresolved_ground | capital | 6100.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_48 | unresolved_ground | capital | 6900.000 | 44.000 | -200.000 | 0.000 |
| m17_ground_slot_49 | unresolved_ground | capital | 1300.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_50 | unresolved_ground | capital | 2100.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_51 | unresolved_ground | capital | 2900.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_52 | unresolved_ground | capital | 3700.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_53 | unresolved_ground | capital | 4500.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_54 | unresolved_ground | capital | 5300.000 | 92.000 | 1200.000 | 0.000 |
| m17_ground_slot_55 | unresolved_ground | capital | 6100.000 | 92.000 | 1200.000 | 0.000 |
| m17_hull_1 | unresolved_hull | naval | -9000.000 | 40.000 | -2400.000 | 0.000 |
| m17_hull_2 | unresolved_hull | naval | -7200.000 | 40.000 | -2400.000 | 0.000 |
| m17_hull_3 | unresolved_hull | naval | -5400.000 | 40.000 | -2400.000 | 0.000 |
| m17_hull_4 | unresolved_hull | naval | -3600.000 | 40.000 | -2400.000 | 0.000 |
| m17_rusk_wingman_1 | elite_wingman | elite | -1800.000 | 1200.000 | -3840.000 | 0.000 |
| m17_rusk_wingman_2 | elite_wingman | elite | -600.000 | 1200.000 | -3840.000 | 0.000 |
| m17_rusk_wingman_3 | elite_wingman | elite | 600.000 | 1200.000 | -3840.000 | 0.000 |
| m17_rusk_wingman_4 | elite_wingman | elite | 1800.000 | 1200.000 | -3840.000 | 0.000 |
| m17_air_1 | attack_helicopter | optional_air | -10000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_2 | attack_helicopter | optional_air | -9000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_3 | attack_helicopter | optional_air | -8000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_4 | attack_helicopter | optional_air | -7000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_5 | fighter | optional_air | -6000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_6 | fighter | optional_air | -5000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_7 | fighter | optional_air | -4000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_8 | fighter | optional_air | -3000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_9 | active_fighter | optional_air | -2000.000 | 650.000 | 4000.000 | 0.000 |
| m17_air_10 | active_fighter | optional_air | -10000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_11 | active_fighter | optional_air | -9000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_12 | tiltrotor | optional_air | -8000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_13 | tiltrotor | optional_air | -7000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_14 | tiltrotor | optional_air | -6000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_15 | tiltrotor | optional_air | -5000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_16 | s37_slot | optional_air | -4000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_17 | euro_fighter | optional_air | -3000.000 | 650.000 | 4800.000 | 0.000 |
| m17_air_18 | euro_fighter | optional_air | -2000.000 | 650.000 | 4800.000 | 0.000 |
| m17_rusk | rusk_retreat | elite | 0.000 | 1200.000 | -3840.000 | 0.000 |
