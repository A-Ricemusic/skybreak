-- Deliberately small service doubles: verifies ownership and events, never audio fidelity.
local instances, tweens, jobs, debris = {}, {}, {}, {}
local function signal()
 local listeners = {}
 return {
  Connect = function(self, fn)
   local c = {Connected=true}; function c:Disconnect() self.Connected=false end
   table.insert(listeners, {c=c, fn=fn}); return c
  end,
  Once = function(self, fn)
   local c; c=self:Connect(function(...) c:Disconnect(); fn(...) end); return c
  end,
  Fire = function(self, ...) for _,v in listeners do if v.c.Connected then v.fn(...) end end end,
 }
end
local Instance = {}
function Instance.new(class)
 local v = {ClassName=class, Name=class, Volume=0, PlaybackSpeed=1, Position=nil, ChildAdded=signal(), Ended=signal(), attributes={}, signals={}}
 function v:IsA(kind) return self.ClassName==kind or (kind=="BasePart" and self.ClassName=="Part") end
 function v:GetChildren() local children={} for _,o in instances do if o.Parent==self then table.insert(children,o) end end return children end
 function v:Destroy() if self.destroyed then return end; for _,o in self:GetChildren() do o:Destroy() end; self.Parent=nil; self.destroyed=true; self.IsPlaying=false end
 function v:Play() assert(not self.destroyed); self.IsPlaying=true end
 function v:Pause() self.IsPlaying=false end
 function v:Resume() assert(not self.destroyed); self.IsPlaying=true end
 function v:Stop() self.IsPlaying=false end
 function v:GetAttribute(key) return self.attributes[key] end
 function v:GetAttributeChangedSignal(key) self.signals[key]=self.signals[key] or signal(); return self.signals[key] end
 function v:SetAttribute(key,value) self.attributes[key]=value; self:GetAttributeChangedSignal(key):Fire() end
 table.insert(instances,v); return v
end
local vector
local vectorMt={
 __sub=function(a,b) return vector(a.X-b.X) end,
 __add=function(a,b) return vector(a.X+b.X) end,
 __mul=function(a,b) return vector(a.X*b) end,
}
vector=function(x)
 return setmetatable({X=x, Magnitude=math.abs(x), Dot=function(self,b) return self.X*b.X end},vectorMt)
end
local Vector3={one=vector(1)}
local NumberRange={new=function(a,b) return {Min=a,Max=b} end}
local TweenInfo={new=function(t) return t end}
local Enum={AssetFetchStatus={Failure="failure"}, RollOffMode={InverseTapered=1}}
local task={spawn=function(fn) table.insert(jobs,fn) end}
local warn=function() end
local gui=Instance.new("PlayerGui")
local _services={
 Players={LocalPlayer={FindFirstChildOfClass=function() return gui end}},
 SoundService=Instance.new("SoundService"), Workspace=Instance.new("Workspace"),
 ContentProvider={PreloadAsync=function() end},
 Debris={AddItem=function(self,owner) table.insert(debris,owner) end},
 TweenService={Create=function(self,owner,info,props)
  local t={}; function t:Play() end; function t:Cancel() self.cancelled=true end; function t:Destroy() self.destroyed=true end
  function t:Complete() if not self.cancelled then owner.Volume=props.Volume end end
  table.insert(tweens,t); return t
 end},
}
local explosion=signal(); local speaking=signal()
local CombatEffects={OnExplosion=function(self,fn) local c=explosion:Connect(fn); return function() c:Disconnect() end end}
local VoicePlayer={OnSpeaking=function(self,fn) local c=speaking:Connect(fn); return function() c:Disconnect() end end}
local duckGain=function(value) return value and 0.5 or 1 end
local AudioRules=(function()
-- INSERT AudioRules
end)().AudioRules
local SoundBank=(function()
-- INSERT SoundBank
end)().SoundBank
local GameAudio=(function()
-- INSERT GameAudio
end)().GameAudio
local count=0
local function test(name,fn) fn(); count+=1; print("PASS "..name) end
local function fixture()
 local audio=GameAudio.new(); local folder=Instance.new("Folder"); local plane=Instance.new("Model"); plane.Parent=folder; audio:Start(plane)
 return audio,folder,plane
end
local function missile(folder)
 local part=Instance.new("Part"); part.Name="HostileMissile"; part.Position=vector(500); part.Parent=folder; folder.ChildAdded:Fire(part); return part
end
local function step(audio) audio:Step(0.11,0.65,300,vector(0),false) end
local function telemetry(target,damageable)
 return {target=target,targetDamageable=damageable,lockProgress=0.5,incoming=false,health=100,evadeCooldown=0}
