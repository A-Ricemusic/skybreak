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

## Mission 3 — in progress

- The snowy mountain world, two radar sites and landing base are merged but dormant in #139.
- Engine batch B is merged but dormant in #141: mission updates, return-line guidance, automatic skippable landing and terrain-relative warnings.
- The mission 3 data and unlock PR is in progress. Mission 3 remains locked on `main`.
- Still required before activation: Studio load and shell/LOD inspection, real-aircraft return and landing-path verification, update/radio/landing presentation checks, and real-phone performance.

## Mission 4 — in progress

- The heavy transport and radar jammer assets are moderation-approved, wired in #142 and dormant.
- The inland-hills world is in review in PR #144.
- Engine batch C is in review in PR #145. It supplies dormant jamming and later mission 4–5 contracts.
- Mission data, integration, Studio visual checks and unlock remain after those reviews.

## Mission 5 — in progress

- The fuel tanker, attack helicopter and elite Vanta livery are moderation-approved, wired in #142 and dormant.
- The night refinery world is in review in PR #144.
- Engine batch C is in review in PR #145.
- Mission data, score-threshold flow, surprise elite phase, landing/rearm integration, Studio visual checks and unlock remain.

## Later

Continue one mission at a time after owner feedback. Before the finale, remap the final story chapter and retire leftover code keyed to the old 27-mission campaign. Mission 18 retains the planned one-on-one Rusk duel (D-031). Non-blocking polish remains: terrain and shoreline presentation, a code formatter, and dedicated menu/briefing/HUD/results specifications.

Before missions 4–5 activation (PR #145 remains dormant/unmerged):
- Integrate mission data with #144’s worlds; build M05 lights using `nightLightingFromAnchors(m05LightAnchors())`. Keep the world’s environment/effects as the sole owner. Verify lighting and route clearances in Studio/Player under the orchestrator’s lease.
- F4 remaining: add the separate landing 3:00 and takeoff 1:00 HUD clocks, TAKEOFF / CHANGE WEAPON menu (at least special-weapon selection), and surprise elite formation cut-in with its own paused mission-clock span. Current rearm supports the approach gate, cockpit hard cut, hidden local jet, skip and automatic takeoff; the main clock pauses throughout, damage persists, missiles/special refill only as authored, hostile threats block entry, and repeats require zone exit (m05 A4).
- Run the compiled Roblox runtime specs (ship waterline/aim centre, rearm abuse/pause, jammer calls and lighting isolation), then inspect rearm camera/skip/clock handoff and searchlight sweep/pause. This pass did not launch Studio or run Roblox Jest.

PR #145 validation (2026-10-29): frozen Bun install and build passed; full offline validation passed: `OFFLINE_LUAU_RESULT passed=730 failed=0`, `MISSION_CATALOG_SNAPSHOT passed=19 failed=0`, Python `Ran 122 tests` / `OK`. Practice/M01/M02 mission data and snapshots are unchanged. Roblox runtime specs compile but were not executed.
