# Historical Broken Relay campaign (retired)

This document records the retired 27-mission campaign. It does not describe the live campaign after the 18-mission switch. Tables below are frozen historical evidence; current availability, practice and mission 1 are tested against the active catalog.

# SKYBREAK: Broken Relay — independent campaign alternative

Status: **round-3 mission structure implementation**, rebased onto main after PR #37, PR #38 and PR #41 (`4f06ef8`). Every M3–M27 sortie has 4–7 alternating objective beats. Normal is retuned for room to follow the story; Ace carries the stronger combat pressure. Build and offline verification are described below; Roblox Jest and live phone balance validation are reserved for the coordinator.

## Architecture and story

A lone trainee follows missing mentor Teal's recordings from Varda Rim, through upland farms and relay arrays, to the coastal parliament. The recordings expose forged emergency orders and Air Marshal Rusk's coup. Sera at Varda Control is Teal's oldest friend and the one command made say 'deserter' on the net; the trainee answers in their own voice at the end of every chapter and the campaign ends on their broadcast. The coup's voice is anonymous intercepts until the aurora archive names Rusk (chapter 17); the Teklan orchard that sheltered Teal's tape burns in reprisal (chapter 15); Vulture Two, Teal's own instructor, confesses after ejecting (chapter 18); Teal's last recording plays in full and the record is amended on screen in chapter 25. Chapters have three to eight beats. All dialogue is original and subtitled; no licensed media, external account, upload ID, API key, or paid asset is required.

One place, one player, one active disposable mission folder. `MissionCatalog` owns ordered phase data; `MissionLayouts` owns 27 authored compositions. The first two missions retain their original tutorial/warehouse/ace rules and geometry. `BlueprintRunner` handles missions 3–27 as a pure server domain model. `CombatService` alone observes the authoritative aircraft, creates targets and projectiles, applies damage, changes phases and issues results. The client sends bounded flight controls and button events only.

Beyond air combat and staged strikes, the campaign includes ordered swept flight gates, altitude-limited reconnaissance, signal orbits, moving convoy escorts and fixed-site defense. Scans and signal time accrue only inside authored volumes. Escort movement advances while the player stays near it; nearby hostile aircraft suppress the protected objective at 0.55 health per second per raider on Normal (×0.75 Easy, ×1.25 Ace; lit hazard guns count 1.5 each). Escorted and defended actors are grounded from their own bounding box and a raycast against the mission's flight-solid surfaces and terrain: trucks ride the road, towers stand on their pad, launches float at the waterline (or sit on a beach). Losing the protected objective fails the sortie. The finale requires a real 60-second broadcast after the Marshal is down. Destruction counts alone cannot complete the newer missions.

Each phase enables only its allocated ground targets. Optional pursuers retire when their window ends: they break off and fly for the boundary for 4 s, untargetable and silent, and any missile chasing one is refunded; dead enemies are compacted out at every phase change. Bandits and raiders carry per-sortie call signs (BANDIT 07, RAIDER 03). Setup and static mesh generation happen before the gameplay clock (`GameConfig.Campaign.MissionTimeLimit`, 900 s) starts; the server pre-builds the enemy Vanta mesh at start-up so no Heartbeat step yields on it, and every session step runs under a `StepGuard` (one warning, then the sortie fails with reason `internal_error` instead of throwing every frame; a step suspended in a yield is never re-entered). CombatAction `Pause`/`Resume` freezes the single-player sortie on the server and moves the clock's start by the paused span, capped at 5 minutes per sortie. Completion, failure, retry and return dispose the mission folder and restore the menu. The single-player guard prevents overlapping worlds.

