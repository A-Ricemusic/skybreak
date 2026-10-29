-- Studio lease REQUIRED before installing/running. This is a normal LocalScript.
-- Launch each sortie from the real UI. This persistent pilot handles only the
-- same stick, throttle, target, missile and evade methods used by that UI.
-- It NEVER changes aircraft CFrames, health, damage, timer, progress or results.
assert(game:GetService("RunService"):IsStudio(), "QA pilot is Studio-only")
local Players=game:GetService("Players")
local player=Players.LocalPlayer
local FlightController=require(player:WaitForChild("PlayerScripts"):WaitForChild("Client"):WaitForChild("FlightController")).FlightController
local shared=game.ReplicatedStorage.Shared
local Pilot=require(shared.NavigationPilot).NavigationPilot
local Catalog=require(shared.MissionCatalog).MissionCatalog
-- Per-sortie deadlines and release state come from the current catalog.
local old=player.PlayerScripts:FindFirstChild("BrokenRelayQA")
assert(not old,"A Broken Relay pilot is already installed; destroy its LocalScript and report before replacing")
local report=Instance.new("Folder");report.Name="BrokenRelayQA";report.Parent=player.PlayerScripts
report:SetAttribute("EvidenceType","Normal controls; real server results")
local current,phaseSince,activePhase,lastFire,lastCycle,lastEvade,extendUntil=nil,0,"",0,0,0,0
local attempts={}
local seenAircraft={}
local controlled,manualThrottle=nil,nil
local function stage(mission)
    local aircraft=mission.aircraft
    if aircraft and seenAircraft[aircraft] then return end
    if aircraft then seenAircraft[aircraft]=true end
    local id=mission.missionId or 1;if not Catalog:Available(id) then return end;attempts[id]=(attempts[id] or 0)+1
    local entry=Instance.new("Folder");entry.Name=string.format("M%02d_Attempt%d",id,attempts[id]);entry.Parent=report
    entry:SetAttribute("MissionId",id);entry:SetAttribute("Outcome","Running");entry:SetAttribute("StartedAt",os.clock())
    entry:SetAttribute("MissileCommands",0);entry:SetAttribute("EvadeCommands",0);entry:SetAttribute("LowestHealth",100)
    current=entry;activePhase="";extendUntil=0
end
local stateConnection=game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(message)
    if message.kind=="Started" then stage(message);return end
    if message.kind~="Completed" and message.kind~="Failed" then return end
    if not current or current:GetAttribute("Outcome")~="Running" then return end
    if message.missionId and message.missionId~=current:GetAttribute("MissionId") then return end
    local bp=Catalog:Get(current:GetAttribute("MissionId"))
    -- MissionFinished.kills is TOTAL; optionalKills counts optional AIR kills.
    -- Older/fallback results may omit counters: preserve that absence, never infer success.
    for _,field in {"kills","groundKills","optionalKills","completedPhases","elapsed","reason","saved","persistence"} do current:SetAttribute(field,message[field]) end
    local function count(value)
        return type(value)=="number" and value==value and value>=0 and value<math.huge and value%1==0
    end
    local air=count(message.kills) and count(message.groundKills) and message.kills>=message.groundKills and message.kills-message.groundKills or nil
    local requiredAir=air and count(message.optionalKills) and message.optionalKills<=air and air-message.optionalKills or nil
    current:SetAttribute("AirKills",air);current:SetAttribute("RequiredAirKillsObserved",requiredAir)
    local valid=message.kind=="Completed" and type(message.elapsed)=="number" and message.elapsed>0 and message.elapsed<Catalog:CountdownSeconds(bp)
        and requiredAir~=nil and requiredAir>=Catalog:RequiredAirKills(bp)
        and message.groundKills==Catalog:RequiredGroundKills(bp)
        and count(message.completedPhases) and message.completedPhases==Catalog:TotalPhases(bp)
    current:SetAttribute("Outcome",message.kind);current:SetAttribute("ResultValid",valid)
    print("BROKEN_RELAY_REAL_RESULT",current.Name,message.kind,message.elapsed,message.kills,message.groundKills,message.reason)
    -- Keep the terminal entry latched until a distinct real Started event.
    controlled=nil;manualThrottle=nil
end)
local alive=true
script.Destroying:Connect(function() alive=false;stateConnection:Disconnect();local c=FlightController.GetActive();if c and c.active and c==controlled and current and current:GetAttribute("Outcome")=="Running" then c:SetInput(0,0);c:SetThrottle(manualThrottle) end end)
local c=FlightController.GetActive()
if c and c.active then stage({missionId=c:GetTelemetry().missionId,aircraft=c.aircraft}) end
-- The predicted flight state (attitude quaternion and derived yaw/pitch/roll): the stick
-- commands rates, so the pilot closes the loop on the real nose, not the evade-rolled pivot.
local function stateFor(controller,frame)
    local state=controller:GetFlightState()
    if state then return state end
    local look=frame.LookVector
    return {x=frame.Position.X,y=frame.Position.Y,z=frame.Position.Z,yaw=math.atan2(-look.X,-look.Z),pitch=math.asin(math.clamp(look.Y,-1,1)),roll=0,speed=200}
