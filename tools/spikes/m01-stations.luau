-- Optional clean-view repeat from Client after the main probe finishes.
assert(workspace:GetAttribute("M01Measurement"))
local character=game.Players.LocalPlayer.Character
for _,v in character:GetDescendants() do if v:IsA("BasePart") then v.LocalTransparencyModifier=1 end end
local row={kind="result",label="phone-clear-view",stations={}}
for _,station in {{"city",1280,256},{"airbase",-1280,-3200}} do
 local x,z=station[2],station[3]
 character.HumanoidRootPart.CFrame=CFrame.new(x,700,z+700)
 workspace.CurrentCamera.CFrame=CFrame.lookAt(Vector3.new(x,700,z+700),Vector3.new(x,200,z))
 game.ReplicatedStorage.M01Event:FireServer({kind="focus",x=x,z=z+700})
 workspace:SetAttribute("M01Station",station[1]);task.wait(3)
 local frames,total,worst,peak=0,0,0,0
 while total<10 do
  local dt=game:GetService("RunService").RenderStepped:Wait();frames+=1;total+=dt;worst=math.max(worst,dt);peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
 end
 table.insert(row.stations,{name=station[1],fps=frames/total,worstRenderSeconds=worst,peakMb=peak})
end
game.ReplicatedStorage.M01Event:FireServer(row)
