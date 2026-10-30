-- Deterministic doubles, NOT an audio engine or React renderer. Scenery is excluded.
-- The generated production component's hook bodies and VoicePlayer run unchanged.
local instances, jobs, effects, cleanups, requests, elements = {}, {}, {}, {}, {}, {}
local game={GameId=10772984313,PlaceId=112911685457826,PlaceVersion=123}
local loaded = true
local function signal()
 local listeners = {}
 return {
  Connect=function(self,fn)
   local c={Connected=true};function c:Disconnect() self.Connected=false end
   table.insert(listeners,{c=c,fn=fn});return c
  end,
  Once=function(self,fn) local c;c=self:Connect(function(...) c:Disconnect();fn(...) end);return c end,
  Fire=function(self,...) for _,v in table.clone(listeners) do if v.c.Connected then v.fn(...) end end end,
 }
end
local Instance={}
function Instance.new(class)
 local v={ClassName=class,Volume=1,IsLoaded=loaded,TimePosition=0,TimeLength=400,IsPlaying=false,Ended=signal(),attributes={},signals={}}
 function v:Destroy() self.destroyed=true;self.IsPlaying=false;self.Parent=nil end
 function v:Play() self.IsPlaying=true;table.insert(requests,self) end
 function v:Pause() self.IsPlaying=false end
 function v:Resume() self.IsPlaying=true end
 function v:SetAttribute(key,value) self.attributes[key]=value;if self.signals[key] then self.signals[key]:Fire() end end
 function v:GetAttribute(key) return self.attributes[key] end
 function v:GetAttributeChangedSignal(key) self.signals[key]=self.signals[key] or signal();return self.signals[key] end
 table.insert(instances,v);return v
end
local function enumNode(name)
 return setmetatable({Name=name},{__index=function(t,k) local v=enumNode(k);rawset(t,k,v);return v end})
end
local Enum=enumNode("Enum")
local function vector(x,y,z) return {X=x,Y=y,Z=z} end
local Vector2={new=vector,zero=vector(0,0)}
local Vector3={new=vector,zero=vector(0,0,0)}
local Color3={fromRGB=function(r,g,b) return {R=r/255,G=g/255,B=b/255} end}
local function values(...) return {...} end
local UDim2={new=values,fromOffset=values,fromScale=values}
local UDim={new=values}
local NumberRange={new=function(a,b) return {Min=a,Max=b} end}
local NumberSequence={new=values};local NumberSequenceKeypoint={new=values}
local TweenInfo={new=values}
local task={spawn=function(fn) table.insert(jobs,fn) end}
local warnings={};local warn=function(message) table.insert(warnings,message) end
local gui=Instance.new("PlayerGui")
local services={
 ContentProvider={PreloadAsync=function() end},
 Players={LocalPlayer={FindFirstChildOfClass=function() return gui end}},
 SoundService=Instance.new("SoundService"),
 RunService={IsClient=function() return true end,Heartbeat=signal(),RenderStepped=signal()},
 GuiService={GetGuiInset=function() return vector(0,0),vector(0,0) end},
 TextService={GetTextSize=function() return vector(80,40) end},
 UserInputService={GetLastInputType=function() return Enum.UserInputType.Keyboard end,InputBegan=signal(),LastInputTypeChanged=signal()},
 Workspace={},Lighting={},ReplicatedStorage={},
 TweenService={Create=function(self,sound,info,props)
  local tween={Completed=signal()};function tween:Play() sound.Volume=props.Volume;self.Completed:Fire() end;return tween
 end},
}
local react={
 useRef=function(value) return {current=value} end,
 useState=function(value) return value,function() end end,
 -- Each fixture mounts once; evaluate memoized production values on mount.
 useMemo=function(factory) return factory() end,
 useEffect=function(fn) table.insert(effects,fn) end,
 createElement=function(kind,props,...)
  if props and props.ref then props.ref.current=table.clone(props);if props.key then elements[props.key]=props.ref.current end end
  return {}
 end,
}
-- Stage doubles (see tools/test-voice-offline.ts): counts and injectable faults for the real teardown.
local harnessFaults={}
local harnessStage={lightingApplied=0,lightingRestored=0,effectsRestored=0}
local function resetStage() harnessFaults={};harnessStage={lightingApplied=0,lightingRestored=0,effectsRestored=0} end
local modules={services=services,react=react}
-- INSERT MODULES
local VoicePlayer=modules.VoicePlayer.VoicePlayer
local STORY=modules.RelayStory.STORY
local function mount(id)
 effects={};cleanups={}
 local finished,cancelled=0,0
 modules.RelayCinematic.RelayCinematic({id=id,viewport=vector(1280,720),onFinish=function() finished+=1 end,onCancel=function() cancelled+=1 end})
 for _,effect in effects do local cleanup=effect();if cleanup then table.insert(cleanups,cleanup) end end
 return function() return finished,cancelled end
