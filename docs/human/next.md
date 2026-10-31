# Next

Updated 2026-10-30 against main `9857358`. Practice and missions 1–6 are Live after #179 merges; worlds 7–18 and D3 remain dormant. M06 activates merged D1/D2 contracts. Publish succeeded per CI; no new Player observation is claimed.

1. **Merge D4 [#177](https://github.com/A-Ricemusic/skybreak/pull/177)** after review/checks and updating its base to main. D1/D2/D3 dependencies have merged. Queued air battles, timed bomber interception and protected relay support remain dormant until mission integration.
2. **Finish mission 7 [#178](https://github.com/A-Ricemusic/skybreak/pull/178)** (in review). D3 is merged; retain mission 6 when updating the branch, retain #174's shared one-kill allied budget, and rerun progression/settlement checks. The proposal has a 15:00 three-installation strike and fresh 5:00 canyon escape; roster/ranks are provisional. Runtime canyon sweeps, transition pose, altitude masking and low southbound exit require verification.
3. **Complete engine D5 [#180](https://github.com/A-Ricemusic/skybreak/pull/180)**, following the [engine plan](../specs/engine/missions-06-18-plan.md). Keep opt-in support dormant until a mission deliberately uses it; preserve current campaign behavior.
4. **Complete engine D6 [#182](https://github.com/A-Ricemusic/skybreak/pull/182)** after D5, preserving opt-in support and current campaign behavior.
5. **Integrate missions 8–18 in order.** All worlds are built/dormant (#175/#176), all mission/world specs exist. Mission actors, target identity/count reconciliation, phases, clock/failure/rank rules, unlock/settlement and runtime acceptance remain. M08 uses D4; later engine batches follow the engine plan. Built scenery alone is not a playable mission.

## Mission 6 beta guide — IRON COAST (Live after #179 merges)

After #179 merges, complete mission 5 then launch mission 6. Verify the remapped Broken Relay chapter and original subtitle-only briefing/radio. Fly north from the airborne start into three military harbour basins; the fish market and worker district are untargetable scenery.

- Score at least 3,000 in 15:00 active time. Reaching the goal must hold until expiry; below goal at expiry or player destruction must fail. Check C/B/A/S at 3,000/3,600/4,200/5,000; maximum inventory is 6,800 points before the uncredited allied kill.
- Attack 36 hulls, 40 yard contacts and 18 hull-owned defence components. SAMs warn/fire with the shared difficulty cap. Sinking a hull retires surviving mounts without free mount points; killing a mount first pays once. Three outer cruisers patrol inside native water.
- Use the 60 finite missiles, 1,200-round gun and finite selected special; XLAA is hull-only anti-ship. Return southwest to the land-runway gate, land southbound on runway 18, watch or skip the service, and confirm ammunition restoration, preserved damage and paused objective time. Repeat once; confirm no duplicate targets/credits.
- Six finite waves plus WARDEN LEAD provide 16 hostile aircraft (five above the reference roster). Three wingmen share one whole-sortie kill budget and give no player points. Check sustained pressure, service-entry safety and HUD readability on phone.
- At expiry verify win/failure, points/rank/breakdown, replay/save reload, and mission 7 still locked. Verify no unlock before mission 5 or from forged completion requests.

Frozen install/build and full `validate:offline` exited 0 (958 Luau contracts, 19 catalog snapshots, 124 Python tests).

The orchestrator’s full Studio Jest suite passed 1,133/1,133 at `e5c2fd2`. Real flight feel, reference skyline comparison, load/clear timing and Player/phone checks remain pending; Player/phone not yet observed. No audio or asset upload is needed.

## Owner checks on live missions

- M01/M02: four extra optional fighters each; Normal ranks M01 1560/1200/600/500 and M02 2500/1990/1620/1320. Check Easy completion, Normal pressure and the shared default one allied kill per sortie. Required bombers stay protected from allied kills. Optional queued fighters may never spawn if objectives finish quickly.
- TGT: nearest visible enemy first, then next closest on quick presses; wrap through the list. Turn away from all enemies to check closest-overall fallback. Auto-acquire remains nose-first; tapping a target box should not steer the jet.
- Loading: full-screen cover, jet/progress/tips, readable phone text and reduced motion. Retry and campaign switches should cleanly reset progress.
- M03: nine radars, mission update, southbound return and landing; report mountain appearance, distant terrain and load time.
- M04: after M03, test full/partial/clear jamming, transport escape and final-target victory; report load and cleanup.
- M05: after M04, score 2000 by 10:00; try the green REARM beacon and TAKEOFF / CHANGE WEAPON (including controller). At update, check Vulture cut-in and south escape within 4:00. Ranks S/A/B/C 4000/3000/2500/2000. Report night readability, weather, phone load, results and replay/save persistence. Reported Studio build was 17.30–17.96 s; this is not a phone/Player measurement.

New/changed dialogue stays subtitle-only; no further audio uploads (D-142). Existing approved voice remains. See [blockers](blockers.md) and [per-level checklists](levels.html). This task does not launch Studio or run Roblox Jest.

## Mission 7 review handoff (#178, unmerged)

Main #179 is merged into the branch; M01–M06/practice behavior is preserved. Run the added M07WorldRuntime Jest spec in the orchestrator’s isolated Studio session: actual build, first-step D-242 success and blocked-route rejection, real terrain masking at ingress/exit, and a 25,000-stud masking line with near-aircraft cover. Confirm retained-pose ingress and 60s first impact (later 25s cycles) at Y=585 absolute. Offline flight covers cruise-speed Y=900/1800/3000, three headings and 3s reaction; challenging but fair phone flight still needs human observation. No Studio was launched by this implementation agent.

M07 review-fix validation (2026-10-30): frozen install, build and full `validate:offline` exited 0; 967 Luau contracts and 19 catalog snapshots passed. Voice manifests regenerated; no audio generated/uploaded. Studio/Player not run by this agent.
