# Broken Relay live QA

This is developer QA for alternative PR #7, not the parent’s independent acceptance run. All gameplay results below came from real server callbacks in the production place. The pilot used ordinary flight-controller stick, throttle, target, missile and evade commands. Menus launched every sortie. No position, health, kill, time, unlock or result override was used.

## Exact builds

- `1a48ee6ee3e63242fe746287fc35d11849005fe8`: actual Roblox Jest **165/165, 10 suites**; sequential M1–M27, all 28 three-beat story chapters/finale, protected loss/retry, no-evade M1 and M12 replays. QA harness startup/report fixes were applied as normal client scripts, later committed in `ab58c14` / `a2cf2e1`.
- `678caec`: intermediate presentation-only follow-up; actual Roblox Jest **169/169, 11 suites**, including navigation origin/bounds and measured 319×181 / 320×182 safe-area cases. Final live presentation observations are recorded below. Gameplay rules are unchanged.

## Genuine campaign results

Each mission completed before its unchanged 600-second deadline. Early M3 was completed twice because the original QA report was under PlayerGui and avatar respawn removed that report. The corrected persistent observer lives in PlayerScripts. The first success remains in the native production log; the durable replay is listed below.

| Mission | Server elapsed (s) | Air | Ground | Minimum aircraft hull | Evade commands |
|---|---:|---:|---:|---:|---:|
| 01 | 20.494 | 3 | 1 | 100 | 0 |
| 02 | 30.771 | 4 | 5 | 100 | 2 |
| 03 | 32.137 | 4 | 0 | 100 | 0 |
| 04 | 32.308 | 3 | 1 | 100 | 0 |
| 05 | 56.581 | 3 | 0 | 100 | 0 |
| 06 | 35.080 | 2 | 3 | 100 | 0 |
| 07 | 30.604 | 4 | 0 | 100 | 0 |
| 08 | 62.569 | 6 | 0 | 100 | 1 |
| 09 | 36.254 | 4 | 0 | 100 | 0 |
| 10 | 37.725 | 4 | 1 | 100 | 1 |
| 11 | 38.382 | 4 | 2 | 100 | 0 |
| 12 | 66.829 | 4 | 0 | 100 | 1 |
| 13 | 60.353 | 3 | 5 | 100 | 1 |
| 14 | 44.569 | 3 | 3 | 100 | 0 |
| 15 | 52.717 | 7 | 0 | 100 | 2 |
| 16 | 36.668 | 2 | 4 | 100 | 0 |
| 17 | 52.721 | 6 | 1 | 100 | 2 |
| 18 | 36.805 | 4 | 0 | 100 | 0 |
| 19 | 48.214 | 3 | 3 | 100 | 2 |
| 20 | 102.663 | 8 | 0 | 100 | 6 |
| 21 | 44.637 | 4 | 1 | 90 | 2 |
| 22 | 61.153 | 4 | 5 | 100 | 3 |
| 23 | 89.286 | 8 | 0 | 100 | 3 |
| 24 | 55.870 | 3 | 3 | 100 | 1 |
| 25 | 115.800 | 10 | 1 | 90 | 4 |
| 26 | 81.080 | 10 | 0 | 100 | 6 |
| 27 | 76.566 | 4 | 1 | 100 | 1 |

Route/recon/signal/escort/defend phases all advanced from real flight observations. Representative protected-objective results: M5 truck88.73%, M12 transmitter78.93%, M20 evidence launch78.35%. M23 screenshot shows the defended site at71% during the live defense. M27 entered its final signal phase at40.567s and completed at76.566s.

All 28 chapters were observed with each of their three real subtitle beats and camera frames. The opening and bridges ran before mission creation; the finale followed M27 completion. Original screenshots show the rendered receiver, aircraft and Blender story subjects. Original wide shots exposed cropped masts/vehicles; that prompted the separately tested presentation follow-up.

After the finale, the server listed slot1 as complete with27 mission records/current27, while slots2–4 remained empty. Completion removed the active mission world and cinematic. The archive launched a completed M12 without changing the full campaign unlock state.

## Failure, retry and mobile input subset

A genuine M12 replay withheld missile commands and evade commands. Four raiders naturally suppressed the truck until server `protected_lost` at48.321s, with0 kills/0 missile commands/0 evade commands and full aircraft hull. The visible SORTIE LOST screen offered RETRY SORTIE. Clicking Retry and Launch completed the escort in66.812s with8 missile commands, **0 evade commands**, truck78.32%, aircraft100. The completed campaign remained intact. This is a desktop controller pilot using the mobile-compatible command subset, not a physical phone/gamepad claim.

## Evidence and scope

Original local artifacts are in `build/relay-live-qa/` (ignored generated output, retained in this worktree):

- `MNN_AttemptN-report.json`, `campaign-audit.json`, `latest-report.json`: genuine callbacks, phase timestamps, story observations and read-only server slot snapshots. Audit finds27 completed missions and28 chapters with all three beats.
- `mNN-flight.jpg`, `mNN-completed.jpg`, `story-NN-wide.jpg`, finale and retry images: original Studio capture bytes, visually inspected. M1’s first image named flight is actually debrief; later fresh-build captures are identified separately.
- `production-1a48ee6.log`: original own-instance Studio log, including BROKEN_RELAY_REAL_RESULT for every mission. Earlier harness stack errors are retained, not erased. No Rojo server ran; the installed plugin’s refused auto-connect noise is unrelated to game success.
- `jest-1a48ee6.*`, `jest-678caec.*`: real engine Jest output and summaries. Standalone `build/relay-offline-results.log` is separately labeled70 pure Luau simulations.
- `m05-escort-native.mov`: real20-second native screen video; inspected original frames at1/10/18s. It shows actual escort flight/orbit before the result. `m05-escort-gameplay.mp4` is a real-time crop, with original retained. `m03-native.mov` / `m03-debrief.mp4` show debrief only and are not claimed as flight footage.

