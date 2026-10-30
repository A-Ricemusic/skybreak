# M15 A city answers — procedural world in review

Implements the dormant world slice of [world spec](m15.md) and [mission spec](../missions/m15.md). Decisions D-250–D-255. Starts from latest fetched origin/main; no stacked feature dependency.

Warm brown night haze over lit road-spaced city blocks, a connected north–south river (X1024–2048), two bridges, original three-Part arch at(−3840,−2880), civic broadcast building at(2880,−4800) and western airfield(−4800,−9600). Simple blocks and single Neon window bands avoid per-window geometry/lights.

62 initial unresolved ground slots are distinct from53 credited ground kills. The command relay replaces one of these62 and is placed beside the broadcast building; no invented ground subtype distribution or extra relay kill. Seven separate parked transport slots and six northwest bomber routes are exported; four helicopter/two attack-jet/one fighter/one ace review slots remain non-combat scenery. Bomber routes start near(−9600,−13440) and end at(2880,−4800),Y≥900. Service runway2304×128,top94 over foundation92, both3200 approaches checked. Mission score≥2000 at city-phase expiry and late retaliation logic remain integration work.

## Ownership, geometry and validation

`m15TargetLayout` exports stable ids; exact id-named Parts are grouped by CompositionWorld into scenery models. No catalog entry selects this key, missions remain unavailable, and the builder returns `groundTargets: []`. WorldEnvironment owns the environment once and registerWorldClear participates in the existing lifecycle gate. No existing mission, engine snapshot, controls, physics, approved assets or combat code changes. Temporary original procedural silhouettes are review geometry, not asset replacements. There are no Blender assets, uploads or new external dependencies.

CompactWorldSurface covers the32768-square envelope with1024-stud caps and shared-edge/perimeter curtains at/aboveY0. Sea uses only bounded distant `Sea` Parts interpreted as water; no solid seabed. Connected water is flood-filled from emitted cells; every128-stud column/edge is tested for sealing. All Part dimensions≤2048. Full foundation footprints remain≥8 above terrain, embedded at their bottoms; airfield approaches include terrain, Parts and props. No uploaded props are used.

Offline chunk/yield model at0.25-second terrain slices:0.07ms solid/0.2ms water chunk touches, modeled frame yields and3s overhead. Gate≤15s reserves≥1s against16s. Limits600M writes,15000jobs,1000Parts,0props,1800descendants. Estimates are not measurements. Plan Parts+target wrappers+scene folder total **385** instances before shared environment overhead; reserved descendant budget estimate **557** includes256 overhead. Phone suitability still requires runtime observation.

## Offline build budget

130902016 voxel writes · 4160 jobs · 65024 solid / 0 native-water chunk touches · 19 modeled yields · 301 Parts ·0props ·557 reserved descendants · **11.35168s** estimate · **4.648320s** headroom.

Offline tests cover deterministic/checkpointed plans, dormant selection, inventories, foundations, sealing, water connectivity, approach/flight obstruction, swept M18 trench/vent and open duel geometry, negative-control obstruction and budgets. Validation: frozen dependency install and build passed; full offline validator exited 0 (854 Luau contracts, 124 Python tests, plus document/UI/voice/radio/place gates). No Studio lease, Player test, phone performance measurement, audio listening or new footage inspection is claimed. Accepted specs supply reference evidence; coordinate/layout/count proposals remain labelled assumptions. Rendered comparison, real flight feel and owner acceptance remain future review gates.

## Complete exported scenery layout

