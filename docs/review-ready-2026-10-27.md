# Review-ready integration record — 2026-10-27

Historically, the local workspace was fast-forwarded from `6f423f34323f8e7aeb4ed358e263c15972465574` to main `8d66669` (merged through PR #68). The old workspace report described the former snapshot; the updated [project report](skybreak-project-report.html) now distinguishes current main from that historical baseline.

## Current integration — 2026-10-27

Verified main is `839765445983ea11bf0b4157ee3aaed9de7efcaa`, including #70 performance, #71 security, #72 campaign hardening, #73 telemetry/HUD, and now [#76](https://github.com/A-Ricemusic/skybreak/pull/76). PR76 merged at 19:30:38Z with exact approved head `60a0661d23690bbaf4bbaca673768d083f08f3b8`, unchanged against main `0648d4a`, clean/mergeable and all three reported checks successful. Fresh `python3 -m unittest discover -s tools/tests`: **38 passed**. Owner-supplied independent 5.6 review found no blockers, exercised mock failure paths, and confirmed `_http.open` prevents keyed redirects while journal/HALT/ambiguous-submit/locking behavior remains preserved. No new engine run was performed. PR75 head 49ed55370769d628b64e9719ce42beddcff35380 was merged concurrently by another actor as 8397654 at 19:31:27Z; this task neither merged nor independently certified it. Its automatic publish run 40569884635 was in progress at inspection.

Open PRs remain unmerged: #74 `e923c6530fd3e55d00a57894b662877ddf2cb3c1` (independent recheck pending; #76 overlap requires combined validation; reported 538 offline/10 audio/8 voice/20 Python and Linux run 40569063153 SUCCESS), #77 `76f217e32cc8e9148e2e397c9ea0d930545b0a6f` (new head needs review), and #69 `906cf6363ab74024d140af692c4a7f6be5bcfc8b` (code approved, separator/threshold 30, 538 tests, no fresh render; blocked on integrated validation gate). These are pending work, not implemented main features.

Cycle 1 used checkout `3419b6f`, gameplay `8d66669`: manual onboarding followed by repository automation. M1 recorded **four total kills**, including one ground kill, finishing at 94 hull. M2 recorded four required air kills including the ace, plus five ground kills. Pause/settings, recovery, results/next flow, warnings and teardown (Combat folder count 0) were exercised. An unsafe M1 movement-to-target handoff while inverted caused a witnessed crash. PR77 addresses this, but its first head `f16d759` received changes requested for stale HUD clearing the client latch and incomplete initial overlap. The new head reports fixes and 551 offline/build passing; engine regressions were compiled **but not executed**, and no fresh manual keyboard/touch/gamepad acceptance exists. Story props remain a graybox presentation candidate.

Previous verified successful publish: [run 40568936985](https://github.com/A-Ricemusic/skybreak/actions/runs/40568936985), revision `0648d4a`, returned version **57** at `2026-10-27T19:25:44.7807483Z`. Newer automatic publish run 40569759963 for #76 succeeded on b99959d and returned version 57 at 2026-10-27T19:31:10.2241155Z. A recorded publish is not proof of the version currently served in Player. Fourteen audio-bank grants remain unverified: execute run 40558606600 returned HTTP 403 with all unconfirmed; preceding dry-run 40558529362 did not grant access, and metadata run 40557623782 did not establish delivery. No audible official-Player capture, physical-device or cloud-rejoin acceptance is recorded.

Prioritize onboarding, representative later-mission/device performance, cloud/audio acceptance, then story-prop quality. Preserve 27 missions, four slots, three difficulties, four specials and the architecture diagrams. Historical baseline results below belong to `8d66669`, **not the new main head**.

## Historical PR decisions

- Closed [#3](https://github.com/A-Ricemusic/skybreak/pull/3), [#4](https://github.com/A-Ricemusic/skybreak/pull/4), [#5](https://github.com/A-Ricemusic/skybreak/pull/5), and [#6](https://github.com/A-Ricemusic/skybreak/pull/6): mutually exclusive unselected campaign alternatives. Broken Relay was explicitly selected in `docs/overnight-campaign-plan.md` and integrated in #7. Branches preserved.
- Closed [#29](https://github.com/A-Ricemusic/skybreak/pull/29): cinematic controls superseded by merged #41 and subsequent #53/#68 work. Branch preserved.
- Closed [#42](https://github.com/A-Ricemusic/skybreak/pull/42): deferred redesign, not safe to merge into current flight and telemetry. Branch preserved. Its positive older checks do not validate today's control model.
- At the original baseline audit, no remaining open PR warranted merging; subsequent decisions are recorded above.

## Missile guidance follow-up

PR42 head `19ce5c69ae5e867831e32079e53611caf8f44cbf` uses an obsolete FlightState shape and telemetry slots now assigned to pause/tutorial fields. Its BREAK predictor assumes immediately attainable full throttle. The reproducible assessment in [combat-evade-timing.md](combat-evade-timing.md) applied that proposal to current ramped-speed controls and found 97 cue-following hits in 3,888 scenarios, including 32 with the assumed 0.3-second reaction. These are findings about PR42 against current controls, not claimed regressions in current main's guidance.

Before reopening or replacing that proposal:

1. Preserve current quaternion/lean flight state, pause/tutorial telemetry and authoritative evade flag.
2. Predict attainable input and selected-speed trajectories, including reconciliation/prediction delay.
3. Rerun delayed-cue and multi-threat cases at 160, 320, 450 and 600 studs/second; record coverage and failures rather than loosening assertions.
4. Verify fair cues and successful defensive decisions in runtime playtesting on keyboard, controller and touch.

Main #59/#63 already improves pursuit and authoritative evade timing. Outflyable missile guidance remains a deliberate gameplay follow-up, not a prerequisite to documenting current code honestly.

## Preserved local work

Before synchronization, 93 dirty/untracked paths were archived outside the checkout at `../skybreak-review-backup-2026-10-27/`, with `local-files.tar.gz`, a path/deletion manifest, a binary Git patch, a retained stash reference and a disposition README. `.claude` worktrees remain untouched in place.

Audio assets and much tooling were identical to merged main; differing audio/client implementations and the uploaded-assets note were older than main. Unique historical QA notes, an unrelated uploader tool, and the local deletion of `react-agent-testing` are preserved in the archive/stash rather than silently committed or lost. Owner-provided AGENTS instructions are retained. The canonical report is under `docs/`; an updated local copy at `reports/skybreak-project-report.html` preserves the original link.

This change is documentation only. The existing workflow ignores Markdown and `docs/**` pushes, so this report update does not publish a new Roblox place. No assets are uploaded or permission grants applied.

## Historical verification at 8d66669

Tested gameplay revision: `8d66669`. Full results are recorded in the HTML report; raw local logs are under ignored `build/review-ready-2026-10-27/` and `build/jest-*.log`. Device feel, cloud rejoin, published audibility and full human campaign acceptance remain separate review gates.

At that baseline, the production build and eight-script voice gate passed. Offline domain checks: **538/538**; audio lifecycle simulation: **10/10**; voice consumer simulation: **8/8**; Python tool tests: **20/20**. Generated relay tables and world counts matched. The unfiltered Roblox engine suite passed **676/676 tests across 57 suites in 190.83 seconds**. Owned Studio exited after the run. A [durable result summary](evidence/review-ready-2026-10-27.json) records these results and limits.
