-- Throwaway Studio Play bench (never a production place). Attribute Workspace.TerrainBench
-- = comma list of plan keys (m02,m04,m05); Workspace.TerrainBenchBudget (default 0.008).
local mode = workspace:GetAttribute("TerrainBench")
if not mode then return end
local H = game:GetService("HttpService")
local RS = game:GetService("RunService")
local Shared = game.ReplicatedStorage:WaitForChild("Shared")
local Schedule = require(Shared.TerrainSchedule)
local Writer = require(game.ServerScriptService:WaitForChild("Server"):WaitForChild("TerrainWriter"))
local terrain = workspace.Terrain
local function emit(row) print("TERRAIN_BENCH:" .. H:JSONEncode(row)) end
local budgets = workspace:GetAttribute("TerrainBenchBudget") or "0.008"
local function plan(key)
 if key == "m04" then return require(Shared.M04WorldPlan).buildM04Plan().ops, 65536 end
 if key == "m05" then return require(Shared.M05WorldPlan).buildM05Plan().ops, 65536 end
 if key == "m02" then local M = require(Shared.M02WorldPlan); return M.buildM02Plan().ops, M.M02_FILL_CHUNK end
end
local function category(o)
 if o.material == "Water" then return "water" end
 if o.material == "Air" then return "air" end
 if o.sy == 4 and o.y == -2 then return "floor" end
 if o.sx == 4 or o.sz == 4 then return "curtain" end
 return "cap"
end
-- A native clear blocks the whole server: report the worst Heartbeat gap around it.
-- A native clear blocks the server (and its deferred thread can hit the script timeout):
-- report the wall time it took, outside the 3 s settle.
local function nativeClear()
 task.wait()
 local t0 = os.clock()
 task.defer(function() terrain:Clear() end)
 task.wait(3)
 return os.clock() - t0 - 3
end
local function write(label, ops, chunk, b)
 local jobs = Schedule.terrainJobs(ops, chunk)
 local cats = {}
 local start = os.clock()
 local frames = 0
 local conn = RS.Heartbeat:Connect(function() frames += 1 end)
 local run = Schedule.runBudgeted(jobs, function(job)
  local t0 = os.clock()
  Writer.TerrainWriter.WriteJob(terrain, job)
  local c = category(job.op)
  local e = cats[c] or { jobs = 0, seconds = 0, voxels = 0, longest = 0 }
  local dt = os.clock() - t0
  e.jobs += 1; e.seconds += dt; e.voxels += job.cells; e.longest = math.max(e.longest, dt)
  cats[c] = e
 end, { budget = b, clock = os.clock, pause = function() task.wait() end })
 conn:Disconnect()
 local wall = os.clock() - start
 emit({ label = label, budget = b, wall = wall, work = run.total, yields = run.yields, frames = frames, jobs = #jobs, longest = run.longest, cats = cats })
 return wall
end
-- Plan transforms used only to attribute cost; none is a shipped geometry.
local function variant(ops, name)
 if name == "base" then return ops end
 local out = {}
 for i, o in ops do
  local c = category(o)
  if name == "nofloor" and c == "floor" then continue end
  if name == "nocurtain" and c == "curtain" then continue end
  -- Sea cells as water alone, from the cap's bottom up to the surface (one chunk pass instead of two).
  if name == "seawater" and c == "cap" and o.y + o.sy / 2 < 32 then continue end
  if name == "seawater" and c == "water" then o = table.clone(o); o.y -= 4; o.sy += 8 end
  if name == "thinwater" and c == "floor" then continue end
  if name == "thinwater" and c == "water" then o = table.clone(o); local top = o.y + o.sy / 2; o.sy = 4; o.y = top - 2 end
  if name == "capsonly" and c ~= "cap" then continue end
  table.insert(out, o)
 end
 return out
end
local variants = workspace:GetAttribute("TerrainBenchVariants") or "base"
local airClear = workspace:GetAttribute("TerrainBenchAirClear") == true
task.wait(8)
for key in string.gmatch(mode, "[^,]+") do
 local all, chunk = plan(key)
 chunk = workspace:GetAttribute("TerrainBenchChunk") or chunk
 for name in string.gmatch(variants, "[^,]+") do
  local ops = variant(all, name)
  for budget in string.gmatch(tostring(budgets), "[^,]+") do
  budget = tonumber(budget)
  emit({ label = key .. ":" .. name .. ":preclear", seconds = nativeClear() })
  task.wait(2)
  write(key .. ":" .. name .. ":build", ops, chunk, budget)
  task.wait(2)
  if airClear then
   local air = {}
   for _, o in ops do local a = table.clone(o); a.material = "Air"; table.insert(air, a) end
   write(key .. ":" .. name .. ":airClear", air, chunk, budget)
   task.wait(1)
  end
  emit({ label = key .. ":" .. name .. ":nativeClear", seconds = nativeClear() })
  task.wait(2)
  end
 end
end
emit({ label = "done" })
