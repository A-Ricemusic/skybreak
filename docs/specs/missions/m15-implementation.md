# M15 SILENT STREETS — implementation review

Based on D11 #192, refreshed through `91d882fcd2061dd26ced131d872af90d6d8d0924`, on main `0450491`. Requires missions 11–14 (#189/#191/#195/#196) before sequential campaign launch. This branch does not enable those missions or merge their work. No Studio, Roblox Jest, Player test, audio upload or Blender work was performed.

## Phases

| Phase | Goal | Clock | Failure |
|---|---|---|---|
| City support | 2,000 raw points and command relay destroyed; keep all three squads alive | Full 600 seconds even above threshold | Insufficient score, intact relay, squad loss or player destruction |
| Retaliation | Destroy six required bombers | Fresh 600 seconds; ends on sixth kill | Bomber reaches city endpoint, expiry or player destruction |

Optional runway repair/rearm pauses simulation and objective time, uses landing/takeoff clocks and weapon menu. Finite stock: 80 missiles, 1,200 gun rounds, 16 special charges. Service northbound at the dormant airfield; no change to existing flight or global ammunition.

## Targets and points (Normal, before uncredited ally kill)

| Group | Count | Points each | Total |
|---|---:|---:|---:|
| Existing command relay | 1 | 100 | 100 |
| Unresolved generic ground slots | 52 | 45 | 2,340 |
| Gated generic ground reserves | 9 | 40 | 360 |
| Parked transports | 7 | 100 | 700 |
| Routed helicopters | 4 | 80 | 320 |
| Attack jets | 2 | 60 | 120 |
| City fighter | 1 | 150 | 150 |
| NIGHTWARD optional ace | 1 | 240 | 240 |
| Additional squad attackers | 12 | 60 | 720 |
| Retaliation cover | 6 | 60 | 360 |
| Required bombers | 6 | 160 | 960 |
| **Total** | **101** | | **6,370** |

The first 53 ground contacts reconcile 2,440, and the seven transports are separate. These are explicitly provisional generic armour slots from the existing world, not claimed tank/SAM/AA subtype counts. No unresolved subtype inventory has been invented as observed evidence. Additional aircraft are owner-directed pressure beyond the reference. Routed helicopters have a separate two-slot ceiling within ten total aircraft to preserve pursuer admissions. Four LANTERN aircraft share one optional kill; required targets, bomber-role contacts and aces are ineligible, with zero player credit.

| Rank | C | B | A | S |
|---|---:|---:|---:|---:|
| Provisional raw points | 2,000 | 3,200 | 4,000 | 4,930 |

4,930 is the observed S run, not an observed cutoff. Maximum excludes difficulty bonus aircraft and is before the uncredited allied kill.

## D-600–D-603 assumptions and review limits

The arch, avenue and relay squads move 600 studs in 60 seconds after two, two and one designated contacts respectively are destroyed. Clearing the arch releases nine optional preallocated reserves. These are original gates, not reconstructed footage predicates. Every route is at Y=98 (actor bottom 95.5); the relay endpoint is (2600,98,-4500), outside the surviving foundation, and the arch endpoint is (-3840,98,-2700), outside the crown's overhead footprint. The avenue route moves to X=-1500 to avoid an uncleared ground contact and its foundation. The regression samples each second of all routes at the actor centre and footprint corners against authored terrain and solid boxes, with three studs of clearance beneath the actor, then checks the shared D5 LOS envelope and damage at each secured endpoint after relay removal.

`M15Fairness.spec` replaces the assumed 70-second removals and incorrect 180-second ingress bound. It uses actual arrival triggers, WavePlan admissions, D5 range/warning/reload/damage, FlightMath stepping at cruise with NavigationPilot rate commands, weapon acquisition/cone/LOS, missile cooldown/speed/lifetime/damage, difficulty hull scaling, and BomberRules sampled formation routes. Raider flares and pressure breaks consume otherwise successful shots. Ignored squads lose before the city clock expires; the attentive pressure-only scenario clears all twelve attackers without losing a squad on each difficulty. A separate saturated queue regression checks optional route admission limits and later pressure admission; it does not assume queued pairs spawn immediately.

