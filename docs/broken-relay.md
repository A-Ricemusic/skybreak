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

**Grandfathered bests.** Saved best times, best scores and best ranks carry no ruleset version, and merges only ever keep the faster time, the higher score and the better rank. Records set before round 2 therefore stay: a best time from the shorter pre-round-2 missions remains the displayed best, and an older S rank stands even though it never had to meet the new 85% accuracy requirement. This is deliberate: nothing erases a player's progress, and a new run replaces an old best only by beating it. A future reset would need a schema version bump and an explicit migration, not a silent rewrite.

## Mission manifest

`⇢ *twist*` marks a mid-phase objective change (`MissionPhaseBlueprint.twist`): when the active phase's progress fraction crosses `at`, a radio call plays and the listed phases are spliced in right after it. Mode `now` ends the current phase on the spot (an interrupted scan, a rerouted convoy, a jammed archive); the default `after` lets it finish first (reinforcements announced mid-strike, a recovery to cover after the ace falls). Twists always fire before their host phase can complete, so `MissionCatalog.ExpandedPhases` is the authoritative flow for kill totals, par, save-proof phase counts and the debrief.

Round 2 phase fields (all validated at catalog load):

| Field | On | Effect |
|---|---|---|
| `groups`, `stagger`, `flank` | `required_air` | `count` splits into `groups` (larger first, `WavePlan.Groups`). The next group arrives `stagger` seconds (default 18) after the last one, or as soon as half the last group is down. With `flank`, later groups come from the rear quarter. |
| `groupAt`, `groupCalls` | `required_air` | `groupAt` gives later groups an authored trigger as a share of the whole phase down (M26's rear flight comes at 50%); such a group ignores `stagger` and the half-of-the-last-group rule. `groupCalls` are radio lines said when each later group actually spawns, so a warning never runs ahead of or behind its flight. |
| `reinforce: [{ at, count }]` | any phase with raiders | Raider waves that arrive when the phase fraction crosses each `at` (kills for strikes, seconds for holds). Their sum fits in `optionalRaiders`; the remainder arrives at phase start (`MissionCatalog.InitialRaiders`). Every multi-target combat phase has one, except the exceptions listed under the aircraft budget below. |
| `hazard: { at, count, effect, text }` | `signal` (`jam`), `escort`/`defend` (`guns`) | The next `count` ground targets stay hidden until the phase fraction reaches `at`, then light up with a radio call. They are required ground kills. Live jammers freeze the signal timer; live guns drain the protected actor like 1.5 raiders each. The phase cannot finish while any is alive. |
| `kind: "chase"`, `escape`, `seconds` | courier | One fast (275 studs/s, faster than cruise, slower than full throttle) non-firing 160-hull target runs for `escape`; the sortie fails with reason `escaped` after `seconds`. Its `Fraction` (for chatter) is the escape clock. |
| `directed` | any combat phase | A radar is directing the flight: the hostile fire gate is halved while the phase lasts. |
| `hidden` | `required_ground` | Its targets stay invisible and unqueryable until the phase begins (M8's spotters, M10's camp radar). |
| `aceReturns` | mission with an ace | Two radio lines, said when the ace turns back in after each retreat (the two `aceStages` lines are said as it breaks off). |

Ground targets are consumed in phase order by strikes and hazards (`MissionCatalog.GroundStart`); `HiddenGround` lists the ones that start invisible. Holds (escort and defend) run 90–150 s; signal holds 90 s, except the interrupted M17 orbit (90 s, cut at half, then a 50 s resume) and the M27 closing broadcast (60 s, after a three-stage ace fight).

Three kinds of time appear below, and they are not interchangeable:

- **Par** is computed by the game (`MissionScore.ParSeconds`) and sets the score's time rating. It is meant as a good human run, about 1.3× the scripted pilot. Against the live runs below that holds in Act III (M26: par 260 s, pilot 188–205 s), but Act I pars sit 2–3× above the pilot, because those sorties still fly short.
- **Average human (design est.)** is a planning estimate for an average phone pilot, not a measurement: 20 s transit, 15 / 20 / 24 s per required bandit by act plus a 10 s approach per air phase, 10 s per ground target, 12 s per beacon, recon at 1.25× each dwell plus 10 s per point, escort/defend holds ×1.05 and signal holds ×1.25 plus 10 s on station (and 10 s per hazard target), 45 s per chase, 0.36 s per ace hull point, 4 s per phase change, and a phase cut short by a "now" twist counted up to the twist. The tutorial counts 20 / 10 / 20 s for its three teaching steps.
- **Live measurements** are the coordinator's scripted-pilot runs in Studio (below). They are the only measured numbers here.

The manifest and the par/estimate tables are generated from the final catalog by `bun tools/relay-tables.ts` (after `bun run test:offline`; `--check` fails when they are stale). Do not edit them by hand. Each phase lists its staggered groups, timed holds, hazards and raiders: "raiders 1 + 2 at 60%" means one at phase start and two more when the phase is 60% done.

<!-- relay-tables:begin (bun tools/relay-tables.ts) -->

| # | Mission / composition | Required phase sequence |
|---|---|---|
| 1 | FIRST FLIGHT — Varda training islands | Turn and pitch for three seconds each → Cycle to the training target → Lock and fire a missile at the training radar → Intercept three bandits |
| 2 | IRON COAST — Iron Coast five quays | Intercept the three-bandit screen → Destroy five warehouses (raiders 5) → Destroy the ace (165 hull, 3 stages) |
| 3 | FOX TRAIL — Fox switchback | Follow Teal's beacons → Clear scout flight alpha (3 in 2 groups; raiders 1 at 50%) → Teal's river run: stay under 320 → Clear scout flight bravo (4 in 2 groups; raiders 1 at 50%) |
| 4 | STATIC QUARTERS — Hidden quarters bowl | Scan the quarters: stay under 380 → Destroy the hidden rim radar (raiders 1) → Fend off the response flight (5 in 2 groups; raiders 1 at 50%) |
| 5 | ORCHARD LINE — Teklan orchard terraces | Cover the orchard evacuation trucks (110 s; raiders 2 + 2 at 50%) → Drive off the patrol leads (raiders 1 at 50%) |
| 6 | GRAIN SHADOW — Grain valley irrigation | Follow the farm irrigation channel → Mark the silos, spare the roofs: stay under 400 → Destroy three fuel silos (raiders 1 + 1 at 34%) → Clear the orchard patrol (5 in 2 groups; raiders 1 at 50%) |
| 7 | DUST WEATHER — Dust courier narrows | Run the dust pass under 400 → Strip the courier's escort (5 in 2 groups; raiders 1 at 50%) → Catch the courier before the plateau (escapes after 90 s) |
| 8 | RIM SWITCH — Varda tower siege | Protect Varda's control tower (120 s; raiders 2 + 1 at 35% + 2 at 65%) → Counter-attack the spotter radars (raiders 1 at 50%) → Catch the retreating flight (raiders 1 at 50%) |
| 9 | STATIC HORIZON — Vulture moonlit bowl | Follow the night approach lights → Clear the night patrol (4 in 2 groups; raiders 1 at 50%) → Defeat Vulture Lead (300 hull, 3 stages; raiders 1 + 1 on its calls) |
| 10 | PLATEAU COLD — Kiro abandoned mine | Follow the mine road up to Kiro → Scan Node Kiro (hold fire) ⇢ *twist* Break the camp's intercept (4 in 2 groups; raiders 1 at 50%) → Finish the archive scan (raiders 1 + 1 at 40%) → Cut Node Kiro's transmitter ⇢ *twist* Kill the camp radar (directed; raiders 3) → Intercept the blind response (raiders 1 at 50%) |
| 11 | SIGNAL HARVEST — Twin ridge relay saddle | Destroy relay Node Lira (raiders 1) → Clear the alert flight (raiders 1 at 50%) → Destroy relay Node Merel ⇢ *twist* Follow the farm road north to Sable → Destroy relay Node Sable → Clear Sable's guard flight (raiders 1 at 50%) → Orbit the west ridge to relay Teal's packet (90 s; raiders 2 + 2 at 50%) |
| 12 | OPEN FIELD — Open field refugee corridor | Escort the loyalist transmitter truck (90 s; raiders 2 + 2 at 30%) ⇢ *twist* Cover the reroute along the mill road (100 s; raiders 2 + 2 at 50%) → Occupy the orchard airspace (6 in 2 groups; raiders 2 at 50%) |
| 13 | STAGING FARM — Staging farm rail yard | Follow the rail spur to the staging farm → Scan the staging farm low (raiders 1 + 1 at 50%) → Destroy four fuel silos (raiders 1 at 50%) ⇢ *twist* Break the plateau reinforcements (4 in 2 groups; raiders 1 at 50%) → Destroy the farm relay → Hold off the raiders (raiders 1 + 1 at 34%) |
| 14 | ANTENNA ROW — High relay crossing | Cross the relay saddle through four beacons → Destroy three plateau antennas (raiders 1 + 1 at 50%) ⇢ *twist* Destroy the mobile mast → Clear the perimeter CAP (4 in 2 groups; raiders 1 + 1 at 50%) → Hold the saddle: confirm the row is dark (90 s; raiders 2 + 2 at 40%) |
| 15 | LOYALIST WINDOW — Loyalist broadcast common | Hold the broadcast link (90 s; 2 jammers freeze it; raiders 2 + 2 at 30%) → Hold the second intruders (7 in 2 groups; raiders 1 at 30% + 2 at 60%) |
| 16 | STORM WALK — Storm river divide | River gates: stay under 400 → Destroy three remaining silos (raiders 1 at 34%) ⇢ *twist* Catch the storm patrol (5 in 2 groups; raiders 1 at 50%) → Destroy the forward relay → Hold over the dead relay: read its last traffic (90 s; raiders 2 at 35% + 2 at 70%) |
| 17 | AURORA RELAY — Aurora crown array | Destroy the plateau relay (raiders 1) → Clear the aurora intercept (4 in 2 groups; raiders 1 at 50%) → Orbit to receive the archive (90 s; raiders 2) ⇢ *twist* Find the jammer under the array → Destroy the aurora jammer → Clear the jammer's escort (raiders 1 at 50%) → Resume the receive orbit (50 s; raiders 1 + 1 at 40%) |
| 18 | RIDGE ACE — Vulture searchlight ridge | Climb into Vulture Two's searchlights → Clear his wingmen (4 in 2 groups; raiders 1 at 50%) → Defeat Vulture Two (400 hull, 3 stages; raiders 1 + 1 on its calls) ⇢ *twist* Protect the marines' pickup on the ridge (90 s; raiders 2 + 2 at 50%) |
| 19 | HARBOR RUN — Military quays and canal | Scan the quays; spare the city (raiders 1) → Destroy three harbor warehouses (raiders 1 + 1 at 34%) ⇢ *twist* Break the early CAP (4 in 2 groups; raiders 1 at 50%) → Clear the harbor CAP (6 in 2 groups; raiders 1 at 50%) |
| 20 | FRACTURE LINE — Eastern wing divided harbor | Shatter the eastern wing (9 in 3 groups) → Cover the evidence launch through the harbor (110 s; 2 bank guns; raiders 2 + 2 at 50%) |
| 21 | CITY NIGHT — Black canal city | Follow the dark canal through the city → Destroy the broadcast relay (raiders 2) → Hold off the escort flight (8 in 2 groups; raiders 1 + 1 at 50%) → Hold over the dark tower: confirm silence (90 s; raiders 2 + 2 at 40%) |
| 22 | HARBOR FOG — Five fog fuel piers | Find the depots through the fog (raiders 2) → Destroy five fuel depots (raiders 2 at 40%) → Clear the fog patrol (6 in 3 groups, flanking; raiders 1 at 50%) |
| 23 | OCEAN CLEAR — Frigate ring over deep water | Defend the command frigate (120 s; raiders 2 + 2 at 35% + 2 at 70%) → Clear the platform command flight (6 in 2 groups, flanking; raiders 1 at 50%) |
| 24 | PLATFORM FIRE — Storm platform trident | Low sea approach: under 360 → Destroy three platform warehouses (raiders 1 + 1 at 34%) → Clear the storm patrol (6 in 2 groups; raiders 1 at 50%) → Stop the fuel tanker running for the coast (escapes after 90 s) |
| 25 | CITY DAWN — Dawn beachhead | Cover the landing craft to the beach (110 s; raiders 2 + 2 at 50%) → Hold the first intercept (5 in 2 groups; raiders 1 at 50%) → Hold the second intercept (5 in 2 groups, flanking; raiders 1 + 2 at 50%) → Destroy the beach relay |
| 26 | FRACTURE LAST — Civic plaza blackout | Break the Marshal's wing (8 in 2 groups, the second at 50% of the phase, flanking; raiders 2 at 60%) → Triangulate the Marshal's last transmission (90 s; raiders 2 + 2 at 40%) |
| 27 | BROKEN RELAY — Coastal parliament sunrise | Clear the Marshal's wingmen (raiders 1 at 50%) → Destroy the final broadcast relay (raiders 1) ⇢ *twist* Break the Marshal's personal escort (flanking; raiders 1 at 50%) → Defeat the Air Marshal (500 hull, 3 stages; raiders 2 + 2 on its calls) → Broadcast Teal's evidence to the whole coast (60 s; raiders 2 at 30%) |

| # | Par | Average human (design est.) | | # | Par | Average human (design est.) | | # | Par | Average human (design est.) |
|--:|--:|--:|---|--:|--:|--:|---|--:|--:|--:|
| 1 | 100 s | 2.4 min | | 10 | 230 s | 5.0 min | | 19 | 250 s | 6.0 min |
| 2 | 185 s | 3.3 min | | 11 | 305 s | 6.1 min | | 20 | 305 s | 6.7 min |
| 3 | 175 s | 3.9 min | | 12 | 275 s | 5.5 min | | 21 | 310 s | 6.8 min |
| 4 | 145 s | 3.1 min | | 13 | 235 s | 5.0 min | | 22 | 205 s | 4.6 min |
| 5 | 185 s | 3.5 min | | 14 | 290 s | 5.7 min | | 23 | 255 s | 5.3 min |
| 6 | 180 s | 3.7 min | | 15 | 250 s | 5.3 min | | 24 | 225 s | 5.0 min |
| 7 | 160 s | 3.5 min | | 16 | 295 s | 5.8 min | | 25 | 330 s | 7.2 min |
| 8 | 225 s | 4.0 min | | 17 | 295 s | 6.0 min | | 26 | 260 s | 5.9 min |
| 9 | 190 s | 4.1 min | | 18 | 320 s | 6.8 min | | 27 | 340 s | 8.0 min |

Design-estimate campaign total for the average pilot: about 138 minutes of flying.

<!-- relay-tables:end -->

Live measurements (coordinator, Studio, Normal, the `RelayPilot` scripted pilot using only stick, throttle, target, missile and evade; [round-2 report](qa/round2-live-pr37.md)). These runs predate this review round's changes (the 7-aircraft budget, the new mid-phase raiders, M26's 50% rear flight and the tutorial missile dwell), and the pilot is faster than a human. Re-measure before relying on them.

