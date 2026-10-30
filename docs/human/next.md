# Next

Last updated: 2026-10-29.

## Mission 1 pressure tuning — proposed, unmerged

- Owner feedback: wingmen absorbed too much attention and the bomber approach was too quiet. M01 alone opts into 80% player-priority targeting slots (revisited every eight seconds), close/tail/fire overrides (guided/special launches and player hits start an eight-second threat window). Tail breaks/jinking use existing break steering with three seconds of recovery after overshoot extends. Easy forces only tail breaks, keeps zero close-lock odds and rolled inbound breaks, and adds no flare; Normal/Ace force close-lock/inbound breaks and give hostile raiders/escorts one flare. Wingmen get no pressure flare. Mission 2 keeps legacy targeting and defence.
- Opening raiders increase four → six and arrive 10–25° either side of the nose, head-on, 2,600–3,200 studs ahead between carrier and bombers. Two escorts plus five admitted raiders fill the seven-fighter cap; remaining requests wait. The two aft raiders at T+120 and escort/ace at T+150 remain. No increase in simultaneous fighter budget.
- Normal maximum 1,500 (six bombers 600 + three escorts 180 + ace 240 + eight raiders 480). Ranks S 1,320 / A 1,020 / B 600 / C 500; without ace Normal tops out at 1,260. Ace adds two raiders as before, maximum 1,620. Ally kills still earn nothing. The frozen EngineM01Snapshot and catalog fixture deliberately adopt these owner-requested data changes.
- Test Easy/Normal/Ace: fly through or fight the forward screen, tail a raider, shoot at a wingman-focused enemy, observe breaks/flares and return attacks. Record actual missile launches at player versus allies; 80% is the targeting-slot policy, not a measured launch ratio. Confirm Easy bomber interception remains achievable, rear wave queues once at 120 s, ace keeps queue priority, bomber route/240 s escape and 10:00 countdown remain solid. Phone frame rate and human combat balance remain unmeasured.

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

## Later

Missions 6–18 have indexed footage and placeholder data but no mission specs on main at this snapshot. Begin their specs before implementation. Before the finale, remap the final story chapter and retire leftover code keyed to the old 27-mission campaign. Mission 18 retains the planned one-on-one Rusk duel (D-031).
