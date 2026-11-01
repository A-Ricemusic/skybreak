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
