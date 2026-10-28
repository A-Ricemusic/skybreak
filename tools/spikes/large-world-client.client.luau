assert(game:GetService("RunService"):IsStudio())
local RS=game:GetService("ReplicatedStorage")
local event=RS:WaitForChild("SpikeEvent")
local player=game:GetService("Players").LocalPlayer
local character=player.Character or player.CharacterAdded:Wait()
local root=character:WaitForChild("HumanoidRootPart")
root.Anchored=true
while not workspace:GetAttribute("SpikeExtent") do task.wait() end
local extent=workspace:GetAttribute("SpikeExtent")
local startZ=-extent*.24
root.CFrame=CFrame.new(0,650,startZ)
event:FireServer({kind="focus",z=startZ})
local camera=workspace.CurrentCamera
camera.CameraType=Enum.CameraType.Scriptable
local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances={workspace.Terrain};params.IgnoreWater=true
local function hit(z)
 return workspace:Raycast(Vector3.new(0,1000,z),Vector3.new(0,-1100,0),params)~=nil
end
local joined=os.clock()
while not workspace:GetAttribute("SpikeTerrainReady") do task.wait() end
local ready=os.clock()
local deadline=ready+30
while not hit(startZ) and os.clock()<deadline do task.wait() end
local initialHit=hit(startZ)
local visible=os.clock()
local start=os.clock()
local frames,total,maxDt,miss,aheadMiss,samples,peak=0,0,0,0,0,0,0
while true do
 local dt=game:GetService("RunService").RenderStepped:Wait()
 local z=startZ+(os.clock()-start)*600
 if z>extent*.24 then break end
 root.CFrame=CFrame.new(0,650,z)
 camera.CFrame=CFrame.lookAt(Vector3.new(0,700,z-80),Vector3.new(0,250,z+800))
 frames+=1;total+=dt;maxDt=math.max(maxDt,dt)
 peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
 if frames%10==0 then
  samples+=1
  event:FireServer({kind="focus",z=z})
  if not hit(z) then miss+=1 end
  if math.abs(z+600)<extent*.24 and not hit(z+600) then aheadMiss+=1 end
 end
end
event:FireServer({kind="result",clientPeakMb=peak,fps=frames/total,worstRenderDt=maxDt,
 readyAfterClientScriptSeconds=ready-joined,localIslandAfterReadySeconds=visible-ready,
 initialHit=initialHit,groundMisses=miss,aheadMisses=aheadMiss,samples=samples,speed=600})
