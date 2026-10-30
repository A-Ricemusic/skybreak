-- Studio-only world timing through the real campaign request path (M04, M1, M2) and the
-- real M05 builder (mission 5 is not yet selectable). Prior missions are fixtures.
assert(game:GetService('RunService'):IsStudio())
local H=game:GetService('HttpService')
local RS=game:GetService('RunService')
local report=Instance.new('Folder');report.Name='WorldPerf';report.Parent=workspace
local function record(kind,data)
 local v=Instance.new('StringValue');v.Name=kind;v.Value=H:JSONEncode(data);v.Parent=report
 print('WORLD_PERF:'..kind..':'..v.Value)
end
-- Longest Heartbeat gap during each phase: cleanup must not stall the server.
local gap,last=0,os.clock()
RS.Heartbeat:Connect(function() local now=os.clock(); gap=math.max(gap,now-last); last=now end)
local function resetGap() gap=0; last=os.clock() end
local ok,err=xpcall(function()
 local player=game.Players:GetPlayers()[1] or game.Players.PlayerAdded:Wait()
 local server=game.ServerScriptService:WaitForChild('Server')
 local C=require(server.CampaignService);local Combat=require(server.CombatService).CombatService
 local Catalog=require(game.ReplicatedStorage.Shared.MissionCatalog).MissionCatalog
 local Repo=require(server.CampaignRepository)
 repeat task.wait(1) until game.ReplicatedStorage:FindFirstChild('Remotes')
 task.wait(5)
 local request=function(id)return C.QARequest(player,'StartMission',{slot=1,missionId=id,difficulty='easy'})end
 Catalog:Get(3).available=true -- isolated fixture until #147 merges
 local coordinator=C.QACoordinator(player)
 for id=1,3 do
  local bp=Catalog:Get(id)
  assert(Repo.completeMission(coordinator,1,id,true,{slot=1,missionId=id,kills=Catalog:RequiredAirKills(bp)+Catalog:RequiredGroundKills(bp),groundKills=Catalog:RequiredGroundKills(bp),completedPhases=Catalog:TotalPhases(bp),elapsed=100},function()end,0))
 end
 local function launch(id)
  local started,result
  local deadline=os.clock()+120
  repeat task.wait(2); resetGap(); started=os.clock(); result=request(id) until result.ok or os.clock()>deadline
  assert(result.ok,H:JSONEncode(result))
  local wall=os.clock()-started
  local s=Combat:GetSession(player);assert(s and s.missionId==id)
  record('Build'..id,{requestSeconds=wall,seconds=s.folder:GetAttribute('WorldBuildSeconds'),terrainSeconds=s.folder:GetAttribute('WorldTerrainReadySeconds'),jobs=s.folder:GetAttribute('WorldTerrainJobs'),longestJob=s.folder:GetAttribute('WorldTerrainLongest'),worstHeartbeat=gap})
  task.wait(3)
  resetGap()
  local t0=os.clock(); Combat:EndMission(player); local endSeconds=os.clock()-t0
  -- Cleanup may continue in its own threads; wait until the menu world is rebuilt.
  local doneAt
  repeat if workspace:FindFirstChild('World') then doneAt=os.clock() else task.wait(0.1) end until doneAt or os.clock()-t0>120
  -- The shared world gate (when present) is idle only once the clear and menu restore both finished.
  local LR=server:FindFirstChild('WorldLifecycleRuntime')
  local idleAt
  if LR then local gate=require(LR).worldLifecycle; repeat task.wait(0.1) until gate:Idle() or os.clock()-t0>200; idleAt=os.clock() end
  record('Cleanup'..id,{endMissionSeconds=endSeconds,menuBackSeconds=doneAt and doneAt-t0,gateIdleSeconds=idleAt and idleAt-t0,worstHeartbeat=gap})
 end
 local order=workspace:GetAttribute('WorldPerfOrder') or '4,1,2'
 for token in string.gmatch(order,'[^,]+') do
  local id=tonumber(token)
  if token=='fail4' then
   -- Injected failure after M04 has written all its terrain: the launch must fail cleanly and the
   -- world gate must clear the partial world before the next launch builds.
   local M4=require(server.M04World).M04World
   local build=M4.Build
   M4.Build=function(...) local r=build(...); error('QA injected M04 failure after terrain') end
   task.wait(2); resetGap()
   local t0=os.clock(); local r=request(4); M4.Build=build
   assert(not r.ok,'Injected failure launched')
   local LR=server:FindFirstChild('WorldLifecycleRuntime')
   if LR then local gate=require(LR).worldLifecycle; repeat task.wait(0.1) until gate:Idle() or os.clock()-t0>200 end
   record('InjectedFailure4',{result=r,gateIdleSeconds=os.clock()-t0,worstHeartbeat=gap,terrainDirty=server:FindFirstChild('TerrainState') and require(server.TerrainState).terrainDirty()})
  elseif token=='relaunch4' then
   -- Launch mission 1 the moment M04 ends: it must wait for M04's cleanup, not build over it.
   local deadline=os.clock()+120; local r
   repeat task.wait(2); r=request(4) until r.ok or os.clock()>deadline
   assert(r.ok,H:JSONEncode(r)); task.wait(3)
   local t0=os.clock(); Combat:EndMission(player)
   local r1=request(1)
   local s=Combat:GetSession(player)
   record('ImmediateRelaunch',{ok=r1.ok,error=r1.error,waitedSeconds=os.clock()-t0,mission=s and s.missionId,terrain=s and s.folder:GetAttribute('WorldTerrainJobs')})
   assert(r1.ok and s and s.missionId==1,'Relaunch after M04 failed')
   task.wait(3); Combat:EndMission(player)
  elseif id==5 then
   -- Real M05 builder, outside the campaign (mission 5 has no playable data on this branch).
   local M05=require(server.M05World).M05World
   local MW=require(server.MissionWorld).MissionWorld
   local folder=Instance.new('Folder');folder.Name='M05Perf';folder.Parent=workspace
   local TS=server:FindFirstChild('TerrainState')
   if TS then require(TS).beginTerrainWrite() end
   task.wait(2); resetGap()
   local t0=os.clock(); M05.Build(folder); local wall=os.clock()-t0
   record('Build5',{requestSeconds=wall,seconds=folder:GetAttribute('WorldBuildSeconds'),terrainSeconds=folder:GetAttribute('WorldTerrainReadySeconds'),jobs=folder:GetAttribute('WorldTerrainJobs'),longestJob=folder:GetAttribute('WorldTerrainLongest'),worstHeartbeat=gap})
   task.wait(3); resetGap()
   t0=os.clock()
   folder:Destroy()
   local LR=server:FindFirstChild('WorldLifecycleRuntime')
   if LR then
    -- The real gate path: M05's registered clear, then the menu restore.
    local R=require(LR); R.worldLifecycle:Cleanup({clear=R.worldClear('m05_night_refinery'),restore=function() MW.RestoreMenu() end})
    repeat task.wait(0.1) until R.worldLifecycle:Idle() or os.clock()-t0>200
   else
    -- Before the gate: the menu restore's native clear, isolated from the script timeout.
    local th=task.defer(function() MW.RestoreMenu() end)
    repeat task.wait(0.1) until coroutine.status(th)=='dead'
   end
   record('Cleanup5',{gateIdleSeconds=os.clock()-t0,worstHeartbeat=gap})
  else launch(id) end
 end
 report:SetAttribute('Complete',true)
end,debug.traceback)
if not ok then record('Error',{message=tostring(err)});report:SetAttribute('Failed',true) end
