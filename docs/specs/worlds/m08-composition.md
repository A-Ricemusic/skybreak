# M08 world composition — in review

2026-10-30 · dormant world key `m08_island_broadcast` · D-170–D-173.

Implements the [world sketch](m08.md) and supports the [mission specification](../missions/m08.md). Based on PR #164's `feat/m06-m07-worlds`; rebase onto main after #164 merges. Reuses `CompactWorldSurface` and the generic `compactWorldCounts` in `M06M07WorldCounts.ts`, including its chunk-touch/yield calibration at 0.25-second terrain slices. No dependency on unmerged #158 code is added.

## Composition and scope

Low tropical main island and western islet, pale sand perimeter, green interior, coastal roads and a supported broadcast complex. Original RelayMast upload is reused at 2×, with procedural control/power buildings and tower modules. Bright broken-cloud daylight at 13:35, dark blue sea, strong haze, no rain. Start (7680,851,7680), heading **315° / NW**; battle (0,1000,-960), transmitter (1920,90,0), bomber entry (-13440,1200,-960), midpoint (-5760,1200,-960), protected airspace (1920,1200,0) retain the sketch. Full 32,768-stud side at k=0.96, cruise calibration 160 studs/s.

GRND 000 is preserved: the three id-named broadcast structures below are untargetable scenery, not enemy objectives. Air superiority 7:00 followed by six-bomber intercept 6:00 and the broadcast hold belong to future mission data; no static bombers, spawn waves, clock, service or scoring are invented here. No carrier or service geometry is added where none was observed. The western entry to transmitter straight route is about 96 seconds at calibration speed; actual first-contact and phase timing require mission integration.

## Surface, ownership and budgets

The cap/curtain shell seals every 128-stud address and shared height edge, including fine/coarse joins, to a perimeter outside hard airspace (16,000 studs). No rock floor and no terrain below Y=0. Land uses 8-stud caps; sea columns contain only native water Y=0–32 near ships, otherwise bounded `Sea` Parts (top32/bottom28) recognized as water by `AircraftCollision`. M08 has no ship/service interaction and uses distant-sea Parts throughout. 256-stud detail near installations/beaches, 1024 elsewhere. All Part dimensions and uploaded scaled bounds ≤2048; foundation tops ≥8 above sampled terrain, bases intersect terrain; full target and rotated dry-prop footprints are supported. Scenery lives beneath one composition folder; `groundTargets: []`; id-named models are available for later adoption. Both clear callbacks register through `registerWorldClear` and the existing lifecycle gate. Registry recognizes the keys; no mission selects them.

Limits per world: 600 million voxel writes, 15,000 scheduled jobs, 650 Parts, 60 props, 2,600 reserved descendants, **≤16 s chunk/yield estimate**. The shared estimator charges scheduled 128-stud chunk touches (0.07 ms solid, 0.2 ms water), full modeled frames at each 0.25 s yield, plus 3 s overhead. These are estimates; runtime GetDescendants remains the hard descendant guard. No new Blender exports or asset uploads occur; approved uploads are consumed unchanged, with CompositionWorld's visible stand-ins if unavailable.

12,294,912 voxel writes · 1,369 jobs · 9,068 solid / 0 water chunk touches · 3 modeled yields · 271 Parts · 25 props · 1,127 reserved descendants · **4.234760 s estimate**.

Passed `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: 771 offline Luau domain contracts, 122 Python tests and all remaining gates.

Validation: deterministic/checkpointed plans, ids/counts/positions, supported nonoverlapping target footprints, complete surface/edge/perimeter sealing, correct water-only ship/carrier footprints, clear beaches/service corridor, scaled props and Part sizes, budgets and dormant catalog. Studio is signed out; offline only. No Studio, Player, phone, new source-frame comparison, visual acceptance, observed load/cleanup time or flight-quality claim. Future acceptance must compare the cited spec frames and exercise actual mission routes/service.

## Complete scenery table

Coordinates are provisional adaptation choices in studs, yaw radians; every id counts once regardless of Part count. These tables do not declare a combat roster.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m08_broadcast_mast | mast | broadcast | 1920 | 90 | 0 | 0 |
| m08_broadcast_control | control | broadcast | 1440 | 90 | 0 | 0 |
| m08_broadcast_power | power | broadcast | 2400 | 90 | 0 | 0 |
