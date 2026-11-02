# SKYBREAK: Broken Relay

An original mobile-first arcade jet combat campaign for Roblox, written in TypeScript with roblox-ts, React Lua, and Rojo. Choose one of four persistent campaign slots and fly an 18-mission campaign (plus a practice flight) in one Roblox place. Agents and contributors: start with the [architecture map](docs/architecture/README.md) and [AGENTS.md](AGENTS.md). Each sortie builds its world on launch and removes it after the result.

## Controls and campaign

- Flying: the stick commands rates and the jet **holds its attitude** when you let go (no auto-level). Up/down pitches about the wings — hold it for a full vertical loop, inverted over the top — and left/right turns the nose (the jet banks into the turn; inverted, left/right still means your own left/right on screen). Climbs trade speed gently, dives gain it. See [flight mechanics](docs/flight-mechanics.md).
- Mobile: two thumb sticks (80 px by default; STICK SIZE scales them 85–130 %) appear while using touch. Left steers; push the right stick toward SPEED UP to accelerate or SLOW DOWN to decelerate. Release recenters the knob and holds the selected throttle. TGT, FIRE, the special weapon and a round **EVADE** button are four same-size (54 px) buttons in one row between the sticks, with EVADE nearest the right stick; FIRE stands out by its green fill and heavier ring (narrow portrait and Studio-sized roots use a 2×2 grid). EVADE fires on touch-down, shows its charges as pips and a recharge ring, and pulses red while a missile is inbound and a charge is ready. A third finger on any button still registers while both sticks are held. Above the right stick, a hull bar turns amber, then red, as damage builds, with one small ammo line under it (`MSL 8 · FLR 3 · EVD 3`; `MSL 8·FLR 3·EVD 3` where the panel is narrow). HUD text never draws below 8 px, even at HUD SCALE 80%.
- Desktop and console: a short control legend appears at launch; afterwards the HUD shows only actionable hints. Evade is `F` on keyboard and `B` on gamepad; the ammo line under the hull bar shows the evade charges (`EVD 3`). Hold `LB` / `RB` to decrease / increase throttle. Menus support gamepad selection, with `B` to go back.
- Radar: a 90–110 px heading-up disc (top-right on touch, bottom-centre on tall desktop windows, top-right otherwise) shows required bandits (cyan ▲), optional raiders (orange △), ground targets (◆ / ◇), the objective (◎), the protected unit (■) and incoming missiles (blinking red •). It zooms to 1.6 km while every required contact is close, otherwise 3.2 km; contacts beyond the range sit on the rim.
- Warnings share one line above the controls: TERRAIN · PULL UP (a client-side 2 s look-ahead along the flight path; warning only), STALL, LOW SPEED (within 30 studs/s of the stall or bleeding toward it), LOW ALTITUDE and AIRSPACE LIMIT, always after MISSILE INBOUND / MISSILE LOCK. A refused or blind shot (`NO LOCK · FIRING BLIND`) is captioned just above FIRE on touch (in the warning line elsewhere) and never replaces the objective. Radio lines queue: each stays at least 2.5 s, at most three wait.
- Pause: the `II` button (top-left), `P` on keyboard, or opening the Roblox menu (`Esc`, the menu button, the gamepad menu) or switching away from the app pauses the sortie; the server holds the clock for up to 5 minutes. Resuming always takes an explicit RESUME press (or `P`). The pause card also offers SETTINGS and MAIN MENU.
- Settings (title screen or pause card): invert pitch, level assist (off by default; on, a centred stick eases the jet back to wings-level), camera shake strength, HUD scale (80–130 %; touch never shrinks below 100 % so buttons stay at least 44 px), stick size, music and effects volume. Values are kept for the session as attributes on `PlayerGui` (`InvertY`, `LevelAssist`, `CameraShake`, `HudScale`, `StickScale`, `MusicVolume`, `SfxVolume`).
- Targets are selected automatically; TGT cycles contacts. Keep the selected target in range and ahead until the bracket reads LOCKED, then FIRE launches guided missiles. Early FIRE launches unguided. The briefing's objective card shows the mission's par time (and your best time) before launch.
- Practice flight: learn pitch/turn, select and destroy a ground radar, then defeat pursuing bandits.
- Missions 1–18 follow the reference-footage specs in `docs/specs/missions/` and `docs/specs/worlds/`: bomber intercepts, airfield strikes, night fuel-complex raids with rearm, canyon runs, protected convoys, jamming corridors, cruise-missile defence and the finale duel. The owner-facing status of every level is in [docs/human/levels.html](docs/human/levels.html).
- Impact feedback is client-only: hull hits shake the chase camera (firmer on heavy hits), confirmed kills pop a short top-centre callout (`SPLASH ONE`, `SPLASH TWO`…, `TARGET DESTROYED`, `ACE DOWN`) and flash the destroyed target's bracket, and an ace kill adds a brief camera hit-stop, FOV punch and white flash. Turning cinematic Camera motion OFF also disables shake and the hit-stop camera moves for the session.
- Opening, inter-mission and finale cinematics render staged story beats with subtitles, skip, pause and motion/text controls. Missions unlock sequentially; completed missions can be replayed.
- Older save versions are migrated on load (`src/server/CampaignRepository.ts`); all four slots retain their records.
- Each mission has a server-enforced 900-second deadline. Success unlocks the next mission; failure supports retry. Required kills and completion are server-authoritative.
- Published experiences save four slots to DataStore; an unpublished local Studio file clearly uses session-only saves.

