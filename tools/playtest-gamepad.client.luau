-- Inject as a normal LocalScript after launching a mission through the UI.
-- Tests the actual CAS handler, NOT Roblox's engine/hardware gamepad routing.
assert(game:GetService("RunService"):IsStudio(), "Studio only")
local player = game.Players.LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
assert(controller and controller.active, "Launch a mission first")
local old = player.PlayerGui:FindFirstChild("SkybreakGamepadQA")
assert(not old or old:GetAttribute("Outcome") ~= "Running", "QA already running")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakGamepadQA"
report:SetAttribute("Transport", "Shared controller handler; not hardware/engine injection")
report:SetAttribute("Outcome", "Running")
report.Parent = player.PlayerGui
local function send(key, state, position)
	controller:SimulateGamepadInput(key, state, position or Vector3.zero)
end
local function tap(key)
	send(key, Enum.UserInputState.Begin)
	send(key, Enum.UserInputState.End)
end
local connection = game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(state)
	if state.kind == "Completed" or state.kind == "Failed" then
		report:SetAttribute("MissionOutcome", state.kind)
		report:SetAttribute("Kills", state.kills)
	end
end)
task.spawn(function()
	local ok, message = xpcall(function()
		local initial = controller:GetControlStateForStudio().throttle
		send(Enum.KeyCode.ButtonL1, Enum.UserInputState.Begin)
		task.wait(0.4)
		send(Enum.KeyCode.ButtonL1, Enum.UserInputState.End)
		local slower = controller:GetControlStateForStudio().throttle
		assert(slower < initial - 0.05, "LB failed to lower throttle")
		task.wait(0.2)
		assert(math.abs(controller:GetControlStateForStudio().throttle - slower) < 0.001, "LB stuck after release")
		send(Enum.KeyCode.ButtonR1, Enum.UserInputState.Begin)
		task.wait(0.4)
		send(Enum.KeyCode.ButtonR1, Enum.UserInputState.End)
		assert(controller:GetControlStateForStudio().throttle > slower + 0.05, "RB failed to raise throttle")
		report:SetAttribute("ThrottlePassed", true)
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(0.05, 0, 0))
		assert(controller:GetControlStateForStudio().stick.Magnitude == 0, "Deadzone failed")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(0.5, 0.25, 0))
		assert(controller:GetControlStateForStudio().stick.X == 0.5, "Analog stick failed")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Cancel, Vector3.new(0.5, 0.25, 0))
		assert(controller:GetControlStateForStudio().stick.Magnitude == 0, "Cancel did not neutralize stick")
		report:SetAttribute("StickPassed", true)
		local target = controller:GetTelemetry().target
		tap(Enum.KeyCode.ButtonY)
		task.wait(0.3)
		assert(controller:GetTelemetry().target ~= target, "Y did not cycle target")
		report:SetAttribute("TargetPassed", true)
		tap(Enum.KeyCode.ButtonB)
		task.wait(0.3)
		assert(controller:GetTelemetry().evadeCooldown > 0, "B did not evade")
		report:SetAttribute("EvadePassed", true)
		local started, lastFire, missileCommands = os.clock(), 0, 0
		while controller.active and os.clock() - started < 150 do
			local telemetry = controller:GetTelemetry()
			local aircraft, enemy = controller.aircraft, telemetry.target
			if aircraft and enemy and enemy.Parent then
				local frame = aircraft:GetPivot()
				local delta = enemy:GetPivot().Position - frame.Position
				if delta.Magnitude > 1 then
					local desiredYaw = math.atan2(-delta.X, -delta.Z)
					local yaw = math.atan2(-frame.LookVector.X, -frame.LookVector.Z)
					local angle = (desiredYaw - yaw + math.pi) % (2 * math.pi) - math.pi
					local pitch = math.asin(math.clamp(delta.Unit.Y, -1, 1))
					send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(math.clamp(-angle * 2, -1, 1), math.clamp(pitch / 0.62, -1, 1), 0))
					local throttle = controller:GetControlStateForStudio().throttle
					local desired = delta.Magnitude > 1500 and 0.9 or 0.2
					send(Enum.KeyCode.ButtonL1, throttle > desired + 0.03 and Enum.UserInputState.Begin or Enum.UserInputState.End)
					send(Enum.KeyCode.ButtonR1, throttle < desired - 0.03 and Enum.UserInputState.Begin or Enum.UserInputState.End)
				end
			end
			if telemetry.lockProgress >= 0.99 and telemetry.missileCooldown <= 0 and os.clock() - lastFire > 1.2 then
				tap(Enum.KeyCode.ButtonR2)
				lastFire = os.clock()
				missileCommands += 1
				report:SetAttribute("MissileCommands", missileCommands)
			end
			report:SetAttribute("Health", telemetry.health)
			task.wait(0.1)
		end
		task.wait(0.3)
		assert(report:GetAttribute("MissionOutcome") == "Completed", "Mission did not complete via simulated gamepad")
		report:SetAttribute("Outcome", "Passed")
	end, debug.traceback)
	-- Release every held control on success, failure, or timeout.
	for _, key in {Enum.KeyCode.ButtonL1, Enum.KeyCode.ButtonR1, Enum.KeyCode.Thumbstick1} do
		send(key, Enum.UserInputState.End)
	end
	connection:Disconnect()
	if not ok then report:SetAttribute("Outcome", "Failed"); report:SetAttribute("Error", tostring(message)) end
	print("SKYBREAK gamepad QA", report:GetAttributes())
end)
