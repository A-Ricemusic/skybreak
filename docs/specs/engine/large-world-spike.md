# Large-world budget spike

2026-10-28. Research baseline: `76f7f9e80ab551c64782027a37a8b1a7cc7bfec0` (main at checkout). No shipped source, place properties, or human dashboard changes. No asset upload, publishing, Roblox Player test, or merge. The owner's full-scale decision is retained; this report evaluates implementation options rather than authorizing scale compression.

## Target and decision

Proposed acceptance gate: **terrain ready before the mission clock starts within 30 s server wall time (20 s preferred), client ready within another 10 s, sustained 30 FPS on a real mid-range phone, and no missing foreground terrain at cruise or 600 studs/s**. Count prop/template loading and replication as additional work; passing a terrain-only timing is insufficient. A useful engineering target is a maximum 33 ms server yield gap; the current 12 ms scheduler is not a hard guarantee.

The largest full-resolution runtime-generated square demonstrated under the terrain-only 30 s target is **8,000 studs**. The 16,000-stud case already fails. This is a bounded test result, not proof that every 8,000-stud island or a production mission passes. Full-resolution 35,000-stud runtime heightfield generation must not be the default construction strategy.

## Machine, version and isolation

- MacBook Air `MacBookAir10,1`, Apple M1, 8 cores (4 performance + 4 efficiency), 8 GB unified memory; macOS 26.5.2, build 25F84.
- Roblox Studio **0.745.0.7451137**, application build **7451137**, confirmed by `version()` and the app Info.plist. Measurements use local Studio, not a Roblox production server.
- Bun/roblox-ts/Rojo repository build; compiled writer and scheduler are packaged unchanged into `tools/spikes/large-world.project.json`. All terrain experiments are in an unpublished throwaway place guarded by `Workspace.LargeWorldSpike=true`.
- `pgrep -x RobloxStudio` found no pre-existing Studio. Only the spike Studio was launched. No `bun run test:roblox` ran. A background offline validation build overlapped the early 8k measurements; later full cases had no offline build running. This and editor plugins are sources of timing noise. Installed Studio plugins were present (including a weather plugin and a Rojo connection retry), so the large Edit-mode memory baseline includes editor/plugin overhead.
- Initial guard and Luau calling-convention errors were corrected before the completed measurement series. The engine scripts execute through Studio MCP in Edit mode, yielding asynchronously. These are engine measurements, not an offline API emulation.

## Geometry and scheduling method

Here **extent means total square width**, not half-width. Each full case writes shallow Water from y=-24 to -16 and a 4-stud Mud seabed, then one elongated additive cosine heightfield using the actual `TerrainWriter` bump implementation: width `0.24 × extent`, length `0.60 × extent`, base -24, peak rise 576 studs. For extent 16,000 this is a 9,600 × 3,840-stud island, matching the spec's approximate 10 × 4 km at 0.96 studs/metre. A 35,000-stud square is a conservative stress case with a larger 21,000 × 8,400-stud island; a 35,000-stud route over mostly sea with a fixed 9,600-stud island would cost less. Do not confuse the world square with the island size.

The island uses LeafyGrass, with current Water/Mud sea materials. This is a simple heightfield lower bound, **not** the completed reference world: no cliff strata, inlet/river carves, material layering, city, airbase or coastal islets in terrain timings. Additional overlapping operations add work. `TerrainSchedule` splits fills at 262,144 cells and bump ReadVoxels/WriteVoxels slices at 32,768 cells, checks 12 ms after each job, then uses `task.wait()`. Resolution is 4 studs. Bump cell counts include the entire bounding grid including empty space, unlike filled island volume.

