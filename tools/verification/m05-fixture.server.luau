-- Studio-only mission 5 verification fixture (never shipped; added only by build-m05-place.ts).
-- Missions 3 and 4 are released by their own PRs. Open them for this session and complete missions 1-4 in order
-- through the coordinator's normal record path, so mission 5 unlocks exactly as on a real save.
assert(game:GetService("RunService"):IsStudio() and game.GameId == 0, "M05 fixture is unpublished-Studio only")
local RS = game:GetService("ReplicatedStorage")
local SSS = game:GetService("ServerScriptService")
local Catalog = require(RS:WaitForChild("Shared"):WaitForChild("MissionCatalog"))
Catalog.MISSIONS[3].available = true
Catalog.MISSIONS[4].available = true
local Repository = require(SSS:WaitForChild("Server"):WaitForChild("CampaignRepository"))
local Coordinator = Repository.CampaignCoordinator
local load = Coordinator.load
Coordinator.load = function(self, ...)
	local result = load(self, ...)
	for id = 1, 4 do self:recordMissionResult(1, id, true, 6, 100) end
	print("M05_FIXTURE seeded slot 1: missions 1-4 completed in order")
	return result
end
print("M05_FIXTURE installed")
