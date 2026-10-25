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

Exclusive Studio lease: **Embers of Home** at clean `0e8cb9e2c045125c1da12584dec7ff819e9c2ece`, granted for Roblox Jest and genuine sequential M1–M27 QA. Runtime ledger: `build/studio-lease.json`. Release must be explicit with Studio stopped; do not interrupt based on elapsed time. Parent owns scheduling. Agents may compile/package offline but must request a lease before Studio, Rojo servers, or test:roblox. Never run competing playtests in one instance. Existing Studio ID at baseline: `1991ce85-3e59-4db7-a4db-cbafc56e7dc9`, stopped Edit mode; re-list before using.

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

## First campaign QA handoff

Embers reports offline build/place packaging complete, 73 Jest cases authored (not yet executed), 27 missions and 54 opening/debrief cinematics, v3 progression and Blender rescue launch. Parent verified clean SHA and Studio Edit state before granting exclusive QA. No live campaign results yet. Other four alternatives remain offline. Parent still owes independent final-campaign playthrough after selection.

Aurora Line is next in the Studio queue, not yet granted: PR #3 https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/3 at `2c536b3af189705394a0a056522150c9db81c44a`. Offline Blender/build/place checks passed; engine tests and all 27 live missions remain pending. Parent registered PR; alternative remains unmerged. Resume original Aurora thread with explicit lease only after Embers releases.

Last Tide is queued after Aurora: PR #5 https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/5 at clean `83b0bc87c57d7d3bb37d4cdd257cb3f206fe1f00`. Offline build/place/diff checks passed; Roblox Jest and all-27 live QA are pending. Parent registered PR; no lease granted and alternative remains unmerged.

Aurora parent source review round 1 (`2c536b3`): two P2 findings assigned to original agent for offline fixes: Next Mission bypasses cinematic-aware launch; local cinematic actors overlap/bury inside the retained menu island. Also enlarge 30px Skip button to 44px touch minimum. PR review posted. Follow-up task suffix `thread-send%3Aaurora-parent-review-round1`. Preserve Aurora queue position; require revised review before live QA. Embers lease remains untouched.

Aurora follow-up `67dcf2665410fc9cba99fe04e5cb4210076a06de` independently inspected: Next now uses the shared scene gate; Retry remains immediate; actor and camera points share +5000Y isolation; Skip is 112x44. Both P2 source findings resolved. New regression tests are authored, engine execution and visual verification remain pending. Queue SHA updated.

Glass Horizon draft PR #6 https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/6 registered at `92dd26628bf7bd9fa0a881668d5b42cb541393f6`. Agent reports 117 offline contracts, build/place/test packaging and Blender validation passing; no engine or all-27 live validation yet. Queued after Last Tide; original thread idle awaiting explicit lease. Current order: Embers owns, Aurora → Last Tide → Glass queued.

Broken Relay draft PR #7 https://github.com/A-Ricemusic/test-game-coding-from-phone/pull/7 registered at `d53172a77bc708216b2c22e120a4a82e684aa72a`. Agent reports build/place/test packaging, 58 standalone Luau domain tests, pilot syntax and Blender round-trip checks passing. Actual Roblox Jest (including 27 world lifecycle fixtures), balance and all-27 playthrough remain pending. Queued after Glass; original child will remain idle until explicit lease. All five alternatives now report offline implementation readiness; none has supplied a complete live campaign result.

Embers live progress (agent-reported, exact `0e8cb9e`): actual Roblox Jest 73/73 passed; genuine normal-controller sequential session M1–M9 completed with observer validations true and sequential unlocks. Times: M1 45.60s, M2 54.57s (4 air/5 ground, 90 HP), M3 19.39s, M4 27.08s, M5 26.55s, M6 25.52s, M7 12.80s, M8 36.22s, M9 57.26s (4 air/5 ground, 90 HP). Agent reports MCP captures of title and selected briefing/opening/debrief/HUD views, no result/health/clock overrides. M10–M27 ongoing under unchanged exclusive lease. These are child live results, not parent-independent playthrough or final selection.

Embers second live checkpoint: continuous slot/session M1–M18 complete, agent reports validations true, M10–M18 health100, protected minimum100. M18 59.31s, 4air/5ground; briefing/opening/debrief captures reported. M19–M27 continuing. No protected-damage failure validation established by these wins.

Last Tide source review `83b0bc8`: confirmed P2 cinematic compact layout overlaps title/speaker/subtitle and action buttons, with Skip below screen at 750x323. Assigned original agent offline fix and real child-bounds tests via follow-up `tide-parent-review-round1`; queue retained, no Studio granted.

Last Tide follow-up `114824b5159c5914e0ed60fe40f063808bdbe191` independently source-reviewed: viewport-driven panels separate metadata, speaker/subtitle and 44px side-by-side actions; original overlap/out-of-bounds finding resolved. Regression child-bounds tests authored for five phone/minimum viewports. Live font wrapping/rendering and Roblox Jest remain pending lease; queue SHA updated.
