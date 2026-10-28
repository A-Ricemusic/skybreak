# Next

Last updated: 2026-10-28. In priority order.

1. **Mission 1 spec: objectives, timing and score. Starting now.** A close look at a 1080p clip of the reference's first mission (footage 0:04:55 to 0:11:45): objectives, enemy waves and when they arrive, the time limit, how long it takes, and the score and rank on the results screen. Output: `docs/specs/missions/m01.md`. You review this before anything gets built.
2. **Mission 1 world spec. Starting now.** From the same clip: the terrain, coastline, island, carrier, weather and time of day, and where the player starts, written so our procedural world builder can reproduce it. Output: `docs/specs/worlds/m01.md`.
3. **Mission 1 build-readiness check. Starting now.** An engineer compares the specs against what our code can do today (world builder, scoring, mission phases, naval targets, carrier start) and lists the gaps.
4. **Mission 1 build.** World, mission data, scoring and the matching Broken Relay story chapter, reviewed and then merged live with mission 1 playable and the rest locked. Then you fly it, and mission 2 waits for your feedback.
5. **Follow-ups that don't block mission 1:** move phase logic out of the combat service; tighten the two small issues the #98 reviewer flagged (the target button runs a tutorial check in every mission, and mission 2's raider setting is read from its first phase only); add a code formatter.

The menu, briefing, HUD and results screens get their own reference specs after mission 1, unless you want them sooner. Mission 1's results screen is covered in item 2 because scoring is part of it.
