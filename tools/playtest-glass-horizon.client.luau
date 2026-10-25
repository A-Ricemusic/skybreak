-- Studio lease REQUIRED. Install as a normal LocalScript under PlayerScripts.
-- Launch each mission through the real campaign UI. This pilot stays installed
-- across all 27 launches, records authoritative results, and drives only the
-- public flight stick, throttle, target, fire and evade controller methods.
-- It never sets position, health, timer, kills, unlocks, success or save data.
assert(game:GetService("RunService"):IsStudio(), "QA pilot is Studio-only")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local FlightController = require(player.PlayerScripts.Client.FlightController).FlightController
local MissionCatalog = require(game.ReplicatedStorage.Shared.MissionCatalog).MissionCatalog
local remotes = game.ReplicatedStorage.Remotes
local old = player.PlayerGui:FindFirstChild("GlassHorizonQA")
if old then old:Destroy() end
local reports = Instance.new("Folder")
reports.Name = "GlassHorizonQA"
reports:SetAttribute("CompletedCount", 0)
reports.Parent = player.PlayerGui
local current, runNumber, lastFire, lastCycle, lastEvade = nil, 0, 0, 0, 0
local phaseKey, phaseStarted, extendUntil, missionStarted = "", 0, 0, 0
local telemetry = nil
local lastSample = 0
local samples = {}
local function begin(state)
	runNumber += 1
	current = Instance.new("Folder")
	current.Name = string.format("Mission%02d_Run%02d", state.missionId, runNumber)
	current:SetAttribute("Outcome", "Running")
	current:SetAttribute("MissionId", state.missionId)
	current:SetAttribute("MissileCommands", 0)
	current:SetAttribute("EvadeCommands", 0)
	current.Parent = reports
	phaseKey, phaseStarted, extendUntil, missionStarted = "", os.clock(), 0, os.clock()
	telemetry = nil
	samples = {}; lastSample = 0
