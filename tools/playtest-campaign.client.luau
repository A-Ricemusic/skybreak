-- Studio-only pilot using the same flight, target, and missile methods as the HUD.
-- Inject as a normal client LocalScript before launch or during a mission.
-- No target, health, damage, clock, kill, or result overrides are used.
assert(game:GetService("RunService"):IsStudio(), "QA driver is Studio-only")
local player = game:GetService("Players").LocalPlayer
local FlightController = require(player.PlayerScripts.Client.FlightController).FlightController
local MissionCatalog = require(game.ReplicatedStorage.Shared.MissionCatalog)
local controller = FlightController.GetActive()
local readyDeadline = os.clock() + 30
while (not controller or not controller.active) and os.clock() < readyDeadline do
	task.wait(0.1)
	controller = FlightController.GetActive()
end
assert(controller and controller.active, "Mission readiness timeout")
local survivalOnly = script:GetAttribute("SurvivalOnly") == true
local old = player.PlayerGui:FindFirstChild("SkybreakCampaignQA")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakCampaignQA"
report:SetAttribute("Outcome", "Running")
report:SetAttribute("MissileCommands", 0)
report:SetAttribute("EvadeCommands", 0)
report.Parent = player.PlayerGui
local finishedConnection = game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(state)
	if state.kind ~= "Completed" and state.kind ~= "Failed" then return end
	for _, key in { "Kills", "Elapsed", "Persistence", "MissionId", "GroundKills", "Reason" } do
		local field = string.lower(string.sub(key, 1, 1)) .. string.sub(key, 2)
		report:SetAttribute(key, state[field])
	end
	report:SetAttribute("Outcome", state.kind)
	if state.kind == "Completed" then
		local definition = MissionCatalog.getMission(state.missionId)
		local expectedGround = MissionCatalog.requiredGround(definition)
		local minimumAir = MissionCatalog.requiredAir(definition)
		report:SetAttribute("RequiredGround", expectedGround)
		report:SetAttribute("RequiredAir", minimumAir)
		report:SetAttribute("ResultValid", state.groundKills >= expectedGround and state.kills >= minimumAir and state.elapsed > 0 and state.elapsed < 600)
	elseif survivalOnly then
		report:SetAttribute("ResultValid", state.reason == "timeout" and state.elapsed >= 600)
	end
end)

task.spawn(function()
	local started, lastFire, lastCycle, lastEvade = os.clock(), 0, 0, 0
	local phase, phaseStarted = "", os.clock()
	local extendUntil = 0
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
			controller:SetInput(os.clock() - phaseStarted > 3 and 0.35 or 0, os.clock() - phaseStarted > 3 and 0.3 or 0)
		elseif phase == "tutorial_target" then
			controller:SetInput(0, 0)
			if os.clock() - phaseStarted > 3 then controller:CycleTarget() end
		elseif aircraft and aircraft.Parent and target and target.Parent then
			local frame = aircraft:GetPivot()
			local delta = target:GetPivot().Position - frame.Position
			-- Extend a close ground pass before turning back. Circling inside the
			-- turn radius can keep the target just outside the launch cone.
			if telemetry.targetKind == "ground" and delta.Magnitude < 450 and os.clock() >= extendUntil then
				extendUntil = os.clock() + 4
			end
			if os.clock() < extendUntil then
				controller:SetInput(0, 0.1)
				controller:SetThrottle(0.65)
			elseif delta.Magnitude > 1 then
				local desiredYaw = math.atan2(-delta.X, -delta.Z)
				local yaw = math.atan2(-frame.LookVector.X, -frame.LookVector.Z)
				local errorAngle = (desiredYaw - yaw + math.pi) % (2 * math.pi) - math.pi
				local pitch = math.asin(math.clamp(delta.Unit.Y, -1, 1))
				controller:SetInput(math.clamp(-errorAngle * 2, -1, 1), math.clamp(pitch / 0.62, -1, 1))
				controller:SetThrottle(delta.Magnitude > 1500 and 0.9 or 0.2)
			end
		end
		if os.clock() >= extendUntil and not survivalOnly and phase ~= "tutorial_move" and phase ~= "tutorial_target"
			and os.clock() - phaseStarted > 3 and telemetry.lockProgress >= 0.99
			and telemetry.missileCooldown <= 0 and os.clock() - lastFire > 1.2 then
			controller:FireMissile()
			lastFire = os.clock()
			report:SetAttribute("MissileCommands", report:GetAttribute("MissileCommands") + 1)
		end
		if telemetry.targetRequired == false and telemetry.target and os.clock() - lastCycle > 0.4 then
			controller:CycleTarget()
			lastCycle = os.clock()
		end
		if not survivalOnly and telemetry.incoming and telemetry.evadeCooldown <= 0 and os.clock() - lastEvade > 1 then
			controller:Evade()
			lastEvade = os.clock()
			report:SetAttribute("EvadeCommands", report:GetAttribute("EvadeCommands") + 1)
		end
		report:SetAttribute("Kills", telemetry.kills)
		report:SetAttribute("Health", telemetry.health)
		report:SetAttribute("GroundKills", telemetry.groundKills)
		report:SetAttribute("Elapsed", telemetry.elapsed)
		report:SetAttribute("Objective", telemetry.objective)
		report:SetAttribute("ObjectiveProgress", telemetry.objectiveProgress)
		report:SetAttribute("ObjectiveTotal", telemetry.objectiveTotal)
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
