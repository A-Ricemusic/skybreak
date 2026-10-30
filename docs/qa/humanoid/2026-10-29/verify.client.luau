-- Client-side verification on the fixed build: health/backpack CoreGui off, no character,
-- the game's own HUD/menu mounted.
local StarterGui = game:GetService("StarterGui")
local player = game:GetService("Players").LocalPlayer
local health = StarterGui:GetCoreGuiEnabled(Enum.CoreGuiType.Health)
local backpack = StarterGui:GetCoreGuiEnabled(Enum.CoreGuiType.Backpack)
local guis = {}
for _, g in player.PlayerGui:GetChildren() do table.insert(guis, g.Name .. (g:IsA("ScreenGui") and (g.Enabled and "(on)" or "(off)") or "")) end
print("VERIFY CLIENT healthGui", health, "backpackGui", backpack, "character", player.Character and player.Character:GetFullName() or "nil", "camera", workspace.CurrentCamera.CameraType.Name, "guis", table.concat(guis, ","))
