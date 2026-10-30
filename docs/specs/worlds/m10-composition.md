# M10 River Line — procedural composition in review

Implements the world portion of [world spec](m10.md) and [mission spec](../missions/m10.md). Starts from PR #166 head `80b5f712916e04d37ea09bb3538fa1b47384afb6`, stacked above #164. Both dependencies were open when work began; rebase onto main after they merge. Decisions D-180–D-183; all dimensions/target subtype allocations remain authored proposals, not a surveyed source map.

## Composition and mission handoff

32,768-stud inland mountain world. Start(0,617,12480), heading45° NE; first base A(3840,6720) is northeast. B(-3360,960), C(3360,-4800), D(-4800,-9600). River waterline32; base/runway flats64 with target decks80, dock/pen flats32 with decks48. The connecting channel is nominally960 studs wide, with1,600-wide native-water berthing pockets. Bends hold their district X until outside the target bench. Grey steep rock/forest ranges use coarse64-stud ridge levels (208–528 studs), with256-stud detail at the river/districts and1,024 distant cells. Sparse12 Pine silhouettes avoid expensive forest instance density. Daylight14:15, blue haze, opaque brown water; no rain.

A's1,920×58 runway sits west of the contact grid at(2940,6720); return strip(−9600,12000) is2,304×128. Both asphalt surfaces topY80, foundations top78, each with100-stud lateral safety margins and3,200-stud clear extensions at both ends. Offline checks sweep terrain plus actual Parts and uploaded prop bounds; the checker is also tested with an intentionally inserted blocking tower. No service clocks, landing actor, ammunition or damage restoration logic is added.

Each district has25 ground contacts and6 naval contacts: **100 ground+24 naval**. Briefing metadata preserves **26 air /150 total**, ≥3,000 points and20:00; this world does not spawn26 static air enemies or activate a combat roster. Ground subtype counts are container12, barracks12, tank12, AA12, SAM12, antenna8, watchtower8, flak8, fuel8, radar8. Naval allocation is Frigate8/FuelTanker8/gunboat6/surfaced submarine2; per-type counts and exact positions are provisional capacity, not recovered evidence. Uploaded Frigate/FuelTanker remain unchanged, use groundOffset16 atY32 (keel16). Native water covers full hulls; ships do not inherit land grounding. Gunboats/submarines are original two-Part scenery silhouettes. Two D pen arches have120-wide×80-high mouths and180 depth, with open water beneath; positions avoid all hull bounds. No invented visible artillery source. Control tower/hangar/cranes reuse existing assets and sit on supported pads; no new upload.

The four districts' direct legs remain the spec's ~27.5kstud/~172s at160stud/s; combat/rearm account for the20-minute objective. Air waves, scoring, artillery timing/terrain shielding, finite ammunition, optional rearm and contact activation remain mission work. Do not claim a full playable mission or source roster fidelity from these scenery counts.

## Ownership, surface and validation

These are dormant review worlds: registry recognizes the keys but MissionCatalog never selects them. CompositionWorld returns `groundTargets: []`; id-named scenery models provide future adoption points, never duplicate score actors. Each native clear callback registers via `registerWorldClear`; no Studio session or upload was used.

Reuse PR #166's CompactWorldSurface and chunk/yield estimator from #164. Land has 8-stud caps and shared-edge/perimeter curtains above Y=0; every 128-stud column and fine/coarse join is sealed past the 16,000-stud hard boundary. M10's river columns are water-only from0 to32; there is no global solid seabed or below-zero floor. Neither inland world needs distant ocean; the shared helper emits bounded `Sea` Parts wherever a future non-native sea region exists. All Parts and scaled uploaded dimensions are ≤2,048. Foundations overlap their terrain support and stand ≥8 studs above it.

