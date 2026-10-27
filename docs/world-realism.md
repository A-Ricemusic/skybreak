# Mission world realism

Mission worlds are built from Terrain voxels and moderation-approved Blender models
(`src/shared/RobloxAssetIds.ts`, [uploaded assets](qa/uploaded-assets.md)), not from primitive
Parts. Primitive shapes appear only when an uploaded model has no ID yet or fails to load.

## Map size and detail tiers

| | Before | Now |
|---|---|---|
| Flyable square (hard boundary) | ±2800 | **±6000** (2.14× linear, 4.6× area) |
| Soft boundary (airspace warning and turn-back) | ±2400 | ±5400 |
| Voxel terrain | ±4000 | ±6800 |
| Horizon | primitive/voxel ridge ring at ~3200 (inside today's flyable area) | uploaded mountain ridges centred 7600 out, every crest above the altitude ceiling |
| Far ground / sea | 20 tile Parts to ±6000 | 4–6 stretched skirts to ±24000 |

The authored missions did **not** move: every flight point, route, ceiling, target, escort path and
chase escape still sits inside ±2400, so the PR #47 audits, the mission pacing and the relay
tables are unchanged. The world grows around them instead, in tiers (`shared/WorldPlan.ts`):

- **Core (±3000): full detail.** Everything from PR #47: two voxel layers, dense field patches,
  layered mesas, hills, settlements, woods, harbours, the authored road.
- **Explorable ring (to the ±6000 edge): coarser and sparser.** One voxel layer and a two-layer sea,
  large material patches, one feature per jittered 1500-stud cell at most (single-tier mesas with cliff
  panels, long soft ridges, islets at sea), highways from the authored road's ends to the edge with
  power lines, farmsteads or hamlets beside them, and about a third of the core's trees over five
  times the area. The audit caps its relief at 560 and its prop density at half the core's.
- **Backdrop (past the edge).** Uploaded `RidgeAlpine`/`RidgeDesert` meshes (2000 × 2000, crest ≥ 1185
  studs) overlap end to end on every land side, fronts to the play area, inner foot ≥ 400 studs past
  the hard boundary. From anywhere under the 1050-stud altitude ceiling, every ray out over land meets
  a crest, so the voxel edge is never in view. Sea sides get distant islands and the sea skirt runs
  into the haze.

Missions 1–2 follow the same scheme by hand: the sea runs to ±6800, M1 gains six wooded outer
islands and sea stacks out to 5200, M2 gains a hinterland (the coast continues east and west of the
harbour and the land runs back to the edge, with hills, woods and the coast road), and both get the
uploaded ridge ring.

**Gameplay changes.** `FlightMath.SoftBoundary`/`HardBoundary` drive the airspace warning, the
turn-back and the clamp, so they follow automatically. Enemy waves still arrive 2600–3200 studs from
the player, now clamped to ±5000 instead of ±2500 (`CombatService.SPAWN_LIMIT`), so a wave reaches a
player exploring the ring from the same angles as in the core. The radar keeps its 3200/1600 ranges:
objectives farther away are pinned to the rim in their direction.

## How a world is built

| Step | Missions 3–27 | Missions 1–2 |
|---|---|---|
| Plan | `shared/WorldPlan.ts`: every voxel op, part, prop and target site as plain numbers, deterministic per mission | hand-composed in `server/MissionWorld.ts` |
| Audit | `shared/WorldAudit.ts` in the offline VM (`WorldPlan.spec`) | sea, mainland, hinterland, berth and hulls in the offline VM (`LegacyWorlds.spec`); the rest in Roblox Jest (`RelayWorld.spec`) |
| Environment | `shared/EnvironmentPresets.ts` → `server/WorldEnvironment.ts` | same table |
| Terrain | bounded jobs on a per-frame time budget (`server/TerrainWriter.ts`, `shared/TerrainSchedule.ts`) | the same writer |
| Props | `WorldAssets.Preload` (parallel, 30 s deadline), then `WorldAssets.Place` clones of the cached templates | the same preload, then `Scenery` + `WorldAssets.Place/PlaceUploaded`, grounded by ray |
| Weather | `client/Weather.ts` from `shared/WeatherRules.ts` | same |

**Terrain.** Inland maps are a ground slab with material patches, smooth cosine hills (`bump`),
layered mesas with strata bands, buttresses, talus aprons and uploaded cliff panels, canyon walls along
the authored track, and the explorable ring's coarser relief. Coastal maps have Terrain water from the
coast line out, a rock edge down to the seabed, sand beaches, canals with concrete walls joining inland
boat paths to the sea (rewritten after every land op so nothing roofs a channel), concrete moles under
coastal targets, and a dredged berth under every frigate. The ocean maps are all water with islets.

**Modular Blender pieces replace the last primitives** (`tools/assets/infrastructure.py`):

| Asset | Replaces | Placement |
|---|---|---|
| `RunwaySegment`, `RunwayThreshold` | runway, shoulder, centreline and threshold Parts | two ends + two 270-stud segments per 1000-stud runway (`runwayPieces`) |
| `ApronSlab` | airfield apron, M1 taxiways | 64 × 240 tiles |
| `RoadSegment`, `DirtTrack` | road, street and track Parts | `tilePieces`: a whole number of pieces fills each run exactly, scaled ±25% around the nominal width, so pieces never overlap; each road call sits a little higher than the last so crossings never share a plane |
| `RoadBridge` | bridge deck, rails, piers, abutments, low road bridges | ramps on both banks, piers on the river bed; every road or highway crossing |
| `TargetPad` | target apron Parts | scaled to the apron size, top always at 48 |
| `StoreDeck`, `Gangway` | ocean store deck, legs, braces and walkway | deck top at 96 (the target), gangways tiled to the platform |
| `EquipmentHut` | relay equipment hut box | beside each radar dish |
| `CivicHall` | parliament block, steps, columns and roof | back on the plaza edge, portico to the plaza |
| `CliffSandstone`, `CliffGranite` | (new) | set into mesa walls, top under the tier top |
| `RidgeAlpine`, `RidgeDesert` | primitive and voxel mountain rings | the backdrop and far islands |
| `FenceSpan`, `PowerLineSpan` | (new) | fences round farm settlements; pylon lines beside highways |

Every one has a primitive fallback in `WorldAssets` (one or a few Parts in its footprint) until its
ID is filled in. Small neon lights (runway edge lights, approach bars, beacons, lit windows) stay
Parts: they are light sources, not geometry.

**What the audit guarantees** (`WorldPlan.spec`, offline, every mission 3–27), in addition to PR #47's
flight clearance, grounded targets, nothing floating, boats afloat and convoys on dry ground:

- **Horizon:** from every point of the flyable edge every 400 studs, rays up to 60° off the outward
  normal cross a backdrop crest above 1110 (the altitude ceiling plus a chase camera), except rays
  that reach the sea; every ring ridge stands wholly 200+ studs past the edge.
- **Extent:** terrain or water everywhere in the flyable square (750-stud grid), explorable relief
  under 560, far skirts covering every point from the voxel edge to ±24000.
- **Detail fall-off:** the ring's props per km² are at most half the core's.
- **New pieces:** bridges' ramp ends on the banks and piers on the river bed, cliff panels' feet on
  the ground or talus, pylons on the ground, fences and road pieces resting on flat ground,
  hardstands' tops at the target base. Gangways are elevated and exempt.
- **Budget** (below), now including instances.

## Mobile budget

The world is built once per sortie, before the server sends `Loading` (the client's 20 s watchdog and
the server's 8 s ready gate start after it):

- Terrain runs as bounded jobs, yielding a frame whenever one resumption has spent 12 ms
  (`TERRAIN_BUDGET`). The bigger maps write *fewer* voxels than before (largest 81M, was 89.6M):
  the explorable ring is one layer, its relief is wedge pairs and single tiers, and the voxel ridge ring
  became uploaded meshes. Hill cells are capped at 95% of the 2.5M budget as they are placed.
- Uploaded templates preload in parallel with a 30 s deadline (unchanged). A world now uses at most
  20 unique meshes (budget 26).
- Each mission folder records `WorldBuildSeconds`, `WorldTerrainSeconds`, `WorldTerrainLongest`,
  `WorldTerrainJobs`, `WorldTerrainYields` and `WorldPreloadLate`.
- **Est. build** below is a rough estimate from assumed engine rates (Fill* at 25M voxels/s, the hills'
  Luau loop at 2M cells/s, 0.05 ms a part, 0.2 ms a prop clone), excluding the template preload. No
  engine run has measured it; calibrate it against `WorldBuildSeconds`.

Repeated props are clones of one cached template per asset, so the engine instances their meshes and
SurfaceAppearances; the road, fence and power-line runs are many clones of three meshes. The backdrop
ridges are 2400 triangles each (about 36 per land map) and are not flight-solid, so they add nothing
to the collision query; MeshPart LOD lowers their cost at that distance.

**`StreamingEnabled` stays off.** The flyable area is 4.6× larger, but the instance count stays
bounded (≤ 954 per world) and the far field is a handful of stretched parts. Streaming would make
the backdrop and far terrain pop in and out at a phone's small streaming radius (exactly what hides
the edge), would change when ground targets, protected actors and the flight-probe include list exist
on the client, and would need Persistent models for every gameplay object. Revisit it only if an engine
run shows phone memory pressure; then make the backdrop and targets Persistent first.

Phones (`MobileGraphics`) disable bloom, sun rays and depth of field, clamp cloud density to 0.18 and
run weather at 45% of the particles.

Per-mission counts below are generated from the plans (`bun tools/world-report.ts` after
`bun run test:offline`; `--check` fails when stale). *Instances* counts each prop as a MeshPart plus
its SurfaceAppearance (the power line has two MeshParts), plus the primitive parts. *Core / Ring /
Backdrop* split the props by tier. *Infra pieces* are the modular runway, apron, road, track, bridge,
hardstand, deck, gangway, fence and power-line pieces.

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
attributes on the mission folder). M1 places up to 168 trees and 50 rocks over thirteen islands, the
runway and taxiway pieces, two hangars and a tower; M2 places up to 134 trees, 26 rocks, 27 farmhouses
and barns, 12 container stacks, 4 gantry cranes and a frigate. Both carry 36 backdrop ridges.

## What a playtester should look at

- Fly to the edge of any land map (M5, M3, M14): the warning starts at 5400, mountains fill the view
  past the edge at every altitude, and nothing ends abruptly. On the coast (M19–M27) the sea side runs
  into haze with far islands.
- The explorable ring: highways with power lines and farmsteads (M5, M12, M15), outer mesas with cliff
  panels (M3, M10), islets (M23).
- Airfields (M3, M8, M18, M1): the runway pieces join with continuous dashes, threshold stripes at both ends.
- River bridges (M3, M11, M16): ramps on both banks, piers in the water.
- Harbour cities (M19–M22, M25–M27): quays, cranes, frigates as before; the civic hall on M21/M26/M27.
- Weather: M16 and M24 storms, M19 and M22 fog, M7 and M8 dust, M17 aurora, M20 evening sun.
- Watch the server log for `[RelayWorld] ... used the primitive fallback`: until the new IDs are filled,
  every new piece is its fallback (expected).
