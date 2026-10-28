-- Destructive ONLY to the isolated LargeWorldSpike place. Never run in a shipped place.
assert(workspace:GetAttribute("LargeWorldSpike") == true, "Run only in LargeWorldSpike")
local Http = game:GetService("HttpService")
local Stats = game:GetService("Stats")
local Writer = require(game:GetService("ServerStorage").TerrainWriter).TerrainWriter
local Schedule = require(game:GetService("ReplicatedStorage").Shared.TerrainSchedule)
local terrain = workspace.Terrain
local function emit(row) print("LARGE_WORLD:" .. Http:JSONEncode(row)) end
local function memory() return Stats:GetTotalMemoryUsageMb() end
local function op(shape, material, x,y,z,sx,sy,sz)
 return {shape=shape,material=material,x=x,y=y,z=z,sx=sx,sy=sy,sz=sz,yaw=0}
end
local function phase(label, ops, extent, mode)
 local jobs = Schedule.terrainJobs(ops)
 local cells = 0
 for _, job in jobs do cells += job.cells end
 local baseline, luaBefore = memory(), gcinfo()/1024
 local maxMemory, maxGap, last = baseline, 0, os.clock()
 local monitoring = true
 task.spawn(function()
  while monitoring do
   task.wait()
   local now = os.clock()
   maxGap = math.max(maxGap, now-last)
   last = now
   maxMemory = math.max(maxMemory, memory())
  end
 end)
 local start = os.clock()
 local result = Writer:Write(ops)
 local elapsed = os.clock()-start
 maxGap = math.max(maxGap, os.clock()-last)
 monitoring = false
 maxMemory = math.max(maxMemory, memory())
 emit({kind="terrain",phase=label,extent=extent,mode=mode,wallSeconds=elapsed,
 workSeconds=result.total,longestJobSeconds=result.longest,worstYieldGapSeconds=maxGap,
 jobs=result.jobs,yields=result.yields,cells=cells,memoryBeforeMb=baseline,
 memoryAfterMb=memory(),sampledPeakMb=maxMemory,luaBeforeMb=luaBefore,luaAfterMb=gcinfo()/1024})
end
emit({kind="environment",version=version(),streaming=workspace.StreamingEnabled,memoryMb=memory()})
for _, extent in {8000,16000,24000,35000} do
 for _, mode in {"full", "core-and-flat"} do
  terrain:Clear()
  local old = workspace:FindFirstChild("FarTiles")
  if old then old:Destroy() end
  task.wait(2)
  local core = if mode == "full" then extent else math.min(extent,7200)
  phase("water", {op("block","Water",0,-20,0,core,8,core),op("block","Mud",0,-26,0,core,4,core)},extent,mode)
  -- One additive cosine heightfield, the current planner/writer's actual bump.
  -- Island is 60% of the square long, 24% wide; fixed 576-stud peak.
  phase("island", {op("bump","LeafyGrass",0,-24,0,core*.12,576,core*.30)},extent,mode)
  if mode == "core-and-flat" then
   local start, baseline = os.clock(), memory()
   local folder = Instance.new("Folder"); folder.Name="FarTiles"; folder.Parent=workspace
   local count=0
   for x=-extent/2,extent/2-1,1000 do
    for z=-extent/2,extent/2-1,1000 do
     local w,d=math.min(1000,extent/2-x),math.min(1000,extent/2-z)
     if math.abs(x+w/2)>core/2-1000 or math.abs(z+d/2)>core/2-1000 then
      local p=Instance.new("Part");p.Name="FarSea";p.Anchored=true;p.CanCollide=false;p.CanTouch=false;p.CastShadow=false
      p.Size=Vector3.new(w,4,d);p.Position=Vector3.new(x+w/2,-18,z+d/2);p.Color=Color3.fromRGB(50,75,95);p.Parent=folder
      count+=1
      if count%150==0 then task.wait() end
     end
    end
   end
   emit({kind="tiles",extent=extent,instances=count,wallSeconds=os.clock()-start,memoryDeltaMb=memory()-baseline})
  end
 end
end
terrain:Clear()
local old=workspace:FindFirstChild("FarTiles");if old then old:Destroy() end
emit({kind="complete"})
