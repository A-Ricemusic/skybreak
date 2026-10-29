local joined=os.clock()
local RS=game:GetService("ReplicatedStorage")
local event=RS:WaitForChild("M01Event")
local player=game:GetService("Players").LocalPlayer
local char=player.Character or player.CharacterAdded:Wait()
local root=char:WaitForChild("HumanoidRootPart");root.Anchored=true
if workspace:GetAttribute("M01StationsOnly") then
 for _,item in char:GetDescendants() do if item:IsA("BasePart") then item.LocalTransparencyModifier=1 end end
end
local camera=workspace.CurrentCamera;camera.CameraType=Enum.CameraType.Scriptable
local function pose(x,z,tx,tz)
 root.CFrame=CFrame.new(x,700,z)
 camera.CFrame=CFrame.lookAt(Vector3.new(x,700,z),Vector3.new(tx,200,tz))
end
pose(0,10000,512,4200);event:FireServer({kind="focus",x=0,z=10000})
local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances={workspace.Terrain};params.IgnoreWater=true
local function hit(x,z) return workspace:Raycast(Vector3.new(x,1000,z),Vector3.new(0,-1100,0),params) end
while not workspace:GetAttribute("M01Ready") do task.wait() end
local ready=os.clock()
local deadline=ready+30
while not hit(512,4000) and os.clock()<deadline do task.wait() end
local row={kind="result",readyAfterScriptSeconds=ready-joined,islandRayAfterScriptSeconds=os.clock()-joined,initialIslandHit=hit(512,4000)~=nil,route={},stations={}}
task.wait(6)
local route=require(RS.Shared.M01WorldPlan).M01.route
for _,speed in workspace:GetAttribute("M01StationsOnly") and {} or {160,600} do
 local frames,total,worst,miss,samples,peak=0,0,0,0,0,0
 for i=2,#route do
  local a,b=route[i-1],route[i];local delta=Vector2.new(b[1]-a[1],b[2]-a[2]);local length=delta.Magnitude
  local start=os.clock()
  while os.clock()-start<length/speed do
   local dt=game:GetService("RunService").RenderStepped:Wait();local f=math.min(1,(os.clock()-start)*speed/length)
   local x,z=a[1]+delta.X*f,a[2]+delta.Y*f
   pose(x,z,b[1],b[2]);frames+=1;total+=dt;worst=math.max(worst,dt)
   peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
   if frames%10==0 then
    event:FireServer({kind="focus",x=x,z=z});samples+=1
    -- Only expect solid island where analytic source says land exists; open sea is valid.
    local h=require(RS.Shared.M01WorldPlan).m01Height(x,z)
    if h>32 and not hit(x,z) then miss+=1 end
   end
  end
 end
 table.insert(row.route,{speed=speed,fps=frames/total,worstRenderSeconds=worst,landMisses=miss,samples=samples,peakMb=peak})
end
for _,station in {{"city",1280,256},{"airbase",-1280,-3200}} do
 pose(station[2],station[3]+700,station[2],station[3]);event:FireServer({kind="focus",x=station[2],z=station[3]+700})
 workspace:SetAttribute("M01Station",station[1]);task.wait(3)
 local frames,total,worst,peak=0,0,0,0
 while total<10 do
  local dt=game:GetService("RunService").RenderStepped:Wait();frames+=1;total+=dt;worst=math.max(worst,dt);peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
 end
 table.insert(row.stations,{name=station[1],fps=frames/total,worstRenderSeconds=worst,peakMb=peak})
end
event:FireServer(row)
