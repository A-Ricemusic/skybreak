# SKYBREAK: Broken Relay — independent campaign alternative

Status: **all27 missions and28 story chapters completed in genuine Studio QA** at1a48ee6. Final presentation source0fc0b3d passes171 actual Roblox Jest tests; see [the exact build/evidence report](broken-relay-qa.md). This branch is an independent alternative for comparison. It must not be merged without parent-coordinated review and playtesting.

## Architecture and story

A lone trainee follows missing mentor Teal's recordings from Varda Rim, through upland farms and relay arrays, to the coastal parliament. The recordings expose forged emergency orders and Air Marshal Rusk's coup. Sera at Varda Control is Teal's oldest friend and the one command made say 'deserter' on the net; the trainee answers in their own voice at the end of every chapter and the campaign ends on their broadcast. The coup's voice is anonymous intercepts until the aurora archive names Rusk (chapter 17); the Teklan orchard that sheltered Teal's tape burns in reprisal (chapter 15); Vulture Two, Teal's own instructor, confesses after ejecting (chapter 18); Teal's last recording plays in full and the record is amended on screen in chapter 25. Chapters have three to eight beats. All dialogue is original and subtitled; no licensed media, external account, upload ID, API key, or paid asset is required.

One place, one player, one active disposable mission folder. `MissionCatalog` owns ordered phase data; `MissionLayouts` owns 27 authored compositions. The first two missions retain their original tutorial/warehouse/ace rules and geometry. `BlueprintRunner` handles missions 3–27 as a pure server domain model. `CombatService` alone observes the authoritative aircraft, creates targets and projectiles, applies damage, changes phases and issues results. The client sends bounded flight controls and button events only.

Beyond air combat and staged strikes, the campaign includes ordered swept flight gates, altitude-limited reconnaissance, signal orbits, moving convoy escorts and fixed-site defense. Scans and signal time accrue only inside authored volumes. Escort movement advances while the player stays near it; nearby hostile aircraft suppress the protected objective at 0.7 health per second per threat. Losing it fails the sortie. The finale requires a real 30-second broadcast after the Marshal is down. Destruction counts alone cannot complete the newer missions.

Each phase enables only its allocated ground targets. Optional pursuers retire when their window ends. Setup and static mesh generation happen before the 600-second gameplay clock starts. Completion, failure, retry and return dispose the mission folder and restore the menu. The single-player guard prevents overlapping worlds.

