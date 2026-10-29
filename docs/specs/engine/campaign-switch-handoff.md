# Campaign switch G: implementation handoff

This branch changes the live game when merged. It is not merged by its implementation agent. No Studio run, independent review, Roblox Jest run or Player playtest was performed. No asset was generated or uploaded. The existing M01 builder clones the existing library and retains its procedural carrier stand-in fallback.

## Released data and flow

Practice has ID **0**, outside the numbered catalog. `PRACTICE` is separate from `MISSIONS` (18 entries); catalog lookup accepts 0–18. The archive inserts Practice before numbered missions. Practice retains the old tutorial's first three phases, their exact execution policies and training radar, and removes the live-bandit phase. It is optional, always available and replayable. Its record serializes under key `0`, without affecting numbered mission completion. A fresh save selects mission 1. Practice success offers Next to mission 1; mission 1 success offers menu/replay, never mission 2.

`canLaunchMission` combines ID validity, release availability and sequential completion. Server request resolution, omitted-ID resume, UI launch and Next use it. Combat start and world construction independently reject unavailable missions. Completion checks use catalog objectives and phase totals. Seventeen placeholders have `available: false`, neutral titles `Mission N`, and `In development` copy. Completion or forged saved records cannot override release availability.

Fresh namespace: **SkybreakCampaign18_v1**, schema 3. No old DataStore is read, written, deleted or migrated. Existing schema normalization utilities remain for defensive decoding within this namespace.

## Mission 1 exact authored settings

Title **OUR OWN PAINT**, codename **Rim Static**. World key `m01_sea_island`, custom sea-overcast afternoon environment from M01World, `M01_AIRSPACE` soft/hard/spawn/radar **14000 / 15360 / 13500 / 18000** studs. Briefing region **coastal_city** (COASTAL CITY); world selection remains `m01_sea_island`. Catalog display preset `farm_overcast`; runtime applies the custom M01 environment.

`m01CarrierFlyoffStart()`: kind `carrier_flyoff`, position **(24.5155, 90, 10828)**, heading **0°**, speed **180 studs/s**. Existing LaunchStage handles handoff. Countdown **600 seconds**, beginning on player control.

One `required_air` phase, **6 required bombers**, no ground targets. Waypoints **(0,727,8200) → (512,727,4200) → (1280,727,256) → (-1280,727,-3200)**, escape **(-1280,727,-5600)**. South to north, coastal city before Varda Rim's headland runway. The compiled Hermite route's arc length is **14852.312394944027 studs**; speed **61.88463497893345 studs/s** gives **240 seconds**. Speed is computed from `BomberRules.Create(route, 1).length / 240`, rather than the shorter straight-line path. Pure tests sample all six slots every second for corridor containment and terrain clearance.

**4 optional escorts total, including ace**: 2 initially; remaining ordinary escort and ace scheduled at **150 s**, admitted through the existing fighter queue/budget. Ace **ASH WARRANT**, original name. Escape call: “The bombers crossed the north coast. Varda Rim, clear the runway.”

**4 Kestrel allies**, prefix **LANTERN**, offsets **(-180,20,160), (180,20,160), (-360,40,320), (360,40,320)**. Default may-kill optional escorts; explicit no player credit and no required targets. Tests exercise production allied kill accounting: no points or objective/tally credit.

Raw points: bomber **100**, escort **60**, ace **240**. Ranks **S≥800, A≥700, B≥600, C≥500**, otherwise D; provisional cuts. Six bombers + two escorts + ace = **960 / S**. All bombers down wins immediately; escape, countdown zero or destroyed aircraft fails. Optional kills never gate completion.

## Original text

Opening: only the final trainee answer changes to “An empty chair and a checkout nobody's signing. Fine. I'll fly the pattern.” Other opening beats stay intact. This opening is shared by practice and mission 1, played on first launch and recorded as seen chapter 0. The altered line has no matching recording: the existing exact-transcript guard keeps it subtitle-only. Bank transcripts and recordings are unchanged; tests check this explicitly.

