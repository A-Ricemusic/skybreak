# SKYBREAK redesign dashboard

## Engine batch D5 — dormant, unmerged

D5 carrier rearm, shared friendly ground progress, beach-priority attackers and M09 typed targets are implemented as dormant engine opt-ins. No catalog mission/level status changes. Studio/Player verification remains pending; see next.md and blockers.md. Shipped history is unchanged.

Unmerged owner tuning (D-220/D-221): M01/M02 add four optional fighters each with higher rank cuts; shared allied flights default to one combined kill per sortie. Existing live gameplay stays as merged main until this PR merges. See [Next](next.md) for exact changes and owner checks.

Last updated: 2026-10-29, against main `7d73c44` (mission 3 merged).
Last updated: 2026-10-30, against main `5034b39` (missions 6–13 dormant worlds merged); PR #172 (TGT button) open.
M12/M13 procedural worlds are in review in [PR #170](https://github.com/A-Ricemusic/skybreak/pull/170) on `feat/m12-m13-worlds`, stacked on #167 → #166 → #164. Dormant registry only; estimates12.771s/13.253s, full validator exit0 (788 Luau contracts,122 Python tests); offline validation only. No Player/Studio test or mission activation. Decisions D-230–D-234.

M10/M11 worlds are **in review**, dormant on `feat/m10-m11-worlds`, stacked on [#166](https://github.com/A-Ricemusic/skybreak/pull/166) above #164. [M10 composition and complete target table](../specs/worlds/m10-composition.md) · [M11 composition and routes](../specs/worlds/m11-composition.md). No mission unlock, Studio/Player/phone verification, asset export or upload. Estimates **14.732 s / 14.455 s**, reserved descendants **1,422 / 264**; **780 offline Luau contracts and 122 Python tests pass**. PR [#167](https://github.com/A-Ricemusic/skybreak/pull/167): P1 river continuity fixed with generated-water flood-fill and centreline regression; M10 has1.268s estimate headroom. Decisions D-180–D-184.


M08/M09 worlds are in review on `feat/m08-m09-worlds`, stacked on PR #164: [island broadcast](../specs/worlds/m08-composition.md), [beach landing/carrier](../specs/worlds/m09-composition.md). Chunk/yield estimates **4.235 s / 10.474 s** (≤16 s); 771 offline Luau contracts and 122 Python tests pass. Dormant only; no Studio/Player/phone verification. D-170–D-173 document provisional scenery and carrier deck correction.

M06/M07 procedural worlds are in review on `feat/m06-m07-worlds`: [harbour composition](../specs/worlds/m06-composition.md), [array/canyon composition](../specs/worlds/m07-composition.md). Dormant registry only; no mission selects them. Local #158 chunk/yield estimates are 10.265 s / 14.501 s (≤16 s); M06 uses native water near action and flat distant sea Parts. Offline geometry/budget checks pass; no Studio/Player/phone verification. Provisional target layouts and measured load/visual acceptance remain open (D-160–D-163).

Last updated: 2026-10-29, documentation against `main` at `b359c61`; gameplay/publish baseline remains `088fbfc`.

The new 18-mission campaign is live in Roblox Player through the automatic pipeline. **Practice flight and missions 1 to 3 are playable; missions 4 to 18 are locked.** The redesign rebuilds missions and worlds to match Ace Combat 04's structure and pacing while keeping the Broken Relay story and original shipped expression. Mission 2 is ready for the owner's beta test; see [Next](next.md).

Targeting: auto-acquire (spawn, kill, phase entry) targets what the nose is on (#157: ahead, in range and visible first; required targets favoured at similar bearings; blocked, out-of-range and behind contacts last). The TGT press (Tab/R, gamepad Y, on-screen button) selects the closest enemy on screen, or the second closest when that is already the target; quick presses within 2.5 s walk outward and wrap; with nothing on screen it falls back to the closest enemy overall (D-210, PR [#172](https://github.com/A-Ricemusic/skybreak/pull/172), open). On a phone, tap an enemy target box to select it. No agent phone or Player check is claimed for either change; see [targeting](../specs/engine/targeting.md).
The new 18-mission campaign is live in Roblox Player through the automatic pipeline. **Practice flight and missions 1–3 are playable; missions 4–18 are locked.** The redesign rebuilds missions and worlds to match Ace Combat 04's structure and pacing while keeping the Broken Relay story and original shipped expression. Mission 2 is ready for the owner's beta test; see [Next](next.md).

**Voice (2026-10-30):** Roblox rejected the regenerated voiceBank01, and there will be no more audio uploads (D-142). The approved live voice is unaffected. New and changed story lines are subtitle-only. #159 rewrites the 10 riskiest lines. See [blockers](blockers.md).
Last updated: 2026-10-29, against `main` at `7d73c44` (#147), with unmerged M04 fixes on PR #149.

The new 18-mission campaign is live in Roblox Player through the automatic pipeline. **Practice flight and missions 1–3 are playable; missions 4–18 are locked on main.** The redesign rebuilds missions and worlds to match Ace Combat 04's structure and pacing while keeping the Broken Relay story and original shipped expression. Mission 2 is ready for the owner's beta test; see [Next](next.md).

[Per-level status and test checklist](levels.html) · [Play SKYBREAK](https://www.roblox.com/games/112911685457826)

Mission 2 became playable in #143 after its dormant world (#140) and engine batch A (#138). It unlocks after mission 1 and preserves mission 1 score breakdowns through completion, replays and save reloads. The publish workflow returned place version 92. No agent Player test is claimed.

The owner's report of the avatar dying in flight (zero health bar top right, red screen flash) is diagnosed and fixed in [PR #156](https://github.com/A-Ricemusic/skybreak/pull/156): the game no longer spawns a Roblox avatar at all and hides the default health GUI (D-086). Verified in Studio across practice, mission 1 and mission 2; not a Player test.

Missions 3–5 are in review: [#147](https://github.com/A-Ricemusic/skybreak/pull/147), [#149](https://github.com/A-Ricemusic/skybreak/pull/149), and [#148](https://github.com/A-Ricemusic/skybreak/pull/148). Their worlds (#139/#144) and engines (#141/#145) are merged but dormant. They remain locked on main. Latest publish: place version **94** at `088fbfc`; this does not activate missions 3–5. See the per-level page for reported Studio evidence, open findings and beta checklists. No agent Player test is claimed.
Mission 3 merged in [#147](https://github.com/A-Ricemusic/skybreak/pull/147) and is live by pipeline convention; no new Player test is claimed. Missions 4–5 remain in review (#149/#148). The story remap (#159) aligns all 18 chapters and the finale, with future mission text and a recording manifest. New dialogue is subtitle-only (D-142); Studio verification is pending; see [routing audit](../specs/story/routing-audit.md).
Mission 3 merged as #147 (`7d73c44`) and is live by the owner's pipeline convention, including the shared world gate (D-067). Mission 4 [#149](https://github.com/A-Ricemusic/skybreak/pull/149) and mission 5 [#148](https://github.com/A-Ricemusic/skybreak/pull/148) remain in review and locked on main. M04 now uses that gate and a 6:48.33 transport escape route (D-096/D-097); this revision has no Studio or Player verification. The orchestrator owns the Studio re-check and terrain performance follow-up.


Engine plan for missions 6–18 and batch D1 (player gun, optional finite ammunition with rearm refills) are in review; D1 is dormant, so practice and missions 1–5 are unchanged (D-150–D-155). See [Next](next.md) and the [engine plan](../specs/engine/missions-06-18-plan.md).

D3 now incorporates D2 `4b317f8` and current-main nose-first targeting; its canyon/sphereSweep support is preserved. Studio testing is owned by the orchestrator. D3 is an unmerged engine stack above D2: dormant artillery/canyon escape, area footprint and M7 target types (D-240–D-244). No mission unlock or Player quality claim. See [Next](next.md).

Audio policy update (D-142, owner, 2026-10-30): no further audio uploads; story continues in subtitles beyond existing approved voices and changed lines stay silent. The rejected bank is preserved at `evidence/voicebank01-rejected` (`ff4a78b`); [full incident case](../qa/audio-rejections/2026-10-30-voicebank01.md). This documentation adds no gameplay changes or Player verification.

M14–M18 procedural worlds are in review on `feat/m14-m18-worlds`, dormant and unmerged. Offline geometry/build budgets are reported in their composition docs; Studio/Player/phone quality remains unverified. No catalog/unlock changes.

## PR #176 review fixes (2026-10-30)

**Mission 5 client fix included:** the old weather lookup also dereferenced nil for every M05–M13 world key on main. The shared world-environment registry now resolves all eighteen server world keys, including M05, and safely ignores unknown/unset names. Desktop/phone/reduced-motion effects and phone cloud decks are checked against each environment; a static offline gate checks registry coverage against actual server registrations/publications. No Studio/Player observation is claimed.

M18 groove/vent decks now include solid structural columns from Y0 to the unchanged Y104 flight floor; the local exit foundation continues beneath the over-water end. Floor widths support the walls across their complete footprints (244 groove /392 vent); core extends down to the deck. Generator-end floor modules extend40studs beyond each room end to carry the complete target footprint. Tests explicitly require all thirteen structural decks and check terrain contact/clearance across their footprints, wall/target/buttress support and the unchanged swept flight envelopes. This replaces the vacuous name-only M18 foundation check.

M17 now matches the spec:18:20 and12,000ft cloud-base reference metadata. No adaptation is claimed. Build and full offline validation passed (exit0;856 Luau contracts,124 Python tests,18-key registry gate). Worlds remain dormant and unmerged.

## Mission progress

| # | Reference mission | Footage time | Gameplay length | Footage indexed | Spec written | Built | Live | Owner tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30–0:11:24 | 4.9 min | Yes | Yes | Yes | Yes | Earlier tuning; current #134 tuning awaits feedback |
| 2 | Imminent Threat | 0:15:38–0:22:34 | 6.9 min | Yes | Yes | Yes (#143) | Yes | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Yes (#147 merged); world #139 and engine #141 merged | Yes | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | In review #149; assets #142, world #144 and engine #145 merged, dormant | No | — |
| 3 | The Northern Eye | 0:26:41–0:34:24 | 7.7 min | Yes | Yes | Yes (#147 merged); world #139 and engine #141 merged | Yes (pipeline) | — |
| 4 | Blockade | 0:36:36–0:42:42 | 6.1 min | Yes | Yes | In review #149; shared cleanup gate and 6:48.33 escape fixed in branch, Studio re-check pending; load-time fix (D-120: 66→11.7 s terrain in a Studio bench) in a PR stacked on #149; assets #142, world #144 and engine #145 merged, dormant | No | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | In review #148: Studio Jest 972/972; a real-UI scripted run completed; world build about 18 s after D-120 | No | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 17.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m06.md), [world](../specs/worlds/m06.md)) | Unbuilt / locked | No | — |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m07.md), [world](../specs/worlds/m07.md)) | Unbuilt / locked | No | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 13.4 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m08.md), [world](../specs/worlds/m08.md)) | Unbuilt / locked | No | — |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 18.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m09.md), [world](../specs/worlds/m09.md)) | Unbuilt / locked | No | — |
| 10 | Tango Line | 2:16:13–2:37:51 | 21.6 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m10.md), [world](../specs/worlds/m10.md)) | Unbuilt / unavailable | No | — |
| 11 | Escort | 2:39:46–2:45:27 | 5.7 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m11.md), [world](../specs/worlds/m11.md)) | Unbuilt / unavailable | No | — |
| 12 | Stonehenge Offensive | 2:48:27–3:04:55 | 16.5 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m12.md), [world](../specs/worlds/m12.md)) | Unbuilt / unavailable | No | — |
| 13 | Safe Return | 3:08:30–3:18:42 | 10.2 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m13.md), [world](../specs/worlds/m13.md)) | Unbuilt / unavailable | No | — |
| 5 | Lifeline | 0:44:42–0:58:13 | 13.5 min | Yes | Yes | In review #148; assets #142, world #144 and engine #145 merged, dormant | No | — |
| 6 | Invincible Fleet | 1:03:01–1:20:00 | 17.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m06.md), [world](../specs/worlds/m06.md)) | World in review / locked | No | — |
| 7 | Deep Strike | 1:22:13–1:35:49 | 13.6 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m07.md), [world](../specs/worlds/m07.md)) | World in review / locked | No | — |
| 8 | Shattered Skies | 1:39:16–1:52:39 | 13.4 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m08.md), [world](../specs/worlds/m08.md)) | World in review / locked | No | — |
| 9 | Operation Bunker Shot | 1:56:14–2:14:14 | 18.0 min | Yes | Spec written / in review ([PR #155](https://github.com/A-Ricemusic/skybreak/pull/155); [mission](../specs/missions/m09.md), [world](../specs/worlds/m09.md)) | World in review / locked | No | — |
| 10 | Tango Line | 2:16:13–2:37:51 | 21.6 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m10.md), [world](../specs/worlds/m10.md)) | World in review / dormant | No | — |
| 11 | Escort | 2:39:46–2:45:27 | 5.7 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m11.md), [world](../specs/worlds/m11.md)) | World in review / dormant | No | — |
| 12 | Stonehenge Offensive | 2:48:27–3:04:55 | 16.5 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m12.md), [world](../specs/worlds/m12.md)) | World in review ([composition](../specs/worlds/m12-composition.md)); mission unavailable | No | — |
| 13 | Safe Return | 3:08:30–3:18:42 | 10.2 min | Yes | Written / in review ([#153](https://github.com/A-Ricemusic/skybreak/pull/153); [mission](../specs/missions/m13.md), [world](../specs/worlds/m13.md)) | World in review ([composition](../specs/worlds/m13-composition.md)); mission unavailable | No | — |
| 14 | Breaking Arrows | 3:20:22–3:28:38 | 8.3 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m14.md), [world](../specs/worlds/m14.md)) | World in review ([composition](../specs/worlds/m14-composition.md)); mission unavailable | No | — |
| 15 | Emancipation | 3:32:45–3:47:38 | 14.9 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m15.md), [world](../specs/worlds/m15.md)) | World in review ([composition](../specs/worlds/m15-composition.md)); mission unavailable | No | — |
| 16 | Whiskey Corridor | 3:50:50–4:12:27 | 21.6 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m16.md), [world](../specs/worlds/m16.md)) | World in review ([composition](../specs/worlds/m16-composition.md)); mission unavailable | No | — |
| 17 | Siege of Farbanti | 4:14:30–4:32:17 | 17.8 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m17.md), [world](../specs/worlds/m17.md)) | World in review ([composition](../specs/worlds/m17-composition.md)); mission unavailable | No | — |
| 18 | Megalith | 4:36:59–4:46:22 | 9.4 min | Yes | Spec written / in review ([PR #154](https://github.com/A-Ricemusic/skybreak/pull/154); [mission](../specs/missions/m18.md), [world](../specs/worlds/m18.md)) | World in review ([composition](../specs/worlds/m18-composition.md)); mission unavailable | No | — |

"Footage indexed" means the mission's boundaries are timed to about 1 second from the 480p copy. Detail inside missions has only been seen every 10 seconds so far; each spec adds a closer look. "Gameplay length" is the footage player's time from launch to mission end, including landings. Reference titles are internal cross-references (D-001) and never appear in the game. The full timeline is in the [footage ledger](../../reference/ledger.md).

## Pages

- [Shipped](shipped.md): what is merged and what you will see in Roblox Player.
- [Next](next.md): what is coming, in order.
- [Blockers](blockers.md): what is slowing agents down, and what needs you.
- [Decisions](decisions.md): every decision, with reasons. All four open questions are now answered.
- [Redesign plan](../redesign-plan.md): the original plan. Where it conflicts with the decisions log, the decisions log wins.

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved. PR #142 wires them but leaves them unused until missions 4–5. Studio inspection on 2026-10-29 confirmed -Z forward, +Y up and plausible scale beside the heavy bomber, tanker waterline at sea level with `groundOffset=16`, helicopter port tail rotor and both configured rotor hubs, and elite orientation matching regular Vanta v2. All orientation corrections remain zero. [Screenshots and measured results](../qa/orientation/2026-10-29/README.md). Roblox Jest: 808 passed / 0 failed across 80 suites after rebase onto main (#139/#141). No Player test was performed.

PR #145 is merged at `088fbfc` and remains dormant. #142 is merged; approved elite revision 3 (10/10) is uploaded as `139083376207373`. #144 is now merged; its world owns M05 environment and exports light anchors. See Next for the precise remaining presentation work.

Engine batch D2 is implemented but unmerged on a branch stacked on D1 (#165). Naval lifecycle/routes, firing SAMs and anti-ship fit remain data opt-ins with no mission activation or level-status change. See D-190–D-193 and [Next](next.md). No D2 Studio or Player observation is claimed.

D2 review follow-up addresses the orchestrator’s approval-with-nits at `20d21ec`: combined SAM threat budgets, initial route heading validation, allocation-free retired-group checks, anti-ship guidance/refusal clarity and added regression coverage. No level activation or shipped status changes; updated-head Roblox verification remains outstanding.

D2 test-fixture follow-up corrects the missing phase target list reported by the D3 Jest run; build/offline validation pass. No D2 Jest run or totals were obtained. The orchestrator deferred D2 Studio use until D1 (#165) merges and D2 rebases, prioritizing D1 and mission 5 first. No gameplay or level-status change.

D2 integration update (2026-10-30): merged D1 `5a07c23` into #168 while retaining main’s targeting, mission 5 and worlds 6–13 plus D2’s naval changes and corrected test fixture. This changes no mission status relative to updated D1. Studio testing remains assigned to the orchestrator; no Studio launch or new Jest/Player observation during this merge.
