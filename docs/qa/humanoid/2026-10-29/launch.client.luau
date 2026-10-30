-- Client-side: start a mission exactly as the menu button does (GameUI.tsx launchMission).
-- Edit MISSION before running: 0 = practice flight, 1 = mission 1.
local MISSION = 0
local remotes = game:GetService("ReplicatedStorage"):WaitForChild("Remotes")
local ok, response = pcall(function()
	return remotes.CampaignRequest:InvokeServer("StartMission", { slot = 1, missionId = MISSION, special = "uav", difficulty = "normal" })
end)
print("StartMission", MISSION, ok, response and response.ok, response and response.message)
