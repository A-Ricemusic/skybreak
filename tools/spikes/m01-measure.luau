-- Isolated instrumentation: calls the exact compiled builder; no replacement geometry.
assert(workspace:GetAttribute("M01Measurement"))
local RS=game:GetService("ReplicatedStorage")
local Server=game:GetService("ServerScriptService").Server
local plan=require(RS.Shared.M01WorldPlan)
local writer=require(Server.TerrainWriter).TerrainWriter
local world=require(Server.M01World).M01World
local stats=game:GetService("Stats")
return function(label)
 workspace.Terrain:Clear()
 local old=workspace:FindFirstChild("MeasuredWorld");if old then old:Destroy() end
 task.wait(2)
 local parent=Instance.new("Folder");parent.Name="MeasuredWorld";parent.Parent=workspace
 local row={label=label,version=version(),beforeMb=stats:GetTotalMemoryUsageMb()}
 local original=writer.Write
 writer.Write=function(self,ops)
  local start=os.clock();local result=original(self,ops)
  row.terrainSeconds=os.clock()-start;row.jobs=result.jobs;row.longestJobSeconds=result.longest
  return result
 end
 local last=os.clock();local gap=0;local peak=row.beforeMb
 local connection=game:GetService("RunService").Heartbeat:Connect(function()
  local now=os.clock();gap=math.max(gap,now-last);last=now;peak=math.max(peak,stats:GetTotalMemoryUsageMb())
 end)
 local start=os.clock();local ok,err=pcall(function() world:Build(parent,101) end)
 row.totalSeconds=os.clock()-start
 task.wait();connection:Disconnect();writer.Write=original
 row.worstHeartbeatGapSeconds=gap;row.peakMb=peak;row.afterMb=stats:GetTotalMemoryUsageMb()
 row.attributes=parent:GetAttributes();row.instances=#parent:GetDescendants();row.workspaceInstances=#workspace:GetDescendants()
 row.afterTerrainSeconds=row.totalSeconds-(row.attributes.WorldTerrainReadySeconds or 0)
 row.ok=ok;row.error=not ok and tostring(err) or nil
 row.counts=plan.m01Counts(plan.buildM01Plan(101))
 print("M01_MEASURE:"..game:GetService("HttpService"):JSONEncode(row))
 return row
end
