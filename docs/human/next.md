# Next

Last updated: 2026-10-29.

## Mission 2 beta test — start here

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Mission 2 is live through the automatic pipeline and unlocks after you finish mission 1 on the same save. Agents have not performed a Roblox Player test.

1. **Reach it.** Finish mission 1 at any rank. Mission 2's tile should read NEXT. The chapter "The sealed case" plays once before the briefing "NO ANIMALS".
2. **Fly north.** You start in the air about 470 studs up with three LANTERN wingmen and a 15:00 countdown. Follow the red-and-white power line for about two minutes to the "farm" airfield.
3. **Destroy eleven parked bombers.** Each is a red TGT; the mission ends when the last bomber is destroyed. No landing is required. The substation under the power line, seven hangars, four firing AA guns and the control tower are optional points.
4. **Watch the air.** Two fighters meet you head-on around 35 seconds, two rise from the base as you approach, and one scrambles from the runway. The ace HARROW SIX arrives after four bombers; two more fighters arrive from the west valley after six.
5. **Use missiles, gun or 4AAM.** There are no bombs. The 4AAM salvo can hit four targets per press and suits the parked rows.
6. **Check scoring and persistence.** Bombers are 120 each; hangars 50; AA guns 20; tower and substation 100 each; fighters 60; ace 240. S ≥ 2,200, A ≥ 1,750, B ≥ 1,500, C ≥ 1,320. Everything destroyed totals 2,610. Afterward, confirm mission 1's saved score breakdown still appears through replays and a save reload.

Most useful feedback: whether the base is easy to find and read; whether the parked bombers, pavement and optional targets look convincing; whether the AA and fighters create enough pressure; whether 15:00 and the rank cuts feel right; how the roughly 16-second desktop Studio load feels on your phone; and whether the briefing, radio and results are clear. Mission 2's rank cuts, failure rules and air roster remain assumptions awaiting owner feedback.

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
