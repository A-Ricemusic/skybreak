-- Studio-only mission 5 QA pilot (added only by build-m05-place.ts). Starts mission 5 through the same
-- CampaignRequest the briefing's LAUNCH sends, then flies it with the normal controller methods only:
-- stick, throttle, TGT, FIRE, SPECIAL, EVADE, SKIP and the TAKEOFF / CHANGE WEAPON answer.
-- It never edits aircraft CFrames, health, damage, timers, progress or results.
assert(game:GetService("RunService"):IsStudio(), "QA pilot is Studio-only")
local player = game:GetService("Players").LocalPlayer
local RS = game:GetService("ReplicatedStorage")
local FlightController = require(player:WaitForChild("PlayerScripts"):WaitForChild("Client"):WaitForChild("FlightController")).FlightController
local Pilot = require(RS.Shared.NavigationPilot).NavigationPilot
local Catalog = require(RS.Shared.MissionCatalog).MissionCatalog
local Remotes = RS:WaitForChild("Remotes")
local report = Instance.new("Folder"); report.Name = "M05QA"; report.Parent = player.PlayerScripts
local function log(kind, text)
	local v = Instance.new("StringValue"); v.Name = string.format("%04d_%s", #report:GetChildren() + 1, kind); v.Value = text; v.Parent = report
	print("M05_QA " .. kind .. " " .. text)
end
local bp = Catalog:Get(5)
local rearm = bp.phases[1].rearm
local touch = rearm.landing.touchdown
local gate = Vector3.new(touch.x, touch.y + rearm.landing.approachDistance * math.tan(math.rad(rearm.landing.glideDegrees)), touch.z - rearm.landing.approachDistance)
local rig = Vector3.new(9600, 1300, -7500)
local refinery = Vector3.new(-8900, 1300, -7000)
-- Mode from Edit (ReplicatedStorage attribute M05QAMode): "full", "rearm_first", or "menu" (rearm first; the menu is
-- left to controller input so a gamepad-only pass can be checked).
local mode = RS:GetAttribute("M05QAMode") or script:GetAttribute("Mode") or "full"
local rearmed, rearmTarget, menuAnswered = false, nil, false
local lastFire, lastCycle, lastEvade, lastSpecial = 0, 0, 0, 0
Remotes.MissionState.OnClientEvent:Connect(function(m)
	if typeof(m) ~= "table" then return end
	local k = m.kind
	if k == "RearmStarted" or k == "RearmMenu" or k == "RearmTakeoff" or k == "RearmComplete" or k == "CutInStarted" or k == "CutInComplete"
		or k == "Started" or k == "FlightControl" or k == "Completed" or k == "Failed" or k == "Loading" then
		local extra = ""
		if k == "Completed" or k == "Failed" then extra = string.format(" elapsed=%s kills=%s ground=%s optional=%s phases=%s reason=%s score=%s rank=%s saved=%s", tostring(m.elapsed), tostring(m.kills), tostring(m.groundKills), tostring(m.optionalKills), tostring(m.completedPhases), tostring(m.reason), tostring(m.score), tostring(m.rank), tostring(m.saved)) end
		if k == "RearmTakeoff" or k == "RearmMenu" then extra = " special=" .. tostring(m.special) end
		if k == "CutInStarted" then extra = " subjects=" .. tostring(#m.subjects) end
		log("Event", k .. extra)
		if k == "RearmComplete" then rearmed = true end
	end
end)
-- Wait for the campaign to load, then launch exactly like the briefing's LAUNCH (retrying the request budget).
task.wait(4)
local launched = false
local difficulty = script:GetAttribute("Difficulty") or "easy"
for _ = 1, 30 do
	local ok, response = pcall(function() return Remotes.CampaignRequest:InvokeServer("StartMission", { slot = 1, missionId = 5, special = "salvo", difficulty = difficulty }) end)
	log("Launch", tostring(ok) .. " " .. (typeof(response) == "table" and tostring(response.ok) .. " " .. tostring(response.error or "") or tostring(response)))
	if ok and typeof(response) == "table" and response.ok then launched = true; break end
	task.wait(3)
end
local function state(c) return c:GetFlightState() end
local function fly(c, point, orbit, radius)
	local input = Pilot:Controls(state(c), { x = point.X, y = point.Y, z = point.Z }, radius or 1800, orbit, nil)
	c:SetInput(input.x, input.y); c:SetThrottle(input.throttle)
end
local lastPhase, lastPoints = "", -1
while launched do
	local c = FlightController.GetActive()
	if c and c.active and c:GetFlightState() then
		local t = c:GetTelemetry(); local now = os.clock(); local phase = t.phase or ""
		if phase ~= lastPhase then log("Phase", phase .. " elapsed=" .. string.format("%.1f", t.elapsed or 0) .. " time=" .. string.format("%.1f", t.timeRemaining or 0)); lastPhase = phase end
		if t.missionPoints and math.floor(t.missionPoints / 250) ~= math.floor(lastPoints / 250) then log("Points", tostring(t.missionPoints) .. " elapsed=" .. string.format("%.1f", t.elapsed or 0)); end
		lastPoints = t.missionPoints or lastPoints
		local rs = c:RearmStatus(); local cut = c:CutInStatus()
		if cut then
			-- Let the cut-in play in full (captions are logged once).
		elseif rs then
			if rs.menu and not menuAnswered and mode ~= "menu" then menuAnswered = true; task.wait(2); log("Menu", "CHANGE WEAPON -> lance"); c:RearmTakeoff("lance") end
		elseif phase == "return_line" then
			local p = state(c); fly(c, Vector3.new(p.x, 520, 11000), false, 400)
		else
			local wantRearm = not rearmed and (((mode == "rearm_first" or mode == "menu") and (t.elapsed or 0) > 20) or (t.missionPoints or 0) >= 2000)
			if wantRearm then
				local p = state(c)
				-- Come down the approach from the north: a pre-gate point, then the gate itself.
				if not rearmTarget or (rearmTarget == "pre" and (Vector3.new(p.x, p.y, p.z) - (gate - Vector3.new(0, -40, 2200))).Magnitude < 350) then rearmTarget = rearmTarget == "pre" and "gate" or "pre" end
				if rearmTarget == "gate" and p.z > gate.Z + 400 then rearmTarget = "pre" end
				fly(c, rearmTarget == "pre" and gate - Vector3.new(0, -40, 2200) or gate, false, 60)
			else
				-- Stand off high (outside the AA's 1,500-stud reach) and fire from ground lock range (2,450).
				-- Once rearmed above the goal, loiter over the sea near the base until the clock runs out.
				local loiter = rearmed and (t.missionPoints or 0) >= 2000
				local site = loiter and Vector3.new(2400, 1300, 4000) or rig
				local target = t.target; local hasTarget = target and target.Parent
				fly(c, site, true, loiter and 1500 or 2200)
				if t.lockProgress and t.lockProgress >= .99 and (t.missileCooldown or 1) <= 0 and now - lastFire > 1.2 then c:FireMissile(); lastFire = now end
				if (t.specialCharges or 0) > 0 and hasTarget and t.targetKind == "ground" and now - lastSpecial > 6 then c:Special(); lastSpecial = now end
				if (not hasTarget or (t.lockProgress or 0) < .05) and now - lastCycle > 2 then c:CycleTarget(); lastCycle = now end
			end
		end
		if not rs and not cut and t.incoming and (t.evadeCooldown or 1) <= 0 and now - lastEvade > 2.5 then c:Evade(); lastEvade = now end
	end
	task.wait(1 / 30)
end
