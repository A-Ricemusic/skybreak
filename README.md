# SKYBREAK: Broken Relay

An original mobile-first arcade jet combat campaign for Roblox, written in TypeScript with roblox-ts, React Lua, and Rojo. Choose one of four persistent campaign slots and fly an original 27-mission campaign in one Roblox place. Each sortie builds its world on launch and removes it after the result.

## Controls and campaign

- Mobile: two large thumb sticks appear while using touch. Left steers; right up accelerates and down decelerates. Release recenters the knob and holds the selected throttle percentage. FIRE, TGT and the special weapon sit between the sticks.
- Desktop and console: a short control legend appears at launch; afterwards the HUD shows only actionable hints. Evade is `F` on keyboard and `B` on gamepad. Hold `LB` / `RB` to decrease / increase throttle. Menus support gamepad selection, with `B` to go back.
- Targets are selected automatically; TGT cycles contacts. Keep the selected target in range and ahead until the bracket reads LOCKED, then FIRE launches guided missiles. Early FIRE launches unguided. Incoming-missile and airspace warnings appear only while active.
- Mission 1 — First Flight: learn pitch/turn, select and destroy a ground radar, then defeat three pursuing bandits.
- Mission 2 — Iron Coast: defeat three bandits, destroy five Blender-authored warehouses while five optional raiders pursue you, then defeat a faster, tougher ace.
- Missions 3–27 follow Teal’s recordings through authored canyon, farm, relay, harbor and city compositions. Ordered flight gates, low-altitude scans, signal orbits, convoy escorts and protected-site defense accompany escalating combat.
- Opening, inter-mission and finale cinematics render three camera/story beats with subtitles, skip, pause and motion/text controls. Browse all 27 sorties, unlock sequentially and replay completed missions.
- Existing v2 saves safely resume at Mission 3 after completing the original two sorties; all four slots retain their records.
- Each mission has a server-enforced 600-second deadline. Success unlocks the next mission; failure supports retry. Required kills and completion are server-authoritative.
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

Open `build/skybreak.rbxlx` in Roblox Studio. Open the Rojo plugin in the Plugins toolbar and connect to `localhost:34872`. Publishing remains a manual Studio step for the project owner.

## Source files

- `src/server`: server scripts
- `src/client`: player scripts
- `src/shared`: shared modules
- `default.project.json`: the place structure and Rojo mappings

Run `bun run watch` in another terminal while editing TypeScript/TSX. Keep Rojo connected to sync changes into Studio. Studio edits are not automatically written back to the repository. Save code in this repository; publish the place through Studio when ready.

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

## Roblox Jest tests

Run `bun test:roblox` (or `bun run test:roblox`). Bun compiles the TypeScript, builds an isolated test place, launches authenticated Roblox Studio, and runs Jest in Roblox's Luau VM. This is not Bun's JavaScript test runner. Results are written to `build/jest-results.json`; full output is in `build/jest-output.log`.

The runner defaults to the macOS Studio executable. Set `ROBLOX_STUDIO_PATH` for another installation. Tests cover flight math, real engine instances/effects, save-slot isolation, delayed writes, and recovery from load/save errors. Test places disable normal game startup and automatic Rojo connection. Production places exclude `src/tests`.

A small checked-in Bun patch applies the upstream roblox-ts runtime registration fix needed for Jest's isolated module environments. `bun install --frozen-lockfile` applies it automatically.

For a genuine mission smoke test, launch through the menu in Studio, then run `tools/playtest-campaign.client.luau` as a client LocalScript. It uses the same flight, targeting, and missile controller methods as the touch UI (without an evade shortcut); it never changes health, damage, or kills. Live cloud saves require a published experience; unpublished Studio tests use clearly labeled session-only slots.

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

Studio's documented `CreateAssetAsync` upload route currently reports “not available yet” in this installation, so the project does not depend on that upload API. A regenerated FBX is ready for Studio's manual 3D Importer.

## Broken Relay campaign alternative

Read [the architecture, all 27 mission definitions, original assets, validation and Studio lease handoff](docs/broken-relay.md). This independent alternative completed all27 missions and28 story chapters in Studio; [the live QA report](docs/broken-relay-qa.md) records exact SHAs,171 engine tests, compact/device checks and remaining limits. Parent independent acceptance QA remains pending. Do not launch Studio, `test:roblox` or a Rojo server without the parent’s exclusive lease.

`bun run test:offline` runs the compiled pure-domain contracts in the standalone Luau CLI (set `LUAU_BIN`). It does not replace Roblox Jest or live gameplay. The original [campaign expansion proposal](docs/campaign-expansion.html) remains background design material.
