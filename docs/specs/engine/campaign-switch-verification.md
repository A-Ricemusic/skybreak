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

---

# Final verification — head 375623be6ae7e760e2dd458de8382ce9078cd846

Measured 2026-10-29 on macOS, Roblox Studio 0.745.0.7451137 and Bun 1.3.14.
This section supersedes the older-head recommendation only for the exact head
above. PR #130 was OPEN and still pointed to that SHA when inspected. This was
unpublished Studio Play with one server and one client, using fresh session file
1. No Player test, cloud-save test, real-phone test, upload or merge was performed.
No game source or human docs were edited. Verification documentation is the only
change proposed against main.

## Required automated gate

`bun install --frozen-lockfile`, `bun run build`, `bun run build:place`: PASS.
Packaged voice check: eight scripts matched; audible playback was not tested.

`bun run test:roblox`: **749 passed, 1 failed, 750 total; 73 passed suites,
1 failed suite, 74 total**. Exit 1, 130.683 s. One cold run. AircraftCollision's
terrain/ocean sweep passed; the conditional flaky rerun was not needed.

Every failure (one): `CountdownFlyoff.spec` → `opt-in mission countdown and launch
stage` → `keeps the intro camera on port and rotates its offset with heading`.
`expect(FlightMath.ForwardOf(north)).toEqual([0, 0, -1])` rejects the received
`[-0, -0, -1]`; compiled `ServerStorage.Tests.CountdownFlyoff.spec:209`.
The test stops at this first assertion, before its camera-side assertions. This
appears to be a signed-zero equality issue; it remains a real required-gate
failure and was not changed or suppressed. Campaign and BomberDirector suites
passed at this head, clearing the older report's two failing tests.

Raw ignored evidence: `build/jest-results.json`, `build/jest-output.log`,
`build/campaign-final-jest-run1.log`, `build/campaign-studio.log` and
`build/final-console-evidence.json`. Some initial tool exports hit the MCP
100,000-character limit and are incomplete; do not use those truncated exports
as complete evidence. The console log and concise observer summaries are the
usable records.

## Method and scope

Read the complete handoff including Round 2, the previous verification report,
the three files under `tools/verification/`, and `tools/playtest-relay.client.luau`.
Initial `pgrep -x RobloxStudio` returned no process. Fetched the requested branch
and checked out the exact detached commit before installing/building/testing.
Jest's Studio exited before interactive verification began.

Built `build/campaign-verification.rbxlx` using the unchanged existing harness.
The pilot uses normal flight-controller inputs, target cycling, missiles and
evades; it does not reposition aircraft, edit health, award kills or force
results. Menu and sortie launches used UI input. The forged M2 request was the
explicit requested refusal test. The separate hold-fire run only sets the
existing QAPilot `HoldFire` attribute. Existing read-only frame and mission
observers remained installed. A temporary, uncommitted LocalScript additionally
sampled live warning text, warning-sound object, camera and jet position during
the first eight seconds. Server read-only roster snapshots captured opening
positions and route progression. None of these observers alters game state.

An MCP-context `require(FlightController).GetActive()` initially returned nil
while the actual pilot was flying. That attempted extra observer produced no
frames; it was not treated as evidence. The ordinary LocalScript observer in
the second Play session produced 479 frames and the existing harness worked.

Unpublished GameId 0 explicitly reports SESSION-ONLY persistence and makes no
DataStore requests. Reload means returning to file selection and reopening the
same session file, then inspecting ListSlots and the rendered briefing. It does
not mean a new server or cloud rejoin.

## Check matrix

PASS is limited to the evidence described. NOT OBSERVED is not a pass.

