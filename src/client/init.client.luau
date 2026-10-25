local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
local playerModule = player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule", 10)
if playerModule then
	local ok, module = pcall(require, playerModule)
	if ok and module and module.GetControls then
		local controls = module:GetControls()
		if controls then
			controls:Disable()
		end
	end
end

task.spawn(function()
	for _ = 1, 20 do
		if pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		end) then
			break
		end
		task.wait(0.25)
	end
end)

local folder = ReplicatedStorage:WaitForChild("Remotes")
local remotes = {
	CampaignRequest = folder:WaitForChild("CampaignRequest"),
	FlightInput = folder:WaitForChild("FlightInput"),
	CombatAction = folder:WaitForChild("CombatAction"),
	MissionState = folder:WaitForChild("MissionState"),
}

local FlightController = require(script:WaitForChild("FlightController"))
local GameUI = require(script:WaitForChild("GameUI"))
local controller = FlightController.new(remotes)
GameUI.new(remotes, controller):Mount()
