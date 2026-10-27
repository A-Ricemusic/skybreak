-- Temporary normal Script in ServerScriptService of a fresh, unpublished Studio
-- session. Runs real CombatService stepping with a fixture target held in its
-- envelope. Bypasses campaign/save selection; this is not a normal-play result.
local report=Instance.new("Folder");report.Name="TargetingServerValidation";report.Parent=workspace
local combat=require(game.ServerScriptService.Server.CombatService).CombatService
local player=game.Players:GetPlayers()[1]
local connection
local ok,err=pcall(function()
    local started,message=combat:StartMission(player,4,1,"flares","normal")
    assert(started,message)
    local session=combat:GetSession(player)
    local deadline=os.clock()+30
    while session.loading and os.clock()<deadline do task.wait(.1) end
    assert(not session.loading,"Client did not release loading gate")
    session.rules.phase="tutorial_missile";session.rules.stepSince=session.rules.elapsed;session.appliedPhase=nil
    task.wait(.2)
    local enemy=session.enemies[1];assert(enemy and enemy.kind=="ground","Need actual ground target")
    enemy.enabled=true;enemy.health=55;enemy.model:SetAttribute("Damageable",true)
    session.target=enemy;session.lockProgress=0
    local flight=require(game.ReplicatedStorage.Shared.FlightMath).FlightMath
    local function place()
        local x,y,z=flight:ForwardOf(session.state)
        enemy.position=Vector3.new(session.state.x,session.state.y,session.state.z)+Vector3.new(x,y,z)*1200
        enemy.model:PivotTo(CFrame.new(enemy.position))
    end
    place();connection=game:GetService("RunService").Heartbeat:Connect(place)
    local at=os.clock();local start=session.stepCount;local samples={}
    while session.active and session.lockProgress<.99 and os.clock()-at<3 do
        task.wait()
        table.insert(samples,{steps=session.stepCount-start,lock=session.lockProgress,wall=os.clock()-at})
    end
    report:SetAttribute("Completed",session.lockProgress>=.99)
    report:SetAttribute("Lock",session.lockProgress)
    report:SetAttribute("Steps",session.stepCount-start)
    report:SetAttribute("WallSeconds",os.clock()-at)
    report:SetAttribute("LockBuildSeconds",require(game.ReplicatedStorage.Shared.WeaponRules).WeaponRules.LockBuildSeconds)
    report:SetAttribute("Damageable",enemy.model:GetAttribute("Damageable"))
    report:SetAttribute("Samples",game:GetService("HttpService"):JSONEncode(samples))
    assert(session.lockProgress>=.99,"Server failed to acquire lock")
    -- Server fixed-step quantization may round .45 s up to the next tick.
    local steps=session.stepCount-start
    local tick=1/30
    assert(steps*tick>=.45 and steps*tick<.45+tick+.0001,"Unexpected lock timing")
end)
if connection then connection:Disconnect() end
combat:EndMission(player)
if not ok then report:SetAttribute("Error",tostring(err));error(err) end
