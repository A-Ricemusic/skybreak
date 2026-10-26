# Mission world realism

Mission worlds are built from Terrain voxels and the 20 moderation-approved Blender world models
(`src/shared/RobloxAssetIds.ts`, [uploaded assets](qa/uploaded-assets.md)), not from primitive
Parts. Primitive trees, boulders and buildings appear only when an uploaded model fails to load.

## How a world is built

| Step | Missions 3–27 | Missions 1–2 |
|---|---|---|
| Plan | `shared/WorldPlan.ts`: every voxel op, part, prop and target site as plain numbers, deterministic per mission | hand-composed in `server/MissionWorld.ts` |
| Audit | `shared/WorldAudit.ts` in the offline VM (`WorldPlan.spec`) | Roblox Jest only (`RelayWorld.spec`) |
| Environment | `shared/EnvironmentPresets.ts` → `server/WorldEnvironment.ts` | same table |
| Terrain | voxel ops written back to back (one replication batch) | `Scenery.TerrainSea`, islands, hills |
| Props | `WorldAssets.Place` clones of cached templates (loaded in parallel) | `Scenery.Trees/Rocks` + `WorldAssets.PlaceUploaded`, grounded by ray |
| Weather | `client/Weather.ts` from `shared/WeatherRules.ts` | same |

**Terrain.** Inland maps are an 8-stud ground slab with material patches (fields, washes, rock
flats), smooth cosine hills (`bump`, written with `WriteVoxels` so they only add), layered mesas
with strata bands, buttresses and talus aprons, canyon walls along the authored track, and a ring of
ridges past the flyable square. Coastal maps have Terrain water from the coast line out, a rock edge
down to the seabed, sand beaches, canals with concrete walls joining inland boat paths to the sea,
and concrete moles under coastal targets. The ocean maps are all water over a mud seabed with rocky
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
- Waterline assets sit at the water surface over water. Boat points are on open water. Convoy
  points are on dry ground.
- The budget below holds.

## Mobile budget

The world is built once per sortie under the loading screen. No per-frame work is added: rain and
drift ride on a volume welded to the local jet visual, lightning is a timer, and the aurora is static
beams. Repeated props are clones of one cached template per asset, so the engine instances their
meshes and SurfaceAppearances. `StreamingEnabled` stays off (see the PR's objections).

Phones (`MobileGraphics`) disable bloom, sun rays and depth of field. They clamp cloud density to
0.18 but keep storm, fog and overcast cover. Weather runs at 45% of the particles, with rain capped
at 220/s and drift at 14/s.

Per-mission counts below are generated from the plans (`bun tools/world-report.ts` after
`bun run test:offline`; `--check` fails when stale). *Instances* counts each prop as a MeshPart plus
its SurfaceAppearance, plus the primitive parts. Voxel writes are 4-stud voxels written, mostly the
far ridge ring, whose interior compresses to almost nothing.

<!-- world-counts:begin (bun tools/world-report.ts) -->
| Mission | Theme | Environment | Terrain ops | Voxel writes (M) | Parts | Props | Trees | Rocks | Buildings | Ships | Unique meshes | Instances |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M3 Fox switchback | canyon | canyon_dawn | 318 | 61.6 | 75 | 86 | 36 | 44 | 6 | 0 | 9 | 247 |
| M4 Hidden quarters bowl | canyon | canyon_noon | 255 | 52.7 | 70 | 91 | 36 | 44 | 11 | 0 | 10 | 252 |
| M5 Teklan orchard terraces | farm | farm_morning | 232 | 69.6 | 24 | 174 | 140 | 22 | 12 | 0 | 8 | 372 |
| M6 Grain valley irrigation | farm | farm_overcast | 254 | 76.7 | 25 | 168 | 140 | 22 | 6 | 0 | 8 | 361 |
| M7 Dust courier narrows | canyon | canyon_dusk | 289 | 67.3 | 39 | 82 | 36 | 44 | 2 | 0 | 7 | 203 |
| M8 Varda tower siege | canyon | canyon_dusk | 240 | 57.7 | 67 | 90 | 36 | 44 | 10 | 0 | 9 | 247 |
| M9 Vulture moonlit bowl | canyon | canyon_night | 302 | 63.0 | 26 | 88 | 36 | 44 | 8 | 0 | 9 | 202 |
| M10 Kiro abandoned mine | plateau | farm_overcast | 251 | 80.5 | 28 | 123 | 80 | 36 | 7 | 0 | 8 | 274 |
| M11 Twin ridge relay saddle | farm | farm_sunset | 257 | 89.6 | 36 | 168 | 140 | 22 | 6 | 0 | 8 | 372 |
| M12 Open field refugee corridor | farm | farm_morning | 248 | 55.7 | 26 | 174 | 140 | 22 | 12 | 0 | 8 | 374 |
| M13 Staging farm rail yard | farm | farm_overcast | 250 | 68.6 | 41 | 168 | 140 | 22 | 6 | 0 | 8 | 377 |
| M14 High relay crossing | plateau | relay_night | 257 | 75.3 | 31 | 122 | 80 | 36 | 6 | 0 | 9 | 275 |
| M15 Loyalist broadcast common | farm | farm_morning | 251 | 74.6 | 30 | 179 | 140 | 22 | 17 | 0 | 10 | 388 |
| M16 Storm river divide | farm | farm_storm | 235 | 85.6 | 39 | 165 | 140 | 22 | 3 | 0 | 8 | 369 |
| M17 Aurora crown array | plateau | relay_aurora | 263 | 75.5 | 28 | 124 | 80 | 36 | 8 | 0 | 9 | 276 |
| M18 Vulture searchlight ridge | plateau | relay_night | 271 | 83.6 | 69 | 128 | 80 | 36 | 12 | 0 | 11 | 325 |
| M19 Military quays and canal | coast | harbor_fog | 122 | 37.3 | 70 | 143 | 90 | 14 | 38 | 1 | 12 | 356 |
| M20 Eastern wing divided harbor | coast | city_evening | 118 | 34.8 | 68 | 155 | 90 | 14 | 50 | 1 | 12 | 378 |
| M21 Black canal city | coast | city_night | 134 | 32.0 | 94 | 147 | 90 | 14 | 43 | 0 | 11 | 388 |
| M22 Five fog fuel piers | coast | harbor_fog | 117 | 46.8 | 61 | 129 | 90 | 14 | 24 | 1 | 12 | 319 |
| M23 Frigate ring over deep water | ocean | ocean_clear | 102 | 34.8 | 22 | 4 | 0 | 0 | 1 | 3 | 2 | 30 |
| M24 Storm platform trident | ocean | ocean_storm | 91 | 31.7 | 44 | 1 | 0 | 0 | 1 | 0 | 1 | 46 |
| M25 Dawn beachhead | coast | city_dawn | 124 | 41.4 | 45 | 159 | 90 | 14 | 53 | 2 | 12 | 363 |
| M26 Civic plaza blackout | coast | city_night | 128 | 36.8 | 96 | 167 | 90 | 14 | 63 | 0 | 11 | 430 |
| M27 Coastal parliament sunrise | coast | city_dawn | 121 | 35.2 | 61 | 165 | 90 | 14 | 61 | 0 | 11 | 391 |

Budget per world: 340 parts, 280 props, 20 unique meshes, 100M voxel writes, 700 terrain ops.
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
