local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameConfig = require(ReplicatedStorage.Shared.GameConfig)

local CampaignService = require(script.CampaignService)
local WorldBuilder = require(script.WorldBuilder)

local function ensureRemote(folder, name, className)
	local existing = folder:FindFirstChild(name)
	if existing and not existing:IsA(className) then
		existing:Destroy()
		existing = nil
	end
	if not existing then
		existing = Instance.new(className)
		existing.Name = name
		existing.Parent = folder
	end
	return existing
end

local remotesFolder = ReplicatedStorage:FindFirstChild("Remotes")
if remotesFolder and not remotesFolder:IsA("Folder") then
	remotesFolder:Destroy()
	remotesFolder = nil
end
if not remotesFolder then
	remotesFolder = Instance.new("Folder")
	remotesFolder.Name = "Remotes"
	remotesFolder.Parent = ReplicatedStorage
end

local remotes = {
	CampaignRequest = ensureRemote(remotesFolder, "CampaignRequest", "RemoteFunction"),
	FlightInput = ensureRemote(remotesFolder, "FlightInput", "RemoteEvent"),
	CombatAction = ensureRemote(remotesFolder, "CombatAction", "RemoteEvent"),
	MissionState = ensureRemote(remotesFolder, "MissionState", "RemoteEvent"),
}

WorldBuilder.Build()
local CombatService
local combatModule = script:FindFirstChild("CombatService")
if combatModule and combatModule:IsA("ModuleScript") then
	local loaded, result = pcall(require, combatModule)
	if loaded and type(result) == "table"
		and type(result.Init) == "function"
		and type(result.StartMission) == "function"
		and type(result.EndMission) == "function"
		and type(result.GetSession) == "function" then
		CombatService = result
		local initialized, initError = pcall(CombatService.Init, remotes, CampaignService.OnFinished)
		if not initialized then
			warn("SKYBREAK CombatService initialization failed; missions are disabled: " .. tostring(initError))
			CombatService = nil
		end
	else
		warn("SKYBREAK CombatService is invalid; missions are disabled: " .. tostring(result))
	end
else
	warn("SKYBREAK CombatService is missing; menu/world are available, but missions are disabled until integration.")
end
CampaignService.Init(remotes, CombatService)

print(string.format("%s: %s server started", GameConfig.DisplayName, GameConfig.Subtitle))
