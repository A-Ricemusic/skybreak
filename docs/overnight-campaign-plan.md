# Overnight campaign build coordination

User authorized two isolated bug fixes plus five independent, complete 27-mission alternatives, PR reviews/merges, Blender asset creation, genuine full-game playtesting, comparison/integration, and final screenshots or recordings of all 27 missions including story cutscenes. Do not claim implementation or gameplay complete without evidence. Baseline main: c9ace18; existing two missions and 58 Roblox Jest tests pass.

## Seven workstreams

All seven initially delegated through T3 using Cursor Opus 4.7. Opus quota was exhausted; preserved all work and resumed the same threads/worktrees with Codex: Sol 5.6 high for HUD, Embers, Aurora and Tide; Sol 6.1 high for Glass and Relay. Hangar implementation completed before the quota failure. No billing settings changed.

| Work | Branch | Worktree suffix | Request ID |
| --- | --- | --- | --- |
| Raise objective HUD | t3/raise-objective-banner | t3-06f1421c | skybreak-hud-top-opus-1 |
| Fix menu hangar flicker | t3/fix-hangar-flicker | t3-f7cba204 | skybreak-menu-shimmer-opus-1 |
| Embers of Home | t3/embers-of-home-campaign | t3-55bd8bb9 | skybreak-rebuild-embers-opus-1 |
| Glass Horizon | t3/glass-horizon-campaign | t3-037c1088 | skybreak-rebuild-glass-opus-1 |
| Aurora Line | t3/aurora-line-campaign | t3-3ef45378 | skybreak-rebuild-aurora-opus-1 |
| Last Tide | t3/last-tide-flight-campaign | t3-aea5c046 | skybreak-rebuild-tide-opus-1 |
| Broken Relay | t3/broken-relay-campaign | t3-b4a927bc | skybreak-rebuild-relay-opus-1 |

Worktree root: `/Users/pelicannurse/.t3/worktrees/test app/`.
Each task ID is `node:delegated-task:command%3Amcp%3A1d20c4c5-6ced-4ff0-adee-a0de5ee732ea%3Adelegate-task%3A` plus request ID.
Each child thread ID replaces the leading `node:` with `thread:`. Retain those exact IDs for followups; don't spawn duplicates.

Both bug PRs are merged. Main after merges: `0498e85`.

- PR #1: https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/1, final head `28c6c39`. Parent reviewed; 62/62 actual Roblox Jest tests pass. Earlier normal iPhone landscape/portrait flight views passed; revised compact 320x240 real React HUD inspected with constrained root and forced warning visibility (UI fixture only, not gameplay). No control overlaps. Earlier screenshots: build/screenshots/pr1-hud-{landscape,portrait}.png.
- PR #2: https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/2, final head `a2e01f7`. Parent reviewed all geometry changes; 64/64 actual Roblox Jest tests passed before comment/unused-export cleanup, subsequent build passed. Sampled live iPhone menu views at different sway positions show clean faces. Native recording returned black frames and was rejected as evidence; no new continuous recap video claimed. CodeRabbit hit review quota; its green status was not counted as independent review.
- Both fixes propagated to all five existing campaign threads. Alternatives remain in progress; none has yet supplied a complete 27-mission playthrough. PR watches disabled after merges.

## Studio ownership

Exclusive Studio lease: **none**. Parent owns scheduling. Agents may compile/package offline but must request a lease before Studio, Rojo servers, or test:roblox. Never run competing playtests in one instance. Existing Studio ID at baseline: `1991ce85-3e59-4db7-a4db-cbafc56e7dc9`, stopped Edit mode; re-list before using.

Before granting a lease, record owner, branch, start and expected handoff here (or in a linked ignored runtime ledger). Agent must identify its own build and release Studio stopped with results and logs. Parent must independently play all 27 final missions. Hardware phone/controller testing is not established by emulator/shared-handler tests.

## Review and selection

Bug PRs: inspect root cause and complete diff, independently review, run relevant tests and visual checks, then merge if verified. Register every PR worked on with T3 link_pull_request. Propagate the accepted fixes into rebuild alternatives before final QA.

Rebuild PRs remain alternatives until comparison. Evaluate:

- All 27 missions actually reachable through four-slot save/unlock/replay flow; safe migration from v2.
- Tutorial and five-warehouse Mission 2 retain specified objectives; authoritative 600-second deadlines and failure/retry.
- Meaningful objective variety, clear targets, fair mobile difficulty, deliberate pacing.
- Coherent original story with rendered, skippable cinematic beats between every level and a finale.
- Distinct, readable environments using actual Blender-authored assets and native Roblox materials.
- One-place world create/dispose lifecycle; bounded enemies/projectiles/geometry and complete cleanup.
- Correct PC/mobile/console UI, raised objective banner and stable menu geometry.
- Genuine start-to-finish playthrough evidence; no fake kills, health, success or shortened gameplay clocks.

Choose a coherent winner or integrate compatible best elements; do not merge five conflicting architectures wholesale. Preserve existing source and tests until validated replacements exist. Record rejected alternatives' useful ideas and concrete selection reasons.

## Continuation

Scheduled coordinator ID: `scheduled-task:command:mcp:1d20c4c5-6ced-4ff0-adee-a0de5ee732ea:schedule-task:skybreak-27-campaign-overnight-loop-1`.
Runs every 900000 ms in this thread. First run: 2026-10-25T06:01:32.206Z (October 24, 11:01 PM Pacific). Agent completion notifications also resume work. Disable schedule once final integrated game and all27mission evidence are delivered; do not leave idle recurring work.

Keep commits/pushes scoped. Unrelated `react-agent-testing/` deletions belong another task and must remain untouched. Videos/build outputs stay ignored; preserve final user-facing recordings and remove only known temporary captures. Publishing is still blocked on first authenticated Studio UI publish, so don't invent a public game URL.