`RelayStory` authors 28 chapters: opening, 26 bridges and finale, each three to eight beats with a shot and mood per beat/chapter. Mission briefings carry the full instructions; story bridges explain why the recovery, inspection and evidence handoffs matter. The React cinematic renderer builds a local stage with Teal's receiver, map/evidence, aircraft, replicated Blender prop and region scenery. It cuts between the shot cameras in `CinematicStaging` with timed subtitles. The story is told without sound, so the stage carries it: the flight chart prints the chapter's document (`StoryDocuments`: the grain manifest, the struck roster, the governor's death certificate, ORDER 0001 signed RUSK, the amended record card) and the `evidence` shot frames it legibly at phone width; the coffee tin loses one cassette for every chapter Teal has spoken in; farm scenes are charred from chapter 15; the recorder comes home dented and open with a steady lamp in chapter 25; night relay chapters hang an aurora over the crown station; Sera's board carries Teal's name strip except during chapter 9 until the chapter's last beat. Teal's tapes, the recorder/log and every black card type out over the first 40 % of their beat (instant with camera motion off); the Marshal's cards carry a faint red vignette. Mood lighting drives Lighting, the Atmosphere and a local Terrain cloud deck (grey for storms, off at night so stars and aurora show).

Cutscene visual pass (2026-10-25, Studio Play on `build/skybreak.rbxlx`, 1205x536 viewport, plus 844x390 and 390x844 roots mounted at their real pixel sizes): the wide shot used to sit 200 studs out over empty floor; the sky shot showed hangar walls and tail fins; the recorder filled the frame as an anonymous metal box; the chart was a blown-out white slab; the dawn clock still showed stars; storms rendered a blue sky; night was a lamp pool in black; the story subject stood dead centre behind the chair; black cards left a strip of sky above the top bar; the "click for next" hint crowded the speaker chip at phone widths. All are fixed in `CinematicStaging`/`RelayCinematic`; captures live in `build/cutscene-pass/` (gitignored). Gamepad A activates the selected control, including Skip; touch Skip and unconsumed Space without GUI focus also skip. Consumed inputs are ignored; P/gamepad X pauses and gamepad B cancels; motion and subtitle-size buttons support accessibility. Compact cinematics reserve at least44px of scene, retain44px actions and scroll explicitly measured subtitles. Bearing/distance/altitude/protected-health guidance remains in the objective row when a floating caption cannot fit. Completion/cancel/unmount disconnects listeners and destroys the stage. Preflight story plays before the server creates the mission, so it uses none of the flight deadline. A reprise plays on replay; skipping does not grant progression. The final chapter plays automatically on M27 success.

The archive has three acts with all 27 mission rows, locked states, per-mission best times and replay. Briefings use scrollable text; debriefs describe the actual mission's consequence. Next and retry return to that mission's briefing, allowing a fresh launch or archive selection.

## Four-slot saves

The existing `SkybreakCampaign_v1` DataStore name and player keys are retained. Schema v3 adds per-mission records and derives unlocks from the contiguous chain of completions. Existing v2 M1/M2 flags and fastest times migrate into records 1/2; a completed two-mission slot resumes at M3, with the remaining 25 locked. V1 completion migrates to M1 only. Replays preserve completions and minimum times; profile writes merge monotonically and keep the existing delayed-write/recovery behavior. No client-supplied current-mission field unlocks a sortie. Unpublished Studio uses clearly labeled session saves; live cloud persistence needs a published experience.

**Mission time revisions.** M3–M27 use time revision 2 for their longer layouts. Loading an older or unversioned time drops only that mission's obsolete best time; its completion, first-completion timestamp, best score, rank and unlocks survive. New times retain their revision through saves and merges, so an older stored record cannot resurrect a short-layout time. M1–M2 times are unchanged. Scores and ranks remain grandfathered.

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
| `directed` | combat or signal phase | A radar is directing the flight: the hostile fire gate is halved while the phase lasts. |
| `parkedEscort` | `recon`, `signal`, `route` | Keep the stopped truck or launch visible at its last escort position during a scan, radio handoff or route-marking task. |
| `hidden` | `required_ground` | Its targets stay invisible and unqueryable until the phase begins (M8's spotters, M10's camp radar). |
| `aceReturns` | mission with an ace | Two radio lines, said when the ace turns back in after each retreat (the two `aceStages` lines are said as it breaks off). |

Ground targets are consumed in phase order by strikes and hazards (`MissionCatalog.GroundStart`); `HiddenGround` lists the ones that start invisible. Escort and defend work ranges from 30–110 s; signal handoffs from 15–90 s. Longer existing holds were shortened where a sortie gained inspection or recovery work. The closing broadcast still requires 60 actual seconds after the ace fight and climb. M12 stops the truck visibly at the fork (`parkedEscort`) while the player scans the mill road; the new escort leg begins at that same stop.

Three kinds of time appear below, and they are not interchangeable:

- **Par** is computed by the game (`MissionScore.ParSeconds`) and sets the score's time rating. It is meant as a good human run, about 1.3× the scripted pilot. Against the live runs below that holds in Act III (M26: par 260 s, pilot 188–205 s), but Act I pars sit 2–3× above the pilot, because those sorties still fly short.
- **Average human (design est.)** is a planning estimate for an average phone pilot, not a measurement: 20 s transit, 13 / 15 / 16 s per required bandit by act plus a 10 s approach per air phase, 10 s per ground target, 12 s per beacon, recon at 1.25× each dwell plus 10 s per point, escort/defend holds ×1.05 and signal holds ×1.25 plus 10 s on station (and 10 s per hazard target), 45 s per chase, 0.36 s per ace hull point, 4 s per phase change, and a phase cut short by a "now" twist counted up to the twist. The tutorial counts 20 / 10 / 20 s for its three teaching steps.
- **Live measurements** are the coordinator's scripted-pilot runs in Studio (below). They are the only measured numbers here.

The manifest and the par/estimate tables are generated from the final catalog (`MissionPacing` supplies the average-phone design estimate; `MissionScore` supplies par) by `bun tools/relay-tables.ts` (after `bun run test:offline`; `--check` fails when they are stale). Do not edit them by hand. Each phase lists its staggered groups, timed holds, hazards and raiders: "raiders 1 + 2 at 60%" means one at phase start and two more when the phase is 60% done.

<!-- relay-tables:begin (bun tools/relay-tables.ts) -->

| # | Mission / composition | Required phase sequence |
|---|---|---|
| 1 | FIRST FLIGHT — Varda training islands | Practice short turn and pitch taps → Cycle to the training target → Lock and hit the training radar → Intercept three bandits |
| 2 | IRON COAST — Iron Coast five quays | Intercept the three-bandit screen → Destroy five warehouses (raiders 5) → Destroy the ace (165 hull, 3 stages) |
| 3 | FOX TRAIL — Fox switchback | Follow Teal's beacons → Locate Teal's receiver below the rim → Clear scout flight alpha (2 in 2 groups; raiders 1 at 50%) → Teal's river run: stay under 320 → Clear scout flight bravo (3 in 2 groups; raiders 1 at 50%) → Guide recovery onto the receiver (20 s) |
| 4 | STATIC QUARTERS — Hidden quarters bowl | Scan the quarters: stay under 380 → Destroy the hidden rim radar (raiders 1) → Follow the quarters service road → Fend off the response flight (5 in 2 groups; raiders 1 at 50%) → Send the staff list to Varda (20 s; raiders 1) |
| 5 | ORCHARD LINE — Teklan orchard terraces | Cover the orchard evacuation trucks (100 s; raiders 2 + 2 at 50%) → Drive off the patrol leads (raiders 1 at 50%) → Check the evacuation road is empty → Pass the families' names to Varda (20 s) → Bring the seed tin toward the rim |
| 6 | GRAIN SHADOW — Grain valley irrigation | Follow the farm irrigation channel → Mark fuel silos below 400 → Destroy three fuel silos (raiders 1 + 1 at 34%) → Clear the orchard patrol (5 in 2 groups; raiders 1 at 50%) → Copy the fuel ledger before leaving (20 s; raiders 1) |
| 7 | DUST WEATHER — Dust courier narrows | Run the dust pass under 400 → Find the courier's trail in the dust → Strip the courier's escort (5 in 2 groups; raiders 1 at 50%) → Catch the courier before the plateau (escapes after 90 s) → Carry the courier packet toward Varda |
| 8 | RIM SWITCH — Varda tower siege | Protect Varda's control tower (110 s; raiders 2 + 1 at 35% + 2 at 65%) → Mark the apron spotters → Counter-attack the spotter radars (raiders 1 at 50%) → Catch the retreating flight (raiders 1 at 50%) → Send the restored tower code (15 s) |
| 9 | STATIC HORIZON — Vulture moonlit bowl | Follow the night approach lights → Find Vulture Lead's guard-channel source → Clear the night patrol (3 in 2 groups; raiders 1 at 50%) → Draw Vulture Lead onto the open channel (20 s; raiders 1) → Defeat Vulture Lead (200 hull, 3 stages; raiders 1 + 1 on its calls) → Mark Vulture Lead's recorder |
| 10 | PLATEAU COLD — Kiro abandoned mine | Scan Node Kiro (hold fire) ⇢ *twist* Break the camp's intercept (4 in 2 groups; raiders 1 at 50%) → Finish the archive scan (raiders 1 + 1 at 40%) → Cut Node Kiro's transmitter ⇢ *twist* Trace the camp radar's command channel (20 s; directed; raiders 1 + 1 at 50%) → Kill the camp radar (directed; raiders 3) → Intercept the blind response (raiders 1 at 50%) |
| 11 | SIGNAL HARVEST — Twin ridge relay saddle | Destroy relay Node Lira (raiders 1) → Clear the alert flight (raiders 1 at 50%) → Destroy relay Node Merel ⇢ *twist* Follow the farm road north to Sable → Destroy relay Node Sable → Clear Sable's guard flight (raiders 1 at 50%) → Relay Teal's packet from the west ridge (90 s; raiders 2 + 2 at 50%) |
| 12 | OPEN FIELD — Open field refugee corridor | Escort the loyalist transmitter truck (90 s; raiders 2 + 2 at 30%) ⇢ *twist* Check the mill road for refugees → Cover the reroute along the mill road (65 s; raiders 2 + 2 at 50%) → Occupy the orchard airspace (6 in 2 groups; raiders 2 at 50%) → Test the truck's new relay link (20 s; raiders 1) → Lead the relief crew to the truck |
| 13 | STAGING FARM — Staging farm rail yard | Follow the rail spur to the staging farm → Scan the staging farm low (raiders 1 + 1 at 50%) → Destroy four fuel silos (raiders 1 at 50%) ⇢ *twist* Break the plateau reinforcements (4 in 2 groups; raiders 1 at 50%) → Destroy the farm relay → Hold off the raiders (raiders 1 + 1 at 34%) → Send the staging ledger to the cells (20 s; raiders 1) |
| 14 | ANTENNA ROW — High relay crossing | Cross the four saddle beacons → Destroy three plateau antennas (raiders 1 + 1 at 50%) ⇢ *twist* Find the saddle-road replacement mast → Destroy the mobile mast → Clear the perimeter CAP (4 in 2 groups; raiders 1 + 1 at 50%) → Hold the saddle: confirm the row is dark (60 s; raiders 2 + 2 at 40%) |
| 15 | LOYALIST WINDOW — Loyalist broadcast common | Hold the broadcast link (90 s; 2 jammers freeze it; raiders 2 + 2 at 30%) → Hold the second intruders (7 in 2 groups; raiders 1 at 30% + 2 at 60%) → Follow the garrisons' reply beacons → Confirm the garrisons have stood down (raiders 1) |
| 16 | STORM WALK — Storm river divide | River gates: stay under 400 → Identify fuel stores in the rain → Destroy three remaining silos (raiders 1 at 34%) ⇢ *twist* Catch the storm patrol (5 in 2 groups; raiders 1 at 50%) → Destroy the forward relay → Read the dead relay's last traffic (80 s; raiders 2 at 35% + 2 at 70%) |
| 17 | AURORA RELAY — Aurora crown array | Destroy the plateau relay (raiders 1) → Clear the aurora intercept (4 in 2 groups; raiders 1 at 50%) → Orbit to receive the archive (90 s; raiders 2) ⇢ *twist* Find the jammer under the array → Destroy the aurora jammer → Clear the jammer's escort (raiders 1 at 50%) → Resume the receive orbit (50 s; raiders 1 + 1 at 40%) |
| 18 | RIDGE ACE — Vulture searchlight ridge | Climb into Vulture Two's searchlights → Mark a safe ridge pickup site → Clear his wingmen (4 in 2 groups; raiders 1 at 50%) → Defeat Vulture Two (260 hull, 3 stages; raiders 1 + 1 on its calls) ⇢ *twist* Protect the marines' pickup on the ridge (45 s; raiders 2 + 2 at 50%) → Relay Vulture Two's testimony (20 s) |
| 19 | HARBOR RUN — Military quays and canal | Scan the quays; spare the city (raiders 1) → Destroy three harbor warehouses (raiders 1 + 1 at 34%) ⇢ *twist* Break the early CAP (2 in 2 groups; raiders 1 at 50%) → Trace the workers' escape lane (raiders 2) → Escort the harbor workers (40 s; raiders 2) → Clear the harbor CAP (4 in 2 groups; raiders 1 at 50%) → Open the harbor rescue frequency (20 s; raiders 1) |
| 20 | FRACTURE LINE — Eastern wing divided harbor | Shatter the eastern wing (9 in 3 groups) → Scan the launch's exit (raiders 1) → Cover the evidence launch (110 s; 2 bank guns; raiders 2 + 2 at 50%) → Mark the open-water rendezvous → Confirm the evidence handoff at sea (20 s) |
| 21 | CITY NIGHT — Black canal city | Follow the dark canal through the city (raiders 1) → Mark the dish above the apartments (raiders 1) → Destroy the broadcast relay (raiders 2) → Hold off the escort flight (4 in 2 groups; raiders 1 + 1 at 50%) → Confirm the dark tower is silent (60 s; raiders 2 + 2 at 40%) → Cover the repair launch (45 s; raiders 2) → Mark the repair crew's district route (raiders 1) |
| 22 | HARBOR FOG — Five fog fuel piers | Find the depots through the fog (raiders 2) → Destroy five fuel depots (raiders 2 at 40%) → Follow the empty fuel piers (raiders 2) → Clear the fog patrol (4 in 2 groups, flanking; raiders 1 at 50%) → Cover the harbor inspection launch (40 s; raiders 2) → Verify the last two fuel hoses are dry (raiders 2) → Report the escape fleet is out of fuel (20 s; raiders 1) |
| 23 | OCEAN CLEAR — Frigate ring over deep water | Defend the command frigate (90 s; raiders 2 + 2 at 35% + 2 at 70%) → Check the gap between the frigates (raiders 1) → Clear the platform command flight (4 in 2 groups, flanking; raiders 1 at 50%) → Fly the blockade's outer beacons (raiders 1) → Cover the blockade inspection launch (50 s; raiders 2) → Report the blockade is closed (20 s) |
| 24 | PLATFORM FIRE — Storm platform trident | Low sea approach: under 360 (raiders 1) → Destroy three platform warehouses (raiders 1 + 1 at 34%) → Clear the storm patrol (5 in 2 groups; raiders 1 at 50%) → Find the tanker in the storm shadow (raiders 1) → Stop the escaping fuel tanker (escapes after 90 s; raiders 2) → Escort the deck crew's rescue launch (50 s; raiders 2) → Report the platform fuel chain is broken (20 s; raiders 1) |
| 25 | CITY DAWN — Dawn beachhead | Cover the landing craft to the beach (80 s; raiders 2 + 2 at 50%) → Hold the first intercept (3 in 2 groups; raiders 1 at 50%) → Mark the safe route off the beach (raiders 2) → Hold the second intercept (3 in 2 groups, flanking; raiders 1 + 2 at 50%) → Destroy the beach relay → Confirm both beach exits are held (20 s; raiders 1) |
| 26 | FRACTURE LAST — Civic plaza blackout | Break the Marshal's wing (8 in 2 groups, the second at 50% of the phase, flanking; raiders 2 at 60%) → Scan the signal below the skyline → Triangulate Rusk's transmission (40 s; raiders 2 + 2 at 40%) → Follow the loyalists' city corridor → Protect the parliament quay launch (45 s; raiders 2) → Cover the witness launch to parliament (30 s; raiders 2) |
| 27 | BROKEN RELAY — Coastal parliament sunrise | Clear the Marshal's wingmen (raiders 1 at 50%) → Destroy the final broadcast relay (raiders 1) ⇢ *twist* Break the Marshal's personal escort (flanking; raiders 1 at 50%) → Mark Rusk's emergency landing strip → Defeat the Air Marshal (320 hull, 3 stages; raiders 2 + 2 on its calls) → Climb to Teal's clear broadcast line → Broadcast Teal's evidence coastwide (60 s; raiders 2 at 30%) |

| # | Par | Average human (design est.) | | # | Par | Average human (design est.) | | # | Par | Average human (design est.) |
|--:|--:|--:|---|--:|--:|--:|---|--:|--:|--:|
| 1 | 95 s | 2.2 min | | 10 | 210 s | 4.4 min | | 19 | 290 s | 5.9 min |
| 2 | 180 s | 3.2 min | | 11 | 285 s | 5.6 min | | 20 | 345 s | 6.9 min |
| 3 | 220 s | 4.6 min | | 12 | 300 s | 5.9 min | | 21 | 315 s | 6.1 min |
| 4 | 210 s | 4.2 min | | 13 | 245 s | 5.1 min | | 22 | 305 s | 6.0 min |
| 5 | 265 s | 5.0 min | | 14 | 265 s | 5.1 min | | 23 | 320 s | 6.0 min |
| 6 | 210 s | 4.2 min | | 15 | 285 s | 5.9 min | | 24 | 305 s | 6.1 min |
| 7 | 215 s | 4.5 min | | 16 | 300 s | 5.9 min | | 25 | 295 s | 5.8 min |
| 8 | 270 s | 5.0 min | | 17 | 275 s | 5.5 min | | 26 | 310 s | 6.4 min |
| 9 | 250 s | 4.8 min | | 18 | 295 s | 5.9 min | | 27 | 325 s | 6.7 min |

Design-estimate campaign total for the average pilot: about 143 minutes of flying.

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

Those historical scripted runs landed Act I at 1–2 min, Act II at 2.5–3.5 min and Act III at 3–4 min. They predate this structure pass. No human or phone run has measured the new objective sequences yet.


## Normal threat before and after

Values are Act I / Act II / Act III. Before is PR #37 Normal at `27ca530`; after is this pass's Normal. M1–M4 use the separate gentle gate.

| Rule | PR #37 Normal | New Normal | New Ace |
|---|---|---|---|
| Hostile hit damage | 10 / 12 / 13 | 6 / 7 / 7.5 | 10.5 / 12.25 / 13.125 |
| Lone-bandit flight gate (s) | 14 / 13 / 15 | 22 / 20 / 20 | 18.7 / 17 / 17 |
| Maximum flight divisor | 2 / 2.5 / 3 | 1.5 / 1.75 / 1.75 | 3 / 3.5 / 3.5 |
| Full-flight windup spacing (s) | 7 / 5.2 / 5 | 14.67 / 11.43 / 11.43 | 6.23 / 4.86 / 4.86 |
| Flight threat cap | 1 / 2 / 2 | 1 / 1 / 1 | 2 / 2 / 2 (M1–M4: 1) |
| Required bandit hull | 100 / 130 / 160 | 80 / 90 / 100 | 108 / 144 / 160 |
| Ace hull (M9 / M18 / M27) | 300 / 400 / 500 | 200 / 260 / 320 | 320 / 416 / 512 |
| Ace reload (s) | 9 / 8 / 7 | 15 / 15 / 15 | 7.5 / 7.5 / 7.5 |
| Ace missiles per launch | 1 / 1 / 2 | 1 / 1 / 1 | 1 / 1 / 1 |

M1–M4 use a gentle flight gate of 22 / 1.25 = 17.6 s on Normal. The opening keeps one flight threat on every difficulty. Aces fire separately from the flight cap and add 2 hull damage per hit. Radar-directed phases halve the flight gate. Missile flight, seeker behavior, evade timing, flares, pause/ack and the radio queue are unchanged by this review revision; PR #42 owns hostile missile flight.

## Difficulty before and after

Multipliers are relative to each version's Normal, so use the absolute table above for comparison. Easy's absolute damage is 3.6 / 4.2 / 4.5 and required-bandit hull is 48 / 54 / 60.

| Scale / behavior | Easy before → after | Normal | Ace before → after |
|---|---|---|---|
| Hostile damage | 0.6 → 0.6 | 1 | 1.4 → 1.75 |
| Flight gate / bandit reload | 1.25 → 1.25 | 1 | 0.7 → 0.85 |
| Ace reload | 1.25 → 1.25 | 1 | 0.7 → 0.5 |
| Maximum flight divisor | 1 → 0.8 | 1 | 1 → 2 |
| Threat cap | 1 → 1 | 1 | 1 → 2 (M1–M4: 1) |
| Bandit hull | 0.75 → 0.6 | 1 | 1 → 1.35 Act I, 1.6 Acts II–III |
| Ace hull | 0.8 → 0.8 | 1 | 1.3 → 1.6 |
| Windup / missile turn / break chance | 1.3 / 0.8 / 0.5 unchanged | 1 | 0.8 / 1.2 / 1.3 unchanged |
| Protected-objective drain | 0.75 unchanged | 1 | 1.25 unchanged |
| Bandit breaks and flares / ace salvo / extra raider per wave | Act tuning / single / none | Act tuning / single / none | Always / pairs → single / +1 |
| Score | 0.85 unchanged | 1 | 1.2 unchanged |

`MissionPacing.ContactWindows` builds a per-mission contact model from the same duration estimates as the table above. Required-air contact tapers as kills accrue; optional raiders arrive at their authored progress shares, then clear at the act's per-bandit time after 10 s acquisition. Ace calls are modeled at thirds of the boss fight. The balance spec applies the real flight gate and divisor to each second, 60% firing opportunity (nose/range/threat-cap availability), and 50% connecting missiles for an average phone pilot using some evades/flares; ignoring warnings raises connections to 80%. Ace launches are counted separately at their reload and +2 damage. The model does not simulate seeker flight or collision, and assumes the same objective pace for both pilots.

The **two-sided design target** is 40–70 hull lost in every Act III mission: roughly **30–60 remaining**, enough pressure to matter without a spike. Ignoring missile warnings must cost at least 64 hull on each Act III sortie and be lethal in M27. Current estimates: M19 42.3 lost, M24 40.7, M26 48.3, M27 69.6 (111.3 ignoring warnings). The earlier finales estimate 30.8 lost in M9 and 54.1 in M18. These are design estimates, not measured survival rates or player evidence; live phone validation remains with the coordinator. Historical PR #37 hull readings are not after measurements.

The review revision gives **28 of the 54 new or relocated flight beats** raiders, plus contact on the existing M21/M24 approaches and M24 tanker chase. All seven new Cover/Protect beats begin with two raiders and use the existing actor drain: an abandoned actor can be lost on Easy, Normal or Ace; clearing the raiders preserves it. Quiet signal holds are at most 20 s. M10 traces for 20 s under directed raider fire and receives a second raider at halfway. M7 closes on a homeward route; other closers include fights, scans, routes and the final witness escort. No new objective kinds are introduced.

Catalog assertions limit objective labels to 40 characters and phase radio (beats, chatter, twists, hazards, group calls and ace lines) to 72. The objective counter precedes its label, protecting it from end truncation in PR #38's narrower phone box. Parked truck/launch actors remain visible during the narrated signal and route handoffs; M26's defense and escort share their starting point. M15's garrison scans and M22's pier scans use fresh positions.

## Original Blender assets and performance bounds

`tools/build-relay-assets.py` reuses the project's canonical material and corner-normal export functions. It authors these original assets from primitives and evaluated meshes:

| Asset | Triangles | Material meshes | Bounds in studs |
|---|---:|---:|---|
| Communications relay mast | 828 | 5 | 44 × 90 × 44 |
| Fuel/grain silo | 960 | 6 | 42 × 72 × 42 |
| Utility/radio truck | 640 | 5 | 18 × 33 × 35.2 |
| Evidence harbor launch | 244 | 5 | 26 × 37 × 57 |

The generator and four exact runtime mesh JSON files are committed. Rebuild with Blender in background mode, then `bun run build`. Blender projects, GLB files and lit inspection PNGs remain regenerable local outputs. All four `.blend` files were reopened and GLBs round-tripped against exported bounds within 0.001 studs. The runtime follows the existing server-generated static-content path, preserves corner normals and material centers, and clones cached material meshes. Missing/malformed data fails explicitly. A platform mesh capability failure warns and produces a visible primitive fallback labeled `GeometrySource=Fallback`; that fallback is **not** a successful mesh QA result.

The live-aircraft budget is enforced by the server, not just authored: at most **seven hostile aircraft alive at once on every difficulty** (`WavePlan.Budget`; Ace's extra raiders wait for the same slots). Missions 3–27 request every bandit group and raider wave through a queue (`WavePlan.Admit`); what does not fit waits, bandits before raiders, until kills free a slot, and the next staggered group is not due while one is still waiting. The ace and a courier spawn directly, and a jet withdrawing at a phase change (disabled, silent, gone within 4 s) is outside the count. Missions 1–2 keep their legacy spawns (at most five raiders). `MissionCatalog.PeakAircraft` computes each phase's true demand without the budget: every group a timer can send with no kills, less the bandits that must be down for later events, plus every raider wave whose trigger has been reached, with raiders never dying. `RelayCampaign.spec` flies every phase second by second under these rules, for an idle pilot and a slow one, on Normal and Ace, and checks that the budget holds and every phase still clears.

Phases whose own demand passes the budget, so the server holds the excess back (pinned by the spec):

| Phase | Demand (Normal / Ace) | What the budget does |
|---|---|---|
| M8 Protect Varda's control tower (5 raiders in 3 waves) | 5 / 8 | Ace only: the eighth aircraft waits for a slot. |
| M20 Shatter the eastern wing (9 in 3 groups) | 9 / 9 | With no kills, the third group's last two wait until two bandits are down. |
| M23 Defend the command frigate (6 raiders in 3 waves) | 6 / 9 | Ace only: the last two aircraft wait for slots. |

Mid-phase reinforcement rule (catalog contract in `RelayCampaign.spec`): every M3–M27 `required_air` or `required_ground` phase with two or more targets has at least one `reinforce` wave. The exceptions are:

- **Single-target strikes and intercepts** (count 1: M4, M10 ×2, M11 ×3, M13, M14, M16, M17 ×2, M21, M25 and M27 relays, radars and masts). A kill-fraction wave could only arrive with the completing kill, so they carry opening raiders or none, and the contract forbids an unreachable `reinforce` on them.
- **Budget-full phases**: M20's nine-bandit wing. Its bandits alone fill the budget, so a raider wave could only be held back. The contract checks that adding one would pass the budget.
- **Legacy Missions 1–2**, which keep their original hard-coded flows.

The reinforcement contract is retained: multi-target strikes and required-air phases still bring a mid-phase raider wave, with the same M20 budget exception. M21 now has four required bandits rather than eight, so its demand (5 Normal / 6 Ace) fits the budget and it leaves the overflow exception set. Flight-only recovery and inspection phases add raiders where authored, without changing the combat reinforcement contract. Runtime queue admission now holds every difficulty to seven aircraft.

The other authored bounds: eight player missiles in stock, a flight-wide hostile launch gate and threat cap, at most five required ground targets, and fewer than 400 scenery/target BaseParts. Scene/asset tests assert these bounds when run in Roblox. New flat land uses nine or fewer material slabs instead of filling millions of terrain voxels. Roads split below the engine's 2048-stud part limit. Legacy island worlds remain intact. One render listener exists per active cinematic or navigation cue, and both disconnect on unmount. Static geometry templates persist by asset kind; mission clones and cinematics do not accumulate.

These are design/definition bounds, not measured device FPS or memory figures. Physical phone/console performance and replication remain live QA items.

## Validation and Studio handoff

Completed for this pass:

- `bun install --frozen-lockfile`.
- `bun run build` — all TypeScript/React Lua and Roblox Jest specs compile.
- `LUAU_BIN="/Users/pelicannurse/.t3/worktrees/test app/t3-b4a927bc/build/offline-luau/luau" bun run test:offline` — **321 / 321** pure compiled-domain contracts pass. These cover every authored mission sequence and flight volume with legal controls, the 4–7 beat and trimmed design-duration contracts, difficulty pressure, aircraft budgets, reinforcement exceptions, phase transitions, scoring/par, progression, deadline, protected loss, story and input rules. These are unit simulations, not gameplay evidence.
- `bun run docs:relay-tables`, then `bun run docs:relay-tables --check` with the same `LUAU_BIN` — generated manifest, par and estimates match the catalog.
- `bun run docs:world-counts --check` with the same `LUAU_BIN` — the per-mission world counts in [world-realism.md](world-realism.md) match the world plans.
- `git diff --check`.

No Studio, Roblox Jest, Rojo server, or live playtest was launched for this implementation. Historical place packaging and Blender/GLB checks belong to the earlier asset pass.
The offline runner adapts compiled module imports to filesystem `require`, provides only minimal assertion functions, and constructs inert vector/camera values for the unused menu configuration. It does not emulate the engine, run Roblox Jest, or fake a mission result. Use the official [Luau releases](https://github.com/luau-lang/luau/releases) executable and set `LUAU_BIN=/absolute/path/to/luau`, or place it at `build/offline-luau/luau`. No binary is committed. The compiler must run before the offline runner; `test:offline` does that.

**Historical live evidence (before this pass):** actual engine Jest, sequential M1–M27, all28 rendered three-beat scenes/finale, protected-objective loss and visible Retry, successful no-evade escort replay, slot isolation/unlock/replay/teardown, and final compact/notched/portrait presentation checks. A Rojo server was not used. Published cloud/rejoin and physical device/gamepad behavior remain unverified.

To repeat QA under a new parent-granted exclusive Studio lease:

1. Run `bun run test:roblox`; inspect the real Jest JSON/log. In addition to the campaign domain specs, `RelayWorld.spec` builds/disposes every mission and requires real Blender geometry, exact targets, safe anchored parts and bounded instances. Existing baseline suites remain included, with campaign expectations updated to v3/27 missions.
2. Open `build/skybreak.rbxlx` (one production place). Verify new meshes replicate with `GeometrySource=Blender`. Rebuild/restart any Rojo mapping only under the lease.
3. Use a fresh session slot. Install `tools/playtest-relay.client.luau` as a normal LocalScript. Launch each mission through the real menu and story. The persistent pilot computes only legal stick/throttle and invokes the normal controller target/missile/evade methods. It never moves an aircraft directly or alters health, timer, kills, objectives, or results. It completed all27 genuine sorties in the recorded run.
4. Inspect `PlayerScripts.BrokenRelayQA`: every attempt records server outcome, elapsed time, kills, ground kills, minimum health, protected health, phase sequence and input-command counts. Save genuine logs/screenshots. Require 27 actual Completed results and the finale; fix failures rather than changing success conditions for evidence.
5. Manually verify touch/keyboard/gamepad, 320×240 and phone portrait/landscape, story skip/pause/motion/text controls, failed escort, 900-second timeout, pause/resume (clock frozen, 5-minute cap), retry, locked remote rejection, completed-mission replay, four-slot isolation, migration fixtures, return cleanup and repeated launch/recap counts. Cloud persistence/rejoin requires a published test experience and cannot be proven with unpublished session slots.

## Remaining limitations

The original 27 objectives, asset replication and representative presentation/input paths were exercised in the engine before this pass. Minimum tested gameplay safe area is319×181/320×182; smaller usable roots are not claimed. The pilot proves feasibility with ordinary controls; it does not replace physical mobile/console balance testing. Protected damage is deliberately an analytic suppression model tied to nearby server-owned enemies; it is not a projectile collision simulation. Scenery uses readable native shapes and material colors, with no texture or voice-acting dependency. Briefings, debriefs and story bridges have been revised to explain the complete phase plans. Published DataStore and physical device validation remain outside offline scope.
