# M07 world composition — in review

2026-10-30 · dormant world key `m07_two_ridges` · decisions D-160–D-163.

## Scope and evidence limits

Implements the [world sketch](m07.md) and [mission inventory evidence](../missions/m07.md). Full 32,768-stud footprint at k=0.96. **Individual coordinates and unresolved subtype totals are provisional builder choices, not measured footage positions.** No Studio, Player, phone, new footage inspection or visual acceptance is claimed. Mission catalog/unlocks, scoring, waves, hazards and service gameplay stay unselected; runtime returns `groundTargets: []`. Id-named scenery models are available for later mission integration.

## Composition

Arid sandstone hills frame a northbound trail: south arrays (0,160,6720), middle arrays (960,190,0), plant (0,230,-8640). Reflective banks and a tall collector tower preserve the array-strike landmarks; gameplay/story ownership can treat them as relay installations. Golden 16:40 light, blue-grey upper atmosphere, readable moon, no precipitation. Sun azimuth and grading are authoring assumptions pending rendered comparison.

The south array footprint is narrowed to 1600×1400 around its unchanged anchor so its west edge does not obstruct the canyon. Other fields are 2600×2000; panels/required installations/defences have separate nonoverlapping supported footprints. Three required installation poses and 41 panel poses plus eight defensive poses reproduce the credited 52-ground reconstruction, not the unresolved initial 51-ground inventory.

The canyon begins at (0,-7000), passes the exact A/B/C sketch XZ bends (-1920,-4800), (-3840,0), (-1920,5760), then reaches (0,11520). Floor descends 100→64→32→12→8; a broad low floor and sealed rock walls permit a 256-stud-wide flight tube sampled every 64 studs, 56 studs above the interpolated floor with at least 32 studs of ground clearance. Flight tube including a 24-stud upper envelope remains below the absolute artillery ceiling Y=617.216. This is geometry, not artillery simulation. Route length is about 20.2 km / 126 s at 160 studs/s, within the reference two-minute withdrawal without compressing the world. No runway/service was observed for M07 and none is invented.

## Terrain and lifecycle

`CompactWorldSurface` isolates the #158 floorless approach without changing existing M01–M05 geometry. Every column has a cap at or above Y=0. Shared-edge curtains cover every height discontinuity and the perimeter outside the 16,000-stud hard boundary reaches Y=0. No continuous rock floor and no operation below Y=0. Native sea columns are water only from 0 to 32; no rock bed is touched beneath ship keels. Detail is 256 studs near the action/canyon, 1024 elsewhere. Water writes use 128-stud strips to reduce write jobs; no extra floor chunk layer is allocated. Part dimensions and scaled prop bounds stay ≤2048. Worlds use 0.25-second terrain slices, batched prop yields and registered one-native-clear teardown inside the world gate.

## Offline budgets and acceptance

Main does not yet include #158's chunk/yield estimator. Per the task, estimates use the existing M02/M03 calibration ×1.5: `3 × (jobs / 27494 × 7.915 + 1)`. This fallback does not predict water-heavy engine frame cost reliably; the ≤16-second estimate is not a load-time guarantee. Runtime measurement remains required before activation. Limits: 600,000,000 voxel writes, 15,000 jobs, 400 Parts including fallback allowance, 60 props, 2,400 descendants, estimate ≤16 s.

145,820,672 voxel writes · 8,934 jobs · 107 Parts · 0 props · 363 reserved descendants · **10.716 s estimated**.

Checks: deterministic plans, exact sketch anchors, provisional target counts/ids, supported nonoverlapping target footprints, rotated prop supports, ship water/keel footprints, all caps/curtains and perimeter sealing, pavement clearance and Part limits; M07 also checks the low escape tube against terrain and scenery. Full `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN=... bun run validate:offline` are required. Studio deliberately not launched (signed out). Visual fidelity, actual navigation/load/cleanup timing and real-phone quality remain pending.

## Target table

All positions studs; yaw radians. IDs count a contact once, independent of its visual Part count. Scenery only; no score or activation is inferred.

| Type | Count |
|---|---:|
| aa | 2 |
| control_room | 1 |
| flak | 2 |
| pillbox | 2 |
| radar | 1 |
| sam | 2 |
| solar_panel | 41 |
| solar_tower | 1 |

