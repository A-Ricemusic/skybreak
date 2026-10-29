-- Studio-only read-only launch and city renderer observer; production camera/controller remain active.
assert(game:GetService('RunService'):IsStudio())
local player=game.Players.LocalPlayer
local RS=game:GetService('RunService')
local function record(name,data)
 local f=Instance.new('StringValue');f.Name=name;f.Value=game.HttpService:JSONEncode(data);f.Parent=player.PlayerScripts:WaitForChild('CampaignVerification')
 print('CAMPAIGN_FRAME_VERIFY:'..f.Value)
end
local aircraft,controlAt,startedAt
local samples={}
game.ReplicatedStorage:WaitForChild('Remotes').MissionState.OnClientEvent:Connect(function(m)
 if m.kind=='Started' and m.missionId==1 then aircraft=m.aircraft;startedAt=os.clock() end
 if m.kind=='FlightControl' then controlAt=os.clock() end
end)
task.spawn(function()
 while not startedAt do task.wait() end
 while os.clock()-startedAt<7 do
  if aircraft and aircraft.Parent then
   local pos=aircraft:GetPivot().Position;local c=workspace.CurrentCamera.CFrame.Position
   table.insert(samples,{clock=os.clock(),position={pos.X,pos.Y,pos.Z},camera={c.X,c.Y,c.Z},controlled=controlAt~=nil})
  end
  task.wait(.05)
 end
 record('LaunchFrames',{startedAt=startedAt,controlAt=controlAt,samples=samples})
end)
while task.wait(.25) do
 if aircraft and aircraft.Parent then
  local p=aircraft:GetPivot().Position
  if (Vector2.new(p.X,p.Z)-Vector2.new(1280,256)).Magnitude<2200 then
   local frames,total,worst,peak=0,0,0,0
   local start=aircraft:GetPivot().Position
   while total<10 and aircraft.Parent do
    local dt=RS.RenderStepped:Wait();frames+=1;total+=dt;worst=math.max(worst,dt);peak=math.max(peak,game.Stats:GetTotalMemoryUsageMb())
   end
   record('CityFrames',{fps=frames/total,seconds=total,worstMs=worst*1000,peakStatsMb=peak,start={start.X,start.Y,start.Z},viewport={workspace.CurrentCamera.ViewportSize.X,workspace.CurrentCamera.ViewportSize.Y}})
   break
  end
 end
end
