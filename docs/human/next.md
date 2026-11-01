# Next

**Urgent priority:** review the second M3 hotfix and capture one failing launch with server console/timing and connection outcome. Owner reports the Roblox app still closes on mobile when launching M3 on live main 36e949d0 after #220. Second hotfix pending: remove inaccessible 60M-voxel bottom floor, keep all M3 targets procedural with zero military meshes/PBR maps, and log construction error phase before recovery. Live cause unconfirmed; Not Studio/Player tested. See [investigation](../qa/m03-crash-second-hotfix.md).

Updated 2026-11-01 against main `36e949d0`.

1. **Owner signs in to Studio once.** The auto-update (0.745.563 → 0.745.0.7451137) left Studio signed out, blocking every Studio run.
2. **Run `bun run test:roblox` in Studio**, in coordinated order: merged #220 M3 instance-budget regression; #205 planning/cleanup freeze and load-time acceptance; #203 Practice + 18-mission launch/settlement smoke; #210 table-driven world dispatch; #221 dormant naval integration; #227 session-factory fixtures. All five open PRs need Studio Jest before acceptance. #203's first runs exposed the M3 bug. #205 measured freezes up to 74 s mostly in previous-world cleanup; cooperative cleanup and 0.15 s terrain slices still need Studio acceptance. Offline passes cannot replace these runs.
3. **Upload naval models after secure key delivery.** Owner provides the Open Cloud key via the secure prompt. #226/#228 are assets-only on main: 12 exact exports independently approved strict 10/10, not uploaded or in game. Use the exact approved dependencies and merged upload-gate evidence; any edit/re-export needs a fresh independent review. #221 remains dormant and open; upload alone does not activate gameplay. Audio uploads remain permanently blocked.
4. **Owner Player/phone acceptance.** First verify M3 launches after #220, then first-time M01 → M02 on Normal: chapter 1 before loading, Skip proceeds, seen chapter launches directly, repeated-tap protection and mouse/gamepad activation. Check M17 → chapter 17 → M18 and M18 CAMPAIGN COMPLETE without Next. Inspect military model fit/orientation and phone performance. No new Player test is claimed here.

The full playthrough checklist follows; missions 6–18 still have no Player/phone verification.

1. Owner: play practice and missions 1–18 in order on one save in Roblox Player, then replay selected missions on Easy, Normal and Hard/ACE. Practice: fly the pattern, hit the radar and confirm mission 1 stays accessible.
2. For **every mission below**, record difficulty feel against the owner's “more enemies, harder” goal; allies should contribute approximately one shared kill per sortie without required-target theft. Check TGT picks the closest on-screen contact, repeated presses move outward/wrap and off-screen fallback works. Check available rearm/repair (damage preserved except repair-enabled M15–17), loading time, HUD/readability, failure/retry, unlocks and rank persistence after reload. Mark unavailable service as not applicable.
3. Repeat on a real phone, prioritizing big missions **10, 15 and 16**: loading seconds, stalls/FPS, touch targeting, lock/evade controls and readability. Studio/emulator results do not establish phone performance.

| Mission | Owner playthrough checklist |
|---|---|
| 1 · OUR OWN PAINT | Intercept six bombers, optional forward/rear fighter pressure, fly-off and saved ranks. |
| 2 · NO ANIMALS | Follow power lines, destroy eleven parked bombers, check added fighter pairs and ace pressure. |
| 3 · NOBODY SIGNED | Destroy nine radars, update-clock reset, south return, automatic landing/skip and results. |
| 4 · BLIND COURIERS | Test full/partial/cleared jamming, transport escapes, final-target win and cleanup. |
| 5 · LIGHTS OFF | Score 2,000 by 10:00, runway service/weapon menu with damage preserved, Vulture cut-in and four-minute south escape; inspect night readability. |
| 6 · IRON COAST | Score 3,000 through 15:00, ship hull/component credit, SAM warnings, finite ammunition and runway 18 service. |
| 7 · ARRAY BREAK | Destroy three installations, retain strike pose into canyon ingress, respect absolute Y=585 ceiling and terrain masking, cross south exit before timeout. |
| 8 · OPEN FREQUENCY | Score 800 through 7:00, intercept all six staggered bombers during full 6:00 hold, mast loss and 35-second broadcast. |
| 9 · GREEN BEACON | Score 2,200 through 10:00, carrier deck approach/rearm, landing-force survival and all nine timed attackers in 7:00 defence. |
| 10 · RIVER LINE | Score 3,000 through full 20:00, repeated artillery cover, parked/airborne credit deduplication, finite area weapon and repeated runway service. |
| 11 · HIGH CROSSING | Protect both airliners across altitude-separated routes until about 5:13.28; test loss failure and optional RIME pressure. |
| 12 · THE COMMAND RING | Destroy seven guns in 15:00, ECM/line-of-fire masking, strike rearm, fresh 10:00 elite phase and recovery outcome. |
| 13 · EVIDENCE THROUGH THE GREY | Gun-sweep 32 jammers for 1,300 in 7:00, fresh 15:00 interception of eight attackers, protect PAPER ONE and observe optional escorts. |
| 14 · AURORA SHIELD | Intercept three cruise salvos and splitting carriers, no double credit or premature completion; check warning reaction and continuous-flight survival. |
| 15 · SILENT STREETS | Protect three city squads, relay strike and 2,000 through 10:00, runway repair, six-bomber retaliation on fresh 10:00; check assembled scenery sightlines. |
| 16 · DUST ROAD | Clear column roads across three legs, protect squads from queued attackers, reach 3,500 through 20:00 and verify repair service. |
| 17 · LAST WING | Score 2,100 through 12:00, defeat four required wingmen within fresh 18:00, protected Rusk withdrawal, bridge route closure and runway repair. |
| 18 · CLEAR FREQUENCY | Three generators → timed vent/shutter/core/exit → isolated 5:00 Rusk duel; check carried damage/ammo, ending, campaign completion and replay. |

After the playthrough, prioritize tuning from recorded failures:

1. Calibrate provisional rosters, subtype counts, ranks and added enemy pressure against human results; preserve unresolved reference distinctions instead of presenting authored values as exact footage counts.
2. Revisit modelled-only fairness: M11 escort hull budgets, M14 warning/evasion assumptions and M15–17 protection scenarios omit parts of a complete human sortie. Test actual targeting, terrain/assembled scenery LOS, ground clearance, hostile AI and carried damage.
3. Calibrate the M18 Rusk duel using actual entry poses, damaged hull, depleted rack/specials, input/network delay and phone reaction time. Deterministic wins (Easy 107.16s / Normal 134.12s / Hard 199.92s) establish conditional reachability, not finale feel.
4. Address observed visual/loading/controller issues: M03 distant terrain and return guidance, M05 night props and real-controller service menu, plus any new campaign observations. Keep new dialogue subtitle-only; audio uploads remain halted by owner instruction (D-142).