Coordinates in studs; yaw radians. Ground rows reserve generic geometry where subtypes are unknown; air rows are static staging/route review silhouettes. No score or spawn semantics are implied.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m15_command_relay | command_relay | city | 2880.000 | 92.000 | -4800.000 | 0.000 |
| m15_ground_slot_2 | unresolved_ground | city | -6300.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_3 | unresolved_ground | city | -5400.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_4 | unresolved_ground | city | -4500.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_5 | unresolved_ground | city | -3600.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_6 | unresolved_ground | city | -2700.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_7 | unresolved_ground | city | -1800.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_8 | unresolved_ground | city | -900.000 | 92.000 | -6000.000 | 0.000 |
| m15_ground_slot_9 | unresolved_ground | city | -7200.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_10 | unresolved_ground | city | -6300.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_11 | unresolved_ground | city | -5400.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_12 | unresolved_ground | city | -4500.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_13 | unresolved_ground | city | -3600.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_14 | unresolved_ground | city | -2700.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_15 | unresolved_ground | city | -1800.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_16 | unresolved_ground | city | -900.000 | 92.000 | -5000.000 | 0.000 |
| m15_ground_slot_17 | unresolved_ground | city | -7200.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_18 | unresolved_ground | city | -6300.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_19 | unresolved_ground | city | -5400.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_20 | unresolved_ground | city | -4500.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_21 | unresolved_ground | city | -3600.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_22 | unresolved_ground | city | -2700.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_23 | unresolved_ground | city | -1800.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_24 | unresolved_ground | city | -900.000 | 92.000 | -4000.000 | 0.000 |
| m15_ground_slot_25 | unresolved_ground | city | -7200.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_26 | unresolved_ground | city | -6300.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_27 | unresolved_ground | city | -5400.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_28 | unresolved_ground | city | -4500.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_29 | unresolved_ground | city | -3600.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_30 | unresolved_ground | city | -2700.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_31 | unresolved_ground | city | -1800.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_32 | unresolved_ground | city | -900.000 | 92.000 | -3000.000 | 0.000 |
| m15_ground_slot_33 | unresolved_ground | city | -7200.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_34 | unresolved_ground | city | -6300.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_35 | unresolved_ground | city | -5400.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_36 | unresolved_ground | city | -4500.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_37 | unresolved_ground | city | -3600.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_38 | unresolved_ground | city | -2700.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_39 | unresolved_ground | city | -1800.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_40 | unresolved_ground | city | -900.000 | 92.000 | -2000.000 | 0.000 |
| m15_ground_slot_41 | unresolved_ground | city | -7200.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_42 | unresolved_ground | city | -6300.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_43 | unresolved_ground | city | -5400.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_44 | unresolved_ground | city | -4500.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_45 | unresolved_ground | city | -3600.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_46 | unresolved_ground | city | -2700.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_47 | unresolved_ground | city | -1800.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_48 | unresolved_ground | city | -900.000 | 92.000 | -1000.000 | 0.000 |
| m15_ground_slot_49 | unresolved_ground | city | -7200.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_50 | unresolved_ground | city | -6300.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_51 | unresolved_ground | city | -5400.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_52 | unresolved_ground | city | -4500.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_53 | unresolved_ground | city | -3600.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_54 | unresolved_ground | city | -2700.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_55 | unresolved_ground | city | -1800.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_56 | unresolved_ground | city | -900.000 | 92.000 | 0.000 | 0.000 |
| m15_ground_slot_57 | unresolved_ground | city | -7200.000 | 92.000 | 1000.000 | 0.000 |
| m15_ground_slot_58 | unresolved_ground | city | -6300.000 | 92.000 | 1000.000 | 0.000 |
| m15_ground_slot_59 | unresolved_ground | city | -5400.000 | 92.000 | 1000.000 | 0.000 |
| m15_ground_slot_60 | unresolved_ground | city | -4500.000 | 92.000 | 1000.000 | 0.000 |
| m15_ground_slot_61 | unresolved_ground | city | -3600.000 | 92.000 | 1000.000 | 0.000 |
| m15_ground_slot_62 | unresolved_ground | city | -2700.000 | 92.000 | 1000.000 | 0.000 |
| m15_transport_1 | parked_transport | airfield | -5400.000 | 92.000 | -10400.000 | 0.000 |
| m15_transport_2 | parked_transport | airfield | -5400.000 | 92.000 | -10140.000 | 0.000 |
| m15_transport_3 | parked_transport | airfield | -5400.000 | 92.000 | -9880.000 | 0.000 |
| m15_transport_4 | parked_transport | airfield | -5400.000 | 92.000 | -9620.000 | 0.000 |
| m15_transport_5 | parked_transport | airfield | -5400.000 | 92.000 | -9360.000 | 0.000 |
| m15_transport_6 | parked_transport | airfield | -5400.000 | 92.000 | -9100.000 | 0.000 |
| m15_transport_7 | parked_transport | airfield | -5400.000 | 92.000 | -8840.000 | 0.000 |
| m15_bomber_1 | bomber | retaliation | -9600.000 | 1300.000 | -13440.000 | 0.000 |
| m15_bomber_2 | bomber | retaliation | -9360.000 | 1360.000 | -13440.000 | 0.000 |
| m15_bomber_3 | bomber | retaliation | -9120.000 | 1420.000 | -13440.000 | 0.000 |
| m15_bomber_4 | bomber | retaliation | -8880.000 | 1480.000 | -13440.000 | 0.000 |
| m15_bomber_5 | bomber | retaliation | -8640.000 | 1540.000 | -13440.000 | 0.000 |
| m15_bomber_6 | bomber | retaliation | -8400.000 | 1600.000 | -13440.000 | 0.000 |
| m15_air_1 | city_helicopter | optional_air | -6000.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_2 | city_helicopter | optional_air | -5200.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_3 | city_helicopter | optional_air | -4400.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_4 | city_helicopter | optional_air | -3600.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_5 | attack_jet | optional_air | -2800.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_6 | attack_jet | optional_air | -2000.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_7 | fighter | optional_air | -1200.000 | 600.000 | 2000.000 | 0.000 |
| m15_air_8 | named_ace_slot | optional_air | -400.000 | 600.000 | 2000.000 | 0.000 |
