# Outer mission districts

This is a reviewable representative expansion, not a claim that every mission is now a fully
hand-authored large world or that Blender inspection renders prove in-game realism. Current
main at the start of this branch was `d31ed1d` (includes world PR #47). The dirty project root
was not modified. No Studio session was opened, changed, or stopped.

## Coverage and geography

| Measure | Before | After |
|---|---:|---:|
| Horizontal hard limit, each axis | ±2800 studs | ±3800 studs |
| Hard-boundary square | 5600 × 5600 | 7600 × 7600 |
| Flyable square area | 31.36M stud² | 57.76M stud² (+84.2%) |
| Soft recovery starts, each axis | ±2400 | ±3600 |
| Detailed Terrain square | 8000 × 8000 | 8000 × 8000 |
| Ground/sea horizon tile square | 12000 × 12000 | 12000 × 12000 |
| World infrastructure mesh designs | 0 | 3 |

`WorldAirspace.ts` owns horizontal boundaries, spawn limit and tactical radar range. All missions
use the horizontal limits; the three new districts are M3, M5 and M19 only. The other missions
retain their existing populated cores and terrain ridges/islands. The former horizon ridges are
now reachable collision hazards, not invisible level walls. Missions 1–2 retain their existing
island and harbor compositions. No objective, route point, protected boat path, convoy, time
limit or player start was multiplied, displaced or lengthened.

Each new district occupies x=2700..3700, z=-1400..1400: a 1000 × 2800-stud east belt that used
to be behind the hard boundary. Two explicit earthworks operations open a pass through the
old east ridge and restore a supported floor at y=44. Only M5 adds three field-material swaths.
The original mission terrain and targets stay intact outside that rectangle.

- M3: 1400 × 100-stud runway pavement (120 including drainage shoulders), three approved
  aircraft shelters, a radar dish, west access road, service spine, turnoffs, twelve cliff buttresses
  and sixteen approved rock outcrops. Both runway approaches remain clear to z=±850.
- M5: three farmhouse/barn/silo compounds with field swaths, 27 orchard trees, sixteen boundary
  pines and the same road/escarpment system. Inner scatter is reduced by 43 trees, keeping the
  original 140-tree budget while redistributing density into a second agricultural district.
- M19: an inland logistics extension with six container stacks, three scaled office models and
  sixteen pines, road/spur access and the escarpment. It does not invent a second waterfront or
  move the audited harbor/escort canal.

The access road reaches x=2700, near the old playable edge. It is a supported district access,
not a claim of a continuous road connection to every existing mission street. The district is
optional geography, with no new mission objective or HUD waypoint. Existing objective bearings
continue to guide the player back to the authored core. Wide radar range is 4400 (was 3200),
close range stays 1600, and farther objectives continue to pin to its rim.

## Original Blender kit and runtime path

`tools/build-world-kit.py` reuses the repo's mission mesh exporter, validator and static-content
runtime. All geometry is original procedural authorship; no downloads, third-party textures,
marketplace inserts or new asset IDs. The existing uploaded props retain their approved IDs.
The three new geometry JSON files are packaged as server-only StringValues in both Rojo maps.
No upload, moderation submission, publishing or credential use is needed for this implementation.
The existing runtime static mesh API still requires account/place support; its visible fallback
is explicitly reported and must be checked in Studio.

| Kit | Authored bounds X/Y/Z (studs) | Triangles | Vertices | Material meshes |
|---|---|---:|---:|---:|
| RunwayTile | 120 / 1.45 / 100 | 76 | 50 | 2 |
| RoadTile | 38 / 0.98 / 100 | 68 | 50 | 3 |
| CliffTile | 200 / 100 / 66.958328 | 150 | 77 | 1 |

Runways have camber, drainage shoulders, edge lines and center dashes; thresholds are thin
separate paint geometry. Roads have a crowned cross-section, gravel shoulders and paint.
Cliffs have irregular erosion profiles and ledges, with closed back/end caps. These are modest
geometry LOD assets with flat materials, not scanned terrain or photoreal surfaces. They repeat
at authored size; no giant stretched mesh. Existing uploaded buildings/trees keep their original
PBR assets. Road/runway pavement uses Asphalt, road paint does not emit neon light.

The exporter checks bounds, triangle limits, finite dimensions, centered bounds and nondegenerate
triangles. Exact statistics are in `assets/mission/world-kit.stats.json`. Rebuild with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-world-kit.py
```

The generator also writes regenerable .blend/.glb files (ignored) and committed daylight PNG
inspection renders. These show the isolated Blender assets, not a Studio sortie:

![Runway module](../assets/mission/runwaytile-preview.png)
![Road module](../assets/mission/roadtile-preview.png)
![Cliff module](../assets/mission/clifftile-preview.png)

## Plan and performance budgets

| Mission | Parts before → after* | Props before → after | Unique designs before → after | Terrain ops before → after | Voxel writes before → after |
|---|---:|---:|---:|---:|---:|
| M3 | 75 → 144 | 86 → 106 | 9 → 13 | 318 → 320 | 61.6M → 88.2M |
| M5 | 24 → 71 | 174 → 183 | 8 → 10 | 232 → 237 | 69.6M → 96.2M |
| M19 | 70 → 117 | 143 → 168 | 12 → 14 | 124 → 126 | 37.3M → 63.9M |

*Plan part entries include a kit placement as one entry, not one engine BasePart. M3 places
14 runway, 35 road and 12 cliff modules (61 models, 5244 additional rendered triangles).
M5/M19 each place 35 road and 12 cliff modules (47 models, 4180 triangles). A module also has
an invisible nonqueryable bounds root; each material is a MeshPart. Template generation occurs
once per kind per server; later placements clone the cache. RenderFidelity remains Automatic.
`WorldKitModels` and `WorldKitFallbacks` distinguish these from uploaded-prop statistics.

The generated table in `world-realism.md` includes conservative kit instance overhead. It is
an estimate, not an engine profiler capture. All 25 planned missions retain their existing
340 plan-parts / 280 props / 20 unique-design / 100M voxel-write / 2.5M hill-cell budgets.
M5 is at 96.24M voxel writes: further earthworks need to reclaim budget first. Terrain operations
still go through bounded TerrainWriter jobs, and no per-frame scenery loop was added. No
streaming was enabled. The extra models replicate under the existing loading gate; device memory,
frame time, mesh API latency and replication duration have not been measured for this branch.

The 100M cap is a cumulative analytic write-work estimate, including repeated writes
and Air clears; it is neither 100M resident voxels nor a peak-memory measurement.
The district clear alone counts 26.25M writes (1000 × 600 × 2800 / 64), followed
by 0.35M for its floor and 0.027M for M5's three material swaths. M5 has about
3.76M writes (3.76%) of margin. Clearing the old ridge before restoring its floor
is intentional: removing either overlapping operation changes the pass/support.
This review leaves those operations intact; narrowing the clear safely needs an
engine terrain/visual comparison, unavailable while the flight tester owns Studio.
Fill jobs are capped at 262,144 estimated cells, bump read/write slices at 32,768;
un-split balls/wedges have a separate 4,194,304 cap. The 12ms scheduler budget yields
between jobs and cannot bound an individual engine call. These limits constrain
work chunks, not mesh memory, retained terrain, replication cost or frame time.

The 2.8M-stud² district belt is roughly 10.6% of the 26.4M-stud² newly accessible
area (and its x=2700..2800 strip was already accessible). Most added airspace is
existing terrain/horizon relief, not new populated districts. This is a useful
representative expansion, with repeated low-poly infrastructure and sparse props;
it is not evidence of dense coverage across the enlarged square. Other mission
compositions have deliberately not been expanded.

## Flight-agent coordination and travel time

Only the `FlightMath` import and two horizontal-boundary initializer lines change. Acceleration,
cruise, top speed, attitude and controller logic are untouched. The flight agent should retain
that import and use `WorldAirspace.soft/hard` if its patch edits the same initializer block.
`Flight.spec` changes one old coordinate literal to `SoftBoundary + 100`; resolve any concurrent
flight-test edits by preserving the parameterized boundary case. Spawn and radar edits are
world-owned integration changes in CombatService/RadarMath, separate from speed tuning.

PR54 head `69614a12780e4579792f9fd1fa83b91301c4ff4c` defines an explicit arcade
mapping: `FlightMath.StudsPerMph = 0.2`, or **5 displayed mph per stud/s**.
This is a gameplay/display conversion, not a literal physical stud length. Use
`seconds = distanceStuds / speedStudsPerSecond`; 800 mph is 160 studs/s and
3000 mph is 600 studs/s. The earlier 1 stud = 1 meter reference table was incorrect
for this integration and must not be used for mission pacing.

| Straight leg | Distance (studs) | At 800 displayed mph (160 studs/s) | At 3000 displayed mph (600 studs/s) |
|---|---:|---:|---:|
| Old full hard-boundary width | 5600 | 35.00 s | 9.33 s |
| New full hard-boundary width | 7600 | 47.50 s | 12.67 s |
| Spawn (0,500) to district center (3200,0), XZ | 3238.83 | 20.24 s | 5.40 s |
| New M3 runway | 1400 | 8.75 s | 2.33 s |

These are constant-speed straight-line times, excluding acceleration and turns.
The terrain extends 200 studs beyond each hard edge; that is geometric coverage,
not a guaranteed collision-free recovery buffer. Spawn centers at ±3500 plus
80-stud lateral probes stay inside ±3580; the 200-stud approach probe stays inside
±3700, within both the hard limit and terrain square. The six discrete vertical
samples do not cover the gaps between them or prove future route clearance.

This footprint is still small for sustained 3000 mph travel. A much larger world needs separated
mission regions and a streaming/replication strategy, not simply bigger ground slabs. Landing,
runway usability at fighter speed, navigation overshoot and mission pacing require actual flight
acceptance with the new speed branch. These districts provide scenery coverage and maneuvering
room, not minutes of cruise travel or a finished landing simulation.

## Validation and acceptance

- `bun run test:offline`: 487 compiled-domain contracts passed in official Luau. This includes
  all 25 plan audits (air corridors/ceilings, targets, support, convoys, full escort hull paths,
  budgets), radar/navigation tests, parameterized flight boundaries, new road-junction checks,
  exact kit bounds, airspace containment and a 25-stud sweep of the runway/approaches.
- `bun run build:place`: roblox-ts and Rojo place build pass. This is not an engine test.
- `bun tools/world-report.ts` and `--check`: regenerate/validate the documented counts.
- Blender generator: all three meshes export, validate, save and render successfully.
- No Roblox Jest run, Studio screenshots, device benchmarks or in-game realism verdict.

Enemy spawns now clamp at ±3500 rather than ±2500 so waves can populate the added belt. Before
exposing an enemy, six rays using the scenery/terrain allowlist probe its center, four 80-stud
hull margins and a 200-stud approach point; altitude is raised to at least 120 studs over the
highest hit. Arrival angles/ranges, wave counts and player spawn stay unchanged. Rays cost only
at spawn. This checks local clearance, not an entire enemy flight path or minimum post-clamp
separation from a player flying at the rim; those remain engine acceptance items.

When the parent can use Studio without displacing the targeting acceptance session:

1. Open the built place separately and fly M3/M5/M19 through the east belt, then M1, M2 and
   representative ocean/plateau missions to check newly reachable ridges and boundaries.
2. Read WorldKitModels/Fallbacks, WorldFallbacks, build seconds, longest terrain job and replica
   readiness. Require zero kit fallbacks for asset acceptance, and verify the meshes replicate
   to the client with static mesh permissions actually enabled.
3. Check street junctions, runway tile seams/paint, shoulder grounding, cliff end seams, prop
   contact, flight-sweep collisions and fallback geometry. PreciseConvexDecomposition on a
   concave ledge may fill recesses; at top speed a long spherecast can meet several tiles.
4. Trigger required/reinforcement waves while in the belt, near a cliff and at the soft rim.
   Confirm no spawn embed, instant lock, terrain collision or navigation dead end.
5. Measure low-end mobile memory, GPU/frame time, preload/content API time and network loading;
   existing Automatic mesh fidelity is not a distance-culling or streaming system. Streaming
   remains off, and would need separate acceptance for targets, collision queries and readiness.
6. Integrate the exact flight head in the parent's review workspace, retain its arcade mapping,
   then repeat low passes, boundaries and objectives at 800/3000 mph. Do not claim combined
   acceptance from the standalone world tests.

Remaining authored work: selective district rollout to the other 22 planned missions, purpose-built coast/ocean
expansions, organic district edges and more varied cliff assets, long-distance mission/navigation
redesign, runway/taxiway kit conversion of the original airfields, richer surface textures and
an actual measured mobile LOD/streaming policy. Existing core roads/runways remain as before.
