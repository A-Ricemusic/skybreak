# Campaign switch Studio verification — PR #130

Measured 2026-10-29 on macOS, Roblox Studio 0.745.0.7451137, Bun 1.3.14.
Exact subject: `fc34a30458a2faa790f9d1233aa2febe74ce1466`,
`feat/campaign-switch-m01`, A-Ricemusic/skybreak#130. Report branch:
`verify/campaign-switch`. This is unpublished local Studio evidence, not Roblox
Player or real-phone acceptance. No source in `src/`, human docs, assets or
published places were changed/uploaded. No merge was performed.

## Automated gate

`bun install --frozen-lockfile`, `bun run build`, `bun run build:place`: PASS.
The packaged voice check passed; audible output is not established by that check.
`bun run test:roblox`: **741 passed, 2 failed, 743 total; 71 passed suites,
2 failed suites, 73 total**. Exit 1. One run; the AircraftCollision cold-launch
terrain sweep passed, so the conditional flaky rerun was not needed.

Every failure:

1. `BomberDirector.spec` → `Bomber director integration` →
   `preserves every current combat phase's opening required roles and counts`.
   Expected 6, received 0; compiled `ServerStorage.Tests.BomberDirector.spec:463`.
   Source inspection: this assertion treats M1's `required_air` as ordinary
   `bandit` roles and expects no bomber encounter. Its preceding bomber-specific
   integration tests passed. This looks like a stale assertion, not proof that
   Play spawns zero bombers (six were actually observed).
2. `Campaign.spec` → `CampaignCoordinator datastore integration` →
   `records completion while the startup save is delayed, then drains it`.
   Expected `Completed`, received `Failed`; compiled
   `ServerStorage.Tests.Campaign.spec:201`. The source fixture still submits
   `kills: 3` for mission 1. This looks stale against the six-bomber contract.
   The real Play result completed and recorded the six-kill run session-only.

Raw evidence remains ignored: `build/jest-results.json`, `build/jest-output.log`,
`build/campaign-verification-jest-run1.log`, `build/jest-studio.log`.
The two failures remain release-gate failures; no game/test fixes were made here.

## Method and reproduction

Read the campaign handoff, M01 mission and world measurement specs, existing
pilot, regression harness, spike tooling and Roblox Jest launcher first. No
reference video comparison or audio listening was performed.

1. Acquire the Studio lease and run `pgrep -x RobloxStudio`; initial result was
   empty. Fetch the PR branch and check out the exact commit above.
2. Run the four build/test commands above with no other Studio process.
3. `bun tools/verification/build-campaign-place.ts` creates an ignored unpublished
   production place plus the existing controller pilot and read-only observers.
   Open `build/campaign-verification.rbxlx` locally; start one-client Play.
4. Use Campaign → fresh file 1 → Missions to inspect all three act tabs. Try M2's
   disabled tile. From Client, invoke
   `game.ReplicatedStorage.Remotes.CampaignRequest:InvokeServer("StartMission", {slot=1,missionId=2})`.
5. Select Practice and launch from the UI. The existing
   `tools/playtest-relay.client.luau` uses stick, throttle, target, missile and evade
   controller APIs; it does not move aircraft, edit health or award results.
   Launch M1 from the UI after Practice. Read `PlayerScripts.BrokenRelayQA` and
   `PlayerScripts.CampaignVerification`, and server mission-folder attributes.
6. For the separate escape/emulator session, stop Play, set the Edit
   `StarterPlayer.StarterPlayerScripts.QAPilot` attribute `HoldFire=true`, select
   `StudioDeviceSimulatorService:SetDeviceAsync("samsung_galaxy_a16")`, then Play
   and launch M1 from fresh file 1. The pilot still flies/evades normally but does
   not fire. The frame observer samples the actual production camera/aircraft
   without repositioning either. The city sample starts within 2,200 horizontal
   studs of `(1280,256)` and lasts ten rendered seconds.
7. Export observer StringValues to ignored JSON before stopping Play. Restore
   device `default`, stop Play and close only owned Studio processes.

