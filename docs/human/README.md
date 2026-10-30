# SKYBREAK redesign dashboard

Voice follow-up: draft [#161](https://github.com/A-Ricemusic/skybreak/pull/161), stacked on #159, contains three regenerated banks (168 lines). Automated checklists pass after 10 documented cached-STT exceptions. All bank asset IDs intentionally remain empty pending exact-hash independent review and upload; this is unmerged work, not Player-verified audio. Human listening remains false. All 122 story recording references and the editorial manifest now use the regenerated cues; consumer simulation checks silence before fake asset injection. Frozen install, build and full offline validation passed (756 relay tests, 9 voice simulations, 122 Python tests); this does not establish audible quality. See VOICE-161 in decisions.

Last updated: 2026-10-29, against main `7d73c44` (mission 3 merged).

The new 18-mission campaign is live in Roblox Player through the automatic pipeline. **Practice flight and missions 1–3 are playable; missions 4–18 are locked.** The redesign rebuilds missions and worlds to match Ace Combat 04's structure and pacing while keeping the Broken Relay story and original shipped expression. Mission 2 is ready for the owner's beta test; see [Next](next.md).

**Voice uploads halted (2026-10-30):** Roblox rejected the regenerated voiceBank01 (asset 97298487668258). The approved live voice is unaffected. #159 rewrites the 10 riskiest new lines (D-141). See [blockers](blockers.md).

[Per-level status and test checklist](levels.html) · [Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Mission 2 became playable in #143 after its dormant world (#140) and engine batch A (#138). It unlocks after mission 1 and preserves mission 1 score breakdowns through completion, replays and save reloads. The publish workflow returned place version 92. No agent Player test is claimed.

Mission 3 merged in [#147](https://github.com/A-Ricemusic/skybreak/pull/147) and is live by pipeline convention; no new Player test is claimed. Missions 4–5 remain in review (#149/#148). The story remap (#159) aligns all 18 chapters and the finale, with future mission text and a recording manifest. Studio verification and voice upload are pending (regenerated audio is in draft #161); see [routing audit](../specs/story/routing-audit.md).

The mission 3 PR (#147) also adds a shared world gate: after any sortie the world is cleared in the background and the next launch waits, queued, until that finishes (D-067). Provisional mission 3 decisions are D-061–D-067 in [Decisions](decisions.md).

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Yes | Yes | Earlier tuning; current #134 tuning awaits feedback |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Yes (#143) | Yes | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Yes (#147 merged); world #139 and engine #141 merged | Yes | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | In review #149; assets #142, world #144 and engine #145 merged, dormant | No | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | In review #148; assets #142, world #144 and engine #145 merged, dormant | No | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 17.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m06.md), [world](../specs/worlds/m06.md)) | Unbuilt / locked | No | — |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m07.md), [world](../specs/worlds/m07.md)) | Unbuilt / locked | No | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 13.4 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m08.md), [world](../specs/worlds/m08.md)) | Unbuilt / locked | No | — |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 18.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m09.md), [world](../specs/worlds/m09.md)) | Unbuilt / locked | No | — |
| 10 | Tango Line | 2:16:13–2:37:51 | 21.6 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m10.md), [world](../specs/worlds/m10.md)) | Unbuilt / unavailable | No | — |
| 11 | Escort | 2:39:46–2:45:27 | 5.7 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m11.md), [world](../specs/worlds/m11.md)) | Unbuilt / unavailable | No | — |
| 12 | Stonehenge Offensive | 2:48:27–3:04:55 | 16.5 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m12.md), [world](../specs/worlds/m12.md)) | Unbuilt / unavailable | No | — |
| 13 | Safe Return | 3:08:30–3:18:42 | 10.2 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m13.md), [world](../specs/worlds/m13.md)) | Unbuilt / unavailable | No | — |
| 14 | Breaking Arrows | 3:20:22–3:28:38 | 8.3 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m14.md), [world](../specs/worlds/m14.md)) | Unbuilt / unavailable | No | — |
| 15 | Emancipation | 3:32:45–3:47:38 | 14.9 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m15.md), [world](../specs/worlds/m15.md)) | Unbuilt / unavailable | No | — |
| 16 | Whiskey Corridor | 3:50:50–4:12:27 | 21.6 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m16.md), [world](../specs/worlds/m16.md)) | Unbuilt / unavailable | No | — |
| 17 | Siege of Farbanti | 4:14:30–4:32:17 | 17.8 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m17.md), [world](../specs/worlds/m17.md)) | Unbuilt / unavailable | No | — |
| 18 | Megalith | 4:36:59–4:46:22 | 9.4 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m18.md), [world](../specs/worlds/m18.md)) | Unbuilt / unavailable | No | — |

"Footage indexed" means the mission's boundaries are timed to about 1 second from the 480p copy. Detail inside missions has only been seen every 10 seconds so far; each spec adds a closer look. "Gameplay length" is the footage player's time from launch to mission end, including landings. Reference titles are internal cross-references (D-001) and never appear in the game. The full timeline is in the [footage ledger](../../reference/ledger.md).

## Pages

- [Shipped](shipped.md): what is merged and what you will see in Roblox Player.
- [Next](next.md): what is coming, in order.
- [Blockers](blockers.md): what is slowing agents down, and what needs you.
- [Decisions](decisions.md): every decision, with reasons. All four open questions are now answered.
- [Redesign plan](../redesign-plan.md): the original plan. Where it conflicts with the decisions log, the decisions log wins.

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved. PR #142 wires them but leaves them unused until missions 4–5. Studio inspection on 2026-10-29 confirmed -Z forward, +Y up and plausible scale beside the heavy bomber, tanker waterline at sea level with `groundOffset=16`, helicopter port tail rotor and both configured rotor hubs, and elite orientation matching regular Vanta v2. All orientation corrections remain zero. [Screenshots and measured results](../qa/orientation/2026-10-29/README.md). Roblox Jest: 808 passed / 0 failed across 80 suites after rebase onto main (#139/#141). No Player test was performed.

PR #145 is merged at `088fbfc` and remains dormant. #142 is merged; approved elite revision 3 (10/10) is uploaded as `139083376207373`. #144 is now merged; its world owns M05 environment and exports light anchors. See Next for the precise remaining presentation work.
