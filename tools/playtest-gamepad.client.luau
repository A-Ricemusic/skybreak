-- Inject as a normal LocalScript around mission launch through the UI.
-- Tests the shared CAS handler AFTER engine dispatch, NOT hardware/engine routing.
assert(game:GetService("RunService"):IsStudio(), "Studio only")
local player = game:GetService("Players").LocalPlayer
local playerGui = player:WaitForChild("PlayerGui", 10)
assert(playerGui, "PlayerGui did not become available")
local old = playerGui:FindFirstChild("SkybreakGamepadQA")
assert(not old or old:GetAttribute("Outcome") ~= "Running", "QA already running")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakGamepadQA"
report:SetAttribute("Transport", "Shared controller handler; not hardware/engine injection")
report:SetAttribute("Outcome", "Running")
report:SetAttribute("Phase", "Readiness")
report:SetAttribute("MissileCommands", 0)
report:SetAttribute("EvadeCommands", 0)
report.Parent = playerGui
local controller, connection
local controls = {
	Enum.KeyCode.ButtonL1, Enum.KeyCode.ButtonR1, Enum.KeyCode.Thumbstick1,
	Enum.KeyCode.ButtonY, Enum.KeyCode.ButtonB, Enum.KeyCode.ButtonR2,
}
local function send(key, state, position)
	assert(controller.active, "Mission stopped during " .. report:GetAttribute("Phase"))
	assert(controller:SimulateGamepadInput(key, state, position or Vector3.zero) == Enum.ContextActionResult.Sink,
		"Controller ignored input; close text entry and keep the mission active")
end
local function tap(key)
	send(key, Enum.UserInputState.Begin)
	send(key, Enum.UserInputState.End)
end
local function waitForCheck(seconds, predicate, message)
	local deadline = os.clock() + seconds
	repeat
		if predicate() then return end
		assert(controller.active, "Mission stopped during " .. report:GetAttribute("Phase"))
		task.wait(0.05)
	until os.clock() >= deadline
	error(message)
end

