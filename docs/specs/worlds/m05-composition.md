# M05 dormant world composition

Built against [world reference](m05.md) and [mission reference](../missions/m05.md). Pure plan: `src/shared/M05WorldPlan.ts`; server adapter: `src/server/M05World.ts`. New key `m05_night_refinery` is registered but no mission selects it. Not playable, merged or visually verified by this PR.

Pre-dawn coast in a 32,768-stud square, north = −Z, land west and sea east. Base (−1024,6700), offshore rig (9600,−7500), refinery (−8900,−7000); first tanker (1800,840), second near the rig (8000,−5600). These positions follow the suggested triangle; individual target positions and per-type counts are provisional (mission spec A3).

Eight 280×600 decks span 2,800 studs east/west, joined by trestle walkways and pipes on legs. An OilPlatform landmark anchors at sea level, just north of the working decks. Rig target poses use working deck top Y=120; the rig's waterline anchor and ships use sea Y=32. Forty refinery targets occupy a 2,112×3,072-stud foundation. Fuel tanks have two sizes, gas tanks are smaller; a 360-stud smokestack dominates the refinery. Four split foundation slabs rise from Y=32 to48, twelve above terrace terrain Y=36 (D-056). The southern runway is 2,880×96, northbound, top Y=48, with hangars and a tower. The 480×1,600 apron now spans Z=6100–7700, supporting the complete tower footprint at Z=7500 with twelve studs of terrain clearance. Its base centre is shifted 1,024 studs west to keep the full runway on land.

A clear sea corridor at X=2400 ±1800 runs south to Z=12000; the withdrawal line is Z=9400, 2,700 studs south of the base. No objective or landing behavior is enabled here.

Environment: 05:50, night sky with moon/stars, 10% cloud, no rain, dark calm sea. Cloud-base reference 14,000 ft is metadata, not actual cirrus altitude. `m05LightAnchors()` exports 392 point positions (384 refinery + 8 rig), 8 searchlight bases with yaw, and 50 runway positions. Engine batch C owns actual light fields, beams and animation; these are data only. No thousands-of-lights runtime claim is made.

LOD: 1,024-stud far tiles; whole tiles refine to128 around refinery and runway. Flat sea remains coarse; deep water is emitted in 128-stud strips (each 1024×24×128, 49,152 voxels) to stay below the unchanged65,536-voxel job cap with fewer calls than square subdivision. Sea floor caps are at Y=8 throughout navigable water, bounded native water reaches32. Both rotated fallback and uploaded tanker footprints have eight studs of clearance below keel Y=16. The sealed shell retains its continuous underside and shore curtains.

## Terrain closure and placement

M03-style eight-stud terrain caps and four-stud shared-edge curtains, without the continuous rock floor (D-120). Sea cells are water-only columns (D-121): opaque native water from Y=0 to the 32 surface with no rock under it, so each sea chunk is written once instead of twice. Aircraft collide with water (`crash_water`) and nothing below the opaque surface is seen, so the water caps the column; land cells keep eight-stud caps, and curtains between sea and land run from Y=0 to the land top. Every finest-address column is therefore capped at or above Y=0, and perimeter curtains outside hard airspace reach Y=0, so no path from hard airspace reaches the hollow interior. `m05Height`'s sea value 8 stays the nominal bed for keel clearance; below every keel there are now 16 studs of water and nothing solid. Tests check every column (water columns count as capped), exposed step, coarse/fine join and perimeter. Terrain operations may exceed 2,048 studs and are chunked into ≤65,536-voxel native jobs; every rendered Part dimension is ≤2,048.

Target scenery is grouped in Models named by exact target id, with `TargetType` and `LayoutGroup`. Builders return `groundTargets: []`. Layout Y is base/waterline for ground/naval targets and the scenery reference pose for air contacts. Exported yaw follows CFrame convention. Mission data and adoption are separate work.

`WorldAssets.PlaceUploaded` uses already-wired assets; missing assets have primitive stand-ins. Optional future manifest names are checked before placement, so asset PR #142 can land independently. No asset is created, exported, modified or uploaded here. Terrain, scenery and uploaded load behavior still need Studio review.

## Budget and verification

| Measure | Planned | Cap |
|---|---:|---:|
| Voxel writes |393,129,472|480,000,000|
| Terrain jobs |8,861|17,300|
| 128-stud chunk touches (41,760 water) |74,040|—|
| Parts (including ship/helicopter stand-ins) |262|400|
| Props |5|12|
| Estimated descendants |638|1,100|
| Estimated seconds (Studio Play calibrated) |37.44|40 (regression guard; target 20)|