| Id | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m07_south_solar_panel_1 | solar_panel | south | -600 | 160 | 6320 | 0 |
| m07_south_solar_panel_2 | solar_panel | south | -300 | 160 | 6320 | 0 |
| m07_south_solar_panel_3 | solar_panel | south | 0 | 160 | 6320 | 0 |
| m07_south_solar_panel_4 | solar_panel | south | 300 | 160 | 6320 | 0 |
| m07_south_solar_panel_5 | solar_panel | south | 600 | 160 | 6320 | 0 |
| m07_south_solar_panel_6 | solar_panel | south | -600 | 160 | 6720 | 0 |
| m07_south_solar_panel_7 | solar_panel | south | -300 | 160 | 6720 | 0 |
| m07_south_solar_panel_8 | solar_panel | south | 0 | 160 | 6720 | 0 |
| m07_south_solar_panel_9 | solar_panel | south | 300 | 160 | 6720 | 0 |
| m07_south_solar_panel_10 | solar_panel | south | 600 | 160 | 6720 | 0 |
| m07_south_solar_panel_11 | solar_panel | south | -600 | 160 | 7120 | 0 |
| m07_south_solar_panel_12 | solar_panel | south | -300 | 160 | 7120 | 0 |
| m07_south_solar_panel_13 | solar_panel | south | 0 | 160 | 7120 | 0 |
| m07_south_solar_panel_14 | solar_panel | south | 300 | 160 | 7120 | 0 |
| m07_south_solar_panel_15 | solar_panel | south | 600 | 160 | 7120 | 0 |
| m07_middle_solar_panel_16 | solar_panel | middle | -40 | 190 | -600 | 0 |
| m07_middle_solar_panel_17 | solar_panel | middle | 360 | 190 | -600 | 0 |
| m07_middle_solar_panel_18 | solar_panel | middle | 760 | 190 | -600 | 0 |
| m07_middle_solar_panel_19 | solar_panel | middle | 1160 | 190 | -600 | 0 |
| m07_middle_solar_panel_20 | solar_panel | middle | 1560 | 190 | -600 | 0 |
| m07_middle_solar_panel_21 | solar_panel | middle | -40 | 190 | -200 | 0 |
| m07_middle_solar_panel_22 | solar_panel | middle | 360 | 190 | -200 | 0 |
| m07_middle_solar_panel_23 | solar_panel | middle | 760 | 190 | -200 | 0 |
| m07_middle_solar_panel_24 | solar_panel | middle | 1160 | 190 | -200 | 0 |
| m07_middle_solar_panel_25 | solar_panel | middle | 1560 | 190 | -200 | 0 |
| m07_middle_solar_panel_26 | solar_panel | middle | -40 | 190 | 200 | 0 |
| m07_middle_solar_panel_27 | solar_panel | middle | 360 | 190 | 200 | 0 |
| m07_middle_solar_panel_28 | solar_panel | middle | 760 | 190 | 200 | 0 |
| m07_middle_solar_panel_29 | solar_panel | middle | 1160 | 190 | 200 | 0 |
| m07_middle_solar_panel_30 | solar_panel | middle | 1560 | 190 | 200 | 0 |
| m07_plant_solar_panel_31 | solar_panel | plant | -1000 | 230 | -9240 | 0 |
| m07_plant_solar_panel_32 | solar_panel | plant | -600 | 230 | -9240 | 0 |
| m07_plant_solar_panel_33 | solar_panel | plant | -200 | 230 | -9240 | 0 |
| m07_plant_solar_panel_34 | solar_panel | plant | 200 | 230 | -9240 | 0 |
| m07_plant_solar_panel_35 | solar_panel | plant | 600 | 230 | -9240 | 0 |
| m07_plant_solar_panel_36 | solar_panel | plant | -1000 | 230 | -8840 | 0 |
| m07_plant_solar_panel_37 | solar_panel | plant | -600 | 230 | -8840 | 0 |
| m07_plant_solar_panel_38 | solar_panel | plant | -200 | 230 | -8840 | 0 |
| m07_plant_solar_panel_39 | solar_panel | plant | 200 | 230 | -8840 | 0 |
| m07_plant_solar_panel_40 | solar_panel | plant | 600 | 230 | -8840 | 0 |
| m07_plant_solar_panel_41 | solar_panel | plant | -1000 | 230 | -8440 | 0 |
| m07_plant_radar_42 | radar | plant | -1000 | 230 | -8040 | 0 |
| m07_plant_control_room_43 | control_room | plant | -400 | 230 | -8040 | 0 |
| m07_plant_solar_tower_44 | solar_tower | plant | 400 | 230 | -8040 | 0 |
| m07_plant_flak_45 | flak | plant | -1200 | 230 | -9500 | 0 |
| m07_plant_flak_46 | flak | plant | -400 | 230 | -9500 | 0 |
| m07_plant_sam_47 | sam | plant | 400 | 230 | -9500 | 0 |
| m07_plant_sam_48 | sam | plant | 1200 | 230 | -9500 | 0 |
| m07_plant_aa_49 | aa | plant | -1200 | 230 | -7780 | 0 |
| m07_plant_aa_50 | aa | plant | -400 | 230 | -7780 | 0 |
| m07_plant_pillbox_51 | pillbox | plant | 400 | 230 | -7780 | 0 |
| m07_plant_pillbox_52 | pillbox | plant | 1200 | 230 | -7780 | 0 |
