# SKYBREAK: Broken Relay — independent campaign alternative

Status: **all27 missions and28 story chapters completed in genuine Studio QA** at1a48ee6. Final presentation source0fc0b3d passes171 actual Roblox Jest tests; see [the exact build/evidence report](broken-relay-qa.md). This branch is an independent alternative for comparison. It must not be merged without parent-coordinated review and playtesting.

## Architecture and story

A lone trainee follows missing mentor Teal's recordings from Varda Rim, through upland farms and relay arrays, to the coastal parliament. The recordings expose forged emergency orders and Air Marshal Rusk's coup. Sera at Varda Control is Teal's oldest friend and the one command made say 'deserter' on the net; the trainee answers in their own voice at the end of every chapter and the campaign ends on their broadcast. The coup's voice is anonymous intercepts until the aurora archive names Rusk (chapter 17); the Teklan orchard that sheltered Teal's tape burns in reprisal (chapter 15); Vulture Two, Teal's own instructor, confesses after ejecting (chapter 18); Teal's last recording plays in full and the record is amended on screen in chapter 25. Chapters have three to eight beats. All dialogue is original and subtitled; no licensed media, external account, upload ID, API key, or paid asset is required.

One place, one player, one active disposable mission folder. `MissionCatalog` owns ordered phase data; `MissionLayouts` owns 27 authored compositions. The first two missions retain their original tutorial/warehouse/ace rules and geometry. `BlueprintRunner` handles missions 3–27 as a pure server domain model. `CombatService` alone observes the authoritative aircraft, creates targets and projectiles, applies damage, changes phases and issues results. The client sends bounded flight controls and button events only.

Beyond air combat and staged strikes, the campaign includes ordered swept flight gates, altitude-limited reconnaissance, signal orbits, moving convoy escorts and fixed-site defense. Scans and signal time accrue only inside authored volumes. Escort movement advances while the player stays near it; nearby hostile aircraft suppress the protected objective at 0.55 health per second per raider on Normal (×0.75 Easy, ×1.25 Ace; lit hazard guns count 1.5 each). Escorted and defended actors are grounded from their own bounding box and a raycast against the mission's flight-solid surfaces and terrain: trucks ride the road, towers stand on their pad, launches float at the waterline (or sit on a beach). Losing the protected objective fails the sortie. The finale requires a real 60-second broadcast after the Marshal is down. Destruction counts alone cannot complete the newer missions.

Each phase enables only its allocated ground targets. Optional pursuers retire when their window ends: they break off and fly for the boundary for 4 s, untargetable and silent, and any missile chasing one is refunded; dead enemies are compacted out at every phase change. Bandits and raiders carry per-sortie call signs (BANDIT 07, RAIDER 03). Setup and static mesh generation happen before the gameplay clock (`GameConfig.Campaign.MissionTimeLimit`, 900 s) starts; the server pre-builds the enemy Vanta mesh at start-up so no Heartbeat step yields on it, and every session step runs under a `StepGuard` (one warning, then the sortie fails with reason `internal_error` instead of throwing every frame; a step suspended in a yield is never re-entered). CombatAction `Pause`/`Resume` freezes the single-player sortie on the server and moves the clock's start by the paused span, capped at 5 minutes per sortie. Completion, failure, retry and return dispose the mission folder and restore the menu. The single-player guard prevents overlapping worlds.

