-- Isolated Studio Play test. Pair with client script; invoke StudioTestService.
assert(workspace:GetAttribute("LargeWorldSpike"))
local Test=game:GetService("StudioTestService")
local args=Test:GetTestArgs()
local extent=args.extent
local event=Instance.new("RemoteEvent");event.Name="SpikeEvent";event.Parent=game:GetService("ReplicatedStorage")
workspace:SetAttribute("SpikeExtent",extent)
local jet
local ended=false
local readyTime=0
local peak=0
local heartbeat=game:GetService("RunService").Heartbeat:Connect(function()
 peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
end)
event.OnServerEvent:Connect(function(_,row)
 if row.kind=="focus" then
  local character=_.Character
  local root=character and character:FindFirstChild("HumanoidRootPart")
  if root then root.Anchored=true;root.CFrame=CFrame.new(0,650,row.z) end
  if jet then jet:PivotTo(CFrame.new(0,650,row.z)) end
  return
 end
 if row.kind~="result" or ended then return end
 ended=true
 heartbeat:Disconnect()
 row.jetGeometry=jet and jet:GetAttribute("GeometrySource") or "none"
 row.serverPeakMb=peak;row.serverBuildSeconds=readyTime;row.extent=extent;row.streaming=workspace.StreamingEnabled
 print("LARGE_WORLD_CLIENT:"..game:GetService("HttpService"):JSONEncode(row))
 Test:EndTest(row)
end)
task.delay(240,function() if not ended then Test:EndTest({error="client timeout",extent=extent}) end end)
local ok,result=pcall(function() return require(game:GetService("ReplicatedStorage").Shared.JetFactory).JetFactory:Create("SpikeJet",false) end)
if ok then jet=result;jet.PrimaryPart.Anchored=true;jet.Parent=workspace end
local writer=require(game:GetService("ServerStorage").TerrainWriter).TerrainWriter
local started=os.clock()
local core=math.min(extent,7200)
writer:Write({{shape="block",material="Water",x=0,y=-20,z=0,sx=core,sy=8,sz=core,yaw=0}})
local plan=require(game:GetService("ServerStorage").LodPlan)
writer:Write(plan(extent))
local tiles=Instance.new("Folder");tiles.Name="FarSea";tiles.Parent=workspace
local count=0
for x=-extent/2,extent/2-1,2000 do for z=-extent/2,extent/2-1,2000 do
 local w,d=math.min(2000,extent/2-x),math.min(2000,extent/2-z)
 if x < -core/2 or z < -core/2 or x+w > core/2 or z+d > core/2 then
  local p=Instance.new("Part");p.Anchored=true;p.CanCollide=false;p.CanTouch=false;p.CastShadow=false
  p.Size=Vector3.new(w,4,d);p.Position=Vector3.new(x+w/2,-18,z+d/2);p.Color=Color3.fromRGB(50,75,95);p.Parent=tiles
  count+=1;if count%150==0 then task.wait() end
 end
end end
readyTime=os.clock()-started
workspace:SetAttribute("SpikeTerrainReady",true)
