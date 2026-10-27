# Review-ready integration record — 2026-10-27

The local workspace was fast-forwarded from `6f423f34323f8e7aeb4ed358e263c15972465574` to main `8d66669` (merged through PR #68). The old workspace report described the former snapshot; the updated [project report](skybreak-project-report.html) describes current main.

## PR decisions

- Closed [#3](https://github.com/A-Ricemusic/skybreak/pull/3), [#4](https://github.com/A-Ricemusic/skybreak/pull/4), [#5](https://github.com/A-Ricemusic/skybreak/pull/5), and [#6](https://github.com/A-Ricemusic/skybreak/pull/6): mutually exclusive unselected campaign alternatives. Broken Relay was explicitly selected in `docs/overnight-campaign-plan.md` and integrated in #7. Branches preserved.
- Closed [#29](https://github.com/A-Ricemusic/skybreak/pull/29): cinematic controls superseded by merged #41 and subsequent #53/#68 work. Branch preserved.
- Closed [#42](https://github.com/A-Ricemusic/skybreak/pull/42): deferred redesign, not safe to merge into current flight and telemetry. Branch preserved. Its positive older checks do not validate today's control model.
- No existing open PR warranted merging. Current main already contains the useful integrated follow-up work.

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

## Fresh verification

Tested gameplay revision: `8d66669`. Full results are recorded in the HTML report; raw local logs are under ignored `build/review-ready-2026-10-27/` and `build/jest-*.log`. Device feel, cloud rejoin, published audibility and full human campaign acceptance remain separate review gates.

Fresh production build and eight-script voice gate passed. Offline domain checks: **538/538**; audio lifecycle simulation: **10/10**; voice consumer simulation: **8/8**; Python tool tests: **20/20**. Generated relay tables and world counts matched. The unfiltered Roblox engine suite passed **676/676 tests across 57 suites in 190.83 seconds**. Owned Studio exited after the run. A [durable result summary](evidence/review-ready-2026-10-27.json) records these results and limits.
