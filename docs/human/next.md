# Next

Last updated: 2026-10-29.

## Your playtest (beta) — what to try

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Your save starts fresh in the new campaign.

1. **Menu.** Practice flight first (optional), then missions 1 to 18. Only the practice flight and mission 1 can start; 2 to 18 show as locked.
2. **Practice flight (optional).** Today's controls tutorial: turn and pitch, select the training target, lock and fire. No enemies.
3. **Mission 1.** You start just off the carrier's bow; controls unlock after about 3 seconds. A 10:00 countdown starts then. Six bombers fly north over the island, the city and then the airbase; destroy all six before they pass the island's north coast (about 4 minutes) or the countdown ends. Two escorts fly with them; a third and the ace ASH WARRANT arrive around 2.5 minutes. Four LANTERN wingmen fly with you (blue + on radar, FRND label); their kills do not count for you.
4. **Scoring.** Bomber 100, escort 60, ace 240. Rank S ≥ 800, A ≥ 700, B ≥ 600, C ≥ 500. All six bombers plus two escorts and the ace = 960 (S). The results screen lists kills by type; the menu then shows CLEARED, your rank and BEST points.

**Most useful feedback:** how the fly-off and handoff feel; whether the mission length and difficulty feel right; whether the wingmen help or get in the way; how the island, sea and sky look; how it runs on your phone; anything confusing on the menu, briefing or results screen. Tell the orchestrator; it records your notes in the blockers and decisions files.

**Known, already on the list:** visible terracing on the hillsides; a rectangular waterfront; flat-looking sea shading; a brief build stall when the mission loads; the fly-off camera frames the carrier heavily with your jet near the edge.

## Mission 2 beta (once its PR is merged)

Mission 2 becomes playable when its PR merges; until then it shows as locked. PR #143 also preserves mission 1’s saved score breakdown through mission 2 completion, replays and save reloads.

1. **How to reach it.** Finish mission 1 on the same save file (any rank). Mission 2's tile then reads NEXT; a fresh file cannot start it. The chapter "The sealed case" plays once before the briefing, then the briefing "NO ANIMALS".
2. **The sortie.** You start in the air, about 470 studs up, heading north with three LANTERN wingmen; a 15:00 countdown starts at control. Follow the red-and-white power line north for about two minutes to a "farm" airfield. Destroy all **eleven parked bombers** (red TGT); the mission ends the moment the last one dies. Nothing needs landing.
3. **On the way.** The substation under the power line is an optional 100-point target. Two fighters meet you head-on at about 35 seconds. Two more come up from the base as you approach, and one fighter scrambles from the runway (watch it roll and climb out north).
4. **Over the base.** Four AA guns fire at you (warning, then small hits; evade blocks them). Seven hangars, the control tower and the AA guns are optional points. After four bombers the ace HARROW SIX arrives flying low; after six bombers two more fighters come from the west valley. The bombers never take off (D-057).
5. **Weapons.** There are no bombs; use missiles and the gun. The **4AAM salvo** special hits four targets per press and suits the parked rows (D-058).
6. **Scoring.** Bomber 120, hangar 50, AA gun 20, tower 100, substation 100, fighter 60, ace 240. Rank S ≥ 2,200, A ≥ 1,750, B ≥ 1,500, C ≥ 1,320 (all bombers only). Everything destroyed = 2,610, the reference player's S score. Fails only if you are shot down or the clock ends.

**Most useful feedback:** whether the base is easy to find and read from the approach; whether the bombers, hangars and guns look right and burn convincingly; whether 15:00 and the difficulty feel right (the footage player took 6:29); whether the AA guns and fighters give enough pressure; whether the briefing and radio make sense.

**Known:** the world takes about 16 seconds to build on a desktop in Studio, so expect a longer loading screen than mission 1; phone load time and frame rate are not measured yet. Destroyed targets vanish in an explosion and leave no wreck.

## After your playtest

1. **Fix what you report** for missions 1 and 2.
2. **Mission 3:** world (#139) and engine batch B (#141) merged, dormant and not playable. Remaining: mission data and unlock using the exported target layout (as for mission 2); Studio load and visual measurement, landing path verification and real-phone performance.
3. **Before later missions:** remapping the finale chapter, and retiring leftover code keyed to the old 27 missions.
4. **Later missions** one at a time; mission 18 gains a one-on-one Rusk duel (D-031).
5. **Polish not blocking play:** the world items above; a code formatter; specs for the menu, briefing, HUD and results screens.

## Mission 3 — engine batch B

Engine batch B is built and dormant (PR #141): phase-entry MISSION UPDATE with radio/objective/countdown reset; directional return segment with HUD navigation; automatic skippable runway landing that excludes mission and score time; opt-in terrain-clearance warnings. Batch A already expresses site 1 destroyed → fighter wave plus ace via shared `ground_group` triggers. Mission 3 data/unlock and world integration remain separate; use PR #139’s Z=11,040 line and northbound runway centred at X=6000, Z=11264: pavement top Y=84 on terrain Y=80. Landing touchdown authors the aircraft pivot, including gear clearance, rather than the runway surface.

Remaining mission 3 presentation/spec work (not built by batch B): landing 3:00 timer; DIST counter; controller radio during landing; MISSION ACCOMPLISHED on the runway; dotted return line drawn in-world; mission-update banner and landing-skip styling. The engine radio queue and HUD navigation point alone do not complete these items.

Independent-review corrections in PR #141: settlement accepts update-extended mission time and rejects elapsed at/beyond the summed maximum; return guidance projects onto the finite line; landing camera cuts immediately and hides the local jet; skip is ignored for 0.75 seconds on both peers; landing telemetry uses the normal interval without 30 Hz FlightState packets; flare levels before touchdown; ALT tint uses the warning's terrain clearance. Initial and landing phases reject updates. Practice/mission 1 snapshots remain unchanged.

The full combined Roblox Jest suite passed in Studio on PR #142 (808/808). The Studio lease is released; the orchestrator still needs to inspect landing camera/skip, update radio delivery and mountain warnings before enabling mission 3. No visual mission 3 or Player test is claimed.

Batch B offline validation: frozen Bun install and build passed; full offline gate passed (`OFFLINE_LUAU_RESULT passed=675 failed=0`, catalog snapshot `passed=19 failed=0`). Runtime Roblox specs subsequently passed in the combined PR #142 Studio run; visual mission 3 quality remains unverified. Landing plans require continuous touchdown speed: `2 × rolloutDistance / rolloutSeconds = approachDistance / approachSeconds`.

## Mission 4–5 asset orientation check

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved. PR #142 wires them but leaves them unused until missions 4–5. Studio inspection on 2026-10-29 confirmed -Z forward, +Y up and plausible scale beside the heavy bomber, tanker waterline at sea level with `groundOffset=16`, helicopter port tail rotor and both configured rotor hubs, and elite orientation matching regular Vanta v2. All orientation corrections remain zero. [Screenshots and measured results](../qa/orientation/2026-10-29/README.md). Roblox Jest: 808 passed / 0 failed across 80 suites after rebase onto main (#139/#141). No Player test was performed.

Next: integrate these dormant assets with mission 4–5 logic and inspect their placement in those mission worlds. Rotors remain static; animation and mission/Player behaviour are unverified. Elite revision 3 retains its independent 10/10 safety approval (`docs/qa/asset-reviews/2026-10-29-pr137-review-3.md`). No new upload or merge was performed.
