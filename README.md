# EMBERS OF HOME

An original mobile-first 27-mission arcade flight campaign for Roblox, written in TypeScript with roblox-ts, React Lua, and Rojo. A civilian rescue pilot becomes a combat pilot after losing Caldera, then chooses protecting civilians over revenge. Four persistent save slots support unlocks and replay in one Roblox place; every sortie builds its authored world on launch and disposes it after the debrief.

## Controls and campaign

- Mobile: the flight pad, throttle, fire, and target controls appear only while you are using touch.
- Desktop and console: a short control legend appears at launch; afterwards the HUD shows only actionable hints. Evade is `F` on keyboard and `B` on gamepad. Hold `LB` / `RB` to decrease / increase throttle. Menus support gamepad selection, with `B` to go back.
- Missiles require a target lock, shown on the target bracket. Incoming-missile and airspace warnings appear only while active.
- Mission 1 preserves the tutorial contract: learn pitch/turn, target and destroy a radar with a missile, then defeat three bandits.
- Mission 2 preserves the escalation contract: three bandits, five Blender-authored warehouses with five optional raiders, then a faster 165-HP ace.
- Missions 3–27 span rescue, escort, defense, strike, interception, survival, elite and multi-stage chapter finales from warm Caldera to the stormy Iron North.
- Every mission has an opening cinematic and debrief cinematic with rendered camera shots, subtitles, skip, and reduced-motion camera mode.
- Every mission has a server-enforced 600-second deadline. Success unlocks the next mission; failure supports retry. Damage, kills, phases, deadlines and completion are server-authoritative.
- Published experiences save four slots to DataStore; an unpublished local Studio file clearly uses session-only saves.

The full mission manifest, architecture, performance bounds and playtest protocol are in [docs/embers-of-home.md](docs/embers-of-home.md).

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

For a genuine mission smoke test, launch through the menu in Studio, then run `tools/playtest-campaign.client.luau` as a client LocalScript. It uses the same flight, targeting, missile, and evade controller methods as the touch UI; it never changes health, damage, kills, clocks, locks, objectives, or results. Live cloud saves require a published experience; unpublished Studio tests use clearly labeled session-only slots.

Ground-target creation and the no-key Studio mesh workflow are documented in [mission-assets.md](docs/mission-assets.md).

## Blender aircraft

The player's Kestrel fighter and the enemy Vanta interceptor are defined by procedural Blender Python generators. Git retains those generators and the exact runtime mesh JSON; local Blender files, FBX/GLB exports, and preview renders can be regenerated for inspection. See [the aircraft asset guide](docs/aircraft-assets.md) for the complete import workflow and engine pitfalls. Regenerate the assets with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-aircraft.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-enemy-aircraft.py
```

Kestrel has 3,684 triangles and Vanta has 3,840; each uses seven material meshes. `bun run build` packages its exact vertices, faces, and corner normals as server-only data. Roblox generates reusable static mesh content from that data when the server starts, then replicates the aircraft to players. This path needs no API key or local HTTP server. The normal aircraft remains a fallback if Roblox makes mesh generation unavailable.

Studio's documented `CreateAssetAsync` upload route currently reports “not available yet” in this installation, so the project does not depend on that upload API. A regenerated FBX is ready for Studio's manual 3D Importer.

## Campaign expansion

Open [the interactive 27-mission architecture guide](docs/campaign-expansion.html) in a browser for the single-place/chapter-place tradeoffs, world lifecycle, skybox design, performance validation, save migration, and mission concepts. It is a design proposal, not implemented campaign content.
