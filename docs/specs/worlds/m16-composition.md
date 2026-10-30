# M16 The road home — procedural world in review

Implements the dormant world slice of [world spec](m16.md) and [mission spec](../missions/m16.md). Decisions D-250–D-255. Starts from latest fetched origin/main; no stacked feature dependency.

Pale daylight desert with dusty horizon, broadY80 battle corridor, distant384–512 mountain walls, recessedY48 crater near(−3840,−3840),16 low ruined-town shells near(1920,−7680), friendly column and southwest return strip(−8640,7680).

138 generic ground hardpoint slots preserve the credited aggregate without assigning unknown tank/howitzer/bunker/tent/SAM counts. Initial113 ground/13 air stay distinct from138/14 credited totals.14 optional air silhouettes preserve3 strike jets,2 attack jets,3 stealth strike jets,5 helicopters and1 strike fighter. Ground lines advance from(−1920,2880) toward the ruined town. Friendly column route is exported from(0,9600) to(1920,−7680); visible movement/zone clearance is not implemented. Runway2304×128,top94, both3200 approaches clear.

## Ownership, geometry and validation

`m16TargetLayout` exports stable ids; exact id-named Parts are grouped by CompositionWorld into scenery models. No catalog entry selects this key, missions remain unavailable, and the builder returns `groundTargets: []`. WorldEnvironment owns the environment once and registerWorldClear participates in the existing lifecycle gate. No existing mission, engine snapshot, controls, physics, approved assets or combat code changes. Temporary original procedural silhouettes are review geometry, not asset replacements. There are no Blender assets, uploads or new external dependencies.

CompactWorldSurface covers the32768-square envelope with1024-stud caps and shared-edge/perimeter curtains at/aboveY0. Sea uses only bounded distant `Sea` Parts interpreted as water; no solid seabed. Connected water is flood-filled from emitted cells; every128-stud column/edge is tested for sealing. All Part dimensions≤2048. Full foundation footprints remain≥8 above terrain, embedded at their bottoms; airfield approaches include terrain, Parts and props. No uploaded props are used.

Offline chunk/yield model at0.25-second terrain slices:0.07ms solid/0.2ms water chunk touches, modeled frame yields and3s overhead. Gate≤15s reserves≥1s against16s. Limits600M writes,15000jobs,1000Parts,0props,1800descendants. Estimates are not measurements. Plan Parts+target wrappers+scene folder total **487** instances before shared environment overhead; reserved descendant budget estimate **590** includes256 overhead. Phone suitability still requires runtime observation.

## Offline build budget

140329984 voxel writes · 4434 jobs · 72864 solid / 0 native-water chunk touches · 21 modeled yields · 334 Parts ·0props ·590 reserved descendants · **12.30048s** estimate · **3.699520s** headroom.

Offline tests cover deterministic/checkpointed plans, dormant selection, inventories, foundations, sealing, water connectivity, approach/flight obstruction, swept M18 trench/vent and open duel geometry, negative-control obstruction and budgets. Validation: frozen dependency install and build passed; full offline validator exited 0 (854 Luau contracts, 124 Python tests, plus document/UI/voice/radio/place gates). No Studio lease, Player test, phone performance measurement, audio listening or new footage inspection is claimed. Accepted specs supply reference evidence; coordinate/layout/count proposals remain labelled assumptions. Rendered comparison, real flight feel and owner acceptance remain future review gates.

## Complete exported scenery layout

