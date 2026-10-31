# SKYBREAK redesign dashboard

**M09 arrival regression, 2026-10-30:** Orchestrator reported Studio Jest 1,219/1,220 at `21be233`: the sole failure expected nine generic opening bandits, but D5 authors three required trios at mission times 600/625/650. #185 corrects the test to check exact timed admissions and duplicates, retaining D4 slots and adding grouped/delayed-launch coverage. Runtime remains unchanged: completion requires all nine kills. An offline regression clears early trios without ending the phase. Frozen install, build and full offline validation exited 0 (1,023 Luau contracts, 19 catalog snapshots, 124 Python tests). The director regression compiles but requires the orchestrator’s Studio rerun; this task did not launch Studio or claim a Player test.

Updated 2026-10-30 against main `06ca3e4`, integrating mission 10 #187. Merged gameplay is live by the owner's automatic-pipeline convention; no Player test is claimed.

**Practice and missions 1–9 are live; M10 RIVER LINE goes live after #187 merges. M11–M18 remain locked.** M10 unlocks after M09: ≥3,000 points through the full 20:00, repeated artillery, parked/airborne handoffs and optional runway rearm. Studio verified: pending orchestrator run. Player/phone not yet observed. M10 activates D6; D7/D8 remain dormant for later missions.

Live changes include mission 5's refinery strike/rearm/escape (#148), closest-on-screen TGT cycling (#172), full-bleed loading with jet/progress/tips (#173), and harder M01/M02 with a shared allied kill budget of approximately one per sortie (#174). #176 also fixes weather lookup for M05–M13 and registers all 18 environments. Automatic acquisition remains nose-first; practice and missions 1–5 do not enable the dormant gun, finite stock, naval/SAM/anti-ship or canyon/area-strike contracts.

New and changed story dialogue stays subtitle-only: no further audio uploads (D-142). Existing approved voice remains. Phone performance, balance and rendered quality need observation; merged/live does not mean playtested.

