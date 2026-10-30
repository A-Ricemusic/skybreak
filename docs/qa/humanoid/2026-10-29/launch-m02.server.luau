-- Server-side: mission 2 is locked until mission 1 is completed on the save slot, so the
-- Studio check starts it through CombatService directly (same code path the campaign uses).
local CombatService = require(game:GetService("ServerScriptService").Server.CombatService).CombatService
local player = game:GetService("Players"):GetPlayers()[1]
print("StartMission 2 ->", CombatService.StartMission(player, 1, 2, "uav", "normal"))