`wallSeconds` includes scheduler waits; `workSeconds` sums job execution. `longestJobSeconds` is **not a frame time**. A separate yielding task records the largest interval between resumptions, including scheduling/engine work. That is a yield-gap proxy, not a captured renderer frame. Stats total MB is sampled at yields and after writing: a sampled peak can miss spikes, includes editor/engine state and retained caches, and is not the terrain's standalone allocation. `gcinfo()` reports Luau heap only. Cases run sequentially after `Terrain:Clear()` and a 2 s wait; clearing does not reset caches or force GC, so later absolute memory is not directly comparable to a fresh process. Full-resolution cases each ran once; the LOD comparison ran twice (tables use the second, instrumented pass), and props were repeated after a spatial-query warm-up fix. These are exploratory samples, not confidence intervals. The first LOD pass ranged from 0.78 to 10.46 s; the second ranged from 0.41 to 13.78 s, demonstrating cache/load variability.

## Full-resolution terrain results

<!-- FULL_TABLE -->
| Square width | Sea + bed / island / total wall s | Sea / island jobs | Sea / hill cells M | Worst yield gap ms | Longest job ms | Peak Studio Stats MB |
|---:|---:|---:|---:|---:|---:|---:|
| 8,000 | 0.98 / 13.34 / 14.32 | 128 / 2,880 | 12.00 / 84.10 | 47.4 | 10.7 | 3,124 |
| 16,000 | 3.62 / 69.27 / 72.89 | 512 / 10,560 | 48.00 / 336.38 | 34.8 | 16.2 | 3,514 |
| 24,000 | 8.89 / 165.82 / 174.72 | 1,152 / 24,480 | 108.00 / 756.86 | 6747.8 | 42.1 | 4,383 |
| 35,000 | 21.28 / 420.70 / 441.98 | 2,592 / 50,400 | 229.69 / 1609.65 | 12558.2 | 875.7 | 5,522 |
<!-- /FULL_TABLE -->

Sea is not free: even uniform shallow water and mud touch cells across the entire square. It uses fast FillBlock regions rather than Luau per-cell iteration. Runtime heightfield loops dominate the full case. Omitting unseen deep seabed volume helps but does not eliminate full-square water replication/meshing. Current `Scenery.TerrainSea` already uses flat sea Parts beyond the detailed region; use that principle at full scale instead of expanding every voxel slab.

## Lower-detail comparison

Two controls must be distinguished. `core-and-flat` caps **both** water and the island at 7,200 studs, then extends sea with 1,000-stud Parts. It measures bounded core/sea costs, but shrinks the island and cannot establish full-scale feasibility. Its detailed core touches 9.72M sea/seabed cells and 68.12M bump cells regardless of world extent.

The full-footprint comparison (`large-world-lod.luau`) retains the full cosine island outline and 576-stud rise. It samples level height columns on a 64-stud grid inside a central 7,168-stud square and a 256-stud grid beyond, writing LeafyGrass blocks through the same writer. **This is coarse geometry sampling at native 4-stud voxels, not a larger WriteVoxels resolution.** Stair-stepped distant surfaces and coasts need art review; this tool does not certify their appearance. Water remains a bounded 7,200-stud core, with flat sea recommended outside it. Reported LOD island timings exclude sea and distant sea Part creation.

<!-- LOD_TABLE -->
| Square width | Island wall s | Jobs | Worst yield gap ms | Longest job ms | Studio Stats before / sampled peak MB |
|---:|---:|---:|---:|---:|---:|
| 8,000 | 0.41 | 1,768 | 23.4 | 5.9 | 4,089 / 4,136 |
| 16,000 | 1.55 | 6,104 | 30.6 | 2.5 | 4,118 / 4,176 |
| 24,000 | 7.42 | 10,048 | 88.5 | 65.4 | 4,171 / 4,277 |
| 35,000 | 13.78 | 14,124 | 106.2 | 63.3 | 4,295 / 4,496 |
<!-- /LOD_TABLE -->

## Streaming, high-speed traversal and device emulation