Practice briefing: “Teal never signed your checkout. Fly the training pattern, practice the controls, then select and hit the training radar. No enemies.” Practice debrief: “Checkout interrupted: six bombers are crossing the islands. Mission 1 is ready when you are.”

Mission 1 briefing: “Teal's unsigned checkout is cut short. Six bombers in Varda's own paint are crossing the islands toward Varda Rim's runway on the headland. They squawk our codes; the warning came late. You are the nearest jet. Fly off the training carrier and stop them. Escorts are optional targets.”

Mission 1 debrief: “The six bombers are down and Varda Rim's runway is clear. The quartermaster hands you a sealed case from Teal's bunk, addressed to Sera.” Failure: “The raid was not stopped. Varda Rim's runway remains under threat.”

Only chapter 0 is reachable. All later chapter scripts, documents, cues and finale remain intact and dormant; future mission PRs must remap and revise them according to the approved chapter map before releasing those missions. Their archive still contains 28 scripts; this is intentionally not a claim that all 19 future campaign chapters have been implemented.

## Validators and retained compatibility coverage

Active snapshot: new `mission-catalog.campaign18.json`, **19 cases** including practice. The old snapshot remains historical. Offline adapter loads 18 current modules plus practice, with legacy fixtures explicitly test-only. The 27 old compositions were moved/copied into `src/tests/legacy` for pure compatibility coverage and are excluded by default.project.json from the production place.

`relay-tables.ts` retires regeneration from the active catalog and checks the historical marker. `docs/broken-relay.md` is historical, preserving its old generated tables. Active content is covered by the new snapshot and campaign suite. `world-report.ts` now reports practice plus M01 only; practice counts require engine measurement, M01 counts are planner estimates. `docs/world-realism.md`'s generated block is updated; surrounding historical analysis is retained.

Legacy runner, wave, airspace, scoring-default, world geometry and terrain tests use captured blueprints. WorldPlanner and WorldAudit accept explicit blueprints so test fixtures do not enter production selection. Retired byte-identical packet/save snapshots and old sequential unlock/migration assertions were removed: the campaign, save epoch, availability and objective checks changed intentionally. Replacement coverage exercises the active M1 result ledger, persistence, practice records, locks, forged requests, timeout, destruction and escape. Existing schema merge/deletion/recovery tests remain. Studio Campaign.spec expectations now reflect locked M2 and M1's six targets and phase proof.

RelayWorld's engine tests now build only practice and M01, check disposal, bounds, targets, actual bomber corridor raycasts and unreleased-world rejection. Old executable-world tests for retired compositions are replaced; their pure geometry audits remain. Synthetic playtest regression uses M1's target totals, mission-owned deadline and availability filter. It preserves duplicate-event, retry, shutdown, invalid-counter and wrong-result checks. Voice manifest and compiled consumer tests preserve original recordings and explicitly expect zero audio for the rewritten opening answer.

Removed from production catalog: all old 27 compositions, old m19–m27 files/imports, and the dead GameConfig per-mission objective constants. Dormant runtime cleanup deferred: Iron Coast builder, legacy layouts/districts/planner/executor, LegacyWorlds assets, later story/documents/voice cues and legacy serialization fields. They have shared dependencies or valuable compatibility coverage; releasing future missions must not accidentally reactivate their old content. No FlightController, MissionHud, FlightPrediction, LaunchStage or AlliedRules implementation edits; UIFormat now decodes remote mission-record keys; CombatService changes only release rejection and practice target hiding (formerly hardcoded M1).

## PR #130 review fixes (2026-10-29)

