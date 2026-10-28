-- Studio production API injection: exact selection via SetThrottle, held R1 via
-- the bound handler. Flight pose and mission progression remain authoritative.
assert(game:GetService('RunService'):IsStudio())
local p=game.Players.LocalPlayer
local C=require(p.PlayerScripts.Client.FlightController).FlightController
local F=require(game.ReplicatedStorage.Shared.FlightMath).FlightMath
local P=require(game.ReplicatedStorage.Shared.NavigationPilot).NavigationPilot
local H=game:GetService('HttpService')
local R=game.ReplicatedStorage.Remotes
local records,samples={},{}
local boundaryOnly=script:GetAttribute('BoundaryOnly')==true
local minAltitude,maxEdge=math.huge,0
local c;local alive=true;local phase='climb';local phaseStart=os.clock();local began=phaseStart
local function save() script:SetAttribute('Records',H:JSONEncode(records));script:SetAttribute('Samples',H:JSONEncode(samples)) end
R.MissionState.OnClientEvent:Connect(function(m) if m.kind=='Failed' then script:SetAttribute('Outcome','Failed:'..tostring(m.reason));alive=false;save() end end)
R.CampaignRequest:InvokeServer('ReturnToMenu');task.wait(.5)
assert(R.CampaignRequest:InvokeServer('StartMission',{slot=1,missionId=1,difficulty='normal',special='flares'}).ok)
repeat task.wait(.1);c=C.GetActive() until c and c.active
script:SetAttribute('Outcome','Running')
local spawn=c:GetControlStateForStudio();table.insert(records,{phase='spawn',selected=spawn.selectedMph,actual=spawn.actualMph})
local lastSample=os.clock();local stages={800,980,1900,3000};local stage=0;local selection;local initial
while alive and c.active and os.clock()-began<150 do
 local now=os.clock();local s=c:GetFlightState();local t=c:GetTelemetry()
 if s then
  local theta=math.atan2(s.z,s.x)+.65
  local tx,tz=1200*math.cos(theta),1200*math.sin(theta)
  local yaw=math.atan2(s.x-tx,s.z-tz)
  local pitch=math.clamp((1500-s.y)/500,-.3,.4)
  if phase=='boundary' then
   c:SetInput(0,select(2,P:Steer(s,s.yaw,0)))
   minAltitude=math.min(minAltitude,s.y);maxEdge=math.max(maxEdge,math.abs(s.x),math.abs(s.z))
  else c:SetInput(P:Steer(s,yaw,pitch)) end
  if phase=='climb' and s.y>1450 and math.abs(s.pitch)<.15 then phase='holds';phaseStart=now;stage=1;c:SetThrottle(F:ThrottleForSpeed(F:FromMph(stages[stage])));selection=stages[stage];initial=s;if boundaryOnly then phase='settle';c:SetThrottle(1) end end
  if phase=='settle' and now-phaseStart>9 then
   phase='boundary';phaseStart=now;initial=s
  elseif phase=='boundary' and now-phaseStart>20 then
   table.insert(records,{phase='boundary',start={initial.x,initial.y,initial.z},finish={s.x,s.y,s.z},minAltitude=minAltitude,maxEdge=maxEdge,selection=c:GetControlStateForStudio().selectedMph,actual=s.speed/.2});save();phase='done';alive=false
  elseif phase=='holds' and now-phaseStart>6 then
   local d=c:GetControlStateForStudio()
   table.insert(records,{phase='hold',requested=selection,selected=d.selectedMph,actual=d.actualMph,server=t.speed/.2,duration=now-phaseStart,start={initial.x,initial.y,initial.z},finish={s.x,s.y,s.z},input=d.command})
   stage+=1;phaseStart=now;initial=s
   if stage<=#stages then selection=stages[stage];c:SetThrottle(F:ThrottleForSpeed(F:FromMph(selection)))
   else phase='ramp';c:SetThrottle(F.CruiseThrottle);c:SimulateGamepadInput(Enum.KeyCode.ButtonR1,Enum.UserInputState.Begin) end
   save()
  elseif phase=='ramp' and now-phaseStart>14 then
   c:SimulateGamepadInput(Enum.KeyCode.ButtonR1,Enum.UserInputState.End);phase='cap-release';phaseStart=now
  elseif phase=='cap-release' and now-phaseStart>6 then
   local d=c:GetControlStateForStudio();table.insert(records,{phase='held-acceleration-and-release',selected=d.selectedMph,actual=d.actualMph,server=t.speed/.2,pose={s.x,s.y,s.z},axis=d.throttleStick});save();phase='done';alive=false
  end
  if now-lastSample>.5 then
   local d=c:GetControlStateForStudio();table.insert(samples,{phase=phase,wall=now-began,t=t.elapsed,dt=now-lastSample,selection=d.selectedMph,actual=d.actualMph,server=t.speed/.2,axis=d.throttleStick,input=d.command,pose={s.x,s.y,s.z,s.yaw,s.pitch},boundary=math.max(math.abs(s.x),math.abs(s.z))-F.SoftBoundary});lastSample=now;save()
  end
 end
 task.wait(.05)
end
c:SetInput(0,0)
if phase=='done' then
 assert(spawn.selectedMph==800,'Spawn selection')
 if boundaryOnly then
  assert(maxEdge>F.SoftBoundary,'Boundary was not reached')
  assert(minAltitude>1490,'Boundary lost altitude')
 else
  for _,r in records do if r.phase=='hold' then assert(math.abs(r.selected-r.requested)<.01 and math.abs(r.server-r.requested)<2,'Selection/airspeed drift') end end
  local last=records[#records];assert(last.selected==3000 and math.abs(last.server-3000)<2,'Held acceleration/release cap')
 end
 R.CampaignRequest:InvokeServer('ReturnToMenu');task.wait(.5)
 assert(R.CampaignRequest:InvokeServer('StartMission',{slot=1,missionId=1,difficulty='normal',special='flares'}).ok)
 repeat task.wait(.1);c=C.GetActive() until c and c.active
 local d=c:GetControlStateForStudio();assert(d.selectedMph==800 and d.actualMph==800,'New mission reset');table.insert(records,{phase='new-sortie',selected=d.selectedMph,actual=d.actualMph});c:SetPaused(true);script:SetAttribute('Outcome','Passed');save()
end
