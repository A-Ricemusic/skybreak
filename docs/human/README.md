# SKYBREAK campaign dashboard

2026-11-01 verification update: supplied main `3ed084dd` and main+#231 Studio logs stall in the lifecycle runtime suite without a summary. The orchestrator now has Studio access; earlier sign-in notes below are historical. Unmerged `fix/jest-lifecycle-hang` isolates terrain-state tests and bounds/restores runtime work; #238 independently repairs military fixtures/pacing. Exact stalled native call is unconfirmed; coordinated Studio rerun pending. This work ran no Studio/Player tests and changes no mission/live status.

**M3 crash blocker OPEN — mitigated; owner phone retest pending.** M3 crash mitigation #236 merged as `364a7413`, live as Roblox version 148, published 2026-11-01. It removes the inaccessible bottom floor, temporarily uses procedural targets with no military meshes/PBR maps, and logs construction errors before recovery. The owner-reported mobile app crash remains open: cause unconfirmed, awaiting owner phone retest. Not Studio/Player tested. Restore M3 military visuals only once the crash cause is confirmed. See [investigation](../qa/m03-crash-second-hotfix.md).

Updated 2026-11-01 against main `556a6807` (#234). Practice and all 18 missions are **Live** under the owner's automatic-pipeline convention; sequential unlocks require preceding completions. [Play SKYBREAK](https://www.roblox.com/games/112911685457826).

#202 fixed results Next and story chapter gating. #218 activated ten independently reviewed, moderation-approved military models: tank, SAM, AA, artillery, bunker, radar, truck, fuel, barracks and containers. #220 (`9793b6d8`) fixed M3 failing to build after that activation by separating base-instance limits from bounded military decoration. It merged as an exception without the usual Studio Jest run while Studio was signed out. The owner-supplied November 1 main run now reports synthetic military fixture failures; corrected fixture acceptance remains pending (see blockers.md). No Player verification of the hotfix is claimed.

#226 and #228 merged the 12 naval exports, independent strict 10/10 approvals, decisions and manifests **only**. They have not been uploaded and are not in game. Dormant runtime integration remains open in #221. Audio uploads are permanently blocked by owner instruction.

Owner signed in for the November 1 main Studio run. Orchestrator next action: rerun the corrected military instance-budget fixtures, then run Studio Jest in queue order #203, #205, #210, #221, #227, #231, #233 and #235, including merged #220/#236 regressions. Owner must also retest M3 on phone (version 148). #205 addresses measured freezes up to 74 s, mostly previous-world cleanup, using cooperative cleanup and 0.15 s terrain slices; Studio acceptance is pending. Naval upload separately awaits an Open Cloud key through the secure prompt. See [priority checklist](next.md) and [blockers](blockers.md).

The table records historical mission-integration Studio results reported by the orchestrator (final M18 suite 1,450/1,450), not verification of today's full main. The cleanup sweep reported 1,463/1,463 before rebase. Neither establishes acceptance of #220/#236 or the eight open PRs. This reconciliation performed no Studio or Player tests. Owner previously won M01 on Normal on a phone and reported the Next failure; post-#202 device acceptance remains open. Missions 6–18 have no Player/phone verification; rendered quality, difficulty, loading time and phone performance remain unverified.

| Mission | Title | PR | Merge commit | Historical Studio evidence | Player tested |
|---|---|---|---|---|---|
| 1 | OUR OWN PAINT | [#130](https://github.com/A-Ricemusic/skybreak/pull/130) | `4891e8a1` | ✓ 750/750 (#130) | Owner: Normal phone win; Next broken on c1266e30; fix device test pending |
| 2 | NO ANIMALS | [#143](https://github.com/A-Ricemusic/skybreak/pull/143) | `68f2df51` | ✓ reported pass | not yet |
| 3 | NOBODY SIGNED | [#147](https://github.com/A-Ricemusic/skybreak/pull/147) | `7d73c44c` | ✓ 845/845 (historical) | Mitigation #236 merged/live v148; owner phone retest pending; not Studio/Player tested |
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
