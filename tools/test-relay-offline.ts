// Executes compiled pure domain contracts in the official standalone Luau VM.
// This does NOT start Studio, emulate Roblox, or count as a Roblox Jest run.
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const root=resolve(import.meta.dir,".."),dest=resolve(root,"build/offline-relay");
await mkdir(dest,{recursive:true});
const files=["shared/WorldAirspace","shared/DeletionObservation","server/CampaignRequestBudget","tests/DeletionObservation.spec","tests/WeaponRules.spec","shared/VoiceReadiness","tests/VoiceReadiness.spec","shared/AudioRules","tests/AudioRules.spec","shared/AssetSelection","tests/AssetSelection.spec","shared/CombatBalance","tests/CombatBalance.spec","shared/MissionPacing","tests/MissionScore.spec","shared/CinematicInput","tests/CinematicInput.spec","shared/CinematicLayout","tests/CinematicLayout.spec","shared/CinematicStaging","tests/CinematicStaging.spec","shared/StoryDocuments","tests/StoryDocuments.spec","shared/NavigationPilot","shared/FlightMath","shared/MissionCatalog","shared/BlueprintRunner","shared/MissionLayouts","shared/RelayStory","shared/GameConfig","shared/Difficulty","shared/MissionScore","tests/Difficulty.spec","shared/WeaponRules","shared/SpecialWeapons","shared/ExplosionFx","tests/ExplosionFx.spec","shared/EngineFx","tests/EngineFx.spec","shared/ImpactFeedback","tests/ImpactFeedback.spec","shared/ThreatRules","tests/ThreatRules.spec","shared/EvadeRules","tests/EvadeRules.spec","shared/AceRules","tests/AceRules.spec","shared/WavePlan","tests/WavePlan.spec","shared/SessionGuard","tests/SessionGuard.spec","shared/ActorPlacement","tests/ActorPlacement.spec","shared/MissionRules","tests/MissionRules.spec","shared/CampaignProgress","server/CampaignRepository","tests/DeletionStatus.spec","tests/RelayCampaign.spec","tests/BlueprintProgress.spec",
	// Round-2 HUD rules (pure layout, warnings, radar, evade, radio, settings).
	"shared/UILayout","tests/UILayout.spec","shared/NavigationLayout","tests/NavigationLayout.spec","shared/FlightWarnings","tests/FlightWarnings.spec",
	"shared/RadarMath","tests/RadarMath.spec","shared/EvadeGauge","tests/EvadeGauge.spec","shared/VoiceCues","shared/VoiceBanks","shared/VoiceLines","tests/VoiceLines.spec","shared/RadioQueue","tests/RadioQueue.spec",
	"shared/PlayerSettings","tests/PlayerSettings.spec","shared/TouchSticks","tests/TouchSticks.spec",
	// Ace-style HUD instruments (hull bar, ammo line, clock).
	"shared/HudInstruments","tests/HudInstruments.spec",
	// PR #38's touch control rectangles, frozen across HUD scales and stick sizes.
	"tests/TouchControls.spec",
	// World realism: the pure world plans, their audit and the environment table.
	"shared/UploadedAssetSpecs","shared/EnvironmentPresets","shared/TerrainSchedule","shared/WorldDistricts","shared/WorldPlan","shared/WorldAudit","tests/WorldPlan.spec","tests/TerrainSchedule.spec","shared/LegacyWorlds","tests/LegacyWorlds.spec","tests/EnvironmentPresets.spec","shared/WeatherRules","tests/WeatherRules.spec",
	// Flight model: rate-commanded attitude, loops, attitude hold, prediction and the state packet.
	"tests/Flight.spec","shared/FlightPrediction","shared/TelemetryCodec","tests/FlightPrediction.spec",
	// Ace Combat-style target boxes: validity, size, blink, ranking and touch keep-outs.
	"shared/TargetBoxes","tests/TargetBoxes.spec"];
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
 describe=function(name,fn) print(name);fn() end,
 it=function(name,fn) local ok,err=pcall(fn);if ok then passed+=1;print("PASS "..name) else failed+=1;print("FAIL "..name..": "..tostring(err)) end end,
 result=function() print("OFFLINE_LUAU_RESULT passed="..passed.." failed="..failed);assert(failed==0,"Offline domain contracts failed") end }
`);
await Bun.write(resolve(dest,"run.luau"),'require("./DeletionObservation.spec")\nrequire("./WeaponRules.spec")\nrequire("./VoiceReadiness.spec")\nrequire("./CombatBalance.spec")\nrequire("./MissionScore.spec")\nrequire("./DeletionStatus.spec")\nrequire("./RelayCampaign.spec")\nrequire("./BlueprintProgress.spec")\nrequire("./CinematicInput.spec")\nrequire("./CinematicLayout.spec")\nrequire("./CinematicStaging.spec")\nrequire("./StoryDocuments.spec")\nrequire("./ExplosionFx.spec")\nrequire("./EngineFx.spec")\nrequire("./ImpactFeedback.spec")\nrequire("./Difficulty.spec")\nrequire("./ThreatRules.spec")\nrequire("./EvadeRules.spec")\nrequire("./AceRules.spec")\nrequire("./WavePlan.spec")\nrequire("./SessionGuard.spec")\nrequire("./ActorPlacement.spec")\nrequire("./MissionRules.spec")\nrequire("./UILayout.spec")\nrequire("./NavigationLayout.spec")\nrequire("./FlightWarnings.spec")\nrequire("./RadarMath.spec")\nrequire("./EvadeGauge.spec")\nrequire("./RadioQueue.spec")\nrequire("./VoiceLines.spec")\nrequire("./PlayerSettings.spec")\nrequire("./TouchSticks.spec")\nrequire("./AssetSelection.spec")\nrequire("./AudioRules.spec")\nrequire("./HudInstruments.spec")\nrequire("./TouchControls.spec")\nrequire("./WorldPlan.spec")\nrequire("./EnvironmentPresets.spec")\nrequire("./WeatherRules.spec")\nrequire("./TerrainSchedule.spec")\nrequire("./LegacyWorlds.spec")\nrequire("./Flight.spec")\nrequire("./FlightPrediction.spec")\nrequire("./TargetBoxes.spec")\nrequire("./OfflineAssertions").result()\n');
const executable=process.env.LUAU_BIN ?? resolve(root,"build/offline-luau/luau");
if(!(await Bun.file(executable).exists()))throw new Error("Set LUAU_BIN to the official Luau CLI. See docs/broken-relay.md. No Studio fallback will run.");
const proc=Bun.spawn([executable,resolve(dest,"run.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
console.log(stdout);if(stderr)console.error(stderr);
await Bun.write(resolve(root,"build/relay-offline-results.log"),stdout+stderr);
if(code!==0)process.exitCode=code;