Coordinates in studs; yaw radians. Ground rows reserve generic geometry where subtypes are unknown; air rows are static staging/route review silhouettes. No score or spawn semantics are implied.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m16_ground_slot_1 | unresolved_ground | line_1 | -2400.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_2 | unresolved_ground | line_1 | -1960.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_3 | unresolved_ground | line_1 | -1520.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_4 | unresolved_ground | line_1 | -1080.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_5 | unresolved_ground | line_1 | -640.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_6 | unresolved_ground | line_1 | -200.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_7 | unresolved_ground | line_1 | 240.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_8 | unresolved_ground | line_1 | 680.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_9 | unresolved_ground | line_1 | 1120.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_10 | unresolved_ground | line_1 | 1560.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_11 | unresolved_ground | line_1 | 2000.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_12 | unresolved_ground | line_1 | 2440.000 | 92.000 | 2880.000 | 0.000 |
| m16_ground_slot_13 | unresolved_ground | line_2 | -2400.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_14 | unresolved_ground | line_2 | -1960.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_15 | unresolved_ground | line_2 | -1520.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_16 | unresolved_ground | line_2 | -1080.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_17 | unresolved_ground | line_2 | -640.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_18 | unresolved_ground | line_2 | -200.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_19 | unresolved_ground | line_2 | 240.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_20 | unresolved_ground | line_2 | 680.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_21 | unresolved_ground | line_2 | 1120.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_22 | unresolved_ground | line_2 | 1560.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_23 | unresolved_ground | line_2 | 2000.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_24 | unresolved_ground | line_2 | 2440.000 | 92.000 | 1980.000 | 0.000 |
| m16_ground_slot_25 | unresolved_ground | line_3 | -2400.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_26 | unresolved_ground | line_3 | -1960.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_27 | unresolved_ground | line_3 | -1520.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_28 | unresolved_ground | line_3 | -1080.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_29 | unresolved_ground | line_3 | -640.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_30 | unresolved_ground | line_3 | -200.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_31 | unresolved_ground | line_3 | 240.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_32 | unresolved_ground | line_3 | 680.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_33 | unresolved_ground | line_3 | 1120.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_34 | unresolved_ground | line_3 | 1560.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_35 | unresolved_ground | line_3 | 2000.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_36 | unresolved_ground | line_3 | 2440.000 | 92.000 | 1080.000 | 0.000 |
| m16_ground_slot_37 | unresolved_ground | line_4 | -2400.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_38 | unresolved_ground | line_4 | -1960.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_39 | unresolved_ground | line_4 | -1520.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_40 | unresolved_ground | line_4 | -1080.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_41 | unresolved_ground | line_4 | -640.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_42 | unresolved_ground | line_4 | -200.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_43 | unresolved_ground | line_4 | 240.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_44 | unresolved_ground | line_4 | 680.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_45 | unresolved_ground | line_4 | 1120.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_46 | unresolved_ground | line_4 | 1560.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_47 | unresolved_ground | line_4 | 2000.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_48 | unresolved_ground | line_4 | 2440.000 | 92.000 | 180.000 | 0.000 |
| m16_ground_slot_49 | unresolved_ground | line_5 | -2400.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_50 | unresolved_ground | line_5 | -1960.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_51 | unresolved_ground | line_5 | -1520.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_52 | unresolved_ground | line_5 | -1080.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_53 | unresolved_ground | line_5 | -640.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_54 | unresolved_ground | line_5 | -200.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_55 | unresolved_ground | line_5 | 240.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_56 | unresolved_ground | line_5 | 680.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_57 | unresolved_ground | line_5 | 1120.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_58 | unresolved_ground | line_5 | 1560.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_59 | unresolved_ground | line_5 | 2000.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_60 | unresolved_ground | line_5 | 2440.000 | 92.000 | -720.000 | 0.000 |
| m16_ground_slot_61 | unresolved_ground | line_6 | -2400.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_62 | unresolved_ground | line_6 | -1960.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_63 | unresolved_ground | line_6 | -1520.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_64 | unresolved_ground | line_6 | -1080.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_65 | unresolved_ground | line_6 | -640.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_66 | unresolved_ground | line_6 | -200.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_67 | unresolved_ground | line_6 | 240.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_68 | unresolved_ground | line_6 | 680.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_69 | unresolved_ground | line_6 | 1120.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_70 | unresolved_ground | line_6 | 1560.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_71 | unresolved_ground | line_6 | 2000.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_72 | unresolved_ground | line_6 | 2440.000 | 92.000 | -1620.000 | 0.000 |
| m16_ground_slot_73 | unresolved_ground | line_7 | -2400.000 | 60.000 | -2520.000 | 0.000 |
| m16_ground_slot_74 | unresolved_ground | line_7 | -1960.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_75 | unresolved_ground | line_7 | -1520.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_76 | unresolved_ground | line_7 | -1080.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_77 | unresolved_ground | line_7 | -640.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_78 | unresolved_ground | line_7 | -200.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_79 | unresolved_ground | line_7 | 240.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_80 | unresolved_ground | line_7 | 680.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_81 | unresolved_ground | line_7 | 1120.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_82 | unresolved_ground | line_7 | 1560.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_83 | unresolved_ground | line_7 | 2000.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_84 | unresolved_ground | line_7 | 2440.000 | 92.000 | -2520.000 | 0.000 |
| m16_ground_slot_85 | unresolved_ground | line_8 | -2400.000 | 60.000 | -3420.000 | 0.000 |
| m16_ground_slot_86 | unresolved_ground | line_8 | -1960.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_87 | unresolved_ground | line_8 | -1520.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_88 | unresolved_ground | line_8 | -1080.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_89 | unresolved_ground | line_8 | -640.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_90 | unresolved_ground | line_8 | -200.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_91 | unresolved_ground | line_8 | 240.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_92 | unresolved_ground | line_8 | 680.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_93 | unresolved_ground | line_8 | 1120.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_94 | unresolved_ground | line_8 | 1560.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_95 | unresolved_ground | line_8 | 2000.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_96 | unresolved_ground | line_8 | 2440.000 | 92.000 | -3420.000 | 0.000 |
| m16_ground_slot_97 | unresolved_ground | line_9 | -2400.000 | 60.000 | -4320.000 | 0.000 |
| m16_ground_slot_98 | unresolved_ground | line_9 | -1960.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_99 | unresolved_ground | line_9 | -1520.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_100 | unresolved_ground | line_9 | -1080.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_101 | unresolved_ground | line_9 | -640.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_102 | unresolved_ground | line_9 | -200.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_103 | unresolved_ground | line_9 | 240.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_104 | unresolved_ground | line_9 | 680.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_105 | unresolved_ground | line_9 | 1120.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_106 | unresolved_ground | line_9 | 1560.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_107 | unresolved_ground | line_9 | 2000.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_108 | unresolved_ground | line_9 | 2440.000 | 92.000 | -4320.000 | 0.000 |
| m16_ground_slot_109 | unresolved_ground | line_10 | -2400.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_110 | unresolved_ground | line_10 | -1960.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_111 | unresolved_ground | line_10 | -1520.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_112 | unresolved_ground | line_10 | -1080.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_113 | unresolved_ground | line_10 | -640.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_114 | unresolved_ground | line_10 | -200.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_115 | unresolved_ground | line_10 | 240.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_116 | unresolved_ground | line_10 | 680.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_117 | unresolved_ground | line_10 | 1120.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_118 | unresolved_ground | line_10 | 1560.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_119 | unresolved_ground | line_10 | 2000.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_120 | unresolved_ground | line_10 | 2440.000 | 92.000 | -5220.000 | 0.000 |
| m16_ground_slot_121 | unresolved_ground | line_11 | -2400.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_122 | unresolved_ground | line_11 | -1960.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_123 | unresolved_ground | line_11 | -1520.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_124 | unresolved_ground | line_11 | -1080.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_125 | unresolved_ground | line_11 | -640.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_126 | unresolved_ground | line_11 | -200.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_127 | unresolved_ground | line_11 | 240.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_128 | unresolved_ground | line_11 | 680.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_129 | unresolved_ground | line_11 | 1120.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_130 | unresolved_ground | line_11 | 1560.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_131 | unresolved_ground | line_11 | 2000.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_132 | unresolved_ground | line_11 | 2440.000 | 92.000 | -6120.000 | 0.000 |
| m16_ground_slot_133 | unresolved_ground | line_12 | -2400.000 | 92.000 | -7020.000 | 0.000 |
| m16_ground_slot_134 | unresolved_ground | line_12 | -1960.000 | 92.000 | -7020.000 | 0.000 |
| m16_ground_slot_135 | unresolved_ground | line_12 | -1520.000 | 92.000 | -7020.000 | 0.000 |
| m16_ground_slot_136 | unresolved_ground | line_12 | -1080.000 | 92.000 | -7020.000 | 0.000 |
| m16_ground_slot_137 | unresolved_ground | line_12 | -640.000 | 92.000 | -7020.000 | 0.000 |
| m16_ground_slot_138 | unresolved_ground | line_12 | -200.000 | 92.000 | -7020.000 | 0.000 |
| m16_air_1 | strike_jet | air_cover | -4000.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_2 | strike_jet | air_cover | -2800.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_3 | strike_jet | air_cover | -1600.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_4 | attack_jet | air_cover | -400.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_5 | attack_jet | air_cover | 800.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_6 | stealth_strike | air_cover | 2000.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_7 | stealth_strike | air_cover | 3200.000 | 600.000 | -10000.000 | 0.000 |
| m16_air_8 | stealth_strike | air_cover | -4000.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_9 | attack_helicopter | air_cover | -2800.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_10 | attack_helicopter | air_cover | -1600.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_11 | attack_helicopter | air_cover | -400.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_12 | attack_helicopter | air_cover | 800.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_13 | attack_helicopter | air_cover | 2000.000 | 900.000 | -10600.000 | 0.000 |
| m16_air_14 | strike_fighter | air_cover | 3200.000 | 900.000 | -10600.000 | 0.000 |
