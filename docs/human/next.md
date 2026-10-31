# Beta guide — all 18 missions

1. Merge #197, #198, #199, then #200; #200 targets main.
2. Orchestrator runs Studio verification (pending); owner then plays the full campaign in Roblox Player.
3. Owner full-campaign checklist:
   - Start a fresh slot and complete missions 1–18 in order; after each, inspect results, unlock only the next mission, exit/rejoin and confirm saved progress.
   - Exercise practice, retry after failure, replay an earlier mission, and return to the current mission without losing progress.
   - M01–M05: flight controls, combat/radar, refinery service and escape.
   - M06–M10: canyon/strike objectives, protection, broadcast, beach squads, artillery and service.
   - M11–M14: both airliners, command ring/ejection, evidence plane and all cruise salvos.
   - M15–M17: city squads and bombers; desert column and repair; capital crossing, four wingmen and protected Rusk departure.
   - M18: clear all three generators; descend and level before amber; timed gate, core, cyan escape; duel begins only outside; defeat Rusk within 5:00.
   - Confirm final chapter, ending/results and completed save after rejoin; no mission 19; replay M18 and earlier missions.
   - Repeat representative encounters on Easy/Normal/Hard and phone; record hull, timing, readability, camera/collision and any stalled objectives.
4. Calibrate provisional ranks and duel difficulty from observed play. Offline scenarios are conditional evidence, not Player quality verification.

No Player tests have been performed for this handoff. Historical plans follow.

## M17 beta guide — #199 Merge pending

After M16, launch LAST WING. Earn 2,100 points and survive the full 12:00 capital battle. The eastern runway repairs health and restocks weapons while battle time pauses. Destroying the enemy bridge stops the supply hull route; the witness crossing is independent. Then defeat all four wingmen and wait for Rusk to depart within the 18:00 second phase. Rusk is protected and awards no kill. Check adopted target deletion, naval mounts, bridge clearance, service, optional air queues and withdrawal in Studio. Studio verified: pending orchestrator run. No Player tests performed.

## M16 beta guide — #198 Merge pending

After completing M15, launch DUST ROAD. Score 3,500 through the full 20:00. Clear slots 1–4, 49–52 and 97–100 for the three column legs; southern clearance releases 25 reserves. Protect against the opening trio and trios at 3:00, 5:40, 8:20, 11:00, 13:40 and 16:20. Losing a sector fails. The western runway offers repair, stocks and weapon choice while battle time pauses. Orchestrator: run Studio Jest and inspect target appearance, column routes, reserve visibility, runway clearance and phone performance. Studio verified: pending orchestrator run. No Player tests performed.

# M15 integration priority

M15 replay validation (2026-10-31, base `bd78d0ca`): frozen install, standalone build, test:offline, voice/story/catalog regeneration and full validate:offline with `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau"` each exited 0. Passed 1,170 Luau contracts, four negative loader probes, 468 module compilations, 197 require-graph nodes, 19 catalog snapshots, three QA-pilot scenarios and 124 Python tests. Both loader lists preserve all 109 existing specs plus two M15 specs and checkedRequire. Only M15’s catalog entry changes; all 228 prior voice/story entries and all base decisions (including D-500–D-504) remain unchanged. Inventory: 229 entries / 151 pending recordings. Runtime fixtures use CombatSessionFactory; generalized director Jest assertions compiled only. Studio verified: pending orchestrator run. No Studio, test:roblox or Player tests performed. #197 Merge pending; live by pipeline convention after merge.

Review #197 after #196 merges; orchestrator merges origin/main and runs Studio acceptance. M15 #197 is Merge pending, rebuilt on M14 `bd78d0ca` using only the combined M15 diff after D11 `91d882fc` (M15 commits `e8af0e7a`, `bcafbf7e`, `8197cea3`; D11 merges excluded). Live by pipeline convention after merge. Studio verified: pending orchestrator run. No Studio, test:roblox or Player tests performed. The orchestrator merges origin/main after #196 merges; this branch is not merged here.

## M15 beta guide — SILENT STREETS (In review)

