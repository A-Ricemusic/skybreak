# Mission world realism

The outer-district expansion adds three original runtime Blender infrastructure designs and
opens the existing terrain belt to flight. M3/M5/M19 have authored outer districts; the other mission
compositions retain their existing detail.

Mission worlds are built from Terrain voxels and the 20 moderation-approved Blender world models
(`src/shared/RobloxAssetIds.ts`, [uploaded assets](qa/uploaded-assets.md)), not from primitive
Parts. Primitive trees, boulders and buildings appear only when an uploaded model fails to load.

## How a world is built

| Step | Missions 3–27 | Missions 1–2 |
|---|---|---|
| Plan | `shared/WorldPlan.ts`: every voxel op, part, prop and target site as plain numbers, deterministic per mission | hand-composed in `server/MissionWorld.ts` |
| Audit | `shared/WorldAudit.ts` in the offline VM (`WorldPlan.spec`) | sea, mainland, berth and hulls in the offline VM (`LegacyWorlds.spec`); the rest in Roblox Jest (`RelayWorld.spec`) |
| Environment | `shared/EnvironmentPresets.ts` → `server/WorldEnvironment.ts` | same table |
| Terrain | bounded jobs on a per-frame time budget (`server/TerrainWriter.ts`, `shared/TerrainSchedule.ts`) | `Scenery.TerrainSea`, the mainland and the frigate berth through the same writer; islands and hills as before |
| Props | `WorldAssets.Preload` (parallel, 30 s deadline), then `WorldAssets.Place` clones of the cached templates | the same preload, then `Scenery.Trees/Rocks` + `WorldAssets.Place/PlaceUploaded`, grounded by ray |
| Weather | `client/Weather.ts` from `shared/WeatherRules.ts` | same |

**Terrain.** Inland maps are an 8-stud ground slab with material patches (fields, washes, rock
flats), smooth cosine hills (`bump`, written with `WriteVoxels` so they only add), layered mesas
with strata bands, buttresses and talus aprons, canyon walls along the authored track, and a ring of
ridges in the outer flyable belt. Coastal maps have Terrain water from the coast line out, a rock edge
down to the seabed, sand beaches, canals with concrete walls joining inland boat paths to the sea
(the channels are written again after every land op, so civic pavement or a mole never roofs one),
concrete moles under coastal targets, and a dredged berth under every frigate (water 8 studs below
its keel; the open seabed would otherwise meet it). The ocean maps are all water over a mud seabed with rocky
islets. Everything past ±4000 studs is flat ground or sea parts out to ±6000.

**Assets everywhere they fit.**

- Trees and rocks: Pine, Broadleaf and RockA/B/C clones at varied scale and yaw, woods in clusters,
  roadside rows and talus belts round the relief. 60–150 trees on farm and coastal maps.
- Farms: farmhouses, barns and grain silos; orchards of Broadleaf rows on strips.
- Cities: OfficeMidrise, ApartmentBlock and CityTower on a street grid, lit windows from dusk.
- Harbours: HarbourQuay along the shore with a GantryCrane on every other deck, ContainerStack yards
  behind, and moored frigates.
- Airfields (canyon_airfield missions, M1): runway, apron, three Hangars and a ControlTower placed
  along whichever stretch of the runway is clear and flat. M1 has two uploaded hangars and the tower.
- Relay missions: two RelayMasts with red beacons and two RadarDishes with equipment huts.
- M23/M24: the OilPlatform on the hub. M23 has a ring of three Frigates. The command frigate lies
  60 studs outboard of the defended point, so the protected launch floats beside it, and it carries
  green bow and stern beacons (`WorldTag = "ProtectedHull"`).

**What the audit guarantees** (`WorldPlan.spec`, offline, every mission 3–27):

- Every authored flight point, route leg, spawn leg, recon or signal ceiling and chase escape
  has terrain, solid parts and prop bounding boxes at least 40–60 studs below it, checked across
  its radius.
- Every target is on its authored XZ, on a level apron at y 48 resting on the ground, or on a
  platform store deck.
- Grounded parts and every prop rest on what is under them (≤1.5 studs gap). Buildings check 90% of
  their footprint, trees and rocks their trunk or contact point, cranes the quay deck.
- Waterline assets sit at the water surface over water, and every frigate's hull has water down to
  at least 4 studs below its keel. The protected launch's whole hull (26 × 57, 3-stud draught) is
  afloat in open water, with nothing solid over it, at every escort, defend and parked point and
  every 10 studs along every escort leg, not just at the authored vertices (M25's terminal beach
  ramp excepted). Convoy points are on dry ground.
- The budget below holds.

## Mobile budget

