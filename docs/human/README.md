# SKYBREAK redesign dashboard

Updated 2026-10-30 against main `9857358`. Publish workflow for this main revision succeeded per CI. Merged gameplay is live in Roblox Player under the owner's automatic-pipeline convention; no Player test is claimed here.

## Engine batch D5 — dormant, unmerged

D5 carrier rearm, shared friendly ground progress, beach-priority attackers and M09 typed targets are implemented as dormant engine opt-ins. No catalog mission/level status changes. Beach-only windups are excluded from player lock warnings and service threats; player windups retain both effects. Studio/Player verification remains pending; see next.md and blockers.md. Shipped history is unchanged.

**Practice and missions 1–5 are live. Missions 6–18 remain locked, with their worlds built and dormant.** Mission 6 is in progress; mission 7 is in review [#178](https://github.com/A-Ricemusic/skybreak/pull/178). Engine D1–D3 are merged and dormant; D4 [#177](https://github.com/A-Ricemusic/skybreak/pull/177) awaits merge, D5/D6 are in progress.

Live changes include mission 5's refinery strike/rearm/escape (#148), closest-on-screen TGT cycling (#172), full-bleed loading with jet/progress/tips (#173), and harder M01/M02 with a shared allied kill budget of approximately one per sortie (#174). #176 also fixes weather lookup for M05–M13 and registers all 18 environments. Automatic acquisition remains nose-first; practice and missions 1–5 do not enable the dormant gun, finite stock, naval/SAM/anti-ship or canyon/area-strike contracts.

New and changed story dialogue stays subtitle-only: no further audio uploads (D-142). Existing approved voice remains. Phone performance, balance and rendered quality need observation; merged/live does not mean playtested.

[Per-level status and owner checklist](levels.html) · [Play SKYBREAK](https://www.roblox.com/games/112911685457826)

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Playable | Yes (pipeline) | Earlier feedback; #174 tuning unverified |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | Playable | Yes (pipeline) | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 17.0 min | Yes | Yes | World built/dormant; mission in progress | No | — |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Yes | World built/dormant; mission in review #178 | No | — |
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
