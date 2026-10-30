-- Server-side verification on the fixed build: no avatar exists and none can appear.
local Players = game:GetService("Players")
local problems = {}
if Players.CharacterAutoLoads then table.insert(problems, "CharacterAutoLoads is true") end
for _, player in Players:GetPlayers() do
	if player.Character then table.insert(problems, player.Name .. " has a Character " .. player.Character:GetFullName()) end
end
for _, item in workspace:GetDescendants() do
	if item:IsA("Humanoid") then table.insert(problems, "Humanoid in workspace: " .. item:GetFullName()) end
end
print("VERIFY SERVER", #problems == 0 and "OK" or table.concat(problems, "; "), "sessions folder", #workspace.SkybreakCombat:GetChildren(), "World", workspace:FindFirstChild("World") ~= nil)
