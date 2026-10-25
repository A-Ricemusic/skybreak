# Glass Horizon — leased Roblox QA report

This report separates the package that completed the uninterrupted campaign from the final branch package.

- Campaign package: `2bc1d2cecef02054e4b2d5448db9aff16262d2ea`.
- Final source/package: `aefb5b1edd6d90643798be7402895c7a991a838a`.
- PR: [#6](https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/6), draft and not merged.
- Save mode: unpublished Studio, session-only.

`aefb5b1` differs from the campaign package only in the responsive cinematic layout, six pure layout tests, and the QA recorder's respawn-persistent `ScreenGui`. Server combat, mission worlds, flight, progression, and gameplay UI are unchanged. The full M1–M27 campaign evidence therefore belongs to `2bc1d2c`; final Roblox Jest, compact cinematic validation, skip/accessibility, and a fresh normal-control M1 belong to exact `aefb5b1`.

## Post-QA authored cinematic asset follow-up

After the leased results below were recorded, the branch replaced the cinematic
aircraft, relay and carrier primitives with clones from a server-generated
static preview cache using the authored Kestrel, Vanta, Relay and Carrier
factories. The client helper is clone-only and contains no `AssetService` or
`EditableMesh` generation. Safe native primitives remain available when the
server cache is absent, incomplete, or platform generation reports fallback.

This follow-up was deliberately implemented while another branch held the
exclusive Studio lease. It passed `bun run test:offline`, roblox-ts compilation,
production place packaging, and `git diff --check`, but **has not run Roblox
Jest or rendered in Studio**. Nothing below is evidence for the new actor
framing. The prior `2bc1d2c` campaign and `aefb5b1` compact-layout evidence
remain unchanged.

Required later live QA:

- run the now 140-test/11-suite Roblox Jest package, including preview cache
  publication, metadata, clone scaling, `WorldModel` disposal, fallback and
  malformed-cache regression cases;
- require all four replicated previews to report `GeometrySource=Blender` for
  authored-visual acceptance; an explicit visible `Fallback` is safe behavior
  but not a visual pass;
- inspect flight-, relay-, fleet- and finale-focused scenes at desktop and the
  real 320×240 safe root for scale, clipping, lighting and silhouette;
- leave a manual-read beat open beyond eight seconds to confirm aircraft,
  camera and relay motion remain bounded, then verify pace/reduced-motion/skip;
- confirm closing/skipping removes the GUI and its local `WorldModel` actors
  while the shared replicated cache remains ready for the next scene;
- complete a fresh normal-control M1 to guard against startup or gameplay
  lifecycle regressions.

## Results

- Roblox Jest on final `aefb5b1`: **136/136 passing in 10 suites**.
- Offline contracts: **123 passing**, covering 27 mission paths, 28 scenes, save migration/progression, layout breakpoints, and mesh bounds.
- Production build and static Rojo packaging: passed.
- Sequential campaign: **M1–M27 complete** through real menus in slot 3.
- Story: all **28** three-beat scenes rendered and were advanced, including the opening and finale.
- Final progression: slot 3 showed `CAMPAIGN COMPLETE · REPLAY`, 27/27; every selector showed `REPLAY`; slots 1, 2, and 4 remained empty.
- Teardown: every recorded completed sortie reported zero remaining mission folders after its delayed cleanup check.
- Actual failure/retry: M13 failed `asset_lost` at 32.293s when normal actions were deliberately withheld; visible Retry then completed in 46.435s.
- No-evade input subset: M8 replay completed through the real selector in 36.601s, 4 air/4 ground, 100 HP, 21 missile commands, **0 evade commands**. This is a desktop input-subset test, not physical touch hardware evidence.

## Sequential sortie record

All successes were authoritative `Completed` results under the real 600-second deadline. Air totals can include optional aircraft; ground totals match required mission targets. Health was 100 at every listed result.

| M | Time (s) | Air | Ground | Notable result |
|---:|---:|---:|---:|---|
| 01 | 21.925 | 3 | 1 | Tutorial movement, target, radar, bandits |
| 02 | 34.287 | 4 | 5 | Bandits, warehouses, ace |
| 03 | 31.148 | 0 | 3 | Spatial recon route |
| 04 | 149.510 | 0 | 4 | Escort asset 65 HP; includes QA recorder repair delay |
| 05 | 68.768 | 2 | 4 | Pursuit/strike chain |
| 06 | 46.804 | 5 | 0 | Air/recon/air |
| 07 | 39.778 | 4 | 6 | Refinery strike |
| 08 | 36.162 | 4 | 4 | SAMs, bandits, ace |
| 09 | 84.187 | 1 | 1 | Sea escort/carrier |
| 10 | 57.153 | 3 | 4 | Mountain recon/radars |
| 11 | 57.905 | 6 | 5 | Desert relay chain |
| 12 | 42.557 | 4 | 6 | SAM belt |
| 13 | 46.435 | 3 | 1 | Retry after real 32.293s asset-loss defeat |
| 14 | 96.241 | 6 | 0 | Six drones intercepted; escort finished at 65 HP |
| 15 | 89.911 | 3 | 2 | Moving desert escort |
| 16 | 47.335 | 1 | 4 | High recon/radar/ace |
| 17 | 38.952 | 4 | 6 | Storm SAM line |
| 18 | 51.829 | 5 | 1 | Drones/flagship/ace |
| 19 | 54.440 | 1 | 6 | Relay/recon/ace |
| 20 | 57.086 | 5 | 8 | Eight-site SAM veil |
| 21 | 70.845 | 6 | 2 | Drone/carrier/air chain |
| 22 | 92.960 | 1 | 5 | Five radars and live broadcast escort |
| 23 | 133.271 | 5 | 4 | Long pursuit chain |
| 24 | 51.215 | 5 | 6 | Refinery/drone/ace chain |
| 25 | 107.135 | 6 | 3 | Three alternating carrier waves |
| 26 | 88.432 | 4 | 5 | Ridge recon/SAMs/interceptors/ace |
| 27 | 44.706 | 6 | 3 | Core radars, drones, two command aces |

## Final-package compact and accessibility validation

The exact `aefb5b1` production place was tested with a custom 320×298 Studio device, yielding a real 320×240 CoreUISafeInsets root. Scene 1 measured:

- rendered scene: 320×102;
- subtitle: 291×44, text bounds at most 287.5×28;
- story hint: y=174, height 14;
- action buttons: y=190, height 44, with 96×44 touch targets.

The hint ended at y=188 and controls began at y=190, without overlap. Original screenshots show the title, cinematic, and M1 outcome at this size. Reading-at-own-pace and reduced-motion toggles changed state, and a real move/wait/click on Skip dismissed the replay cinematic. A fresh normal-control M1 on this exact package completed in 20.285s with 3 air, 1 ground, 100 HP, eight missile commands, and a clean teardown.

Studio was restored to its default viewport and the temporary device was removed. The only error in the final session log was generated by the QA inspection itself when it intentionally queried a nonexistent `StoryTitle` path; it was not emitted by game runtime code.

## Evidence

- Raw reports and sampled telemetry: `build/qa/glass-horizon/logs/`.
- Original screenshots: `build/qa/glass-horizon/screenshots/`.
- Final Jest output/results: `aefb5b1-jest-output.log` and `aefb5b1-jest-results.json` in that log directory.
- Native video: `m14-interception-escort-native.mov` is a visible 60.01s Studio-window sample; `m02-native-gameplay.mov` is a visible 10.09s combat sample. `m01-native-sample.mov` is primarily the opening cinematic.
- Performance sample during M15: 120 RenderStepped frames, mean 59.999 FPS, worst 17.729 ms, with 111 BaseParts and 61 MeshParts in the active mission. The observed 4546.97 MB client engine memory includes Studio, plugins, and editor overhead and is not a mobile-memory measurement.

## Honest limits

- Persistence was session-only. Published DataStore behavior and real cloud migration were not exercised.
- The device simulator and desktop controller share production UI/controller paths, but this was not a physical phone, touchscreen, console, or gamepad.
- Efficient scripted piloting at 100 HP proves objective reachability, not human difficulty balance or accessibility on every device.
- The full 27-mission run was on `2bc1d2c`; only final Jest, compact cinematic/accessibility checks, and fresh M1 were repeated on `aefb5b1`.
- Player-aircraft destruction was not used as the failure probe; M13 validated protected-asset loss and visible Retry instead.
- Parent independent review/play remains separate. This branch must not be merged solely on this self-authored QA.
