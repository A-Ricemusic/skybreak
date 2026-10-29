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

## After your playtest

1. **Fix what you report** for mission 1.
2. **Mission 2:** world composition is merged and dormant in PR #140; it is not playable. Remaining: engine integration, mission data and unlock, Studio load measurement and visual check, plus real-phone performance measurement. Proceed toward release after mission 1 feedback (D-004). Engine batch A (typed ground targets, triggered fighter waves, standalone ace and AA guns) is merged and dormant in PR #138; it does not change the live practice flight or mission 1.
3. **Before mission 2 ships:** sequential-unlock and forged-proof tests, remapping the finale chapter, and retiring leftover code keyed to the old 27 missions.
4. **Mission 3:** world (#139) and engine batch B (#141) merged, dormant and not playable. Remaining: mission data and unlock using the exported target layout; Studio load and visual measurement, landing path verification and real-phone performance.
5. **Later missions** one at a time; mission 18 gains a one-on-one Rusk duel (D-031).
6. **Polish not blocking play:** the world items above; a code formatter; specs for the menu, briefing, HUD and results screens.

## Mission 3 — engine batch B

Engine batch B is built and dormant (PR #141): phase-entry MISSION UPDATE with radio/objective/countdown reset; directional return segment with HUD navigation; automatic skippable runway landing that excludes mission and score time; opt-in terrain-clearance warnings. Batch A already expresses site 1 destroyed → fighter wave plus ace via shared `ground_group` triggers. Mission 3 data/unlock and world integration remain separate; use PR #139’s Z=11,040 line and northbound runway centred at X=6000, Z=11264: pavement top Y=84 on terrain Y=80. Landing touchdown authors the aircraft pivot, including gear clearance, rather than the runway surface.

Remaining mission 3 presentation/spec work (not built by batch B): landing 3:00 timer; DIST counter; controller radio during landing; MISSION ACCOMPLISHED on the runway; dotted return line drawn in-world; mission-update banner and landing-skip styling. The engine radio queue and HUD navigation point alone do not complete these items.

Independent-review corrections in PR #141: settlement accepts update-extended mission time and rejects elapsed at/beyond the summed maximum; return guidance projects onto the finite line; landing camera cuts immediately and hides the local jet; skip is ignored for 0.75 seconds on both peers; landing telemetry uses the normal interval without 30 Hz FlightState packets; flare levels before touchdown; ALT tint uses the warning's terrain clearance. Initial and landing phases reject updates. Practice/mission 1 snapshots remain unchanged.

The full combined Roblox Jest suite passed in Studio on PR #142 (808/808). The Studio lease is released; the orchestrator still needs to inspect landing camera/skip, update radio delivery and mountain warnings before enabling mission 3. No visual mission 3 or Player test is claimed.

Batch B offline validation: frozen Bun install and build passed; full offline gate passed (`OFFLINE_LUAU_RESULT passed=675 failed=0`, catalog snapshot `passed=19 failed=0`). Runtime Roblox specs subsequently passed in the combined PR #142 Studio run; visual mission 3 quality remains unverified. Landing plans require continuous touchdown speed: `2 × rolloutDistance / rolloutSeconds = approachDistance / approachSeconds`.

## Mission 4–5 asset orientation check

The five mission 4–5 assets (heavy transport, radar jammer, fuel tanker ship, attack helicopter and Vanta v2 elite revision 3) are uploaded and moderation-approved. PR #142 wires them but leaves them unused until missions 4–5. Studio inspection on 2026-10-29 confirmed -Z forward, +Y up and plausible scale beside the heavy bomber, tanker waterline at sea level with `groundOffset=16`, helicopter port tail rotor and both configured rotor hubs, and elite orientation matching regular Vanta v2. All orientation corrections remain zero. [Screenshots and measured results](../qa/orientation/2026-10-29/README.md). Roblox Jest: 808 passed / 0 failed across 80 suites after rebase onto main (#139/#141). No Player test was performed.

Next: integrate these dormant assets with mission 4–5 logic and inspect their placement in those mission worlds. Rotors remain static; animation and mission/Player behaviour are unverified. Elite revision 3 retains its independent 10/10 safety approval (`docs/qa/asset-reviews/2026-10-29-pr137-review-3.md`). No new upload or merge was performed.
