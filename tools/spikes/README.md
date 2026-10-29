# Large-world Studio spike (never a production place)

Build from the repository root with `bun run build`, then
`rojo build tools/spikes/large-world.project.json -o build/large-world-spike.rbxlx`.
Check `pgrep -x RobloxStudio` before launching Studio; respect the exclusive lease.
Open **only** that generated throwaway place. No asset uploads are required.

In Edit, run `large-world-budget.luau` via Studio's RunScript CLI or the Studio MCP
`execute_luau` tool. For MCP, wrap the file in `task.spawn(function() ... end)` so
the request can return while generation yields. Wait for `LARGE_WORLD:...complete`
before another measurement. All scripts clear Terrain. The Workspace attribute
`LargeWorldSpike=true` is an isolation guard, not a reason to run in a real place.

Then run `large-world-lod-measure.luau` and `large-world-props.luau` sequentially.
For the coastal-city density comparison set `Workspace.SpikeBuildingsPer8k`
(attribute) to 50 before the props probe; remove it afterward. The default is 6.
The former retains the full island footprint, using 64-stud columns inside the
central 7168-stud square and 256-stud columns outside. These are geometric
sampling distances; native voxels remain 4 studs. The initial `core-and-flat`
control shrinks the island and therefore does **not** validate full-scale LOD.

For Play, the project includes paired client/server scripts. From Edit call
`game:GetService("StudioTestService"):ExecutePlayModeAsync({extent=8000})`.
Run extents 8000, 16000, 24000 and 35000 with Workspace.StreamingEnabled false
and true (change only in Edit). For the phone comparison first activate
`StudioDeviceSimulatorService:SetDeviceAsync("samsung_galaxy_a16")`, then repeat.
`large-world-play.luau` automates this matrix and restores the prior simulator
profile afterward. The client measures RenderStepped,
terrain ray availability at/600 studs ahead of a 600-stud/s camera/avatar route,
and Stats memory. This is a streaming probe, not the production flight controller
or a visual pop-in verdict; it does not simulate a real phone's GPU or network.

Capture JSON lines prefixed `LARGE_WORLD`, `LARGE_WORLD_LOD`,
`LARGE_WORLD_PROPS` and `LARGE_WORLD_CLIENT`; retain the exact source revision,
Studio version and machine. Studio's aggregate Stats memory is not isolated
server/client heap attribution. Stop Play and close every Studio process started.