The reusable Play probe uses StudioTestService and paired server/LocalScripts. Its server builds the full-footprint sampled-column island plus bounded core water and 2,000-stud far-sea Parts. It creates the current uploaded jet visual, anchored and moved with the streaming focus; production flight physics are excluded. Its client moves the character root and camera at **600 studs/s** at y=650, from z=-0.24×extent to +0.24×extent. Terrain raycasts below and 600 studs ahead sample foreground availability. This isolates streaming demand; it does not run the shipped aircraft/controller, dogfight workload, scenery, prediction or target lifecycle. Full-resolution Play cases were not run after their generation exceeded the server load gate; the client matrix tests the full-scale LOD candidate. No network delay/loss was injected, and the isolated place omits combat, reference overcast/lighting and dense scenery. The route crosses the island spine, not every coastline/view angle. Missing rays can expose late terrain; zero misses cannot prove that distant terrain never visibly pops.

<!-- CLIENT_TABLE -->
| Profile | Width | Streaming | Server build s | Client wait for ready / island ray after ready s | FPS / worst render ms | Ground / ahead misses (samples) | Server / client Stats MB (aggregate) |
|---|---:|---|---:|---:|---:|---:|---:|
| desktop | 8,000 | off | 1.49 | 0.60 / 0.0009 | 54.7 / 169 | 0 / 0 (35) | 5,656 / 5,656 |
| desktop | 8,000 | on | 1.52 | 0.66 / 0.0006 | 59.3 / 92 | 0 / 0 (38) | 5,681 / 5,681 |
| desktop | 16,000 | off | 2.95 | 1.80 / 0.0007 | 59.3 / 168 | 0 / 0 (75) | 5,890 / 5,890 |
| desktop | 16,000 | on | 3.15 | 2.16 / 0.0007 | 59.0 / 152 | 0 / 0 (75) | 5,968 / 5,968 |
| desktop | 24,000 | off | 5.04 | 4.06 / 0.0012 | 59.0 / 224 | 0 / 0 (113) | 5,877 / 5,877 |
| desktop | 24,000 | on | 4.07 | 3.11 / 0.0006 | 59.0 / 228 | 0 / 0 (113) | 6,070 / 6,070 |
| desktop | 35,000 | off | 8.85 | 7.80 / 0.0008 | 59.3 / 222 | 0 / 0 (166) | 6,172 / 6,172 |
| desktop | 35,000 | on | 7.60 | 6.69 / 0.0004 | 58.6 / 234 | 0 / 0 (164) | 6,473 / 6,473 |
| Galaxy A16 emulator | 35,000 | off | 8.74 | 7.69 / 0.0006 | 58.7 / 268 | 0 / 0 (164) | 6,220 / 6,220 |
| Galaxy A16 emulator | 35,000 | on | 8.58 | 6.38 / 0.0004 | 58.3 / 240 | 0 / 2 (163) | 6,528 / 6,528 |
<!-- /CLIENT_TABLE -->

Server/client Stats were effectively identical in every local Play run: these are two context samples of aggregate Studio memory, **not isolated server and client memory**. No per-process production memory reduction from streaming is established. The radius-property probe returned `StreamingMinRadius is not a valid member of Workspace` in this Studio session; the matrix only changed StreamingEnabled and retained the place’s saved/default streaming configuration. The radius suggestions below were not tested. Client timing begins after the LocalScript has acquired the character and RemoteEvent, excluding initial Studio/character startup; the second interval waits for a successful terrain ray, **not a rendered island image**. Total cold-client visibility time is unmeasured. The server build excludes jet asset loading before the timed terrain section. Foreground hit probes ran every ten render frames; the server focus/anchored jet visual received position updates at that cadence, while the client camera moved every frame. No automated image comparison or human visual pop-in review was performed.

The phone preset API reported Samsung Galaxy A16, 780 × 360 logical size, resolution scale 3, 385 DPI. The active simulator was restored to `default`, and streaming restored to false after the matrix. Phone emulation uses the Studio Galaxy A16 preset. These results remain M1 desktop renderer numbers with phone viewport/input emulation, **not real-phone FPS, memory capacity, thermal or mobile-network measurements**. No production mobile acceptance claim follows from them. **Streaming-on at 35k produced two missing ahead-of-route terrain rays in 163 samples under the phone preset; streaming-off produced none.** Zero ground misses means the sampled terrain was present on arrival, not that the horizon stayed visually stable. Retain streaming off for the next prototype; prefetch/load gates and real-device validation must precede adoption.

