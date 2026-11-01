-- Scripted server integration: real campaign request/settlement and accepted kill
-- path with generated Studio-only hooks. Prior missions are fixtures, not flown.
assert(game:GetService('RunService'):IsStudio())
local H=game:GetService('HttpService')
local report=Instance.new('Folder');report.Name='M04Verification';report.Parent=workspace
local function record(kind,data)
 local v=Instance.new('StringValue');v.Name=kind;v.Value=H:JSONEncode(data);v.Parent=report
 print('M04_VERIFY:'..kind..':'..v.Value)
end
local ok,err=xpcall(function()
 local player=game.Players:GetPlayers()[1] or game.Players.PlayerAdded:Wait()
 local server=game.ServerScriptService:WaitForChild('Server')
 local C=require(server.CampaignService);local Combat=require(server.CombatService)
 local Catalog=require(game.ReplicatedStorage.Shared.MissionCatalog).MissionCatalog
 local Repo=require(server.CampaignRepository)
 local Jam=require(server.RearmRuntime)
 repeat task.wait(1) until game.ReplicatedStorage:FindFirstChild('Remotes')
 task.wait(5)
 local request=function(id)return C.QARequest(player,'StartMission',{slot=1,missionId=id,difficulty='easy'})end
 local forged=request(4);assert(not forged.ok,'Forged M04 accepted');record('ForgedRequest',forged)
 Catalog:Get(3).available=true -- isolated fixture until #147 merges
 local coordinator=C.QACoordinator(player)
 for id=1,3 do
  local bp=Catalog:Get(id)
  assert(Repo.completeMission(coordinator,1,id,true,{slot=1,missionId=id,kills=Catalog:RequiredAirKills(bp)+Catalog:RequiredGroundKills(bp),groundKills=Catalog:RequiredGroundKills(bp),completedPhases=Catalog:TotalPhases(bp),elapsed=100},function()end,0))
 end
 task.wait(2) -- respect the real campaign request budget after the forged request
 local started=request(4);assert(started.ok,H:JSONEncode(started));record('Launch',started)
 local s=Combat.CombatService:GetSession(player);assert(s and s.missionId==4)
 task.wait(3)
 record('Build',{seconds=s.folder:GetAttribute('WorldBuildSeconds'),terrainSeconds=s.folder:GetAttribute('WorldTerrainReadySeconds'),jobs=s.folder:GetAttribute('WorldTerrainJobs')})
 local ids,assets={},{};for _,e in s.enemies do if not e.friendly then assert(not ids[e.id]);ids[e.id]=true;assets[e.id]={source=e.model:GetAttribute('GeometrySource'),asset=e.model:GetAttribute('UploadedAsset')} end end
 assert(Jam.liveJammers(s)==2);assert(not Jam.lockAllowed(s,1201));record('Initial',{jammers=2,ids=ids,assets=assets})
 report:SetAttribute('CaptureReady',true)
 if workspace:GetAttribute('M04HoldForCapture') == true then repeat task.wait(.5) until report:GetAttribute('Continue') end
 local function kill(id)
  local deadline=os.clock()+10
  repeat
   for _,e in s.enemies do if e.id==id and e.health>0 then Combat.QAKill(s,e);return end end
   task.wait(.1)
  until os.clock()>deadline
  error('Missing '..id)
 end
 kill('m04_jammer_1');assert(Jam.liveJammers(s)==1);assert(not Jam.lockAllowed(s,1201));record('PartialJam',{jammers=1});task.wait(.5)
 kill('m04_jammer_2');assert(Jam.liveJammers(s)==0);assert(Jam.lockAllowed(s,9000));record('ClearRadar',{jammers=0});task.wait(.5)
 kill('m04_transport_1');task.wait(3)
 for i=1,9 do kill('m04_escort_'..i) end
 kill('m04_ace');kill('m04_transport_2')
 assert(s.blueprintState.outcome==nil)
 kill('m04_transport_3');task.wait(3)
 local saved=coordinator:getSlots()[1].missions[4];assert(saved.completed and saved.bestScore==1540 and saved.bestRank=='S')
 record('Settlement',saved)
 local deadline=os.clock()+90;local again
 repeat task.wait(2);again=request(0) until again.ok or os.clock()>deadline
 assert(again.ok,H:JSONEncode(again));record('SubsequentLaunch',{ok=true,missionId=0})
 Combat.CombatService:EndMission(player)
 report:SetAttribute('Complete',true)
end,debug.traceback)
if not ok then record('Error',{message=tostring(err)});report:SetAttribute('Failed',true) end
