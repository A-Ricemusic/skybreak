# Campaign loading estimate gate — proposed 2026-10-31

Pure-plan estimates, not Studio, replication or phone measurements. M03–M05 before values are PR #205 head 2da7e335; M01 before is main cb8e1d10. Other mission schedules are unchanged.

| Mission | Before estimate (s) | Proposed estimate (s) |
|---|---:|---:|
| M01 | 19.963 | 13.466 |
| M02 | 10.467 | 10.467 |
| M03 | 18.134 | 15.968 |
| M04 | 16.160 | 15.890 |
| M05 | 37.441 | 7.260 |
| M06 | 10.265 | 10.265 |
| M07 | 14.501 | 14.501 |
| M08 | 4.235 | 4.235 |
| M09 | 10.474 | 10.474 |
| M10 | 14.739 | 14.739 |
| M11 | 14.455 | 14.455 |
| M12 | 12.771 | 12.771 |
| M13 | 13.253 | 13.253 |
| M14 | 7.022 | 7.022 |
| M15 | 11.352 | 11.352 |
| M16 | 12.300 | 12.300 |
| M17 | 7.283 | 7.283 |
| M18 | 3.702 | 3.702 |

PR [#205](https://github.com/A-Ricemusic/skybreak/pull/205), 2026-10-31, unmerged: M05 open ocean now uses 181 flight-solid Sea Parts at Y=32 instead of native terrain water. Matching colour [17,25,32], opacity and reflectance 0.35; flat Parts cannot reproduce native waves. Exact shore-cell unions stay within 2,048 studs, with exhaustive coverage/curtain tests. Aircraft collision, low-altitude probes and actor grounding recognize Sea; gun rays exclude Sea just as they ignore terrain water. Tanker/rig/refinery poses stay unchanged. M03 uses 256-stud route / 1,024-stud distant sampling with 64-stud target refinement and one-voxel lower-cap curtain overlap. M04 removes submerged mud caps with native water-only columns. Estimates: **M03 15.968 s, M04 15.890 s, M05 7.260 s** (previously 18.134 / 16.160 / 37.441). Estimator, fill cap, 0.25 s slices and all 18 strict 16 s gates remain unchanged. M05 Part allowance increases 400→500 for the explicit water geometry (444 total planned including target allowance); descendant cap remains 1,100 (820 planned). Studio total-time / heartbeat assertions remain 16 s / 0.3 s. Frozen install, build and prescribed-LUAU_BIN validate:offline exited 0 (1,243 Luau contracts, all 18 load gates, 488 compiled modules and 124 Python tests); Studio/test:roblox/Player were not run, no upload or merge. Orchestrator owns runtime/visual acceptance.

The calibrated model retains 0.07 ms per solid chunk touch, 0.2 ms per water touch, 0.2 s plus water-share frame penalty per yield and 3 s fixed overhead. Calibration is fixed at 0.25 s independently of runtime settings. Runtime slices remain 0.25 s and calls remain capped at 262,144 voxels. No cleanup, cold asset or replication claim is included. M01 retains the existing exact equal-column merge.

M03 scheduled jobs fall 29,566→10,466; changed mountain sampling is intentional, not an identical-geometry claim. M04 retains all sampled heights/materials above the river surface, replacing submerged caps with water. M05 retains all land caps/curtains and original shoreline cells; opaque Sea tops seal each sea column at Y=32 and cover the full 32,768-stud world through hard airspace. No native sea water is required by its authored ships/rigs. Original industrial geometry and lights stay in place.

All 18 MissionLoadBudget cases and the Studio total build-time / max Heartbeat-gap assertions remain. AircraftCollision already classifies Sea as crash_water; ActorPlacement recognizes it as water. Client low-altitude raycasts include FlightSolid Sea. Gun rays now remove Sea from the explicit include list to match IgnoreWater. Existing crash/actor tests remain, plus a gun-water regression and exhaustive sea cell, edge and Part-dimension checks. Splash kill text/effects do not depend on native water; flat Parts do not animate waves, so the night ocean appearance needs a Studio look.

Validation: frozen install, build and full prescribed-LUAU_BIN offline gate exited 0. Result: OFFLINE_LUAU_RESULT passed=1243 failed=0; 19 catalog snapshots, module/require guards, generated world counts and 124 Python tests passed. No Studio or test:roblox run. The added engine gun/Sea regression was compiled, not executed.

## Reconciliation with main 3ed084dd (2026-11-01)

Preserve #236: no buried M3 floor, no M3 military preload/decoration, and construction errors logged before cleanup. The current M3 coarsened shell has 139,976,064 voxel writes, 10,087 jobs, 97,432 chunk touches and a 15.42024 s calibrated estimate. Main's finer shell after floor removal has 146,815,136 writes (206,784,672 − 59,969,536); its exact count is not the coarsened-plan baseline. The frozen M3 plan fingerprint 3511608759 already omitted the floor at revision 37028404 and stays unchanged. The independent clearance height field stays frozen because removing the buried floor does not change playable surface heights.

Runtime TerrainWriter caps all missions, including M3's explicit 0.25 s request, at **0.15 s**. The old 0.25 s estimator calibration stays fixed. A pure scheduler regression checks that all 10,087 nonnegative-Y jobs and 139,976,064 cells execute across 0.15 s slices; this is not Studio or phone timing acceptance. Cooperative disposal and engine timing remain pending the orchestrator's Studio lease.

## Failed-head follow-up (2026-11-01, main fe1af743)

The supplied `483ed930` Studio log records **ten**, not just two, Long Running Command dialogs. Most occur while pure plan/audit suites run, before an engine build; those suites used non-yielding full-plan Jest `toEqual` traversal or large column/assertion loops. `TestPacing` now yields after 250 ms of work in Studio, including complete acyclic field comparisons; standalone Luau runs the same comparisons without engine calls. These log timestamps establish the surrounding suite, not native/GC stack attribution; rerun the instrumented performance harness to verify remaining engine pauses.

M07's real build reached its assertions in about 31.7 s; both failures were the **20 s teardown hook**, not a planning hook (plan CPU ~0.057 s). M15's plan CPU was ~0.022 s, but its body reached 120 s while prior timed-out cleanup could still be active. Fixes restore the pre-#205 shared 262,144-cell fill limit instead of 65,536; retain the 0.15 s runtime slice; union only adjacent tracked cleanup chunks into calls of at most 128×128×2048 studs (524,288 cells); and replace unconditional composition dressing frame waits with a 15 ms work budget. Instance disposal keeps a 15 ms budget and increases its traversal safety ceiling from 64 to 512 visits per yield. This reduces scheduling overhead without enlarging build native calls beyond the pre-PR limit.

M07/M15/M17/M18 real builds and campaign integration run in cancellable workers capped at 90 s; teardown workers cap at 30 s with explicit 35 s hooks. Their 120 s single-build test bodies remain. Cancellation precedes reporting failure, and afterEach cancels surviving workers before cleanup. The separate 18-world perf harness has the same per-build/cleanup bounds. Main's #239 small budget fixtures and lifecycle bounds are preserved; #210's retired RelayWorld implementation/spec remain deleted. Hook headroom explicitly covers cooperative teardown; it is not a new build-time acceptance target. The existing isolated harness still requires ≤16 s builds, ≤0.3 s heartbeat gaps and ≤0.1 s planner slices. No Studio/Player run was performed in this follow-up, so actual wall-clock improvement remains for the orchestrator to measure.

The hottest M03 shell and M18 vent loops retain exhaustive per-cell/per-part checks using direct failure checks instead of a Jest matcher per sample. The two M16 fairness simulations already took 36/39 s in the failed-head log without yielding (so Jest's 20 s timer could not fire); those two cases now explicitly allow 120 s while yielding every 250 ms. This is CPU simulation headroom, not a world-build timeout increase.
