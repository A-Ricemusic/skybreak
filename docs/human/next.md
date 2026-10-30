# Next

## M12/M13 worlds — in review

1. Review [M12 composition/table](../specs/worlds/m12-composition.md) and [M13 composition/table](../specs/worlds/m13-composition.md). Estimates12.770960s/13.253200s retain3.229040s/2.746800s against16s. Branch stacks on #167 → #166 → #164; rebase main as dependencies merge; do not merge this PR yet.
2. Render and fly crater ingress/service approaches and the fog ravine/exit, compare against accepted specs, inspect procedural silhouettes and conservative ravine width, and measure build/clear/phone costs before activation.
3. Integrate M12 seven live guns then elite,24 ground/9 air kills,15:00+10:00, initial3/18/21; resolve initial/final count difference, ECM, finite ammunition/rearm, animated destruction/ejection. Integrate M13 ≥1300 at7:00 expiry then15:00 protected-plane intercept,32 jammers, spatial coverage, visual guns, damageable plane and fighter priorities. No unlock changes here.

## M10/M11 world review and integration

1. Re-review PR [#167](https://github.com/A-Ricemusic/skybreak/pull/167) P1 fix: generated-water connectivity and centreline checks now pass; M10 estimate14.732s with1.268s headroom. Review [M10](../specs/worlds/m10-composition.md) and [M11](../specs/worlds/m11-composition.md), including provisional inventories, full target tables and budgets. Rebase onto main after #164/#166 merge; do not merge this PR as part of this task.
2. Once Studio is authenticated, compare ingress, river turn/pen mouth and snowy high/low bands against the cited spec views, fly both landing envelopes and both civilian routes, and measure real build/clear/phone performance. Offline checks establish geometry contracts only.
3. Resolve M10 per-type roster/26-air activation, artillery, ammunition/rearm and 3,000-point/20:00 integration. Extend M11 encounter validation above 2,000 without clipping its 2,800-stud route; implement independent survival/progress for both civilians and the 5:30 protection objective. Review compressed vertical/cloud treatment together before activation.


## M08/M09 worlds — in review

Review the [broadcast island](../specs/worlds/m08-composition.md) and [three beaches/carrier](../specs/worlds/m09-composition.md), including full scenery tables. Offline estimates are 4.235 s / 10.474 s (≤16 s). Rebase `feat/m08-m09-worlds` onto main after #164 merges. Later authenticated Studio work must check silhouette, materials, native/distant sea seams, carrier deck/approach, navigation, build/clear costs and phone readability. Resolve M09 subtype/83-contact inventory before activating mission data; preserve M08 7:00+6:00/six bombers/NW ingress and M09 10:00+7:00/six attack jets/carrier rearm. No Studio or gameplay activation in this PR.

## M06/M07 worlds — in review

Review the dormant [M06 harbour](../specs/worlds/m06-composition.md) and [M07 array/canyon](../specs/worlds/m07-composition.md) worlds, including their complete target tables. Chunk/yield estimates: 10.265 s / 14.501 s under the 16 s caps (legacy jobs ×1.5: 6.384 s / 10.716 s); actual load cost is unmeasured. Once Studio is authenticated, inspect silhouette, materials, low canyon flight, waterline props and service approach against the accepted specs, then measure terrain/build/clear on desktop and phone. Resolve M06 subtype totals and M07 51-versus-52 accounting before mission activation. No Studio launch is authorized in this work; no catalog/unlock changes are included.

Last updated: 2026-10-29.

Audio policy (D-142): continue the story in subtitles beyond existing approved voices; changed lines stay silent. No further audio uploads. Any cause investigation must remain offline using the [preserved case file](../qa/audio-rejections/2026-10-30-voicebank01.md).

## Mission 2 beta test — start here

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Mission 2 is live through the automatic pipeline and unlocks after you finish mission 1 on the same save. Agents have not performed a Roblox Player test.

1. **Reach it.** Finish mission 1 at any rank. Mission 2's tile should read NEXT. The chapter "The sealed case" plays once before the briefing "NO ANIMALS".
2. **Fly north.** You start in the air about 470 studs up with three LANTERN wingmen and a 15:00 countdown. Follow the red-and-white power line for about two minutes to the "farm" airfield.
3. **Destroy eleven parked bombers.** Each is a red TGT; the mission ends when the last bomber is destroyed. No landing is required. The substation under the power line, seven hangars, four firing AA guns and the control tower are optional points.
4. **Watch the air.** Two fighters meet you head-on around 35 seconds, two rise from the base as you approach, and one scrambles from the runway. The ace HARROW SIX arrives after four bombers; two more fighters arrive from the west valley after six.
5. **Use missiles, gun or 4AAM.** There are no bombs. The 4AAM salvo can hit four targets per press and suits the parked rows.
6. **Check scoring and persistence.** Bombers are 120 each; hangars 50; AA guns 20; tower and substation 100 each; fighters 60; ace 240. S ≥ 2,200, A ≥ 1,750, B ≥ 1,500, C ≥ 1,320. Everything destroyed totals 2,610. Afterward, confirm mission 1's saved score breakdown still appears through replays and a save reload.

Most useful feedback: whether the base is easy to find and read; whether the parked bombers, pavement and optional targets look convincing; whether the AA and fighters create enough pressure; whether 15:00 and the rank cuts feel right; how the roughly 16-second desktop Studio load feels on your phone; and whether the briefing, radio and results are clear. Mission 2's rank cuts, failure rules and air roster remain assumptions awaiting owner feedback.

## Mission 3 beta (once #147 is merged)

Mission 3 becomes playable when its PR merges; until then it shows as locked.

1. **How to reach it.** Finish missions 1 and 2 on the same save file (any rank). Mission 3's tile then reads NEXT; a file that has not finished mission 2 cannot start it. The current chapter cutscene plays once, then the briefing "NOBODY SIGNED" (region SNOWY MOUNTAINS).
2. **The sortie.** You start in the air over snowy mountains, heading north-west toward site 1 with three LANTERN wingmen; a 15:00 countdown starts. Destroy all **nine radar domes** (red TGT, white spheres): five along a ridge crest about 1–2 minutes ahead, four on a high saddle further west-north-west. LOW ALTITUDE now warns about the ground under you, not sea level.
3. **Pressure.** Two fighters meet you head-on at about 10 seconds and three more at about 40 seconds. When site 1's five domes are down, two fighters and the ace **CAIRN LEAD** come from the west. AA guns (one at site 1, three at site 2) fire at you; they and the parked helicopter at site 2 are optional points.
4. **Going home.** When the last dome dies a blinking **MISSION UPDATE** box appears, the clock resets to 15:00, enemy fighters break off and a **white dashed line** appears across the ground far to the south. The HUD's second row reads RTB and the green cue points at the nearest part of the line (SERA tells you to follow it; the radar minimap does not draw the line). Fly south across it.
5. **Landing.** Crossing the line cuts to a cockpit approach at the home runway: a 3:00 landing clock, DIST counting down to touchdown, and RIM TOWER talking you in. It flies itself. Press SPACE / RT or tap SKIP to jump to the end. MISSION ACCOMPLISHED shows on the runway, then the results. Landing time does not count.
6. **Scoring.** Radar 100, AA gun 20, helicopter 40, fighter 60, ace 240. Rank S ≥ 1,300, A ≥ 1,150, B ≥ 1,000, C ≥ 900 (all domes). Everything destroyed = 1,680, the reference player's S score. Fails if you are shot down or either 15:00 clock runs out; the landing cannot fail.

**Most useful feedback:** whether the domes and sites are easy to find in the mountains; how flying low in the valleys feels with the new LOW ALTITUDE warning; whether the update, the dashed line and the landing read clearly and feel right; whether 15:00 and the pressure feel right (the footage player took 5:35 plus 1:12 home); how the snow, rock and sky look.

**Known:** the world took 35–88 seconds to build in Studio on a desktop (five measurements; mission 2 takes 16), so expect a long loading screen, After the results appear the server clears the mountains, which froze it for 17–46 s in Studio; launching another mission straight away shows "Clearing the last sortie. Your launch is queued..." and starts by itself once that finishes (D-067). The mountains look terraced (large flat steps), and on low graphics quality distant ground may not draw (see Blockers). Phone load time and frame rate are not measured. There are no bombs; use missiles and the gun. Optional targets you leave behind stay standing but can no longer be scored after the update. The radar minimap does not draw the return line; the green cue points to it.

## Missions 3–5 — in review

See [per-level status](levels.html) for the current pieces, findings and owner test checklists. Mission 3 [#147](https://github.com/A-Ricemusic/skybreak/pull/147), mission 4 [#149](https://github.com/A-Ricemusic/skybreak/pull/149), and mission 5 [#148](https://github.com/A-Ricemusic/skybreak/pull/148) remain open; sequential unlocks depend on preceding missions merging. Worlds #139/#144 and engines #141/#145 are merged but dormant.

Priorities before activation: resolve review findings, reconcile sequential integration, reduce roughly 45–46 s M04/M05 loading and cleanup delays (work on `perf/m04-m05-terrain`), and address M04 transports escaping at about 4:43.5 versus the 12:00 HUD clock. M03 terrain/LOD presentation and M05 lighting follow-up remain review concerns. Linked PRs report Studio checks; this docs change performed no Studio or Player test.

## Missions 6–9 — specs ready for review

Mission and world specs are in review in [PR #155](https://github.com/A-Ricemusic/skybreak/pull/155), at `docs/specs/missions/m06.md`–`m09.md` and `docs/specs/worlds/m06.md`–`m09.md`, with source timestamps, observed debriefs, scale sketches, Broken Relay adaptations and main’s engine gaps. Review the flagged inventory/trigger/rank assumptions before implementation; these are documentation proposals, not mission activation or Player verification.

## Later

- Mission and world specs for 10–13 are in review in [PR #153](https://github.com/A-Ricemusic/skybreak/pull/153): [M10](../specs/missions/m10.md), [M11](../specs/missions/m11.md), [M12](../specs/missions/m12.md), [M13](../specs/missions/m13.md), with companion world specs. Unresolved rosters, rank cuts and layout assumptions remain explicit. M10–M13 worlds are in review; mission gameplay remains unbuilt, locked and unavailable; no Player verification.

Before the finale, remap the final story chapter and retire leftover code keyed to the old 27-mission campaign. Mission 18 retains the planned one-on-one Rusk duel (D-031).

## Missions 14–18 specifications — in review

[PR #154](https://github.com/A-Ricemusic/skybreak/pull/154) contains [M14](../specs/missions/m14.md), [M15](../specs/missions/m15.md), [M16](../specs/missions/m16.md), [M17](../specs/missions/m17.md) and [M18](../specs/missions/m18.md), companion world specs and source coverage in `reference/ledger.md`. Review unresolved ground subtypes/rank cuts and proposed layouts before implementation; preserve Rusk’s M17 withdrawal and added M18 duel. The duel keeps the existing regenerating missile rack; reference finite racks/rearm loadouts remain an explicit engine gap. Missions remain unbuilt and locked; no Studio/Player quality is claimed. Main now includes PR #155 (M6–9) and PR #153 (M10–13); their dashboard, level-card and ledger updates are preserved.

AI voice disclosure (D-140, pending merge): the owner will see a permanent ElevenLabs AI voice credit at the end of Settings and a passive 12-second banner when the first voiced cutscene or radio line starts each session. No gameplay or playback changes. Latest Studio log contains LoginDialog; no Studio screenshot or Player verification claimed.
