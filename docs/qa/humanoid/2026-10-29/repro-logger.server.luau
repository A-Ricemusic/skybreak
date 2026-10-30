-- Server-side logger run through the Studio MCP (Server datamodel) while playing an
-- unmodified origin/main build, to find what kills the avatar. Prints every character
-- spawn, health change, death, root-part removal and the root position each second.
local Players = game:GetService("Players")
local t0 = os.clock()
local function stamp() return string.format("[%6.1fs]", os.clock() - t0) end
local function watch(player, character)
	print(stamp(), "CHARACTER ADDED", player.Name, "World folder present:", workspace:FindFirstChild("World") ~= nil)
	local humanoid = character:WaitForChild("Humanoid", 5)
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if humanoid then
		humanoid.HealthChanged:Connect(function(h) print(stamp(), "HEALTH", h, "state", humanoid:GetState().Name, "rootY", root and root.Parent and string.format("%.0f", root.Position.Y) or "gone") end)
		humanoid.Died:Connect(function() print(stamp(), "DIED", "rootY", root and root.Parent and string.format("%.0f", root.Position.Y) or "gone", "root parent", root and tostring(root.Parent)) end)
	end
	if root then
		root.AncestryChanged:Connect(function(_, parent) if parent == nil then print(stamp(), "ROOT REMOVED (destroyed) last Y", string.format("%.0f", root.Position.Y)) end end)
		task.spawn(function()
			while root.Parent and character.Parent do
				print(stamp(), "POS", string.format("%.0f %.0f %.0f", root.Position.X, root.Position.Y, root.Position.Z), "anchored", root.Anchored, "World", workspace:FindFirstChild("World") ~= nil, "combat", #workspace.SkybreakCombat:GetChildren())
				task.wait(1)
			end
		end)
	end
end
for _, player in Players:GetPlayers() do
	if player.Character then watch(player, player.Character) end
	player.CharacterAdded:Connect(function(c) watch(player, c) end)
end
Players.PlayerAdded:Connect(function(player) player.CharacterAdded:Connect(function(c) watch(player, c) end) end)
print(stamp(), "logger armed; CharacterAutoLoads", Players.CharacterAutoLoads, "FallenPartsDestroyHeight", workspace.FallenPartsDestroyHeight)
