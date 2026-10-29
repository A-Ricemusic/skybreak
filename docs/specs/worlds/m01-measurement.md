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

## Tuning pass — 2026-10-28

Branch `feat/m01-world-tuning`; still dormant and unmerged. No mission selection,
flight, scoring, bomber or combat changes. Same machine/Studio/seed and isolated
builder as above. Final source SHA-256s and raw rows are in
`tools/spikes/m01-tuning-results.json`. No Player test or publishing command.

### Changes and profiling

- **Coast:** replace whole cells adaptively with 32-stud shore bands and 16-stud
  waterline samples (formerly 64–256); slope-aware rock/sand/forest caps; rounded
  192-stud blends outside civic terraces. Remove disconnected rectangular surf
  strokes. Steep rock bodies/caps share one fill. Interior hill sampling remains
  64/256 studs: this is a coastline improvement, not a smooth full-island mesh.
- **Sea joins:** use the same opaque, non-solid sea material everywhere, covering
  both native water and far sea. Tiles overlap four studs, stay below Studio's
  2,048-stud size clamp, and sit 0.25 studs above native water/waves. Native
  coastal and deep carrier/launch water remain underneath. This deliberately
  trades visible native wave animation/reflections for a continuous calm surface.
  An alternative full-bounds native surface was rejected: 17–19 s builds and an
  intermittent 1.25 s warm heartbeat gap, with roughly 1.2 GB extra process memory.
- **Haze:** density 0.35 → 0.19, offset 0.25 → 0.05, haze 2.8 → 1.0. Keep the
  14:05 clock, cool grading, 0.65/0.28 clouds, 6,000-ft wisps and SunRays. The
  ready island is recognizable from the exact start, still blue-grey in distance.
- **Build stalls:** same-session baseline wrappers measured synchronous plan
  construction at 154–177 ms, schedule allocation at 2.4–2.9 ms, and native calls
  below 10 ms in Edit. Planning was the dominant observed script job; this does
  not attribute every millisecond of the historical 326 ms interval. Planning now
  checkpoints at 4 ms, grounding queries only the containing terrain tile, terrain
  batches target 8 ms, native fills cap at 65,536 voxels (shared default 262,144),
  primitive parts yield every 32, and prop placement every eight. All legacy
  scheduler/writer defaults remain unchanged.

The harness now forwards both optional writer settings. Its invariant count
calculation runs once before timing, instead of allocating another whole plan
and job list between cold and warm runs. Historical rows above retain their
original method. Clearing and a two-second settle remain outside build timing;
counts/module loading also remain outside. Final cold means a fresh process,
not an empty CDN/OS cache. No compilation/offline tests overlapped final timings.
The deliberately concurrent, exploratory visual setup was not used for timing.

### Final results

| Metric | Before (original report) | After, exact final source |
|---|---:|---:|
| Cold Edit total / terrain ready | 4.17–4.45 / 4.08–4.36 s | 7.915 / 7.387 s |
| Warm Edit total / terrain ready | 4.666 / 4.569 s | 8.117 / 7.581 s |
| Cold / warm worst heartbeat | 183–186 / 325.7 ms | 38.0 / 70.9 ms |
| Cold / warm longest native job | 6.39–7.50 / 11.82 ms | 5.88 / 1.45 ms |
| Cold / warm longest planning slice | Not recorded | 4.93 / 6.12 ms |
| Scene descendants | 802 | 791 |
| Primitive parts incl. clouds / props | 312 / 163 | 307 / 161 |
| Jobs / filled voxel writes | 8,517 / 207,692,032 | 27,494 / 207,739,968 |
| Stats after cold / warm | 3090–3137 / 3289 MB | 3131 / 3267 MB |
| Missing template placements | 0 | 0 |

D-028's preferred 20 s and maximum 30 s terrain readiness budget passes these
samples, with every existing instance/prop/job/voxel budget retained. **The whole
heartbeat target of about 50 ms is not a clean pass:** warm Edit still reached
70.9 ms during the planning phase, even though no measured planning CPU slice
exceeded 6.12 ms. Engine/scheduler work between resumptions is included in that
interval. It must not be relabelled as a 6 ms whole-build stall or a guaranteed
production bound. Further engine/GC profiling and production workload testing
remain open.

| Final Galaxy A16 one-client Play measurement | Result |
|---|---:|
| Server total / terrain ready | 7.359 / 6.732 s |
| Worst server heartbeat / phase | 102.4 ms / dressing |
| Longest native terrain call | 67.72 ms |
| Longest planning CPU slice | 5.87 ms |
| Scene descendants / missing placements | 791 / 0 |
| City FPS / worst render interval / peak Stats | 60.01 / 20.43 ms / 4302 MB |
| Airbase FPS / worst render interval / peak Stats | 59.99 / 21.65 ms / 4350 MB |
| Ready attribute / island ray after LocalScript start | 11.491 / 11.492 s |

