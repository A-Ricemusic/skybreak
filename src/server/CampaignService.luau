local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local GameConfig = require(ReplicatedStorage.Shared.GameConfig)

local CampaignService = {}

local SLOT_COUNT = GameConfig.Campaign.SlotCount
local MISSION_KILLS = GameConfig.Campaign.MissionKills
local LOAD_TIMEOUT = 20
local REQUEST_INTERVAL = 0.12
local MAX_DATASTORE_ATTEMPTS = 3

local profileStore
local states = {}
local remotes
local combatService
local initialized = false

local function isFinite(value)
	return typeof(value) == "number" and value == value and math.abs(value) < math.huge
end

local function isValidSlot(value)
	return isFinite(value) and value % 1 == 0 and value >= 1 and value <= SLOT_COUNT
end

local function blankSlot()
	return {
		occupied = false,
		completed = false,
		kills = 0,
	}
end

local function normalizeSlot(raw)
	local slot = blankSlot()
	if type(raw) ~= "table" then
		return slot
	end

	local rawKills = if isFinite(raw.kills) then math.floor(raw.kills) else 0
	slot.kills = math.clamp(rawKills, 0, MISSION_KILLS)
	slot.completed = raw.completed == true
	slot.occupied = raw.occupied == true or slot.completed or slot.kills > 0

	if isFinite(raw.bestTime) and raw.bestTime > 0 then
		slot.bestTime = raw.bestTime
		slot.occupied = true
	end
	if isFinite(raw.updatedAt) and raw.updatedAt > 0 then
		slot.updatedAt = math.floor(raw.updatedAt)
		slot.occupied = true
	end

	return slot
end

local function blankProfile()
	local slots = table.create(SLOT_COUNT)
	for index = 1, SLOT_COUNT do
		slots[index] = blankSlot()
	end
	return {
		version = GameConfig.Campaign.SaveVersion,
		slots = slots,
	}
end

local function normalizeProfile(raw)
	local profile = blankProfile()
	if type(raw) ~= "table" or type(raw.slots) ~= "table" then
		return profile
	end

	for index = 1, SLOT_COUNT do
		profile.slots[index] = normalizeSlot(raw.slots[index] or raw.slots[tostring(index)])
	end
	return profile
end

local function serializeProfile(profile)
	local storedSlots = {}
	for index = 1, SLOT_COUNT do
		local source = normalizeSlot(profile.slots[index])
		local stored = {
			occupied = source.occupied,
			completed = source.completed,
			kills = source.kills,
		}
		if source.bestTime then
			stored.bestTime = source.bestTime
		end
		if source.updatedAt then
			stored.updatedAt = source.updatedAt
		end
		storedSlots[tostring(index)] = stored
	end
	return {
		version = GameConfig.Campaign.SaveVersion,
		slots = storedSlots,
	}
end

local function mergeSlot(storedRaw, desiredRaw)
	local stored = normalizeSlot(storedRaw)
	local desired = normalizeSlot(desiredRaw)
	local merged = blankSlot()

	merged.occupied = stored.occupied or desired.occupied
	merged.completed = stored.completed or desired.completed
	merged.kills = math.max(stored.kills, desired.kills)

	if stored.bestTime and desired.bestTime then
		merged.bestTime = math.min(stored.bestTime, desired.bestTime)
	else
		merged.bestTime = stored.bestTime or desired.bestTime
	end
	if stored.updatedAt or desired.updatedAt then
		merged.updatedAt = math.max(stored.updatedAt or 0, desired.updatedAt or 0)
	end

	return merged
end

local function clientSlots(profile)
	local result = table.create(SLOT_COUNT)
	for index = 1, SLOT_COUNT do
		local source = normalizeSlot(profile.slots[index])
		local slot = {
			index = index,
			occupied = source.occupied,
			completed = source.completed,
			kills = source.kills,
		}
		if source.bestTime then
			slot.bestTime = source.bestTime
		end
		if source.updatedAt then
			slot.updatedAt = source.updatedAt
		end
		result[index] = slot
	end
	return result
end

local function keyForPlayer(player)
	return string.format("player_%d", player.UserId)
end

local function getProfileStore()
	if not profileStore then
		profileStore = DataStoreService:GetDataStore(GameConfig.Campaign.DataStoreName)
	end
	return profileStore
end

local function newState(player)
	return {
		player = player,
		profile = blankProfile(),
		loaded = false,
		loadStarted = false,
		cloudLoaded = false,
		persistence = "unavailable",
		activeSlot = nil,
		operationBusy = false,
		lastRequest = 0,
		closing = false,
	}
end

local function getState(player)
	local state = states[player]
	if state then
		return state
	end
	state = newState(player)
	states[player] = state
	return state
end

local function unpublishedStudio()
	return RunService:IsStudio() and game.GameId == 0
end

