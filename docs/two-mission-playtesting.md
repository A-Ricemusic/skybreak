# Last Tide campaign validation

The campaign uses one place and one codebase. `MissionWorld.Build` creates one of 27 disposable island compositions for the selected sortie. `CombatService` owns the mission folder, targets, route gates, timed defenses, aircraft, missiles, timer, and phase transitions. Completion sends the campaign result before destroying that folder, clearing mission terrain, and rebuilding the menu scene.

## Mission contracts

| Mission | Required sequence | Success |
| --- | --- | --- |
| First Flight | Observe pitch and turn input, cycle target, lock and destroy the Blender radar, then fight three pursuing bandits | 1 ground kill and 3 required air kills |
| Reefbreak Harbor | Destroy 3 required bandits; 5 optional raiders spawn; destroy all 5 Blender warehouses; destroy the faster 165-HP ace while surviving raiders remain | 5 ground kills and 4 required air kills |

Each mission has a 600-second wall-clock deadline. Optional raiders can be destroyed but never advance the required objectives. Client messages contain flight controls or an action name, never a target ID, damage amount, kill count, or success claim.

Save schema v3 records completion and best times for all 27 missions across four slots. Legacy v1 completion migrates to Mission 1; legacy v2 fields migrate Missions 1 and 2 without claiming later progress. Unpublished Studio sessions deliberately use session-only profiles; cloud persistence must be exercised in a published experience.

## Automated tests and real gameplay

Run `bun run test:roblox`. Bun builds and launches Roblox Studio; Roblox Jest runs inside Luau, not Bun's JavaScript test runner. The suite covers campaign migration/recovery/concurrent writes, all mission and cinematic definitions, route/hold progression, mission ordering and the deadline, flight math, layout rules, and engine mesh construction.

For gameplay, launch via the real menu and inject `tools/playtest-campaign.client.luau` as a normal client LocalScript under `LocalPlayer.PlayerScripts`. It can also be injected up to 30 seconds before launch. The pilot calls the same controller methods used by the UI, observes authoritative telemetry, and records results in `PlayerGui.SkybreakCampaignQA`. It never changes health, target positions, damage, the clock, or campaign completion. Close ground passes are extended before another approach rather than orbiting inside the aircraft's turn radius.

When automating menus through Studio MCP, verify the visible screen and selected briefing after each action. Device emulation can cause pointer-coordinate mismatches; stopping device simulation for menu clicks and restoring it before flight avoids mistaking a missed tool click for a game failure.

Set the script's `SurvivalOnly` attribute before parenting it to disable firing and exercise the real deadline. A readiness timeout and a pilot timeout are distinct from an authoritative mission failure. This is automated gameplay, not a hardware-controller or physical-phone test.

Historical baseline runs observed before the 27-mission rebuild in Studio's iPhone 17 Pro landscape simulation:

- First Flight: all tutorial gates, radar, then three bandits; recorded win at 33.50 seconds, health 100.
- Reefbreak Harbor: three bandits, five warehouses, then ace; recorded win at 46.63 seconds, health 100. All five optional raiders were observed alive alongside the ace.
- Successful teardown: zero children in `Workspace.SkybreakCombat`, menu world restored, mission clouds removed.
- Desktop and simulated Xbox: touch joystick hidden and tutorial instructions adapted to the active device. Portrait phone HUD also checked.
- Actual Retry button after timeout: restarted Mission 1, completed at 33.23 seconds with 1 ground/3 air kills, `ResultValid=true`, and zero remaining mission folders.
- Real-time deadline run: no shots fired; authoritative failure at 600.009 seconds with reason `timeout`, `TIME EXPIRED` recap, hidden flight HUD, zero remaining mission folders, restored menu, and no completion credit in the slot.

These historical results establish the preserved Mission 1/2 mechanics and
teardown path; they are not evidence for Missions 3–27. The later exclusive-
lease run of all 27 Last Tide missions is recorded separately in
[last-tide-qa.md](last-tide-qa.md). The updated QA pilot follows server route
markers, survives hold phases, uses normal targeting/missile/evade methods, and
validates each mission against its catalog requirements without modifying
targets, health, kills, clock, or result state.

A deadline is a maximum duration, not a minimum mission length. The automated pilot completes objectives faster than a new player is likely to.

## Recording and inspection

The videos are actual native Studio window captures. They retain real-time playback from briefing/launch through recap, cropped to the simulated phone. Only surplus footage after the result is trimmed. No generated frames or success overlays are substituted.

On macOS, find the Studio window ID with `CGWindowListCopyWindowInfo`, then record it using `/usr/sbin/screencapture -v -lWINDOW_ID -V 120 output.mov`. Let the duration finish: interrupting this command can discard the recording. Screen-recording permission is required; Accessibility permission is not required for capture.

Compile the exporter:

```sh
swiftc -parse-as-library tools/export-playtest-video.swift -o /tmp/skybreak-export-video
/tmp/skybreak-export-video input.mov output.mp4 x y width height optionalEndSeconds
```

Crop coordinates are source pixels from the upper-left. Measure them again if the Studio window or emulator layout changes. The exporter validates bounds and duration, preserves real-time playback, and refuses to overwrite an existing destination. Inspect beginning, objective transitions, and recap frames before sharing.

Keep final review videos under ignored `build/videos/`. Do not commit video captures or reproducible Blender exports. Keep canonical Blender generators and runtime mesh JSON in Git; see [mission-assets.md](mission-assets.md) for the import workflow.