[Per-level status and owner checklist](levels.html) · [Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Mission 7 merged fixes in #178: absolute Y=585 ceiling, full segmented artillery masking and a 60-second first impact for retained-pose canyon ingress. New real-world D-242 Jest coverage awaits the orchestrator; no Studio or Player verification claimed.

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Playable | Yes (pipeline) | Earlier feedback; #174 tuning unverified |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 15:00 active + optional service | Yes | Yes; provisional roster D-260 | ✓ #179 data/unlock; Studio ✓ full Jest 1,133/1,133 (orchestrator) | Yes (pipeline) | Player/phone not yet observed |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Yes | Playable #178; Studio verified: pending orchestrator run | Yes (pipeline) | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 7:00 + 6:00 hold | Yes | Yes; provisional D-320–D-324 | Playable #183; Studio verified: pending orchestrator run | Yes (pipeline) | Player/phone not yet observed |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 10:00 + 7:00 + optional service | Yes | Yes; provisional D-340–D-344 | Playable #185; Studio verified: pending orchestrator run | Yes (pipeline) | Player/phone not yet observed |
| 10 | Tango Line | 2:16:13–2:37:51 | 20:00 + optional service | Yes | Yes; provisional D-380–D-383 | Playable #187; Studio verified: pending orchestrator run | Live after #187 merges (pipeline) | Player/phone not yet observed |
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

M08 integration validation (2026-10-30): frozen install, `bun run build`, `test:offline` and full `validate:offline` exited 0 using the supplied LUAU_BIN. Passed 984 Luau contracts, 19 catalog snapshots and 124 Python tests. Voice inventories regenerated: 189 entries, 111 pending recordings. All 87 offline spec registrations match the runner imports. Studio verified: pending orchestrator run; no Roblox Jest or Player tests performed.

M08 arrival regression follow-up (2026-10-30): the orchestrator reported 1,175/1,176 Studio Jest tests passing at `0227c1f`; the catalog opening-count test expected six immediate bombers instead of the authored one. Runtime inspection confirms D-272 scheduling and full-six-kill/6:00 completion accounting. The test now checks exact due slots/identities before and at every arrival, rejects duplicate admissions, and preserves full opening counts for unscheduled formations. A partial-kill timeout regression covers one through five kills. Studio rerun belongs to the orchestrator; this agent did not launch Studio or run Roblox Jest.

M08 follow-up validation: `bun install --frozen-lockfile`, `bun run build`, and full `validate:offline` with the supplied `LUAU_BIN` each exited 0 (991 Luau contracts, 19 catalog snapshots, 124 Python tests). The director regression compiled; Studio execution remains pending. No gameplay/runtime changes.

## D6 merged (#182; M10 activation in #187)

D6 engine work is merged (#182, `ea0045d`): repeated artillery, parked/airborne credit deduplication, bounded static contact detail and six M10 target types (D-300–D-303). M10 opts in with #187; Studio/runtime Jest/phone verification remains pending. See [engine plan](../specs/engine/missions-06-18-plan.md#7-batch-d6-implementation).

D6 integration checks: frozen install, build and full offline validation exit 0 (993 Luau contracts, 19 catalog snapshots, 124 Python tests; four negative loader probes). D4+D6 admission/contact regressions added; runtime specs compiled only. No Studio, `test:roblox`, Player or phone test performed.

M09 integration validation (2026-10-30): frozen install, `bun run build`, `test:offline` and full `validate:offline` with the supplied `LUAU_BIN` exited 0. Passed 1,009 Luau contracts, four negative loader probes, 19 catalog snapshots and 124 Python tests. All 90 offline specs match registration/import lists; checkedRequire remains. Combined inventories: 192 entries, 114 subtitle-only pending recordings; every existing line and non-M09 catalog entry preserved. Studio verified: pending orchestrator run. No Studio, Roblox Jest or Player test performed.

## D7 merged (#184, dormant)

PR [#184](https://github.com/A-Ricemusic/skybreak/pull/184) adds protected-aircraft health/routes/markers, all-safe completion and immediate loss failure, airliner-priority attackers and an opt-in altitude envelope. It is merged and no catalog mission opts in. Main’s practice and missions 1–9 remain unchanged. D7 firing overrides apply only to selected protected aircraft; ordinary wingmen/player keep existing firing gates. Runtime Jest, Studio, Player and visual acceptance remain pending.

Main integration validation (2026-10-30): frozen install, standalone build and full offline validation exited 0; 1,007 Luau contracts, 19 unchanged catalog snapshots and 124 Python tests. The combined sector/protected-target warning rule passes offline; service-entry runtime regressions compile but remain unrun. No Studio/Player test. Main at integration is `ea0045d` (D5/D6 merged, M08 not merged). D4/D6 admission logic is retained; this main revision has no `concurrentRoutes` option.

## D8 main integration (2026-10-30)

Dormant D8 ground ECM, required-strike rearm, precision bomb, elite retreat/recovery and ring sweep contracts are integrated with main’s D6, M08 and D7 hooks. No catalog opt-ins or frozen snapshots change. See D-400–D-402 and the engine plan. Runtime Jest, Studio/Player and M12 acceptance remain pending.

D8 main integration validation (2026-10-30, main `5d84486`): frozen install, build and full `validate:offline` with the prescribed `LUAU_BIN` each exited 0: 1,023 Luau contracts, 19 unchanged catalog snapshots, four loader guard probes and 124 Python tests. All 92 spec registrations match runner imports and retain both parents. No Studio, `test:roblox`, Player tests or uploads performed. D8 remains dormant; M12 dependent branch untouched.

M10 main integration validation (2026-10-30, main `06ca3e4`): frozen install, standalone build, `test:offline`, and full `validate:offline` with `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau"` exited 0. Final suite: 1,042 Luau contracts, four negative loader probes, 19 catalog snapshots, three QA-pilot scenarios and 124 Python tests. All 94 specs match registration/import lists and retain checkedRequire. Regenerated 199 voice/story entries (121 pending recordings); every prior voice id and every non-M10 voice/catalog entry is preserved. M10 unlocks after M09; M11–M18 remain locked even with forged completions. The opt-in route cap preserves default admissions; D7 protected actors remain outside hostile rosters and D8 withdrawing actors do not consume route slots. Studio verified: pending orchestrator run. No Studio, Roblox Jest or Player tests, audio generation or asset uploads.

## D9 merged (#188, dormant)

D9 remains dormant and unmerged on PR #188, now integrated with main’s D7, D8 and missions 8–9. No catalog or frozen snapshot changes. Static airship jammers, local corridor coverage and bounded protected-aircraft navigation holds coexist with D8 ground ECM. Practice and missions 1–9 retain main’s behaviour. Runtime Jest, Studio/Player and M13 acceptance remain pending.

D9 integration validation (2026-10-30, main `06ca3e4`): `bun install --frozen-lockfile`, `bun run build` and full `validate:offline` with the prescribed `LUAU_BIN` each exited 0. Passed 1,040 Luau contracts, four loader guard probes, 19 unchanged catalog snapshots and 124 Python tests. All 94 offline spec registrations match runner imports and retain `checkedRequire`. D8 ground ECM / D9 airship validation coexistence passes offline; runtime counting/kill-call regressions compile but remain unrun. No Studio, `test:roblox` or Player test performed.
