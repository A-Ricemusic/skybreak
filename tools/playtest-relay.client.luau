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
local old=player.PlayerScripts:FindFirstChild("BrokenRelayQA")
assert(not old,"A Broken Relay pilot is already installed; destroy its LocalScript and report before replacing")
local report=Instance.new("Folder");report.Name="BrokenRelayQA";report.Parent=player.PlayerScripts
report:SetAttribute("EvidenceType","Normal controls; real server results")
local current,phaseSince,activePhase,lastFire,lastCycle,lastEvade,extendUntil=nil,0,"",0,0,0,0
local attempts={}
local function stage(mission)
    local id=mission.missionId or 1;attempts[id]=(attempts[id] or 0)+1
    local entry=Instance.new("Folder");entry.Name=string.format("M%02d_Attempt%d",id,attempts[id]);entry.Parent=report
    entry:SetAttribute("MissionId",id);entry:SetAttribute("Outcome","Running");entry:SetAttribute("StartedAt",os.clock())
    entry:SetAttribute("MissileCommands",0);entry:SetAttribute("EvadeCommands",0);entry:SetAttribute("LowestHealth",100)
    current=entry;activePhase="";extendUntil=0
end
local stateConnection=game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(message)
    if message.kind=="Started" then stage(message);return end
    if message.kind~="Completed" and message.kind~="Failed" then return end
    if not current then return end
    local bp=Catalog:Get(message.missionId or 1)
    for _,field in {"kills","groundKills","elapsed","reason","saved","persistence"} do current:SetAttribute(field,message[field]) end
    local valid=message.kind=="Completed" and message.elapsed>0 and message.elapsed<600
        and message.kills>=Catalog:RequiredAirKills(bp) and message.groundKills==Catalog:RequiredGroundKills(bp)
    current:SetAttribute("Outcome",message.kind);current:SetAttribute("ResultValid",valid)
    print("BROKEN_RELAY_REAL_RESULT",current.Name,message.kind,message.elapsed,message.kills,message.groundKills,message.reason)
    current=nil
end)
local alive=true
script.Destroying:Connect(function() alive=false;stateConnection:Disconnect();local c=FlightController.GetActive();if c then c:SetInput(0,0)end end)
local c=FlightController.GetActive()
if c and c.active then stage(c:GetTelemetry()) end
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
    if controller and controller.active and controller.aircraft and controller.aircraft.Parent then
        local telemetry=controller:GetTelemetry();local now=os.clock();local phase=telemetry.phase or ""
        if not current then stage(telemetry) end
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
