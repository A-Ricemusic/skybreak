# M09 world composition — in review

2026-10-30 · dormant world key `m09_frigate_landing` · D-170–D-173.

Implements the [world sketch](m09.md) and supports the [mission specification](../missions/m09.md). Based on PR #164's `feat/m06-m07-worlds`; rebase onto main after #164 merges. Reuses `CompactWorldSurface` and the generic `compactWorldCounts` in `M06M07WorldCounts.ts`, including its chunk-touch/yield calibration at 0.25-second terrain slices. No dependency on unmerged #158 code is added.

## Composition and scope

Three defended landing beaches at (-7680,40,0), (0,40,-960), (7680,40,0), steep separating headlands/gullies, gun belts behind the open sand, muted wooded back slopes and an untargetable town near (3840,-6400). Uploaded loyalist frigates and original procedural landing-craft scenery lie offshore. Overcast grey-green 17:00 with haze, dark water and no inferred rain or night lighting. Start (0,126,7680) faces north; attack entry (11520,700,-5760) stays inland. The exported back-slope anchor (0,180,-2880) remains a mission planning anchor; individual gun positions are provisional.

The 55 id-named ground scenery poses use the mission spec's compatible credited-kill reconstruction: radar9, battery6, pillbox16, tank7, launcher5, howitzer3, AA7, SAM2. **Pillbox16/tank7 are inferred, not audited spawn counts; the other 28 of 83 initial ground contacts remain unknown.** No 83-contact roster or 55-kill score is activated. Three beach groups contain 19/18/18 poses. The 10:00 beach score phase and 7:00 six-attack-jet phase remain future mission work. Friendly craft have no invented health/protection rule.

The existing approved Carrier is placed at (0,32,11520), yaw0, scale1, facing north. `UploadedAssetSpecs.Carrier.groundOffset=20` puts the keel at Y=12 beneath native water Y=32. Carrier-2's authored deck is 54 above keel (checklist and M01CarrierPlan), so deck/touchdown Y=66 replaces the sketch's proposed Y=64. Exported assisted approach (-32,170,13000), touchdown (-32,66,11640), bow catapult (24.5155,66,11244). Native water fills full hull/approach footprints; no solid terrain/seabed intersects them. The north-facing service corridor stays clear; landing/catapult animation, finite ammunition, threat gate and paused service clocks require mission integration, not this world PR. Start→central beach is ~54 seconds at 160 studs/s; central beach→carrier ~78 seconds each way before turns.

## Surface, ownership and budgets

The cap/curtain shell seals every 128-stud address and shared height edge, including fine/coarse joins, to a perimeter outside hard airspace (16,000 studs). No rock floor and no terrain below Y=0. Land uses 8-stud caps; sea columns contain only native water Y=0–32 near ships, otherwise bounded `Sea` Parts (top32/bottom28) recognized as water by `AircraftCollision`. M08 has no ship/service interaction and uses distant-sea Parts throughout. 256-stud detail near installations/beaches, 1024 elsewhere. All Part dimensions and uploaded scaled bounds ≤2048; foundation tops ≥8 above sampled terrain, bases intersect terrain; full target and rotated dry-prop footprints are supported. Scenery lives beneath one composition folder; `groundTargets: []`; id-named models are available for later adoption. Both clear callbacks register through `registerWorldClear` and the existing lifecycle gate. Registry recognizes the keys; no mission selects them.

Limits per world: 600 million voxel writes, 15,000 scheduled jobs, 650 Parts, 60 props, 2,600 reserved descendants, **≤16 s chunk/yield estimate**. The shared estimator charges scheduled 128-stud chunk touches (0.07 ms solid, 0.2 ms water), full modeled frames at each 0.25 s yield, plus 3 s overhead. These are estimates; runtime GetDescendants remains the hard descendant guard. No new Blender exports or asset uploads occur; approved uploads are consumed unchanged, with CompositionWorld's visible stand-ins if unavailable.

87,998,976 voxel writes · 4,497 jobs · 50,158 solid / 1,312 water chunk touches · 16 modeled yields · 279 Parts · 37 props · 1,423 reserved descendants · **10.474136 s estimate**.

