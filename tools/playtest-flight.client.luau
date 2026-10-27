-- Studio-only QA driver. Launch a sortie through the real menu first, then run
-- this in the Client DataModel. It drives the same controls as the touch HUD;
-- damage, locks, cooldowns, enemies and campaign results remain authoritative.
assert(game:GetService("RunService"):IsStudio(), "QA driver is Studio-only")
local player = game:GetService("Players").LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
-- The stick commands pitch and turn RATES (the jet holds its attitude when centred),
-- so aim by closing the loop on the predicted nose through the shared pilot.
local Pilot = require(game:GetService("ReplicatedStorage").Shared.NavigationPilot).NavigationPilot
local function steerToward(controller, frame, delta, maxPitch)
	local state = controller:GetFlightState()
	if not state then
		local look = frame.LookVector
		state = { yaw = math.atan2(-look.X, -look.Z), pitch = math.asin(math.clamp(look.Y, -1, 1)), roll = 0 }
	end
	local limit = maxPitch or 0.6
	return Pilot:Steer(state, math.atan2(-delta.X, -delta.Z), math.clamp(math.asin(math.clamp(delta.Unit.Y, -1, 1)), -limit, limit))
end
assert(controller and controller.active, "Launch a mission through the menu first")
local survivalOnly = script:GetAttribute("SurvivalOnly") == true
local old = player.PlayerGui:FindFirstChild("SkybreakPlaytest")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakPlaytest"
report:SetAttribute("Outcome", "Running")
report:SetAttribute("MissileCommands", 0)
report:SetAttribute("EvadeCommands", 0)
report.Parent = player.PlayerGui
local finishedConnection = game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(state)
	if state.kind == "Completed" or state.kind == "Failed" then
		report:SetAttribute("Outcome", state.kind)
		report:SetAttribute("Kills", state.kills)
		report:SetAttribute("Elapsed", state.elapsed)
		report:SetAttribute("Persistence", state.persistence)
	end
end)
task.spawn(function()
	local started, lastFire, lastEvade = os.clock(), 0, 0
	while controller.active and os.clock() - started < 180 do
		local telemetry = controller:GetTelemetry()
		local aircraft, target = controller.aircraft, telemetry.target
		if aircraft and aircraft.Parent and target and target.Parent then
			local frame = aircraft:GetPivot()
			local delta = target:GetPivot().Position - frame.Position
			if delta.Magnitude > 1 then
				controller:SetInput(steerToward(controller, frame, delta))
				controller:SetThrottle(delta.Magnitude > 1500 and 0.9 or 0.45)
			end
		end
		if not survivalOnly and telemetry.lockProgress >= 0.99 and telemetry.missileCooldown <= 0 and os.clock() - lastFire > 1.2 then
			controller:FireMissile()
			lastFire = os.clock()
			report:SetAttribute("MissileCommands", report:GetAttribute("MissileCommands") + 1)
		end
		if not survivalOnly and telemetry.incoming and telemetry.evadeCooldown <= 0 and os.clock() - lastEvade > 6 then
			controller:Evade()
			lastEvade = os.clock()
			report:SetAttribute("EvadeCommands", report:GetAttribute("EvadeCommands") + 1)
		end
		report:SetAttribute("Kills", telemetry.kills)
		report:SetAttribute("Health", telemetry.health)
		task.wait(0.1)
	end
	controller:SetInput(0, 0)
	task.wait(1)
	if report:GetAttribute("Outcome") == "Running" then
		report:SetAttribute("Outcome", controller.active and "TimedOut" or "Stopped")
	end
	finishedConnection:Disconnect()
	print("SKYBREAK playtest:", report:GetAttribute("Outcome"), report:GetAttribute("Kills"))
end)
return "Genuine flight-control playtest started"