Unpublished GameId 0 deliberately uses session-only persistence. Server output
explicitly says no DataStore requests are made. Session records are observed;
cloud persistence and a subsequent Player join are NOT OBSERVED.

## Check matrix

PASS means the stated observation was made; narrower evidence is qualified.
NOT OBSERVED is not an implicit pass.

| Check | Status | Evidence |
|---|---|---|
| Practice first; numbered missions 1–18 present | PASS | Archive UI: Practice then 01–06; act II 07–12; act III 13–18. |
| M1 launchable; M2–18 locked | PASS | M1 launched; all 17 other tiles read LOCKED and had Active=false. |
| Locked UI attempt and forged client M2 request | PASS | Clicking M2 left archive open; remote returned ok=false, `Mission 02 is locked or in development.` |
| Practice three exercises | PASS | `tutorial_move`, `tutorial_target`, `tutorial_missile`; all three checked on result screen. |
| Practice no enemies and completion recorded | PASS | 0 air kills, one training radar kill, three completed phases; server Completed, saved=true, persistence=session. No hostile contacts were observed. |
| M1 world build | PASS | Server WorldBuildSeconds 7.3452 desktop / 7.0423 emulator-profile; zero missing placements. |
| Client time-to-playable | PASS | Loading receipt to FlightControl 3.9135 s desktop / 3.3585 s emulator, including fly-off; excludes world build and launch-request overhead. Full click-to-playable NOT OBSERVED. |
| Carrier fly-off ~3 s; controls gated | PASS | Started → FlightControl 2.9450 s desktop; normal pilot attempted inputs; emulator aircraft samples remain x=24.5155, y=90, straight north at 180 studs/s until handoff. |
| Fly-off camera on port side | FAIL | Runtime camera x=104.5155 versus aircraft x=24.5155, heading north (-Z): east/right/starboard, not west/port. Source uses global +80 X. |
| Smooth handoff without visible jump | NOT OBSERVED | Sampled camera transitions over several frames; no continuous video reviewed. A still cannot certify absence of a visible jump. |
| Countdown begins at control, from 10:00 | PASS | Fly-off still TIME 10:00; subsequent telemetry counts down from 600 with mission elapsed; phone capture TIME 09:59 after control. |
| Six bombers on route | PASS | Six required HEAVY BOMBER models at y=727, two rows observed moving north; target boxes visible; killed all six in normal sortie. |
| Initial escorts in formation | NOT OBSERVED | Two optional ESCORT models observed, but inspected after combat began and they were dogfighting wingmen; exact opening escort formation was not captured. |
| ASH WARRANT arrives | PASS | Server model ASH WARRANT observed alive with Health=165, RequiredTarget=false during hold-fire sortie after the 150 s reinforcement window. Exact spawn instant NOT OBSERVED; first manual confirmation was about 170 s. |
| Four LANTERN allies; friendly presentation | PASS | LANTERN 1–4, SkybreakFriendly=true, SkybreakEnemy=false, Damageable=false; initial still has four FRND labels, blue radar +, no boxes on those friendlies. |
| Lock and destroy bombers | PASS | Formation still shows LOCKED; real server ledger six bomber kills. |
| Complete when last bomber dies | PASS | ObjectiveProgress 5 immediately before terminal Completed with six bomber kills; mission folder removed. |
| Results points, kill list, rank | PASS | 600, BOMBER ×6 / 600, rank B; air 6, ground 0, optional 0. |
| Natural escape failure and exact text | PASS | Hold-fire run failed at 240.006230 s, reason bombers_escaped. Screen: “The bombers got through. The raid was not stopped. Varda Rim's runway remains under threat.” |
| Return to menu; saved rank, locks unchanged | PASS | Reopened file 1: CLEARED, RANK B, best 01:02; M2–6 still LOCKED. M7–18 recheck after result NOT OBSERVED (all were locked before it). |
| M1 best score shown in menu/briefing | FAIL | Reopened M1 briefing shows rank/time but no 600/best-score value. Result screen did show 600. |
| Mid-range phone emulator near city FPS/memory | PASS | 60.00055 FPS; worst render 21.612 ms; peak aggregate Stats 4590.560 MB over 10.0166 s. This is not a real phone test. |