Per-world caps: 600M voxel writes, 15,000 scheduled jobs, 650 reserved Parts, 60 props, 2,600 reserved descendants, **≤16 s estimated build**. Chunk model: 0.07ms solid/0.2ms water per scheduled128-stud chunk touch, modeled full frames at0.25s terrain slices, plus3s overhead. These are estimates, never Studio/phone measurements. Runtime GetDescendants remains the hard guard. M10 reserves four fallback Parts plus24 descendants for each of its16 uploaded naval contacts in addition to prop allowances and256 wrapper/template overhead; minor ground contacts use only two Parts plus one foundation each. M11 uses eight primitive aircraft Parts total.

Validation: `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`. Passed all gates: **779 offline Luau contracts and 122 Python tests**, plus catalog/UI/audio/radio/document checks. The new offline Luau contracts cover determinism/checkpoints/dormancy, counts/anchors/ids, target supports/non-overlap, scaled prop support and bounds, complete column/edge sealing, ship water-only footprints and waterlines, full landing approaches against terrain/Parts/props, unclipped civilian route tubes and build budgets. No Roblox Jest/Studio, Player, real phone, new reference frame comparison, rendered visual quality or flight feel is claimed. Actual rendered/load/clear acceptance remains open. No Blender-origin file was created, changed, exported or uploaded.

## Offline build budget

161742464 voxel writes · 8672 jobs · 87506 solid / 2312 water chunk touches · 27 modeled yields · 398 reserved Parts · 16 props · 1422 reserved descendants · **15.840630 s estimate**.

## Complete scenery table