Merge dependencies #192 and M11–M14 (#189/#191/#195/#196) first. Complete M14 to unlock M15; forged later records must not skip any predecessor. Score 2,000 and destroy the marked relay before the full 10:00 expires. Clear the arch/avenue street pairs and relay to move three friendly squads; arch clearance releases nine reserves. Stop the six scheduled pairs attacking the squads; neglect must lose, attentive interception should preserve all squads on Easy/Normal/ACE. Four LANTERN allies share one optional kill, no required kills or player points.

Return northwest to the runway: land northbound, verify repair to full health, finite ammunition refill, weapon selection, independent service clocks and paused objective time. Repeat service and check no duplicate targets/credits. At city expiry, verify a fresh 10:00, six required bombers and six optional cover fighters. A bomber reaching the city must fail; sixth bomber kill wins, even with optional fighters alive. Check C/B/A/S at 2,000/3,200/4,000/4,930, maximum 6,370 before the allied kill. Verify subtitle-only chapter handoffs, relay disappearance, night target readability and phone performance. No Studio/Player result claimed.


# M14 beta guide (in review)

M14 generalized director regression (2026-10-31, #196, unmerged): the owner reported Studio Jest 1,368/1,369, with the generic opening-role assertion expecting five bandits and receiving zero. Source inspection confirms PhaseDirector intentionally excludes `cruiseIntercept`; CombatService steps D10 independently. M14 roots release at phase-active times 20/32/44/56/68s, with later salvos using carrier separation and delayed roots. The spec now exercises actual D10 actors on an isolated tiled floor, checks every authored root/child release before and after its deadline, exact required IDs once, repeated apply/steps, and completion only after the final unresolved actor settles. It also covers immediate, out-of-order and separating cruise fixtures while retaining other phase checks. No runtime or mission data change. Frozen install, standalone build and full validate:offline with the prescribed LUAU_BIN each exited 0 (1,144 Luau contracts, 19 catalog snapshots, 124 Python tests); runtime Jest assertions compiled only. No Studio, test:roblox or Player execution by this agent. Orchestrator rerun remains required; the reported full-suite failure is not claimed fixed by execution here.

PR #194 next: orchestrator reruns Roblox Jest after the complete-session fixture fix, checking arena bounds over real enemy steps and all guided/blind wall, cover and legacy missile sweeps. The implementation agent will not launch Studio or run test:roblox. Keep D13 dormant; M18 activation and observed Player quality remain separate.

M13 replay validation (2026-10-30, base 351d7988): frozen install, standalone build, test:offline, voice/story/catalog regeneration and full validate:offline with the prescribed LUAU_BIN exited 0. Passed 1,118 Luau contracts, four loader guards, 19 catalog snapshots, three relay harness scenarios and 124 Python tests. All 103 prior specs plus M13 are staged and required with checkedRequire retained. Only M13's catalog entry differs; all 215 prior voice/story entries remain unchanged, with 223 total / 145 pending recordings. M12 numeric normalization and every prior decision record are preserved. Studio verified: pending orchestrator run. No Studio, test:roblox, Player tests or uploads performed. #195 remains merge pending.

M14 replay validation (2026-10-31, base e2c7fab2): frozen install, standalone build, test:offline, voice/story/catalog regeneration and full validate:offline with the prescribed LUAU_BIN all exited 0. Passed 1,144 Luau contracts, four loader guards, 19 catalog snapshots, three QA pilot scenarios and 124 Python tests. Both loader lists retain 105 prior specs plus two M14 specs and checkedRequire. All prior voice entries and decisions are preserved; 228 voice/story entries / 150 pending recordings; only M14 catalog changes. No Studio, test:roblox, Player tests or uploads performed. Studio verified: pending orchestrator run. #196 Merge pending; replayed onto merged M13 e2c7fab2.

M14 #196 is merge pending on merged M13 e2c7fab2. Orchestrator Studio acceptance remains pending. Keep normal campaign progression; complete M13 to unlock M14.

1. Offline feasibility witness: pursue the oldest active leaf at cruise160, holding a level turn between releases; all16 leaves intercepted in284.7–285.1s at0.05/0.1s steps with at least162.56s impact margin. It excludes optional-fighter survival and human latency. On the polar coast, follow red required markers. Five early missiles arrive 20–68 seconds into phase one. Fly to the central low corridor; low-radar detection is limited to 1,200 studs, but visible threats remain lockable.
2. Phase two releases two carriers (20/60 seconds), each splitting after 20 seconds into three children, then four independent missiles (110/128/146/164 seconds). Check that separation awards nothing; early carrier kills award300 each and cancel children without synthetic child kills. All required actors must be gone before the next phase.
3. Phase three launches the 200-point weapon after 45 seconds. Ignore the optional high bomber if needed. Any impact, aircraft destruction or unfinished 20:00 clock loses.
4. Check nine optional fighters apply pressure without preventing required admissions. Two allies may collectively kill one optional aircraft, never an intercept; player score must exclude their kills. The strategic bomber has one reserved route slot.
5. Compare raw HUD/debrief/saved scores: ordinary cruise100, carrier300, final200, fighter120, bomber200; maximum2,980 with all children released. Provisional C/B/A/S:1,700/1,850/2,000/2,260. Required-only early-carrier play must total1,700/C (12 actual kills).
6. Orchestrator Studio/Jest and owner Player/phone checks remain required: night visibility, target cycling/lock, actual pursuit and terrain clearance, crowd pressure, station geometry, phase radio, final archive reveal and cleanup/retry. No Studio was launched by this implementation task.


## M13 review and beta guide — retained prerequisite coverage

M13 replay validation (2026-10-30, base 351d7988): frozen install, standalone build, test:offline, voice/story/catalog regeneration and full validate:offline with the prescribed LUAU_BIN exited 0. Passed 1,118 Luau contracts, four loader guards, 19 catalog snapshots, three relay harness scenarios and 124 Python tests. All 103 prior specs plus M13 are staged and required with checkedRequire retained. Only M13's catalog entry differs; all 215 prior voice/story entries remain unchanged, with 223 total / 145 pending recordings. M12 numeric normalization and every prior decision record are preserved. Studio verified: pending orchestrator run. No Studio, test:roblox, Player tests or uploads performed. #195 merged as e2c7fab2; live by pipeline convention.

M13 beta guide (after #195 merges; #191 merged as 351d7988): complete M12, launch EVIDENCE THROUGH THE GREY, hold gun on ravine airship hulls within 900 studs and reach 1,300 before 7:00. Check local navigation-jam clearance and carry-over PAPER ONE damage at the update. During the fresh 15:00, stop all eight required attackers and keep PAPER ONE alive until SAFE. LANTERN may remove one optional escort; required targets stay player-owned. Retry a failure and confirm M14 stays locked until M13 succeeds; a completed M13 unlocks M14. Observe Easy/Normal/Hard fairness, phone target readability and destroyed hull collision cleanup. Studio verified: pending orchestrator run; Player quality remains unobserved.

Dependencies #188, #187, #189, #191 and #195 are merged; M13 is e2c7fab2. Review #196, then run orchestrator-owned Studio acceptance.

On a campaign slot that has completed M12, launch **EVIDENCE THROUGH THE GREY**. Gun controls are the existing opt-in D1 controls. Visually approach airship hulls within 900 studs; 1,200 rounds cover 384 perfect-hit rounds for all 32. Score at least 1,300 by 7:00; reaching the minimum early allows further jammer scoring. Local interference holds Paper One for at most 20 seconds total. At expiry, retain points and switch to 15:00. Destroy eight required attackers while defending the cyan PROTECT aircraft; Two optional escort fighters give LANTERN eligible targets within its combined one-kill budget; VEIL is optional. Maximum player score is 4,040; S remains 2,800 without optional kills. Completion requires both all eight kills and safe arrival. Losing Paper One or missing either clock fails.

Normal beta focus: prioritise the approaching pairs every 30 seconds from 7:00; ten 7.5-damage hits destroy the 75-hull evidence plane. First damage leaves nine hits of headroom. The 600-second route leaves about 180–200 seconds exposed after the update. The offline envelope includes acquisition/pursuit/missile travel and pair clearance at +25/+35 seconds; confirm these assumptions in Player. Check that attentive interception is defensible, neglect loses, gun approaches and labels remain readable in fog, phase handoff preserves hull/nav delay, and TGT never selects Paper One. Compare ingress, one jammer cluster, update and debrief against the accepted reference views before claiming visual fidelity. Studio/Player/phone checks have not been performed for this branch.

# Next

PR #194 priority: orchestrator reruns Roblox Jest on the load-failure fix. The failure was CombatService register exhaustion, not a D12/D13 require cycle. Offline module compilation and emitted-require cycle checks now run in validate:offline. D13 stays dormant; M18 authoring/activation and rendered acceptance remain separate. The branch includes merged D11/D12 contracts, superseding the older exclusion note below.

PR #191: verify Linux validate on the numeric snapshot portability fix before merge; existing runtime acceptance remains pending.

PR #191 merged as 351d7988 with numeric snapshot normalization; runtime acceptance remains pending.

M12 integration validation (2026-10-30): frozen install, build, required test:offline and manifest/catalog regeneration, and full validate:offline all exited 0 with the specified LUAU_BIN. Passed 1,088 Luau contracts, four loader probes, 19 catalog snapshots, three QA pilot scenarios and 124 Python tests. Story/radio inventory is 215 entries / 137 pending recordings; no audio generated. Catalog changes only M12; prerequisite mission definitions and every main decision record are preserved. D9/D10 cleanup paths remain unchanged; only M12 railgun models set LeaveWreck. Studio verified: pending orchestrator run. No Player tests claimed.

Priority: review M14 #196, then orchestrator acceptance. Missions 1–13 are merged/live by pipeline convention; older handoffs below are historical.

## Mission 12 beta guide — THE COMMAND RING

Complete M11 then launch M12. Silence all seven live guns within 15:00; the southeast wreck is scenery. Destroy central ECM for radar. Climb above Y900 (3,080 ft absolute) before a sweep impact; warnings total 16s and overlapping lines deal at most 25 damage per 30s cycle. Test actual terrain masking and barrel lines. Rearm southwest during strike: finite 54 missiles/14 special charges, gun refill, damage preserved, clock paused. Kill all guns to start a fresh 10:00 elite phase; defeat one of five, confirm recovery and four uncredited withdrawals. Check Easy/Normal/Hard pressure, one optional allied kill, retained gun wrecks, retry/end cleanup, results/save reload and M13 unlocking after #195 merges. Studio verified: pending orchestrator run. Player/phone balance and rendered reference comparison remain unobserved.

Historical pre-merge handoff for #189 (merged at 5c88368c): final D-445 offline validation passed; next is orchestrator-owned Studio acceptance and independent review before merge. Validate both routes, attentive defence and a 30s lapse on each difficulty in actual flight. No Studio lease was used for this correction.

**M09 arrival regression, 2026-10-30:** Orchestrator reported Studio Jest 1,219/1,220 at `21be233`: the sole failure expected nine generic opening bandits, but D5 authors three required trios at mission times 600/625/650. #185 corrects the test to check exact timed admissions and duplicates, retaining D4 slots and adding grouped/delayed-launch coverage. Runtime remains unchanged: completion requires all nine kills. An offline regression clears early trios without ending the phase. Frozen install, build and full offline validation exited 0 (1,023 Luau contracts, 19 catalog snapshots, 124 Python tests). The director regression compiles but requires the orchestrator’s Studio rerun; this task did not launch Studio or claim a Player test.

Updated 2026-10-30 against main `06ca3e4`. Practice and missions 1–11 are live by pipeline convention; M12 #191 is merge pending and M13–M18 remain dormant. No Player observation is claimed.

1. **Verify merged mission 10 [#187](https://github.com/A-Ricemusic/skybreak/pull/187).** Integrated on main `06ca3e4`; prerequisites #182/#183/#185 are merged. Studio verified: pending orchestrator run. Use the beta guide below for acceptance.
2. **Verify M07/M08 and M09 in the orchestrator's Studio session.** Check canyon ingress/masking, protected mast/bomber timing, beach sectors and carrier deck. Offline coverage does not establish Player quality.
3. **Integrate missions 12–18 in order.** D6 #182 is merged and activated by M10 #187; D7 is active in M11; D8 is activated by M12. Retain provisional inventory/rank assumptions and runtime acceptance gaps.

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

D6 integrates repeated artillery, parked/airborne credit ownership, bounded static contact detail and six M10 target types with main’s D4 air budget and D5 lifecycle. Next: orchestrator-owned runtime Jest/Studio checks, phone profiling with 150 contacts, then M10 roster/cadence/ranks and visual acceptance. M10 #187 enables D6; runtime acceptance remains pending.

## Mission 9 beta guide — GREEN BEACON (Live)

Complete M08 to unlock GREEN BEACON. Score 2,200 points in the full 10:00 beach strike; reaching the goal early does not skip the clock. Three beach sectors have radar, batteries, bunkers, tanks, launchers, howitzers, AA and SAMs. Use the finite 60 missiles / 1,200 gun rounds / non-recharging special wisely; the area-strike special attacks ground clusters. The offshore carrier offers repeatable optional service in phase 1, refilling weapons while pausing active mission time and preserving damage. Check landing, skip, menu, relaunch and repeat at the actual deck.

At expiry a visible update starts 7:00. Nine required attack jets arrive as three groups of three, 25 seconds apart, targeting the west, central and east landing forces. Clear each sector's two batteries during phase 1 to let its craft advance in phase 2; ground progress is feedback, not a compulsory all-ground-target quota. Each landing force has an original provisional 300-health budget; losing any force fails. All nine aircraft stopped wins; phase timeout or player destruction fails. Allies share one optional kill for the entire sortie and award no player score.

Owner checks pending: readable HUD and beacons under overcast light; sector progress/hit cues; practical interception time and fairness; carrier deck clearance, paused service and finite refill; retry cleanup and duplicate settlement; phone frame rate/load time; approach skyline and target spacing against the accepted reference. No Studio launch, Jest Studio execution, Player observation or visual acceptance is claimed by this implementation agent.

## D7 merged (#184); mission 11 activation next

Verify merged D7 #184 before M11 activation. Before M11 activation, author and inspect routes/health/roster, terrain clearance, markers, damage/loss branches and all-safe completion under the orchestrator’s Studio lease. No mission opts in; runtime Jest and Player/phone acceptance remain pending. See D-360–D-363 and the engine plan.

Main integration validation (2026-10-30): frozen install, standalone build and full offline validation exited 0; 1,007 Luau contracts, 19 unchanged catalog snapshots and 124 Python tests. The combined sector/protected-target warning rule passes offline; service-entry runtime regressions compile but remain unrun. No Studio/Player test. Historical D7 integration base was `ea0045d`; current main includes M08/M09 and #187 adds opt-in `concurrentRoutes` for M10.

## D8 merged (#186) — dormant

Review the integrated ground ECM/strike service, precision SALVO, elite retreat/recovery and ring sweep contracts (D-400–D-402). Runtime Jest belongs to the orchestrator’s Studio lease. M12 activation, roster/scoring, presentation and world mapping remain separate work; its dependent branch is untouched.

D8 main integration validation (2026-10-30, main `5d84486`): frozen install, build and full `validate:offline` with the prescribed `LUAU_BIN` each exited 0: 1,023 Luau contracts, 19 unchanged catalog snapshots, four loader guard probes and 124 Python tests. All 92 spec registrations match runner imports and retain both parents. No Studio, `test:roblox`, Player tests or uploads performed. D8 remains dormant; M12 dependent branch untouched.

## Mission 10 beta guide — RIVER LINE (live after #187 merges)

Complete M09 to unlock M10. Score at least 3,000 through the full 20:00; reaching the threshold early must keep the strike running. C/B/A/S: 3,000/3,800/4,200/5,400. Static/parked contacts total 140; 44 finite airframes include twelve shared parked/airborne identities. Each identity pays once, whichever form is destroyed first.

- First artillery warning at 4:00, first impact at 5:00, then every 2:00 through 19:00. Descend below absolute Y=585 and use terrain masking; check northeast ingress and southwest runway refuge.
- Optional repeatable runway rearm restores 58 missiles, 750 gun rounds and twelve special charges, pauses objective time and preserves damage. Check skip, menu, relaunch and repeated service.
- Ignore helicopters while clearing pursuers: at most two route slots within eight total reserve pursuing capacity. Patrols retire without score; verify parked departures, six VTOLs at 6:00, pressure wings at 8:00/11:00/14:00 and ace at 16:00. Four allies share one uncredited kill.
- Check below-threshold expiry, destruction, win settlement, ranks, replay/save and M11 remaining locked; verify M10 cannot launch before M09. Inspect target adoption, subtitle-only story, HUD, rendered terrain, phone load and balance.

Studio verified: pending orchestrator run. No Studio, Roblox Jest or Player tests performed by this agent. No audio or asset uploads.

M10 main integration validation (2026-10-30, main `06ca3e4`): frozen install, standalone build, `test:offline`, and full `validate:offline` with `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau"` exited 0. Final suite: 1,042 Luau contracts, four negative loader probes, 19 catalog snapshots, three QA-pilot scenarios and 124 Python tests. All 94 specs match registration/import lists and retain checkedRequire. Regenerated 199 voice/story entries (121 pending recordings); every prior voice id and every non-M10 voice/catalog entry is preserved. M10 unlocks after M09; M11–M18 remain locked even with forged completions. The opt-in route cap preserves default admissions; D7 protected actors remain outside hostile rosters and D8 withdrawing actors do not consume route slots. Studio verified: pending orchestrator run. No Studio, Roblox Jest or Player tests, audio generation or asset uploads.

## D9 merged (#188); mission 13 activation next

Review PR #188’s integration with merged D7/D8 and missions 8–9. Keep D9 dormant until M13 activation; validate corridor placement, cumulative navigation holds, phase handoff, scoring and Player/phone readability. Spatial ground ECM requires a separately authored source/validation design before support.

## D10 integration with current main (2026-10-30)

PR #190 remains dormant and unmerged. Main D6–D9 and missions 8–9 are preserved; practice, mission catalog and frozen snapshots are unchanged. Cruise twists remain rejected. The shared sortie identity namespace now also includes protected aircraft and spatial airships; elites use generated runtime identities, with the existing elite retreat lifecycle preserved. M14 activation still needs authored routes/roster/scoring and Studio/Player/phone acceptance. No Studio, Player test or upload was performed. Integration validation passed: frozen install, build and full offline validation each exited 0; runtime Jest compiled only. Main was `f35430f`; mission 10 had not merged.

D13 acceptance: rerun the compiled complete `stepEnemies` vent-exit/arena-edge regressions and guided/blind vent missile wall/covered-player regressions in the orchestrator-owned Roblox session before mission authoring acceptance. Offline geometry coverage is available; no Studio run was performed here.

## Batch D13 implementation

Review the dormant D13 engine PR, then integrate M18 only in mission order after D9–D12 and mission readiness. Author generator/core/vent/duel plans from the existing M18 world; verify physical shutter clearance, occlusion, retry, independent 5:00 clock, no ammo refund/refill, and allied/structure silence in the orchestrator-owned Roblox session.

D13 integration follow-up (unmerged #194): review the main-composed head and execute the compiled D13 runtime regressions in the orchestrator-owned session, including D10 cruise disposal at duel entry. Offline validation is green; M18 activation still waits on mission order and flight/rendered/phone acceptance. D11/D12 remain separate approved PRs; neither was imported into D13.

## D12 main integration (2026-10-30)

PR #193 is rebased by merge onto main `0450491` (D9, D10 and missions 9–10 included); D11 #192 is excluded. D12 remains dormant and M17 locked. Practice and missions 1–10 retain main's catalog and frozen snapshots. D12 keeps protected Rusk/four required wingmen, bridge-linked closures and the reviewed hull/mount velocity fix. D7–D10 radar, protected-target warning suppression, D8 retreat and D4/D6 admission budgets including `concurrentRoutes` remain composed. No Studio, Roblox Jest or Player test was performed.

Review D12, then activate M17 only after preceding missions and D11. Author separate witness/enemy bridge routes, four required wingmen, a departure clock and route; reuse D11's M17 repair contract after it merges.

D12 integration validation: frozen install, standalone build and the full prescribed offline command each exited 0 (1,069 Luau contracts, 19 unchanged catalog snapshots, four loader guard probes, 124 Python tests). Runtime Jest compiled only; no Studio, `test:roblox` or Player run.

## D11 review and activation handoff

Review dormant D11 ground-support/service extensions (D-500–D-504); no mission opts in. M15/M16 activation must author clearance/reserve IDs, routes, D4 protected-city bomber phase and M15–M17 repair opt-ins, then verify rearm menu/skip/timeout with PC/gamepad/touch, sector threats, cleanup and once-only scoring. Include score-deadline → bomber transition with an unsecured reserve gate and sortie-folder cleanup (PR #192 regression). Run the compiled runtime Jest specs under the orchestrator's Studio lease and profile 150 armour contacts on phone before claiming performance or visual acceptance. D7–D10 and missions 8–10 are merged; their hooks and live behavior are preserved. No uploads needed.

D11 main integration validation (2026-10-30, main `0450491`): `bun install --frozen-lockfile`, `bun run build` and the full prescribed `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` each exited 0. Passed 1,076 Luau contracts, four negative loader probes, 19 unchanged catalog snapshots and 124 Python tests; all 99 offline specs match staging/import lists. Runtime Jest compiled only; no Studio, `test:roblox`, Player/phone test or upload. D11 remains unmerged and dormant. D7–D10 and missions 8–10 are merged; live rearm menus/behavior, catalog data and frozen snapshots are preserved. Cheap armour eligibility is limited to M15–M17. Mission 11 has not merged at the final main refresh. No known deployment failure is recorded for merged work; no deployment claim is made for this branch.

PR #192 next check: orchestrator reruns Roblox Jest after the scoring-fixture correction. Confirm release only after clearance, freeze during service, once-only score, no resurrection and phase-exit destruction; the previous 1,294/1,295 run reached the scoring assertion after visibility checks passed. No new runtime behavior or mission activation is included.

The corrected D11 scoring fixtures use an explicit 150-point ground award: M01’s default rating policy awards zero ground points, which made the prior unchanged-total check insufficient to prove score deduplication. Runtime admission/ledger code is unchanged.

D11 fixture-fix validation (2026-10-30): `bun install --frozen-lockfile`, `bun run build` and the prescribed `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` each exited 0. Passed 1,077 Luau contracts, four negative loader probes, 19 unchanged catalog snapshots and 124 Python tests. No Studio, `test:roblox`, Player test, merge or upload was performed.


### PR #195 fixture-fix verification

Orchestrator: rerun the full Studio Jest suite after the D9 missing-session-blueprint fix, including the new M13 catalog-backed world-model adoption/fallback/phase-cleanup test. D5–D12 runtime fixtures now own their data; D11 keeps explicit 15/16 identities only for intentional repair/armour gates. No campaign placeholder is inherited. Mission 13 Player/phone acceptance remains pending.

M14 P2 difficulty review fix (2026-10-30, PR #196, unmerged): the real PhaseDirector authored-arrival request and WavePlan admission yield 3/6/1 aircraft per phase on every difficulty, not seven Ace fighters. Shared Act III damage, fire gates and flight divisors establish Easy < Normal < Ace incoming threat over the same continuous intercept strategy at both timesteps. Undefended expected hull loss assumes 60% firing opportunity and 50% connections (the existing CombatBalance test model). A separate survival witness schedules shots at the 60% opportunity cadence, assumes all connect unless decoyed, and spends real EvadeRules charges with ten-second sequential recharge and ideal decoy timing. Charges carry between phases; no fighter kills or allied relief. This is a conditional analytic defense estimate, not observed projectile/Player survival; warning reaction and flight during rolls remain unverified. No mission data or difficulty retune was needed. Studio, Roblox Jest and Player checks remain deferred.


M15 #197 follow-up acceptance: run the compiled built-world contact regression in the orchestrator-owned Studio session; confirm no frozen bombers/optional aircraft remain and all 69 ground contacts retain their adopted visuals. Review stepped fairness assumptions below before flight/phone acceptance.

M15 #197 re-review validation (2026-10-31, PR baseline `31aaa8b`): `bun install --frozen-lockfile`, `bun run build`, and prescribed `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` each exited 0. OFFLINE_LUAU_RESULT passed=1172 failed=0. Both broken-acquisition and broken-homing squad probes fail the attentive success criterion, while the unmodified scenario destroys all twelve attackers with optional aircraft included and all squads surviving. Easy/Normal/ACE squad health totals: 1,490 / 1,380 / 1,380; worst bomber interception: 191.0 / 210.4 / 210.4 seconds. Mission data and generated snapshots are unchanged. The built-world regression compiles but was not executed. No Studio, test:roblox, Player test, upload or merge was performed.

M16 #198 replay validation (2026-10-31, M15 base `caf2889a`, including original `002ee0f9`): frozen install, standalone build, required test:offline and voice/story/catalog regeneration, and prescribed-LUAU_BIN validate:offline each exited 0. Passed 1,186 Luau contracts, four loader guards, 471 module compilations, 197 require-graph nodes, 19 catalog snapshots, three QA pilot scenarios and 124 Python tests. All 111 base specs plus two M16 specs remain in both lists with checkedRequire. Every base decision and all 229 prior voice/story entries are preserved; inventory is 230 / 152 pending recordings. Catalog differs only for M16. Negative acquisition/guidance probes fail protection; all 21 attackers are intercepted on Easy/Normal/Hard using 42/63/63 missiles. Runtime Jest compiled only. No Studio, test:roblox, Player tests, uploads or merge performed. Studio verified: pending orchestrator run. Merge pending; live by pipeline convention after merge.

M16 #198 shared-targeting review fix (2026-10-31; unmerged): fairness now selects through shared TargetPriority auto/TGT rules over live attackers and persistent/routed cover. Scripted warning-bearing steering and TGT cycling retain lock-cone/time, homing, fuse, seeker and difficulty checks. Selection-failure injection must fail attentive protection. Town attack ingress moved from Z=-6500 to Z=-1000 after shared selection exposed a stationary Normal defense loss; other mission timing/positions unchanged. Stationary defense leaves Easy 90/170/180 hull and Normal/Hard 10/100/150; moving defense leaves Easy 140/180/180 and Normal/Hard 80/90/200. Missiles: stationary 42/63/63, moving 42/64/64. Studio/Player acceptance remains pending; no Studio or test:roblox run performed.

Shared-targeting fix validation: frozen install, build and full prescribed-LUAU_BIN validate:offline exited 0. Catalog snapshot changed only the two M16 town ingress coordinates. No merge or Studio/Player verification.

M17 #199 replay validation (2026-10-31, M16 base `9752a5ad`): frozen install, standalone build, required test:offline/voice/story/catalog sequence and full prescribed-LUAU_BIN validate:offline each exited 0. Passed 1,201 offline Luau contracts, four loader probes, 475 module compilations, 197 require-graph nodes, 19 catalog snapshots, three QA pilot scenarios and 124 Python tests. All 113 base offline specs plus three M17 specs remain in both lists with checkedRequire. Runtime Jest compiled only; adopted models are tested by TargetId. Only M17 catalog snapshot changes; every base decision and non-M17 voice entry is preserved. Voice inventory: 239 entries / 161 pending recordings. No Studio, test:roblox, Player tests, uploads or merge performed. Studio verified: pending orchestrator run. #199 Merge pending; live by pipeline convention after merge.


M18 #200 replay validation (2026-10-31, M17 base be746a10): frozen install, standalone build, test:offline plus voice/story/catalog regeneration, and full prescribed-LUAU_BIN validate:offline exited 0. Passed 1,210 Luau contracts, four loader probes, 483 module compilations, 201 require-graph nodes, 19 catalog snapshots, three QA pilot scenarios and 124 Python tests. Both lists retain all 118 offline specs and checkedRequire. Base decision text is preserved in full; every non-M18 voice entry is unchanged; only M18 catalog changes. Voice inventory: 250 entries / 172 pending recordings. Duel wins: Easy 107.16s / Normal 134.12s / Hard 199.92s. Runtime/world Jest compiled only. No Studio, test:roblox, Player tests, uploads or merge performed. Studio verified: pending orchestrator run. Merge pending; live by pipeline convention after merge.
