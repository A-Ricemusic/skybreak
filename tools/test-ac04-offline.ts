// Executes compiled pure domain contracts in the official standalone Luau VM.
// This does NOT start Studio, emulate Roblox, or count as a Roblox Jest run.
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {requireLuauBin} from "./luau-bin";
const root=resolve(import.meta.dir,".."),dest=resolve(root,"build/offline-ac04");
await mkdir(dest,{recursive:true});
const files=["shared/ac04/rebuild/EarlyGeometry", "shared/ac04/rebuild/EarlyPlacement", "shared/ac04/rebuild/EarlyWorld", "tests/AC04EarlyRebuild.spec", "shared/ac04/rebuild/LateCampaign", "shared/ac04/rebuild/LateGeometry", "shared/ac04/rebuild/LateMegalith", "shared/ac04/rebuild/LatePlacement", "shared/ac04/rebuild/LateRuntime", "shared/ac04/rebuild/LateSources", "shared/ac04/rebuild/LateWorld", "shared/ac04/rebuild/LateWorldBuild", "shared/ac04/rebuild/MiddleCampaign", "shared/ac04/rebuild/MiddleGeography", "shared/ac04/rebuild/MiddleWorld", "tests/AC04MiddleRebuild.spec", "tests/AC04LateRebuild.spec", "tests/AC04Integration.spec", "shared/WorldAirspace", "server/CampaignRequestBudget", "tests/WeaponRules.spec", "shared/VoiceReadiness", "tests/VoiceReadiness.spec", "shared/AudioRules", "tests/AudioRules.spec", "shared/AssetSelection", "tests/AssetSelection.spec", "shared/CombatBalance", "tests/CombatBalance.spec", "shared/CinematicInput", "tests/CinematicInput.spec", "shared/CinematicLayout", "tests/CinematicLayout.spec", "shared/NavigationPilot", "shared/FlightMath", "shared/GameConfig", "shared/Difficulty", "tests/Difficulty.spec", "shared/WeaponRules", "shared/SpecialWeapons", "shared/ExplosionFx", "tests/ExplosionFx.spec", "shared/EngineFx", "tests/EngineFx.spec", "shared/ImpactFeedback", "tests/ImpactFeedback.spec", "shared/ThreatRules", "tests/ThreatRules.spec", "shared/EvadeRules", "tests/EvadeRules.spec", "shared/AceRules", "tests/AceRules.spec", "shared/WavePlan", "tests/WavePlan.spec", "shared/SessionGuard", "tests/SessionGuard.spec", "shared/ActorPlacement", "tests/ActorPlacement.spec", "shared/UILayout", "tests/UILayout.spec", "shared/NavigationLayout", "tests/NavigationLayout.spec", "shared/FlightWarnings", "tests/FlightWarnings.spec", "shared/RadarMath", "tests/RadarMath.spec", "shared/EvadeGauge", "tests/EvadeGauge.spec", "shared/VoiceCues", "shared/VoiceBanks", "shared/VoiceLines", "tests/VoiceLines.spec", "shared/RadioQueue", "tests/RadioQueue.spec", "shared/PlayerSettings", "tests/PlayerSettings.spec", "shared/TouchSticks", "tests/TouchSticks.spec", "shared/HudInstruments", "tests/HudInstruments.spec", "tests/TouchControls.spec", "shared/UploadedAssetSpecs", "shared/EnvironmentPresets", "shared/TerrainSchedule", "shared/WorldPlan", "tests/TerrainSchedule.spec", "tests/EnvironmentPresets.spec", "shared/WeatherRules", "tests/WeatherRules.spec", "tests/Flight.spec", "shared/FlightPrediction", "shared/TelemetryCodec", "tests/FlightPrediction.spec", "shared/TargetBoxes", "tests/TargetBoxes.spec", "shared/AC04Aircraft", "shared/AC04Barrage", "shared/AC04MissionData", "shared/AC04Runner", "shared/AC04Progress", "shared/ac04/AC04Radio", "shared/ac04/AC04Story", "shared/ac04/AC04Voice", "shared/ac04/AC04VoiceBanks", "shared/ac04/AC04VoiceCues", "shared/AC04WorldData", "tests/AC04Barrage.spec", "tests/AC04Runner.spec", "tests/AC04Progress.spec", "tests/AC04Radio.spec", "shared/Types", "shared/WorldTypes"];
for(const file of files){
	let source=await Bun.file(resolve(root,`out/${file}.luau`)).text();
	source=source.split("\n").filter(line=>!line.startsWith("local TS = require(")).map(line=>{
		if(!line.includes("TS.import("))return line;
		const strings=[...line.matchAll(/"([^"\n]+)"/g)];const name=strings.at(-1)?.[1];
		if(!name)throw new Error(`Cannot adapt dependency: ${line}`);
		return line.replace(/TS\.import\(.*\)/,`require("./${line.includes('"jest-globals"') ? "OfflineAssertions" : name}")`);
	}).join("\n");
	if(source.includes("TS."))throw new Error(`Unadapted runtime dependency in ${file}`);
	if(file.endsWith("GameConfig"))source='local Vector3={new=function(...)return {...}end}; local CFrame={lookAt=function(...)return {...}end}\n'+source;
	if(file.endsWith("UploadedAssetSpecs"))source='local Vector3={new=function(x,y,z)return {X=x,Y=y,Z=z}end}\n'+source;
	if(file.startsWith("tests/"))source+="\nreturn true\n";
	await Bun.write(resolve(dest,`${file.split("/").at(-1)}.luau`),source);
}
await Bun.write(resolve(dest,"OfflineAssertions.luau"),`
local passed,failed=0,0
local queued={}
local function deepEqual(a,b)
 if type(a)~="table" or type(b)~="table" then return a==b end
 for k,v in a do if not deepEqual(v,b[k]) then return false end end
 for k in b do if a[k]==nil then return false end end
 return true
end
local function show(v)
 if type(v)~="table" then return tostring(v) end
 local parts={} for k,x in v do table.insert(parts,tostring(k).."="..show(x)) end
 return "{"..table.concat(parts,",").."}"
end
local function matchers(value,negate)
 local function check(ok,message) if negate then ok=not ok end assert(ok,(negate and "Not: " or "")..message) end
 return {
  toThrow=function() local ok=pcall(value); check(not ok,"Expected function to throw") end,
  toBe=function(expected) check(value==expected, "Expected "..show(expected)..", received "..show(value)) end,
  toEqual=function(expected) check(deepEqual(value,expected), "Expected "..show(expected)..", received "..show(value)) end,
  toBeUndefined=function() check(value==nil,"Expected nil, received "..show(value)) end,
  toBeDefined=function() check(value~=nil,"Expected a value, received nil") end,
  toBeGreaterThan=function(n) check(value>n, "Expected > "..tostring(n)..", received "..tostring(value)) end,
  toBeGreaterThanOrEqual=function(n) check(value>=n, "Expected >= "..tostring(n)..", received "..tostring(value)) end,
  toBeLessThan=function(n) check(value<n, "Expected < "..tostring(n)..", received "..tostring(value)) end,
  toBeLessThanOrEqual=function(n) check(value<=n, "Expected <= "..tostring(n)..", received "..tostring(value)) end,
  toBeCloseTo=function(n,digits) check(math.abs(value-n)<(10^-(digits or 2))/2, "Expected ~"..tostring(n)..", received "..tostring(value)) end,
 }
end
local function expect(value)
 local m=matchers(value,false)
 m.never=matchers(value,true)
 return m
end
return { expect=expect,
 -- Like Jest, collect describe blocks while modules load and run them afterwards, so helpers declared later in a spec exist.
 describe=function(name,fn) table.insert(queued,{name=name,fn=fn}) end,
 it=function(name,fn) local ok,err=pcall(fn);if ok then passed+=1;print("PASS "..name) else failed+=1;print("FAIL "..name..": "..tostring(err)) end end,
 result=function() for _,block in queued do print(block.name);block.fn() end print("OFFLINE_LUAU_RESULT passed="..passed.." failed="..failed);assert(failed==0,"Offline domain contracts failed") end }
`);
await Bun.write(resolve(dest,"run.luau"),"require(\"./WeaponRules.spec\")\nrequire(\"./VoiceReadiness.spec\")\nrequire(\"./AudioRules.spec\")\nrequire(\"./AssetSelection.spec\")\nrequire(\"./CombatBalance.spec\")\nrequire(\"./CinematicInput.spec\")\nrequire(\"./CinematicLayout.spec\")\nrequire(\"./Difficulty.spec\")\nrequire(\"./ExplosionFx.spec\")\nrequire(\"./EngineFx.spec\")\nrequire(\"./ImpactFeedback.spec\")\nrequire(\"./ThreatRules.spec\")\nrequire(\"./EvadeRules.spec\")\nrequire(\"./AceRules.spec\")\nrequire(\"./WavePlan.spec\")\nrequire(\"./SessionGuard.spec\")\nrequire(\"./ActorPlacement.spec\")\nrequire(\"./UILayout.spec\")\nrequire(\"./NavigationLayout.spec\")\nrequire(\"./FlightWarnings.spec\")\nrequire(\"./RadarMath.spec\")\nrequire(\"./EvadeGauge.spec\")\nrequire(\"./VoiceLines.spec\")\nrequire(\"./RadioQueue.spec\")\nrequire(\"./PlayerSettings.spec\")\nrequire(\"./TouchSticks.spec\")\nrequire(\"./HudInstruments.spec\")\nrequire(\"./TouchControls.spec\")\nrequire(\"./TerrainSchedule.spec\")\nrequire(\"./EnvironmentPresets.spec\")\nrequire(\"./WeatherRules.spec\")\nrequire(\"./Flight.spec\")\nrequire(\"./FlightPrediction.spec\")\nrequire(\"./TargetBoxes.spec\")\nrequire(\"./AC04Barrage.spec\")\nrequire(\"./AC04Runner.spec\")\nrequire(\"./AC04Progress.spec\")\nrequire(\"./AC04Radio.spec\")\nrequire(\"./AC04EarlyRebuild.spec\")\nrequire(\"./AC04MiddleRebuild.spec\")\nrequire(\"./AC04LateRebuild.spec\")\nrequire(\"./AC04Integration.spec\")\nrequire(\"./OfflineAssertions\").result()\n");
const executable=requireLuauBin();
const proc=Bun.spawn([executable,resolve(dest,"run.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
console.log(stdout);if(stderr)console.error(stderr);
await Bun.write(resolve(root,"build/ac04-offline-results.log"),stdout+stderr);
if(code!==0)process.exitCode=code;