Coordinates are studs, yaw radians. Every id counts once regardless of geometry complexity.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m10_A_container_1 | container | A | 3240.00 | 80.00 | 6120.00 | 0.00 |
| m10_A_barracks_2 | barracks | A | 3540.00 | 80.00 | 6120.00 | 0.00 |
| m10_A_tank_3 | tank | A | 3840.00 | 80.00 | 6120.00 | 0.00 |
| m10_A_aa_4 | aa | A | 4140.00 | 80.00 | 6120.00 | 0.00 |
| m10_A_sam_5 | sam | A | 4440.00 | 80.00 | 6120.00 | 0.00 |
| m10_A_antenna_6 | antenna | A | 3240.00 | 80.00 | 6420.00 | 0.00 |
| m10_A_watchtower_7 | watchtower | A | 3540.00 | 80.00 | 6420.00 | 0.00 |
| m10_A_flak_8 | flak | A | 3840.00 | 80.00 | 6420.00 | 0.00 |
| m10_A_fuel_9 | fuel | A | 4140.00 | 80.00 | 6420.00 | 0.00 |
| m10_A_radar_10 | radar | A | 4440.00 | 80.00 | 6420.00 | 0.00 |
| m10_A_container_11 | container | A | 3240.00 | 80.00 | 6720.00 | 0.00 |
| m10_A_barracks_12 | barracks | A | 3540.00 | 80.00 | 6720.00 | 0.00 |
| m10_A_tank_13 | tank | A | 3840.00 | 80.00 | 6720.00 | 0.00 |
| m10_A_aa_14 | aa | A | 4140.00 | 80.00 | 6720.00 | 0.00 |
| m10_A_sam_15 | sam | A | 4440.00 | 80.00 | 6720.00 | 0.00 |
| m10_A_antenna_16 | antenna | A | 3240.00 | 80.00 | 7020.00 | 0.00 |
| m10_A_watchtower_17 | watchtower | A | 3540.00 | 80.00 | 7020.00 | 0.00 |
| m10_A_flak_18 | flak | A | 3840.00 | 80.00 | 7020.00 | 0.00 |
| m10_A_fuel_19 | fuel | A | 4140.00 | 80.00 | 7020.00 | 0.00 |
| m10_A_radar_20 | radar | A | 4440.00 | 80.00 | 7020.00 | 0.00 |
| m10_A_container_21 | container | A | 3240.00 | 80.00 | 7320.00 | 0.00 |
| m10_A_barracks_22 | barracks | A | 3540.00 | 80.00 | 7320.00 | 0.00 |
| m10_A_tank_23 | tank | A | 3840.00 | 80.00 | 7320.00 | 0.00 |
| m10_A_aa_24 | aa | A | 4140.00 | 80.00 | 7320.00 | 0.00 |
| m10_A_sam_25 | sam | A | 4440.00 | 80.00 | 7320.00 | 0.00 |
| m10_A_frigate_1 | frigate | A | 1820.00 | 32.00 | 6120.00 | 0.00 |
| m10_A_frigate_2 | frigate | A | 2260.00 | 32.00 | 6120.00 | 0.00 |
| m10_A_tanker_3 | tanker | A | 1820.00 | 32.00 | 6720.00 | 0.00 |
| m10_A_tanker_4 | tanker | A | 2260.00 | 32.00 | 6720.00 | 0.00 |
| m10_A_gunboat_5 | gunboat | A | 1820.00 | 32.00 | 7320.00 | 0.00 |
| m10_A_gunboat_6 | gunboat | A | 2260.00 | 32.00 | 7320.00 | 0.00 |
| m10_B_container_1 | container | B | -3960.00 | 80.00 | 360.00 | 0.00 |
| m10_B_barracks_2 | barracks | B | -3660.00 | 80.00 | 360.00 | 0.00 |
| m10_B_tank_3 | tank | B | -3360.00 | 80.00 | 360.00 | 0.00 |
| m10_B_aa_4 | aa | B | -3060.00 | 80.00 | 360.00 | 0.00 |
| m10_B_sam_5 | sam | B | -2760.00 | 80.00 | 360.00 | 0.00 |
| m10_B_antenna_6 | antenna | B | -3960.00 | 80.00 | 660.00 | 0.00 |
| m10_B_watchtower_7 | watchtower | B | -3660.00 | 80.00 | 660.00 | 0.00 |
| m10_B_flak_8 | flak | B | -3360.00 | 80.00 | 660.00 | 0.00 |
| m10_B_fuel_9 | fuel | B | -3060.00 | 80.00 | 660.00 | 0.00 |
| m10_B_radar_10 | radar | B | -2760.00 | 80.00 | 660.00 | 0.00 |
| m10_B_container_11 | container | B | -3960.00 | 80.00 | 960.00 | 0.00 |
| m10_B_barracks_12 | barracks | B | -3660.00 | 80.00 | 960.00 | 0.00 |
| m10_B_tank_13 | tank | B | -3360.00 | 80.00 | 960.00 | 0.00 |
| m10_B_aa_14 | aa | B | -3060.00 | 80.00 | 960.00 | 0.00 |
| m10_B_sam_15 | sam | B | -2760.00 | 80.00 | 960.00 | 0.00 |
| m10_B_antenna_16 | antenna | B | -3960.00 | 80.00 | 1260.00 | 0.00 |
| m10_B_watchtower_17 | watchtower | B | -3660.00 | 80.00 | 1260.00 | 0.00 |
| m10_B_flak_18 | flak | B | -3360.00 | 80.00 | 1260.00 | 0.00 |
| m10_B_fuel_19 | fuel | B | -3060.00 | 80.00 | 1260.00 | 0.00 |
| m10_B_radar_20 | radar | B | -2760.00 | 80.00 | 1260.00 | 0.00 |
| m10_B_container_21 | container | B | -3960.00 | 80.00 | 1560.00 | 0.00 |
| m10_B_barracks_22 | barracks | B | -3660.00 | 80.00 | 1560.00 | 0.00 |
| m10_B_tank_23 | tank | B | -3360.00 | 80.00 | 1560.00 | 0.00 |
| m10_B_aa_24 | aa | B | -3060.00 | 80.00 | 1560.00 | 0.00 |
| m10_B_sam_25 | sam | B | -2760.00 | 80.00 | 1560.00 | 0.00 |
| m10_B_frigate_1 | frigate | B | -5380.00 | 32.00 | 360.00 | 0.00 |
| m10_B_frigate_2 | frigate | B | -4940.00 | 32.00 | 360.00 | 0.00 |
| m10_B_tanker_3 | tanker | B | -5380.00 | 32.00 | 960.00 | 0.00 |
| m10_B_tanker_4 | tanker | B | -4940.00 | 32.00 | 960.00 | 0.00 |
| m10_B_gunboat_5 | gunboat | B | -5380.00 | 32.00 | 1560.00 | 0.00 |
| m10_B_gunboat_6 | gunboat | B | -4940.00 | 32.00 | 1560.00 | 0.00 |
| m10_C_container_1 | container | C | 2760.00 | 48.00 | -5400.00 | 0.00 |
| m10_C_barracks_2 | barracks | C | 3060.00 | 48.00 | -5400.00 | 0.00 |
| m10_C_tank_3 | tank | C | 3360.00 | 48.00 | -5400.00 | 0.00 |
| m10_C_aa_4 | aa | C | 3660.00 | 48.00 | -5400.00 | 0.00 |
| m10_C_sam_5 | sam | C | 3960.00 | 48.00 | -5400.00 | 0.00 |
| m10_C_antenna_6 | antenna | C | 2760.00 | 48.00 | -5100.00 | 0.00 |
| m10_C_watchtower_7 | watchtower | C | 3060.00 | 48.00 | -5100.00 | 0.00 |
| m10_C_flak_8 | flak | C | 3360.00 | 48.00 | -5100.00 | 0.00 |
| m10_C_fuel_9 | fuel | C | 3660.00 | 48.00 | -5100.00 | 0.00 |
| m10_C_radar_10 | radar | C | 3960.00 | 48.00 | -5100.00 | 0.00 |
| m10_C_container_11 | container | C | 2760.00 | 48.00 | -4800.00 | 0.00 |
| m10_C_barracks_12 | barracks | C | 3060.00 | 48.00 | -4800.00 | 0.00 |
| m10_C_tank_13 | tank | C | 3360.00 | 48.00 | -4800.00 | 0.00 |
| m10_C_aa_14 | aa | C | 3660.00 | 48.00 | -4800.00 | 0.00 |
| m10_C_sam_15 | sam | C | 3960.00 | 48.00 | -4800.00 | 0.00 |
| m10_C_antenna_16 | antenna | C | 2760.00 | 48.00 | -4500.00 | 0.00 |
| m10_C_watchtower_17 | watchtower | C | 3060.00 | 48.00 | -4500.00 | 0.00 |
| m10_C_flak_18 | flak | C | 3360.00 | 48.00 | -4500.00 | 0.00 |
| m10_C_fuel_19 | fuel | C | 3660.00 | 48.00 | -4500.00 | 0.00 |
| m10_C_radar_20 | radar | C | 3960.00 | 48.00 | -4500.00 | 0.00 |
| m10_C_container_21 | container | C | 2760.00 | 48.00 | -4200.00 | 0.00 |
| m10_C_barracks_22 | barracks | C | 3060.00 | 48.00 | -4200.00 | 0.00 |
| m10_C_tank_23 | tank | C | 3360.00 | 48.00 | -4200.00 | 0.00 |
| m10_C_aa_24 | aa | C | 3660.00 | 48.00 | -4200.00 | 0.00 |
| m10_C_sam_25 | sam | C | 3960.00 | 48.00 | -4200.00 | 0.00 |
| m10_C_frigate_1 | frigate | C | 1340.00 | 32.00 | -5400.00 | 0.00 |
| m10_C_frigate_2 | frigate | C | 1780.00 | 32.00 | -5400.00 | 0.00 |
| m10_C_tanker_3 | tanker | C | 1340.00 | 32.00 | -4800.00 | 0.00 |
| m10_C_tanker_4 | tanker | C | 1780.00 | 32.00 | -4800.00 | 0.00 |
| m10_C_gunboat_5 | gunboat | C | 1340.00 | 32.00 | -4200.00 | 0.00 |
| m10_C_gunboat_6 | gunboat | C | 1780.00 | 32.00 | -4200.00 | 0.00 |
| m10_D_container_1 | container | D | -5400.00 | 48.00 | -10200.00 | 0.00 |
| m10_D_barracks_2 | barracks | D | -5100.00 | 48.00 | -10200.00 | 0.00 |
| m10_D_tank_3 | tank | D | -4800.00 | 48.00 | -10200.00 | 0.00 |
| m10_D_aa_4 | aa | D | -4500.00 | 48.00 | -10200.00 | 0.00 |
| m10_D_sam_5 | sam | D | -4200.00 | 48.00 | -10200.00 | 0.00 |
| m10_D_antenna_6 | antenna | D | -5400.00 | 48.00 | -9900.00 | 0.00 |
| m10_D_watchtower_7 | watchtower | D | -5100.00 | 48.00 | -9900.00 | 0.00 |
| m10_D_flak_8 | flak | D | -4800.00 | 48.00 | -9900.00 | 0.00 |
| m10_D_fuel_9 | fuel | D | -4500.00 | 48.00 | -9900.00 | 0.00 |
| m10_D_radar_10 | radar | D | -4200.00 | 48.00 | -9900.00 | 0.00 |
| m10_D_container_11 | container | D | -5400.00 | 48.00 | -9600.00 | 0.00 |
| m10_D_barracks_12 | barracks | D | -5100.00 | 48.00 | -9600.00 | 0.00 |
| m10_D_tank_13 | tank | D | -4800.00 | 48.00 | -9600.00 | 0.00 |
| m10_D_aa_14 | aa | D | -4500.00 | 48.00 | -9600.00 | 0.00 |
| m10_D_sam_15 | sam | D | -4200.00 | 48.00 | -9600.00 | 0.00 |
| m10_D_antenna_16 | antenna | D | -5400.00 | 48.00 | -9300.00 | 0.00 |
| m10_D_watchtower_17 | watchtower | D | -5100.00 | 48.00 | -9300.00 | 0.00 |
| m10_D_flak_18 | flak | D | -4800.00 | 48.00 | -9300.00 | 0.00 |
| m10_D_fuel_19 | fuel | D | -4500.00 | 48.00 | -9300.00 | 0.00 |
| m10_D_radar_20 | radar | D | -4200.00 | 48.00 | -9300.00 | 0.00 |
| m10_D_container_21 | container | D | -5400.00 | 48.00 | -9000.00 | 0.00 |
| m10_D_barracks_22 | barracks | D | -5100.00 | 48.00 | -9000.00 | 0.00 |
| m10_D_tank_23 | tank | D | -4800.00 | 48.00 | -9000.00 | 0.00 |
| m10_D_aa_24 | aa | D | -4500.00 | 48.00 | -9000.00 | 0.00 |
| m10_D_sam_25 | sam | D | -4200.00 | 48.00 | -9000.00 | 0.00 |
| m10_D_frigate_1 | frigate | D | -6820.00 | 32.00 | -10200.00 | 0.00 |
| m10_D_frigate_2 | frigate | D | -6380.00 | 32.00 | -10200.00 | 0.00 |
| m10_D_tanker_3 | tanker | D | -6820.00 | 32.00 | -9600.00 | 0.00 |
| m10_D_tanker_4 | tanker | D | -6380.00 | 32.00 | -9600.00 | 0.00 |
| m10_D_river_submarine_5 | river_submarine | D | -6820.00 | 32.00 | -9000.00 | 0.00 |
| m10_D_river_submarine_6 | river_submarine | D | -6380.00 | 32.00 | -9000.00 | 0.00 |
