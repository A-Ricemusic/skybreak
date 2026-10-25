# Controller QA without physical hardware

`tools/playtest-gamepad.client.luau` is a Studio-only automated flight test. It drives the **same bound-input handler** as ContextActionService: left stick, LB/RB throttle, Y target selection, B evade, and R2 missiles. Damage, lock, ammunition, enemies, and victory remain server-authoritative. It does not set health or kills.

## Run

1. Build with `bun run build:place`, open the place, and start Play.
2. Use the real menu to select a slot and launch a mission.
3. In the Client DataModel, create a normal LocalScript under `Players.LocalPlayer.PlayerScripts`, set its Source to the contents of `tools/playtest-gamepad.client.luau`, then parent it. Do not directly execute the body in the MCP plugin context: that context has a different module cache.
4. Read `Players.LocalPlayer.PlayerGui.SkybreakGamepadQA:GetAttributes()`. Success requires `Outcome="Passed"`, `MissionOutcome="Completed"`, `Kills=3`, and throttle/stick/target/evade checks all true.
5. Stop Play to discard the QA LocalScript. Never add it to the production Rojo mapping. Do not run alongside another flight driver or human input.

The test releases held controls on failure or completion and reports timeouts as failures. `SimulateGamepadInput` and `GetControlStateForStudio` reject calls outside Studio. The simulation accepts only bound gamepad controls and finite, clamped axes. Live controller input and simulation share one handler, including stick deadzone, button release, and cancellation.

## Coverage and limits

- Verified by this harness: game control mapping after engine dispatch, analog deadzone/cancel, held throttle/release, remote actions, and a real three-kill mission.
- Console layout can be checked separately with `StudioDeviceSimulatorService:SetDeviceAsync("xbox")`; this connects an emulated gamepad and sets PreferredInput to Gamepad. Stop with `StopSimulationAsync()`.
- **Not claimed:** physical hardware, Bluetooth/USB, engine event dispatch, vibration, or engine-driven gamepad menu selection. Those need the interactive Controller Emulator or a real controller.
- Roblox's public `VirtualInput:SendKey` is keyboard input, even with a gamepad KeyCode. Do not report it as genuine gamepad input. Direct `VirtualInputManager` gamepad injection is RobloxScript-secured and is not used.

References: [Controller Emulator](https://create.roblox.com/docs/studio/controller-emulator), [VirtualInput](https://create.roblox.com/docs/reference/engine/classes/VirtualInput), [Device Simulator API](https://create.roblox.com/docs/reference/engine/classes/StudioDeviceSimulatorService).
