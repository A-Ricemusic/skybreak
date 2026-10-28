-- Disclosed Studio production-API pilot. No state/pose/health/damage/kill overrides.
-- Inject as a LocalScript in PlayerScripts. Records JSON telemetry on script.
assert(game:GetService('RunService'):IsStudio())
local player=game.Players.LocalPlayer
local C=require(player.PlayerScripts.Client.FlightController).FlightController
local F=require(game.ReplicatedStorage.Shared.FlightMath).FlightMath
local P=require(game.ReplicatedStorage.Shared.NavigationPilot).NavigationPilot
local H=game:GetService('HttpService')
local samples,events={},{}
local remotes=game.ReplicatedStorage.Remotes
local function save() script:SetAttribute('Samples',H:JSONEncode(samples));script:SetAttribute('Events',H:JSONEncode(events)) end
remotes.MissionState.OnClientEvent:Connect(function(m)
 if m.kind=='Completed' or m.kind=='Failed' then
  table.insert(events,{kind=m.kind,reason=m.reason,kills=m.kills,groundKills=m.groundKills,elapsed=m.elapsed})
  script:SetAttribute('Outcome',m.kind);save()
 end
end)
remotes.CampaignRequest:InvokeServer('ReturnToMenu')
task.wait(.5)
local response=remotes.CampaignRequest:InvokeServer('StartMission',{slot=1,missionId=1,special='flares',difficulty='normal'})
assert(response.ok,response.error)
local c
repeat task.wait(.1);c=C.GetActive() until c and c.active
script:SetAttribute('Outcome','Running')
local began=os.clock();local phase='';local phaseAt=began;local lastSample=began;local lastFire=0;local lastCycle=0;local extend=0
while c.active and os.clock()-began<580 and script.Parent do
 local now=os.clock();local t=c:GetTelemetry();local s=c:GetFlightState()
 if t.phase~=phase then phase=t.phase;phaseAt=now;table.insert(events,{kind='phase',phase=phase,t=t.elapsed});save() end
 if s then
  local x,y=0,0
  if phase=='tutorial_move' then
   c:SetThrottle(F.CruiseThrottle)
   x=(math.floor((now-phaseAt)/1.5)%2==0) and .35 or -.35
   y=(math.floor((now-phaseAt)/.7)%2==0) and .3 or -.3
  else
   if phase=='tutorial_target' and now-lastCycle>1 then c:CycleTarget();lastCycle=now end
   local target=t.target
   local desiredYaw=s.yaw;local desiredPitch=math.clamp((650-s.y)/400,-.3,.3)
   if target and target.Parent then
    local delta=target:GetPivot().Position-Vector3.new(s.x,s.y,s.z)
    local ground=t.targetKind=='ground'
    local horizontal=Vector3.new(delta.X,0,delta.Z).Magnitude
    if ground and horizontal<450 and now>extend then extend=now+4 end
    if now>=extend then
     desiredYaw=math.atan2(-delta.X,-delta.Z)
     -- Aim down from safe clearance; arrest descent before flying through scenery.
     desiredPitch=math.clamp(math.atan2(delta.Y,horizontal),-.55,.55)
     if s.y<450 then desiredPitch=math.max(desiredPitch,(500-s.y)/300) end
    end
    c:SetThrottle(F:ThrottleForSpeed(ground and 160 or (delta.Magnitude>1400 and 320 or 220)))
    if phase~='tutorial_target' and now-lastFire>1.3 and t.lockProgress>=.99 and t.missileCooldown<=0 and now>=extend then
     c:FireMissile();lastFire=now
     table.insert(events,{kind='fire',t=t.elapsed,phase=phase,distance=delta.Magnitude,lock=t.lockProgress,speed=s.speed,position={s.x,s.y,s.z}});save()
    end
   end
   x,y=P:Steer(s,desiredYaw,desiredPitch)
   if t.incomingDistance and t.incomingDistance<650 then c:Evade() end
  end
  c:SetInput(x,y)
  if now-lastSample>=.5 then
   local d=c:GetControlStateForStudio()
   table.insert(samples,{wall=now-began,t=t.elapsed,phase=phase,selected=d.selectedMph,actual=t.speed/.2,input={x,y},pose={s.x,s.y,s.z,s.yaw,s.pitch},health=t.health,kills=t.kills,ground=t.groundKills,lock=t.lockProgress,dt=now-lastSample})
   lastSample=now;save()
  end
 end
 task.wait(.05)
end
c:SetInput(0,0);save()