## Results and timings

Practice: completed in **8.150349 s**, three phases, one radar kill, one missile,
100% hull, 0 air kills, displayed **5,150 / S** (practice's existing score system).

M1 normal-control pilot: completed in **62.465398 s**, **600 points / B**,
`targetScore.kills.bomber=6`, bomber points 600; no escort/ace kills; one phase,
24 missiles fired and 24 hits, 100% hull, no damage, no evades. These are actual
server values and on-screen results, not the handoff's illustrative 960/S run.
Session bestScore=600 and bestRank=B, saved=true, persistence=session.
Only Return to menu / Replay M1 offered; no Next M2 button.

Separate hold-fire run: **Failed / bombers_escaped at 240.006230 s**, **0 points / D**,
zero kills, zero shots, zero completed phases, 92% lowest hull, 8 damage, four
evades; saved=true, persistence=session. Correct explicit bomber-escape text was
read in the UI and captured. This is natural route completion; no timer, aircraft
health, bomber health or outcome was forced. Timeout and shot-down paths were
not separately exercised in Play (automated contracts cover them).

| M1 timing | Desktop | Galaxy A16 profile |
|---|---:|---:|
| Server world total | 7.345217 s | 7.042316 s |
| Terrain ready from build start | 6.794333 s | 6.516106 s |
| Planning wall time | 1.025988 s | 1.010682 s |
| Longest planning CPU slice | 5.269 ms | 5.802 ms |
| Longest native terrain call | 92.812 ms | 81.814 ms |
| Missing props | 0 | 0 |

27,494 terrain jobs in both. Timings are production mission-folder attributes,
not isolated-world historical values. Studio/plugin/cache overhead is present.
No simultaneous compilation or Jest run during flight measurements.

Desktop Loading receipt 105.348749, Started 106.317040, FlightControl 109.262061
(client os.clock seconds): Loading→Started 0.968291 s; Started→control 2.945021 s;
Loading→control 3.913510 s. Network/frame scheduling means client receipt gaps
need not equal the server's authored exact three-second simulation duration.

Emulator Loading→control **3.358505 s**, Loading→Started **0.384816 s**.

Emulator launch observer: Started→control **2.973688 s**, 112 pose/camera samples
across seven seconds. Around handoff, camera moved 71.55 studs over a 65.84 ms
sample, then 32.49 studs over 50.74 ms. This documents the camera transition,
not a visual smoothness verdict. The initial menu→mission camera relocation is
excluded from those handoff deltas.

Galaxy A16 profile city sample: **60.00055 FPS**, worst render interval **21.612 ms**,
peak aggregate Stats **4590.560 MB**, duration **10.0166 s**. Sample began at
`(1003.997,727,2431.032)`, within the declared city approach radius, with the
production jet/controller, bombers and wingmen active. Camera was not moved by
the observer. Captures are 1336×616; the live Camera.ViewportSize in this Studio
window was 685×338. These are desktop renderer/Studio memory measurements, not
phone capacity, GPU, thermals, touch usability or sustained real-device performance.
A keyboard input during the cinematic selected desktop control hints in the emulator.

## Screenshots (ignored; not committed)

All are actual Studio MCP viewport captures, not mockups. Files are local to
this checkout under `build/`; the PR does not include images.

- `campaign-menu.jpg`: archive, Practice first, M1 highlighted, M2–6 visibly locked.
- `campaign-practice-results.jpg`: accomplished; three exercises checked; 5,150/S.
- `campaign-flyoff-friendlies.jpg`: fly-off side view, carrier behind jet,
  four FRND labels, four blue radar crosses, TIME 10:00 and LOW ALTITUDE warning.
- `campaign-bomber-formation.jpg`: several bombers in two-row formation at 727
  altitude; selected bomber LOCKED at very close range; distant island visible.
- `campaign-radar.jpg`: normal sortie at 5/6 kills, banking close to remaining
  target; radar visible. The clearer friendly radar evidence is the fly-off image.
- `campaign-m01-results.jpg`: 600/B, BOMBER ×6 / 600, air 6, ground 0, 01:02,
  24 missiles and 100% accuracy, correct story debrief, no Next M2.
- `campaign-phone-flyoff.jpg`: Galaxy A16-sized 1336×616 viewport just after
  control, TIME 09:59, blue friendly crosses, LOW ALTITUDE warning.

- `campaign-escape-results.jpg`: actual failed screen with “The bombers got through.”,
  0/D and Retry sortie / Main menu.
- `campaign-phone-city.jpg`: hold-fire formation over the terraced island/city
  corridor, blue radar crosses, no kills, TIME 07:49.

## Problems and limits

- Two failing required Jest tests, detailed above. Correct their fixtures/role
  assumptions and rerun before release; do not suppress the failures.
- Fly-off camera is on starboard rather than requested port. Handoff smoothness
  still needs continuous visual observation.
- Best score is persisted and visible in results but absent from the reopened
  briefing; rank and best time are shown.
- Fly-off immediately shows LOW ALTITUDE at authored 90-stud height. It is
  distracting during gated controls. No launch collision or hull damage observed.
- The city/route screenshot exposes very pronounced regular terracing across the
  island. This remains a conspicuous visual limitation despite the passing build budget.
- The pilot repeatedly closes to almost overlap bombers (one screenshot LOCKED
  at 5 m); this is pilot behavior, not a representative human flight-quality test.
- Formation screenshot shows low-detail/distant hazy terrain and brightly dotted
  dressing on the island. No exhaustive terrain/art inspection was performed.
- Studio emitted existing-plugin/Rojo connection warnings and asset 203785492
  type-mismatch errors. Attribution to game versus installed plugin not established.
  Zero missing world placements does not prove every texture/audio asset rendered.
- Audio was not listened to; no audible-output verdict. No reference-video
  comparison, real device, cloud save, artificial network delay or Player test.

## Release recommendation

**NO-GO** for going live at the measured head: the required Studio suite is red,
port-side fly-off camera and menu best-score checks fail, and remaining visual
handoff acceptance must be observed. The successful six-bomber sortie establishes
that the central objective and result ledger work in this local session; it does
not clear those release gates.

## Cleanup

Initial `pgrep -x RobloxStudio` returned no process. Jest launched PID 63755,
which exited automatically. Interactive verification launched PID 65020; both
Play sessions were stopped and the simulator API confirmed `samsung_galaxy_a16`
before restoration to `default`. PID 65020 ignored SIGTERM and was closed with
SIGKILL after Play stopped. Final `pgrep -x RobloxStudio` returned no process.
No Studio process started by this task remains. No Jest ran during interactive Play.
`git diff --check` and rerunnable verification-place construction passed.

## Human documentation payload (orchestrator applies; docs/human untouched)

- `README.md`: PR #130 verified at fc34a30 in unpublished Studio: optional Practice
  completes; M1 completed 6 bombers, 600/B in 62.47 s; M2–18 initially locked.
  Natural escape at 240.006 s showed the correct text. Emulator city 60.00 FPS,
  worst 21.61 ms, aggregate Stats peak 4591 MB. Studio gate red (741/743); no Player
  observation or live claim.
- `shipped.md`: no shipped/live entry from this verification PR; no merge/upload.
- `next.md`: fix the two stale integration assertions, port camera and missing
  briefing best score; rerun Studio gate; continuously inspect camera handoff;
  owner Player and real-phone acceptance remain next.
- `blockers.md`: hold release for two Jest failures and failed camera/score-display
  checks. Local world build 7.04–7.35 s; native terrain calls still 81.8–92.8 ms.
  Session-only save verified; cloud persistence/real-phone/audio remain unobserved.
- `decisions.md`: evidence only, no new policy/scale/rank decision. Retain distinction
  between session Studio, emulator desktop rendering and actual Player/device tests.
