# Mission 1 measurement

Measured source: `127d13e77af6d0622224d94de9369e42e199b65f` (PR #111).
These projects deliberately exclude campaign startup and never publish/upload.

1. Check `pgrep -x RobloxStudio`; stop if another agent's GUI is present.
2. At the measured revision, `bun install && bun run build`.
3. `rojo build tools/spikes/m01-measure.project.json -o build/m01-measure.rbxlx`.
4. Launch Studio with `--task RunScript --localPlaceFile <absolute place> --runScriptFile <absolute tools/spikes/m01-cold.luau> --outputFile <absolute build/log> --quitAfterExecution`.
5. Repeat in a fresh process for another cold sample. The second call per process is warm (retained module/asset cache). Clearing terrain does not flush engine caches. Capture `M01_MEASURE:` JSON.
6. Build `m01-play.project.json` to a different unpublished place. Start one-client Play. The paired scripts call the same builder, move the camera/anchored avatar along the entire reserved composition route at 160 then 600 studs/s, and dwell at city/airbase. Capture `M01_CLIENT:` and `M01_MEASURE:` JSON from Output. No production jet/combat/controller is included.
7. For the emulator, in Edit call `game:GetService("StudioDeviceSimulatorService"):SetDeviceAsync("samsung_galaxy_a16")`, set `Workspace.M01StationsOnly=true` to skip the already-tested desktop routes, then repeat Play. Restore `default` after stopping Play.
8. Use Studio MCP `screen_capture` for the actual viewport (OS desktop capture may show only wallpaper with CLI Studio). Save image data in gitignored `build/`; never commit images.
9. Close only Studio processes you launched; verify with `pgrep -x RobloxStudio`.

`Measure` temporarily wraps `TerrainWriter.Write` to time its original implementation, restoring it afterwards. Total includes plan construction, environment, async template-load kickoff, terrain, primitive parts and cached prop placement. Terrain is writer wall time including schedule construction and waits; `WorldTerrainReadySeconds` also includes preceding plan/environment work. After-terrain is the builder's remaining part/prop/effect phase. Module imports and clearing/2 s settling are outside the timer. Heartbeat gap is an interval proxy including initialization and engine scheduling, not a renderer frame. Stats MB includes Studio/plugin/cache overhead and is not separate server/client allocation. Counted voxel writes are scheduled filled-cell volume, not unique occupied cells. Ray success is terrain availability, not rendered visibility.