end
local stateConnection = remotes.MissionState.OnClientEvent:Connect(function(state)
	if state.kind == "Started" then begin(state)
	elseif state.kind == "Telemetry" then telemetry = state
	elseif (state.kind == "Completed" or state.kind == "Failed") and current then
		current:SetAttribute("Outcome", state.kind)
		current:SetAttribute("Samples",game:GetService("HttpService"):JSONEncode(samples))
		for _,field in {"kills","groundKills","elapsed","reason","persistence"} do current:SetAttribute(field,state[field]) end
		local definition = MissionCatalog:Get(state.missionId)
		local valid = state.kind == "Completed" and state.elapsed > 0 and state.elapsed < 600
			and state.kills >= MissionCatalog:RequiredAirKills(definition)
			and state.groundKills == MissionCatalog:RequiredGroundKills(definition)
		current:SetAttribute("ResultValid", valid)
		if valid then reports:SetAttribute("CompletedCount", reports:GetAttribute("CompletedCount") + 1) end
		print("GLASS HORIZON QA", state.missionId, state.kind, state.kills, state.groundKills, state.elapsed)
		local finishedReport = current
		task.delay(2,function()
			if not finishedReport.Parent then return end
			local root = workspace:FindFirstChild("SkybreakCombat")
			finishedReport:SetAttribute("RemainingMissionFolders", root and #root:GetChildren() or 0)
		end)
	end
end)
local controller = FlightController.GetActive()
if controller and controller.active then begin({missionId=controller:GetTelemetry().missionId}) end
while reports.Parent do
	controller = FlightController.GetActive()
	if controller and controller.active and current and os.clock() - missionStarted < 630 then
		local state = controller:GetTelemetry()
		local key = tostring(state.phaseIndex) .. ":" .. tostring(state.phase)
		if key ~= phaseKey then
			phaseKey,phaseStarted,extendUntil = key,os.clock(),0
			current:SetAttribute("Phase", key)
			print("GLASS HORIZON QA PHASE",state.missionId,key,state.elapsed)
		end
		local aircraft = controller.aircraft
		local target = state.target
		local nav = state.navigation
		local navigation = state.phase == "recon_route" or state.phase == "escort_convoy"
		-- Recon/escort are positional objectives, not kill gates. Fly to their
		-- navigation actor, then orbit the moving convoy inside its cover radius.
		local aim = navigation and nav or target
		if state.phase == "tutorial_move" then
			controller:SetThrottle(0.2)
			controller:SetInput(0.35,0.3)
		elseif state.phase == "tutorial_target" then
			controller:SetInput(0,0)
			if os.clock() - phaseStarted > 1 and os.clock() - lastCycle > 0.3 then controller:CycleTarget();lastCycle=os.clock() end
		elseif aircraft and aircraft.Parent and aim and aim.Parent then
			local frame = aircraft:GetPivot()
			local goal = aim:GetPivot().Position
			if state.phase == "escort_convoy" then goal += Vector3.new(0,230,0) end
			local delta = goal-frame.Position
			if state.phase == "escort_convoy" and delta.Magnitude < 700 then
				controller:SetInput(0.8,math.clamp((300-frame.Position.Y)/250,-0.5,0.5))
				controller:SetThrottle(0)
			else
				if not navigation and state.targetKind == "ground" and delta.Magnitude < 400 and os.clock() >= extendUntil then extendUntil=os.clock()+3 end
				if os.clock() < extendUntil then controller:SetInput(0,0.1);controller:SetThrottle(0.6)
				elseif delta.Magnitude > 1 then
					local desiredYaw = math.atan2(-delta.X,-delta.Z)
					local yaw = math.atan2(-frame.LookVector.X,-frame.LookVector.Z)
					local angle = (desiredYaw-yaw+math.pi)%(2*math.pi)-math.pi
					local pitch = math.asin(math.clamp(delta.Unit.Y,-1,1))
					controller:SetInput(math.clamp(-angle*2,-1,1),math.clamp(pitch/0.62,-1,1))
					controller:SetThrottle(delta.Magnitude>1500 and 0.85 or 0.15)
				end
			end
		else
			-- Pursuit survives by maneuvering; the real clock remains untouched.
			controller:SetInput(0.45,aircraft and math.clamp((420-aircraft:GetPivot().Position.Y)/350,-0.3,0.3) or 0)
			controller:SetThrottle(0.6)
		end
		if script:GetAttribute("SurvivalOnly") ~= true and not navigation and os.clock()>=extendUntil and state.lockProgress>=0.99 and state.missileCooldown<=0 and os.clock()-lastFire>1.16 then
			controller:FireMissile();lastFire=os.clock()
			current:SetAttribute("MissileCommands",current:GetAttribute("MissileCommands")+1)
		end
		if not navigation and state.targetRequired==false and state.target and os.clock()-lastCycle>0.35 then controller:CycleTarget();lastCycle=os.clock() end
		if script:GetAttribute("NoEvade") ~= true and script:GetAttribute("SurvivalOnly") ~= true and state.incoming and state.evadeCooldown<=0 and os.clock()-lastEvade>6 then
			controller:Evade();lastEvade=os.clock();current:SetAttribute("EvadeCommands",current:GetAttribute("EvadeCommands")+1)
		end
		for _,field in {"health","kills","groundKills","elapsed","assetHealth"} do current:SetAttribute(field,state[field]) end
		if os.clock() - lastSample >= 1 then
			lastSample = os.clock()
			local pos = aircraft and aircraft:GetPivot().Position or Vector3.zero
			local navPos = nav and nav:GetPivot().Position
			table.insert(samples,{elapsed=state.elapsed,phase=state.phase,phaseIndex=state.phaseIndex,progress=state.objectiveProgress,total=state.objectiveTotal,health=state.health,assetHealth=state.assetHealth,kills=state.kills,ground=state.groundKills,x=pos.X,y=pos.Y,z=pos.Z,navDistance=navPos and (navPos-pos).Magnitude,lock=state.lockProgress})
		end
	end
	task.wait(0.075)
end
stateConnection:Disconnect()
