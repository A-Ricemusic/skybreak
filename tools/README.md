# tools/

Scripts that validate, build, upload and publish SKYBREAK. Nothing here is shipped in the place.
`bun run validate:offline` is the PR and publish gate; everything it runs is marked **gate** below and
needs no Studio, credentials or network. Studio-only scripts need the orchestrator's exclusive Studio lease.
See `docs/architecture/README.md` for how the pieces connect.

## Gate (`validate-offline.ts`, in run order)

| Script | What it checks |
|---|---|
| `check-no-react-agent-testing.ts` | **gate** The removed React/Playwright agent-testing harness has not come back (also `.github/workflows/no-react-agent-testing.yml`). |
| `package-aircraft.ts` | Part of `bun run build`: packs the exact Blender mesh JSON into server-only `StringValue`s for Rojo. |
| `check-place-voice.py` | Part of `bun run build:place`: rejects a built `.rbxlx` whose voice scripts are missing or stale. Not an audio test. |
| `check-place-assets.py --inventory` | **gate** Lists every embedded blob and `rbxassetid://` reference in the built place. Inventory never authorizes publication; `--publish` does (see below). |
| `check-luau-modules.ts` | **gate** Compiles every emitted Luau module in the standalone Luau CLI and checks the require graph; fails on Luau's 200-local limit. |
| `test-voice-disclosure-ui.ts`, `test-results-wiring.ts`, `test-m03-builder-contract.ts`, `test-world-environments.ts` | **gate** Static source contracts (regexes over TypeScript), no runtime. |
| `test-relay-offline.ts` | **gate** Runs the pure `src/tests/*.spec.ts` contracts listed in its `MODULES` table inside the Luau CLI. Minimum pass count is pinned in `validate-offline.ts`. |
| `voice-lines.ts --check`, `story-voice-script.ts --check` | **gate** Generated voice line ids and the story script match the compiled catalog; run without `--check` to regenerate. |
| `test-mission-catalog.ts` | **gate** Frozen catalog snapshot (`fixtures/mission-catalog.campaign18.json`); `--update` regenerates it deliberately. |
| `test-playtest-relay.ts` | **gate** Runs `playtest-relay.client.luau` against `tests/playtest-relay-harness.luau` with inert Roblox surfaces. |
| `test-audio-offline.ts`, `test-voice-offline.ts`, `test-cinematic-offline.ts`, `test-radio-delivery.ts` | **gate** Deterministic simulations of compiled client modules with engine doubles (`tests/*.luau`). They never claim audible or rendered output. |
| `tests/test_*.py` | **gate** Python unit tests for the upload, publish and asset tooling; isolated state and mocked HTTP only. |
| `relay-tables.ts --check`, `world-report.ts --check` | **gate** `docs/broken-relay.md` tables and the world counts in `docs/world-realism.md` are up to date; run without `--check` to regenerate. |

Every offline Luau tool finds the CLI through `luau-bin.ts`: `LUAU_BIN` if set, otherwise `build/offline-luau/luau`.

## Studio runners and Studio-side scripts

| Script | Purpose |
|---|---|
| `test-roblox.ts` | `bun run test:roblox`: compiles, builds the isolated test place, launches Studio and runs `run-jest.luau`. One Studio per machine. |
| `run-jest.luau` | Studio entry point for `@rbxts/jest`; only against `test.project.json`. |
| `rojo-connect.server.luau`, `install-rojo-connect.py` | Companion plugin that auto-connects Studio to `rojo serve` for this project. |
| `playtest-relay.client.luau`, `playtest-gamepad.client.luau`, `playtest-touch-throttle.client.luau` | Hand-inserted LocalScripts for Studio playtests (automatic pilot, gamepad and touch throttle checks). |
| `check-audio.client.luau` | Studio-only check that approved audio assets load and play their native regions. |
| `verification/` | Isolated QA places and observers used for hand verification (`build-*-place.ts`, read-only client observers, scripted server playthroughs). Never published. |
| `spikes/` | Archived large-world and M01 performance experiments with their results; see `spikes/README.md`. |

## Hand-run offline tools

| Script | Purpose |
|---|---|
| `render-hud-mock.ts` | Renders static HUD mock PNGs into `docs/design/` with headless Chrome. |
| `clean-artifacts.ts` | `bun run clean` / `clean:check`: deletes ignored build artifacts after reading the Git index; refuses outside a repository. |
| `audio-use-allowlist.ts` | Read-only preparation for the permission-repair workflow; makes no HTTP calls. |

## Asset builders (Blender)

`assets/build.py` is the entry point for one upload asset in a fresh Blender process (`assets/build-all.sh` for the set);
`assets/skyasset.py` and `assets/zones.py` hold the shared helpers and surface recipes; `assets/aircraft*.py`,
`assets/world.py`, `assets/m01_assets.py`, `assets/m04_m05_assets.py`, `assets/cinematic_assets.py` and
`assets/military_ground_kit.py` are the generators; `assets/write_manifest.py` collects the checklists into
`assets/roblox-upload/manifest.json` and `src/shared/UploadedAssetSpecs.ts`; `assets/verify_fbx.py`,
`assets/contact_sheet.py`, `assets/cinematic_set_preview.py`, `assets/compare_v1_v2.py` and
`assets/check_vanta_default.py` are review aids; `assets/ground_kit_packet.py` writes the review packet.
`build-aircraft.py`, `build-enemy-aircraft.py`, `build-mission-assets.py`, `build-relay-assets.py`,
`build-world-kit.py` and `build-cinematic-props.py` are the older generators for the runtime mesh JSON under `assets/`.
Nothing a builder writes may be uploaded without the independent review in AGENTS.md.

## Upload and publish (Python, credentials only in CI or the owner's shell)

| Script | Purpose |
|---|---|
| `_http.py` | TLS-verified, redirect-refusing, bounded HTTP helpers for keyed requests; errors never carry remote text or keys. |
| `roblox_upload.py` | Shared upload journal, HALT files, the audio ban, the committed-review check (`require_model_review`) and the submit-and-moderate loop. State lives in the OS account home (`~/.skybreak-roblox-uploads`). |
| `upload-models.py` | Uploads one approved FBX Model at a time: byte-matched against `origin/main`, backed by a committed independent 10/10 APPROVE decision. `--dry-run` works offline. |
| `upload-audio.py`, `upload-voice.py` | Permanently refuse real uploads (D-668); `--dry-run` preflight only. |
| `check-place-assets.py --publish` | Fail-closed publication authorization: every embedded blob needs a committed approval, every referenced id a catalog entry, and new embedded bytes consult the model HALT. |
| `verify-roblox-target.py` | Confirms the configured universe and place ids are the official target without printing them. |
| `publish-place.sh` | CI publish step: verifies the target, pins a read-only copy of the built place, re-runs the publish gate before every POST and retries 409 "busy". |
| `diagnose-roblox-voice.py`, `repair-roblox-audio-permissions.py` | Manual Open Cloud maintenance workflows (`.github/workflows/`); GET-only probe and a dry-run-by-default permission grant. |
| `build-audio.py`, `pack-audio.py`, `review-audio.py`, `voice.py` | Historical audio and voice preparation (generation, packing, automated screening). They never upload. |

## Tests and fixtures

`tests/test_*.py` are the Python unit tests (run by the gate and by `python3 -m unittest discover -s tools/tests`);
`tests/*.luau` are the harnesses the offline simulations drive; `fixtures/` holds the frozen catalog snapshot.
