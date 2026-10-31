# Next

## D10 / M14 integration

D10 validation: frozen install, build and full offline validation exited 0 (1,007 Luau contracts, 19 catalog snapshots, 124 Python tests). Runtime Jest compiled only; no Studio run.

After review of dormant D10, author M14’s finite cruise/carrier/child roster, score-role values, staggered arrivals and terrain-audited routes using the existing world. Calibrate visual locks, missile/gun hit fairness, impact ordering, low-altitude radar, phone cost and carrier-before-release score totals in Studio/Player. Run the added runtime Jest suite under the orchestrator’s lease; this implementation task deliberately did not launch Studio. D7 #184, D8 #186 and D9 #188 remain separate open work; D10 does not depend on their files.

Updated 2026-10-30 against main `a04fdd6`. Practice and missions 1–7 are live by pipeline convention. M08 will be live after #183 merges; worlds 9–18 remain dormant. No Player observation is claimed.

1. **Review and merge mission 8 [#183](https://github.com/A-Ricemusic/skybreak/pull/183).** D4 #177 and M07 #178 are merged. Studio verified: pending orchestrator run; confirm clocks, protected mast adoption, bomber endpoint loss and sequential unlock.
2. **Verify live M07 in the orchestrator's Studio session.** Check actual-world canyon masking/ingress, Y=585 ceiling and phone flight; offline coverage does not establish play quality.
3. **D5 [#180](https://github.com/A-Ricemusic/skybreak/pull/180) is merged (dormant); complete D6 #182 next**, following the [engine plan](../specs/engine/missions-06-18-plan.md), keeping opt-in support dormant until mission activation.
4. **Integrate missions 9–18 in order.** Worlds and specs exist; actors, counts, timing, failure, ranks, unlock and runtime acceptance remain.

## Mission 6 beta guide — IRON COAST (Live after #179 merges)

After #179 merges, complete mission 5 then launch mission 6. Verify the remapped Broken Relay chapter and original subtitle-only briefing/radio. Fly north from the airborne start into three military harbour basins; the fish market and worker district are untargetable scenery.

- Score at least 3,000 in 15:00 active time. Reaching the goal must hold until expiry; below goal at expiry or player destruction must fail. Check C/B/A/S at 3,000/3,600/4,200/5,000; maximum inventory is 6,800 points before the uncredited allied kill.
- Attack 36 hulls, 40 yard contacts and 18 hull-owned defence components. SAMs warn/fire with the shared difficulty cap. Sinking a hull retires surviving mounts without free mount points; killing a mount first pays once. Three outer cruisers patrol inside native water.
- Use the 60 finite missiles, 1,200-round gun and finite selected special; XLAA is hull-only anti-ship. Return southwest to the land-runway gate, land southbound on runway 18, watch or skip the service, and confirm ammunition restoration, preserved damage and paused objective time. Repeat once; confirm no duplicate targets/credits.
- Six finite waves plus WARDEN LEAD provide 16 hostile aircraft (five above the reference roster). Three wingmen share one whole-sortie kill budget and give no player points. Check sustained pressure, service-entry safety and HUD readability on phone.
- At expiry verify win/failure, points/rank/breakdown, replay/save reload, and mission 7 unlocks. Verify no unlock before mission 5 or from forged completion requests.

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

## Mission 7 verification handoff (#178, merged)

Main #179 is merged into the branch; M01–M06/practice behavior is preserved. Run the added M07WorldRuntime Jest spec in the orchestrator’s isolated Studio session: actual build, first-step D-242 success and blocked-route rejection, real terrain masking at ingress/exit, and a 25,000-stud masking line with near-aircraft cover. Confirm retained-pose ingress and 60s first impact (later 25s cycles) at Y=585 absolute. Offline flight covers cruise-speed Y=900/1800/3000, three headings and 3s reaction; challenging but fair phone flight still needs human observation. No Studio was launched by this implementation agent.

M07 review-fix validation (2026-10-30): frozen install, build and full `validate:offline` exited 0; 967 Luau contracts and 19 catalog snapshots passed. Voice manifests regenerated; no audio generated/uploaded. Studio/Player not run by this agent.

## Mission 8 beta guide — OPEN FREQUENCY (Live after #183 merges)

After #183 merges, complete mission 7 to unlock mission 8. Fly NW from the southeast start; the island mast is protected scenery, not a target. Original Broken Relay briefing/radio remains subtitle-only.

- Reach 800 points, then keep fighting until the full 7:00 expires. Expect a fresh 6:00 bomber clock without losing cumulative points.
- Intercept all six bombers approaching from the west in 15-second steps. Any surviving bomber reaching the transmitter fails. Destroying the sixth early must not end the mission; defend until zero. At 0:35 the mast lights cyan and the broadcast starts; the debrief confirms two garrisons standing down.
- 47 finite hostile aircraft; queued population capped at eight in battle/six in intercept (route supports consume slots; ace uses its reserved slot). Three allies share one optional kill without player credit. Score values: ordinary60, ace240, tanker150, radar140, bomber150; max3710. Provisional C/B/A/S:800/1700/2400/2900.
- Verify destruction, <800 at7:00, incomplete intercept at6:00 and penetration failures; verify duplicate kills and retries never duplicate rewards. Check completion persists and mission8 cannot launch before mission7.
- Studio rerun pending: orchestrator reported 1,175/1,176 at `0227c1f`; the staggered-arrival catalog assertion is now corrected, with exact arrival/identity and partial-kill timeout regressions. No Studio or Roblox Jest run by this implementation agent. Orchestrator should verify adopted mast/no duplicate relay, cyan ignition, bomber stream endpoints, clocks, skyline, flight/travel time, phone labels and balance. Support silhouettes use existing route-aircraft stand-ins; service/finite-stock fidelity remains deferred (D-324).

## Engine D6 merged (#182) and M10 activation

D6 integrates repeated artillery, parked/airborne credit ownership, bounded static contact detail and six M10 target types with main’s D4 air budget and D5 lifecycle. Next: orchestrator-owned runtime Jest/Studio checks, phone profiling with 150 contacts, then M10 roster/cadence/ranks and visual acceptance before activation. No mission enables D6.