Passed `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: 771 offline Luau domain contracts, 122 Python tests and all remaining gates.

Validation: deterministic/checkpointed plans, ids/counts/positions, supported nonoverlapping target footprints, complete surface/edge/perimeter sealing, correct water-only ship/carrier footprints, clear beaches/service corridor, scaled props and Part sizes, budgets and dormant catalog. Studio is signed out; offline only. No Studio, Player, phone, new source-frame comparison, visual acceptance, observed load/cleanup time or flight-quality claim. Future acceptance must compare the cited spec frames and exercise actual mission routes/service.

## Complete scenery table

Coordinates are provisional adaptation choices in studs, yaw radians; every id counts once regardless of Part count. These tables do not declare a combat roster.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m09_west_radar_1 | radar | west | -8680 | 180 | -600 | 0 |
| m09_central_radar_2 | radar | central | -1000 | 180 | -1560 | 0 |
| m09_east_radar_3 | radar | east | 6680 | 180 | -600 | 0 |
| m09_west_radar_4 | radar | west | -8180 | 180 | -600 | 0 |
| m09_central_radar_5 | radar | central | -500 | 180 | -1560 | 0 |
| m09_east_radar_6 | radar | east | 7180 | 180 | -600 | 0 |
| m09_west_radar_7 | radar | west | -7680 | 180 | -600 | 0 |
| m09_central_radar_8 | radar | central | 0 | 180 | -1560 | 0 |
| m09_east_radar_9 | radar | east | 7680 | 180 | -600 | 0 |
| m09_west_battery_10 | battery | west | -7180 | 180 | -600 | 0 |
| m09_central_battery_11 | battery | central | 500 | 180 | -1560 | 0 |
| m09_east_battery_12 | battery | east | 8180 | 180 | -600 | 0 |
| m09_west_battery_13 | battery | west | -6680 | 180 | -600 | 0 |
| m09_central_battery_14 | battery | central | 1000 | 180 | -1560 | 0 |
| m09_east_battery_15 | battery | east | 8680 | 180 | -600 | 0 |
| m09_west_pillbox_16 | pillbox | west | -8680 | 180 | -880 | 0 |
| m09_central_pillbox_17 | pillbox | central | -1000 | 180 | -1840 | 0 |
| m09_east_pillbox_18 | pillbox | east | 6680 | 180 | -880 | 0 |
| m09_west_pillbox_19 | pillbox | west | -8180 | 180 | -880 | 0 |
| m09_central_pillbox_20 | pillbox | central | -500 | 180 | -1840 | 0 |
| m09_east_pillbox_21 | pillbox | east | 7180 | 180 | -880 | 0 |
| m09_west_pillbox_22 | pillbox | west | -7680 | 180 | -880 | 0 |
| m09_central_pillbox_23 | pillbox | central | 0 | 180 | -1840 | 0 |
| m09_east_pillbox_24 | pillbox | east | 7680 | 180 | -880 | 0 |
| m09_west_pillbox_25 | pillbox | west | -7180 | 180 | -880 | 0 |
| m09_central_pillbox_26 | pillbox | central | 500 | 180 | -1840 | 0 |
| m09_east_pillbox_27 | pillbox | east | 8180 | 180 | -880 | 0 |
| m09_west_pillbox_28 | pillbox | west | -6680 | 180 | -880 | 0 |
| m09_central_pillbox_29 | pillbox | central | 1000 | 180 | -1840 | 0 |
| m09_east_pillbox_30 | pillbox | east | 8680 | 180 | -880 | 0 |
| m09_west_pillbox_31 | pillbox | west | -8680 | 180 | -1160 | 0 |
| m09_central_tank_32 | tank | central | -1000 | 180 | -2120 | 0 |
| m09_east_tank_33 | tank | east | 6680 | 180 | -1160 | 0 |
| m09_west_tank_34 | tank | west | -8180 | 180 | -1160 | 0 |
| m09_central_tank_35 | tank | central | -500 | 180 | -2120 | 0 |
| m09_east_tank_36 | tank | east | 7180 | 180 | -1160 | 0 |
| m09_west_tank_37 | tank | west | -7680 | 180 | -1160 | 0 |
| m09_central_tank_38 | tank | central | 0 | 180 | -2120 | 0 |
| m09_east_launcher_39 | launcher | east | 7680 | 180 | -1160 | 0 |
| m09_west_launcher_40 | launcher | west | -7180 | 180 | -1160 | 0 |
| m09_central_launcher_41 | launcher | central | 500 | 180 | -2120 | 0 |
| m09_east_launcher_42 | launcher | east | 8180 | 180 | -1160 | 0 |
| m09_west_launcher_43 | launcher | west | -6680 | 180 | -1160 | 0 |
| m09_central_howitzer_44 | howitzer | central | 1000 | 180 | -2120 | 0 |
| m09_east_howitzer_45 | howitzer | east | 8680 | 180 | -1160 | 0 |
| m09_west_howitzer_46 | howitzer | west | -8680 | 180 | -1440 | 0 |
| m09_central_aa_47 | aa | central | -1000 | 180 | -2400 | 0 |
| m09_east_aa_48 | aa | east | 6680 | 180 | -1440 | 0 |
| m09_west_aa_49 | aa | west | -8180 | 180 | -1440 | 0 |
| m09_central_aa_50 | aa | central | -500 | 180 | -2400 | 0 |
| m09_east_aa_51 | aa | east | 7180 | 180 | -1440 | 0 |
| m09_west_aa_52 | aa | west | -7680 | 180 | -1440 | 0 |
| m09_central_aa_53 | aa | central | 0 | 180 | -2400 | 0 |
| m09_east_sam_54 | sam | east | 7680 | 180 | -1440 | 0 |
| m09_west_sam_55 | sam | west | -7180 | 180 | -1440 | 0 |