end
test("mute cancels both duck and release tweens",function()
 local a=fixture(); speaking:Fire(true); gui:SetAttribute("SfxVolume",0)
 for _,t in tweens do t:Complete() end; assert(a.group.Volume==0)
 gui:SetAttribute("SfxVolume",1); speaking:Fire(false); gui:SetAttribute("SfxVolume",0)
 for _,t in tweens do t:Complete() end; assert(a.group.Volume==0); a:Destroy(); gui:SetAttribute("SfxVolume",1)
end)
test("pause suppresses gameplay cues and resume reconciles missiles",function()
 local a,f=fixture(); a:SetPaused(true); local p=missile(f)
 a:Telemetry(telemetry(Instance.new("Model"),true)); step(a)
 explosion:Fire(vector(0),nil,"hit")
 assert(#a.oneShots==0 and next(a.motors)==nil and a.warning==nil)
 a:SetPaused(false); step(a); assert(a.motors[p] and a.motors[p].sound.IsPlaying); assert(#a.oneShots==0); a:Destroy()
end)
test("death releases all loops and listeners; retry starts clean",function()
 local a,f,p=fixture(); missile(f)
 local enemy=Instance.new("Model"); enemy.Parent=f; enemy:SetAttribute("SkybreakEnemy",true); enemy:SetAttribute("TargetKind","air")
 local root=Instance.new("Part"); root.Parent=enemy; root.Position=vector(100); enemy.PrimaryPart=root
 a:Telemetry(telemetry(enemy,true)); step(a); assert(a.warning and next(a.engines))
 explosion:Fire(vector(0),nil,"player")
 assert(a.dead and next(a.motors)==nil and next(a.engines)==nil and a.cruise==nil and #a.connections==0)
 local shots=#a.oneShots; missile(f); assert(#a.oneShots==shots)
 a:Start(p); assert(not a.dead and a.cruise.IsPlaying and #a.oneShots==0 and a.observed==nil); a:Destroy()
end)
test("death while paused suppresses impact tails and retry clears pause",function()
 local a,f,p=fixture(); missile(f); a:SetPaused(true); local shots=#a.oneShots
 explosion:Fire(vector(0),nil,"player")
 explosion:Fire(vector(0),nil,"wreck")
 assert(a.paused and a.dead and #a.oneShots==shots)
 assert(next(a.motors)==nil and a.cruise==nil and #a.connections==0)
 a:Start(p); assert(not a.paused and not a.dead and a.cruise.IsPlaying)
 explosion:Fire(vector(0),nil,"hit"); assert(#a.oneShots==1); a:Destroy()
end)
test("one-shot anchors remain bounded and destruction is terminal",function()
 local a=fixture()
 for i=1,100 do a:shot("hitMetalA",1,vector(i)) end
 assert(#a.oneShots==AudioRules.MaxOneShots and #a.world:GetChildren()==AudioRules.MaxOneShots)
 a:Destroy(); a:Destroy(); a:Start(Instance.new("Model")); a:Result(true)
 assert(#a.oneShots==0 and #a.world:GetChildren()==0 and a.aircraft==nil)
 for _,job in jobs do job() end; table.clear(jobs)
 assert(#a.preloadProbes==0)
end)
test("missile budget frees voices and fills previously skipped slots",function()
 local a,f=fixture(); local parts={}
 for i=1,AudioRules.MaxMotors+1 do table.insert(parts,missile(f)) end
 local function size(t) local n=0 for _ in t do n+=1 end return n end
 assert(size(a.motors)==AudioRules.MaxMotors and a.motors[parts[#parts]]==nil)
 parts[1]:Destroy(); step(a)
 assert(size(a.motors)==AudioRules.MaxMotors and a.motors[parts[#parts]])
 a:Destroy()
end)
test("replacement enemy roots release stale sound ownership",function()
 local a,f=fixture(); local enemy=Instance.new("Model"); enemy.Parent=f; enemy:SetAttribute("SkybreakEnemy",true); enemy:SetAttribute("TargetKind","air")
 local root=Instance.new("Part"); root.Parent=enemy; root.Position=vector(100); enemy.PrimaryPart=root
 step(a); local old=a.engines[enemy].sound
 local replacement=Instance.new("Part"); replacement.Parent=enemy; replacement.Position=vector(100); enemy.PrimaryPart=replacement
 step(a); assert(old.destroyed and a.engines[enemy].root==replacement); a:Destroy()
end)
test("undamageable targets never search; warning priority recovers",function()
 local a=fixture(); local t=telemetry(Instance.new("Model"),false); a:Telemetry(t); step(a); assert(a.warning==nil)
 t.targetDamageable=true; a:Telemetry(t); step(a); assert(a.warningKind=="lockSearch")
 local old=a.warning; t.incoming=true; a:Telemetry(t); step(a); assert(old.destroyed and a.warningKind=="incoming")
 t.incoming=false; t.health=10; a:Telemetry(t); step(a); assert(a.warningKind=="lowHull")
 t.health=100; a:Telemetry(t); step(a); assert(a.warningKind=="lockSearch"); a:Destroy()
end)
test("destroy releases probes while preload is suspended",function()
 table.clear(jobs)
 local a=fixture()
 _services.ContentProvider.PreloadAsync=function() coroutine.yield() end
 local worker=coroutine.create(jobs[1]); assert(coroutine.resume(worker)); assert(#a.preloadProbes==8)
 local probes=table.clone(a.preloadProbes); a:Destroy()
 for _,probe in probes do assert(probe.destroyed) end
 assert(coroutine.resume(worker)); assert(#a.preloadProbes==0)
 _services.ContentProvider.PreloadAsync=function() end; table.clear(jobs)
end)
test("lock acquisition fires once per damageable contact and resets on retry",function()
 local a,f,p=fixture(); local t=telemetry(Instance.new("Model"),false); t.lockProgress=1
 a:Telemetry(t); assert(#a.oneShots==0)
 t.targetDamageable=true; a:Telemetry(t); a:Telemetry(t); assert(#a.oneShots==1)
 t.target=Instance.new("Model"); a:Telemetry(t); assert(#a.oneShots==2)
 a:Start(p); a:Telemetry(t); assert(#a.oneShots==1); a:Destroy()
end)
print("AUDIO_LIFECYCLE_SIMULATION passed="..count.." failed=0")
