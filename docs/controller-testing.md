# Controller QA without physical hardware

`tools/playtest-gamepad.client.luau` is a Studio-only automated flight test. It drives the **same bound-input handler** as ContextActionService: left stick, LB/RB throttle, Y target selection, B evade, and R2 missiles. Damage, lock, ammunition, enemies, and victory remain server-authoritative. It does not set health or kills.

## Run

1. Build with `bun run build:place`, open the place, and start Play.
2. Use the real menu to select a slot and launch a mission.
3. In the Client DataModel, create an unparented normal LocalScript, set its Source to the contents of `tools/playtest-gamepad.client.luau`, then parent it under `Players.LocalPlayer.PlayerScripts`. Do not directly execute the body in the MCP plugin context: that context has a different module cache. The harness allows up to 10 seconds for mission activation, reacquiring the controller on every attempt, then up to 5 seconds for initial target telemetry. Use a fresh mission with no kills or evade cooldown.
4. Read `Players.LocalPlayer.PlayerGui.SkybreakGamepadQA:GetAttributes()`. Success requires `Outcome="Passed"`, `MissionOutcome="Completed"`, `Kills=3`, and `ReadinessPassed`, `ThrottlePassed`, `StickPassed`, `TargetPassed`, `EvadePassed`, `MissilePassed`, and `CleanupPassed` all true. `MissilePassed` requires a server-reported ammunition decrease or missile cooldown after R2.
5. Stop Play to discard the QA LocalScript. Never add it to the production Rojo mapping. Do not run alongside another flight driver or human input.

The report exists before controller readiness is checked. A readiness timeout produces `Outcome="Failed"`, `Phase="Readiness"`, and `FailureKind="ReadinessTimeout"`. Other failures include the failing `Phase` and an `Error` traceback; a flight timeout uses `FailureKind="MissionTimeout"`. Flight is bounded to 150 seconds after the mapping checks, with a separate 10-second window for the final server result, since persistence can yield.

On failure or completion, cleanup independently attempts to release every simulated control and disconnect the mission listener. A cleanup exception is reported in `CleanupError` and prevents success. `SimulateGamepadInput` and `GetControlStateForStudio` reject calls outside Studio. The simulation accepts only bound gamepad controls and finite, clamped axes, and returns the shared handler's result so the harness can detect ignored input (for example, while a text box is focused). Live controller input and simulation share one handler, including stick deadzone, button release, and cancellation.

## Coverage and limits

- A passing run verifies: game control mapping after engine dispatch, analog deadzone/clamping/end/cancel, held LB/RB throttle and release, RB cancellation, Y/B remote actions, R2 server response, and a real three-kill mission. The driver steers and changes throttle through simulated stick/LB/RB only, fires with R2, and evades incoming missiles with B.
- Console layout can be checked separately with `StudioDeviceSimulatorService:SetDeviceAsync("xbox")`; this connects an emulated gamepad and sets PreferredInput to Gamepad. Stop with `StopSimulationAsync()`.
- **Not claimed:** physical hardware, Bluetooth/USB, engine event dispatch, vibration, or engine-driven gamepad menu selection. Those need the interactive Controller Emulator or a real controller.
- Roblox's public `VirtualInput:SendKey` is keyboard input, even with a gamepad KeyCode. Do not report it as genuine gamepad input. Direct `VirtualInputManager` gamepad injection is RobloxScript-secured and is not used.

## Validation (2026-10-24)

`bun run build` and standalone Luau compilation of the built controller and harness passed. In Studio, injecting the harness with no mission produced the expected `ReadinessTimeout` report after 10 seconds, with cleanup successful. Two subsequent menu-launched missions passed every report check with three server-reported kills and health 100: one injected after activation with Xbox simulation, and one injected 1.5 seconds before the launch click to exercise the original readiness race. The latter also ran with Xbox simulation after launch. The runs issued 9 and 7 R2 commands respectively; these count commands, not accepted missiles. Gamepad1 connection and `PreferredInput=Gamepad` were observed. Device simulation was reset and Play stopped afterward.

References: [Controller Emulator](https://create.roblox.com/docs/studio/controller-emulator), [VirtualInput](https://create.roblox.com/docs/reference/engine/classes/VirtualInput), [Device Simulator API](https://create.roblox.com/docs/reference/engine/classes/StudioDeviceSimulatorService).
