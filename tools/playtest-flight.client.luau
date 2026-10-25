-- Studio-only QA driver. Launch a sortie through the real menu first, then run
-- this in the Client DataModel. It drives the same controls as the touch HUD;
-- damage, locks, cooldowns, enemies and campaign results remain authoritative.
assert(game:GetService("RunService"):IsStudio(), "QA driver is Studio-only")
local player = game:GetService("Players").LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).GetActive()
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
				local desiredYaw = math.atan2(-delta.X, -delta.Z)
				local yaw = math.atan2(-frame.LookVector.X, -frame.LookVector.Z)
				local errorAngle = (desiredYaw - yaw + math.pi) % (2 * math.pi) - math.pi
				local pitch = math.asin(math.clamp(delta.Unit.Y, -1, 1))
				controller:SetInput(math.clamp(-errorAngle * 2, -1, 1), math.clamp(pitch / 0.62, -1, 1))
				controller:SetThrottle(delta.Magnitude > 1500 and 0.9 or 0.2)
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