Estimates use the Studio Play calibration in [the M04 composition](m04-composition.md#load-time-calibration-d-120) (D-120). **M05 does not yet meet the 20 s load target.** Measured in Studio Play before D-121, the floorless world at the 0.25 s loading budget took 37.0 s of terrain (14.0 s of Lua work, 55 yields at about 0.42 s each), down from 107.4 s with the floor and the 8 ms budget; a native clear afterwards took 11.2 s. D-121's water-only sea columns cut 41,760 cap touches and 2,760 jobs; the estimate falls from 42.8 to 37.4 s. That is not yet measured: Studio was signed out.

Native sea water remains the cost: every loading frame costs about twice a land frame. Model what-ifs, all unmeasured (the model is calibrated only at 0.25 s):

| Option | Estimate | Trade-off |
|---|---:|---|
| Same world, 0.5 s loading slices for M05 | 25.8 s | Server stalls up to about 0.9 s per slice while loading |
| Same world, 1.0 s loading slices for M05 | 19.7 s | Stalls up to about 1.4 s; needs the loading screen shown before the build (`fix/loading-before-build`) |
| Native water only near the action (refinery coast, rig, tankers, escape corridor), far sea as `Sea` Parts at Y=32 | 14.1 s | Uses the engine's existing `Sea` Part water (collision `crash_water`, `ActorPlacement.IsWater`), as the legacy worlds do; far sea would look flatter than native water and the seam needs a Studio look |

Measure these in Studio before choosing; the campaign-path measurement is also pending (mission 5 data is on #148).

## Target layout

Individual positions below are assumed within the reference's site geometry; exact per-type inventories were unreadable. Air reinforcements are poses for integration, not active spawns.

| ID | Type | Group | X | Y | Z | Yaw (rad) |
|---|---|---|---:|---:|---:|---:|
| m05_rig_crane_1 | crane | rig | 8340 | 120 | -7740 | 0 |
| m05_rig_tower_2 | tower | rig | 8340 | 120 | -7644 | 0 |
| m05_rig_control_room_3 | control_room | rig | 8340 | 120 | -7548 | 0 |
| m05_rig_sam_4 | sam | rig | 8340 | 120 | -7452 | 0 |
| m05_rig_aa_5 | aa | rig | 8340 | 120 | -7356 | 0 |
| m05_rig_tower_6 | tower | rig | 8340 | 120 | -7260 | 0 |
| m05_rig_crane_7 | crane | rig | 8700 | 120 | -7740 | 0 |
| m05_rig_tower_8 | tower | rig | 8700 | 120 | -7644 | 0 |
| m05_rig_control_room_9 | control_room | rig | 8700 | 120 | -7548 | 0 |
| m05_rig_sam_10 | sam | rig | 8700 | 120 | -7452 | 0 |
| m05_rig_aa_11 | aa | rig | 8700 | 120 | -7356 | 0 |
| m05_rig_tower_12 | tower | rig | 8700 | 120 | -7260 | 0 |
| m05_rig_crane_13 | crane | rig | 9060 | 120 | -7740 | 0 |
| m05_rig_tower_14 | tower | rig | 9060 | 120 | -7644 | 0 |
| m05_rig_control_room_15 | control_room | rig | 9060 | 120 | -7548 | 0 |
| m05_rig_sam_16 | sam | rig | 9060 | 120 | -7452 | 0 |
| m05_rig_aa_17 | aa | rig | 9060 | 120 | -7356 | 0 |
| m05_rig_tower_18 | tower | rig | 9060 | 120 | -7260 | 0 |
| m05_rig_crane_19 | crane | rig | 9420 | 120 | -7740 | 0 |
| m05_rig_tower_20 | tower | rig | 9420 | 120 | -7644 | 0 |
| m05_rig_control_room_21 | control_room | rig | 9420 | 120 | -7548 | 0 |
| m05_rig_sam_22 | sam | rig | 9420 | 120 | -7452 | 0 |
| m05_rig_aa_23 | aa | rig | 9420 | 120 | -7356 | 0 |
| m05_rig_tower_24 | tower | rig | 9420 | 120 | -7260 | 0 |
| m05_rig_crane_25 | crane | rig | 9780 | 120 | -7740 | 0 |
| m05_rig_tower_26 | tower | rig | 9780 | 120 | -7644 | 0 |
| m05_rig_control_room_27 | control_room | rig | 9780 | 120 | -7548 | 0 |
| m05_rig_sam_28 | sam | rig | 9780 | 120 | -7452 | 0 |
| m05_rig_aa_29 | aa | rig | 9780 | 120 | -7356 | 0 |
| m05_rig_tower_30 | tower | rig | 9780 | 120 | -7260 | 0 |
| m05_rig_crane_31 | crane | rig | 10140 | 120 | -7740 | 0 |
| m05_rig_tower_32 | tower | rig | 10140 | 120 | -7644 | 0 |
| m05_rig_control_room_33 | control_room | rig | 10140 | 120 | -7548 | 0 |
| m05_rig_sam_34 | sam | rig | 10140 | 120 | -7452 | 0 |
| m05_rig_aa_35 | aa | rig | 10140 | 120 | -7356 | 0 |
| m05_rig_tower_36 | tower | rig | 10140 | 120 | -7260 | 0 |
| m05_rig_crane_37 | crane | rig | 10500 | 120 | -7740 | 0 |
| m05_rig_tower_38 | tower | rig | 10500 | 120 | -7644 | 0 |
| m05_rig_control_room_39 | control_room | rig | 10500 | 120 | -7548 | 0 |
| m05_rig_sam_40 | sam | rig | 10500 | 120 | -7452 | 0 |
| m05_rig_aa_41 | aa | rig | 10500 | 120 | -7356 | 0 |
| m05_rig_tower_42 | tower | rig | 10500 | 120 | -7260 | 0 |
| m05_rig_crane_43 | crane | rig | 10860 | 120 | -7740 | 0 |
| m05_rig_tower_44 | tower | rig | 10860 | 120 | -7644 | 0 |
| m05_rig_control_room_45 | control_room | rig | 10860 | 120 | -7548 | 0 |
| m05_rig_sam_46 | sam | rig | 10860 | 120 | -7452 | 0 |
| m05_rig_aa_47 | aa | rig | 10860 | 120 | -7356 | 0 |
| m05_rig_tower_48 | tower | rig | 10860 | 120 | -7260 | 0 |
| m05_refinery_fuel_tank_large_49 | fuel_tank_large | refinery | -9740 | 48 | -8200 | 0 |
| m05_refinery_fuel_tank_50 | fuel_tank | refinery | -9500 | 48 | -8200 | 0 |
| m05_refinery_fuel_tank_51 | fuel_tank | refinery | -9260 | 48 | -8200 | 0 |
| m05_refinery_gas_tank_52 | gas_tank | refinery | -9020 | 48 | -8200 | 0 |
| m05_refinery_smokestack_53 | smokestack | refinery | -8780 | 48 | -8200 | 0 |
| m05_refinery_pump_station_54 | pump_station | refinery | -8540 | 48 | -8200 | 0 |
| m05_refinery_refinery_command_55 | refinery_command | refinery | -8300 | 48 | -8200 | 0 |
| m05_refinery_aa_56 | aa | refinery | -8060 | 48 | -8200 | 0 |
| m05_refinery_fuel_tank_large_57 | fuel_tank_large | refinery | -9740 | 48 | -7600 | 0 |
| m05_refinery_fuel_tank_58 | fuel_tank | refinery | -9500 | 48 | -7600 | 0 |
| m05_refinery_fuel_tank_59 | fuel_tank | refinery | -9260 | 48 | -7600 | 0 |
| m05_refinery_gas_tank_60 | gas_tank | refinery | -9020 | 48 | -7600 | 0 |
| m05_refinery_refinery_unit_61 | refinery_unit | refinery | -8780 | 48 | -7600 | 0 |
| m05_refinery_pump_station_62 | pump_station | refinery | -8540 | 48 | -7600 | 0 |
| m05_refinery_control_room_63 | control_room | refinery | -8300 | 48 | -7600 | 0 |
| m05_refinery_aa_64 | aa | refinery | -8060 | 48 | -7600 | 0 |
| m05_refinery_fuel_tank_large_65 | fuel_tank_large | refinery | -9740 | 48 | -7000 | 0 |
| m05_refinery_fuel_tank_66 | fuel_tank | refinery | -9500 | 48 | -7000 | 0 |
| m05_refinery_fuel_tank_67 | fuel_tank | refinery | -9260 | 48 | -7000 | 0 |
| m05_refinery_gas_tank_68 | gas_tank | refinery | -9020 | 48 | -7000 | 0 |
| m05_refinery_refinery_unit_69 | refinery_unit | refinery | -8780 | 48 | -7000 | 0 |
| m05_refinery_pump_station_70 | pump_station | refinery | -8540 | 48 | -7000 | 0 |
| m05_refinery_control_room_71 | control_room | refinery | -8300 | 48 | -7000 | 0 |
| m05_refinery_aa_72 | aa | refinery | -8060 | 48 | -7000 | 0 |
| m05_refinery_fuel_tank_large_73 | fuel_tank_large | refinery | -9740 | 48 | -6400 | 0 |
| m05_refinery_fuel_tank_74 | fuel_tank | refinery | -9500 | 48 | -6400 | 0 |
| m05_refinery_fuel_tank_75 | fuel_tank | refinery | -9260 | 48 | -6400 | 0 |
| m05_refinery_gas_tank_76 | gas_tank | refinery | -9020 | 48 | -6400 | 0 |
| m05_refinery_refinery_unit_77 | refinery_unit | refinery | -8780 | 48 | -6400 | 0 |
| m05_refinery_pump_station_78 | pump_station | refinery | -8540 | 48 | -6400 | 0 |
| m05_refinery_control_room_79 | control_room | refinery | -8300 | 48 | -6400 | 0 |
| m05_refinery_aa_80 | aa | refinery | -8060 | 48 | -6400 | 0 |
| m05_refinery_fuel_tank_large_81 | fuel_tank_large | refinery | -9740 | 48 | -5800 | 0 |
| m05_refinery_fuel_tank_82 | fuel_tank | refinery | -9500 | 48 | -5800 | 0 |
| m05_refinery_fuel_tank_83 | fuel_tank | refinery | -9260 | 48 | -5800 | 0 |
| m05_refinery_gas_tank_84 | gas_tank | refinery | -9020 | 48 | -5800 | 0 |
| m05_refinery_refinery_unit_85 | refinery_unit | refinery | -8780 | 48 | -5800 | 0 |
| m05_refinery_pump_station_86 | pump_station | refinery | -8540 | 48 | -5800 | 0 |
| m05_refinery_control_room_87 | control_room | refinery | -8300 | 48 | -5800 | 0 |
| m05_refinery_aa_88 | aa | refinery | -8060 | 48 | -5800 | 0 |
| m05_shipping_tanker_89 | tanker | shipping | 1800 | 32 | 840 | -0.15 |
| m05_shipping_tanker_90 | tanker | shipping | 8000 | 32 | -5600 | π/2 |
| m05_rig_air_helicopter_91 | helicopter | rig_air | 8600 | 240 | -6600 | 0 |
| m05_rig_air_helicopter_92 | helicopter | rig_air | 9400 | 240 | -6600 | 0 |
| m05_rig_air_helicopter_93 | helicopter | rig_air | 10200 | 240 | -6600 | 0 |


## Explicit scoring inventory

Points follow [mission §4](../missions/m05.md). Per-type counts remain assumptions within A3's 48/40 split. `refinery_command` replaces one control room: a plausible hardened command building representing the observed unidentified 100-point contact at 0:54:04–0:54:23. Its identity is an assumption, not identified footage evidence. Pump stations assume 40 points because the observed label's value was unreadable. SAMs use the observed upper value 50 (the spec also records 30). `M05_TARGET_POINTS` exports this provisional ledger for later integration; no live mission scoring changes here.

| Type | Rig count | Refinery count | Other count | Points each | Total |
|---|---:|---:|---:|---:|---:|
| Crane | 8 | 0 | 0 | 50 | 400 |
| Tower | 16 | 0 | 0 | 60 | 960 |
| Control room | 8 | 4 | 0 | 60 | 720 |
| SAM | 8 | 0 | 0 | 50 | 400 |
| AA | 8 | 5 | 0 | 20 | 260 |
| Large fuel tank | 0 | 5 | 0 | 50 | 250 |
| Fuel tank | 0 | 10 | 0 | 40 | 400 |
| Gas tank | 0 | 5 | 0 | 30 | 150 |
| Refinery unit | 0 | 4 | 0 | 60 | 240 |
| Smokestack | 0 | 1 | 0 | 60 | 60 |
| Pump station (assumed) | 0 | 5 | 0 | 40 | 200 |
| Refinery command (unidentified contact) | 0 | 1 | 0 | 100 | 100 |
| Tanker | 0 | 0 | 2 | 120 | 240 |
| Helicopter | 0 | 0 | 3 | 40 | 120 |
| **Total** | **48** | **40** | **5** | | **4,500** |

Rig ground subtotal is **2,400** (or 2,240 if all eight SAMs use 30): a thorough rig run reaches 2,000 independently. Refinery subtotal is 1,740. Ships and helicopters add 360. The later interceptor/elite waves remain mission integration work and are outside this scenery ledger; this does not reproduce the footage's exact 4,860 score.

Review-fix validation: frozen Bun install and build passed; full offline gate passed (`OFFLINE_LUAU_RESULT passed=701 failed=0`). Deeper sea raises voxel writes to460,238,336 (cap480,000,000); strips reduce jobs to12,645 without changing coverage or per-job cap. Estimated9.281 s × M02’s approximate1.5 correction ≈13.92 s; Studio measurement remains pending.