end
local function controlsFor(controller,frame,point,radius,orbit,ceiling)
    return Pilot:Controls(stateFor(controller,frame),{x=point.X,y=point.Y,z=point.Z},radius,orbit,ceiling)
end
while alive do
    local controller=FlightController.GetActive()
    if controller and controller.active and controller.aircraft and controller.aircraft.Parent and current and current:GetAttribute("Outcome")=="Running" then
        local telemetry=controller:GetTelemetry();local now=os.clock();local phase=telemetry.phase or ""
        if controlled~=controller then controlled=controller;manualThrottle=controller:GetThrottle() end
        if phase~=activePhase then
            activePhase=phase;phaseSince=now;extendUntil=0
            current:SetAttribute("Phase",phase)
            local record=Instance.new("StringValue");record.Name=string.format("Phase_%03d",#current:GetChildren()+1);record.Value=phase.." @ "..tostring(telemetry.elapsed);record.Parent=current
        end
        local frame=controller.aircraft:GetPivot();local nav=telemetry.navigation
        local flightPhase=nav and (phase=="route" or phase=="recon" or phase=="signal" or phase=="escort" or phase=="defend")
        local target=telemetry.target;local hasTarget=target and target.Parent
        if phase=="tutorial_move" then
            -- Turn and pitch for the teaching step; the stick is a rate, so alternate nose up/down.
            controller:SetThrottle(.5);controller:SetInput(.3,math.floor((now-phaseSince)/1.5)%2==0 and .3 or -.3)
        elseif phase=="tutorial_target" then
            controller:SetInput(0,0);if now-phaseSince>1 then controller:CycleTarget() end
        else
            local aim=hasTarget and target:GetPivot().Position or nil
            -- Maintain the flight volume when far out. Inside it, clear raiders
            -- with ordinary missile locks; then return to the orbit/beacon.
            local outside=flightPhase and (nav-frame.Position).Magnitude>(telemetry.navigationRadius or 210)*.85
            local navigate=flightPhase and (phase=="route" or outside or not hasTarget)
            if navigate then
                local input=controlsFor(controller,frame,nav,telemetry.navigationRadius or 210,phase~="route",telemetry.navigationCeiling)
                controller:SetInput(input.x,input.y);controller:SetThrottle(input.throttle)
            elseif aim then
                local delta=aim-frame.Position
                if telemetry.targetKind=="ground" and delta.Magnitude<450 and now>=extendUntil then extendUntil=now+4 end
                local state=stateFor(controller,frame)
                if now<extendUntil then controller:SetInput(Pilot:Steer(state,state.yaw,.1));controller:SetThrottle(.55)
                elseif delta.Magnitude>1 then
                    local desired=math.atan2(-delta.X,-delta.Z)
                    local pitch=math.clamp(math.asin(math.clamp(delta.Unit.Y,-1,1)),-.6,.6)
                    if telemetry.navigationCeiling and frame.Position.Y>telemetry.navigationCeiling-50 then pitch=math.min(pitch,-.12) end
                    controller:SetInput(Pilot:Steer(state,desired,pitch))
                    -- Climbs now trade speed: keep a margin over the 140 stud/s stall in close fights.
                    controller:SetThrottle(delta.Magnitude>1600 and .6 or .4)
                end
            else controller:SetInput(.3,0);controller:SetThrottle(.2) end
            if script:GetAttribute("HoldFire")~=true and not navigate and now>=extendUntil and telemetry.lockProgress>=.99 and telemetry.missileCooldown<=0 and now-lastFire>1.2 then
                controller:FireMissile();lastFire=now;current:SetAttribute("MissileCommands",current:GetAttribute("MissileCommands")+1)
            end
            if hasTarget and not flightPhase and telemetry.targetRequired==false and now-lastCycle>.5 then controller:CycleTarget();lastCycle=now end
        end
        if script:GetAttribute("NoEvade")~=true and telemetry.incoming and telemetry.evadeCooldown<=0 and now-lastEvade>2.5 then
            controller:Evade();lastEvade=now;current:SetAttribute("EvadeCommands",current:GetAttribute("EvadeCommands")+1)
        end
        current:SetAttribute("LowestHealth",math.min(current:GetAttribute("LowestHealth"),telemetry.health))
        current:SetAttribute("ProtectedHealth",telemetry.protectedHealth)
        current:SetAttribute("Elapsed",telemetry.elapsed)
    end
    task.wait(1/30)
end