local function retryDataStore(operationName, callback)
	local lastError
	for attempt = 1, MAX_DATASTORE_ATTEMPTS do
		local success, result = pcall(callback)
		if success then
			return true, result
		end
		lastError = result
		warn(string.format("SKYBREAK %s attempt %d failed: %s", operationName, attempt, tostring(result)))
		if attempt < MAX_DATASTORE_ATTEMPTS then
			task.wait(attempt)
		end
	end
	return false, lastError
end

local function loadState(state)
	if unpublishedStudio() then
		warn("SKYBREAK campaign persistence is SESSION-ONLY in this unpublished Studio place; no DataStore requests will be made.")
		state.persistence = "session"
		state.loaded = true
		return
	end

	local success, stored = retryDataStore("profile load", function()
		return getProfileStore():GetAsync(keyForPlayer(state.player))
	end)
	if success then
		state.profile = normalizeProfile(stored)
		state.cloudLoaded = true
		state.persistence = "cloud"
	else
		-- Published load failures deliberately remain unavailable. Starting from a
		-- blank profile here could overwrite progress that we failed to read.
		state.persistence = "unavailable"
	end
	state.loaded = true
end

local function startLoading(state)
	if state.loadStarted then
		return
	end
	-- Claim the load before spawning so PlayerAdded and an immediate client
	-- request can never start competing reads for the same profile.
	state.loadStarted = true
	task.spawn(loadState, state)
end

local function waitForLoad(state)
	startLoading(state)
	local deadline = os.clock() + LOAD_TIMEOUT
	while not state.loaded and not state.closing and os.clock() < deadline do
		task.wait(0.05)
	end
	return state.loaded
end

local function saveSlot(state, slotIndex)
	if state.persistence == "session" then
		return true
	end
	if not state.cloudLoaded then
		return false
	end

	local desired = normalizeSlot(state.profile.slots[slotIndex])
	local success, stored = retryDataStore("profile save", function()
		return getProfileStore():UpdateAsync(keyForPlayer(state.player), function(current)
			local mergedProfile = normalizeProfile(current)
			mergedProfile.slots[slotIndex] = mergeSlot(mergedProfile.slots[slotIndex], desired)
			return serializeProfile(mergedProfile)
		end)
	end)

	if success then
		state.profile = normalizeProfile(stored)
		state.persistence = "cloud"
		return true
	end
	state.persistence = "unavailable"
	return false
end

local function saveAll(state)
	if state.persistence == "session" then
		return true
	end
	if not state.cloudLoaded then
		return false
	end

	local desired = normalizeProfile(state.profile)
	local success, stored = retryDataStore("profile shutdown save", function()
		return getProfileStore():UpdateAsync(keyForPlayer(state.player), function(current)
			local merged = normalizeProfile(current)
			for index = 1, SLOT_COUNT do
				merged.slots[index] = mergeSlot(merged.slots[index], desired.slots[index])
			end
			return serializeProfile(merged)
		end)
	end)

	if success then
		state.profile = normalizeProfile(stored)
		state.persistence = "cloud"
		return true
	end
	state.persistence = "unavailable"
	return false
end

local function response(state, ok, errorMessage)
	local result = {
		ok = ok,
		slots = clientSlots(state.profile),
		persistence = state.persistence,
	}
	if errorMessage then
		result.error = errorMessage
	end
	return result
end

local function listSlots(state)
	if not waitForLoad(state) then
		return response(state, false, "Campaign data is still loading. Please try again.")
	end
	if state.persistence == "unavailable" then
		return response(state, false, "Campaign saves are temporarily unavailable.")
	end
	return response(state, true)
end

local function startMission(state, payload)
	if type(payload) ~= "table" or not isValidSlot(payload.slot) then
		return response(state, false, "Choose a valid campaign slot (1-4).")
	end
	if not waitForLoad(state) then
		return response(state, false, "Campaign data is still loading. Please try again.")
	end
	if state.persistence == "unavailable" then
		return response(state, false, "Your cloud save could not be loaded; mission start is blocked to protect it.")
	end
	if not combatService then
		return response(state, false, "Flight systems are not installed in this build.")
	end

	local sessionOk, existingSession = pcall(combatService.GetSession, state.player)
	if not sessionOk then
		warn("SKYBREAK could not inspect combat session: " .. tostring(existingSession))
		return response(state, false, "Flight systems are temporarily unavailable.")
	end
	if existingSession or state.activeSlot then
		return response(state, false, "A mission is already in progress.")
	end

	local startedCallOk, started, startError = pcall(combatService.StartMission, state.player, payload.slot)
	if not startedCallOk then
		warn("SKYBREAK mission start failed: " .. tostring(started))
		return response(state, false, "The mission could not be started.")
	end
	if started ~= true then
		return response(state, false, tostring(startError or "The mission could not be started."))
	end

	state.activeSlot = payload.slot
	local slot = state.profile.slots[payload.slot]
	slot.occupied = true
	slot.updatedAt = os.time()
	saveSlot(state, payload.slot)
	return response(state, true)