`RelayStory` authors 28 chapters: opening, 26 bridges and finale, each three to eight beats with a shot and mood per beat/chapter. Mission briefings carry the instructions; story lines never do. The React cinematic renderer builds a local stage with Teal's receiver, map/evidence, aircraft, replicated Blender prop and region scenery. It cuts between the shot cameras in `CinematicStaging` with timed subtitles. The story is told without sound, so the stage carries it: the flight chart prints the chapter's document (`StoryDocuments`: the grain manifest, the struck roster, the governor's death certificate, ORDER 0001 signed RUSK, the amended record card) and the `evidence` shot frames it legibly at phone width; the coffee tin loses one cassette for every chapter Teal has spoken in; farm scenes are charred from chapter 15; the recorder comes home dented and open with a steady lamp in chapter 25; night relay chapters hang an aurora over the crown station; Sera's board carries Teal's name strip except during chapter 9 until the chapter's last beat. Teal's tapes, the recorder/log and every black card type out over the first 40 % of their beat (instant with camera motion off); the Marshal's cards carry a faint red vignette. Mood lighting drives Lighting, the Atmosphere and a local Terrain cloud deck (grey for storms, off at night so stars and aurora show).

Cutscene visual pass (2026-10-25, Studio Play on `build/skybreak.rbxlx`, 1205x536 viewport, plus 844x390 and 390x844 roots mounted at their real pixel sizes): the wide shot used to sit 200 studs out over empty floor; the sky shot showed hangar walls and tail fins; the recorder filled the frame as an anonymous metal box; the chart was a blown-out white slab; the dawn clock still showed stars; storms rendered a blue sky; night was a lamp pool in black; the story subject stood dead centre behind the chair; black cards left a strip of sky above the top bar; the "click for next" hint crowded the speaker chip at phone widths. All are fixed in `CinematicStaging`/`RelayCinematic`; captures live in `build/cutscene-pass/` (gitignored). Gamepad A activates the selected control, including Skip; touch Skip and unconsumed Space without GUI focus also skip. Consumed inputs are ignored; P/gamepad X pauses and gamepad B cancels; motion and subtitle-size buttons support accessibility. Compact cinematics reserve at least44px of scene, retain44px actions and scroll explicitly measured subtitles. Bearing/distance/altitude/protected-health guidance remains in the objective row when a floating caption cannot fit. Completion/cancel/unmount disconnects listeners and destroys the stage. Preflight story plays before the server creates the mission, so it uses none of the flight deadline. A reprise plays on replay; skipping does not grant progression. The final chapter plays automatically on M27 success.

The archive has three acts with all 27 mission rows, locked states, per-mission best times and replay. Briefings use scrollable text; debriefs describe the actual mission's consequence. Next and retry return to that mission's briefing, allowing a fresh launch or archive selection.

## Four-slot saves

The existing `SkybreakCampaign_v1` DataStore name and player keys are retained. Schema v3 adds per-mission records and derives unlocks from the contiguous chain of completions. Existing v2 M1/M2 flags and fastest times migrate into records 1/2; a completed two-mission slot resumes at M3, with the remaining 25 locked. V1 completion migrates to M1 only. Replays preserve completions and minimum times; profile writes merge monotonically and keep the existing delayed-write/recovery behavior. No client-supplied current-mission field unlocks a sortie. Unpublished Studio uses clearly labeled session saves; live cloud persistence needs a published experience.

## Mission manifest

`⇢ *twist*` marks a mid-phase objective change (`MissionPhaseBlueprint.twist`): when the active phase's progress fraction crosses `at`, a radio call plays and the listed phases are spliced in right after it. Mode `now` ends the current phase on the spot (an interrupted scan, a rerouted convoy, a jammed archive); the default `after` lets it finish first (reinforcements announced mid-strike, a recovery to cover after the ace falls). Twists always fire before their host phase can complete, so `MissionCatalog.ExpandedPhases` is the authoritative flow for kill totals, par, save-proof phase counts and the debrief.

Round 2 phase fields (all validated at catalog load):

| Field | On | Effect |
|---|---|---|
| `groups`, `stagger`, `flank` | `required_air` | `count` splits into `groups` (larger first, `WavePlan.Groups`). The next group arrives `stagger` seconds (default 18) after the last one, or as soon as half the last group is down. With `flank`, later groups come from the rear quarter. |
| `reinforce: [{ at, count }]` | any phase with raiders | Raider waves that arrive when the phase fraction crosses each `at` (kills for strikes, seconds for holds). Their sum fits in `optionalRaiders`; the remainder arrives at phase start (`MissionCatalog.InitialRaiders`). |
| `hazard: { at, count, effect, text }` | `signal` (`jam`), `escort`/`defend` (`guns`) | The next `count` ground targets stay hidden until the phase fraction reaches `at`, then light up with a radio call. They are required ground kills. Live jammers freeze the signal timer; live guns drain the protected actor like 1.5 raiders each. The phase cannot finish while any is alive. |
| `kind: "chase"`, `escape`, `seconds` | courier | One fast (275 studs/s, faster than cruise, slower than full throttle) non-firing 160-hull target runs for `escape`; the sortie fails with reason `escaped` after `seconds`. Its `Fraction` (for chatter) is the escape clock. |
| `directed` | any combat phase | A radar is directing the flight: the hostile fire gate is halved while the phase lasts. |
| `hidden` | `required_ground` | Its targets stay invisible and unqueryable until the phase begins (M8's spotters, M10's camp radar). |
| `aceReturns` | mission with an ace | Two radio lines, said when the ace turns back in after each retreat (the two `aceStages` lines are said as it breaks off). |

Ground targets are consumed in phase order by strikes and hazards (`MissionCatalog.GroundStart`); `HiddenGround` lists the ones that start invisible. Holds (escort and defend) run 90–150 s; signal holds 90 s, except the interrupted M17 orbit (90 s, cut at half, then a 50 s resume) and the M27 closing broadcast (60 s, after a three-stage ace fight).

Times below: par is a good human run (`MissionScore.ParSeconds`, about 1.3× the scripted QA pilot under the new tuning); the average phone pilot estimate uses 15 / 20 / 24 s per required bandit by act, 10 s per ground target, 10–13 s per beacon, holds ×1.05 (escort/defend) or ×1.25 (signal, drift while fighting) plus 10 s on station, 0.36 s per ace hull point and 4 s per phase change. These are design estimates; the coordinator's live runs replace them.

| # | Mission / composition | Required phase sequence |
|---|---|---|
| 1 | FIRST FLIGHT — Varda training islands | Turn and pitch for three seconds each → Cycle to the training target → Lock and fire a missile at the training radar → Intercept three bandits |
| 2 | IRON COAST — Iron Coast five quays | Intercept the three-bandit screen → Destroy five warehouses → Destroy the ace (165 hull, 3 stages) |
| 3 | FOX TRAIL — Fox switchback | Follow Teal's beacons → Clear scout flight alpha (3 in 2 groups) → Teal's river run: stay under 320 → Clear scout flight bravo (4 in 2 groups) |
| 4 | STATIC QUARTERS — Hidden quarters bowl | Scan the quarters: stay under 380 → Destroy the hidden rim radar → Fend off the response flight (5 in 2 groups) |
| 5 | ORCHARD LINE — Teklan orchard terraces | Cover the orchard evacuation trucks (110 s) → Drive off the patrol leads |
| 6 | GRAIN SHADOW — Grain valley irrigation | Follow the farm irrigation channel → Mark the silos, spare the roofs: stay under 400 → Destroy three fuel silos → Clear the orchard patrol (5 in 2 groups) |
| 7 | DUST WEATHER — Dust courier narrows | Run the dust pass under 400 → Strip the courier's escort (5 in 2 groups) → Catch the courier before the plateau (escapes after 90 s) |
| 8 | RIM SWITCH — Varda tower siege | Protect Varda's control tower (120 s) → Counter-attack the spotter radars → Catch the retreating flight |
| 9 | STATIC HORIZON — Vulture moonlit bowl | Follow the night approach lights → Clear the night patrol (4 in 2 groups) → Defeat Vulture Lead (300 hull, 3 stages) |
| 10 | PLATEAU COLD — Kiro abandoned mine | Follow the mine road up to Kiro → Scan Node Kiro (hold fire) ⇢ *twist* Break the camp's intercept (4 in 2 groups) → Finish the archive scan → Cut Node Kiro's transmitter ⇢ *twist* Kill the camp radar (directed) → Intercept the blind response |
| 11 | SIGNAL HARVEST — Twin ridge relay saddle | Destroy relay Node Lira → Clear the alert flight → Destroy relay Node Merel ⇢ *twist* Follow the farm road north to Sable → Destroy relay Node Sable → Clear Sable's guard flight → Orbit the west ridge to relay Teal's packet (90 s) |
| 12 | OPEN FIELD — Open field refugee corridor | Escort the loyalist transmitter truck (90 s) ⇢ *twist* Cover the reroute along the mill road (100 s) → Occupy the orchard airspace (6 in 2 groups) |
| 13 | STAGING FARM — Staging farm rail yard | Follow the rail spur to the staging farm → Scan the staging farm low → Destroy four fuel silos ⇢ *twist* Break the plateau reinforcements (4 in 2 groups) → Destroy the farm relay → Hold off the raiders |
| 14 | ANTENNA ROW — High relay crossing | Cross the relay saddle through four beacons → Destroy three plateau antennas ⇢ *twist* Destroy the mobile mast → Clear the perimeter CAP (4 in 2 groups) → Hold the saddle: confirm the row is dark (90 s) |
| 15 | LOYALIST WINDOW — Loyalist broadcast common | Hold the broadcast link (90 s; 2 jammers freeze it) → Hold the second intruders (7 in 2 groups) |
| 16 | STORM WALK — Storm river divide | River gates: stay under 400 → Destroy three remaining silos ⇢ *twist* Catch the storm patrol (5 in 2 groups) → Destroy the forward relay → Hold over the dead relay: read its last traffic (90 s) |
| 17 | AURORA RELAY — Aurora crown array | Destroy the plateau relay → Clear the aurora intercept (4 in 2 groups) → Orbit to receive the archive (90 s) ⇢ *twist* Find the jammer under the array → Destroy the aurora jammer → Clear the jammer's escort → Resume the receive orbit (50 s) |
| 18 | RIDGE ACE — Vulture searchlight ridge | Climb into Vulture Two's searchlights → Clear his wingmen (4 in 2 groups) → Defeat Vulture Two (400 hull, 3 stages) ⇢ *twist* Protect the marines' pickup on the ridge (90 s) |
| 19 | HARBOR RUN — Military quays and canal | Scan the quays; spare the city → Destroy three harbor warehouses ⇢ *twist* Break the early CAP (4 in 2 groups) → Clear the harbor CAP (6 in 2 groups) |
| 20 | FRACTURE LINE — Eastern wing divided harbor | Shatter the eastern wing (9 in 3 groups) → Cover the evidence launch through the harbor (110 s; 2 bank guns) |
| 21 | CITY NIGHT — Black canal city | Follow the dark canal through the city → Destroy the broadcast relay → Hold off the escort flight (8 in 2 groups) → Hold over the dark tower: confirm silence (90 s) |
| 22 | HARBOR FOG — Five fog fuel piers | Find the depots through the fog → Destroy five fuel depots → Clear the fog patrol (6 in 3 groups, flanking) |
| 23 | OCEAN CLEAR — Frigate ring over deep water | Defend the command frigate (120 s) → Clear the platform command flight (6 in 2 groups, flanking) |
| 24 | PLATFORM FIRE — Storm platform trident | Low sea approach: under 360 → Destroy three platform warehouses → Clear the storm patrol (6 in 2 groups) → Stop the fuel tanker running for the coast (escapes after 90 s) |
| 25 | CITY DAWN — Dawn beachhead | Cover the landing craft to the beach (110 s) → Hold the first intercept (5 in 2 groups) → Hold the second intercept (5 in 2 groups, flanking) → Destroy the beach relay |
| 26 | FRACTURE LAST — Civic plaza blackout | Break the Marshal's wing (10 in 2 groups, flanking) → Triangulate the Marshal's last transmission (90 s) |
| 27 | BROKEN RELAY — Coastal parliament sunrise | Clear the Marshal's wingmen → Destroy the final broadcast relay ⇢ *twist* Break the Marshal's personal escort → Defeat the Air Marshal (500 hull, 3 stages) → Broadcast Teal's evidence to the whole coast (60 s) |

| # | Par | Average human (est.) | | # | Par | Average human (est.) | | # | Par | Average human (est.) |
|--:|--:|--:|---|--:|--:|--:|---|--:|--:|--:|
| 1 | 100 s | 2.1 min | | 10 | 230 s | 4.9 min | | 19 | 250 s | 5.9 min |
| 2 | 185 s | 3.2 min | | 11 | 305 s | 6.1 min | | 20 | 305 s | 6.6 min |
| 3 | 175 s | 3.7 min | | 12 | 275 s | 5.4 min | | 21 | 310 s | 6.8 min |
| 4 | 145 s | 3.0 min | | 13 | 235 s | 5.0 min | | 22 | 205 s | 4.6 min |
| 5 | 185 s | 3.4 min | | 14 | 290 s | 5.6 min | | 23 | 255 s | 5.2 min |
| 6 | 180 s | 3.6 min | | 15 | 250 s | 5.3 min | | 24 | 225 s | 5.0 min |
| 7 | 160 s | 3.4 min | | 16 | 295 s | 5.9 min | | 25 | 330 s | 7.1 min |
| 8 | 225 s | 4.0 min | | 17 | 295 s | 6.0 min | | 26 | 290 s | 6.6 min |
| 9 | 190 s | 3.9 min | | 18 | 320 s | 6.6 min | | 27 | 340 s | 7.9 min |

Campaign total for the average pilot: about 137 minutes of flying (it was about 41–65 minutes before round 2). Act I opens gently (M1 is the tutorial; M1–M4 fire on the gentle gate), Act II runs 5–6.5 minutes, Act III 4.5–8 minutes with the finale longest.

## Original Blender assets and performance bounds

`tools/build-relay-assets.py` reuses the project's canonical material and corner-normal export functions. It authors these original assets from primitives and evaluated meshes:

| Asset | Triangles | Material meshes | Bounds in studs |
|---|---:|---:|---|
| Communications relay mast | 828 | 5 | 44 × 90 × 44 |
| Fuel/grain silo | 960 | 6 | 42 × 72 × 42 |
| Utility/radio truck | 640 | 5 | 18 × 33 × 35.2 |
| Evidence harbor launch | 244 | 5 | 26 × 37 × 57 |

The generator and four exact runtime mesh JSON files are committed. Rebuild with Blender in background mode, then `bun run build`. Blender projects, GLB files and lit inspection PNGs remain regenerable local outputs. All four `.blend` files were reopened and GLBs round-tripped against exported bounds within 0.001 studs. The runtime follows the existing server-generated static-content path, preserves corner normals and material centers, and clones cached material meshes. Missing/malformed data fails explicitly. A platform mesh capability failure warns and produces a visible primitive fallback labeled `GeometrySource=Fallback`; that fallback is **not** a successful mesh QA result.

The authored mission budget is at most seven hostile aircraft up at once (largest staggered group plus every raider; Ace difficulty adds one raider per wave), eight player missiles in stock, a flight-wide hostile launch gate and threat cap, at most five required ground targets, and fewer than 400 scenery/target BaseParts. Scene/asset tests assert these bounds when run in Roblox. New flat land uses nine or fewer material slabs instead of filling millions of terrain voxels. Roads split below the engine's 2048-stud part limit. Legacy island worlds remain intact. One render listener exists per active cinematic or navigation cue, and both disconnect on unmount. Static geometry templates persist by asset kind; mission clones and cinematics do not accumulate.

These are design/definition bounds, not measured device FPS or memory figures. Physical phone/console performance and replication remain live QA items.

## Validation and Studio handoff

Completed offline:

- `bun run build` — all TypeScript/React Lua and Roblox Jest specs compile.
- `bun run build:place` — production Rojo package created without a Rojo server or Studio.
- `bun run test:offline` — 126 pure compiled-domain contracts pass in the official standalone Luau CLI. This includes all new mission sequences, all flight volumes using legal `FlightMath` stick/throttle, 27-step unlock/replay, four-slot migration, protected loss, deadline/replay failures, the final broadcast, cinematic A/GUI/consumed-input routing, the staging tables (moods, poses, typed lines, story-driven props) and the evidence documents. These are unit simulations, not gameplay evidence.
- Blender generation, preview inspection, `.blend` reopen and GLB bounds round-trip for all four new meshes.
- `git diff --check`.

The offline runner adapts compiled module imports to filesystem `require`, provides only minimal assertion functions, and constructs inert vector/camera values for the unused menu configuration. It does not emulate the engine, run Roblox Jest, or fake a mission result. Use the official [Luau releases](https://github.com/luau-lang/luau/releases) executable and set `LUAU_BIN=/absolute/path/to/luau`, or place it at `build/offline-luau/luau`. No binary is committed. The compiler must run before the offline runner; `test:offline` does that.

**Completed live:** actual engine Jest, sequential M1–M27, all28 rendered three-beat scenes/finale, protected-objective loss and visible Retry, successful no-evade escort replay, slot isolation/unlock/replay/teardown, and final compact/notched/portrait presentation checks. See [exact SHAs and scope](broken-relay-qa.md). A Rojo server was not used. Published cloud/rejoin and physical device/gamepad behavior remain unverified.

To repeat QA under a new parent-granted exclusive Studio lease:

1. Run `bun run test:roblox`; inspect the real Jest JSON/log. In addition to the campaign domain specs, `RelayWorld.spec` builds/disposes every mission and requires real Blender geometry, exact targets, safe anchored parts and bounded instances. Existing baseline suites remain included, with campaign expectations updated to v3/27 missions.
2. Open `build/skybreak.rbxlx` (one production place). Verify new meshes replicate with `GeometrySource=Blender`. Rebuild/restart any Rojo mapping only under the lease.
3. Use a fresh session slot. Install `tools/playtest-relay.client.luau` as a normal LocalScript. Launch each mission through the real menu and story. The persistent pilot computes only legal stick/throttle and invokes the normal controller target/missile/evade methods. It never moves an aircraft directly or alters health, timer, kills, objectives, or results. It completed all27 genuine sorties in the recorded run.
4. Inspect `PlayerScripts.BrokenRelayQA`: every attempt records server outcome, elapsed time, kills, ground kills, minimum health, protected health, phase sequence and input-command counts. Save genuine logs/screenshots. Require 27 actual Completed results and the finale; fix failures rather than changing success conditions for evidence.
5. Manually verify touch/keyboard/gamepad, 320×240 and phone portrait/landscape, story skip/pause/motion/text controls, failed escort, 900-second timeout, pause/resume (clock frozen, 5-minute cap), retry, locked remote rejection, completed-mission replay, four-slot isolation, migration fixtures, return cleanup and repeated launch/recap counts. Cloud persistence/rejoin requires a published test experience and cannot be proven with unpublished session slots.

## Remaining limitations

All27 objectives, asset replication and representative presentation/input paths were exercised in the engine. Minimum tested gameplay safe area is319×181/320×182; smaller usable roots are not claimed. The pilot proves feasibility with ordinary controls; it does not replace physical mobile/console balance testing. Protected damage is deliberately an analytic suppression model tied to nearby server-owned enemies; it is not a projectile collision simulation. Scenery uses readable native shapes and material colors, with no texture or voice-acting dependency. Descriptive briefing text is supplemented by the complete phase plan; the phase plan is authoritative when it adds a navigation/escort step to an older synopsis. Published DataStore and physical device validation remain outside offline scope.
