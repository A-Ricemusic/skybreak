assert(workspace:GetAttribute("LargeWorldSpike"))
local Writer=require(game:GetService("ServerStorage").TerrainWriter).TerrainWriter
local Plan=require(game:GetService("ServerStorage").LodPlan)
for _,extent in {8000,16000,24000,35000} do
 workspace.Terrain:Clear();task.wait(2)
 local baseline=game:GetService("Stats"):GetTotalMemoryUsageMb()
 local worst,last,peak,monitoring=0,os.clock(),baseline,true
 task.spawn(function() while monitoring do
  task.wait();local now=os.clock();worst=math.max(worst,now-last);last=now
  peak=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb())
 end end)
 local start=os.clock()
 local result=Writer:Write(Plan(extent))
 local elapsed=os.clock()-start
 worst=math.max(worst,os.clock()-last);monitoring=false
 print("LARGE_WORLD_LOD:"..game:GetService("HttpService"):JSONEncode({extent=extent,wallSeconds=elapsed,worstYieldGapSeconds=worst,sampledPeakMb=math.max(peak,game:GetService("Stats"):GetTotalMemoryUsageMb()),
 jobs=result.jobs,longestJobSeconds=result.longest,workSeconds=result.total,yields=result.yields,
 memoryBeforeMb=baseline,memoryAfterMb=game:GetService("Stats"):GetTotalMemoryUsageMb()}))
end
workspace.Terrain:Clear()
print("LARGE_WORLD_LOD_COMPLETE")
