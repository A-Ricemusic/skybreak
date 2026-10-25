-- Authoritative isolated missions. Clients supply controls, never hits or results.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local FlightMath = require(Shared:WaitForChild("FlightMath"))
local JetFactory = require(Shared:WaitForChild("JetFactory"))

local CombatService = {}
local sessions = {}
local connections = {}
local missionSerial = 0
local missionRoot
local missionState
local onFinished
local FIXED_STEP = 1 / 30
local LOCK_RANGE = 2450
local LOCK_DOT = math.cos(math.rad(62))
local MAX_MISSILES = 8
local ENEMY_NAMES = { "VANTA 01", "VANTA 02", "VANTA 03" }

local function remote(remotes, name)
	if typeof(remotes) == "Instance" then
		return remotes:WaitForChild(name)
	end
	assert(remotes[name], "Missing combat remote: " .. name)
	return remotes[name]
end

local function frameFor(state)
	return CFrame.new(state.x, state.y, state.z)
		* CFrame.Angles(0, state.yaw, 0)
		* CFrame.Angles(state.pitch, 0, state.roll)
end

local function positionFor(state)
	return Vector3.new(state.x, state.y, state.z)
end

local function directionFor(state)
	local x, y, z = FlightMath.Forward(state.yaw, state.pitch)
	return Vector3.new(x, y, z)
end

local function alive(enemy)
	return enemy and enemy.health > 0 and enemy.model.Parent ~= nil
end

local function ownsEnemy(session, enemy)
	return alive(enemy) and enemy.model.Parent == session.folder and enemy.model:GetAttribute("SkybreakOwner") == session.player.UserId
end

local function targetMetrics(session, enemy)
	local delta = enemy.position - positionFor(session.state)
	local distance = delta.Magnitude
	local dot = distance > 0.01 and directionFor(session.state):Dot(delta / distance) or 1
	return distance, dot
end

local function acquireTarget(session)
	local best, score
	for _, enemy in session.enemies do
		if ownsEnemy(session, enemy) then
			local distance, dot = targetMetrics(session, enemy)
			-- Prefer an aircraft ahead, then the nearest remaining aircraft.
			local candidateScore = distance + (dot < 0 and 5000 or (1 - dot) * 700)
			if not score or candidateScore < score then
				best, score = enemy, candidateScore
			end
		end
	end
	session.target = best
	session.lockProgress = 0
end

local function cycleTarget(session)
	local current = table.find(session.enemies, session.target) or 0
	for offset = 1, #session.enemies do
		local candidate = session.enemies[(current + offset - 1) % #session.enemies + 1]
		if ownsEnemy(session, candidate) then
			session.target = candidate
			session.lockProgress = 0
			return
		end
	end
end

local function sendTelemetry(session)
	if session.player.Parent ~= Players then
		return
	end
	local incoming = false
	for _, missile in session.projectiles do
		if missile.hostile and (missile.position - positionFor(session.state)).Magnitude < 1500 then
			incoming = true
			break
		end
	end
	local target = ownsEnemy(session, session.target) and session.target or nil
	missionState:FireClient(session.player, {
		kind = "Telemetry",
		health = session.health,
		speed = session.state.speed,
		altitude = session.state.y,
		kills = session.kills,
		total = 3,
		missiles = session.missiles,
		missileCooldown = session.missileCooldown,
		evadeCooldown = session.evadeCooldown,
		target = target and target.model or nil,
		targetName = target and target.name or "",
		lockProgress = session.lockProgress,
		incoming = incoming,
		elapsed = session.elapsed,
	})
end

local function finish(session, won)
	if not session.active or session.finished then
		return
	end
	-- Guard before scheduling a potentially yielding persistence callback.
	session.finished = true
	session.active = false
	for _, missile in session.projectiles do
		missile.part:Destroy()
	end
	table.clear(session.projectiles)
	sendTelemetry(session)
	local stats = { kills = session.kills, elapsed = session.elapsed, slot = session.slot }
	task.spawn(function()
		local ok, message = pcall(onFinished, session.player, won, stats)
		if not ok then
			warn("SKYBREAK mission completion callback: " .. tostring(message))
		end
	end)
end

local function destroyEnemy(session, enemy)
	if not ownsEnemy(session, enemy) then
		return
	end
	enemy.health = 0
	enemy.model:SetAttribute("Health", 0)
	JetFactory.Burst(session.folder, enemy.position, Color3.fromRGB(255, 169, 87), 12)
	enemy.model:Destroy()
	session.kills += 1
	if session.target == enemy then
		acquireTarget(session)
	end
	if session.kills == 3 then
		finish(session, true)
	end
end

local function launchMissile(session, hostile, enemy)
	local position, direction, target
	if hostile then
		position = enemy.position
		direction = (positionFor(session.state) - position).Unit
	else
		if session.lockProgress < 0.99 or not ownsEnemy(session, session.target) then
			return
		end
		local distance, dot = targetMetrics(session, session.target)
		if session.missiles <= 0 or session.missileCooldown > 0 or distance > LOCK_RANGE or dot < LOCK_DOT then
			return
		end
		position = positionFor(session.state) + directionFor(session.state) * 16 - Vector3.new(0, 2, 0)
		direction = directionFor(session.state)
		target = session.target
		session.missiles -= 1
		session.missileCooldown = 1.15
	end
	local missile = {
		part = JetFactory.CreateMissile(session.folder, position, direction, hostile),
		position = position,
		direction = direction,
		target = target,
		hostile = hostile,
		age = 0,
	}
	table.insert(session.projectiles, missile)
end

local function evade(session)
	if session.evadeCooldown > 0 then
		return
	end
	session.evadeCooldown = 6
	session.evadeRemaining = 2.1
	JetFactory.Flares(session.folder, positionFor(session.state))
	-- A clear, useful countermeasure: all currently incoming missiles break lock.
	for index = #session.projectiles, 1, -1 do
		local missile = session.projectiles[index]
		if missile.hostile then
			JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3)
			missile.part:Destroy()
			table.remove(session.projectiles, index)
		end
	end
