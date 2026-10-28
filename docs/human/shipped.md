# Shipped

Last updated: 2026-10-28, against `main` at `93dc512153b9098cdb7d486f3857e16794fc6ff0`.

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Broken Relay is the live 27-mission campaign. The latest merged gameplay-code revision is `93dc512` (#98). Gameplay merges are live through automatic CI/CD under the owner's convention; documentation-only changes add no game content.

## Merged 2026-10-28, newest first

| PR | Commit | Title | Kind | What you will see |
|---|---|---|---|---|
| #101 | `76f7f9e` | docs(specs): mission 1 mission and world specs from reference footage | Docs | No game change. The approved spec for mission 1: six bombers, four escorts with an ace, a 10:00 countdown, points per target, and the island world. |
| #100 | `4e46fb4` | docs(specs): map engine readiness for AC04 campaign | Docs | No game change. What the engine can and can't do for the redesign, and the build sequence. |
| #99 | `48c2520` | docs: commit the footage ledger and record the owner's redesign answers | Docs | No game change. |
| #98 | `93dc512` | refactor(missions): one file per mission and a single mission runner | Gameplay code, refactor | Nothing. Each mission is now its own data file, and missions 1 and 2 run on the same runner as the rest. An independent Opus review found no gameplay difference. |
| #97 | `cb624c8` | refactor(ui): split GameUI screens | Gameplay code, refactor | Nothing. The 2,560-line UI file is split into one file per screen; the orchestrator audited that every line moved unchanged. |
| #96 | `22d84b2` | chore: phase 0 setup for the AC04-structured redesign | Docs | These five pages, the redesign plan, and the gitignored footage folder. No game change. |
| #95 | `0fb4757` | chore: second cleanup pass for a fresh baseline | Docs / housekeeping | No game change. |
| #80 | `6fc5d9a` | fix(ui): show every settings row, unstick picker highlights, dedupe sticks | Gameplay / UI | Every settings row, including VOICE VOLUME, is visible. Picker highlights no longer stick after a touch tap. |
| #78 | `ed53a22` | fix(server): never let world/asset loading hold remote handlers | Gameplay / server | The server answers menu requests even while slow world assets are still loading. |
| #81 | `fd05768` | refactor(shared): single sources for kill targets, fire notices and briefing numbers | Gameplay code | Special-weapon briefing numbers now match the real values. No combat change. |
| #94 | `5a01aa6` | chore: tidy repo after AC04 revert | Docs / housekeeping | No game change. |

## What was verified, and what was not

- **#97 and #98:** before merging, the Studio test suite ran on main with both combined: 684 of 684 tests passed across 57 suites. The merged main is file-for-file identical to that tested tree.
- **All PRs:** the offline validator passed (545 compiled contracts, audio, radio and voice simulations, 90 Python tests).
- **Not done:** no agent has played any of this in Roblox Player. No place version or upload receipt was checked. Your playtest is the real check.

The earlier AC04 release (#92) was rejected and reverted (`b0737fa`). #77 (mission 1 tutorial rework) and #91 (TypeScript 5.9) were closed without merging.
