-- Studio-only QA driver. Launch a sortie through the real menu first, then run
-- this in the Client DataModel. It drives the same controls as the touch HUD;
-- damage, locks, cooldowns, enemies and campaign results remain authoritative.
assert(game:GetService("RunService"):IsStudio(), "QA driver is Studio-only")
local player = game:GetService("Players").LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
local readyDeadline = os.clock() + 30
while (not controller or not controller.active) and os.clock() < readyDeadline do
 task.wait(0.1)
 controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
end
assert(controller and controller.active, "Mission readiness timeout")
local survivalOnly = script:GetAttribute("SurvivalOnly") == true -- Allows a genuine deadline/failure run.
local old = player.PlayerGui:FindFirstChild("SkybreakCampaignQA")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakCampaignQA"
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
 report:SetAttribute("MissionId", state.missionId)
 report:SetAttribute("GroundKills", state.groundKills)
 report:SetAttribute("Reason", state.reason)
	end
end)
task.spawn(function()
	local started, lastFire, lastCycle = os.clock(), 0, 0
 local phase, phaseStarted = "", os.clock()
	while controller.active and os.clock() - started < 630 do
		local telemetry = controller:GetTelemetry()
		if telemetry.phase ~= phase then
 phase, phaseStarted = telemetry.phase, os.clock()
 report:SetAttribute("Phase", phase)
 print("SKYBREAK campaign phase", phase, telemetry.elapsed)
 end
 local aircraft, target = controller.aircraft, telemetry.target
		if phase == "tutorial_move" then
 controller:SetThrottle(0.2)
 controller:SetInput(os.clock()-phaseStarted > 3 and 0.35 or 0, os.clock()-phaseStarted > 3 and 0.3 or 0)
 elseif phase == "tutorial_target" then
 controller:SetInput(0,0)
 if os.clock()-phaseStarted > 3 then controller:CycleTarget() end
 elseif aircraft and aircraft.Parent and target and target.Parent then
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
		if not survivalOnly and phase ~= "tutorial_move" and phase ~= "tutorial_target" and os.clock()-phaseStarted > 3 and telemetry.lockProgress >= 0.99 and telemetry.missileCooldown <= 0 and os.clock() - lastFire > 1.2 then
			controller:FireMissile()
			lastFire = os.clock()
			report:SetAttribute("MissileCommands", report:GetAttribute("MissileCommands") + 1)
		end
        if telemetry.targetRequired == false and telemetry.target and os.clock()-lastCycle > 0.4 then
            controller:CycleTarget()
            lastCycle = os.clock()
        end

		report:SetAttribute("Kills", telemetry.kills)
		report:SetAttribute("Health", telemetry.health)
 report:SetAttribute("GroundKills", telemetry.groundKills)
 report:SetAttribute("Elapsed", telemetry.elapsed)
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
