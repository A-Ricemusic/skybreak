# Release baseline and final integration matrix — 2026-10-27

This is task 5's baseline, not approval of the four pending implementation tasks. Test gameplay SHA: `e69613bd2ec4e6bd3e4eef28cd08ddf5f8bb862b`. The provided `t3/release-baseline-validation` checkout initially contained `6f423f34323f8e7aeb4ed358e263c15972465574`; it was fast-forwarded to the verified origin/main tip before testing. No gameplay sources were changed. The dirty original `/Users/pelicannurse/Projects/test app` was read-only, including its Studio lease ledger. No other checkout was created.

## Merged feature inventory

The 27-sortie Broken Relay campaign and four-slot saves are the current base. Changes since the old checkout include combat threats/staged waves/evade and mission pacing (#34–37, #40), pause/settings/radar and flight HUD (#38, #44, #46, #49), uploaded scenery and v2 aircraft (#39, #43), generated spatial SFX and voice (#45, #48), Terrain/weather worlds (#47), rate-commanded flight/loops/attitude hold (#50, #52), target projection and locks (#51), cinematic readiness/staging (#53), persistent speed selection (#54), outer districts (#55), deletion durability (#56), shared pause countdown (#57), and separate M1 turn/pitch progress (#58). Cinematic speaker-row controls landed in #41.

Open PR snapshot at baseline:

| PR | Head | Scope / integration decision |
|---|---|---|
| [42](https://github.com/A-Ricemusic/skybreak/pull/42) | `19ce5c69ae5e867831e32079e53611caf8f44cbf` | Missile fairness; combat agent must reconcile explicitly. Not in baseline. |
| [29](https://github.com/A-Ricemusic/skybreak/pull/29) | `58318a42ad2953210f3ac7d42828f37fef8b5fa5` | Older cinematic controls change; #41 already covers the concept. Compare before considering it. |
| [6](https://github.com/A-Ricemusic/skybreak/pull/6) | `30e342a3aa17ebc134e2190019bd9baf4f526d7c` | Glass Horizon alternative; preserve separately. |
| [5](https://github.com/A-Ricemusic/skybreak/pull/5) | `9c369bfad9046a8d943ac7a6def98adb6d596f53` | Last Tide alternative; preserve separately. |
| [4](https://github.com/A-Ricemusic/skybreak/pull/4) | `342d694ed66d7ba9fdad522e3fb7d97f4912a9ac` | Embers alternative; preserve separately. |
| [3](https://github.com/A-Ricemusic/skybreak/pull/3) | `6f9e0500acef58b62a3941473218dcc1b697984d` | Aurora alternative; preserve separately. |

## Reproducible validation

Tools here: Bun 1.3.14, Rojo 7.7.1; Studio initially 0.744.0.7441077, then automatically updated to 0.745.0.7451137; standalone Luau at `/tmp/skybreak-luau/luau`. Run sequentially in the selected isolated checkout:

```sh
git rev-parse HEAD
bun install --frozen-lockfile
bun run build:place
LUAU_BIN=/tmp/skybreak-luau/luau bun run test:offline
LUAU_BIN=/tmp/skybreak-luau/luau bun tools/relay-tables.ts --check
LUAU_BIN=/tmp/skybreak-luau/luau bun tools/world-report.ts --check
# Only after exclusive Studio ownership and process/session preflight:
bun run test:roblox
# Optional explicit deadline (milliseconds; the updated runner defaults to 600000):
ROBLOX_TEST_TIMEOUT_MS=600000 bun run test:roblox
```

Production build passed; offline Luau passed **526 / 526**; both generated documentation tables matched. Offline tests include modeled navigation and domain transitions: these are not actual gameplay completions. Raw run evidence is under this checkout's ignored `build/release-baseline/`; Roblox runner logs are `build/jest-*.log`. Generated build artifacts are local, not durable CI attachments.

## Ownership and access

Read-only shared ledger reported owner null, queue empty, release `2026-10-27T07:35:13.015Z`. No RobloxStudio editor, Rojo server, or test runner was active at preflight; StudioMCP bridge processes and an old crash handler were left alone. Discovery returned no Studio instances. This task's exclusive batch authorization was recorded locally in `build/release-baseline/lease.json`, without rewriting the root ledger. No Rojo server is needed: build and open the exact place file. Do not install/reconfigure plugins or connect to another checkout's server.

The isolated Jest launch created PID 7130, Studio `0bf637eb-74b1-41cb-ae99-99374fc167ce`, confirmed `skybreak-tests.rbxlx`, `SkybreakTestMode=true`, PlaceId/GameId 0. Thus it cannot establish target-experience asset permissions or cloud saves.

## Documentation and prior evidence boundaries

- `docs/integrated-campaign-acceptance.md` records 171 engine tests and all 27 missions/28 chapters at **86b3ce9**, before the current flight, combat, world and audio changes. Preserve it as historical evidence, not present acceptance.
- README called Broken Relay an alternative with parent acceptance pending, although that historical acceptance report exists. This patch replaces that stale claim with links separating historical acceptance from this baseline. Package metadata still uses the Glass Horizon name.
- README's original aircraft polygon counts describe the procedural assets; runtime now prefers uploaded v2 IDs in `RobloxAssetIds.ts`. Distinguish uploaded, generated Blender and primitive fallback visuals in evidence.
- The publish workflow skips Markdown/docs-only pushes, has optional credential-dependent publication, and does not run offline/Jest checks. A green build workflow alone is not gameplay acceptance. No workflow was dispatched here.
- PR54's recorded M1/speed probes use production controller APIs, not physical input hardware. `playtest-tutorial-diagnostic.client.luau` starts Normal M1 via CampaignRequest; disclose that if used. `playtest-relay.client.luau` expects menu launch and records normal controller actions. Neither route certifies human learnability.
- `assets/audio/verification.json` is prior local SFX evidence, including eight approved assets and 25 playback regions. Moderation approval does not establish experience permission. Voice readiness/stage documentation explicitly leaves runtime audio and GPU checks pending.
- Old evidence excludes cloud rejoin, physical phones/consoles and performance acceptance. Do not convert these omissions into passes.

## Ready-to-run final integration matrix

Record one final candidate SHA and the four implementation heads before beginning. Rebuild from that candidate; never combine evidence from different loaded sources without labeling it. Use read-only telemetry, screenshots and server results. Do not change health, position, kills, unlocks, deadlines or outcomes to advance coverage.

| Gate | Procedure | Required evidence / pass condition |
|---|---|---|
| Candidate integrity | Confirm clean gameplay tree, selected heads and #42 disposition; build exact candidate | SHA, source changes, production place hash; build/offline/docs pass; fresh nonzero Jest summary |
| M1 novice safety | Fresh slot; read prompts and use actual keyboard controls; separately run disclosed controller pilot | Turn/pitch progress independently advances; training hazards match intended protection; target/lock/fire teaching completes; record hull, failures, durations and input route |
| M2 combat | Sequential unlock; Normal, then Easy/Ace replay where available | Locks, real missile hits/misses, readable incoming/BREAK cue, bounded threat count, ace transition, genuine win/loss and visible Retry |
| M3 navigation | Sequential unlock; route, low scan, combat, river route and signal | Terrain clearances at objective locations, correct altitude/distance text, no invisible obstruction, legitimate progression |
| Mid campaign | Sequentially reach M12 escort and M15 signal; do not unlock by script | Withhold fire for genuine protected loss, use Retry; defend/broadcast progress and warning clarity; record protected/player hull |
| Late terrain/combat | Reach M19 logistics district, M23 platform/ships and M27 finale through legitimate progression | Supported district props, water/keel clearance, target visibility, terrain collision, ace/ending; unavailable unlocks remain blocked, not fabricated |
| Flight regression | Default 800 mph and selected 1100/1800/2600/3000; release, turn, climb, loop, stall recovery, high-speed obstacle approach | Persistent selection, sane motion and swept collision; keyboard/gamepad/touch evidence labeled separately |
| Pause and audio | Pause/resume repeatedly across mission/cinematic transitions; change volume; skip/replay scenes; retry and return to menu | Shared budget authoritative; no stale loops, overlapping voices, lost subtitles or late sound restart; inspect loaded IDs and fetch failures |
| Permissions | Read existing place/universe identity; preload existing SFX/voice/model IDs if permitted | Record each load result against actual identity. Unpublished local success is not published experience permission proof |
| Lifecycle and saves | Win/fail/retry/menu cycles, all four slots, delete durability, replay | No active world/voice/controller after teardown; correct unlock and deletion status; session-only persistence explicitly labeled |
| Devices/performance | Compact 320×182, landscape/notch and portrait Studio layouts; physical device testing separately | Visible controls/objective text; measured frame time/memory if collected. Emulation is not human phone testing |
| Handoff | Stop Play and only owned processes; release local ownership; preserve evidence | Final result table has pass/fail/blocked per gate and SHA; parent independently reviews before merge/publication |

For actual mission feasibility install `tools/playtest-relay.client.luau` and `tools/observe-relay.client.luau` as client LocalScripts in an owned session, after checking their compatibility with the candidate. Set `NoEvade=true` for a disclosed accessibility subset probe; record every attempt, including failures. Use real menu launches and a legitimate sequential slot. A blocked M1 means later mission runtime gates remain blocked unless an existing legitimate completed slot is available.

## Harness corrections

`tools/test-roblox.ts` now deletes the previous `jest-results.json` before compilation. Previously, a later failed build/launch could leave an older green summary on disk. A focused regression seeded a fake green result, substituted a build subprocess that exits 42, and confirmed runner failure plus removal of that summary without starting Studio. Evidence: `build/release-baseline/stale-summary-regression.json`. This changes test reporting only.

A second mismatch: the authoritative deadline is 900 seconds, but README and the campaign/relay pilot result checks still said 600. README now states 900; both pilots read `GameConfig.Campaign.MissionTimeLimit`, including the campaign timeout-observation window. The tutorial diagnostic retains its shorter bounded probe duration; that is not a mission deadline.

## Baseline live probes

The first Roblox Jest run timed out at its 180-second runner deadline without `SKYBREAK_JEST_RESULT`. The last reported suite was RelayCampaign; subsequent output repeatedly reported `Asset content representation is being generated` for IDs including 82518299646954, 94867214799945 and 105984907512288. This is an incomplete run, not zero failures or a pass. The log does not prove the asset errors were the sole cause. Studio also downloaded an update during that session.

Production launch subsequently relayed through the installer to PID 13654 (its command line names this checkout's place and parent PID 13497), Studio `ae40de11-6e53-4e97-a621-e330a8b5fd10`, version 0.745.0.7451137. PlaceId/GameId remained 0. Local probes used actual production flight/target/fire/evade controller methods and real server results, but launched through the normal `CampaignRequest(StartMission)` API, **not menu clicks or physical hardware**. No state, health, kill, unlock, pose or result override was used. Slot 1 progressed sequentially; slots 2–4 stayed empty.

| Mission | Difficulty | Result | Seconds | Total kills / ground | Lowest sampled hull | Evidence |
|---|---|---|---:|---|---:|---|
| M1 | Normal | Completed | 43.868 | 4 / 1 | 100 | `build/release-baseline/m1.json`; tutorial diagnostic |
| M2 | Normal | Completed | 43.867 | 9 / 5 | 100 | `m2final.json`; relay pilot, 23 missile and 3 evade commands |
| M3 | Normal | Completed | 83.597 | 5 / 0 | 100 | `m3final.json`; relay pilot, 10 missile and 0 evade commands |

The M2 active-flight capture `m2-active.png` shows the ace objective, target boxes, radar, aircraft, harbor scenery and HUD. It is an original Studio capture, not a phone screenshot. Engine, burn, wind, enemy engine, missile and radio sounds were observed loaded and playing in this unpublished local session (`m2.json` and sampled tool output). This establishes local load/play state only, not listening quality, published experience permissions or complete audio lifecycle acceptance. M1 post-completion sampling found no remaining SFX/voice sounds, but this is one teardown sample.

A compact durable evidence export is [release-baseline-2026-10-27.json](evidence/release-baseline-2026-10-27.json). M3's original active screenshot shows the signal objective, IN VOLUME guidance, canyon terrain and aircraft. Final local teardown reported zero game SFX/voice sounds, no active flight controller and no cinematic. The fresh slot legitimately unlocks M4 only: M12/M15/M19/M23/M27 runtime gates were **not executed**, and no unlock shortcut was used. The ready-to-run matrix specifies them for final integration. Existing unit world-plan/navigation coverage must not be described as these live mission runs.

No human phone/console, cloud save/rejoin, final voice/art listening review, failure/Retry, pause-budget exhaustion, ten/fifteen-minute timeout, or frame-time/memory acceptance is claimed by these three successful automated probes.

The runner now also accepts validated `ROBLOX_TEST_TIMEOUT_MS` (new default 600000; formerly 180000) so a long world-integration run can be investigated without changing gameplay or silently skipping suites. Invalid input was rejected before launch.

The updated-Studio default-deadline retry also returned no summary within 180 seconds. Both attempts retain their own logs (`jest-output.log` / `jest-retry-output.log` in the baseline evidence folder). A longer, unfiltered run uses the new timeout option; no suite is excluded.

## Implementation handoff (not tested here)

The parent subsequently reported PR59 pursuit cap `8ae7619`, PR60 audio `0f264f7`, PR61 tutorial `12980f2`, PR62 route `47c047f`, and draft PR63 authoritative EVADE cue `0a08444`. These are coordination inputs only: none was applied to this baseline checkout or validated by these live results. A separate combined code/offline review is in progress; this task does not duplicate it. Parent will commission final live integration against one selected combined SHA.

The extended run was still progressing through actual world fixtures beyond the old 180-second deadline. The default is therefore raised to a bounded 600 seconds, with the same positive-integer override for slower/faster test hosts. This fixes premature orchestration failure; it does not hide Jest failures or bypass world tests.

## Full engine result and isolated regression fix

The unfiltered extended run finished in **213.466 seconds: 663 passed, 1 failed, 664 total, 57 suites**. Its report is preserved as `build/release-baseline/jest-extended-results.json` and `jest-extended-output.log`. This is a red baseline, not a full green release. The 180-second default had hidden the final finding by killing the still-progressing world suite.

The sole failure was `Broken Relay disposable world integration / builds and disposes M3 with exact authored targets and bounded scenery`, compiled `RelayWorld.spec:130` (`expect(item.CanQuery).toBe(solid)`). PR55 added eight `Outer runway threshold` paint parts with `solid: false`; the engine test's hardcoded decoration list omitted that name and inferred `true` from visibility. This patch adds the missing decoration name to the test list. It does not change any world geometry, collision flags or gameplay. All other 663 engine tests passed on the baseline, including the mid/late world fixture checks; that is engine geometry coverage, not normal-control mission completion.

A targeted rerun uses the same isolated test project and Jest engine with `testMatch = { "**/RelayWorld.spec" }` and `testNamePattern = "builds and disposes M3 with exact authored targets and bounded scenery"`; the temporary entrypoint is `build/release-baseline/targeted-world.luau`. The final integrated candidate must still run the complete suite after all gameplay changes.

Targeted regression result: **1 passed, 0 failed, 41 skipped** in 7.552 seconds (one suite, only the corrected M3 case selected). The full suite was not rerun after this test-only correction; do not collapse the separate 663/664 baseline and targeted pass into a claimed unfiltered 664/664 run. Updated pilots passed Luau syntax compilation; the patched relay pilot produced the live M2/M3 results above. The stale-summary and invalid-timeout regressions passed. `git diff --check` passed.

No pre-existing editor session was modified. All task-owned Play sessions stopped and owned Studio processes exited; the root shared ledger remained untouched. Local ownership is released at handoff. No merge, publication, asset upload, secret use, PR watch, or gameplay change was performed. Final combined release acceptance remains the parent's next task.
