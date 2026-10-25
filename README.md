# Test Game Coding From Phone

A Roblox starter place managed with Rojo. Includes a baseplate, spawn point, and starter Luau scripts.

## Setup

Install [Aftman](https://github.com/LPGhatguy/aftman), then run:

```sh
aftman install
rojo plugin install
mkdir -p build
rojo build -o build/test-game.rbxlx
rojo serve
```

Open `build/test-game.rbxlx` in Roblox Studio. Open the Rojo plugin in the Plugins toolbar and connect to `localhost:34872`.

## Source files

- `src/server`: server scripts
- `src/client`: player scripts
- `src/shared`: shared modules
- `default.project.json`: the place structure and Rojo mappings

Edit these files and keep Rojo connected to sync changes into Studio. Studio edits are not automatically written back to the repository. Save code in this repository; publish the place through Studio when ready.