The world is built once per sortie, before the server sends `Loading` (the client's 20 s watchdog and
the server's 8 s ready gate start after it). Building never holds the heartbeat for long:

- Terrain runs as bounded jobs, in plan order, yielding a frame whenever one resumption has spent
  12 ms (`TERRAIN_BUDGET`). Axis-aligned slabs tile into ≤262k-voxel Fill calls, and yawed blocks and
  upright cylinders into horizontal layers. Every cut lies on a 4-stud voxel plane, so the result is
  the same as the unsplit op. Hills' `ReadVoxels`/`WriteVoxels` regions split into ≤32k-cell slices.
  Wedges and balls stay whole: the largest is a ≈3.0M-voxel ridge ball in M5, under the engine's
  4M-voxel region cap (`TerrainSchedule.spec` bounds every job).
- Uploaded templates preload in parallel with a 30 s deadline. Placement only reads the cache and
  never waits: a model still loading at the deadline gets its fallback for this sortie. When the
  load finishes, the next world uses the uploaded model.
- Each mission folder records `WorldBuildSeconds`, `WorldTerrainSeconds`, `WorldTerrainLongest`
  (the longest single terrain job), `WorldTerrainJobs`, `WorldTerrainYields` and `WorldPreloadLate`,
  so an engine run can read the worst stall directly.

No per-frame work is added: rain and
drift ride on a volume welded to the local jet visual, lightning is a timer, and the aurora is static
beams. Repeated props are clones of one cached template per asset, so the engine instances their
meshes and SurfaceAppearances. `StreamingEnabled` stays off (see the PR's objections).

Phones (`MobileGraphics`) disable bloom, sun rays and depth of field. They clamp cloud density to
0.18 but keep storm, fog and overcast cover. Weather runs at 45% of the particles, with rain capped
at 220/s and drift at 14/s.

Per-mission counts below are generated from the plans (`bun tools/world-report.ts` after
`bun run test:offline`; `--check` fails when stale). *Instances* estimates each uploaded prop as a MeshPart plus
its SurfaceAppearance, plus primitive parts and conservative model/root/material overhead for
the new runtime infrastructure kits. Plan part entries count each kit placement once; see the
expansion document for actual module/material counts. Voxel writes are 4-stud voxels written, mostly the
far ridge ring, whose interior compresses to almost nothing. *Hill cells* are every cell of the
grid-aligned regions the hills read and write (the executor's own regions, not the ellipse areas).

<!-- world-counts:begin (bun tools/world-report.ts) -->
| Mission | Theme | Environment | Terrain ops | Voxel writes (M) | Hill cells (M) | Parts | Props | Trees | Rocks | Buildings | Ships | Unique meshes | Instances |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Practice | Legacy training islands | canyon_noon | engine-built | - | - | - | - | - | - | - | - | - | - |
| M1 | Sea and island | sea overcast afternoon | 14047 | 207.7 | - | 307 | 161 | - | - | - | - | - | 955 |

Current worlds only. Practice is engine-built; numeric counts require Studio. M1 counts are pure-plan estimates including the carrier stand-in allowance, not assembled runtime measurements.
M1 budgets: 340 parts, 240 props, 1300 descendants, 260M voxel writes, 30000 scheduled jobs. Practice retains the 600 primitive-part engine budget.
<!-- world-counts:end -->

Missions 1–2 are hand-composed. Their counts come from the engine (`PartCount`, `UploadedParts`
attributes on the mission folder). M1 places up to 108 trees and 32 rocks over seven islands (fewer
where the ray finds water, a road or a steep slope), plus two hangars and a tower. M2 places up to 76
trees, 14 rocks, 27 farmhouses and barns, 12 container stacks, 4 gantry cranes and a frigate.

## What a playtester should look at

- Fly low over a farm (M5, M12) and a canyon (M3, M7). Check that trees and rocks sit on the ground
  on slopes, hills read as rolling terrain, and mesas show strata, buttresses and talus.
- Harbour cities (M19–M22, M25–M27): quays meet the water, cranes stand on the quay deck with the
  boom over the berth, container yards sit behind, and frigates are alongside.
- M23: three frigates round the platform. The green-beaconed one sits next to the PROTECT marker.
- Weather: M16 (farm storm) and M24 (ocean storm), with rain streaks crossing the chase camera and
  lightning every 5–15 s, on a phone too. Also M19 and M22 (harbour fog, real fog with no sun disc),
  M7 and M8 (canyon dusk dust front), M17 (aurora beams over the northern horizon), and M20 (city
  evening: the low sun must not white out the frame).
- Watch the server log for `[RelayWorld] ... used the primitive fallback`. Each mission folder
  carries `WorldUploaded` and `WorldFallbacks` attributes.
