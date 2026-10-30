# M11 High Crossing — procedural composition in review

Implements the world portion of [world spec](m11.md) and [mission spec](../missions/m11.md), stacked on #166 above #164. Decisions D-182/D-183. Snowy rock ranges, pale yellow-grey bright overcast15:31, no ground/naval attack objectives, settlement or invented landing strip. Terrain spans480–748 studs with white summits above640 and dark rock faces below; a wide low saddle and ingress pocket remain open. Uses1,024-stud terrain cells; no dense prop field.

## Civilian route handoff

Start(0,735,9600), heading315° NW. Two original static friendly passenger silhouettes (four Parts each,50-stud fuselage) have id-owned models at the exported route starts; future mission actors must adopt/remove them before moving to avoid duplicated aircraft. They are scenery, not damageable escort actors or armed allies.

| Route id | Start (X,Y,Z) | Mid-route at Z0 | Exit (X,Y,Z) | Duration |
|---|---|---|---|---|
| m11_civilian_low | (-1440,900,6240) | (-1920,900,0) | (0,900,-11520) |313.28s |
| m11_civilian_high | (2880,2800,6240) | (1920,2800,0) | (0,2800,-11520) |313.28s |

`m11RoutePoint` uses smooth cosine bends; `m11Routes` exports65 samples per independent route. Route altitude stays exactly900/2800, including the high endpoint; the engine's2,000-stud encounter validator does not clip the world data. Route length is~18k studs (~57–58stud/s at313.28s); the earlier21.1k/67 estimate is provisional, not a fixed speed contract. The mission clock metadata is330s (5:30); actual dual survival/progress/threat targeting and completion remain absent. The low flight tube is1,440 studs wide and has≥150-stud terrain clearance throughout; high route is clear. No change to flight ceiling/controls.

The proposed1,600–2,200 cloud transition is exported metadata and a6,500ft reference attribute, **not** an altitude-dependent rendered layer. Bright overcast/atmosphere supplies the current sky treatment with cloud density capped0.3 for phones. Layer transitions and compressed vertical layout need rendered review together. Literal23,000ft(~6,730studs+datum) exceeds today's hard ceiling; Y2,800 is the spec's explicit reviewable adaptation. Extending encounter validation above2,000 is required before these routes become playable; independently protected airliners and attacker priorities are separate integration work.

## Ownership, surface and validation

These are dormant review worlds: registry recognizes the keys but MissionCatalog never selects them. CompositionWorld returns `groundTargets: []`; id-named scenery models provide future adoption points, never duplicate score actors. Each native clear callback registers via `registerWorldClear`; no Studio session or upload was used.

Reuse PR #166's CompactWorldSurface and chunk/yield estimator from #164. Land has 8-stud caps and shared-edge/perimeter curtains above Y=0; every 128-stud column and fine/coarse join is sealed past the 16,000-stud hard boundary. M10's river columns are water-only from0 to32; there is no global solid seabed or below-zero floor. Neither inland world needs distant ocean; the shared helper emits bounded `Sea` Parts wherever a future non-native sea region exists. All Parts and scaled uploaded dimensions are ≤2,048. Foundations overlap their terrain support and stand ≥8 studs above it.

Per-world caps: 600M voxel writes, 15,000 scheduled jobs, 650 reserved Parts, 60 props, 2,600 reserved descendants, **≤16 s estimated build**. Chunk model: 0.07ms solid/0.2ms water per scheduled128-stud chunk touch, modeled full frames at0.25s terrain slices, plus3s overhead. These are estimates, never Studio/phone measurements. Runtime GetDescendants remains the hard guard. M10 reserves four fallback Parts plus24 descendants for each of its16 uploaded naval contacts in addition to prop allowances and256 wrapper/template overhead; minor ground contacts use only two Parts plus one foundation each. M11 uses eight primitive aircraft Parts total.

Validation: `bun install --frozen-lockfile`, `bun run build`, and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`. Passed all gates: **779 offline Luau contracts and 122 Python tests**, plus catalog/UI/audio/radio/document checks. The new offline Luau contracts cover determinism/checkpoints/dormancy, counts/anchors/ids, target supports/non-overlap, scaled prop support and bounds, complete column/edge sealing, ship water-only footprints and waterlines, full landing approaches against terrain/Parts/props, unclipped civilian route tubes and build budgets. No Roblox Jest/Studio, Player, real phone, new reference frame comparison, rendered visual quality or flight feel is claimed. Actual rendered/load/clear acceptance remains open. No Blender-origin file was created, changed, exported or uploaded.

## Offline build budget

144925184 voxel writes · 5930 jobs · 89360 solid / 0 water chunk touches · 26 modeled yields · 8 reserved Parts · 0 props · 264 reserved descendants · **14.455200 s estimate**.

## Complete scenery table

Coordinates are studs, yaw radians. Every id counts once regardless of geometry complexity.

| ID | Type | Group | X | Y | Z | Yaw |
|---|---|---|---:|---:|---:|---:|
| m11_civilian_low | civilian | protected | -1440.00 | 900.00 | 6240.00 | 0.00 |
| m11_civilian_high | civilian | protected | 2880.00 | 2800.00 | 6240.00 | 0.00 |