The bomber route remains northwest → airfield-side bend → broadcast district, speed 55, below 900 altitude. The six-ship formation remains simultaneous: the cruise-control scenario intercepts every moving hull from all four airspace corners before the route endpoint on Easy/Normal/Hard. At (14000,14000), the distance to initial ingress alone exceeds 226 seconds at cruise, before turns; this is not the intercept time because the bombers move toward the player. Difficulty ordering is asserted through completion time, hostile flight-gate spacing and strictly decreasing survival time under neglect. Worst corner completion is 195.9 seconds Easy / 223.5 Normal / 223.5 Hard; cover gates are 17.86 / 11.43 / 4.86 seconds. Pressure-only remaining squad health is 380/530/480 Easy and 340/430/410 Normal/Hard. Neglected bombers escape or incoming cover destroys the player. Incoming cover uses actual difficulty-scaled flight gates, threat caps, windup, reload, aim/range gates, damage and finite rechargeable evade charges.

**Modelling limits:** these are deterministic offline capacity scenarios, not a complete CombatService or Player test. Squad attackers approach a stationary overhead firing station at D5 speed, then get continuous clear-LOS strikes at maximum cadence; real repeated passes and terrain avoidance are not simulated. Pressure-break losses conservatively discard an arriving missile at most once per break cooldown; the model does not integrate their evasive trajectories. Optional city aircraft/ground scoring are assumed dealt with separately; city pressure-only success does not demonstrate a complete 2,000-point sortie or exclude queue starvation when optional aircraft are ignored. Bomber entry assumes runway rearm has restored the authored stock, initial altitude 850 and the least helpful heading; no special, gun or allied damage is credited. Guided hits use worst opening-range transit time and require initial LOS; full homing/target sweep and subsequent occlusion are not integrated. Cover is an exposure envelope while the player is in missile range, with all shots hitting unless a correctly timed finite-charge evade decoys them; transit cover geometry, independent per-enemy concurrency, ace pressure, collision and actual human reactions are not simulated. No guarantee of complete-sortie fairness or phone usability follows from these scenarios. Studio/Player acceptance remains necessary.

Score-phase required IDs are an opt-in shared extension. Only configured required ground IDs can be admitted; required kills do not advance the score phase early. Expiry checks the existing server kill set plus raw score. Existing phase-first deadline ordering remains: a hit exactly at expiry is late, and tests pin this boundary. Settlement requires both phases, six air kills and one required ground kill; server-owned phase completion remains authoritative.

Story uses `MISSION_STORY_TEXT[15]`, the remapped Broken Relay city chapter: ORDER 0001 already named Rusk in M14; M15 silences his relay. Original subtitles only. No new assets or audio uploads.

## Validation

`bun install --frozen-lockfile`, `bun run build`, `LUAU_BIN=… bun run test:offline`, voice/story text manifest generation, catalog snapshot update, and `LUAU_BIN=… bun run validate:offline` exited 0. Current M14-based gate: 1,170 Luau contracts, 19 catalog snapshots and 124 Python tests. The @rbxts/jest specs compile and run through the offline adapter; Roblox Jest was not run.

M15 replay validation (2026-10-31, base `bd78d0ca`): frozen install, standalone build, test:offline, voice/story/catalog regeneration and full validate:offline with `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau"` each exited 0. Passed 1,170 Luau contracts, four negative loader probes, 468 module compilations, 197 require-graph nodes, 19 catalog snapshots, three QA-pilot scenarios and 124 Python tests. Both loader lists preserve all 109 existing specs plus two M15 specs and checkedRequire. Only M15’s catalog entry changes; all 228 prior voice/story entries and all base decisions (including D-500–D-504) remain unchanged. Inventory: 229 entries / 151 pending recordings. Runtime fixtures use CombatSessionFactory; generalized director Jest assertions compiled only. Studio verified: pending orchestrator run. No Studio, test:roblox or Player tests performed. #197 Merge pending; live by pipeline convention after merge.
