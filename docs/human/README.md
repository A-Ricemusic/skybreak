# SKYBREAK redesign dashboard

Last updated: 2026-10-29, against `main` at `68f2df5`.

The new 18-mission campaign is live in Roblox Player through the automatic pipeline. **Practice flight, mission 1 and mission 2 are playable; missions 3 to 18 are locked.** The redesign rebuilds missions and worlds to match Ace Combat 04's structure and pacing while keeping the Broken Relay story and original shipped expression. Mission 2 is ready for the owner's beta test; see [Next](next.md).

[Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Mission 2 became playable in #143 after its dormant world (#140) and engine batch A (#138). It unlocks after mission 1 and preserves mission 1 score breakdowns through completion, replays and save reloads. The publish workflow returned place version 92. No agent Player test is claimed.

Missions 3–5 are in progress. Mission 3's world (#139) and engine batch B (#141) are merged and dormant; its mission-data PR is in progress. Mission 4–5 assets are merged and wired but dormant (#137, #142); their worlds are in review in #144 and engine batch C is in review in #145. The full Roblox Jest suite passed in Studio on #142 (808/808), but mission 3–5 visual integration and Player quality are not established.

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Yes | Yes | Earlier tuning; current #134 tuning awaits feedback |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Yes (#143) | Yes | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | In progress: dormant world (#139) and engine batch B (#141) merged; mission-data PR in progress | No | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | In progress: assets wired (#142) and world (#144) merged, dormant; engine batch C #145 in review | No | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | In progress: assets wired (#142) and world (#144) merged, dormant; engine batch C #145 in review | No | — |
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

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved. PR #142 wires them but leaves them unused until missions 4–5. Studio inspection on 2026-10-29 confirmed -Z forward, +Y up and plausible scale beside the heavy bomber, tanker waterline at sea level with `groundOffset=16`, helicopter port tail rotor and both configured rotor hubs, and elite orientation matching regular Vanta v2. All orientation corrections remain zero. [Screenshots and measured results](../qa/orientation/2026-10-29/README.md). Roblox Jest: 808 passed / 0 failed across 80 suites after rebase onto main (#139/#141). No Player test was performed.
