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
2. **Mission 2:** world composition is done and dormant, in review in PR #140; it is not playable. Remaining: engine integration, mission data and unlock, Studio load measurement and visual check, plus real-phone performance measurement. Proceed toward release after mission 1 feedback (D-004). Engine batch A (typed ground targets, triggered fighter waves, standalone ace and AA guns) is built and dormant on PR #138; it does not change the live practice flight or mission 1.
3. **Before mission 2 ships:** sequential-unlock and forged-proof tests, remapping the finale chapter, and retiring leftover code keyed to the old 27 missions.
4. **Mission 3:** world composition done in unmerged PR #139, dormant and not playable. Remaining: engine batch B (mission update banner, clock reset, return-line objective, automatic skippable landing, terrain-relative LOW ALTITUDE warning); mission data and unlock using the exported target layout; Studio load and visual measurement, landing path verification and real-phone performance.
5. **Later missions** one at a time; mission 18 gains a one-on-one Rusk duel (D-031).
6. **Polish not blocking play:** the world items above; a code formatter; specs for the menu, briefing, HUD and results screens.
