# Next

Last updated: 2026-10-29.

## Mission 2 beta test — start here

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Mission 2 is live through the automatic pipeline and unlocks after you finish mission 1 on the same save. Agents have not performed a Roblox Player test.

Targeting (#157): on a phone, tap an enemy target box to select it. TGT now picks what the nose is on first (required targets favoured at similar bearings, contacts behind you or hidden by terrain last) and advances with quick presses. Auto-targeting after a kill follows the same rule. Check that tapping a box does not steer the jet and that TGT feels predictable.

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

- Mission and world specs for 10–13 are in review in [PR #153](https://github.com/A-Ricemusic/skybreak/pull/153): [M10](../specs/missions/m10.md), [M11](../specs/missions/m11.md), [M12](../specs/missions/m12.md), [M13](../specs/missions/m13.md), with companion world specs. Unresolved rosters, rank cuts and layout assumptions remain explicit. Missions remain unbuilt, locked and unavailable; no Player verification.

Before the finale, remap the final story chapter and retire leftover code keyed to the old 27-mission campaign. Mission 18 retains the planned one-on-one Rusk duel (D-031).

## Missions 14–18 specifications — in review

[PR #154](https://github.com/A-Ricemusic/skybreak/pull/154) contains [M14](../specs/missions/m14.md), [M15](../specs/missions/m15.md), [M16](../specs/missions/m16.md), [M17](../specs/missions/m17.md) and [M18](../specs/missions/m18.md), companion world specs and source coverage in `reference/ledger.md`. Review unresolved ground subtypes/rank cuts and proposed layouts before implementation; preserve Rusk’s M17 withdrawal and added M18 duel. The duel keeps the existing regenerating missile rack; reference finite racks/rearm loadouts remain an explicit engine gap. Missions remain unbuilt and locked; no Studio/Player quality is claimed. Main now includes PR #155 (M6–9) and PR #153 (M10–13); their dashboard, level-card and ledger updates are preserved.
