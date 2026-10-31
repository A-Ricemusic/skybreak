local Catalog=require("./MissionCatalog").MissionCatalog
assert(Catalog:RequiredAirKills(Catalog:Get(1))==6)
assert(Catalog:RequiredGroundKills(Catalog:Get(1))==0)
assert(Catalog:TotalPhases(Catalog:Get(1))==1)
local passed=0
local function scenario(late,detach)
    local time=0
    local function signal()
        local callback
        return {Connect=function(_,fn) callback=fn;return {Disconnect=function() callback=nil end} end,
            fire=function(_,...) if callback then callback(...) end end}
    end
    local objects={}
    local function object()
        local attrs={}
        local o={}
        function o:SetAttribute(k,v) attrs[k]=v end
        function o:GetAttribute(k) return attrs[k] end
        function o:GetChildren() local c={} for _,v in objects do if v.Parent==self then table.insert(c,v) end end return c end
        function o:WaitForChild() return self end
        function o:FindFirstChild() return nil end
        table.insert(objects,o);return o
    end
    local scripts=object();scripts.Client={FlightController="controller"}
    local player={PlayerScripts=scripts,WaitForChild=function() return scripts end}
    local event=signal();local destroying=signal()
    local controller={active=late,aircraft={Parent=true},throttle=.73,commands=0}
    function controller:GetTelemetry() return {missionId=1,phase="idle",elapsed=10,health=90,lockProgress=0,missileCooldown=1} end
    function controller:GetThrottle() return self.throttle end
    function controller:SetThrottle(v) self.throttle=v;self.commands+=1 end
    function controller:SetInput() self.commands+=1 end
    function controller:GetFlightState() return {} end
    function controller.aircraft:GetPivot() return {} end
    local services={RunService={IsStudio=function() return true end},Players={LocalPlayer=player}}
    local game={ReplicatedStorage={Shared={NavigationPilot="pilot",MissionCatalog="catalog",GameConfig="config"},Remotes={MissionState={OnClientEvent=event}}},GetService=function(_,name) return services[name] end}
    local Instance={new=object}
    local script={Destroying=destroying,GetAttribute=function() return nil end}
    local task={wait=function(dt) time+=dt;coroutine.yield() end}
    local os={clock=function() return time end}
    local function require(module)
        if module==scripts then return {FlightController={GetActive=function() return controller end}} end
        if module=="pilot" then return {NavigationPilot={}} end
        if module=="catalog" then return {MissionCatalog=Catalog} end
        if module=="config" then return {GameConfig={Campaign={MissionTimeLimit=1000}}} end
        error("Unexpected require")
    end
    local thread=coroutine.create(function()
-- ACTUAL_PILOT
    end)
    local function tick(n) for _=1,n or 1 do local ok,err=coroutine.resume(thread);assert(ok,err) end end
    local function entries() local result={} for _,v in objects do if v.Name and string.match(v.Name,"^M%d+_Attempt") then table.insert(result,v) end end return result end
    local function start(id) controller.active=true;event:fire({kind="Started",missionId=id or 1,aircraft=controller.aircraft,slot=1}) end
    tick();if not late then assert(#entries()==0);start() end
    start();tick();assert(#entries()==1)
    if detach then
        assert(controller.throttle~=.73);destroying:fire()
        assert(controller.throttle==.73 and controller.active);passed+=1;return
    end
    local function finish(kind,extra)
        local msg={kind=kind,missionId=1,kills=8,groundKills=0,optionalKills=2,completedPhases=1,elapsed=100}
        for k,v in extra or {} do msg[k]=v end
        event:fire(msg)
    end
    finish("Completed");local entry=entries()[1]
    assert(entry:GetAttribute("ResultValid")==true and entry:GetAttribute("AirKills")==8 and entry:GetAttribute("RequiredAirKillsObserved")==6)
    local commands=controller.commands
    finish("Failed");start();tick(37) -- 1.2 second active result hold, including duplicate Started/result.
    assert(#entries()==1 and entry:GetAttribute("Outcome")=="Completed" and controller.commands==commands)
    controller.active=false;tick();controller.aircraft={Parent=true,GetPivot=function() return {} end};start();tick()
    assert(#entries()==2 and entries()[2].Name=="M01_Attempt2")
    finish("Completed",{kills=5,optionalKills=0}) -- total meets required air, actual air does not.
    assert(entries()[2]:GetAttribute("ResultValid")==false)
    controller.aircraft={Parent=true,GetPivot=function() return {} end};start();tick()
    finish("Completed",{optionalKills=false,completedPhases=false})
    assert(entries()[3]:GetAttribute("ResultValid")==false)
    controller.aircraft={Parent=true,GetPivot=function() return {} end};start();tick()
    finish("Failed",{reason="destroyed"});finish("Completed");tick(37)
    assert(#entries()==4 and entries()[4]:GetAttribute("Outcome")=="Failed" and entries()[4]:GetAttribute("ResultValid")==false)
    controller.aircraft={Parent=true,GetPivot=function() return {} end};start(11);tick()
    assert(#entries()==4) -- mission 11 remains a locked placeholder and is never admitted
    commands=controller.commands;destroying:fire();assert(controller.commands==commands)
    passed+=1
end
scenario(false);scenario(true);scenario(true,true)
print("PLAYTEST_RELAY_REGRESSION passed="..passed.." failed=0")
