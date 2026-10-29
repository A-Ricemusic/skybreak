# Mission 1 Studio measurement

2026-10-28, source **127d13e77af6d0622224d94de9369e42e199b65f** (PR #111).
Measurement only: no game source or human dashboard edits, upload, publishing, merge or Player test.

## Machine and method

MacBook Air `MacBookAir10,1`, Apple M1, 8 GB unified memory, macOS 26.5.2
(25F84). Studio **0.745.0.7451137**. Bun 1.3.14, roblox-ts 3.0.0, Rojo.
The isolated Rojo projects and paired scripts in `tools/spikes/m01-*` package the
actual compiled `M01World.Build`, `TerrainWriter`, scheduler, scenery, environment
and approved template loader unchanged. Seed 101. No stand-in island.

Fresh Studio processes supplied two cold samples. Warm is a second call in the
first process after Terrain clearing and a 2 s wait. Cold means fresh process,
not empty disk/CDN/OS asset cache. Module loading, clearing, the 2 s settling
interval, Studio startup and character startup are outside builder timing.
Plan generation, environment, asset-load kickoff, terrain schedule construction,
terrain waits, parts and cached prop placement are inside total timing. Template
loading overlaps terrain; every completed sample must report missing props.

`terrain` below is the original writer wall time; `terrain ready` includes the
plan/environment phase before it. `parts/props` is the remaining builder phase
(including effects and yields), not isolated mesh download/renderer timing.
Heartbeat intervals are a scheduling-stall proxy, not captured renderer frames.
Memory is Stats total MB: Studio/plugin/cache overhead is included and Play
server/client contexts share aggregate process accounting. Peak is sampled at
heartbeats and can miss transients. Counts are scene descendants excluding its
outer folder, not total game instances. Voxel writes are scheduled filled-cell
volume, including water/rock/cap overlap, not unique occupied voxels.

## Server measurements

| Run | Total s | Terrain s | Terrain ready s | Parts/props s | Worst heartbeat ms | Longest job ms | Scene descendants | Stats before / after / sampled peak MB | Missing props |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Cold 1, Edit | 4.448 | 4.192 | 4.361 | 0.088 | 186.1 | 7.50 | 802 | 2601 / 3090 / 3091 | 0 |
| Warm 1, Edit | 4.666 | 4.269 | 4.569 | 0.097 | 325.7 | 11.82 | 802 | 3224 / 3289 / 3289 | 0 |
| Cold 2, Edit | 4.167 | 3.911 | 4.075 | 0.092 | 183.4 | 6.39 | 802 | 2619 / 3137 / 3137 | 0 |
| Desktop one-client Play | 5.533 | 5.281 | 5.436 | 0.097 | 171.7 | 89.72 | 802 | 3900 / 4331 / 4331 | 0 |
| Galaxy A16 one-client Play | 5.470 | 5.200 | 5.372 | 0.098 | 187.9 | 59.45 | 802 | 4156 / 4455 / 4455 | 0 |

Every sample scheduled **8,517 jobs / 207,692,032 voxel writes**, with 163
planned props and 312 primitive parts (including cloud wisps). Edit Workspace
contained 806 descendants; Play Workspace contained 1,109 in the desktop sample.
Raw JSON and source hashes are retained beside the harness. Installed plugins
(including a weather plugin) and MCP requests were present; viewport captures
can perturb frame samples. No offline validation/build overlapped these timings.

The 10.325 s offline estimate was terrain only. Observed Edit terrain is
3.91–4.27 s (59–62% below estimate); desktop Play terrain is 5.28 s (49% below).
The estimate doubled a jobs-based extrapolation and a fixed 3 s water allowance;
actual native FillBlock throughput and overlapped asset loading do not scale
linearly with that allowance. Warm was slightly slower, so this series does not
establish a warm-cache speedup or a production upper bound. All observed totals
fit the preferred 20 s and maximum 30 s readiness budget. The 33 ms stall target
fails: short individual jobs do not bound planning, engine/meshing or scheduling
intervals. Profiling is needed to attribute those intervals before choosing a fix.

## Client measurements and visual review

Streaming stayed disabled. One Studio client, camera/anchored avatar at y=700,
full reserved centreline `(0,10000) → (512,4200) → (1280,256) →
(-1280,-3200) → (-1280,-8000)`, about 18,942 studs. Traversals run at 160 and
600 studs/s, followed by 10 s stationary frame samples near city and airbase.
The actual production jet/controller, radar, targets, combat, artificial network
delay, and final timed E1/E2 bomber route are excluded. This tests the composition
reservation; it cannot approve the unresolved timed bomber route.

A separate 32-stud centreline probe found **0/597 samples outside the detailed
reservation**. Open sea portions correctly have no solid island; foreground rays
only count misses where the analytic terrain function expects land above water.
Route reservation does not imply all open sea has voxel terrain.

Visual observations use actual Studio viewport captures, retained only in ignored
`build/`. OS `screencapture` initially returned wallpaper; those two PNGs are not
world evidence. Studio MCP captures provide the world images. No reference video
comparison was performed.

- `m01-route-start.jpg`: distant approach is overwhelmingly blue haze; an island
  silhouette is not reliably distinguishable. Availability timing must not be
  relabelled as time-to-visible. The exact first rendered-visible instant remains
  unmeasured; the present haze needs review at the actual start camera.
- `m01-coast.jpg`: pale rectangular surf strokes and stepped shoreline appear
  through haze. Surf looks blocky rather than continuous foam.
- `m01-city-approach.jpg`: city buildings and quay sit on a conspicuously square
  civic terrace; stepped hillsides are clearly visible. No obvious floating or
  buried building was identified from this altitude; this is not an underside audit.
- `m01-airbase-pass.jpg`: runway/apron, eight hangars and tower are present;
  ground silhouette is stepped. The test avatar briefly clips into the camera,
  a harness artifact; it was locally hidden later in the desktop traversal.
- `m01-fast-spine.jpg`: terrain is present in the foreground during max-speed
  traversal. No late-generation hole is apparent in the sampled stills. Discrete
  stills and sparse rays cannot exclude every transient pop or distant mesh LOD swap.

| Desktop measurement | Result |
|---|---|
| Ready attribute after LocalScript start | 7.647 s |
| Island terrain ray after LocalScript start | 7.648 s |
| Rendered island visible from fixed start | Not established; haze obscures it even after traversal |
| 160 studs/s | 55.68 FPS; worst render interval 699 ms; 0/659 expected-land misses; peak 4710 MB |
| 600 studs/s | 57.63 FPS; worst render interval 470 ms; 0/182 expected-land misses; peak 4853 MB |
| City stationary | 59.91 FPS; worst 50.9 ms; peak 4783 MB |
| Airbase stationary | 59.70 FPS; worst 57.6 ms; peak 4658 MB |

Client time begins at LocalScript entry and excludes initial Studio startup;
this is not cold Player join-to-image latency. Route samples are every ten
rendered frames. No ahead-of-route ray is implemented here: these counts concern
terrain at the moving position. Streaming is off; stills show foreground terrain,
but a continuous visual recording was not reviewed. The test avatar occluded
some early desktop/phone views. Desktop avatar was hidden during the 600-stud/s
pass; phone station numbers are repeated with it hidden below.

## Phone emulator

Samsung Galaxy A16 Studio preset (`samsung_galaxy_a16`), confirmed by the
simulator API; captures are 1336 × 616. This changes desktop viewport/input,
not the M1 GPU into a phone. No real phone, mobile thermals, memory capacity,
network, or sustained production workload was tested. Production MobileGraphics
is not active in this isolated place. Each stationary sample is only 10 s,
following a 3 s settle. The phone run skips the desktop route matrix.

| Sample | City FPS / worst ms / peak Stats MB | Airbase FPS / worst ms / peak Stats MB |
|---|---|---|
| Initial, avatar occludes view | 60.00 / 20.5 / 4551 | 60.00 / 20.3 / 4577 |
| Clear-view repeat, avatar hidden | 60.00 / 18.7 / 4587 | 60.00 / 22.3 / 4584 |

Phone-profile client readiness attribute was observed at 7.457 s from
LocalScript entry; the island ray hit at 7.458 s. These remain availability
probes, not rendered visibility times or a fresh-process phone cold join.
`build/m01-phone-airbase-clear.jpg` confirms the clear viewport and touch overlay.

## Verdict and follow-up

**PASS WITH TUNING for the local server build budget.** The exact builder finishes
with zero missing props comfortably inside 20–30 s, but the 33 ms scheduling goal,
rendered start visibility, production flight/combat workload and real-phone
acceptance are not passed by this experiment.

Retain full scale and the 1,536-stud corridor initially. Profile plan generation,
schedule allocation and terrain meshing; yield during planning/allocation and try
smaller terrain batches if engine work dominates, then remeasure whole-build
heartbeat gaps. Reducing sampling density or narrowing the corridor is not
justified by these load times; closer/coastline sampling or a prebuilt smoothed
surface may instead be needed for stepped silhouettes. Tune haze, surf continuity
and voxel-water/visual-sea joins before visual approval. Keep the mission clock
behind the builder's completion and a zero-missing-prop readiness check. This
isolated test has no mission clock and does not verify campaign handoff wiring.

## Human documentation payload (orchestrator applies)

- **blockers.md:** M01 exact composition no longer lacks a local server-time
  measurement: cold 4.17–4.45 s, warm 4.67 s, desktop Play 5.53 s, zero missing
  props. Keep visual/mobile/campaign acceptance open: 171–326 ms heartbeat gaps and visible rectangular sea joins,
  dense start haze, stepped coast and unverified real-phone performance. No Player
  verification; these are unpublished Studio observations.
- **next.md:** Profile initialization and terrain meshing stalls; tune start haze,
  surf and water joins; verify foreground at low altitude with the production jet,
  radar, targets and network delay. Verify the clock starts after readiness, then
  run sustained real-phone city/airbase FPS, memory and thermal tests.
- **decisions.md:** Evidence for D-028, not a new scale decision: actual sampled
  composition fits the local 20–30 s server budget without narrowing the route
  corridor. Keep streaming off and full scale; owner/orchestrator acceptance of
  visuals and real-phone budgets remains pending. Emulator results are desktop
  renderer evidence only.

Additional close inspection after timing: `m01-city-low.jpg` shows buildings
apparently seated on the terrace, with a very abrupt square shoreline wall;
`m01-water-join.jpg` shows an obvious straight colour/specular boundary where
voxel water meets the sea Parts. `m01-start-fully-ready.jpg`, at the exact start
position (0,622,10000) after the entire traversal, still does not show a reliably
distinguishable island silhouette and exposes the rectangular water patch.
This is a persistent visibility/material problem, not evidence of late terrain.
No obvious open terrain crack was seen in the sampled views, but not every LOD
boundary, buried foundation or underside was examined.

## Verification and cleanup

`git diff --check` and
`LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`
passed for this report. No `test:roblox` ran.
Studio PIDs 55792 and 55900 were started by this task; the first exited after
the cold/warm script, and the second required SIGKILL after ignoring SIGTERM, after stopping Play and
restoring device `default` and streaming off. Final `pgrep -x RobloxStudio` returned no processes. Offline checks do not establish renderer, Player or phone quality.