| M | Pilot time | Min hull | Note | M | Pilot time | Min hull | Note |
|--:|--:|--:|---|--:|--:|--:|---|
| 1 | 26 s | 100 | | 15 | 149 s | 64 | |
| 2 | 64 s | 78 | | 16 | 150 s | 88 | |
| 3 | 56 s | 90 | | 17 | 157 s | 88 | |
| 4 | 72 s | 100 | | 18 | 181 s | 100 | ace, 3 stages |
| 5 | 130 s | 80 | | 19 | 160 / 188 / 167 s | 2 / 74 / 22 | last two after the Act III softening |
| 6 | 96 s | 90 | | 20 | 213 s | 16 | |
| 7 | 50 s | 100 | | 21 | 204 / 247 s, then died at 117 s | 2 / 9 / — | not re-run after the 35 s stagger |
| 8 | completed | — | record lost | 22 | 134 s | 16 | |
| 9 | 70 s | 100 | ace fell in ~40 s of fighting | 23 | 191 s | 16 | |
| 10 | completed after 4 crashes | 64 | pilot had no terrain look-ahead | 24 | 129 s | 44 | |
| 11 | 189 s after 4 crashes, 1 death | 40 | relay saddle ridge behind Node Sable | 25 | 237 s | 30 | |
| 12 | 213 s | 40 | | 26 | 205 / 188 s after softening | 35 | 8 deaths at the original tuning |
| 13 | 98 s | 76 | | 27 | 193 s after softening | 87 | |
| 14 | 163 s | 76 | | | | | |

