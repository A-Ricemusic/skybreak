# M06 world composition — in review

2026-10-30 · dormant world key `m06_military_quays` · decisions D-160–D-163.

## Scope and evidence limits

Implements the [world sketch](m06.md) and [mission inventory evidence](../missions/m06.md). Full 32,768-stud footprint at k=0.96. **Individual coordinates and unresolved subtype totals are provisional builder choices, not measured footage positions.** No Studio, Player, phone, new footage inspection or visual acceptance is claimed. Mission catalog/unlocks, scoring, waves, hazards and service gameplay stay unselected; runtime returns `groundTargets: []`. Id-named scenery models are available for later mission integration.

## Composition

Three military basins retain the sketch anchors west (-6720,-2880), central (0,-3840), east (6720,-3840); three ships sit in the outer channel at Z=3840. Straight projecting piers, waterline HarbourQuay modules, cranes, container aprons and warehouses distinguish the waterfront. Low brown-green northern hills frame it; worker housing/fish-market scenery is separated east of the military yards. The separate friendly runway is (-6720,48,11520), 96×2880, heading north. All pavement/foundation tops are at least eight studs above sampled native terrain. Noon 12:00, grey-blue haze, opaque brown-green water, no rain.

Uses existing uploaded Frigate and FuelTanker templates for ship stand-ins (not claimed to reproduce every naval class); submarines use a procedural surfaced hull. HarbourQuay, ContainerStack and GantryCrane use `WorldAssets.PlaceUploaded`. Missing uploads receive bounded procedural stand-ins with correct yaw and waterline offset. No new asset exports/uploads occur. Class-specific ship silhouettes and naval mounts remain provisional. There are 36 naval poses, 40 yard contacts and 18 additional defence pontoons, preserving the distinction between the initial ground roster and credited ground kills. The pontoon placement is an explicit assumption; it does not claim an audited hull-mounted roster.

## Terrain and lifecycle

`CompactWorldSurface` isolates the #158 floorless approach without changing existing M01–M05 geometry. Every column has a cap at or above Y=0. Shared-edge curtains cover every height discontinuity and the perimeter outside the 16,000-stud hard boundary reaches Y=0. No continuous rock floor and no operation below Y=0. Native sea columns are water only from 0 to 32; no rock bed is touched beneath ship keels. Detail is 256 studs near the action/canyon, 1024 elsewhere. Water writes use 128-stud strips to reduce write jobs; no extra floor chunk layer is allocated. Part dimensions and scaled prop bounds stay ≤2048. Worlds use 0.25-second terrain slices, batched prop yields and registered one-native-clear teardown inside the world gate.

## Offline budgets and acceptance

Main does not yet include #158's chunk/yield estimator. Per the task, estimates use the existing M02/M03 calibration ×1.5: `3 × (jobs / 27494 × 7.915 + 1)`. This fallback does not predict water-heavy engine frame cost reliably; the ≤16-second estimate is not a load-time guarantee. Runtime measurement remains required before activation. Limits: 600,000,000 voxel writes, 15,000 jobs, 400 Parts including fallback allowance, 60 props, 2,400 descendants, estimate ≤16 s.

388,614,784 voxel writes · 8,802 jobs · 269 Parts (includes 144 naval fallback allowance) · 34 props · 1,341 reserved descendants · **10.602 s estimated**.

Checks: deterministic plans, exact sketch anchors, provisional target counts/ids, supported nonoverlapping target footprints, rotated prop supports, ship water/keel footprints, all caps/curtains and perimeter sealing, pavement clearance and Part limits; M07 also checks the low escape tube against terrain and scenery. Full `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN=... bun run validate:offline` are required. Studio deliberately not launched (signed out). Visual fidelity, actual navigation/load/cleanup timing and real-phone quality remain pending.

## Target table

All positions studs; yaw radians. IDs count a contact once, independent of its visual Part count. Scenery only; no score or activation is inferred.

| Type | Count |
|---|---:|
| aa | 10 |
| container_ship | 3 |
| containers | 7 |
| crane | 6 |
| cruiser | 9 |
| destroyer | 6 |
| frigate | 6 |
| fuel_tank | 6 |
| gas_tank | 6 |
| gun | 6 |
| landing_ship | 3 |
| missile_boat | 3 |
| sam | 10 |
| storage | 7 |
| submarine | 3 |
| supply_ship | 3 |

