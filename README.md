# SKYBREAK: Operation Glass Horizon

An original mobile-first arcade jet combat campaign for Roblox, managed with Rojo. Choose one of four persistent campaign slots, launch from Glass Horizon Airbase, and destroy all three hostile aircraft to complete the operation.

## Controls and campaign

- Mobile: use the on-screen flight pad, throttle, missile, evade, and target controls.
- Desktop: use the keyboard/mouse controls shown by the in-game HUD.
- Missiles require a target lock. Incoming-missile warnings and evade cooldowns appear in telemetry.
- Victory is server-authoritative and occurs only after all three enemy aircraft are destroyed.
- Published experiences save four slots to DataStore; an unpublished local Studio file clearly uses session-only saves.

## Setup

Install [Aftman](https://github.com/LPGhatguy/aftman), then run:

```sh
aftman install
rojo plugin install
mkdir -p build
rojo build -o build/test-game.rbxlx
rojo serve
```

Open `build/test-game.rbxlx` in Roblox Studio. Open the Rojo plugin in the Plugins toolbar and connect to `localhost:34872`. Publishing remains a manual Studio step for the project owner.

## Source files

- `src/server`: server scripts
- `src/client`: player scripts
- `src/shared`: shared modules
- `default.project.json`: the place structure and Rojo mappings

Edit these files and keep Rojo connected to sync changes into Studio. Studio edits are not automatically written back to the repository. Save code in this repository; publish the place through Studio when ready.

## Automatic connection on this Mac

For development without clicking Studio's Rojo UI, install the companion plugin:

```sh
python3 tools/install-rojo-connect.py
```

The companion packages the installed official Rojo client's modules and connects only when the place contains this project's `GameConfig` and the server reports this project's name. It retries disconnected sessions and does not run during playtests. Restart the place after installing it.

Launch the place directly if macOS's file association opens the Studio home screen:

```sh
/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio --task EditFile --localPlaceFile "$PWD/build/test-game.rbxlx"
```

Keep `rojo serve` running in a separate terminal. The companion's state is available through `CoreGui.PhoneGameRojoStatus` in Studio. To remove the companion, delete `~/Documents/Roblox/Plugins/PhoneGameRojoConnect.rbxm` and restart Studio.
