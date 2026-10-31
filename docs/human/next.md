# Next

**M09 arrival regression, 2026-10-30:** Orchestrator reported Studio Jest 1,219/1,220 at `21be233`: the sole failure expected nine generic opening bandits, but D5 authors three required trios at mission times 600/625/650. #185 corrects the test to check exact timed admissions and duplicates, retaining D4 slots and adding grouped/delayed-launch coverage. Runtime remains unchanged: completion requires all nine kills. An offline regression clears early trios without ending the phase. Frozen install, build and full offline validation exited 0 (1,023 Luau contracts, 19 catalog snapshots, 124 Python tests). The director regression compiles but requires the orchestrator’s Studio rerun; this task did not launch Studio or claim a Player test.

Updated 2026-10-30 against main `085373c`. Practice and missions 1–8 are live by pipeline convention; M09 goes live after #185 merges. M10–M18 remain dormant. No Player observation is claimed.

1. **Review and merge mission 9 [#185](https://github.com/A-Ricemusic/skybreak/pull/185).** Prerequisites #178, #180, #182 and #183 are merged. Studio verified: pending orchestrator run; verify sequential M08→M09 unlock, both clocks, carrier service and landing-force defence.
2. **Verify M07/M08 and M09 in the orchestrator's Studio session.** Check canyon ingress/masking, protected mast/bomber timing, beach sectors and carrier deck. Offline coverage does not establish Player quality.
3. **Integrate missions 10–18 in order.** D6 #182 is merged and dormant; activate M10 against the engine plan. Retain provisional inventory/rank assumptions and runtime acceptance gaps.

## Mission 6 beta guide — IRON COAST (Live)

Complete mission 5 then launch mission 6. Verify the remapped Broken Relay chapter and original subtitle-only briefing/radio. Fly north from the airborne start into three military harbour basins; the fish market and worker district are untargetable scenery.

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

Mission 7 #178 is merged; M01–M06/practice behavior is preserved. Run the added M07WorldRuntime Jest spec in the orchestrator’s isolated Studio session: actual build, first-step D-242 success and blocked-route rejection, real terrain masking at ingress/exit, and a 25,000-stud masking line with near-aircraft cover. Confirm retained-pose ingress and 60s first impact (later 25s cycles) at Y=585 absolute. Offline flight covers cruise-speed Y=900/1800/3000, three headings and 3s reaction; challenging but fair phone flight still needs human observation. No Studio was launched by this implementation agent.

M07 review-fix validation (2026-10-30): frozen install, build and full `validate:offline` exited 0; 967 Luau contracts and 19 catalog snapshots passed. Voice manifests regenerated; no audio generated/uploaded. Studio/Player not run by this agent.

## Mission 8 beta guide — OPEN FREQUENCY (Live)

Complete mission 7 to unlock mission 8. Fly NW from the southeast start; the island mast is protected scenery, not a target. Original Broken Relay briefing/radio remains subtitle-only.

- Reach 800 points, then keep fighting until the full 7:00 expires. Expect a fresh 6:00 bomber clock without losing cumulative points.
- Intercept all six bombers approaching from the west in 15-second steps. Any surviving bomber reaching the transmitter fails. Destroying the sixth early must not end the mission; defend until zero. At 0:35 the mast lights cyan and the broadcast starts; the debrief confirms two garrisons standing down.
- 47 finite hostile aircraft; queued population capped at eight in battle/six in intercept (route supports consume slots; ace uses its reserved slot). Three allies share one optional kill without player credit. Score values: ordinary60, ace240, tanker150, radar140, bomber150; max3710. Provisional C/B/A/S:800/1700/2400/2900.
- Verify destruction, <800 at7:00, incomplete intercept at6:00 and penetration failures; verify duplicate kills and retries never duplicate rewards. Check completion persists and mission8 cannot launch before mission7.
- Studio rerun pending: orchestrator reported 1,175/1,176 at `0227c1f`; the staggered-arrival catalog assertion is now corrected, with exact arrival/identity and partial-kill timeout regressions. No Studio or Roblox Jest run by this implementation agent. Orchestrator should verify adopted mast/no duplicate relay, cyan ignition, bomber stream endpoints, clocks, skyline, flight/travel time, phone labels and balance. Support silhouettes use existing route-aircraft stand-ins; service/finite-stock fidelity remains deferred (D-324).

## Engine D6 merged (#182) and M10 activation

D6 integrates repeated artillery, parked/airborne credit ownership, bounded static contact detail and six M10 target types with main’s D4 air budget and D5 lifecycle. Next: orchestrator-owned runtime Jest/Studio checks, phone profiling with 150 contacts, then M10 roster/cadence/ranks and visual acceptance before activation. No mission enables D6.

## Mission 9 beta guide — GREEN BEACON (live after #185 merges)

After #185 merges, complete M08 to unlock GREEN BEACON. Score 2,200 points in the full 10:00 beach strike; reaching the goal early does not skip the clock. Three beach sectors have radar, batteries, bunkers, tanks, launchers, howitzers, AA and SAMs. Use the finite 60 missiles / 1,200 gun rounds / non-recharging special wisely; the area-strike special attacks ground clusters. The offshore carrier offers repeatable optional service in phase 1, refilling weapons while pausing active mission time and preserving damage. Check landing, skip, menu, relaunch and repeat at the actual deck.

At expiry a visible update starts 7:00. Nine required attack jets arrive as three groups of three, 25 seconds apart, targeting the west, central and east landing forces. Clear each sector's two batteries during phase 1 to let its craft advance in phase 2; ground progress is feedback, not a compulsory all-ground-target quota. Each landing force has an original provisional 300-health budget; losing any force fails. All nine aircraft stopped wins; phase timeout or player destruction fails. Allies share one optional kill for the entire sortie and award no player score.

Owner checks pending: readable HUD and beacons under overcast light; sector progress/hit cues; practical interception time and fairness; carrier deck clearance, paused service and finite refill; retry cleanup and duplicate settlement; phone frame rate/load time; approach skyline and target spacing against the accepted reference. No Studio launch, Jest Studio execution, Player observation or visual acceptance is claimed by this implementation agent.

## D7 merged (#184); mission 11 activation next

Review PR #184 after main integration and offline validation. Before M11 activation, author and inspect routes/health/roster, terrain clearance, markers, damage/loss branches and all-safe completion under the orchestrator’s Studio lease. No mission opts in; runtime Jest and Player/phone acceptance remain pending. See D-360–D-363 and the engine plan.

Main integration validation (2026-10-30): frozen install, standalone build and full offline validation exited 0; 1,007 Luau contracts, 19 unchanged catalog snapshots and 124 Python tests. The combined sector/protected-target warning rule passes offline; service-entry runtime regressions compile but remain unrun. No Studio/Player test. Main at integration is `ea0045d` (D5/D6 merged, M08 not merged). D4/D6 admission logic is retained; this main revision has no `concurrentRoutes` option.

## D8 implementation — dormant review candidate

Review the integrated ground ECM/strike service, precision SALVO, elite retreat/recovery and ring sweep contracts (D-400–D-402). Runtime Jest belongs to the orchestrator’s Studio lease. M12 activation, roster/scoring, presentation and world mapping remain separate work; its dependent branch is untouched.

D8 main integration validation (2026-10-30, main `5d84486`): frozen install, build and full `validate:offline` with the prescribed `LUAU_BIN` each exited 0: 1,023 Luau contracts, 19 unchanged catalog snapshots, four loader guard probes and 124 Python tests. All 92 spec registrations match runner imports and retain both parents. No Studio, `test:roblox`, Player tests or uploads performed. D8 remains dormant; M12 dependent branch untouched.

## Dormant D9 follow-up

Review PR #188’s integration with merged D7/D8 and missions 8–9. Keep D9 dormant until M13 activation; validate corridor placement, cumulative navigation holds, phase handoff, scoring and Player/phone readability. Spatial ground ECM requires a separately authored source/validation design before support.

## D10 integration with current main (2026-10-30)

PR #190 remains dormant and unmerged. Main D6–D9 and missions 8–9 are preserved; practice, mission catalog and frozen snapshots are unchanged. Cruise twists remain rejected. The shared sortie identity namespace now also includes protected aircraft and spatial airships; elites use generated runtime identities, with the existing elite retreat lifecycle preserved. M14 activation still needs authored routes/roster/scoring and Studio/Player/phone acceptance. No Studio, Player test or upload was performed. Integration validation passed: frozen install, build and full offline validation each exited 0; runtime Jest compiled only. Main was `f35430f`; mission 10 had not merged.