| Id | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m06_west_destroyer_1 | destroyer | west | -7370 | 32 | -3780 | 0 |
| m06_west_destroyer_2 | destroyer | west | -6720 | 32 | -3780 | 0 |
| m06_west_cruiser_3 | cruiser | west | -6070 | 32 | -3780 | 0 |
| m06_west_cruiser_4 | cruiser | west | -7370 | 32 | -2880 | 0 |
| m06_west_submarine_5 | submarine | west | -6720 | 32 | -2880 | 0 |
| m06_west_missile_boat_6 | missile_boat | west | -6070 | 32 | -2880 | 0 |
| m06_west_supply_ship_7 | supply_ship | west | -7370 | 32 | -1980 | 0 |
| m06_west_landing_ship_8 | landing_ship | west | -6720 | 32 | -1980 | 0 |
| m06_west_container_ship_9 | container_ship | west | -6070 | 32 | -1980 | 0 |
| m06_west_frigate_10 | frigate | west | -7370 | 32 | -1080 | 0 |
| m06_west_frigate_11 | frigate | west | -6720 | 32 | -1080 | 0 |
| m06_west_cruiser_12 | cruiser | west | -2352 | 32 | 3840 | 0 |
| m06_west_yard_crane_13 | crane | west_yard | -7320 | 48 | -6430 | 0 |
| m06_west_yard_containers_14 | containers | west_yard | -6920 | 48 | -6430 | 0 |
| m06_west_yard_fuel_tank_15 | fuel_tank | west_yard | -6520 | 48 | -6430 | 0 |
| m06_west_yard_gas_tank_16 | gas_tank | west_yard | -6120 | 48 | -6430 | 0 |
| m06_west_yard_storage_17 | storage | west_yard | -7320 | 48 | -5930 | 0 |
| m06_west_yard_aa_18 | aa | west_yard | -6920 | 48 | -5930 | 0 |
| m06_west_yard_sam_19 | sam | west_yard | -6520 | 48 | -5930 | 0 |
| m06_west_yard_containers_20 | containers | west_yard | -6120 | 48 | -5930 | 0 |
| m06_west_yard_crane_21 | crane | west_yard | -7320 | 48 | -5430 | 0 |
| m06_west_yard_fuel_tank_22 | fuel_tank | west_yard | -6920 | 48 | -5430 | 0 |
| m06_west_yard_gas_tank_23 | gas_tank | west_yard | -6520 | 48 | -5430 | 0 |
| m06_west_yard_storage_24 | storage | west_yard | -6120 | 48 | -5430 | 0 |
| m06_central_destroyer_25 | destroyer | central | -650 | 32 | -4740 | 0 |
| m06_central_destroyer_26 | destroyer | central | 0 | 32 | -4740 | 0 |
| m06_central_cruiser_27 | cruiser | central | 650 | 32 | -4740 | 0 |
| m06_central_cruiser_28 | cruiser | central | -650 | 32 | -3840 | 0 |
| m06_central_submarine_29 | submarine | central | 0 | 32 | -3840 | 0 |
| m06_central_missile_boat_30 | missile_boat | central | 650 | 32 | -3840 | 0 |
| m06_central_supply_ship_31 | supply_ship | central | -650 | 32 | -2940 | 0 |
| m06_central_landing_ship_32 | landing_ship | central | 0 | 32 | -2940 | 0 |
| m06_central_container_ship_33 | container_ship | central | 650 | 32 | -2940 | 0 |
| m06_central_frigate_34 | frigate | central | -650 | 32 | -2040 | 0 |
| m06_central_frigate_35 | frigate | central | 0 | 32 | -2040 | 0 |
| m06_central_cruiser_36 | cruiser | central | 0 | 32 | 3840 | 0 |
| m06_central_yard_crane_37 | crane | central_yard | -600 | 48 | -7390 | 0 |
| m06_central_yard_containers_38 | containers | central_yard | -200 | 48 | -7390 | 0 |
| m06_central_yard_fuel_tank_39 | fuel_tank | central_yard | 200 | 48 | -7390 | 0 |
| m06_central_yard_gas_tank_40 | gas_tank | central_yard | 600 | 48 | -7390 | 0 |
| m06_central_yard_storage_41 | storage | central_yard | -600 | 48 | -6890 | 0 |
| m06_central_yard_aa_42 | aa | central_yard | -200 | 48 | -6890 | 0 |
| m06_central_yard_sam_43 | sam | central_yard | 200 | 48 | -6890 | 0 |
| m06_central_yard_containers_44 | containers | central_yard | 600 | 48 | -6890 | 0 |
| m06_central_yard_crane_45 | crane | central_yard | -600 | 48 | -6390 | 0 |
| m06_central_yard_fuel_tank_46 | fuel_tank | central_yard | -200 | 48 | -6390 | 0 |
| m06_central_yard_gas_tank_47 | gas_tank | central_yard | 200 | 48 | -6390 | 0 |
| m06_central_yard_storage_48 | storage | central_yard | 600 | 48 | -6390 | 0 |
| m06_central_yard_aa_49 | aa | central_yard | -600 | 48 | -5890 | 0 |
| m06_central_yard_sam_50 | sam | central_yard | -200 | 48 | -5890 | 0 |
| m06_central_yard_containers_51 | containers | central_yard | 200 | 48 | -5890 | 0 |
| m06_central_yard_storage_52 | storage | central_yard | 600 | 48 | -5890 | 0 |
| m06_east_destroyer_53 | destroyer | east | 6070 | 32 | -4740 | 0 |
| m06_east_destroyer_54 | destroyer | east | 6720 | 32 | -4740 | 0 |
| m06_east_cruiser_55 | cruiser | east | 7370 | 32 | -4740 | 0 |
| m06_east_cruiser_56 | cruiser | east | 6070 | 32 | -3840 | 0 |
| m06_east_submarine_57 | submarine | east | 6720 | 32 | -3840 | 0 |
| m06_east_missile_boat_58 | missile_boat | east | 7370 | 32 | -3840 | 0 |
| m06_east_supply_ship_59 | supply_ship | east | 6070 | 32 | -2940 | 0 |
| m06_east_landing_ship_60 | landing_ship | east | 6720 | 32 | -2940 | 0 |
| m06_east_container_ship_61 | container_ship | east | 7370 | 32 | -2940 | 0 |
| m06_east_frigate_62 | frigate | east | 6070 | 32 | -2040 | 0 |
| m06_east_frigate_63 | frigate | east | 6720 | 32 | -2040 | 0 |
| m06_east_cruiser_64 | cruiser | east | 2352 | 32 | 3840 | 0 |
| m06_east_yard_crane_65 | crane | east_yard | 6120 | 48 | -7390 | 0 |
| m06_east_yard_containers_66 | containers | east_yard | 6520 | 48 | -7390 | 0 |
| m06_east_yard_fuel_tank_67 | fuel_tank | east_yard | 6920 | 48 | -7390 | 0 |
| m06_east_yard_gas_tank_68 | gas_tank | east_yard | 7320 | 48 | -7390 | 0 |
| m06_east_yard_storage_69 | storage | east_yard | 6120 | 48 | -6890 | 0 |
| m06_east_yard_aa_70 | aa | east_yard | 6520 | 48 | -6890 | 0 |
| m06_east_yard_sam_71 | sam | east_yard | 6920 | 48 | -6890 | 0 |
| m06_east_yard_containers_72 | containers | east_yard | 7320 | 48 | -6890 | 0 |
| m06_east_yard_crane_73 | crane | east_yard | 6120 | 48 | -6390 | 0 |
| m06_east_yard_fuel_tank_74 | fuel_tank | east_yard | 6520 | 48 | -6390 | 0 |
| m06_east_yard_gas_tank_75 | gas_tank | east_yard | 6920 | 48 | -6390 | 0 |
| m06_east_yard_storage_76 | storage | east_yard | 7320 | 48 | -6390 | 0 |
| m06_west_defence_gun_77 | gun | west_defence | -7190 | 48 | -3780 | 0 |
| m06_west_defence_aa_78 | aa | west_defence | -6540 | 48 | -3780 | 0 |
| m06_west_defence_sam_79 | sam | west_defence | -5890 | 48 | -3780 | 0 |
| m06_west_defence_gun_80 | gun | west_defence | -7190 | 48 | -2880 | 0 |
| m06_west_defence_aa_81 | aa | west_defence | -6540 | 48 | -2880 | 0 |
| m06_west_defence_sam_82 | sam | west_defence | -5890 | 48 | -2880 | 0 |
| m06_central_defence_gun_83 | gun | central_defence | -470 | 48 | -4740 | 0 |
| m06_central_defence_aa_84 | aa | central_defence | 180 | 48 | -4740 | 0 |
| m06_central_defence_sam_85 | sam | central_defence | 830 | 48 | -4740 | 0 |
| m06_central_defence_gun_86 | gun | central_defence | -470 | 48 | -3840 | 0 |
| m06_central_defence_aa_87 | aa | central_defence | 180 | 48 | -3840 | 0 |
| m06_central_defence_sam_88 | sam | central_defence | 830 | 48 | -3840 | 0 |
| m06_east_defence_gun_89 | gun | east_defence | 6250 | 48 | -4740 | 0 |
| m06_east_defence_aa_90 | aa | east_defence | 6900 | 48 | -4740 | 0 |
| m06_east_defence_sam_91 | sam | east_defence | 7550 | 48 | -4740 | 0 |
| m06_east_defence_gun_92 | gun | east_defence | 6250 | 48 | -3840 | 0 |
| m06_east_defence_aa_93 | aa | east_defence | 6900 | 48 | -3840 | 0 |
| m06_east_defence_sam_94 | sam | east_defence | 7550 | 48 | -3840 | 0 |