| Required check | Status | Observed evidence |
|---|---|---|
| Practice first; M1–18 present | PASS | Act I screenshot: Practice then M1–6; Act II queried M7–12; Act III queried M13–18. |
| M1 launchable; M2–18 locked | PASS | M1 launched twice; all 17 later mission buttons had Active=false. |
| Forged M2 remote refused | PASS | StartMission(slot=1,missionId=2) returned ok=false, “Mission 02 is locked or in development.” |
| Practice three exercises | PASS | Result checked short turn/pitch, cycle training target, lock/hit training radar; three completed phases. |
| Practice completion independent of M1 | PASS | Practice 8.084133 s, 5,150/S, one radar kill, zero air kills; M1 still NEW SORTIE and launchable; later save retained separate records 0 and 1. |
| Practice no enemies | NOT OBSERVED | No hostile contacts seen in the captured practice results, but the first manual server inspection preceded mission startup. Continuous hostile-count sampling was not performed in that sortie. |
| ~3 s locked fly-off and gated controls | PASS | Started→FlightControl 2.974887 s desktop / 2.961299 s A16; jet held x=24.5155,y=90 and flew north at 180 until handoff despite normal pilot inputs. |
| Camera on port/left | PASS | Runtime camera x=-55.4845, aircraft x=24.5155: -80 studs. Jet moved toward decreasing Z (north), so west/-X is its left/port, east/+X its right/starboard. |
| No LOW ALTITUDE, PULL UP, terrain/boundary text in locked intro | PASS | All 178 locked-intro rendered samples contained only TIME 10:00 among the monitored warning/time strings; warningsEnabled=false. |
| No warning tone in locked intro | NOT OBSERVED | Warning-sound object absent in all 178 samples. No audible listening test was performed; this establishes no sampled warning emitter, not audible-output acceptance. |
| Warnings restore after handoff | PASS | warningsEnabled=true and LOW ALTITUDE appeared with TIME 10:00/09:59 immediately after control, then disappeared while climbing. |
| No visible backward jump at handoff | NOT OBSERVED | Numeric 479-frame observer: minimum forward jet delta 0, camera delta +0.69043 studs; no backward sample. Continuous visual handoff was not reviewed. |
| Countdown starts at control from 10:00 | PASS | Locked samples all TIME 10:00; handoff then TIME 09:59, 09:58 etc. |
| Six bombers ~2,600 studs ahead | PASS | Opening roster had six required HEAVY BOMBER models at y=727; center (0,727,8200) vs player (24.5155,90,10828), 2,628-stud forward gap, ~2,704 center distance. |
| Bomber route over city then airbase | PASS | Server samples: first bomber (1139.67,727,491.00) at +130.81 s in the city reservation, then (-1433.23,727,-3094.89) at +203.78 s in the airbase reservation; six intact bombers tracked throughout. Timings are from opening roster, ~3.5 s before control. |
| Two escorts initially with formation | PASS | Opening ESCORT 7 at (-297.572,817,8161.911), ESCORT 8 at (-59.514,817,8192.382), beside the six-bomber formation. |
| Escort + ASH WARRANT around 150 s | PASS | Opening escorts were gone by +50.28 s; ESCORT 10 and ASH WARRANT first captured together +153.5446 s after opening roster, ~150.04 s after control. |
| Four LANTERN friendly presentations | NOT OBSERVED | Four opening models LANTERN 1–4 had friendly=true, enemy=false, Damageable=false. City screenshot shows blue radar + symbols; queried a blue FRND label with disabled UIStroke. Full four-label/no-box rendered presentation was not captured together. |
| Complete on last bomber death | PASS | Real server result Completed with six bomber kills and one completed phase; normal pilot fired missiles; optional kills 0. |
| Results points, type list, rank | PASS | Screenshot: 600 points, B, BOMBER ×6 / 600; air 6, ground 0, 00:48, 27 missiles, 89% accuracy. |
| Menu CLEARED, rank and BEST points | PASS | Reopened briefing visibly “CLEARED · RANK B · BEST 600 PTS · 00:48”. |
| Session reload retains best/breakdown | PASS | Back to file selection and reopen file 1: same briefing; ListSlots mission 1 bestScore=600,bestRank=B,bestTargetScore total=600,kills.bomber=6,points.bomber=600. |
| Natural escape and correct text/timing | PASS | Failed / bombers_escaped at 240.008232 s, zero shots/kills; screenshot reads “The bombers got through.” No timer/health/outcome edits. |
| Mid-range phone emulator city FPS/memory | PASS | A16 preset; 10.001751 s near city: 59.98950 FPS, worst 22.14450 ms, peak aggregate Stats 4682.90332 MB. Desktop Studio renderer/memory, not a real phone test. |

## Results and timing

Practice: **Completed, 8.08413283333357 s, 5,150/S**, one training-radar kill,
zero air kills, three phases, one missile/hit, 100% hull, no damage or evade.

M1 normal-pilot run: **Completed, 48.39859454166435 s, 600/B**.
Target breakdown: `kills.bomber=6`, `points.bomber=600`, `total=600`.
No escort/ace/ground kills. 27 actual missiles, 24 hits, 100% lowest hull,
zero damage, one evade. Pilot command count 38 differs from actual fired count
27; reported results use the authoritative 27. Return to menu / Replay M1 were
the offered actions, with no Next M2. Session save acknowledged saved=true.

Desktop world build **7.757743 s**, terrain ready **7.190379 s**, planner
**1.192264 s**, longest planning slice **6.169 ms**, longest terrain call
**118.109 ms**, 27,494 terrain jobs and zero missing placements.
Loading receipt→control **3.475512 s**; excludes world build/request overhead.
Started→control **2.974887 s**.

A16 world build **7.347526 s**, terrain ready **6.816118 s**, planner
**1.316744 s**, longest planning slice **6.685 ms**, longest terrain call
**74.067 ms**, 27,494 terrain jobs and zero missing placements.
Loading receipt→control **3.494850 s**, Started→control **2.961299 s**.

