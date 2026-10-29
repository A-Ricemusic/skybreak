# SKYBREAK redesign dashboard

Last updated: 2026-10-29; mission 2/3 status includes unmerged PRs #140/#139.

The new 18-mission campaign is live in Roblox Player (practice flight and mission 1 playable). The redesign rebuilds the missions and worlds to match Ace Combat 04 (objectives, mission length, scoring, terrain and environment) while keeping the Broken Relay story. It goes one mission at a time. The footage is fully indexed. **Mission 1 is ready for your beta test.** The new campaign is live by pipeline: the practice flight and mission 1 are playable, missions 2 to 18 are locked. See [Next](next.md) for what to try.

[Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Engine batch A is built but dormant on unmerged PR #138: typed targets, triggered waves, standalone ace and AA. Practice and mission 1 catalog snapshots remain frozen; no Studio or Player testing is claimed for this branch. See [Next](next.md) and provisional D-042–D-044 in [Decisions](decisions.md).

Engine batch B is built but dormant and unmerged on `feat/engine-batch-b`; mission 3 remains locked. Return/update/landing and terrain warning contracts are available for later integration. PR #141 review corrections cover extended-clock settlement, projected return guidance, landing camera/skip safety and clearance tint; mission 3 presentation gaps remain listed in Next. Studio and Player verification remain pending.

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Yes | Yes | — |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Dormant world in review (#140); not playable | No | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Dormant world (#139) and engine batch B (#141) merged; mission data pending; not playable | No | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | — | — | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | — | — | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 17.0 min | Yes | — | — | — | — |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | — | — | — | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 13.4 min | Yes | — | — | — | — |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 18.0 min | Yes | — | — | — | — |
| 10 | Tango Line | 2:16:13–2:37:51 | 21.6 min | Yes | — | — | — | — |
| 11 | Escort | 2:39:46–2:45:27 | 5.7 min | Yes | — | — | — | — |
| 12 | Stonehenge Offensive | 2:48:27–3:04:55 | 16.5 min | Yes | — | — | — | — |
| 13 | Safe Return | 3:08:30–3:18:42 | 10.2 min | Yes | — | — | — | — |
| 14 | Breaking Arrows | 3:20:22–3:28:38 | 8.3 min | Yes | — | — | — | — |
| 15 | Emancipation | 3:32:45–3:47:38 | 14.9 min | Yes | — | — | — | — |
| 16 | Whiskey Corridor | 3:50:50–4:12:27 | 21.6 min | Yes | — | — | — | — |
| 17 | Siege of Farbanti | 4:14:30–4:32:17 | 17.8 min | Yes | — | — | — | — |
| 18 | Megalith | 4:36:59–4:46:22 | 9.4 min | Yes | — | — | — | — |

"Footage indexed" means the mission's boundaries are timed to about 1 second from the 480p copy. Detail inside missions has only been seen every 10 seconds so far; each spec adds a closer look. "Gameplay length" is the footage player's time from launch to mission end, including landings. Reference titles are internal cross-references (D-001) and never appear in the game. The full timeline is in the [footage ledger](../../reference/ledger.md).

## Pages

- [Shipped](shipped.md): what is merged and what you will see in Roblox Player.
- [Next](next.md): what is coming, in order.
- [Blockers](blockers.md): what is slowing agents down, and what needs you.
- [Decisions](decisions.md): every decision, with reasons. All four open questions are now answered.
- [Redesign plan](../redesign-plan.md): the original plan. Where it conflicts with the decisions log, the decisions log wins.

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved on 2026-10-29. This branch wires their IDs, specs and selectors but leaves them unused until missions 4–5; practice and mission 1 remain unchanged. Studio orientation/scale inspection is pending with the orchestrator; no Studio or Player test was performed here.
