# Mission 4 integration verification

2026-10-29; unmerged `feat/m04-mission`, based on main `088fbfc`. No Roblox Player or human combat playtest is claimed.

## Checks

| Check | Result |
|---|---|
| Frozen Bun install | Passed |
| Build | Passed |
| Full offline gate | Passed;738 domain tests,0 failures |
| Catalog snapshot | Passed; only mission4 differs from main |
| Full Roblox Jest |865 passed,0 failed,87 suites; final restoration/practice cleanup included |
| Final M04 focused Roblox Jest |7 passed,0 failed after the final livery-only roster adjustment |
| Scripted campaign integration |Passed; forged launch refused, live jammer locks and client radar states observed,15 kills/1540/S saved, subsequent practice launch and immediate return to menu completed |

Full Jest: [summary](jest-results.json). Final focused M04 suite: [summary](focused-jest-results.json). Runtime: [server evidence](runtime-results.json), [client telemetry](client-jamming.json). Final console inspection found neither the earlier WeatherRules lookup failure nor a script timeout. Studio/platform/plugin asset warnings were present; this is not a claim of a wholly silent console.

EnginePracticeSnapshot, EngineM01Snapshot and mission1–3 data remain unchanged. Mission3 remains unavailable on main pending #147; no production progression bypass is added.

## Runtime method and limits

`bun tools/verification/build-m04-place.ts` after compilation produces an unpublished local QA place. Private hooks exist only in copied compiled service modules under build/; production modules expose no QA hooks. The script uses the real campaign request handler, real accepted kill handler and real settlement. Prior missions are fixtures completed through completeMission in order; M03 availability changes only in the isolated session. Combat kills are injected through the kill handler. The recorded7.00s winning time is scripted integration timing, not a flown combat benchmark. Saves are session-only in this unpublished place.

The client observer decoded replicated telemetry: full jam, partial jam with1200-stud visual lock range, then clear radar. It also observed the brief initial clear packet before jammer arrivals. Server checks confirmed two/one/zero live jammers and distant locks denied/denied/allowed. Initial aircraft loaded uploaded HeavyTransport, RadarJammer, VantaV2, VantaV2Vulture and VantaV2Elite. The final guard palette represents3 plain,3 Vulture including the ace, and4 Elite; two of each class initially.

M04's third required transport immediately settled1540/S after all optional targets. The next practice launch and its immediate cleanup both succeeded; final report has `Complete=true` and no error. This verifies campaign integration and cleanup, not combat balance or Player quality.

## Measurements and captures

Latest real campaign world build: **45.07697s**, terrain-ready42.78627s,12,608 jobs. Other campaign runs measured40.01–45.69s. Latest full-suite fake-world-upload build was recorded in the Jest log; it is not the live-asset campaign measurement. Real loading exceeds the20s target and the world plan estimate. Bounded terrain removal also adds a substantial post-result wait before another sortie can launch.

The39,686.69-stud route at140studs/s escapes after283.476s (4:43.5), earlier than the12-minute HUD clock. The owner should assess escape pace and scoring pressure in beta.

Runtime viewport captures: [transports](transports.jpg), [jammer with distant transports](jammers.jpg), [terrain](terrain.jpg). Captured during integration before the final livery-only distribution change. Guards engage rather than holding a rigid transport formation. Strong blue haze and coarse terrain terraces are visible; no reference visual-parity claim is made.

## Resolved integration findings

- Registered the M04 world key with client weather/phone cloud rules.
- Corrected the ace to the initial group and kept five initial ordinary guards/four reserves. The existing seven-fighter budget can queue reserves; the QA script waits for actual admission.
- Removed static aircraft from the active world; combat owns each layout id once.
- Native Terrain.Clear after this large shell repeatedly exceeded Studio's watchdog. M04 now clears the exact recorded shell with bounded yielding Air jobs, retaining launch exclusion. An already-empty marker skips redundant native clears through menu/Parts-only practice, then is consumed by a terrain-writing build. The final full sequence passed, including immediate practice exit.

Studio vacancy was checked with `pgrep -x RobloxStudio` at22:12:31,22:13:05,22:13:31,22:14:00,22:14:57,22:15:35,22:16:08,22:17:10 and22:18:17 UTC (5m46s spanning recorded empty checks) before the first launch. Only owned worktree instances were closed. Final `pgrep -x RobloxStudio` was empty.
