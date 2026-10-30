# Mission 5 Studio verification, 2026-10-30 (after merging main: #149, #158, #159 and the rest)

Studio only, on the shared lease (taken after more than 5 free minutes, coordinated with the other Studio users). **No Roblox Player test.** No audio was generated or uploaded.

## Roblox Jest
`bun run test:roblox` on the merged head: **972 passed / 0 failed, 97 suites** (first clean run; two earlier attempts were lost to a launch collision with another worktree, not to test failures). The Jest harness printed `M05_STUDIO_BUILD seconds=46.49 terrain=46.33 jobs=8861` (fake uploads).

## Build time on the real campaign path (after #158)
| Run | WorldBuildSeconds | Terrain | Jobs | Missing | Targets adopted |
|---|---:|---:|---:|---:|---:|
| Direct request (UI did not follow) | 17.30 s | 16.74 s | 8,861 | 0 | 90 |
| Briefing LAUNCH (real UI) | **17.96 s** | 16.60 s | 8,861 | 0 | 90 |
| Edit-mode rebuild for screenshots | 10.36 s | — | — | — | — |

The 2026-10-29 builds were 45.98 s. The Jest harness's 46.5 s does not reflect the live path.

## Scripted playthrough through the real UI
Title → CAMPAIGN → slot 1 ("CONTINUE MISSION 05 · 4/18 complete · LIGHTS OFF", missions 1–4 completed by the fixture) → briefing (story text from #159) → EASY → LAUNCH → loading screen → mission. The QA pilot uses only the normal controller methods.

- Rearm early (pilot in menu mode): RearmStarted → RearmMenu; nobody answered, so the 30 s timeout took off with the loaded salvo (as designed) → RearmComplete. The TAKEOFF clock reads `00'41"71` (the backslash fix is verified); the main TIME was held.
- **2,000 points at T+3:51** (rank letter C).
- Phase change at **600.0 s**, then CutInStarted with **5 subjects**, CutInComplete, and the south crossing → **Completed: mission time 627.9 s, phases 2, rank C, saved**. The briefing then shows YOUR BEST 10:27.
- **No settlement `Script timeout`.** The world gate's registered `M05World.Clear` replaced the synchronous clear; the menu world was back behind the results screen.

## Night lights (D-108)
`06-refinery-lights-d108.jpg`: the refinery reads as a lit grid of 6-stud points under eight sweeping searchlights. `07-rig-deck-lights-d108.jpg`: the rig decks show their light rows instead of a black silhouette. The rig and tankers are still dark between lights.

## Not verified
- **A controller-only pass through TAKEOFF / CHANGE WEAPON.** Studio's MCP keyboard tool sends D-pad keys as Keyboard input, and `VirtualInputManager` gamepad events need RobloxScript capability. With no physical controller attached, the focus and binding swap are verified offline only. The owner should try a controller in Player.
- A screenshot of the letterbox fix: the cut-in finished before a capture was taken.
- Found and fixed: the briefing showed PAR 00:45 because score phases had no par rule. Par is now 10:35.