## Final presentation pass

Baseline actual simulator measurement: requested320×240 produced camera319×239, CoreUISafeInsets Root319×181, Root origin(0,0), GUI top inset58. Original debrief actions clipped below that safe area. The follow-up uses actual dimensions, scrolls debrief text above fixed actions, keeps short touch targets at least44px, and converts navigation screen projection through the measured GUI parent origin and bounds. Navigation captions avoid objective/control rectangles; protected health also appears in the objective eyebrow.

Final code build `0fc0b3d54f424b6d4fd1916795606d4d8fcef64e` passed **171/171 actual engine tests, 12 suites**. Fresh normal-menu/controller regressions on that package completed M1–M5, all with full aircraft hull and zero evade commands:

| Mission | Elapsed (s) | Input/display scope |
|---|---:|---|
| 1 | 22.181 | Compact touch HUD; real tutorial/radar/bandits |
| 2 | 31.566 | Notched iPhone13 landscape; required bandits/warehouses/ace |
| 3 | 32.011 | Compact → notched landscape → portrait during real route; then air flights |
| 4 | 32.371 | Compact recon with distance/altitude guidance; radar/air |
| 5 | 56.604 | Compact escort; protected health88.68%,7 missile commands |

Measured final compact Root320×182 has title bottom20 and panel top64: **44px of unobstructed scene**, 44px actions and a42px subtitle viewport. Stable original images show the receiver, Blender mast/Kestrel and farm truck in that lane. Wider landscape establishes the entire mast/base above subtitles. The first cold wide capture preceded mesh visibility; the later stable capture shows the actual assets. No guarantee of instant cold mesh loading is claimed.

The large subtitle exposed an engine AutomaticSize undercount: TextFits=false at36px despite TextService/GetTextBounds returning54px. The final renderer uses explicit font measurement. Actual18px text now has TextFits=true, label/canvas58px, and a real scroll moved CanvasPosition0→16 to reveal its final line. Pause, motion, text and skip worked through real GUI Activated; B cancellation removed the scene and returned to briefing. X/P shortcuts were exercised using the tool. **The tool emits ButtonA as InputType.Keyboard**, so native gamepad GUI activation was not demonstrated. Shared engine routing cases cover A on Skip/Motion/Text/Pause and processed inputs, plus consumed B/X/P/Space and single dispatch.

Navigation measurement during genuine M3 flight:

| Actual safe Root | Camera viewport | Caption behavior | Independent objective-row guidance |
|---|---|---|---|
| 320×182 touch | 320×240 | Hidden because no48px caption fits between controls | `◇ 264m`, TextFits=true |
| 750×332 notched landscape | 750×390 | Bounds(29,71),148×48; markerY135.30, bottom119 | `◇ 999m`, TextFits=true |
| 390×705 portrait | 390×763 | Bounds(120,240),148×48; markerY304.94, bottom288 | `◇ 749m`, TextFits=true |

All three measured Root origins were(0,0); the pure origin regression also exercises nonzero(37,58). Projection uses WorldToScreenPoint, subtracts the measured GUI parent origin, and bounds placement against its actual size. Captions avoid objective/warning/status/hints/touch rectangles. In compact M4, the always-visible objective row read `◇ 643m · ALT≤380` with TextFits=true while the floating caption was hidden. Compact M5 similarly displayed distance and protected health. The mission instruction, world beacon and ordinary controls remain available. Minimum tested gameplay safe area is319×181/320×182. Smaller gameplay roots are not claimed; the custom phone profile needs320×260 simulated device resolution to yield a320×240 camera and320×182 safe Root after its additional status strip.

Final artifacts are separately retained in `build/relay-final-0fc0b3d/`: fresh attempt reports, original compact/portrait/notch screenshots, `navigation-measurements.json`, `recon-measurement.json`, subtitle before/after scroll images and `production-0fc0b3d.log`. Intermediate presentation artifacts remain in `build/relay-final-ui/` and `build/relay-final-dc86d41/` with their own build tags.

`fixture-harbor-shared-vehicle-camera.jpg` is explicitly an **asset framing fixture**, not a replay/unlock of M20: the paused production farm/harbor camera temporarily displayed the Blender HarborLaunch at its canonical story placement. The original truck was restored before real M5 gameplay. The failed standalone fixture's menu-camera image is retained as `fixture-menu-camera-conflict-not-evidence.jpg` and is not proof of harbor framing. `tools/inspect-relay-story-asset.client.luau` reproduces the correct fixture. Final whole chapter19 was not replayed; it was observed in the original full campaign at1a48ee6. Fixture observations were kept out of the campaign story observer.

After final M5, teardown again reported activeWorlds0, cinematic absent, menu present. Only owned Studio processes were stopped before the exclusive lease was released.


## Limits

Unpublished Studio sessions do not validate published DataStore rejoin/cloud writes. V2 migration/four-slot isolation and deadline/rejection cases pass engine tests; no ten-minute timeout was waited out live. Protected-objective defeat was observed; aircraft destruction was not forced. No physical phone, console, multiplayer, FPS or memory claim is made. This remains one-place single-player. Parent independent final27 run and review remain required; this branch does not merge itself.
