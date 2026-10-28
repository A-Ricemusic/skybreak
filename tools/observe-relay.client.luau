-- Read-only live QA observer. Install as a normal client LocalScript.
assert(game:GetService("RunService"):IsStudio(),"QA observer is Studio-only")
local player=game.Players.LocalPlayer
local report=player:WaitForChild("PlayerScripts"):WaitForChild("BrokenRelayQA")
local story=require(game.ReplicatedStorage:WaitForChild("Shared"):WaitForChild("RelayStory")).STORY
local resultConnection=game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(message)
 if message.kind~="Completed" and message.kind~="Failed" then return end
 task.delay(.3,function()
  if not script.Parent then return end
  local ok,response=pcall(function()return game.ReplicatedStorage.Remotes.CampaignRequest:InvokeServer("ListSlots")end)
  if ok and response.ok then
   local value=report:FindFirstChild("ServerSlots") or Instance.new("StringValue")
   value.Name="ServerSlots";value.Value=game:GetService("HttpService"):JSONEncode(response.slots);value.Parent=report
  end
 end)
end)
script.Destroying:Connect(function()resultConnection:Disconnect()end)
while script.Parent do
 local screen=player.PlayerGui:FindFirstChild("CinematicScreen",true)
 if screen then
  local labels={}
  for _,v in screen:GetDescendants() do if v:IsA("TextLabel") then labels[v.Text]=true end end
  for _,chapter in story do for n,beat in chapter.beats do if labels[beat.text] then
   local name=string.format("Story_%02d",chapter.id)
   local entry=report:FindFirstChild(name)
   if not entry then entry=Instance.new("Folder");entry.Name=name;entry:SetAttribute("Title",chapter.title);entry.Parent=report end
   entry:SetAttribute("Beat"..n,true);entry:SetAttribute("Camera"..n,tostring(workspace.CurrentCamera.CFrame))
   local scene=workspace:FindFirstChild("BrokenRelayCinematic")
   if scene then
    local names={}
    for _,obj in scene:GetDescendants() do if obj:IsA("Model") and obj:GetAttribute("GeometrySource")=="Blender" then table.insert(names,obj:GetAttribute("GeometryAsset"))end end
    table.sort(names);entry:SetAttribute("BlenderSubjects",table.concat(names,","))
   end
  end end end
 end
 task.wait(.25)
end