Measured, the scripted pilot lands Act I at 1–2 min, Act II at 2.5–3.5 min and Act III at 3–4 min. Act I (M1–M4, M7, M9) is still short of the 3–7 minute average-human target, and no human or phone run has measured it yet.

## Original Blender assets and performance bounds

`tools/build-relay-assets.py` reuses the project's canonical material and corner-normal export functions. It authors these original assets from primitives and evaluated meshes:

| Asset | Triangles | Material meshes | Bounds in studs |
|---|---:|---:|---|
| Communications relay mast | 828 | 5 | 44 × 90 × 44 |
| Fuel/grain silo | 960 | 6 | 42 × 72 × 42 |
| Utility/radio truck | 640 | 5 | 18 × 33 × 35.2 |
| Evidence harbor launch | 244 | 5 | 26 × 37 × 57 |

The generator and four exact runtime mesh JSON files are committed. Rebuild with Blender in background mode, then `bun run build`. Blender projects, GLB files and lit inspection PNGs remain regenerable local outputs. All four `.blend` files were reopened and GLBs round-tripped against exported bounds within 0.001 studs. The runtime follows the existing server-generated static-content path, preserves corner normals and material centers, and clones cached material meshes. Missing/malformed data fails explicitly. A platform mesh capability failure warns and produces a visible primitive fallback labeled `GeometrySource=Fallback`; that fallback is **not** a successful mesh QA result.

