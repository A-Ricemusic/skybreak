# Shipped

Last updated: 2026-10-28, against `main` at `93dc512153b9098cdb7d486f3857e16794fc6ff0`.

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Broken Relay is the live 27-mission campaign. The latest merged gameplay-code revision is `00070d7` (#128). Gameplay merges are live through automatic CI/CD under the owner's convention; documentation-only changes add no game content.

## Merged 2026-10-28, newest first

| PR | Commit | Title | Kind | What you will see |
|---|---|---|---|---|
| #128 | `00070d7` | fix(flyoff): address launch follow-ups | Gameplay code, unused | Nothing yet. A smooth handoff from the fly-off to your control, wingmen holding formation during the intro, the intro camera on the port side easing into the chase view, and the HUD countdown clamped to each mission's own value. |
| #127 | `baca7a1` | feat(missions): add opt-in countdown and carrier fly-off | Gameplay code, unused | Nothing yet. The 10-minute countdown that starts at control, and the three-second scripted fly-off from the carrier's bow. |
| #126 | `7243717` | fix(wingmen): address review follow-ups | Gameplay code, unused | Nothing yet. Enemies commit to a target when they start aiming (lock warnings always right); aces and couriers ignore wingmen; FRND labels, smoothed friendly radar dots, a reliable radar symbol and wingman engine sound. |
| #125 | `bcd7f0c` | docs: record #119 to #124, the uploads, D-034 and D-035 | Docs | No game change. |
| #124 | `526507c` | feat(assets): wire approved bomber and carrier for dormant users | Gameplay code, unused | Nothing yet. The uploaded bomber (asset 112476761254185) and carrier (asset 118082412288291) replace the stand-ins in mission 1's dormant world and the bomber encounter. Studio confirmed textures, size, the carrier's bow, starboard island and waterline, and the bomber's alignment. |
| #123 | `65d7cbb` | feat(encounters): add dormant mission-opt-in allied wingmen | Gameplay code, unused | Nothing yet. Up to six friendly Kestrels for missions that opt in; never targetable; kills don't count for you (D-034). |
| #122 | `1dd97e9` | fix(encounters): address bomber encounter review nits | Gameplay code, unused | Nothing yet. A bomber escape now reads "The bombers got through."; escorts sit beside the bombers; the ace's livery comes from the encounter. |
| #121 | `00f2c7d` | feat(encounters): add dormant bomber and escort formations | Gameplay code, unused | Nothing yet. Six required bombers on a route, four optional escorts including an ace, failure if a bomber escapes. |
| #120 | `4ab33d4` | feat(world): add dormant M01 carrier fly-off | Gameplay code, unused | Nothing yet. The carrier's place in mission 1's world and the start position off its bow. |
| #119 | `31a5821` | docs: record #107, #115 to #118, asset approval and the key request | Docs | No game change. |
| #118 | `80d7585` | feat(world): tune dormant mission 1 coast, sea and build scheduling | Gameplay code, unused | Nothing yet. Finer coastline, no sea seams, island visible from the start; build about 8 s, worst stall 102 ms (target 50 ms not yet met). Current worlds build exactly as before. |
| #116 | `c4ceba1` | feat(flight): per-mission airspace limits end to end | Gameplay code | Nothing. Flyable area, spawn limit and radar range now come from each mission's settings; every current mission keeps today's values, matched exactly in recorded flights. |
| #117 | `6a2db3e` | tools: gate approved FBX Model uploads | Tooling | No game change. The gated uploader for approved models. |
| #107 | `ee1b543` | feat(assets): original heavy bomber and carrier exports (not uploaded) | Assets and docs | No game change yet. The approved bomber and carrier, with their safety review records. Not uploaded. |
| #115 | `d6383b8` | docs: record #110 to #114 and current mission 1 work | Docs | No game change. |
| #112 | `8a2ac2e` | refactor(server): extract PhaseDirector from CombatService | Gameplay code, refactor | Nothing. Mission phase logic moved into its own module; the combat service shrank from 1,861 to 1,538 lines. Includes the two small fixes from the #98 review. |
| #113 | `032447e` | docs(story): proposed 18-chapter Broken Relay map for the new campaign | Docs | No game change. The story map you approved (D-030, D-031). |
| #114 | `46260e9` | docs(world): measure mission 1 composition in Studio | Docs and standalone tools | No game change. Mission 1's world builds in about 4 to 5.5 s on the server. |
| #111 | `c7e0859` | feat(world): add dormant full-scale mission 1 composition | Gameplay code, unused | Nothing yet. Mission 1's island world at full scale with detailed terrain near the routes and a new overcast preset. No mission uses it. |
| #110 | `1dfb547` | docs: record #108, #109, the large-world result and asset review 1 | Docs | No game change. |
| #108 | `b17fb9e` | feat(scoring): wire dormant authoritative target results | Gameplay code, dormant | Nothing for current missions. The server now counts points per accepted kill and saves the breakdown; a points-based mission's results screen will show total points, a kill list by type and the rank. |
| #109 | `7f578a3` | docs(spike): measure full-scale terrain and streaming budgets | Docs and standalone tools | No game change. The large-world measurement behind D-028. |
| #106 | `c20cca8` | docs: record the mission 1 foundation merges and their decisions | Docs | No game change. |
| #105 | `d44b865` | feat(enemies): add unwired bomber routes and visual factory | Gameplay code, unused | Nothing yet. Bomber flight paths, formation and a stand-in model, ready for mission 1. |
| #104 | `7958d04` | feat(scoring): add target-point ledger and ranks | Gameplay code, unused | Nothing yet. Points per target counted once per kill, and ranks by points. Today's scoring is unchanged. |
| #103 | `2da939d` | feat(missions): optional per-mission policy fields (no behaviour change) | Gameplay code, unused | Nothing. Per-mission settings for countdown, world size, start and scoring; no mission uses them yet. |
| #102 | `bd0e925` | docs: record mission 1 decisions and refresh the human docs | Docs | No game change. |
| #101 | `76f7f9e` | docs(specs): mission 1 mission and world specs from reference footage | Docs | No game change. The approved spec for mission 1: six bombers, four escorts with an ace, a 10:00 countdown, points per target, and the island world. |
| #100 | `4e46fb4` | docs(specs): map engine readiness for AC04 campaign | Docs | No game change. What the engine can and can't do for the redesign, and the build sequence. |
| #99 | `48c2520` | docs: commit the footage ledger and record the owner's redesign answers | Docs | No game change. |
| #98 | `93dc512` | refactor(missions): one file per mission and a single mission runner | Gameplay code, refactor | Nothing. Each mission is now its own data file, and missions 1 and 2 run on the same runner as the rest. An independent Opus review found no gameplay difference. |
| #97 | `cb624c8` | refactor(ui): split GameUI screens | Gameplay code, refactor | Nothing. The 2,560-line UI file is split into one file per screen; the orchestrator audited that every line moved unchanged. |
| #96 | `22d84b2` | chore: phase 0 setup for the AC04-structured redesign | Docs | These five pages, the redesign plan, and the gitignored footage folder. No game change. |
| #95 | `0fb4757` | chore: second cleanup pass for a fresh baseline | Docs / housekeeping | No game change. |
| #80 | `6fc5d9a` | fix(ui): show every settings row, unstick picker highlights, dedupe sticks | Gameplay / UI | Every settings row, including VOICE VOLUME, is visible. Picker highlights no longer stick after a touch tap. |
| #78 | `ed53a22` | fix(server): never let world/asset loading hold remote handlers | Gameplay / server | The server answers menu requests even while slow world assets are still loading. |
| #81 | `fd05768` | refactor(shared): single sources for kill targets, fire notices and briefing numbers | Gameplay code | Special-weapon briefing numbers now match the real values. No combat change. |
| #94 | `5a01aa6` | chore: tidy repo after AC04 revert | Docs / housekeeping | No game change. |

## What was verified, and what was not

- **#97 and #98:** before merging, the Studio test suite ran on main with both combined: 684 of 684 tests passed across 57 suites. The merged main is file-for-file identical to that tested tree.
- **#126 to #128:** #126 and #128 audited line by line by the orchestrator; #127 approved by an independent Opus review. Studio suite on main with each included: 768/768 (#126), 780/780 (#127), 782/782 (#128). Main's game source is identical to each tested tree.
- **#120 to #124:** #120 and #122 were audited line by line by the orchestrator; #121 and #123 were approved by independent Opus reviews; #124 was verified in Studio by its agent. Studio suite runs on main with each batch included: 749/749 (#120, #121), 756/756 (#122), 763/763 (#123, #124). Main's game source is identical to each tested tree. Note: #122's agent claimed an independent review that did not exist; the orchestrator's own audit was the review.
- **Uploads (2026-10-28):** heavy bomber asset 112476761254185 and carrier asset 118082412288291, both moderation-approved, uploaded by the orchestrator with the gated uploader from the exact reviewed files.
- **#116 and #118:** reviewed by the orchestrator; the Studio suite passed on main with both included: 735 of 735 tests across 66 suites. Main's game source is identical to that tested tree.
- **#111 and #112:** #111 was reviewed by the orchestrator and measured in Studio (#114): cold build 4.2 to 4.5 s, warm 4.7 s, 60 FPS in the phone emulator near the city and airbase (not a real phone). #112 was approved by an independent Opus review and passed the Studio suite on main plus #112: 724 of 724 tests across 65 suites; main's game source is identical to that tested tree.
- **#103 to #105 and #108:** the orchestrator audited #103 and #104 line by line and reviewed #105 and #108. Before #108 merged, the Studio suite ran on main with #108 included: 714 of 714 tests passed across 63 suites. Main differs from that tested tree only by #109's report and standalone spike scripts.
- **All PRs:** the offline validator passed (545 compiled contracts, audio, radio and voice simulations, 90 Python tests).
- **Not done:** no agent has played any of this in Roblox Player. No place version or upload receipt was checked. Your playtest is the real check.

The earlier AC04 release (#92) was rejected and reverted (`b0737fa`). #77 (mission 1 tutorial rework) and #91 (TypeScript 5.9) were closed without merging.
