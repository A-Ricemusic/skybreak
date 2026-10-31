# Next

Updated 2026-10-30 against main `9857358`. Practice and missions 1–5 are live; worlds 6–18 and engines D1–D3 are merged and dormant. Publish succeeded per CI; no new Player observation is claimed.

## Engine batch D5 — dormant implementation

D5 frozen install, build and full offline validation exited 0 (947 Luau contracts, 19 catalog snapshots, 124 Python tests); the output explicitly includes all six D5 cases. PR #180 P2 is fixed: offline shared threat-policy coverage passes; the new beach-windup/service-entry integration regression is compiled and awaits the orchestrator-owned Roblox run. Review D5 before M09 mission authoring. Reconcile carrier pivot/deck geometry with the dormant M09 world; author explicit sectors, clear targets, force health and attack waves. Then use the orchestrator-owned Studio queue for carrier landing/catapult, skip/repeat/refill/paused clocks, sector progress, attacker LOS/loss and teardown checks. No mission opts in; D11/D12 extend the shared director for later ground-support missions.

1. **Merge D4 [#177](https://github.com/A-Ricemusic/skybreak/pull/177)** after review/checks and updating its base to main. D1/D2/D3 dependencies have merged. Queued air battles, timed bomber interception and protected relay support remain dormant until mission integration.
2. **Complete mission 6** (in progress). Integrate its built harbour world with merged D1/D2 gun, naval mounts, firing SAMs and anti-ship support. Reconcile target inventory, clocks, score/ranks, sinking, rearm, unlock and settlement. Measure actual flight, loading and phone behavior before accepting quality.
3. **Finish mission 7 [#178](https://github.com/A-Ricemusic/skybreak/pull/178)** (in review). D3 is merged; retain mission 6 when updating the branch, integrate #174's allied budget, and rerun progression/settlement checks. The proposal has a 15:00 three-installation strike and fresh 5:00 canyon escape; roster/ranks are provisional. Runtime canyon sweeps, transition pose, altitude masking and low southbound exit require verification.
4. **Continue engine D5/D6** (in progress), following the [engine plan](../specs/engine/missions-06-18-plan.md). Keep opt-in support dormant until a mission deliberately uses it; preserve current campaign behavior.
5. **Integrate missions 8–18 in order.** All worlds are built/dormant (#175/#176), all mission/world specs exist. Mission actors, target identity/count reconciliation, phases, clock/failure/rank rules, unlock/settlement and runtime acceptance remain. M08 uses D4; later engine batches follow the engine plan. Built scenery alone is not a playable mission.

## Owner checks on live missions

- M01/M02: four extra optional fighters each; Normal ranks M01 1560/1200/600/500 and M02 2500/1990/1620/1320. Check Easy completion, Normal pressure and the shared default one allied kill per sortie. Required bombers stay protected from allied kills. Optional queued fighters may never spawn if objectives finish quickly.
- TGT: nearest visible enemy first, then next closest on quick presses; wrap through the list. Turn away from all enemies to check closest-overall fallback. Auto-acquire remains nose-first; tapping a target box should not steer the jet.
- Loading: full-screen cover, jet/progress/tips, readable phone text and reduced motion. Retry and campaign switches should cleanly reset progress.
- M03: nine radars, mission update, southbound return and landing; report mountain appearance, distant terrain and load time.
- M04: after M03, test full/partial/clear jamming, transport escape and final-target victory; report load and cleanup.
- M05: after M04, score 2000 by 10:00; try the green REARM beacon and TAKEOFF / CHANGE WEAPON (including controller). At update, check Vulture cut-in and south escape within 4:00. Ranks S/A/B/C 4000/3000/2500/2000. Report night readability, weather, phone load, results and replay/save persistence. Reported Studio build was 17.30–17.96 s; this is not a phone/Player measurement.

New/changed dialogue stays subtitle-only; no further audio uploads (D-142). Existing approved voice remains. See [blockers](blockers.md) and [per-level checklists](levels.html). This task does not launch Studio or run Roblox Jest.