## Scenery and instance costs

The measurement scales a documented sparse whole-map baseline: M6's 140 trees, 22 rocks and 6 buildings over an 8,000-stud square, multiplied by `(extent/8000)^2`, plus one airbase of three Hangars and one ControlTower. It invokes the existing Scenery tree/rock grounding and WorldAssets cached placement paths after preloading existing approved assets. Counts are actual descendants of the measured folder; uploads/fallbacks must be reported separately. Objects are packed onto a flat 1,800-stud test pad to isolate creation rather than authored distribution; this is not an FPS/draw-distance test, and the four airbase props exclude runway/taxiway lights, aircraft and pavement.

<!-- PROPS_TABLE -->
| Square width | Trees / rocks / buildings requested | Uploaded models / BaseParts | Descendants | Warm placement s | Studio Stats delta MB |
|---:|---:|---:|---:|---:|---:|
| 8,000 | 140 / 22 / 6 | 172 / 172 | 516 | 0.059 | 2.02 |
| 16,000 | 560 / 88 / 24 | 676 / 676 | 2,028 | 0.127 | 8.88 |
| 24,000 | 1260 / 198 / 54 | 1,516 / 1,516 | 4,548 | 0.206 | 23.89 |
| 35,000 | 2680 / 421 / 115 | 3,220 / 3,220 | 9,660 | 0.369 | 44.81 |
<!-- /PROPS_TABLE -->

The additional city-density case uses **50 buildings per 8k square**, matching M20’s documented building count, together with the 140-tree/22-rock forest baseline. This intentionally combines feature densities rather than cloning M20’s exact composition. It still excludes harbour cranes, roads, windows, runway pavement, lights and a complete airbase layout. All measured models loaded as uploaded assets; no primitive fallback appeared in these rows.

| Width | Buildings | Uploaded models / BaseParts | Descendants | Warm placement s | Studio Stats delta MB |
|---:|---:|---:|---:|---:|---:|
| 8,000 | 50 | 216 / 216 | 648 | 0.072 | -38.08 |
| 16,000 | 200 | 852 / 852 | 2,556 | 0.137 | 3.66 |
| 24,000 | 450 | 1,912 / 1,912 | 5,736 | 0.246 | 15.20 |
| 35,000 | 957 | 4,062 / 4,062 | 12,186 | 0.416 | 35.31 |

The negative 8k Stats delta reflects aggregate cache/GC churn, not negative prop memory. Descendant counts are more reliable than tiny memory deltas in this editor setup. Placement timings start after template preload and omit first asset download/texture residency costs.

Same sparse map density is not reference forest coverage. A near-continuous canopy over a 10 × 4 km island cannot be inferred from today's 60–150 scattered trees. Use terrain coloration and grouped distant canopy silhouettes, then budget individual tree clones near routes. Preserve the existing 340 planned parts / 280 props / 20 unique meshes and 600 Scenery primitive-part warnings until real-device measurements justify new per-mission budgets; do not multiply these budgets just because the square grew. Today's estimates (e.g. M5 601 instances, M19 617) are planning estimates, not measured mobile headroom.

## Recommended construction path

Keep full mission-owned route distances and flight/weapon tuning. Use a **15,000–35,000-stud navigable sea world**, but keep the approximate 9,600 × 3,840-stud M1 island fixed unless better reference measurements demand otherwise. Pre-generate static near-route terrain into an unpublished build place, save it in a versioned place artifact, and measure its server-open and client replication costs before choosing it over runtime sampled columns; saving eliminates generation loops, not terrain memory or network transfer. Today's world lifecycle clears global Terrain per sortie, so preserving/restoring baked terrain or using mission-specific places requires engine work and cannot be achieved by adding an asset to the existing build.

Use bounded shallow voxel water only where ships/coasts require it, and flat sea tiles outside; collision/water queries must reflect this representation. Maintain full-resolution terrain in near-route/core regions, with sampled distant columns or reviewed static silhouettes for distant land. Do not adopt the shrinking-core control as full-scale geometry. The coarse-column approach needs crack/coastline/river transitions, local detail patches and low-altitude appearance review before production.

