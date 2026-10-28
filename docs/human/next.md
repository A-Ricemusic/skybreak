# Next

Last updated: 2026-10-28. In priority order. Done so far for mission 1: specs (#101), build plan (#100), per-mission settings (#103), points scoring (#104), bomber routes (#105). None changes the live game yet.

1. **Scoring wired into the server and results screen. In progress (GPT-6.1 Sol).** The server counts points per kill, saves them, and the results screen shows total points, a kill list by type and the rank. It only switches on for points-based missions, so Broken Relay is unchanged. The Studio suite runs before it merges.
2. **Large-world measurement. In progress (GPT-6.1 Sol, holds the Studio lease).** How big a world loads and runs well. The world steps wait on it (D-019).
3. **Heavy bomber and carrier models. In progress (Opus 5.5).** Original Blender models; nothing is uploaded until an independent safety review approves them.
4. **The sea, island and overcast world, then per-world limits.** Start once the measurement is in.
5. **Then in sequence** (all touch the combat service): carrier placement, bombers and escorts in a mission, allied wingmen, the countdown, and the carrier fly-off start (D-020). The next bomber step also makes the stand-in invisible to raycasts and checks the uploaded model's alignment in Studio.
6. **Campaign switch.** Practice flight (D-021), then mission 1 playable, missions 2 to 18 locked, fresh saves, the 18-chapter story mapping, and updated validators. This is the step you playtest.
7. **Follow-ups that don't block mission 1:** move phase logic out of the combat service; the two small issues from the #98 review; a code formatter; specs for the menu, briefing, HUD and results screens.