Warning observer: 479 rendered samples over eight seconds, 178 locked-intro
samples, last locked sample at +2.944938 s, first controlled sample at
+3.013039 s. No sampled backward movement of aircraft or camera. These are
sampled values, not a continuous visual or audio guarantee.

City sample began at (1291.752,727,2441.012), within 2,200 horizontal studs
of city center (1280,256). The production pilot/controller and formation remained
active. No camera repositioning, concurrent compilation or Jest. FPS and aggregate
Stats memory include desktop Studio overhead; they do not measure mobile GPU,
capacity, thermals or sustained real-device performance.

Hold-fire run: **Failed / bombers_escaped at 240.0082318749919 s**, **0/D**,
zero kills/shots/phases, 100% lowest hull, no damage, five evades; saved=true,
persistence=session. All six bombers traversed the city then airbase and reached
the north-coast escape. A brief retry was launched solely for the intro capture
and stopped without completion.

## Screenshots and visual limitations

Screenshots are ignored under `build/`, never committed. All are actual Studio
viewport captures. The main menu and normal sortie captures are 1920×836;
A16 captures are 1336×616. A16's live Camera.ViewportSize was 685×338; preset
configuration 780×360, ResolutionScale 3, 385 DPI. LandscapeSensor game;
StarterGui initially empty because UI is runtime-created.

- `final-menu.jpg`: Practice first, M1 NEXT, M2–6 LOCKED, three act tabs.
- `final-practice-results.jpg`: three exercises checked, 5,150/S, 00:08.
- `final-bomber-formation.jpg`: three surviving bombers ahead at 3/6, visible
  target boxes, island ahead; this is a combat still, not the opening roster.
- `final-port-intro.jpg`: locked fly-off at TIME 10:00, no warning text;
  carrier dominates the view and a jet sits near the upper-left edge. Runtime
  coordinates establish port; this still does not establish good jet framing.
- `final-escape-results.jpg`: “The bombers got through.”, 0/D, Retry/Main menu.
- `final-phone-city-radar.jpg`: six-bomber hold-fire sortie, blue radar + friendlies,
  target boxes on enemies; terraced island beneath.
- `final-m01-results.jpg`: 600/B, BOMBER ×6 / 600, 00:48, 27 missiles, 89%.
- `final-menu-after-win.jpg`: CLEARED · RANK B · BEST 600 PTS · 00:48.

The earlier capture attempt during the A16 cinematic missed the intended skip
click; move→wait→hold/release succeeded. No claim of touch-usability acceptance.
An initial intro still caught the carrier-view transition rather than a useful
side view. Neither attempt is being represented as completed camera QA.

Additional visible concerns: the retry intro capture is carrier-heavy and the
jet is close to the upper-left edge; inspect centering through the complete shot.
The island still has pronounced regular terracing. The pilot follows bombers at
very close distances; that does not establish human handling quality. Studio
logged asset 203785492 type-mismatch errors, installed weather-plugin asset loads,
and Rojo connection refusals; game-versus-plugin attribution was not established.
No exhaustive asset, terrain, touch-control or audio quality review was performed.

## Cleanup

Jest launched PID 74539 and exited automatically. `open -a` attempt PID 74767
connected without opening the place, and a help probe PID 74822 likewise had no
place; both owned processes were terminated before direct local-place launch
PID 74829. Two Play sessions in that local-place process: normal session
(Practice + M1), then a fresh A16 session (hold-fire M1 plus a short retry). All Play stopped before closing. Simulator StopSimulationAsync returned
active=default. PID 74829 remained after SIGTERM and was closed with SIGKILL.
Final `pgrep -x RobloxStudio` returned no process. No Roblox Jest ran while
interactive Studio was open. No assets or places were uploaded.

## Release recommendation and human-doc payload

**NO-GO**: required Roblox Jest is red (signed-zero camera regression assertion).
Continuous visual handoff and audible no-warning acceptance remain unobserved;
full four-friendly rendered presentation and continuous practice enemy-count
observation are also incomplete. Intro framing needs inspection.
The runtime port camera and session best-score/breakdown regressions are cleared
by the observations above; a passing offline or numeric camera check does not
make the required Studio suite green.

Human docs payload (orchestrator applies; `docs/human/` untouched):
- README: #130 verified at 375623b in unpublished Studio; 749/750 Jest, NO-GO;
  Practice completed; M1 600/B, six bombers, 48.399 s; session menu best/breakdown
  now verified; natural escape 240.008 s; A16 city 59.99 FPS / 4682.90 MB
  aggregate Studio peak, not a real phone. No Player/live claim.
- shipped: no shipped/live entry; no merge or upload by verifier.
- next: fix signed-zero Jest assertion; rerun required gate; finish visual/audio
  acceptance, practice hostile-count and four-friendly presentation checks, then
  owner Player and real-device testing.
- blockers: required Studio gate remains red; camera side and best-score display
  work at this head. Cloud save, audible output and continuous handoff unobserved.
- decisions: evidence only; no new design/rank/route decision.
