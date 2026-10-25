# Controller QA without physical hardware

## Twin-stick review corrections

The independent Astra review found three boundary-size layout defects. The
navigation widget now applies both the position and dimensions chosen by the
layout, with two contained text rows. Short roots reserve separate navigation,
warning and toast lanes, and narrow roots retain enough space between both
sticks for the action pair. The smaller action sizes remain active until the
larger targets fit below the warning row.

The corrected Studio suite passes 261 tests across 23 suites, including 176
width/height combinations around the action, spacing and short-height
breakpoints. These verify hit areas, navigation, warnings and toasts together.
The earlier simulated-touch evidence below still applies to input handling;
the layout corrections have not been retested on a physical phone.

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

## Twin-stick touch QA (2026-10-25)

Touch now uses two 96px sticks. Left steers; right up/down adjusts selected
throttle with the existing RS 18% vertical deadzone and 40 percentage points/sec
rate. Neutral/release holds the selection and recenters the knob. The percent
readout and UP / ACCEL, DOWN / SLOW labels replace the tap +/- pill. FIRE/TGT/
SPECIAL occupy the lane between sticks, with a stacked arrangement in portrait.
Extremely short safe roots (under 176px) use 44px action buttons while preserving
both 96px sticks. CoreUISafeInsets still supplies the safe root bounds.

Each stick owns one independent InputObject. Extra fingers cannot take over a
held stick; ending/cancelling one leaves the other held. Per-touch state signals
and global end/cancel handling release ownership. Focus loss, text entry, Roblox
menu opening, mission exit/death, viewport changes and accepted input-mode changes
clear touch axes and recenter both knobs. Hybrid mode changes wait until both
owned touches release. The controller updates throttle in its existing render
step without a new per-frame allocation or React state update; the existing
10Hz HUD sampler refreshes percent text. Keyboard/gamepad mappings, server
validation, targeting and flight physics are unchanged.

To reproduce controller checks, launch a mission through the normal menu, then
inject `tools/playtest-touch-throttle.client.luau` as a normal client LocalScript.
Inspect `PlayerScripts.SkybreakTwinStickQA` for `Outcome="Passed"`. It checks up,
down, neutral, deadzone, independent steering and actual TextBox focus cleanup.
It uses the production touch controller API below GUI dispatch. Run alone, with
no other input driver. The script makes throttle headroom using legal held-axis
input when rerun after a full-power drag; it does not teleport, change health,
award kills or alter server mission state.

Live production Play used normal menu clicks and the iPhone 13 simulator.
Measured safe roots: landscape 749x330 and portrait 388x704. Normal mouse-driven
simulated-touch drags moved the right knob to -30px, produced axis 0.9191 and
increased throttle; down decreased selection from 100% to 81.29%; release gave
axis 0, centered the knob and held selection. A normal left-stick drag also
moved its knob, independently of the new throttle UI. The corrected controller
harness passed at initial 63.26%, final 63.11%, including neutral and focus tests.
The custom compact device measured 319x161, exposing a shorter safe root than
the previous 319x181 matrix; layout tests now cover both plus 320x160 and 560x161.

Automated engine tests exercise both touch begin/release orders, extra fingers,
single-owner cancellation semantics, reset/reacquisition, throttle deadzone/rate
and viewport separation. These are shared ownership/layout tests, not two real
fingers dispatched by the engine. Public VirtualInput has no touch injection;
VirtualInputManager:SendTouchEvent was rejected with "lacking capability
RobloxScript". No physical phone, simultaneous physical multitouch, published
server, thumb reach or device performance claim is made. Test phone interaction
with both sticks held, a third finger on actions, OS interruption and orientation
changes before accepting physical-device behavior.

Final validation: `bun run test:roblox` passed **260/260 tests, 23/23 suites**
in the isolated Studio CLI test place (16.708 seconds). An earlier CLI launch
timed out before execution with several Studio instances open; full-suite runs
in an existing Edit session also passed before the compact-root expansion.
`bun run build:place` and `git diff --check` passed. Production mapping excludes
test modules.
