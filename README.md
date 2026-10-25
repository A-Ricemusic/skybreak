# SKYBREAK: Operation Glass Horizon

An original mobile-first arcade jet combat campaign for Roblox, written in TypeScript with roblox-ts, React Lua, and Rojo. Choose one of four persistent campaign slots, launch from Glass Horizon Airbase, and destroy all three hostile aircraft to complete the operation.

## Controls and campaign

- Mobile: use the on-screen flight pad, throttle, missile, evade, and target controls.
- Desktop: use the keyboard/mouse controls shown by the in-game HUD.
- Missiles require a target lock. Incoming-missile warnings and evade cooldowns appear in telemetry.
- Victory is server-authoritative and occurs only after all three enemy aircraft are destroyed.
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

For a genuine mission smoke test, launch through the menu in Studio, then run `tools/playtest-flight.client.luau` as a client LocalScript. It uses the same flight, missile, and evade controller methods as the touch UI; it never changes health, damage, or kills. Live cloud saves require a published experience; unpublished Studio tests use clearly labeled session-only slots.

## Blender aircraft

The original Kestrel fighter lives in `assets/aircraft/kestrel.blend`, with FBX/GLB exports and preview renders alongside it. Regenerate the assets with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-aircraft.py
```

The export contains 3,684 triangles across seven material meshes. `bun run build` packages its exact vertices, faces, and corner normals as server-only data. Roblox generates reusable static mesh content from that data when the server starts, then replicates the aircraft to players. This path needs no API key or local HTTP server. The normal aircraft remains a fallback if Roblox makes mesh generation unavailable.

Studio's documented `CreateAssetAsync` upload route currently reports “not available yet” in this installation, so the project does not depend on that upload API. The FBX is also ready for Studio's manual 3D Importer.
