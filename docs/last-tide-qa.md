# Last Tide exclusive-lease QA

This report records the final unpublished-Studio validation of the independent
Last Tide alternative. The tested package was built from `80f0e49`, plus the
single Mission 19 island fixture correction described below. Roblox Studio ran
the exact local `build/skybreak.rbxlx` package in an exclusive lease. Progress
was session-only because the place was unpublished.

## Automated and package validation

- Roblox Jest: 88/88 tests passed across 10 suites. The first run exposed the
  Mission 19 catalog fixture described below; the rebuilt package then passed.
- `bun run build`, `bun run build:place`, and `git diff --check` passed.
- The suite covers all mission and cinematic definitions, four-slot progression,
  v1/v2 migration, route/hold authority, the 600-second deadline, production
  phase spawn planning, mesh packaging, compact layout bounds, and engine
  instances.

Mission 19 originally had only three authored islands even though the catalog
contract requires at least four. One island at `(0, 1650)`, radius `380`, height
`72` was added to the carrier approach. No objective, target, phase, unlock, or
combat value changed. The correction was rebuilt and exercised in the live
Mission 19 run.

## Sequential campaign run

The QA pilot was installed as a normal client `LocalScript` and drove the
existing `FlightController`: steering, throttle, targeting, missiles, and evade.
It never changed health, target positions, target health, damage, kills, timer,
objective progress, unlocks, persistence, or results. Each launch used the real
campaign UI. All times below came from the authoritative result report.

| Mission | Time (s) | Air | Ground | Health | Notes |
| ---: | ---: | ---: | ---: | ---: | --- |
| 01 | 34.543 | 3 | 1 | 100 | All tutorial gates, radar, then three bandits |
| 02 | 43.316 | 4 | 5 | 100 | Retry win; five optional raiders observed in ace phase |
| 03 | 84.465 | 4 | 0 | 100 | Ordered route then air phase |
| 04 | 31.037 | 2 | 3 | 100 | Naval strike then CAP |
| 05 | 69.181 | 3 | 0 | 100 | Route, 25-second hold, rear guard |
| 06 | 27.182 | 3 | 4 | 100 | Ground strike then scramble |
| 07 | 41.485 | 7 | 0 | 100 | Escorts and ace |
| 08 | 17.334 | 0 | 4 | 100 | Four relays; six optional pursuers verified live |
| 09 | 63.931 | 6 | 0 | 100 | Rendezvous, pursuit, ace |
| 10 | 26.649 | 4 | 3 | 100 | SAM strike and responders |
| 11 | 52.431 | 0 | 4 | 100 | 35-second survival then corvettes |
| 12 | 50.148 | 2 | 6 | 100 | Drydocks and two yard aces |
| 13 | 63.681 | 0 | 0 | 100 | Route and 40-second hold |
| 14 | 80.698 | 3 | 5 | 100 | Route, convoy strike, escort fight |
| 15 | 42.949 | 7 | 0 | 100 | Night fighter wave and ace |
| 16 | 67.348 | 5 | 5 | 100 | Mixed defenses, CAP, ace |
| 17 | 31.182 | 2 | 0 | 100 | Two sequential aces |
| 18 | 83.816 | 0 | 8 | 100 | 35-second survival then eight targets |
| 19 | 88.747 | 4 | 5 | 100 | Corrected four-island carrier approach |
| 20 | 61.029 | 1 | 6 | 100 | Six defenses and ace |
| 21 | 79.198 | 7 | 0 | 100 | Decoy route and seven-aircraft rush |
| 22 | 37.451 | 1 | 4 | 100 | Batteries and flight lord |
| 23 | 60.698 | 0 | 0 | 100 | Route and 30-second convoy-mask hold |
| 24 | 50.699 | 2 | 5 | 100 | Supply points and escort aces |
| 25 | 98.299 | 3 | 8 | 100 | Blind-quarter route and carrier strike |
| 26 | 71.148 | 0 | 6 | 100 | 40-second survival then line strike |
| 27 | 86.081 | 7 | 4 | 100 | Fighters, flag defenses, three aces |

Every successful report had `ResultValid=true`. Mission cleanup repeatedly left
zero children under `Workspace.SkybreakCombat` and rebuilt the menu world. The
final slot showed 27/27 complete; all 27 selector buttons were active and
interactable. Mission 23 was selected from the scrolled grid and replayed from
its completed-file briefing.

## Failure, retry, optional objectives, and story

Mission 2 was first flown in `SurvivalOnly` mode with no firing or evade. It
failed at 600.005 seconds with reason `timeout`, health 100, and zero kills. The
recap displayed `TIME EXPIRED` and `10:00`; Mission 3 stayed locked; combat
objects were cleared and the menu world returned. The visible Retry action then
launched the 43.316-second successful run.

Mission 8's first ground phase contained exactly four enabled relays and six
optional aircraft named `RAIDER 01` through `RAIDER 06`, with zero required air
targets. Destroying the four relays advanced the mission while the optional
pursuers remained irrelevant to objective progress. This exercises the corrected
production spawn-planning path rather than a catalog-only assertion.

The opening, all 26 between-mission transitions, and the four-beat finale were
rendered in the live place. Transitions had three story beats. Camera framing,
speaker/location captions, subtitles, progress, skip, reduced-motion mode, and
cleanup were inspected; Missions 1 and 2 were replayed after the sequential run
to close their direct-capture gap.

## Compact cinematic and mobile-balance checks

Live device-simulator measurements for the compact cinematic were:

| Root | Title | Speaker | Subtitle | Actions | Result |
| --- | --- | --- | --- | --- | --- |
| 568×320 | y 19–46 | y 192–208 | y 214–250 | y 258–302, 44 px | Fits; no overlap |
| 750×323 | y 19–46 | y 194–210 | y 216–253 | y 261–305, 44 px | Fits; no overlap |
| 320×240 | y 19–38 | y 110–126 | y 132–176 | y 184–228, 44 px | Fits; no overlap |
| 374×608 portrait | y 19–68 | y 424–440 | y 446–544 | y 552–596, 44 px | Fits; no overlap |

Both action buttons were horizontally disjoint and remained inside the root in
every size. This is Studio device-simulator evidence, not physical phone hardware.

For the requested touch-accessible difficulty probe, Mission 23 was replayed
with the pilot's automatic evade calls disabled while normal steering and fire
remained permitted. It completed the five-gate route and 30-second hold in
60.648 seconds at 100 health, with zero kills, zero missile commands, and zero
evade commands. Steering alone was practical in this desktop input-subset run.
It validates the shared flight handler under that input restriction, not touch
precision, handset performance, or real thumb ergonomics.

## Evidence and limitations

Ignored local evidence lives under `build/qa/`,
`build/screenshots/last-tide-qa/`, and `build/videos/`. The native 60-second
Mission 2 timeout sample decoded to visible gameplay in Quick Look and was not
black. Raw passing Jest output and results are retained locally.

This run did not test a published DataStore, physical phone/tablet, physical
console controller, or device thermal/performance behavior. The pilot's route
and evasion were efficient enough that it took no hull damage, so this is not a
hull-destroy defeat test. Hold/defense phases are intentionally elapsed survival
encounters with pursuers; they do not model damage to a protected object. Studio
logged unrelated asset-type/plugin messages and one QA-script readiness timeout
during setup; authoritative mission reports and the final 88/88 Jest run were
unaffected.