end

local function stepEnemies(session, dt)
	for index, enemy in session.enemies do
		if alive(enemy) then
			-- Broad patrol loops keep all three bandits in accessible airspace.
			-- Occasional shallow weaving makes the silhouettes read as aircraft.
			enemy.angle += dt * (0.19 + index * 0.012)
			local radius = 720 + index * 95
			local destination = Vector3.new(
				math.sin(enemy.angle) * radius + (index - 2) * 120,
				280 + index * 45 + math.sin(session.elapsed * 0.22 + index) * 65,
				-650 - math.cos(enemy.angle) * radius
			)
			local delta = destination - enemy.position
			local direction = delta.Magnitude > 0.01 and delta.Unit or enemy.direction
			local distance = math.min(delta.Magnitude, (170 + index * 6) * dt)
			local oldDirection = enemy.direction
			enemy.direction = oldDirection:Lerp(direction, FlightMath.DampAlpha(1.8, dt)).Unit
			enemy.position += enemy.direction * distance
			enemy.velocity = enemy.direction * (170 + index * 6)
			local bank = math.clamp(-oldDirection:Cross(enemy.direction).Y * 26, -0.6, 0.6)
			enemy.model:PivotTo(CFrame.lookAt(enemy.position, enemy.position + enemy.direction) * CFrame.Angles(0, 0, bank))
			enemy.fireTimer -= dt
			if enemy.fireTimer <= 0 then
				enemy.fireTimer = 19 + index * 2
				local separation = (enemy.position - positionFor(session.state)).Magnitude
				if separation < 1900 and separation > 240 and session.evadeRemaining <= 0 then
					launchMissile(session, true, enemy)
				end
			end
		end
	end
end

local function segmentDistance(point, startPosition, endPosition)
	local segment = endPosition - startPosition
	local lengthSquared = segment:Dot(segment)
	local t = lengthSquared > 0 and math.clamp((point - startPosition):Dot(segment) / lengthSquared, 0, 1) or 0
	return (point - (startPosition + segment * t)).Magnitude
end

