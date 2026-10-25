# Aurora Line Studio QA

Validated 2026-10-25 in an unpublished, session-only Roblox Studio place.

- Tested code SHA: `67dcf2665410fc9cba99fe04e5cb4210076a06de`
- Built place: `build/skybreak.rbxlx`
- Place SHA-256: `c5cc5d196443352088042a4c8c789dcf3f5f0a8323c5b419b7335cedd9e132fe`
- Studio instance: `1c252518-a7d3-470b-8096-2ed456646c8b` (owned PID 8599)
- Roblox Jest: 79/79 tests in 9 suites (`build/jest-results.json`)
- Pilot: `tools/playtest-campaign.client.luau`, injected as a normal client
  `LocalScript`. It used `FlightController` inputs and actions only. No health,
  target, damage, kill, timer, unlock, or result values were changed.

## Sequential campaign results

Every success below came from the authoritative mission result/debrief. The
campaign was entered through the title, slot, briefing, Launch, intermission,
Skip, and Next Mission controls.

| Mission | Result | Air | Ground | Time |
| ---: | --- | ---: | ---: | ---: |
| 01 | Complete | 3 | 1 | 01:13 |
| 02 | Complete after a real timeout/retry | 4 | 5 | 01:25 |
| 03 | Complete | 5 | 2 | 01:17 |
| 04 | Complete | 3 | 3 | 00:30 |
| 05 | Complete | 5 | 0 | 00:33 |
| 06 | Complete | 7 | 0 | 00:59 |
| 07 | Complete | 4 | 4 | 00:41 |
| 08 | Complete | 4 | 3 | 00:40 |
| 09 | Complete | 6 | 0 | 00:34 |
| 10 | Complete | 4 | 0 | 00:28 |
| 11 | Complete | 5 | 2 | 00:41 |
| 12 | Complete | 3 | 3 | 00:29 |
| 13 | Complete | 5 | 0 | 00:37 |
| 14 | Complete | 5 | 3 | 00:49 |
| 15 | Complete | 4 | 4 | 00:30 |
| 16 | Complete | 6 | 0 | 00:28 |
| 17 | Complete | 4 | 4 | 00:51 |
| 18 | Complete | 7 | 0 | 00:37 |
| 19 | Complete | 3 | 4 | 00:26 |
| 20 | Complete | 5 | 0 | 00:38 |
| 21 | Complete | 3 | 5 | 00:47 |
| 22 | Complete | 5 | 3 | 00:39 |
| 23 | Complete | 5 | 0 | 00:39 |
| 24 | Complete | 8 | 0 | 00:43 |
| 25 | Complete | 5 | 3 | 00:51 |
| 26 | Complete | 5 | 4 | 01:00 |
| 27 | Complete | 9 | 3 | 01:16 |

Mission 02 was first flown without firing. The authoritative clock reached
10:00, the debrief showed `TIME EXPIRED`, no completion credit was awarded,
and `SkybreakCombat` had zero children afterward. Retry launched Mission 02
without repeating its intermission, then completed normally.

## Presentation and lifecycle checks

- Opening, every 26 inter-mission scenes, and the finale were recorded in the
  slot's presentation state: 28 distinct IDs from `cs_prologue` through
  `cs_after_26` and `cs_finale`.
- Sequential Next was observed opening the correct authored scene before the
  next mission. For transitions 02→03 through 26→27, the live stage probe was
  consistently Y=4998 (nominal origin Y=5000), separate from the menu world.
- The finale rendered after the Mission 27 result with stage Y=4998 and camera
  Y≈5051 while the authoritative combat folder already had zero children.
- Skip launched the exact next mission, removed `AuroraLineCutsceneLocal`, and
  left no cutscene stage in flight.
- A fresh Slot 2 opening with Reduced Motion enabled held camera position and
  look direction exactly constant over 0.5 seconds, used FOV 48, and retained
  the rendered stage and subtitles.
- Slot 1 ended with 27 completed records, all 27 mission buttons enabled, and
  all three sampled replay buttons (01, 14, 27) marked complete.
- Desktop menu, briefing, HUD, debrief, cutscene, aurora-night, volcanic, and
  finale views were readable. Roblox Jest separately covers the phone-sized
  layout and 44-pixel touch targets.

## Evidence and limitations

Ignored local screenshots are in `build/screenshots/aurora-qa/`:

- `00-main-menu.png`
- `01-slot-menu.png`
- `02-m01-briefing.png`
- `03-opening-cutscene.png`
- `04-m01-debrief.png`

Additional genuine Studio capture IDs include `aurora_m02_timeout`,
`aurora_transition_m02_m03`, `aurora_m08_aurora_night`,
`aurora_m12_volcanic_refuge`, `aurora_transition_m26_m27`,
`aurora_m27_finale_active`, `aurora_finale_cutscene`,
`aurora_m27_campaign_complete`, and `aurora_reduced_motion_opening`.

After the first local screenshots, an unrelated Studio `Initializing plugins…`
modal prevented further macOS window captures; Studio MCP viewport captures
continued to work and were visually inspected. No credential or keychain modal
was touched. True touch-emulator/hardware input was not claimed: this run used
the normal desktop client, with phone/touch geometry covered by Roblox Jest.
The console contained the pre-existing invalid thumbnail content-ID warnings
and an installed Atmos plugin update request, but no campaign runtime error.
