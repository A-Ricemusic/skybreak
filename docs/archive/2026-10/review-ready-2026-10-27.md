# Review-ready integration record — 2026-10-27

Historically, the local workspace was fast-forwarded from `6f423f34323f8e7aeb4ed358e263c15972465574` to main `8d66669` (merged through PR #68). The old workspace report described the former snapshot; the updated [project report](skybreak-project-report.html) now distinguishes current main from that historical baseline.

## Current integration — 2026-10-27

Verified gameplay main is d344d26a6e9b5de26bb5995c8fcc60958046a32e. Implemented features include 27 missions, four save slots, three difficulties, four specials, expressive flight, touch evade, radar, pause/settings, richer worlds and recorded dialogue. PR75 merged as 8397654 after independent 5.6 source approval at exact 49ed553; another workstream reported 676/676 engine tests at that exact head. That separate evidence is not a run by this documentation task or current-main engine certification.

PR74 merged as 06a40026a4aa9d82ad2e1c8768f0cf9381d46caa from exact approved 83169d6. Its combined validation gate passed locally and on Linux: 538 domain, 10 audio, 8 voice, 4 radio and 38 Python checks, production build and generated docs (run 40570309250). Build and validation now gate automatic publication in the same job. Its automatic publish 40570718020 returned version 58. PR69 merged as d344d26 from exact approved 59e5ec3 after successful checks 40570917150, integrating the HUD separator/threshold 30.

PR77 remains OPEN at 3523968de513663ed9e3600ce175f73c8646582d. Earlier 76f217e passed source/offline review but independent real-engine verification failed 1 of 691 tests: generalized terrain iteration included Vector3 Size metadata; the ReadVoxels tuple was correct. The new fix uses numeric occupancy.Size bounds. Worker evidence reports 691/691 engine tests across 58 suites in 247.921 seconds, plus 551 shared/domain, 10 audio, 8 voice, 4 radio, 38 Python, build and docs passing. GitHub validation 40571356937 passed. Independent 5.6 runtime verification is ACTIVE; manual acceptance and merge are not established.

Cycle 1 used checkout 3419b6f with gameplay 8d66669: manual onboarding followed by repository automation. M1 recorded four total kills including one ground kill and 94 hull; M2 recorded four required air kills including the ace plus five ground kills. Pause/settings, recovery, results/next flow, warnings and teardown (Combat folder count 0) were exercised. An inverted M1 movement-to-target handoff caused a witnessed crash; PR77 remains the pending onboarding fix. Story props remain a graybox presentation candidate.

Latest recorded successful gated publish is run 40571320499 for d344d26, returning version 59 at 2026-10-27T19:42:17.3744392Z; its logs explicitly include 538 domain and 4 radio checks. This is not proof of the version served in Player. Fourteen audio-bank grants remain unverified: repair execute run 40558606600 returned HTTP 403; dry-run 40558529362 did not grant access and metadata run 40557623782 did not prove delivery. Physical phone/controller, cloud rejoin, audible official-Player acceptance and sustained device performance remain open.

Next: finish independent PR77 verification and M1 acceptance, then review M20 Fracture Line (harbor escort/terrain) and M27 Broken Relay (final ace) on Normal. These showcase selections are source review only, not runtime acceptance. tools/playtest-relay.client.luau supports all-mission navigation with normal controls; the M1/M2 playtest-campaign harness does not. Static relay-pilot QA found a possible phantom attempt after results during the UI end hold and a failure to restore midmission throttle; these are harness limitations, not established game defects, and were not changed here. Then collect physical-device, cloud-rejoin and audible acceptance before presentation polish.

Historical baseline results below remain scoped to `8d66669`, not current main.

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