local function stepMissiles(session, dt)
	for index = #session.projectiles, 1, -1 do
		local missile = session.projectiles[index]
		missile.age += dt
		local validTarget = missile.hostile or ownsEnemy(session, missile.target)
		local removed = missile.age > 8 or not validTarget
		if not removed then
			local targetPosition = missile.hostile and positionFor(session.state) or missile.target.position
			local velocity = missile.hostile and directionFor(session.state) * session.state.speed or missile.target.velocity
			local speed = missile.hostile and 420 or 650
			local distance = (targetPosition - missile.position).Magnitude
			local lead = missile.hostile and 0.1 or math.clamp(distance / speed, 0, 0.65)
			local delta = targetPosition + velocity * lead - missile.position
			if delta.Magnitude > 0.01 then
				local desired = delta.Unit
				local turnRate = missile.hostile and 1.7 or 7
				local blended = missile.direction:Lerp(desired, FlightMath.DampAlpha(turnRate, dt))
				if blended.Magnitude > 0.01 then
					missile.direction = blended.Unit
				end
			end
			local nextPosition = missile.position + missile.direction * speed * dt
			if segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile and 22 or 32) then
				removed = true
				JetFactory.Burst(session.folder, targetPosition, Color3.fromRGB(255, 179, 102), missile.hostile and 6 or 8)
				if missile.hostile then
					if session.evadeRemaining <= 0 then
						session.health = math.max(0, session.health - 16)
					end
				else
					local enemy = missile.target
					if enemy.health <= 55 then
						-- Remove this missile before the third kill clears all others.
						missile.part:Destroy()
						table.remove(session.projectiles, index)
						destroyEnemy(session, enemy)
						if not session.active then
							return
						end
						continue
					end
					enemy.health -= 55
					enemy.model:SetAttribute("Health", enemy.health)
				end
			else
				missile.position = nextPosition
				missile.part.CFrame = CFrame.lookAt(nextPosition, nextPosition + missile.direction)
			end
		end
		if removed then
			missile.part:Destroy()
			table.remove(session.projectiles, index)
		end
	end
end

local function stepSession(session, dt)
	session.elapsed += dt
	session.missileCooldown = math.max(0, session.missileCooldown - dt)
	session.evadeCooldown = math.max(0, session.evadeCooldown - dt)
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt)
	session.regen += dt
	if session.regen >= 6 then
		session.regen -= 6
		session.missiles = math.min(MAX_MISSILES, session.missiles + 1)
	end
	-- Lost focus / disconnected controls settle into safe level flight.
	if os.clock() - session.lastInput > 0.7 then
		session.input.x, session.input.y = 0, 0
	end
	FlightMath.Step(session.state, session.input, dt)
	local flightFrame = frameFor(session.state)
	if session.evadeRemaining > 0 then
		local progress = 1 - session.evadeRemaining / 2.1
		flightFrame *= CFrame.Angles(0, 0, progress * math.pi * 2)
	end
	session.aircraft:PivotTo(flightFrame)
	stepEnemies(session, dt)
	if not ownsEnemy(session, session.target) then
		acquireTarget(session)
	end
	if session.target then
		local distance, dot = targetMetrics(session, session.target)
		if distance <= LOCK_RANGE and dot >= LOCK_DOT then
			session.lockProgress = math.min(1, session.lockProgress + dt / 0.8)
		else
			session.lockProgress = math.max(0, session.lockProgress - dt * 1.6)
		end
	end
	stepMissiles(session, dt)
	if not session.active then
		return
	end
	if session.health <= 0 then
		JetFactory.Burst(session.folder, positionFor(session.state), Color3.fromRGB(255, 139, 87), 14)
		finish(session, false)
		return
	end
	session.telemetryTime += dt
	if session.telemetryTime >= 0.1 then
		session.telemetryTime -= 0.1
		sendTelemetry(session)
	end
end

function CombatService.EndMission(player)
	local session = sessions[player]
	if not session then
		return
	end
	sessions[player] = nil
	session.active = false
	if session.characterRoot and session.characterRoot.Parent then
		session.characterRoot.Anchored = session.wasAnchored
	end
	if player.Parent == Players then
		player.ReplicationFocus = session.previousReplicationFocus
	end
	session.folder:Destroy()
end

function CombatService.GetSession(player)
	return sessions[player]
end

