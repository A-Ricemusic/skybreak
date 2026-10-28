-- Studio-only visual fixture, not campaign/gameplay evidence.
-- During a PAUSED farm/harbor wide shot, substitute a vehicle story mesh under
-- the production renderer's shared vehicle camera. Destroy this script to restore.
assert(game:GetService("RunService"):IsStudio(),"Exclusive Studio lease required")
local player=game.Players.LocalPlayer
local scene=assert(workspace:FindFirstChild("BrokenRelayCinematic"),"Pause a vehicle cinematic first")
local pause=player.PlayerGui:FindFirstChild("CinematicPauseButton",true)
assert(pause,"Open a vehicle cinematic first")
assert(player.PlayerGui:FindFirstChild("CinematicPaused",true),"Pause before inspecting an asset")
local name=script:GetAttribute("Asset") or "HarborLaunch"
assert(name=="HarborLaunch" or name=="RelayTruck","Only the shared vehicle-camera assets belong in this fixture")
local original=assert(scene:FindFirstChild("Story subject"))
local replacement=game.ReplicatedStorage.RelayStoryModels[name]:Clone()
replacement.Name="Visual fixture subject";replacement:SetAttribute("EvidenceType","Asset framing fixture; no progression")
replacement:PivotTo(CFrame.new(45,6000+(name=="HarborLaunch" and 19 or 18),-65))
original.Parent=nil;replacement.Parent=scene
script.Destroying:Connect(function()
 replacement:Destroy()
 if scene.Parent then original.Parent=scene else original:Destroy()end
end)