task.spawn(function()
	local ok, message = xpcall(function()
		-- GetActive can exist before MissionStarted activates it. Reacquire it on
		-- every attempt, including when the UI replaces the controller instance.
		local deadline = os.clock() + 10
		local controllerClass, missionState
		repeat
			local scripts = player:FindFirstChild("PlayerScripts")
			local client = scripts and scripts:FindFirstChild("Client")
			local module = client and client:FindFirstChild("FlightController")
			if module and not controllerClass then controllerClass = require(module).FlightController end
			local candidate = controllerClass and controllerClass.GetActive()
			local remotes = game:GetService("ReplicatedStorage"):FindFirstChild("Remotes")
			missionState = remotes and remotes:FindFirstChild("MissionState")
			if candidate and candidate.active and candidate.aircraft and candidate.aircraft.Parent and missionState then
				controller = candidate
				break
			end
			task.wait(0.05)
		until os.clock() >= deadline
		if not controller then
			report:SetAttribute("FailureKind", "ReadinessTimeout")
			error("Readiness timed out after 10 seconds: launch a mission through the menu and wait for its aircraft")
		end
		report:SetAttribute("ReadinessPassed", true)
		connection = missionState.OnClientEvent:Connect(function(state)
			if type(state) == "table" and (state.kind == "Completed" or state.kind == "Failed") then
				report:SetAttribute("MissionOutcome", state.kind)
				report:SetAttribute("Kills", state.kills)
			end
		end)
		report:SetAttribute("Phase", "Telemetry")
		waitForCheck(5, function()
			local telemetry = controller:GetTelemetry()
			return telemetry.elapsed > 0 and telemetry.target and telemetry.target.Parent
		end, "Initial target telemetry did not arrive within 5 seconds")
		assert(controller:GetTelemetry().kills == 0, "Run QA in a fresh three-target mission")

		report:SetAttribute("Phase", "Throttle")
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
		local faster = controller:GetControlStateForStudio().throttle
		assert(faster > slower + 0.05, "RB failed to raise throttle")
		task.wait(0.2)
		assert(math.abs(controller:GetControlStateForStudio().throttle - faster) < 0.001, "RB stuck after release")
		send(Enum.KeyCode.ButtonR1, Enum.UserInputState.Begin)
		send(Enum.KeyCode.ButtonR1, Enum.UserInputState.Cancel)
		task.wait(0.2)
		assert(math.abs(controller:GetControlStateForStudio().throttle - faster) < 0.001, "RB stuck after cancellation")
		report:SetAttribute("ThrottlePassed", true)

		report:SetAttribute("Phase", "Stick")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(0.05, 0, 0))
		assert(controller:GetControlStateForStudio().stick.Magnitude == 0, "Deadzone failed")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(0.5, 0.25, 0))
		local stick = controller:GetControlStateForStudio().stick
		assert(stick.X == 0.5 and stick.Y == 0.25, "Analog stick failed")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.End, Vector3.new(0.5, 0.25, 0))
		assert(controller:GetControlStateForStudio().stick.Magnitude == 0, "End did not neutralize stick")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(2, -2, 0))
		stick = controller:GetControlStateForStudio().stick
		assert(stick.X == 1 and stick.Y == -1, "Simulation axes were not clamped")
		send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Cancel, Vector3.new(0.5, 0.25, 0))
		assert(controller:GetControlStateForStudio().stick.Magnitude == 0, "Cancel did not neutralize stick")
		report:SetAttribute("StickPassed", true)

		report:SetAttribute("Phase", "Target")
		local target = controller:GetTelemetry().target
		tap(Enum.KeyCode.ButtonY)
		waitForCheck(3, function()
			local selected = controller:GetTelemetry().target
			return selected and selected.Parent and selected ~= target
		end, "Y did not cycle target within 3 seconds")
		report:SetAttribute("TargetPassed", true)
		report:SetAttribute("Phase", "Evade")
		assert(controller:GetTelemetry().evadeCooldown <= 0, "Evade was already cooling down; use a fresh mission")
		tap(Enum.KeyCode.ButtonB)
		report:SetAttribute("EvadeCommands", 1)
		waitForCheck(3, function() return controller:GetTelemetry().evadeCooldown > 0 end, "B did not evade within 3 seconds")
		report:SetAttribute("EvadePassed", true)

		report:SetAttribute("Phase", "Mission")
		local started, lastFire, lastEvade = os.clock(), -math.huge, os.clock()
		local missilesBeforeShot
		while controller.active and not report:GetAttribute("MissionOutcome") and os.clock() - started < 150 do
			local telemetry = controller:GetTelemetry()
			if missilesBeforeShot and (telemetry.missiles < missilesBeforeShot or telemetry.missileCooldown > 0) then
				report:SetAttribute("MissilePassed", true)
				missilesBeforeShot = nil
			end
			report:SetAttribute("Health", telemetry.health)
			report:SetAttribute("Kills", telemetry.kills)
			if telemetry.kills == 3 then break end
			local aircraft, enemy = controller.aircraft, telemetry.target
			if aircraft and aircraft.Parent and enemy and enemy.Parent then
				local frame = aircraft:GetPivot()
				local delta = enemy:GetPivot().Position - frame.Position
				if delta.Magnitude > 1 then
					-- LS commands pitch/turn rates: close the loop on the predicted nose via the shared pilot.
					local Pilot = require(game:GetService("ReplicatedStorage").Shared.NavigationPilot).NavigationPilot
					local look = frame.LookVector
					local state = controller:GetFlightState() or { yaw = math.atan2(-look.X, -look.Z), pitch = math.asin(math.clamp(look.Y, -1, 1)), roll = 0 }
					local stickX, stickY = Pilot:Steer(state, math.atan2(-delta.X, -delta.Z), math.clamp(math.asin(math.clamp(delta.Unit.Y, -1, 1)), -0.6, 0.6))
					send(Enum.KeyCode.Thumbstick1, Enum.UserInputState.Change, Vector3.new(stickX, stickY, 0))
					local throttle = controller:GetControlStateForStudio().throttle
					local desired = delta.Magnitude > 1500 and 0.9 or 0.45
					send(Enum.KeyCode.ButtonL1, throttle > desired + 0.03 and Enum.UserInputState.Begin or Enum.UserInputState.End)
					send(Enum.KeyCode.ButtonR1, throttle < desired - 0.03 and Enum.UserInputState.Begin or Enum.UserInputState.End)
				end
			else
				for _, key in {Enum.KeyCode.ButtonL1, Enum.KeyCode.ButtonR1, Enum.KeyCode.Thumbstick1} do
					send(key, Enum.UserInputState.End)
				end
			end
			if telemetry.lockProgress >= 0.99 and telemetry.missiles > 0 and telemetry.missileCooldown <= 0 and os.clock() - lastFire > 1.2 then
				missilesBeforeShot = telemetry.missiles
				tap(Enum.KeyCode.ButtonR2)
				lastFire = os.clock()
				report:SetAttribute("MissileCommands", report:GetAttribute("MissileCommands") + 1)
			end
			if telemetry.incoming and telemetry.evadeCooldown <= 0 and os.clock() - lastEvade > 6 then
				tap(Enum.KeyCode.ButtonB)
				lastEvade = os.clock()
				report:SetAttribute("EvadeCommands", report:GetAttribute("EvadeCommands") + 1)
			end
			task.wait(0.1)
		end
		if controller.active and controller:GetTelemetry().kills < 3 and not report:GetAttribute("MissionOutcome") then
			report:SetAttribute("FailureKind", "MissionTimeout")
			error("Mission did not finish within 150 seconds of simulated gamepad flight")
		end
		-- Persistence can yield before the final MissionState arrives. Release now,
		-- then give the server a separate bounded window to report the result.
		for _, key in controls do controller:SimulateGamepadInput(key, Enum.UserInputState.End) end
		report:SetAttribute("Phase", "MissionResult")
		local resultDeadline = os.clock() + 10
		while not report:GetAttribute("MissionOutcome") and os.clock() < resultDeadline do task.wait(0.05) end
		assert(report:GetAttribute("MissionOutcome") == "Completed", "Server did not report Completed within the result window")
		assert(report:GetAttribute("Kills") == 3, "Server completion did not report three kills")
		assert(report:GetAttribute("MissilePassed") == true, "No server missile response was observed after R2")
	end, debug.traceback)
	-- Try every release even if another release fails, then always disconnect.
	local cleanupErrors = {}
	if controller then
		for _, key in controls do
			local released, releaseError = pcall(function() controller:SimulateGamepadInput(key, Enum.UserInputState.End) end)
			if not released then table.insert(cleanupErrors, tostring(releaseError)) end
		end
	end
	if connection then
		local disconnected, disconnectError = pcall(function() connection:Disconnect() end)
		if not disconnected then table.insert(cleanupErrors, tostring(disconnectError)) end
	end
	report:SetAttribute("CleanupPassed", #cleanupErrors == 0)
	if #cleanupErrors > 0 then report:SetAttribute("CleanupError", table.concat(cleanupErrors, "\n")) end
	if not ok or #cleanupErrors > 0 then
		if not report:GetAttribute("FailureKind") then
			report:SetAttribute("FailureKind", ok and "CleanupFailed" or "CheckFailed")
		end
		report:SetAttribute("Error", ok and "Control cleanup failed" or tostring(message))
		report:SetAttribute("Outcome", "Failed")
	else
		report:SetAttribute("Phase", "Finished")
		report:SetAttribute("Outcome", "Passed")
	end
	print("SKYBREAK gamepad QA", report:GetAttributes())
end)