end

local function returnToMenu(state)
	state.activeSlot = nil
	if not combatService then
		return response(state, true)
	end
	local success, errorMessage = pcall(combatService.EndMission, state.player)
	if not success then
		warn("SKYBREAK mission cleanup failed: " .. tostring(errorMessage))
		return response(state, false, "The active flight could not be cleaned up.")
	end
	return response(state, true)
end

local function handleRequest(player, action, payload)
	if typeof(action) ~= "string" then
		return { ok = false, error = "Invalid campaign action.", slots = clientSlots(blankProfile()), persistence = "unavailable" }
	end

	local state = getState(player)
	if state.closing then
		return response(state, false, "Campaign session is closing.")
	end

	local now = os.clock()
	if now - state.lastRequest < REQUEST_INTERVAL then
		return response(state, false, "Please wait a moment before trying again.")
	end
	state.lastRequest = now

	if state.operationBusy then
		return response(state, false, "Another campaign request is already in progress.")
	end
	state.operationBusy = true

	local success, result = xpcall(function()
		if action == "ListSlots" then
			return listSlots(state)
		elseif action == "StartMission" then
			return startMission(state, payload)
		elseif action == "ReturnToMenu" then
			return returnToMenu(state)
		end
		return response(state, false, "Unknown campaign action.")
	end, debug.traceback)

	state.operationBusy = false
	if success then
		return result
	end
	warn("SKYBREAK campaign request crashed: " .. tostring(result))
	return response(state, false, "Campaign service encountered an error.")
end

local function waitForOperation(state, timeout)
	local deadline = os.clock() + timeout
	while state.operationBusy and os.clock() < deadline do
		task.wait(0.05)
	end
	return not state.operationBusy
end

function CampaignService.OnFinished(player, won, stats)
	local state = states[player]
	if not state or state.closing or type(stats) ~= "table" then
		return
	end
	if not waitForOperation(state, 10) or state.operationBusy then
		warn("SKYBREAK timed out waiting to record mission result for " .. player.Name)
		return
	end
	state.operationBusy = true

	local slotIndex = state.activeSlot
	if not slotIndex or not isValidSlot(stats.slot) or stats.slot ~= slotIndex then
		state.operationBusy = false
		warn("SKYBREAK ignored a mission result that did not match the active server session")
		return
	end
	state.activeSlot = nil

	local kills = if isFinite(stats.kills) then math.clamp(math.floor(stats.kills), 0, MISSION_KILLS) else 0
	local elapsed = if isFinite(stats.elapsed) and stats.elapsed > 0 then stats.elapsed else nil
	local completed = won == true and kills >= MISSION_KILLS and elapsed ~= nil
	local slot = state.profile.slots[slotIndex]
	slot.occupied = true
	slot.kills = math.max(slot.kills, kills)
	slot.updatedAt = os.time()
	if completed then
		slot.completed = true
		slot.bestTime = if slot.bestTime then math.min(slot.bestTime, elapsed) else elapsed
	end

	local saved = saveSlot(state, slotIndex)
	state.operationBusy = false

	if player.Parent == Players then
		remotes.MissionState:FireClient(player, {
			kind = if completed then "Completed" else "Failed",
			slot = slotIndex,
			kills = kills,
			elapsed = elapsed or 0,
			saved = saved,
			persistence = state.persistence,
		})
	end
end

local function shutdownPlayer(player)
	local state = states[player]
	if not state or state.closing then
		return
	end
	state.closing = true
	local operationIdle = waitForOperation(state, 5)
	state.activeSlot = nil
	if combatService then
		pcall(combatService.EndMission, player)
	end
	if state.loaded and operationIdle then
		saveAll(state)
	elseif not operationIdle then
		-- Never start a second write for this key while a request/result save owns
		-- it. That in-flight operation already carries the latest relevant change.
		warn("SKYBREAK skipped overlapping shutdown save for " .. player.Name)
	end
	states[player] = nil
end

function CampaignService.Init(remoteTable, combatModule)
	assert(not initialized, "CampaignService.Init may only be called once")
	initialized = true
	remotes = remoteTable
	combatService = combatModule

	remotes.CampaignRequest.OnServerInvoke = handleRequest
	Players.PlayerAdded:Connect(function(player)
		startLoading(getState(player))
	end)
	Players.PlayerRemoving:Connect(shutdownPlayer)

	for _, player in Players:GetPlayers() do
		startLoading(getState(player))
	end

	game:BindToClose(function()
		local remaining = 0
		for _, player in Players:GetPlayers() do
			remaining += 1
			task.spawn(function()
				shutdownPlayer(player)
				remaining -= 1
			end)
		end
		local deadline = os.clock() + 25
		while remaining > 0 and os.clock() < deadline do
			task.wait(0.1)
		end
	end)
end

return CampaignService