The live-aircraft budget is enforced by the server, not just authored: at most **seven hostile aircraft alive at once on Normal and Easy, eight on Ace** (`WavePlan.Budget`: one more for Ace's extra raider per wave). Missions 3–27 request every bandit group and raider wave through a queue (`WavePlan.Admit`); what does not fit waits, bandits before raiders, until kills free a slot, and the next staggered group is not due while one is still waiting. The ace and a courier spawn directly, and a jet withdrawing at a phase change (disabled, silent, gone within 4 s) is outside the count. Missions 1–2 keep their legacy spawns (at most five raiders). `MissionCatalog.PeakAircraft` computes each phase's true demand without the budget: every group a timer can send with no kills, less the bandits that must be down for later events, plus every raider wave whose trigger has been reached, with raiders never dying. `RelayCampaign.spec` flies every phase second by second under these rules, for an idle pilot and a slow one, on Normal and Ace, and checks that the budget holds and every phase still clears.

Phases whose own demand passes the budget, so the server holds the excess back (pinned by the spec):

| Phase | Demand (Normal / Ace) | What the budget does |
|---|---|---|
| M20 Shatter the eastern wing (9 in 3 groups) | 9 / 9 | With no kills, the third group's last two wait until two bandits are down. |
| M21 Hold off the escort flight (8 in 2 groups, 35 s stagger) | 9 / 10 | The live-tested 35 s timer can bring the second group before any kill; part of it waits. |
| M23 Defend the command frigate (6 raiders in 3 waves) | 6 / 9 | Ace only: the last wave's extra raider waits for a slot. |

Mid-phase reinforcement rule (catalog contract in `RelayCampaign.spec`): every M3–M27 `required_air` or `required_ground` phase with two or more targets has at least one `reinforce` wave. The exceptions are:

- **Single-target strikes and intercepts** (count 1: M4, M10 ×2, M11 ×3, M13, M14, M16, M17 ×2, M21, M25 and M27 relays, radars and masts). A kill-fraction wave could only arrive with the completing kill, so they carry opening raiders or none, and the contract forbids an unreachable `reinforce` on them.
- **Budget-full phases**: M20's nine-bandit wing. Its bandits alone fill the budget, so a raider wave could only be held back. The contract checks that adding one would pass the budget.
- **Legacy Missions 1–2**, which keep their original hard-coded flows.

Phases that had no raiders gained one optional raider at 50%. Phases whose opening raiders pushed them over the budget moved them mid-phase instead: M12's orchard airspace (2 at 50%), M15's second intruders (1 at 30%, 2 at 60%), and one opening raider each in M8, M13, M14 and M16. Required counts, par and the live-tested Act III tuning did not change. These additions have not been live-tested.

The other authored bounds: eight player missiles in stock, a flight-wide hostile launch gate and threat cap, at most five required ground targets, and fewer than 400 scenery/target BaseParts. Scene/asset tests assert these bounds when run in Roblox. New flat land uses nine or fewer material slabs instead of filling millions of terrain voxels. Roads split below the engine's 2048-stud part limit. Legacy island worlds remain intact. One render listener exists per active cinematic or navigation cue, and both disconnect on unmount. Static geometry templates persist by asset kind; mission clones and cinematics do not accumulate.

These are design/definition bounds, not measured device FPS or memory figures. Physical phone/console performance and replication remain live QA items.

## Validation and Studio handoff

Completed offline:

- `bun run build` — all TypeScript/React Lua and Roblox Jest specs compile.
- `bun run build:place` — production Rojo package created without a Rojo server or Studio.
- `bun run test:offline` — 207 pure compiled-domain contracts pass (at this review round) in the official standalone Luau CLI. This includes all new mission sequences, all flight volumes using legal `FlightMath` stick/throttle, 27-step unlock/replay, four-slot migration, protected loss, deadline/replay failures, the final broadcast, cinematic A/GUI/consumed-input routing, the staging tables (moods, poses, typed lines, story-driven props) and the evidence documents. These are unit simulations, not gameplay evidence.
- Blender generation, preview inspection, `.blend` reopen and GLB bounds round-trip for all four new meshes.
- `bun run docs:relay-tables -- --check` — the mission manifest and par/estimate tables match the catalog.
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
