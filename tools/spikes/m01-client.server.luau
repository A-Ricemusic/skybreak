assert(workspace:GetAttribute("M01Measurement"))
local Test=game:GetService("StudioTestService")
local event=Instance.new("RemoteEvent");event.Name="M01Event";event.Parent=game:GetService("ReplicatedStorage")
event.OnServerEvent:Connect(function(player,row)
 if row.kind=="focus" then
  local root=player.Character and player.Character:FindFirstChild("HumanoidRootPart")
  if root then root.Anchored=true;root.CFrame=CFrame.new(row.x,700,row.z) end
 else
  print("M01_CLIENT:"..game:GetService("HttpService"):JSONEncode(row))
  workspace:SetAttribute("M01ClientResult",game:GetService("HttpService"):JSONEncode(row))
 end
end)
local result=require(game:GetService("ServerStorage").Measure)("play-server")
workspace:SetAttribute("M01BuildResult",game:GetService("HttpService"):JSONEncode(result))
workspace:SetAttribute("M01Ready",true)