`RelayStory` authors 28 chapters: opening, 26 bridges and finale, each three to eight beats with a shot and mood per beat/chapter. Mission briefings carry the instructions; story lines never do. The React cinematic renderer builds a local stage with Teal's receiver, map/evidence, aircraft, replicated Blender prop and region scenery. It cuts between the shot cameras in `CinematicStaging` with timed subtitles. The story is told without sound, so the stage carries it: the flight chart prints the chapter's document (`StoryDocuments`: the grain manifest, the struck roster, the governor's death certificate, ORDER 0001 signed RUSK, the amended record card) and the `evidence` shot frames it legibly at phone width; the coffee tin loses one cassette for every chapter Teal has spoken in; farm scenes are charred from chapter 15; the recorder comes home dented and open with a steady lamp in chapter 25; night relay chapters hang an aurora over the crown station; Sera's board carries Teal's name strip except during chapter 9 until the chapter's last beat. Teal's tapes, the recorder/log and every black card type out over the first 40 % of their beat (instant with camera motion off); the Marshal's cards carry a faint red vignette. Mood lighting drives Lighting, the Atmosphere and a local Terrain cloud deck (grey for storms, off at night so stars and aurora show).

Cutscene visual pass (2026-10-25, Studio Play on `build/skybreak.rbxlx`, 1205x536 viewport, plus 844x390 and 390x844 roots mounted at their real pixel sizes): the wide shot used to sit 200 studs out over empty floor; the sky shot showed hangar walls and tail fins; the recorder filled the frame as an anonymous metal box; the chart was a blown-out white slab; the dawn clock still showed stars; storms rendered a blue sky; night was a lamp pool in black; the story subject stood dead centre behind the chair; black cards left a strip of sky above the top bar; the "click for next" hint crowded the speaker chip at phone widths. All are fixed in `CinematicStaging`/`RelayCinematic`; captures live in `build/cutscene-pass/` (gitignored). Gamepad A activates the selected control, including Skip; touch Skip and unconsumed Space without GUI focus also skip. Consumed inputs are ignored; P/gamepad X pauses and gamepad B cancels; motion and subtitle-size buttons support accessibility. Compact cinematics reserve at least44px of scene, retain44px actions and scroll explicitly measured subtitles. Bearing/distance/altitude/protected-health guidance remains in the objective row when a floating caption cannot fit. Completion/cancel/unmount disconnects listeners and destroys the stage. Preflight story plays before the server creates the mission, so it uses none of the flight deadline. A reprise plays on replay; skipping does not grant progression. The final chapter plays automatically on M27 success.

The archive has three acts with all 27 mission rows, locked states, per-mission best times and replay. Briefings use scrollable text; debriefs describe the actual mission's consequence. Next and retry return to that mission's briefing, allowing a fresh launch or archive selection.

## Four-slot saves

The existing `SkybreakCampaign_v1` DataStore name and player keys are retained. Schema v3 adds per-mission records and derives unlocks from the contiguous chain of completions. Existing v2 M1/M2 flags and fastest times migrate into records 1/2; a completed two-mission slot resumes at M3, with the remaining 25 locked. V1 completion migrates to M1 only. Replays preserve completions and minimum times; profile writes merge monotonically and keep the existing delayed-write/recovery behavior. No client-supplied current-mission field unlocks a sortie. Unpublished Studio uses clearly labeled session saves; live cloud persistence needs a published experience.

## Mission manifest

| # | Mission / composition | Required phase sequence |
|---|---|---|
| 1 | FIRST FLIGHT — Varda training islands | Observe pitch and turn → Cycle to the training target → Lock and fire a missile at the training radar → Intercept three bandits |
| 2 | IRON COAST — Iron Coast five quays | Intercept three required bandits → Destroy five warehouses → Destroy the ace |
| 3 | FOX TRAIL — Fox switchback | Trace Teal's canyon trail through three beacons → Clear scout flight alpha → Clear scout flight bravo |
| 4 | STATIC QUARTERS — Hidden quarters bowl | Scan the hidden quarters below 380 studs → Destroy the hidden rim radar → Fend off the response flight |
| 5 | ORCHARD LINE — Teklan orchard terraces | Cover the orchard evacuation trucks |
| 6 | GRAIN SHADOW — Grain valley irrigation | Follow the farm irrigation channel → Destroy three fuel silos → Clear the orchard patrol |
| 7 | DUST WEATHER — Dust courier narrows | Fly the courier's dust pass below 400 studs → Catch the four-ship messenger flight |
| 8 | RIM SWITCH — Varda tower siege | Protect Varda's control tower for 50 seconds → Clear the retreating pair |
| 9 | STATIC HORIZON — Vulture moonlit bowl | Follow the night approach lights → Clear the night patrol → Defeat Vulture Lead |
| 10 | PLATEAU COLD — Kiro abandoned mine | Identify Node Kiro without destroying its archive → Destroy relay Node Kiro → Intercept the plateau response |
| 11 | SIGNAL HARVEST — Twin ridge relay saddle | Destroy relay Node Lira → Destroy relay Node Merel → Clear the alert pair → Orbit the west ridge to relay Teal's packet |
| 12 | OPEN FIELD — Open field refugee corridor | Escort the loyalist transmitter truck |
| 13 | STAGING FARM — Staging farm rail yard | Mark the staging farm from below 420 studs → Destroy four fuel silos and the relay → Hold off two raiders |
| 14 | ANTENNA ROW — High relay crossing | Cross the relay saddle through four beacons → Destroy three plateau antennas → Clear the perimeter CAP |
| 15 | LOYALIST WINDOW — Loyalist broadcast common | Keep the loyalist broadcast linked for 35 seconds → Intercept the jamming flight |
| 16 | STORM WALK — Storm river divide | Stay below the storm ceiling: three river gates → Destroy three remaining silos → Destroy the forward relay → Catch the storm patrol |
| 17 | AURORA RELAY — Aurora crown array | Destroy the plateau relay → Clear the aurora intercept → Receive the Marshal's orders above the dark relay |
| 18 | RIDGE ACE — Vulture searchlight ridge | Climb into Vulture Two's searchlights → Clear his wingmen → Defeat Vulture Two |
| 19 | HARBOR RUN — Military quays and canal | Identify military quays; spare the city → Destroy three harbor warehouses → Clear the harbor CAP |
| 20 | FRACTURE LINE — Eastern wing divided harbor | Shatter the eastern wing → Cover the evidence launch through the harbor |
| 21 | CITY NIGHT — Black canal city | Follow the dark canal through the city → Destroy the broadcast relay → Hold off the escort flight |
| 22 | HARBOR FOG — Five fog fuel piers | Find the fuel depot through the harbor fog → Destroy five fuel silos → Clear the fog patrol |
| 23 | OCEAN CLEAR — Frigate ring over deep water | Protect the frigate's ring around the platform → Clear the platform command flight |
| 24 | PLATFORM FIRE — Storm platform trident | Use the low sea approach below 360 studs → Destroy three platform warehouses → Clear the storm patrol |
| 25 | CITY DAWN — Dawn beachhead | Cover the landing craft to the beach → Hold the first intercept → Hold the second intercept → Destroy the beach relay |
| 26 | FRACTURE LAST — Civic plaza blackout | Break the Marshal's first flight → Break the second flight → Triangulate the Marshal's last transmission |
| 27 | BROKEN RELAY — Coastal parliament sunrise | Clear the Marshal's wingmen → Destroy the final broadcast relay → Defeat the Air Marshal → Broadcast Teal's evidence to the whole coast |

## Original Blender assets and performance bounds

`tools/build-relay-assets.py` reuses the project's canonical material and corner-normal export functions. It authors these original assets from primitives and evaluated meshes:

| Asset | Triangles | Material meshes | Bounds in studs |
|---|---:|---:|---|
| Communications relay mast | 828 | 5 | 44 × 90 × 44 |
| Fuel/grain silo | 960 | 6 | 42 × 72 × 42 |
| Utility/radio truck | 640 | 5 | 18 × 33 × 35.2 |
| Evidence harbor launch | 244 | 5 | 26 × 37 × 57 |

The generator and four exact runtime mesh JSON files are committed. Rebuild with Blender in background mode, then `bun run build`. Blender projects, GLB files and lit inspection PNGs remain regenerable local outputs. All four `.blend` files were reopened and GLBs round-tripped against exported bounds within 0.001 studs. The runtime follows the existing server-generated static-content path, preserves corner normals and material centers, and clones cached material meshes. Missing/malformed data fails explicitly. A platform mesh capability failure warns and produces a visible primitive fallback labeled `GeometrySource=Fallback`; that fallback is **not** a successful mesh QA result.

The authored mission budget is at most six active hostile aircraft, eight player missiles in stock, a shared hostile launch cadence, at most five required ground targets, and fewer than 400 scenery/target BaseParts. Scene/asset tests assert these bounds when run in Roblox. New flat land uses nine or fewer material slabs instead of filling millions of terrain voxels. Roads split below the engine's 2048-stud part limit. Legacy island worlds remain intact. One render listener exists per active cinematic or navigation cue, and both disconnect on unmount. Static geometry templates persist by asset kind; mission clones and cinematics do not accumulate.

These are design/definition bounds, not measured device FPS or memory figures. Physical phone/console performance and replication remain live QA items.

## Validation and Studio handoff

Completed offline:

- `bun run build` — all TypeScript/React Lua and Roblox Jest specs compile.
- `bun run build:place` — production Rojo package created without a Rojo server or Studio.
- `bun run test:offline` — 90 pure compiled-domain contracts pass in the official standalone Luau CLI. This includes all new mission sequences, all flight volumes using legal `FlightMath` stick/throttle, 27-step unlock/replay, four-slot migration, protected loss, deadline/replay failures, the final broadcast, cinematic A/GUI/consumed-input routing, the staging tables (moods, poses, typed lines, story-driven props) and the evidence documents. These are unit simulations, not gameplay evidence.
- Blender generation, preview inspection, `.blend` reopen and GLB bounds round-trip for all four new meshes.
- `git diff --check`.

The offline runner adapts compiled module imports to filesystem `require`, provides only minimal assertion functions, and constructs inert vector/camera values for the unused menu configuration. It does not emulate the engine, run Roblox Jest, or fake a mission result. Use the official [Luau releases](https://github.com/luau-lang/luau/releases) executable and set `LUAU_BIN=/absolute/path/to/luau`, or place it at `build/offline-luau/luau`. No binary is committed. The compiler must run before the offline runner; `test:offline` does that.

**Completed live:** actual engine Jest, sequential M1–M27, all28 rendered three-beat scenes/finale, protected-objective loss and visible Retry, successful no-evade escort replay, slot isolation/unlock/replay/teardown, and final compact/notched/portrait presentation checks. See [exact SHAs and scope](broken-relay-qa.md). A Rojo server was not used. Published cloud/rejoin and physical device/gamepad behavior remain unverified.

To repeat QA under a new parent-granted exclusive Studio lease:

1. Run `bun run test:roblox`; inspect the real Jest JSON/log. In addition to the campaign domain specs, `RelayWorld.spec` builds/disposes every mission and requires real Blender geometry, exact targets, safe anchored parts and bounded instances. Existing baseline suites remain included, with campaign expectations updated to v3/27 missions.
2. Open `build/skybreak.rbxlx` (one production place). Verify new meshes replicate with `GeometrySource=Blender`. Rebuild/restart any Rojo mapping only under the lease.
3. Use a fresh session slot. Install `tools/playtest-relay.client.luau` as a normal LocalScript. Launch each mission through the real menu and story. The persistent pilot computes only legal stick/throttle and invokes the normal controller target/missile/evade methods. It never moves an aircraft directly or alters health, timer, kills, objectives, or results. It completed all27 genuine sorties in the recorded run.
4. Inspect `PlayerScripts.BrokenRelayQA`: every attempt records server outcome, elapsed time, kills, ground kills, minimum health, protected health, phase sequence and input-command counts. Save genuine logs/screenshots. Require 27 actual Completed results and the finale; fix failures rather than changing success conditions for evidence.
5. Manually verify touch/keyboard/gamepad, 320×240 and phone portrait/landscape, story skip/pause/motion/text controls, failed escort, 600-second timeout, retry, locked remote rejection, completed-mission replay, four-slot isolation, migration fixtures, return cleanup and repeated launch/recap counts. Cloud persistence/rejoin requires a published test experience and cannot be proven with unpublished session slots.

## Remaining limitations

All27 objectives, asset replication and representative presentation/input paths were exercised in the engine. Minimum tested gameplay safe area is319×181/320×182; smaller usable roots are not claimed. The pilot proves feasibility with ordinary controls; it does not replace physical mobile/console balance testing. Protected damage is deliberately an analytic suppression model tied to nearby server-owned enemies; it is not a projectile collision simulation. Scenery uses readable native shapes and material colors, with no texture or voice-acting dependency. Descriptive briefing text is supplemented by the complete phase plan; the phase plan is authoritative when it adds a navigation/escort step to an older synopsis. Published DataStore and physical device validation remain outside offline scope.