function CombatService.StartMission(player, slot)
	if not missionState or not onFinished then
		return false, "CombatService is not initialized"
	end
	if not FlightMath.IsFinite(slot) or slot % 1 ~= 0 or slot < 1 or slot > 4 then
		return false, "Choose a save slot from 1 to 4"
	end
	if typeof(player) ~= "Instance" or not player:IsA("Player") or player.Parent ~= Players then
		return false, "Player is unavailable"
	end
	CombatService.EndMission(player)
	missionSerial += 1
	local folder = Instance.new("Folder")
	folder.Name = "Mission_" .. player.UserId .. "_" .. missionSerial
	folder.Parent = missionRoot
	local aircraft = JetFactory.Create("SKYBREAK - Kestrel", false)
	aircraft:SetAttribute("SkybreakOwner", player.UserId)
	aircraft:SetAttribute("SkybreakPlayer", true)
	aircraft.Parent = folder
	local state = FlightMath.NewState()
	aircraft:PivotTo(frameFor(state))
	local session = {
		player = player,
		slot = slot,
		folder = folder,
		aircraft = aircraft,
		state = state,
		input = { x = 0, y = 0, throttle = 0.65 },
		health = 100,
		kills = 0,
		elapsed = 0,
		missiles = MAX_MISSILES,
		missileCooldown = 0,
		evadeCooldown = 0,
		evadeRemaining = 0,
		regen = 0,
		lockProgress = 0,
		enemies = {},
		projectiles = {},
		telemetryTime = 0,
		lastInput = os.clock(),
		lastInputEvent = -math.huge,
		lastActionEvent = -math.huge,
		active = true,
		finished = false,
		previousReplicationFocus = player.ReplicationFocus,
	}
	-- Also follows the aircraft if the published place enables streaming.
	player.ReplicationFocus = aircraft.PrimaryPart
	local characterRoot = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if characterRoot then
		session.characterRoot = characterRoot
		session.wasAnchored = characterRoot.Anchored
		characterRoot.Anchored = true
	end
	for index, name in ENEMY_NAMES do
		local enemyModel = JetFactory.Create(name, true)
		enemyModel:SetAttribute("SkybreakEnemy", true)
		enemyModel:SetAttribute("SkybreakOwner", player.UserId)
		enemyModel:SetAttribute("Health", 100)
		enemyModel.Parent = folder
		local position = Vector3.new((index - 2) * 260, 270 + index * 40, 150 - index * 550)
		local direction = Vector3.new(index % 2 == 0 and 0.55 or -0.35, 0, -1).Unit
		enemyModel:PivotTo(CFrame.lookAt(position, position + direction))
		table.insert(session.enemies, {
			name = name,
			model = enemyModel,
			health = 100,
			position = position,
			direction = direction,
			velocity = direction * (170 + index * 6),
			angle = (index - 2) * 0.8,
			fireTimer = 16 + index * 5,
		})
	end
	sessions[player] = session
	acquireTarget(session)
	missionState:FireClient(player, { kind = "Started", slot = slot, aircraft = aircraft })
	sendTelemetry(session)
	return true
end

function CombatService.Init(remotes, finishedCallback)
	assert(type(finishedCallback) == "function", "CombatService.Init requires onFinished")
	-- Reinitialization is safe during development and cannot duplicate listeners.
	for _, connection in connections do
		connection:Disconnect()
	end
	table.clear(connections)
	for player in sessions do
		CombatService.EndMission(player)
	end
	onFinished = finishedCallback
	missionState = remote(remotes, "MissionState")
	missionRoot = workspace:FindFirstChild("SkybreakCombat")
	if not missionRoot then
		missionRoot = Instance.new("Folder")
		missionRoot.Name = "SkybreakCombat"
		missionRoot.Parent = workspace
	end
	table.insert(connections, remote(remotes, "FlightInput").OnServerEvent:Connect(function(player, payload)
		local session = sessions[player]
		if not session or not session.active or type(payload) ~= "table" then
			return
		end
		local now = os.clock()
		if now - session.lastInputEvent < 1 / 40 then
			return
		end
		session.lastInputEvent = now
		if not FlightMath.IsFinite(payload.x) or not FlightMath.IsFinite(payload.y) or not FlightMath.IsFinite(payload.throttle) then
			return
		end
		session.input.x = math.clamp(payload.x, -1, 1)
		session.input.y = math.clamp(payload.y, -1, 1)
		session.input.throttle = math.clamp(payload.throttle, 0, 1)
		session.lastInput = now
	end))
	table.insert(connections, remote(remotes, "CombatAction").OnServerEvent:Connect(function(player, payload)
		local session = sessions[player]
		if not session or not session.active or type(payload) ~= "table" or type(payload.action) ~= "string" then
			return
		end
		local now = os.clock()
		if now - session.lastActionEvent < 0.09 then
			return
		end
		session.lastActionEvent = now
		if payload.action == "FireMissile" then
			launchMissile(session, false)
		elseif payload.action == "Evade" then
			evade(session)
		elseif payload.action == "CycleTarget" then
			cycleTarget(session)
		end
	end))
	table.insert(connections, Players.PlayerRemoving:Connect(CombatService.EndMission))
	local accumulator = 0
	table.insert(connections, RunService.Heartbeat:Connect(function(dt)
		-- Bound catch-up work after stalls; no giant teleport or missile steps.
		accumulator = math.min(accumulator + dt, FIXED_STEP * 5)
		while accumulator >= FIXED_STEP do
			accumulator -= FIXED_STEP
			for _, session in sessions do
				if session.active then
					stepSession(session, FIXED_STEP)
				end
			end
		end
	end))
end

return CombatService