The emulator keeps the original ten-second stations after three-second settling,
with the avatar hidden, at 1336 × 616. Original clear-view city/airbase samples
were both 60.00 FPS, worst 18.7/22.3 ms. **These are desktop Studio emulator
numbers, not a real phone test.** Production MobileGraphics, jet/controller,
radar/combat, network delay, thermals and sustained device memory remain untested.
No route-speed matrix was repeated in this tuning pass. The route screenshot
below is a static pose inside the reserved route band, not a timed bomber test.

Including Play, the largest final heartbeat interval is **102.4 ms**, compared
with the historical 325.7 ms; native Play calls can still exceed 50 ms despite
smaller voxel batches. Thus the 50 ms request remains **partially unresolved**:
script planning is bounded and the historical large synchronous job is split,
but engine/renderer/GC intervals are not bounded by those script budgets. Do not
approve the whole-build stall goal solely from these results.

### Final screenshots and remaining visual work

Actual Studio MCP captures after client station sampling and full readiness,
kept only in ignored `build/` (no images committed):

- `m01-final-start.jpg`: exact `(0,622,10000)`, looking toward the ridge. The
  island is recognizable above the sea through blue-grey haze; it is distant
  and small, not a high-contrast foreground silhouette. No rectangular sea patch
  appears in this view.
- `m01-final-route-cruise.jpg`: `(512,700,4200)` toward the city, inside the
  reserved flight-height band. Ridge, city and continuous coast are visible;
  interior hillside steps and sparse tree/bright prop specks remain conspicuous.
- `m01-final-coast-low.jpg`: `(2000,160,2500)` toward `(700,60,2500)`. The
  shoreline reads as a finer curve, with rock faces and pale gentle shore strips;
  disconnected rectangular surf is gone. Upper slopes remain terraced.
- `m01-final-city-low.jpg`: `(2180,160,700)` toward the city. Buildings appear
  seated, quays present, no obvious sea-material join. The city grid and waterfront
  still look engineered/rectangular. This is not an underside/foundation audit.

The final sea is uniformly flat and lacks native reflective/animated water detail;
this is the documented performance/continuity tradeoff, not full visual acceptance.
Interior hill terracing, sparse vegetation and sky/cloud fidelity still need art
review. The existing authored 2,880-stud runway exceeds the native Part size cap
(2,048); it needs a separate split-runway fix before world selection. This tuning
keeps the existing runway authoring unchanged. No reference video/frame comparison or continuous flight review was done.
Studio emitted an automatic TexturePack HTTP 429 warning in the final Edit warm
session; no upload/publish command was issued. Texture residency/fidelity is not
proved by zero missing template placements. Installed plugin asset warnings also
remain outside this composition's source.

### Verification, cleanup and human docs payload

Frozen-lockfile install and `bun run build` pass. Final offline validation and
`git diff --check` are recorded with this PR, including unchanged current-world
counts. Final validation passed 585 offline contracts, 27 mission snapshots and
90 Python tests; the current-world report is up to date. `git diff --check`
passed. No `bun run test:roblox` session ran. Play was stopped, device restored to
`default`, and every Studio GUI launched by this tuning task was closed (some
required SIGKILL after ignoring SIGTERM). No Player verification or merge.

Orchestrator payload; **no `docs/human/` file was edited**:

- **README.md:** dormant full-scale M01 tuning is in an unmerged PR; measured
  cold/warm 7.915/8.117 s, 791 descendants, zero missing placements. No current
  mission selects it; mission progress is unchanged.
- **shipped.md:** no shipped entry until merged. This task has no Player observation.
- **next.md:** review flat-sea tradeoff, existing runway size clamp and remaining hill/city appearance; profile
  the remaining engine/GC/renderer gaps, then production flight/combat/network and
  sustained real-phone acceptance before selection.
- **blockers.md:** sampled start visibility, rectangular sea joins and surf strips
  improved. Whole heartbeat acceptance remains open (70.9 ms warm Edit, 102.4 ms
  phone-profile Play), along with real-phone and campaign integration acceptance.
- **decisions.md:** further evidence for D-028: full scale/corridor retained and
  final terrain ready in 6.73–7.58 s in these samples. No new decision ID or change
  to world extent/flight policy; opaque uniform sea is an explicit tradeoff for
  review, not accepted production quality by assertion.
