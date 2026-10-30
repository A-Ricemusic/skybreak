# Mission 5 Studio verification, 2026-10-29

Studio only, on the single Studio lease (taken after more than 5 minutes with no Studio running). **No Roblox Player test.** The local place is `build/m05-verification.rbxlx` from `tools/verification/build-m05-place.ts`. A Studio-only fixture opens missions 3–4 and completes missions 1–4 in order on slot 1 through the coordinator's normal record path. `tools/verification/m05-pilot.client.luau` then sends the briefing's `StartMission` request and flies with the normal controller methods only.

## Roblox Jest
`bun run test:roblox`: **874 passed / 0 failed, 87 suites** (first run, no retry). The run included the new M05 world, light and lighting-reset spec and the rearm-menu and cut-in runtime specs. It ran before the follow-up night-light, letterbox, clock-text and weather fixes described below.

## Build time (measured)
| Where | WorldBuildSeconds | Terrain | Jobs | Missing props |
|---|---:|---:|---:|---:|
| Roblox Jest (fake uploads) | 44.45 s | 44.23 s | 12,645 | 5 |
| Campaign path, run 2 (real uploads) | 45.98 s | 45.77 s | 12,645 | 0 |
| Edit-mode rebuild for screenshots | 61.79 s | — | — | — |

The planning estimate was about 14 s. The terrain write dominates, so this needs world-side work before release (see Blockers).

## Scripted playthroughs (real campaign path)
| Run | Difficulty | Threshold | Rearm | Surprise | Result |
|---|---|---|---|---|---|
| 1 | Normal | — (1,400 at T+2:16) | — | — | Failed, `destroyed` (the pilot dived into the rig's guns); result saved |
| 2 | Normal | 2,010 at T+3:15 | Gate → menu → CHANGE WEAPON salvo→lance → takeoff; main clock held at 05:37; damage kept | — | Failed, `destroyed` at T+7:28 (the pilot does not evade well); result saved |
| 3 | Easy | 2,050 at T+3:35 | As run 2 | `return_line` at 600.0 s; CutInStarted with 5 subjects; CutInComplete | **Completed**: south crossing at mission time 623.6 s with 216.4 s left on the 4:00 clock (the 9 s cut-in did not count), phases 2, 2,050 points, rank C, saved |

## Screenshots
1. `01-strike-pts-hud.jpg`: `PTS 120/2000` (after the `sanitizeTelemetry` fix; run 1 showed `TGT`).
2. `02-rig-at-night.jpg`: the rig reads only through its target boxes (it has one light per deck).
3. `03-goal-met-rank-letter-rearm-beacon.jpg`: `PTS 2010/C` and the green REARM beacon ahead.
4. `04-rearm-takeoff-clock.jpg`: TAKEOFF clock, SKIP prompt, lit runway and tower. The clock text showed a stray backslash, since fixed.
5. `05-elite-cut-in.jpg`: HUD-less cut-in, caption, SKIP, five aircraft. The top letterbox bar sat below the screen edge, since fixed.
6. `06-results-accomplished.jpg`: MISSION ACCOMPLISHED, C, 2,050, both objectives ticked, per-type breakdown.
7. `07`/`08`: refinery searchlight beams read well; the 2-stud point lights were mostly invisible or inside tanks.
8. `09-rig-far.jpg`, `10-tanker.jpg`: the rig and tanker are dark silhouettes.

The night-light follow-up (D-108) and the clock-text, letterbox and weather fixes are verified offline only. A short Studio re-check is listed in Next.
