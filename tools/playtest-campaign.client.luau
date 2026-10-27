-- Studio-only pilot using the same flight, target, and missile methods as the HUD.
-- Inject as a normal client LocalScript before launch or during a mission.
-- No target, health, damage, clock, kill, or result overrides are used.
assert(game:GetService("RunService"):IsStudio(), "QA driver is Studio-only")
local player = game:GetService("Players").LocalPlayer
local FlightController = require(player.PlayerScripts.Client.FlightController).FlightController
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
local controller = FlightController.GetActive()
local readyDeadline = os.clock() + 30
while (not controller or not controller.active) and os.clock() < readyDeadline do
	task.wait(0.1)
	controller = FlightController.GetActive()
end
assert(controller and controller.active, "Mission readiness timeout")
local missionTimeLimit = require(game.ReplicatedStorage.Shared.GameConfig).GameConfig.Campaign.MissionTimeLimit
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
		local expectedGround = state.missionId == 2 and 5 or 1
		local minimumAir = state.missionId == 2 and 4 or 3
		report:SetAttribute("ResultValid", state.groundKills == expectedGround and state.kills >= minimumAir and state.elapsed < missionTimeLimit)
	elseif survivalOnly then
		report:SetAttribute("ResultValid", state.reason == "timeout" and state.elapsed >= missionTimeLimit)
	end
end)

task.spawn(function()
	local started, lastFire, lastCycle = os.clock(), 0, 0
	local phase, phaseStarted = "", os.clock()
	local extendUntil = 0
	while controller.active and os.clock() - started < missionTimeLimit + 30 do
		local telemetry = controller:GetTelemetry()
		if telemetry.phase ~= phase then
			phase, phaseStarted = telemetry.phase, os.clock()
			report:SetAttribute("Phase", phase)
			print("SKYBREAK campaign phase", phase, telemetry.elapsed)
		end
		local aircraft, target = controller.aircraft, telemetry.target
		if phase == "tutorial_move" then
			-- The stick is a pitch rate: alternate nose up/down so the teaching step never loops or stalls.
			local teach = os.clock() - phaseStarted
			controller:SetThrottle(0.5)
			controller:SetInput(teach > 3 and 0.35 or 0, teach > 3 and (math.floor(teach / 1.5) % 2 == 0 and 0.3 or -0.3) or 0)
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
				-- Extend in a gentle climb (the stick is a rate: steer to 6 degrees, not "hold 0.1").
				controller:SetInput(steerToward(controller, frame, frame.LookVector + Vector3.new(0, 0.1, 0)))
				controller:SetThrottle(0.65)
			elseif delta.Magnitude > 1 then
				controller:SetInput(steerToward(controller, frame, delta))
				controller:SetThrottle(delta.Magnitude > 1500 and 0.9 or 0.45)
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
