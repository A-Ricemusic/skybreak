# Mission world realism

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
ridges past the flyable square. Coastal maps have Terrain water from the coast line out, a rock edge
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
`bun run test:offline`; `--check` fails when stale). *Instances* counts each prop as a MeshPart plus
its SurfaceAppearance, plus the primitive parts. Voxel writes are 4-stud voxels written, mostly the
far ridge ring, whose interior compresses to almost nothing. *Hill cells* are every cell of the
grid-aligned regions the hills read and write (the executor's own regions, not the ellipse areas).

<!-- world-counts:begin (bun tools/world-report.ts) -->
| Mission | Theme | Environment | Terrain ops | Voxel writes (M) | Hill cells (M) | Parts | Props | Core props | Ring props | Backdrop | Trees | Rocks | Buildings | Infra pieces | Unique meshes | Instances | Est. build (s) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M3 Fox switchback | canyon | canyon_dawn | 410 | 60.5 | 0.43 | 24 | 295 | 152 | 107 | 36 | 52 | 68 | 10 | 85 | 16 | 614 | 2.7 |
| M4 Hidden quarters bowl | canyon | canyon_noon | 337 | 54.7 | 0.39 | 26 | 259 | 134 | 89 | 36 | 52 | 68 | 15 | 44 | 19 | 544 | 2.4 |
| M5 Teklan orchard terraces | farm | farm_morning | 253 | 62.8 | 2.19 | 4 | 439 | 252 | 151 | 36 | 200 | 30 | 20 | 153 | 13 | 934 | 3.6 |
| M6 Grain valley irrigation | farm | farm_overcast | 283 | 67.4 | 2.26 | 4 | 401 | 226 | 139 | 36 | 200 | 30 | 10 | 125 | 13 | 858 | 3.8 |
| M7 Dust courier narrows | canyon | canyon_dusk | 377 | 60.2 | 0.53 | 4 | 271 | 137 | 98 | 36 | 52 | 68 | 5 | 66 | 11 | 546 | 2.7 |
| M8 Varda tower siege | canyon | canyon_dusk | 296 | 48.5 | 0.42 | 24 | 298 | 157 | 105 | 36 | 52 | 68 | 14 | 84 | 16 | 620 | 2.2 |
| M9 Vulture moonlit bowl | canyon | canyon_night | 387 | 65.6 | 0.38 | 6 | 269 | 145 | 88 | 36 | 52 | 68 | 12 | 57 | 13 | 544 | 2.9 |
| M10 Kiro abandoned mine | plateau | farm_overcast | 386 | 71.3 | 1.71 | 6 | 341 | 184 | 121 | 36 | 120 | 54 | 11 | 76 | 16 | 718 | 3.7 |
| M11 Twin ridge relay saddle | farm | farm_sunset | 287 | 78.3 | 2.32 | 4 | 420 | 231 | 153 | 36 | 200 | 30 | 14 | 140 | 14 | 896 | 4.3 |
| M12 Open field refugee corridor | farm | farm_morning | 279 | 54.0 | 2.34 | 4 | 450 | 262 | 152 | 36 | 200 | 30 | 20 | 164 | 13 | 954 | 3.3 |
| M13 Staging farm rail yard | farm | farm_overcast | 294 | 64.2 | 1.95 | 4 | 418 | 225 | 157 | 36 | 200 | 30 | 14 | 138 | 14 | 894 | 3.5 |
| M14 High relay crossing | plateau | relay_night | 331 | 50.3 | 1.44 | 6 | 382 | 197 | 149 | 36 | 120 | 54 | 12 | 116 | 16 | 824 | 2.7 |
| M15 Loyalist broadcast common | farm | farm_morning | 262 | 63.3 | 2.32 | 6 | 440 | 252 | 152 | 36 | 200 | 30 | 27 | 147 | 16 | 938 | 3.7 |
| M16 Storm river divide | farm | farm_storm | 276 | 81.0 | 2.37 | 4 | 369 | 217 | 116 | 36 | 200 | 30 | 7 | 96 | 14 | 774 | 4.4 |
| M17 Aurora crown array | plateau | relay_aurora | 369 | 68.0 | 1.57 | 6 | 286 | 170 | 80 | 36 | 120 | 54 | 9 | 23 | 15 | 578 | 3.5 |
| M18 Vulture searchlight ridge | plateau | relay_night | 329 | 55.0 | 1.70 | 26 | 397 | 206 | 155 | 36 | 120 | 54 | 18 | 125 | 20 | 878 | 3.1 |
| M19 Military quays and canal | coast | harbor_fog | 276 | 39.5 | 1.25 | 30 | 385 | 250 | 110 | 25 | 130 | 20 | 42 | 167 | 16 | 848 | 2.2 |
| M20 Eastern wing divided harbor | coast | city_evening | 291 | 40.7 | 0.85 | 30 | 385 | 252 | 110 | 23 | 130 | 20 | 54 | 157 | 16 | 848 | 2.1 |
| M21 Black canal city | coast | city_night | 264 | 42.0 | 1.12 | 41 | 388 | 276 | 87 | 25 | 130 | 20 | 46 | 167 | 16 | 849 | 2.3 |
| M22 Five fog fuel piers | coast | harbor_fog | 291 | 53.7 | 1.25 | 21 | 347 | 214 | 110 | 23 | 130 | 20 | 28 | 145 | 16 | 763 | 2.8 |
| M23 Frigate ring over deep water | ocean | ocean_clear | 262 | 56.1 | 0.00 | 6 | 11 | 4 | 0 | 7 | 0 | 0 | 1 | 0 | 3 | 28 | 2.2 |
| M24 Storm platform trident | ocean | ocean_storm | 238 | 51.7 | 0.00 | 4 | 20 | 13 | 0 | 7 | 0 | 0 | 1 | 12 | 4 | 44 | 2.1 |
| M25 Dawn beachhead | coast | city_dawn | 303 | 44.9 | 1.81 | 6 | 364 | 260 | 79 | 25 | 130 | 20 | 55 | 132 | 16 | 758 | 2.7 |
| M26 Civic plaza blackout | coast | city_night | 276 | 40.4 | 1.28 | 42 | 371 | 300 | 46 | 25 | 130 | 20 | 64 | 132 | 14 | 784 | 2.3 |
| M27 Coastal parliament sunrise | coast | city_dawn | 294 | 45.8 | 1.01 | 6 | 370 | 299 | 46 | 25 | 130 | 20 | 62 | 133 | 15 | 746 | 2.4 |

Budget per world: 200 parts, 520 props, 26 unique meshes, 1200 instances, 100M voxel writes, 2.5M hill cells, 900 terrain ops.
Map: flyable +-6000 (soft boundary +-5400), full-detail core +-3000, voxel terrain +-6800, backdrop ridges centred 7600 out, far skirts to +-24000.
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
