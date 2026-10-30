# Shipped

Last updated: 2026-10-29, against `main` at `7d73c44`.

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). The new 18-mission campaign is live by pipeline: practice flight and missions 1–3 are playable; missions 4–18 are locked. The latest merged gameplay revision is `7d73c44` (#147, mission 3). The story remap (#159, open, not yet merged) would align chapters/documents with the 18-mission campaign, preserves M5 escape and returns Vulture Lead at M17. New dialogue will be subtitle-only, with no new recordings (D-142); Studio/Player verification remains pending. Last recorded publish before the story remap returned place version **94** ([run](https://github.com/A-Ricemusic/skybreak/actions/runs/40963804844)). See [per-level status](levels.html). The 2026-10-29 publish logs confirmed the official place and returned place versions **85** (#130), **86** (#134), **87** (#140), **88** (#138), **88** (#137), **89** (#139), **90** (#141), **91** (#142) and **92** (#143). Gameplay merges are live through automatic CI/CD under the owner's convention; documentation-only changes add no game content. PR #131 merged only into `feat/campaign-switch-m01`, not `main`; #132 closed without merging, so neither is listed as shipped below.

## Pending, not merged

- [#159](https://github.com/A-Ricemusic/skybreak/pull/159) Broken Relay 18-mission story and voice handoff: open. Once merged, M3 receives “An unlisted station” and the M4/M5 chapters are ready for their gameplay PRs; new and changed lines stay subtitle-only (D-142). Nothing from it is live yet.
- [#152](https://github.com/A-Ricemusic/skybreak/pull/152) Cutscene modernization: open, stacked on #159. See [next](next.md).

## Merged 2026-10-29, newest first

| PR | Commit | Title | Kind | What you will see |
|---|---|---|---|---|
| #147 | `7d73c44` | Mission 3 playable after mission 2 | Gameplay | Nine radar domes in snowy mountains, then return and land with the film; live by pipeline convention. This story PR performs no new Player test. |
| #145 | `088fbfc` | feat(engine): dormant batch C | Gameplay code, unused | Dormant jamming and mission 4–5 engine contracts; no additional playable level. |
| #144 | `7711b70` | feat(world): dormant M04 inland hills and M05 night refinery | Gameplay world, unused | Nothing yet. Mission 4's inland hills (three transports, two jammers, nine escorts and an ace; 1,540 points) and mission 5's night refinery and oil rig (rig 2,400 points; full inventory 4,500) are merged but not selected by any mission. |
| #143 | `68f2df5` | feat(m02): make mission 2 playable after mission 1 | **Gameplay: mission 2** | **Mission 2 "NO ANIMALS".** After you finish mission 1, mission 2's tile reads NEXT. You start in the air heading north with three LANTERN wingmen and a 15:00 countdown, follow a red-and-white power line about two minutes to a "farm" airfield, and destroy all eleven parked bombers. Optional points: the substation on the way, seven hangars, four AA guns that fire back, and the control tower. Fighters meet you head-on, rise from the base, and one scrambles off the runway; the ace HARROW SIX arrives after four bombers. Everything destroyed is 2,610 points (S ≥ 2,200). Loading takes about 16 s on desktop. |
| #142 | `051b183` | feat(assets): wire five approved mission 4–5 models | Gameplay code, unused | Nothing yet. The approved heavy transport, radar jammer, fuel tanker, attack helicopter and elite Vanta livery are wired for missions 4–5. Studio checked orientation, scale, tanker waterline and helicopter rotor hubs; missions 4–5 remain locked, and no Player test was performed. |
| #141 | `cbdec3a` | feat(engine): dormant mission updates, return lines, landing and terrain clearance | Gameplay code, unused | Nothing yet. Mission-update resets, return-line guidance, automatic skippable landing and terrain-relative warnings are available for mission 3, which remains locked. |
| #139 | `7f037a9` | feat(world): mission 3 snowy mountains, radar sites and landing base (dormant) | Gameplay world, unused | Nothing yet. Mission 3's snowy mountains, two radar sites and landing base are merged, but mission data and unlock are not. |
| #137 | `c6252fc` | feat(assets): original transport, jammer, tanker, attack helicopter and elite livery (not uploaded) | Assets and safety reviews | No immediate game change. The exact exports received independent 10/10 approvals; uploads afterwards were moderation-approved on 2026-10-29: heavy transport `135095912449793`, radar jammer `80069408823339`, fuel tanker `83861380699092`, attack helicopter `80747426523090`, and elite Vanta livery `139083376207373`. |
| #138 | `4e3534f` | feat(engine): typed ground targets, AA guns, standalone aces and triggered waves (dormant) | Gameplay code, unused | Nothing yet. Typed ground targets, firing AA guns, standalone aces and time/progress/group-triggered waves are available to later missions. |
| #140 | `4992b3d` | feat(world): mission 2 farmland, lake and enemy airbase (dormant) | Gameplay world, unused at merge | Nothing yet at this merge. The farmland approach, lake, power line and enemy airbase became playable when #143 merged. |
| #136 | `85d469a` | docs(specs): missions 2 and 3 mission and world specs from reference footage | Docs | No game change. Reference-grounded mission and world specifications for missions 2 and 3. |
| #135 | `3e7b95b` | docs(specs): missions 4 and 5 mission and world specs from reference footage | Docs | No game change. Reference-grounded mission and world specifications for missions 4 and 5. |
| #134 | `3f3e828` | tune(m01): bombers start farther away; bandits attack from the start | **Gameplay: mission 1 tuning** | Mission 1's bombers start farther away, giving a longer intercept, and more bandits attack: four opening raiders plus two later raiders on Normal, with one extra in each wave on Ace. Rank S now requires 1,200 points. |
| #133 | `07526a2` | docs: mission 1 live for the owner's beta test | Docs | No game change. The owner-facing mission 1 beta guide and current evidence record. |

These merged gameplay changes are live through the automatic pipeline convention. Studio observations do not establish Player quality for mission 2 or visual/runtime quality for dormant mission 3–5 work. No Player testing by agents is claimed here.

## Merged 2026-10-28, newest first

| PR | Commit | Title | Kind | What you will see |
|---|---|---|---|---|
| #130 | `4891e8a` | feat(campaign): switch to the 18-mission campaign; practice flight and mission 1 playable | **Gameplay: the campaign switch** | **The new campaign.** The menu lists the practice flight first (optional), then missions 1 to 18. Mission 1 is playable: carrier fly-off, 10:00 countdown, six bombers with escorts and the ace ASH WARRANT, four LANTERN wingmen, points scoring and rank. Missions 2 to 18 show as locked. Your save starts fresh; Broken Relay progress is no longer shown (it is not deleted). |
| #129 | `a42de5d` | docs: record #125 to #128, D-036 practice optional and D-037 | Docs | No game change. |
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
- **#130 (campaign switch):** independent Opus review (two rounds of fixes), two Studio verification runs (`docs/specs/engine/campaign-switch-verification.md`). Final head: Studio suite 750/750 across 74 suites; scripted pilot flew practice (5,150 points, S) and mission 1 (six bombers in 48 s, 600 points, B); the menu showed CLEARED · RANK B · BEST 600 PTS and kept it after a save reload; the escape at 240 s showed "The bombers got through."; missions 2 to 18 refused a forged start. Phone emulator near the city: 60 FPS (not a real phone). Not observed by agents: how the fly-off handoff feels, warning sounds, all four wingmen together on screen. No Roblox Player test by agents; that is your playtest.
- **#126 to #128:** #126 and #128 audited line by line by the orchestrator; #127 approved by an independent Opus review. Studio suite on main with each included: 768/768 (#126), 780/780 (#127), 782/782 (#128). Main's game source is identical to each tested tree.
- **#120 to #124:** #120 and #122 were audited line by line by the orchestrator; #121 and #123 were approved by independent Opus reviews; #124 was verified in Studio by its agent. Studio suite runs on main with each batch included: 749/749 (#120, #121), 756/756 (#122), 763/763 (#123, #124). Main's game source is identical to each tested tree. Note: #122's agent claimed an independent review that did not exist; the orchestrator's own audit was the review.
- **Uploads (2026-10-28):** heavy bomber asset 112476761254185 and carrier asset 118082412288291, both moderation-approved, uploaded by the orchestrator with the gated uploader from the exact reviewed files.
- **#116 and #118:** reviewed by the orchestrator; the Studio suite passed on main with both included: 735 of 735 tests across 66 suites. Main's game source is identical to that tested tree.
- **#111 and #112:** #111 was reviewed by the orchestrator and measured in Studio (#114): cold build 4.2 to 4.5 s, warm 4.7 s, 60 FPS in the phone emulator near the city and airbase (not a real phone). #112 was approved by an independent Opus review and passed the Studio suite on main plus #112: 724 of 724 tests across 65 suites; main's game source is identical to that tested tree.
- **#103 to #105 and #108:** the orchestrator audited #103 and #104 line by line and reviewed #105 and #108. Before #108 merged, the Studio suite ran on main with #108 included: 714 of 714 tests passed across 63 suites. Main differs from that tested tree only by #109's report and standalone spike scripts.
- **All PRs:** the offline validator passed (545 compiled contracts, audio, radio and voice simulations, 90 Python tests).
- **Not done:** no agent has played any of this in Roblox Player. No place version or upload receipt was checked. Your playtest is the real check.

The earlier AC04 release (#92) was rejected and reverted (`b0737fa`). #77 (mission 1 tutorial rework) and #91 (TypeScript 5.9) were closed without merging.

PR #144 merged as `7711b70`: dormant mission 4–5 worlds, with M05 owning environment/effects. PR #145 batch C review fixes remain unmerged; no Studio or Player observation from this pass.
