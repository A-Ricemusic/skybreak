# SKYBREAK campaign dashboard

Pending `perf/m03-m05-load` (2026-10-31), unmerged: loading estimates M01 **19.963 → 13.466 s**, M03 **19.613 → 14.734 s**, M04 **16.160 → 15.104 s**, M05 **37.441 → 15.828 s**. M01 coalesces identical adjacent land columns; M03 removes only its unreachable buried floor and adopts chunk/yield estimation; M04/M05 retain all native terrain/water, scenery and mission poses. Larger 262,144-voxel fills and loading-only work budgets of 0.5 / 0.3 / 3 s reduce redundant work and frame waits. M05 can stall server work for 3 s during loading: these are extrapolated estimator results, **not measured device times**. M06–M18 are already ≤16 s; M10 is closest at 14.739 s. A new all-18 offline gate and Studio timing cases cover every mission. Studio/test:roblox/Player were deliberately not run; orchestrator timing and device acceptance remain pending. No gameplay changes or uploads.

Updated 2026-10-31 against main `c1266e30` (#201); results continuation and chapter-gating fix pending PR #202.

Practice and all 18 campaign missions are merged and live by the owner's automatic-pipeline convention. Play through the campaign next: [Play SKYBREAK](https://www.roblox.com/games/112911685457826). Sequential unlocks still require completing preceding missions.

All missions passed the orchestrator's full Studio Jest suite before merge (reported by the orchestrator; final M18 suite 1,450/1,450). This documentation reconciliation did not launch Studio or perform Player tests. Owner Player report on current main: M01 completed on Normal on a phone, but NEXT: MISSION 02 did nothing despite cloud-save confirmation. The pending results fix shares D-030 chapter gating with menu launches: unseen chapters play before Next loads the next mission, seen chapters launch directly, and seen flags require completion/Skip acknowledgements validated against server progression. The pending results fix has offline coverage only; no agent Player or Studio test. Missions 6–18 have no Player/phone playtests. Rendered quality, human difficulty, provisional ranks/counts, real loading time and phone performance remain unverified.

PR #202 follow-up validation (2026-10-31): frozen install, build, and prescribed-LUAU_BIN validate:offline exited 0; 1,223 offline Luau contracts, 487 module compilations, 202 require-graph nodes and 124 Python tests passed. ChapterContinuation.spec is in both offline runner lists. No Studio, test:roblox or Player run.

Publish snapshot: latest 20 main runs checked; all 20 succeeded, including M18 run [41187517345](https://github.com/A-Ricemusic/skybreak/actions/runs/41187517345) completed successfully. No failure in that sample. Live is a pipeline convention, not an observed Player result.

| Mission | Title | PR | Merge commit | Studio verified | Player tested |
|---|---|---|---|---|---|
| 1 | OUR OWN PAINT | [#130](https://github.com/A-Ricemusic/skybreak/pull/130) | `4891e8a1` | ✓ 750/750 (#130) | Owner: Normal phone win; Next broken on c1266e30; fix device test pending |
| 2 | NO ANIMALS | [#143](https://github.com/A-Ricemusic/skybreak/pull/143) | `68f2df51` | ✓ reported pass | not yet |
| 3 | NOBODY SIGNED | [#147](https://github.com/A-Ricemusic/skybreak/pull/147) | `7d73c44c` | ✓ 845/845 | not yet |
| 4 | BLIND COURIERS | [#149](https://github.com/A-Ricemusic/skybreak/pull/149) | `af18e335` | ✓ 865/865 | not yet |
| 5 | LIGHTS OFF | [#148](https://github.com/A-Ricemusic/skybreak/pull/148) | `227713be` | ✓ 972/972 | not yet |
| 6 | IRON COAST | [#179](https://github.com/A-Ricemusic/skybreak/pull/179) | `199e7eed` | ✓ 1,133/1,133 | not yet |
| 7 | ARRAY BREAK | [#178](https://github.com/A-Ricemusic/skybreak/pull/178) | `a04fdd61` | ✓ passed; count not recorded here | not yet |
| 8 | OPEN FREQUENCY | [#183](https://github.com/A-Ricemusic/skybreak/pull/183) | `085373c8` | ✓ passed; count not recorded here | not yet |
| 9 | GREEN BEACON | [#185](https://github.com/A-Ricemusic/skybreak/pull/185) | `06ca3e44` | ✓ passed; count not recorded here | not yet |
| 10 | RIVER LINE | [#187](https://github.com/A-Ricemusic/skybreak/pull/187) | `7ff07613` | ✓ passed; count not recorded here | not yet |
| 11 | HIGH CROSSING | [#189](https://github.com/A-Ricemusic/skybreak/pull/189) | `5c88368c` | ✓ passed; count not recorded here | not yet |
| 12 | THE COMMAND RING | [#191](https://github.com/A-Ricemusic/skybreak/pull/191) | `351d7988` | ✓ passed; count not recorded here | not yet |
| 13 | EVIDENCE THROUGH THE GREY | [#195](https://github.com/A-Ricemusic/skybreak/pull/195) | `e2c7fab2` | ✓ passed; count not recorded here | not yet |
| 14 | AURORA SHIELD | [#196](https://github.com/A-Ricemusic/skybreak/pull/196) | `80273894` | ✓ passed; count not recorded here | not yet |
| 15 | SILENT STREETS | [#197](https://github.com/A-Ricemusic/skybreak/pull/197) | `d40b9706` | ✓ passed; count not recorded here | not yet |
| 16 | DUST ROAD | [#198](https://github.com/A-Ricemusic/skybreak/pull/198) | `6e04cc5a` | ✓ passed; count not recorded here | not yet |
| 17 | LAST WING | [#199](https://github.com/A-Ricemusic/skybreak/pull/199) | `f68d81d5` | ✓ passed; count not recorded here | not yet |
| 18 | CLEAR FREQUENCY | [#200](https://github.com/A-Ricemusic/skybreak/pull/200) | `4594c365` | ✓ 1,450/1,450 | not yet |

Practice: merged in [#130](https://github.com/A-Ricemusic/skybreak/pull/130), `4891e8a1`; Studio verified: ✓; Player tested: not yet.

[Level cards](levels.html) · [Shipped history](shipped.md) · [Playthrough checklist](next.md) · [Blockers](blockers.md) · [Decision records](decisions.md)