Keep streaming disabled for the next prototype because the phone-profile streaming-on run missed ahead terrain. Treat StreamingEnabled as a separate experiment, with client readiness, prediction, collision and target availability gates. At 600 studs/s the default 1,024-stud target radius represents only **1.71 s** of travel; a 2,048-stud radius represents 3.41 s, neither a delivery guarantee. Start comparisons at minimum/target radii 1,024/2,048 with route-ahead requests and loading gates, then tune from measured stalls and real-phone memory. Keep authoritative flight/collision on the server and gameplay-critical targets available independently of decorative streaming. Do not change the current `default.project.json` setting in this spike.

**Feasibility conclusion:** full scale is a feasible *design candidate* with bounded detail and sparse open sea, not a demonstrated production-ready 35,000-stud world. Full-resolution runtime generation is blocked by measured load time; a 35k full-footprint coarse island passed the server timing gate locally and is the largest candidate tested, but complete full-scale approval remains blocked on client visual traversal, the streaming-ahead misses and real-device budgets. The closest design keeps full route/island scale while reducing distant detail and prebuilding static terrain; it does not compress routes or slow jets.

## Documentation payload (orchestrator applies; no docs/human edits here)

- **blockers.md:** Full-scale M1 is blocked for implementation approval with today's runtime cosine heightfield generator: 16k exceeds the proposed 30 s terrain-ready gate, and production mobile/streaming visual acceptance is unverified; the 35k Galaxy A16 streaming-on probe missed 2/163 ahead samples. This blocks the current construction technique, not the owner's full-scale direction. Static baking and full-footprint coarse geometry remain candidates, with lifecycle/streaming validation required. No Player verification performed.
- **next.md:** Prototype a fixed-size full-scale island in full route bounds using bounded water and full-footprint LOD; measure a saved static place against runtime generation, including server startup and cold-client readiness. Validate 600-stud/s streaming with actual jet/radar/targets and network delay, then test a real mid-range phone for sustained FPS/memory. Only then authorize M1 scenery and revise per-mission budgets.
- **decisions.md:** Proposed, not adopted: preserve full geometry and existing speed tuning; cap runtime detailed terrain work; prefer baked static near-route terrain plus distant LOD and sparse sea; use terrain/canopy materials for distant forest; keep individual props near routes within an explicit measured budget; gate any streaming change on lifecycle and real-device evidence. The owner/orchestrator chooses acceptance thresholds and final construction technique.

## Sources and verification

Required repository references reviewed: readiness §5, M1 world spec, world realism counts, TerrainWriter, TerrainSchedule, WorldPlan, Scenery, WorldBuilder, MissionWorld, WorldAirspace, default.project.json and tools/test-roblox.ts. Current airspace remains soft/hard half-width 3,600/3,800 studs with 4,400 radar range; this spike changes none of those values. The M1 spec's reference evidence is consumed as written; no video frames were newly inspected.

Official API references consulted 2026-10-28: [Terrain / 4-stud voxel contract](https://create.roblox.com/docs/reference/engine/classes/Terrain), [instance streaming](https://create.roblox.com/docs/workspace/streaming), [StudioTestService](https://create.roblox.com/docs/reference/engine/classes/StudioTestService), [StudioDeviceSimulatorService](https://create.roblox.com/docs/reference/engine/classes/StudioDeviceSimulatorService). Raw chronological JSON and source SHA-256 hashes are in `tools/spikes/large-world-results.json`; rerun instructions are in `tools/spikes/README.md`. The renderer/streaming observations in this report are local measurements and do not come from those documents.

Validation: `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` passed; `git diff --check` passed. Offline verification does not establish mobile or Player quality. Play ended, the device profile returned to `default`, streaming returned to false, and the owned Studio process (PID 35495) was terminated after local measurement capture. A final `pgrep -x RobloxStudio` returned no processes; no Studio instance started by this task remains.