end
local function unmount() for _,cleanup in cleanups do cleanup() end;cleanups={} end
local function tick(seconds)
 for _=1,math.ceil(seconds/.05) do
  for _,s in instances do if s.IsPlaying and not s.destroyed then s.TimePosition+=.05 end end
  services.RunService.Heartbeat:Fire(.05);services.RunService.RenderStepped:Fire(.05)
 end
end
local function input(key) services.UserInputService.InputBegan:Fire({KeyCode={Name=key}},false) end
local function voices()
 local out={};for _,s in instances do if s.Name and string.match(s.Name,"^Voice_") and not s.destroyed then table.insert(out,s) end end;return out
end
local count=0
local function test(name,fn) fn();count+=1;print("PASS "..name) end

test("all 19 remapped chapters use exact recordings and rewritten beats stay silent",function()
 local total=0
 for _,chapter in STORY do
  local status=mount(chapter.id)
  for i,beat in chapter.beats do
   tick(.1)
   local live=voices()
   if not beat.recordingId then
    assert(#live==0 and modules.VoiceLines.Voice:Story(chapter.id,i-1,beat.text)==nil,"rewritten beat must never play stale words")
   else
   assert(#live==1,`chapter {chapter.id} beat {i-1}: expected one voice`)
   local sound=live[1]
   local id=beat.recordingId
   local clip=modules.VoiceLines.Voice:Story(chapter.id,i-1,beat.text)
   assert(clip and sound.Name=="Voice_"..id)
   assert(sound.SoundId==clip.assetId and sound.PlaybackRegionsEnabled)
   assert(sound.PlaybackRegion.Min==clip.start and sound.PlaybackRegion.Max==clip.finish)
   assert(sound.SoundGroup.Name=="VoiceCutscene" and sound.SoundGroup.Volume==1)
   assert(sound.SoundGroup.Parent.Volume==1 and sound.Volume==1)
   assert(sound.TimePosition>=clip.start and sound.TimePosition<clip.finish)
   end
   total+=1;input("Right");tick(.4)
  end
  assert(status()==1);unmount();assert(#voices()==0 and not VoicePlayer:IsSpeaking())
 end
 assert(total==122)
end)
test("cold-bank mount holds first beat, pause holds load, next cancels pending voice",function()
 loaded=false;mount(0);tick(3)
 local sound=voices()[1];assert(sound and sound.Name=="Voice_story.c00.b00" and not sound.IsPlaying)
 input("P");sound.IsLoaded=true;tick(2);assert(not sound.IsPlaying)
 input("P");tick(.1);assert(sound.IsPlaying)
 input("Right");tick(.4);assert(sound.destroyed)
 local nextSound=voices()[1];assert(nextSound.Name=="Voice_story.c00.b01" and not nextSound.IsPlaying)
 input("Space");unmount();assert(nextSound.destroyed and #voices()==0)
 loaded=true
end)
test("loaded pause/resume preserves region and unmount destroys voice",function()
 mount(0);tick(.1);local sound=voices()[1];input("P");local position=sound.TimePosition
 tick(2);assert(not sound.IsPlaying and sound.TimePosition==position)
 input("P");tick(.1);assert(sound.IsPlaying and sound.TimePosition>position)
 input("ButtonB");unmount();assert(#voices()==0)
end)
test("natural beat clock reaches the next recorded line",function()
 mount(0);tick(9.5)
 assert(voices()[1].Name=="Voice_story.c00.b01");unmount()
end)
test("setup failure undoes the stage, lighting and effects already made and skips the cutscene",function()
 resetStage();harnessFaults.effects=true
 local before=#warnings;local status=mount(0)
 assert(status()==1,"a failed stage is skipped like Skip")
 assert(harnessStage.lightingApplied==1 and harnessStage.lightingRestored==1 and harnessStage.effectsRestored==1)
 assert(harnessStage.folder.destroyed and #voices()==0 and not VoicePlayer:IsSpeaking())
 assert(string.find(warnings[before+1],"stage setup failed",1,true))
 -- React's later unmount is a no-op: nothing is restored twice.
 unmount();assert(harnessStage.lightingRestored==1 and harnessStage.effectsRestored==1)
 resetStage()
end)
test("a setup failure before lighting leaves lighting untouched and still cleans the stage",function()
 resetStage();harnessFaults.scene=true
 local status=mount(0)
 assert(status()==1 and harnessStage.lightingApplied==0 and harnessStage.lightingRestored==0 and harnessStage.effectsRestored==0)
 assert(harnessStage.folder.destroyed)
 unmount();resetStage()
end)
test("a failing restore is reported and every other restoration still runs, once",function()
 resetStage();harnessFaults.lightingRestore=true
 mount(0);tick(.1);assert(#voices()==1)
 local held=table.clone(cleanups);local before=#warnings
 unmount()
 assert(harnessStage.lightingRestored==1 and harnessStage.effectsRestored==1 and harnessStage.folder.destroyed)
 assert(#voices()==0 and not VoicePlayer:IsSpeaking())
 assert(#warnings==before+1 and string.find(warnings[#warnings],"cleanup step failed",1,true))
 for _,cleanup in held do cleanup() end
 assert(harnessStage.lightingRestored==1 and harnessStage.effectsRestored==1 and #warnings==before+1)
 resetStage()
end)
test("VoiceVolume remains respected by the actual output group",function()
 gui:SetAttribute("VoiceVolume",0);mount(0);tick(.1)
 assert(voices()[1].SoundGroup.Parent.Volume==0)
 gui:SetAttribute("VoiceVolume",.7);assert(voices()[1].SoundGroup.Parent.Volume==.7)
 unmount();gui:SetAttribute("VoiceVolume",1)
end)
test("missing exact transcript is visible and never substitutes another recording",function()
 local cue=modules.VoiceCues.VOICE_CUES["story.c00.b00"];local original=cue.text;cue.text="not the displayed text"
 mount(0);tick(.1);assert(#voices()==0)
 assert(elements.CinematicAudioStatus.Visible and elements.CinematicAudioStatus.Text=="Dialogue unavailable · subtitles only")
 unmount();cue.text=original
end)
test("failed load warns, releases ducking and leaves skip responsive",function()
 loaded=false;local status=mount(0);local before=#warnings;tick(12.5)
 assert(#warnings>before and #voices()==0 and not VoicePlayer:IsSpeaking())
 assert(elements.CinematicAudioStatus.Visible and elements.CinematicAudioStatus.Text=="Dialogue unavailable · subtitles only")
 assert(string.find(warnings[#warnings],"universe=10772984313 place=112911685457826 version=123",1,true))
 input("Space");assert(status()==1);unmount();loaded=true
end)
test("boot preload reports fetch failure and thrown error with deployed identity",function()
 local before=#warnings
 services.ContentProvider.PreloadAsync=function(self,probes,callback)
  callback(probes[1].SoundId,Enum.AssetFetchStatus.Failure);error("test fetch rejection")
 end
 assert(jobs[1]);jobs[1]()
 assert(#warnings==before+2)
 assert(string.find(warnings[before+1],"Failure",1,true))
 assert(string.find(warnings[before+2],"test fetch rejection",1,true))
 for i=before+1,#warnings do assert(string.find(warnings[i],"universe=10772984313 place=112911685457826 version=123",1,true)) end
end)
print(`VOICE_CONSUMER_RESULT passed={count}; simulated lifecycle only, audible output NOT tested`)