## Setup

Install [Bun](https://bun.sh) and [Aftman](https://github.com/LPGhatguy/aftman), then run:

```sh
aftman install
rojo plugin install
bun install --frozen-lockfile
bun run build:place
bun run serve
```

Open `build/skybreak.rbxlx` in Roblox Studio. Open the Rojo plugin in the Plugins toolbar and connect to `localhost:34872`. Publishing is automatic on merge to `main` (see “Play on your phone” below); nothing is published from Studio.

## Source files

- `src/server`: server authority (campaign, combat loop, world construction)
- `src/client`: player scripts (flight controller, React Lua UI, effects)
- `src/shared`: pure rules shared by server, client and offline tests
- `src/tests`: `@rbxts/jest` specs; `tools/`: validation and asset tooling
- `default.project.json`: the place structure and Rojo mappings

The [architecture map](docs/architecture/README.md) explains how these connect.

Run `bun run watch` in another terminal while editing TypeScript/TSX. Keep Rojo connected to sync changes into Studio. Studio edits are not automatically written back to the repository. Save code in this repository; merging to `main` publishes it.

## Automatic connection on this Mac

For development without clicking Studio's Rojo UI, install the companion plugin:

```sh
python3 tools/install-rojo-connect.py
```

The companion packages the installed official Rojo client's modules and connects only when the place contains this project's `GameConfig` and the server reports this project's name. It retries disconnected sessions and does not run during playtests. Restart the place after installing it.

Launch the place directly if macOS's file association opens the Studio home screen:

```sh
/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio --task EditFile --localPlaceFile "$PWD/build/skybreak.rbxlx"
```

Keep `rojo serve` running in a separate terminal. The companion's state is available through `CoreGui.PhoneGameRojoStatus` in Studio. To remove the companion, delete `~/Documents/Roblox/Plugins/PhoneGameRojoConnect.rbxm` and restart Studio.

## Gameplay audio

The non-vocal combat library lives in `assets/audio`. `cues.json` defines the 25 effects; `upload-plan.json` maps them into eight Roblox assets to conserve upload slots. `src/shared/SoundBank.ts` contains only approved Roblox IDs and native playback/loop regions. Engines respond to throttle, missile motors follow projectiles, explosions use positional emitters, and cockpit warnings have a single priority order. Transient sounds, missile motors and enemy engines have client-side caps and clean up between sorties.

Audio/voice uploads are permanently blocked by the owner (2026-10-31), even if halt files are absent. Existing approved playback remains. Historical preparation uses Python with FFmpeg and `faster-whisper`; offline preflight does not authorize upload:

```sh
python3 tools/build-audio.py --key-file "$ELEVENLABS_KEY_FILE" --ffmpeg "$FFMPEG_BIN"
python3 tools/pack-audio.py --ffmpeg "$FFMPEG_BIN"
python3 tools/review-audio.py
python3 tools/upload-audio.py --key-file "$ROBLOX_KEY_FILE" --dry-run
bun run build:place
```

The generation key needs sound-generation and subscription-read access. Final audio requires paid-plan provenance. Generation caches raw takes in ignored `build/audio`; do not regenerate approved or submitted files, since their upload journal hashes must remain stable. Real audio/voice upload runs refuse before reading credentials. The legacy account HALT remains an audio halt and must not be removed. Review records explicitly distinguish automated non-vocal screening from human listening. Future voice recordings remain blocked by the same code ban.

## Roblox Jest tests

Run `bun test:roblox` (or `bun run test:roblox`). Bun compiles the TypeScript, builds an isolated test place, launches authenticated Roblox Studio, and runs Jest in Roblox's Luau VM. This is not Bun's JavaScript test runner. Results are written to `build/jest-results.json`; full output is in `build/jest-output.log`.

The runner defaults to the macOS Studio executable. Set `ROBLOX_STUDIO_PATH` for another installation. The runner defaults to a 1,200-second Studio deadline; set `ROBLOX_TEST_TIMEOUT_MS` to a positive integer in milliseconds for a longer world-integration run. Tests cover flight math, real engine instances/effects, save-slot isolation, delayed writes, and recovery from load/save errors. Test places disable normal game startup and automatic Rojo connection. Production places exclude `src/tests`.

Run `bun run test:roblox:perf` for the isolated, sequential 18-mission world timing test. It selects only `MissionWorldBuild.perf`, with a 60-minute Studio deadline (overridable with `ROBLOX_TEST_TIMEOUT_MS`) and a 55-minute Jest test timeout. Logs and summary use `build/jest-perf-output.log` and `build/jest-perf-results.json`. Each `MISSION_PERF_ROW` reports build time, heartbeat gap, terrain batch, planning CPU/slice, memory and phase durations. Every gap over 0.3 seconds prints all intervening timestamped phase spans, including previous-world cleanup and Sea parts. The test uses synthetic uploaded templates; it does not measure real asset downloads, replication or device load. GC memory deltas and the settling window are diagnostic evidence, not causal GC attribution. The default suite retains the calibrated plan bounds, Sea/corridor regressions and existing integration builds; `validate:offline` also checks all 18 deterministic plan fingerprints.

A small checked-in Bun patch applies the upstream roblox-ts runtime registration fix needed for Jest's isolated module environments. `bun install --frozen-lockfile` applies it automatically.

For a genuine mission smoke test, launch through the menu in Studio and fly it by hand (the former `tools/playtest-campaign.client.luau` driver was removed in the 2026-10-28 tidy; recover it from git history at commit b0b1cb4 if needed). Live cloud saves require a published experience; unpublished Studio tests use clearly labeled session-only slots.

Ground-target creation and the no-key Studio mesh workflow are documented in [mission-assets.md](docs/mission-assets.md).

## Play on your phone (private test)

Every push to `main` builds the place in GitHub Actions and publishes it to a private Roblox experience (`.github/workflows/publish-roblox.yml`). The Roblox app on your phone then plays the latest published version. Publishing uses Roblox Open Cloud through `tools/publish-place.sh`. The workflow skips publishing until the settings below exist, and the build still runs.

One-time setup:

1. In Roblox Studio, open `build/skybreak.rbxlx` and choose **File > Publish to Roblox**. Create a new experience.
2. In the Creator Dashboard, set that experience's privacy to **Private**, so only you and invited collaborators can join.
3. Create an Open Cloud API key with universe-places **write** access for that experience.
4. In GitHub, add the key as the repository secret `ROBLOX_API_KEY`. Add `ROBLOX_UNIVERSE_ID` and `ROBLOX_PLACE_ID` as repository variables or secrets. The IDs are shown in the Creator Dashboard URL.

To publish from your Mac instead, run `bun run build:place` and then `ROBLOX_API_KEY=… ROBLOX_UNIVERSE_ID=… ROBLOX_PLACE_ID=… tools/publish-place.sh`.

## Blender aircraft

The player's Kestrel fighter and the enemy Vanta interceptor are defined by procedural Blender Python generators. Git retains those generators and the exact runtime mesh JSON; local Blender files, FBX/GLB exports, and preview renders can be regenerated for inspection. See [the aircraft asset guide](docs/aircraft-assets.md) for the complete import workflow and engine pitfalls. Regenerate the assets with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-aircraft.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-enemy-aircraft.py
```

Kestrel has 3,684 triangles and Vanta has 3,840; each uses seven material meshes. `bun run build` packages its exact vertices, faces, and corner normals as server-only data. Roblox generates reusable static mesh content from that data when the server starts, then replicates the aircraft to players. This path needs no API key or local HTTP server. The normal aircraft remains a fallback if Roblox makes mesh generation unavailable.

A realistic textured set for upload as Roblox Model assets (Kestrel, Vanta, two Vanta ace liveries and twenty world props: frigate, oil platform, harbour quay, containers, gantry crane, hangar, control tower, three city buildings, farmhouse, barn, silo, radar dish, relay mast, two trees, three rocks) is generated by `tools/assets/build-all.sh` into `assets/roblox-upload/`, each with FBX, PBR textures, four previews and a moderation checklist. Nothing is switched on until its ID is set in `src/shared/RobloxAssetIds.ts`; see [the Roblox asset pipeline](docs/roblox-asset-pipeline.md). The ten-piece military ground kit (tank, SAM, AA, artillery, bunker, radar, truck, fuel, barracks, containers) was independently reviewed and uploaded on 2026-10-31 and dresses typed ground targets through `src/shared/MilitaryGroundKit.ts`; the id ledger is [docs/qa/uploaded-assets.md](docs/qa/uploaded-assets.md) and the gate is described in the [architecture map](docs/architecture/README.md#uploaded-assets-and-the-publish-gate).

Studio's documented `CreateAssetAsync` upload route currently reports “not available yet” in this installation, so the project does not depend on that upload API. A regenerated FBX is ready for Studio's manual 3D Importer.

## Campaign validation

Read the [architecture map](docs/architecture/README.md) for where missions, worlds and tests live; [docs/broken-relay.md](docs/broken-relay.md) records the retired 27-mission campaign. Do not launch Studio, `test:roblox` or a Rojo server without the parent’s exclusive lease.

`bun run test:offline` runs the compiled pure-domain contracts in the standalone Luau CLI (set `LUAU_BIN`). It does not replace Roblox Jest or live gameplay.

### Offline and manual tools

Every offline Luau tool finds the CLI through `tools/luau-bin.ts`: `LUAU_BIN` if set, otherwise `build/offline-luau/luau`. `bun run test:audio:offline`, `bun run test:voice:offline` and `bun run test:radio:offline` (compiled FlightController → GameUI radio delivery against the real queue) run the same way as `test:offline`.

These tools are run by hand and are not part of any test script:

- `bun tools/render-hud-mock.ts [filter]` renders static HUD PNG mocks into `docs/design/` with headless Chrome (`CHROME_BIN` overrides the default macOS Chrome path).
- `Blender --background --factory-startup --python tools/assets/verify_fbx.py` round-trips every exported FBX in `assets/roblox-upload/` through Blender's importer and compares it with its checklist.

`tools/upload-audio.py`, `tools/upload-voice.py` and `tools/upload-models.py` share the journal and `audio-upload.lock` in `tools/roblox_upload.py`. Audio/voice is permanently disabled. Models use `HALT-models-3407487520`; only exact FBX/texture hashes in committed independent 10/10 APPROVE evidence are allowed. A model rejection halts model/mesh/image uploads. Unit tests use isolated state and mocked networking: `python3 -m unittest discover -s tools/tests`.

`bun run validate:offline` is the shared PR and publish gate. Install Bun 1.3.14,
Aftman 0.3.0 with the Rojo version in `aftman.toml`, Python 3.12,
ffprobe (FFmpeg), and the official
[Luau CLI 0.744](https://github.com/luau-lang/luau/releases/tag/0.744), then run
`bun install --frozen-lockfile`. Set `LUAU_BIN` to the absolute CLI path or put it
at `build/offline-luau/luau`. CI pins the Linux Luau archive by SHA-256.
The gate builds the production place once (including its eight-script voice
artifact check), runs the existing compiled domain, audio lifecycle, voice
consumer and radio delivery suites, all `tools/tests/test_*.py` tests, and both generated-document
consistency checks. Failed commands, missing summaries, or counts below the
538/10/8 contract baselines or a missing exact four-test radio summary fail validation. It never launches Studio.

PRs targeting `main` run this gate without secrets. Main pushes and manual
publishes run the same action before publishing, in the same job and checkout;
failure prevents the publish step. Both workflows ignore Markdown-only and
`docs/**`-only changes, including reports. Tests, tooling, dependencies and CI
changes trigger validation (and retain the existing main publish behavior).
Branch protection is managed separately. Offline validation does not establish
runtime/device acceptance, audible playback, or live Roblox asset permission;
Roblox Jest and human playtesting remain separate checks.
