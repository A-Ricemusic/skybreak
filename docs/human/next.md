# Next

Last updated: 2026-10-28. In priority order. Mission 1's mission and world specs are approved and merged (#101); the engine readiness plan is merged (#100).

1. **Large-world feasibility measurement. In progress (GPT-6.1 Sol, holds the Studio lease).** Measures terrain write time, memory, streaming and emulated phone performance for worlds from 8,000 to 35,000 studs. Full-scale worlds (D-019) depend on it; if full scale isn't feasible, the closest feasible design comes back to you.
2. **Mission settings (build step A). In progress (GPT-5.6 Sol, audited by the orchestrator).** Optional per-mission settings for the countdown, world size, start position and scoring. No mission uses them yet, so nothing changes in Player.
3. **Heavy bomber and carrier models. In progress (Opus 5.5).** Original Blender models with previews from every angle. They are not uploaded until an independent safety review approves them.
4. **Then, in parallel:** points-per-target scoring and the results screen; the sea, island and overcast world; bomber routes and escorts working together.
5. **Then in sequence:** allied wingmen, the mission countdown, and the carrier fly-off start (D-020).
6. **Campaign switch.** Practice flight (today's tutorial, D-021), then mission 1 playable, missions 2 to 18 locked, fresh saves, the 18-chapter story mapping, and updated validators. This is the step you playtest.
7. **Follow-ups that don't block mission 1:** move phase logic out of the combat service; the two small issues from the #98 review; a code formatter; specs for the menu, briefing, HUD and results screens.
