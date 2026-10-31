# SKYBREAK redesign dashboard

D9 F21 is implemented on `feat/engine-batch-d9`, dormant and unmerged, depending on D7 #184. It adds static procedural airship targets, local capsule coverage for radar/locks and bounded protected-aircraft navigation holds. No catalog mission or frozen snapshot opts in; runtime Jest/Studio and M13 activation remain pending.

Updated 2026-10-30 from main #181 (`d1fb3a8`), with mission 6 #179. Publish workflow for this main revision succeeded per CI. Merged gameplay is live in Roblox Player under the owner's automatic-pipeline convention; no Player test is claimed here.

**Practice and missions 1–7 are live by the owner’s pipeline convention. Missions 8–18 remain locked, with their worlds built and dormant.** D1–D6 and M07 #178 are merged. M08 #183, M09 #185 and M10 #187 remain open. D7 #184 and D8 #186 are open engine dependencies; D9 remains dormant on this branch. Existing Studio evidence is scoped to its recorded revision; no fresh Player/phone observation is claimed here.

Live changes include mission 5's refinery strike/rearm/escape (#148), closest-on-screen TGT cycling (#172), full-bleed loading with jet/progress/tips (#173), and harder M01/M02 with a shared allied kill budget of approximately one per sortie (#174). #176 also fixes weather lookup for M05–M13 and registers all 18 environments. Automatic acquisition remains nose-first; practice and missions 1–5 do not enable the dormant gun, finite stock, naval/SAM/anti-ship or canyon/area-strike contracts.

New and changed story dialogue stays subtitle-only: no further audio uploads (D-142). Existing approved voice remains. Phone performance, balance and rendered quality need observation; merged/live does not mean playtested.

[Per-level status and owner checklist](levels.html) · [Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Mission 7 review fixes in #178: absolute Y=585 ceiling, full segmented artillery masking and a 60-second first impact for retained-pose canyon ingress. New real-world D-242 Jest coverage awaits the orchestrator; no Studio or Player verification claimed.

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Playable | Yes (pipeline) | Earlier feedback; #174 tuning unverified |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 15:00 active + optional service | Yes | Yes; provisional roster D-260 | ✓ #179 data/unlock; Studio ✓ full Jest 1,133/1,133 (orchestrator) | Live (pipeline after #179 merges) | Player/phone not yet observed |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Yes | Playable in #178 (unmerged); review fixes and offline checks, Studio pending | No | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 13.4 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 18.0 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 10 | Tango Line | 2:16:13–2:37:51 | 21.6 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 11 | Escort | 2:39:46–2:45:27 | 5.7 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 12 | Stonehenge Offensive | 2:48:27–3:04:55 | 16.5 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 13 | Safe Return | 3:08:30–3:18:42 | 10.2 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 14 | Breaking Arrows | 3:20:22–3:28:38 | 8.3 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 15 | Emancipation | 3:32:45–3:47:38 | 14.9 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 16 | Whiskey Corridor | 3:50:50–4:12:27 | 21.6 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 17 | Siege of Farbanti | 4:14:30–4:32:17 | 17.8 min | Yes | Yes | World built/dormant; mission integration pending | No | — |
| 18 | Megalith | 4:36:59–4:46:22 | 9.4 min | Yes | Yes | World built/dormant; mission integration pending | No | — |

Footage times are internal reference cross-references, not shipped titles; see the [ledger](../../reference/ledger.md). World construction does not activate a mission. No new Studio or Player verification was performed for this reconciliation.

- [Shipped](shipped.md): merged changes and visible behavior.
- [Next](next.md): ordered implementation and owner checks.
- [Blockers](blockers.md): remaining acceptance gaps and resolved dependencies.
- [Decisions](decisions.md): stable design records.

M07 review-fix validation (2026-10-30): frozen install, build and full `validate:offline` exited 0; 967 Luau contracts and 19 catalog snapshots passed. Voice manifests regenerated; no audio generated/uploaded. Studio/Player not run by this agent.

## D6 integration in review

D6 engine work is in review on `feat/engine-batch-d6`: dormant repeated artillery, parked/airborne credit deduplication, bounded static contact detail and six M10 target types (D-300–D-303). No mission opts in; Studio/runtime Jest/phone verification and M10 activation remain pending. See [engine plan](../specs/engine/missions-06-18-plan.md#7-batch-d6-implementation).

D6 integration checks: frozen install, build and full offline validation exit 0 (993 Luau contracts, 19 catalog snapshots, 124 Python tests; four negative loader probes). D4+D6 admission/contact regressions added; runtime specs compiled only. No Studio, `test:roblox`, Player or phone test performed.

## Dormant D7 branch

PR [#184](https://github.com/A-Ricemusic/skybreak/pull/184) adds protected-aircraft health/routes/markers, all-safe completion and immediate loss failure, airliner-priority attackers and an opt-in altitude envelope. It is unmerged and no catalog mission opts in. Main’s practice and missions 1–7 remain unchanged. D7 firing overrides apply only to selected protected aircraft; ordinary wingmen/player keep existing firing gates. Runtime Jest, Studio, Player and visual acceptance remain pending.

Main integration validation (2026-10-30): frozen install, standalone build and full offline validation exited 0; 1,007 Luau contracts, 19 unchanged catalog snapshots and 124 Python tests. The combined sector/protected-target warning rule passes offline; service-entry runtime regressions compile but remain unrun. No Studio/Player test. Main at integration is `ea0045d` (D5/D6 merged, M08 not merged). D4/D6 admission logic is retained; this main revision has no `concurrentRoutes` option.