Merged current `origin/main` (#128 fly-off follow-ups and #129 docs) without rewriting history. Kept CountdownDisplay and its validations while retaining the 18 numbered modules, practice and legacy fixture registrations. CountdownFlyoff's legacy telemetry/HUD check uses practice ID 0 for its unchanged 900-second clock, with CountdownDisplay still applied.

Remote campaign responses now encode mission records with string keys in CampaignWire; UIFormat decodes them to numeric client lookup keys. DataStore encoding is unchanged. The pure CampaignWire spec runs offline and in the Studio suite: records 0 and 1 survive encoding/decoding with ranks intact, every outgoing key is a string, and old contiguous 1..k arrays still decode.

Studio-only specs updated:
- `src/tests/Campaign.spec.ts`: delayed startup save now submits missionId 1, six kills, zero ground kills and one completed phase. Recovery, failed-save/recovery, replay, shutdown, deletion and fresh-generation successful ledger fixtures now use six kills. Objective failure uses five kills with phase proof; timeout uses six kills/phase proof and M1's authored 600-second limit.
- `src/tests/BomberDirector.spec.ts`: current-catalog phase coverage now asserts six route bombers, two optional opening escorts and an active encounter for M1 rather than legacy bandit scheduling. Other phases keep their generic assertions.

Searched Studio specs for three-kill M1, M2 warehouses/legacy phases and 27-mission assumptions; no further active Studio-only assumptions found. Historical contracts explicitly importing LegacyCatalog remain historical.

The new route begins 2,628 studs north of the fly-off in z (center-to-player distance about 2,704 studs), before the city and airbase; final escape is 200 studs beyond the island's north end at z=-5400. Arc length **14852.312394944027**, speed **61.88463497893345**, duration **240 s**. RelayCampaign checks the start gap, exact route, coast exit and region, and samples all six bomber slots each second for terrain clearance and corridor containment. These are offline numeric checks, not observed Player pacing.

Known follow-ups deferred until mission 2: sequential-unlock tests, forged-phase-proof tests, finale chapter remapping, WorldPlan ids, TimeVersion and the replay reprise. None is addressed in this fix pass.

Human-doc delta payload (orchestrator applies; this agent does not edit `docs/human/`):
- README: PR #130 remains unmerged; review findings fixed, main integrated, offline gate rerun; Studio and Player quality still unobserved.
- shipped: no new shipped/live entry until merge.
- next: orchestrator runs Studio suite and whole-sortie checks, accepts/merges, then owner playtests; carry the seven deferred M2 follow-ups above.
- blockers: remote mixed-key hazard fixed; startup-save and bomber-director stale fixtures fixed. Studio lease retained by orchestrator; this agent did not run Studio or Roblox Jest.
- decisions: retain D-024 coast exit at (-1280,727,-5600) and D-035 route/240 rule; record the new five points, computed length/speed and coastal_city display region. No new deployment or Player verification claim.

## Studio-only handoff

Run full `bun run test:roblox`, including revised Campaign and RelayWorld integration plus CombatService/PhaseDirector, bomber model/actor disposal, target replication, launch/retry/pause/skip and score/result persistence. Measure the entire M1 in Studio: build latency, descendant/terrain budgets, cold/warm library appearance and carrier orientation, fly-off handoff/collision clearance, six bomber paths, two initial escorts and delayed escort/ace admission, wingman combat/no credit, countdown/escape/destruction/success, retry and locked Next/controller focus. Offline tests establish numeric contracts, not rendering, latency, controls quality or reference fidelity. After merge, the owner performs Player playtesting; no Player observation is claimed here.

## Round 2 Studio-verification fixes (2026-10-29)

The older verified head used a global `+80 X` launch-camera offset. The merged fly-off follow-up at this branch base already replaced it with heading-relative `-RightOf`; Round 2 makes the signed port distance explicit and adds world-axis regressions for north and east headings. Flight HUD advice and warning tones are now disabled only while the client's launch-intro state owns the jet, then restored by the reliable control handoff. Round 1's string-key wire fix already carries M1's score and rank through client normalization; Round 2 also preserves the validated target breakdown when legacy best-time compatibility rebuilds mission 1's record. The briefing now presents the points best, with a six-bomber 600/B save-to-menu regression. Studio/Player behavior remains unobserved by this implementation pass.

## Payload for the orchestrator's five human documents

**shipped.md:** Before merge: no shipped/live claim. After merge: atomic 18-mission switch, optional practice and mission 1 available; M2–18 visible and locked; new saves; M01 world/carrier launch/bomber intercept, raw scoring and original opening text. Merged/live by pipeline convention; no Player verification by this agent.

**next.md:** Run full Studio suite and whole-mission measurement before merge; verify #128's fly-off follow-ups, now merged from main along with #129 documentation. Then merge only after orchestrator acceptance, owner Player playtest, calibrate provisional pace/ranks if needed. Build mission 2 and adapt its chapter before unlocking it; later dormant-content cleanup follows.

**blockers.md:** No known implementation blocker after the offline gate. Studio execution/whole-sortie measurements and owner Player quality acceptance remain unperformed. The rewritten trainee line and new M1 radio have no new recordings; subtitle-only fallback is intentional, no upload is needed for this switch. Procedural carrier fallback and existing library appearance need engine inspection. No new Blender exports or uploads in this PR.

**decisions.md (new provisional decisions/implementation choices; assign stable IDs centrally):** C rank floor 500 points (new provisional addition to D-024); practice ID 0 outside the numbered 18, optional and independent save record; numbered placeholders grouped six per act with neutral Mission N/In development labels; M1 title OUR OWN PAINT, ace ASH WARRANT, ally prefix LANTERN, above formation offsets; route altitude 727 in the reserved 622–832 band, exact five route points, speed from compiled arc length for 240 s; remaining regular escort arrives with ace at 150 s under existing queue admission; namespace SkybreakCampaign18_v1 with no old-store access; all later scripts remain dormant rather than prematurely adapting their story; rewritten opening answer stays silent until a matching recording is authored; test-only legacy fixtures retain reusable coverage, explicit planner/audit blueprint injection supports them. These choices implement the task; provisional numeric values are not a reference-fidelity claim.

**README.md mission progress table (after merge):** Practice: playable optional controls/radar checkout, no enemies. Mission 1: playable bomber intercept, Studio/Player observations recorded only by whoever actually runs them. Missions 2–18: visible, locked, in development. Table rows:

| Entry | Release state |
|---|---|
| Practice | Playable, optional, replayable |
| 1 | Playable |
| 2 | Locked / in development |
| 3 | Locked / in development |
| 4 | Locked / in development |
| 5 | Locked / in development |
| 6 | Locked / in development |
| 7 | Locked / in development |
| 8 | Locked / in development |
| 9 | Locked / in development |
| 10 | Locked / in development |
| 11 | Locked / in development |
| 12 | Locked / in development |
| 13 | Locked / in development |
| 14 | Locked / in development |
| 15 | Locked / in development |
| 16 | Locked / in development |
| 17 | Locked / in development |
| 18 | Locked / in development |

## Verification actually performed

`bun install --frozen-lockfile`: passed. `bun run build`: passed. Final `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: exited 0. `git diff --check` and staged diff check: passed. The gate built the production place and checked packaged voice code; no place was uploaded.

```text
OFFLINE_LUAU_RESULT passed=636 failed=0
MISSION_CATALOG_SNAPSHOT passed=19 failed=0 (practice and 18 numbered entries; execution metadata excluded)
PLAYTEST_RELAY_REGRESSION passed=3 failed=0
AUDIO_LIFECYCLE_SIMULATION passed=11 failed=0
VOICE_CONSUMER_RESULT passed=8; simulated lifecycle only, audible output NOT tested
RADIO_DELIVERY passed=4 failed=0
Ran 119 tests
OK
Historical Broken Relay tables retained; active catalog covered by snapshot and campaign contracts.
world counts up to date
```

## File inventory

Path counts without rename detection: **33 added, 9 removed, 64 changed** (106 paths). Some old missions become test fixtures and may appear as renames in GitHub.

```text
M	docs/broken-relay.md
A	docs/specs/engine/campaign-switch-handoff.md
M	docs/world-realism.md
M	src/client/GameUI.tsx
M	src/client/screens/BriefingScreen.tsx
M	src/client/screens/OutcomeScreen.tsx
M	src/server/CampaignRepository.ts
M	src/server/CampaignService.ts
M	src/server/CombatService.ts
M	src/server/MissionWorld.ts
M	src/shared/CampaignProgress.ts
M	src/shared/GameConfig.ts
M	src/shared/M01CarrierPlan.ts
A	src/shared/M01Geometry.ts
M	src/shared/M01WorldPlan.ts
M	src/shared/MissionCatalog.ts
M	src/shared/RelayStory.ts
M	src/shared/Types.ts
M	src/shared/WorldAudit.ts
M	src/shared/WorldPlan.ts
M	src/shared/missions/index.ts
M	src/shared/missions/m01.ts
M	src/shared/missions/m02.ts
M	src/shared/missions/m03.ts
M	src/shared/missions/m04.ts
M	src/shared/missions/m05.ts
M	src/shared/missions/m06.ts
M	src/shared/missions/m07.ts
M	src/shared/missions/m08.ts
M	src/shared/missions/m09.ts
M	src/shared/missions/m10.ts
M	src/shared/missions/m11.ts
M	src/shared/missions/m12.ts
M	src/shared/missions/m13.ts
M	src/shared/missions/m14.ts
M	src/shared/missions/m15.ts
M	src/shared/missions/m16.ts
M	src/shared/missions/m17.ts
M	src/shared/missions/m18.ts
D	src/shared/missions/m19.ts
D	src/shared/missions/m20.ts
D	src/shared/missions/m21.ts
D	src/shared/missions/m22.ts
D	src/shared/missions/m23.ts
D	src/shared/missions/m24.ts
D	src/shared/missions/m25.ts
D	src/shared/missions/m26.ts
D	src/shared/missions/m27.ts
A	src/shared/missions/practice.ts
M	src/tests/AlliedRules.spec.ts
M	src/tests/AuthoritativeScoring.spec.ts
M	src/tests/BlueprintProgress.spec.ts
M	src/tests/BomberEncounter.spec.ts
M	src/tests/Campaign.spec.ts
M	src/tests/CombatBalance.spec.ts
M	src/tests/CountdownFlyoff.spec.ts
A	src/tests/LegacyCampaign.spec.ts
A	src/tests/LegacyCatalog.ts
M	src/tests/M01WorldPlan.spec.ts
M	src/tests/MissionAirspace.spec.ts
M	src/tests/MissionPolicy.spec.ts
M	src/tests/MissionScore.spec.ts
M	src/tests/PhaseDirector.spec.ts
M	src/tests/RelayCampaign.spec.ts
M	src/tests/RelayWorld.spec.ts
M	src/tests/TerrainSchedule.spec.ts
M	src/tests/UnifiedMissionRunner.spec.ts
M	src/tests/VoiceLines.spec.ts
M	src/tests/WorldPlan.spec.ts
A	src/tests/legacy/legacy01.ts
A	src/tests/legacy/legacy02.ts
A	src/tests/legacy/legacy03.ts
A	src/tests/legacy/legacy04.ts
A	src/tests/legacy/legacy05.ts
A	src/tests/legacy/legacy06.ts
A	src/tests/legacy/legacy07.ts
A	src/tests/legacy/legacy08.ts
A	src/tests/legacy/legacy09.ts
A	src/tests/legacy/legacy10.ts
A	src/tests/legacy/legacy11.ts
A	src/tests/legacy/legacy12.ts
A	src/tests/legacy/legacy13.ts
A	src/tests/legacy/legacy14.ts
A	src/tests/legacy/legacy15.ts
A	src/tests/legacy/legacy16.ts
A	src/tests/legacy/legacy17.ts
A	src/tests/legacy/legacy18.ts
A	src/tests/legacy/legacy19.ts
A	src/tests/legacy/legacy20.ts
A	src/tests/legacy/legacy21.ts
A	src/tests/legacy/legacy22.ts
A	src/tests/legacy/legacy23.ts
A	src/tests/legacy/legacy24.ts
A	src/tests/legacy/legacy25.ts
A	src/tests/legacy/legacy26.ts
A	src/tests/legacy/legacy27.ts
A	tools/fixtures/mission-catalog.campaign18.json
M	tools/playtest-relay.client.luau
M	tools/relay-tables.ts
M	tools/test-mission-catalog.ts
M	tools/test-relay-offline.ts
M	tools/test-voice-offline.ts
M	tools/tests/playtest-relay-harness.luau
M	tools/tests/voice-consumer.luau
M	tools/validate-offline.ts
M	tools/world-report.ts
```
