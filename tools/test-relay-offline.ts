// Executes compiled pure domain contracts in the official standalone Luau VM.
// This does NOT start Studio, emulate Roblox, or count as a Roblox Jest run.
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {requireLuauBin} from "./luau-bin";
const root=resolve(import.meta.dir,".."),dest=resolve(root,"build/offline-relay");
await mkdir(dest,{recursive:true});
const files=["shared/RobloxAssetIds","shared/UploadedAssetOrientation","tests/M04M05Assets.spec","tests/legacy/LegacyStory","tests/LegacyCampaign.spec","shared/M01Geometry","tests/LegacyCatalog", ...Array.from({length:27},(_,i)=>`tests/legacy/legacy${String(i+1).padStart(2,"0")}`),"shared/LaunchStage","shared/InitialTelemetry","tests/CountdownFlyoff.spec","shared/AlliedRules","tests/AlliedRules.spec","tests/LegacyPhaseRosters","shared/OutcomeReason","shared/BomberEncounter","tests/BomberEncounter.spec","shared/M01Limits","tests/LegacyAirspaceCapture","tests/MissionAirspace.spec","server/PhaseDirectorRules","tests/PhaseDirector.spec","shared/M01WorldPlan","tests/M01WorldPlan.spec","shared/M01CarrierPlan","tests/M01CarrierPlan.spec","server/SortieScore","shared/OutcomePoints","tests/LegacyScoringCapture","tests/AuthoritativeScoring.spec","shared/BomberRules","tests/BomberRules.spec","shared/WorldAirspace","shared/DeletionObservation","server/CampaignRequestBudget","tests/DeletionObservation.spec","tests/WeaponRules.spec","shared/VoiceReadiness","tests/VoiceReadiness.spec","shared/AudioRules","tests/AudioRules.spec","shared/AssetSelection","tests/AssetSelection.spec","shared/CombatBalance","tests/CombatBalance.spec","shared/MissionPacing","shared/TargetScore","tests/TargetScore.spec","tests/MissionScore.spec","shared/CinematicInput","tests/CinematicInput.spec","shared/CinematicLayout","tests/CinematicLayout.spec","shared/CinematicStaging","tests/CinematicStaging.spec","shared/Teardown","shared/CinematicSet","tests/CinematicSet.spec","shared/StoryDocuments","tests/StoryDocuments.spec","shared/NavigationPilot","shared/FlightMath","shared/MissionPolicy","shared/MissionCatalog","shared/BlueprintRunner","shared/MissionLayouts","shared/RelayStory","shared/GameConfig","shared/Difficulty","shared/MissionScore","tests/MissionPolicy.spec","tests/Difficulty.spec","shared/WeaponRules","shared/SpecialWeapons","shared/ExplosionFx","tests/ExplosionFx.spec","shared/EngineFx","tests/EngineFx.spec","shared/ImpactFeedback","tests/ImpactFeedback.spec","shared/ThreatRules","tests/ThreatRules.spec","shared/EvadeRules","tests/EvadeRules.spec","shared/AceRules","tests/AceRules.spec","shared/WavePlan","tests/WavePlan.spec","shared/SessionGuard","tests/SessionGuard.spec","shared/ActorPlacement","tests/ActorPlacement.spec","tests/UnifiedMissionRunner.spec","shared/CampaignProgress","server/CampaignRepository","tests/DeletionStatus.spec","tests/RelayCampaign.spec","tests/BlueprintProgress.spec",
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
	"shared/TargetPriority","tests/TargetPriority.spec","shared/TargetBoxes","tests/TargetBoxes.spec"];
files.push("shared/CampaignEncounters", "shared/GroundAirDefence", "tests/EnginePracticeSnapshot", "tests/EngineM01Snapshot", "tests/CampaignEncounters.spec");
files.push("shared/WorldEnvironments");
files.push("shared/LateWorldDressing", "shared/M14Limits", "shared/M14WorldPlan", "shared/M15Limits", "shared/M15WorldPlan", "shared/M16Limits", "shared/M16WorldPlan", "shared/M17Limits", "shared/M17WorldPlan", "shared/M18Limits", "shared/M18WorldPlan", "tests/M14M18WorldPlan.spec");
files.push("shared/M12Limits", "shared/M13Limits", "shared/M12WorldPlan", "shared/M13WorldPlan", "tests/M12M13WorldPlan.spec");
files.push("shared/M10Limits", "shared/M11Limits", "shared/M10WorldPlan", "shared/M11WorldPlan", "tests/M10M11WorldPlan.spec");
files.push("shared/M08Limits", "shared/M09Limits", "shared/M08WorldPlan", "shared/M09WorldPlan", "tests/M08M09WorldPlan.spec");
files.push("shared/M06M07WorldCounts", "shared/CompactWorldSurface", "shared/M06Limits", "shared/M07Limits", "shared/M06WorldPlan", "shared/M07WorldPlan", "tests/M06M07WorldPlan.spec");
files.push("shared/SealedWorldSurface", "shared/WorldCompositionCounts", "shared/M04Limits", "shared/M05Limits", "shared/M04WorldPlan", "shared/M05WorldPlan", "tests/M04M05WorldPlan.spec");
files.push("shared/M03WorldPlan", "shared/M03Limits", "tests/M03WorldPlan.spec", "tests/M03Mission.spec");
files.push("shared/LaunchLoading", "tests/LaunchLoading.spec");
files.push("shared/LoadingScreenModel", "tests/LoadingScreenModel.spec");
files.push("shared/WorldLifecycle", "tests/WorldLifecycle.spec");
files.push("shared/M02WorldPlan", "shared/M02Limits", "tests/M02WorldPlan.spec");
files.push("tests/M04Mission.spec", "shared/Polyline", "tests/M02Mission.spec", "tests/CampaignCompletionPersistence.spec");
files.push("shared/CountdownDisplay", "shared/CampaignWire", "tests/CampaignWire.spec");
files.push("shared/missions/index", "shared/missions/practice", "shared/missions/Phases", ...Array.from({length:18},(_,i)=>`shared/missions/m${String(i+1).padStart(2,"0")}`));
files.push("shared/StoryMissionText");
files.push("shared/EngineBatchB", "tests/EngineBatchB.spec");
files.push("shared/EngineBatchC", "shared/NightLighting", "tests/EngineBatchC.spec");
files.push("shared/VoiceDisclosure", "tests/VoiceDisclosure.spec");
files.push("tests/M09Mission.spec", "tests/M10Mission.spec");
files.push("shared/EngineBatchD10", "tests/EngineBatchD10.spec", "tests/EngineBatchD10Validation.spec");
files.push("tests/M09Mission.spec");
files.push("shared/EngineBatchD6", "tests/EngineBatchD6.spec");
files.push("tests/EngineBatchD4Fixture", "shared/EngineBatchD4", "tests/EngineBatchD4.spec");
files.push("tests/M12Mission.spec");
files.push("server/TargetDestruction", "tests/TargetDestruction.spec");
files.push("shared/EngineBatchD8", "tests/EngineBatchD8.spec");
files.push("tests/ProtectedAircraftFire.spec");
files.push("server/EngineBatchD11Runtime", "tests/EngineBatchD11PhaseExit.spec", "shared/EngineBatchD11", "tests/EngineBatchD11.spec");
files.push("shared/EngineBatchD9", "tests/EngineBatchD9Fixture", "tests/EngineBatchD9.spec");
files.push("shared/EncounterKinematics", "tests/M11Mission.spec", "tests/M11Encounter.spec");
files.push("shared/EngineBatchD7", "tests/EngineBatchD7Fixture", "tests/EngineBatchD7.spec");
files.push("shared/EngineBatchD5", "tests/EngineBatchD5.spec");
files.push("shared/EngineBatchD3", "tests/EngineBatchD3.spec");
files.push("shared/EngineBatchD2", "tests/EngineBatchD2.spec");
files.push("shared/SortieArmament", "tests/SortieArmament.spec");
files.push("shared/SortieCutaways", "tests/M05Mission.spec", "tests/M06Mission.spec", "tests/M07Mission.spec", "tests/M08Mission.spec");
// Some standalone Luau versions return a module's load error as a string.
// Guard every import, including transitive dependencies, and every top-level spec.
const checkedRequire = `local rawRequire = require
local function require(path)
 local result = rawRequire(path)
 assert(type(result) ~= "string", "Offline module load failed: " .. path .. ": " .. tostring(result))
 return result
end
`;
for(const file of files){
	let source=await Bun.file(resolve(root,`out/${file === "shared/missions/index" ? "shared/missions/init" : file}.luau`)).text();
	source=source.split("\n").filter(line=>!line.startsWith("local TS = require(")).map(line=>{
		if(!line.includes("TS.import("))return line;
		const strings=[...line.matchAll(/"([^"\n]+)"/g)];const rawName=strings.at(-1)?.[1]; const name=rawName === "missions" ? "MissionIndex" : rawName === "index" ? "MissionIndex" : rawName;
		if(!name)throw new Error(`Cannot adapt dependency: ${line}`);
		return line.replace(/TS\.import\(.*\)/,`require("./${line.includes('"jest-globals"') ? "OfflineAssertions" : name}")`);
	}).join("\n");
	if(source.includes("TS."))throw new Error(`Unadapted runtime dependency in ${file}`);
	if(file.endsWith("GameConfig"))source='local Vector3={new=function(...)return {...}end}; local CFrame={lookAt=function(...)return {...}end}\n'+source;
	if(file.endsWith("UploadedAssetSpecs"))source='local Vector3={new=function(x,y,z)return {X=x,Y=y,Z=z}end}\n'+source;
	source=checkedRequire+source;
	if(file.endsWith(".spec"))source+="\nreturn true\n";
	await Bun.write(resolve(dest,`${file === "shared/missions/index" ? "MissionIndex" : file.split("/").at(-1)}.luau`),source);
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
await Bun.write(resolve(dest,"run.luau"),checkedRequire+'require("./M12Mission.spec")\nrequire("./TargetDestruction.spec")\nrequire("./EngineBatchD11.spec")\nrequire("./EngineBatchD11PhaseExit.spec")\nrequire("./M11Encounter.spec")\nrequire("./M11Mission.spec")\n'+'require("./EngineBatchD10.spec")\nrequire("./EngineBatchD10Validation.spec")\nrequire("./M10Mission.spec")\nrequire("./EngineBatchD9.spec")\nrequire("./M09Mission.spec")\nrequire("./EngineBatchD8.spec")\nrequire("./EngineBatchD7.spec")\nrequire("./ProtectedAircraftFire.spec")\nrequire("./M08Mission.spec")\nrequire("./EngineBatchD6.spec")\nrequire("./EngineBatchD5.spec")\nrequire("./M07Mission.spec")\nrequire("./LoadingScreenModel.spec")\nrequire("./M14M18WorldPlan.spec")\nrequire("./EngineBatchD4.spec")\nrequire("./M06Mission.spec")\nrequire("./EngineBatchD3.spec")\nrequire("./EngineBatchD2.spec")\nrequire("./SortieArmament.spec")\nrequire("./M12M13WorldPlan.spec")\nrequire("./M10M11WorldPlan.spec")\nrequire("./M08M09WorldPlan.spec")\nrequire("./M06M07WorldPlan.spec")\nrequire("./M04Mission.spec")\nrequire("./TargetPriority.spec")\nrequire("./LaunchLoading.spec")\nrequire("./VoiceDisclosure.spec")\nrequire("./EngineBatchC.spec")\nrequire("./M04M05WorldPlan.spec")\nrequire("./CampaignCompletionPersistence.spec")\nrequire("./M02Mission.spec")\nrequire("./M05Mission.spec")\nrequire("./M04M05Assets.spec")\nrequire("./EngineBatchB.spec")\nrequire("./M03WorldPlan.spec")\nrequire("./M03Mission.spec")\nrequire("./WorldLifecycle.spec")\nrequire("./CampaignEncounters.spec")\nrequire("./CampaignWire.spec")\nrequire("./CountdownFlyoff.spec")\nrequire("./AlliedRules.spec")\nrequire("./MissionAirspace.spec")\nrequire("./DeletionObservation.spec")\nrequire("./WeaponRules.spec")\nrequire("./VoiceReadiness.spec")\nrequire("./CombatBalance.spec")\nrequire("./TargetScore.spec")\nrequire("./AuthoritativeScoring.spec")\nrequire("./MissionScore.spec")\nrequire("./MissionPolicy.spec")\nrequire("./DeletionStatus.spec")\nrequire("./LegacyCampaign.spec")\nrequire("./RelayCampaign.spec")\nrequire("./BlueprintProgress.spec")\nrequire("./CinematicInput.spec")\nrequire("./CinematicLayout.spec")\nrequire("./CinematicStaging.spec")\nrequire("./CinematicSet.spec")\nrequire("./StoryDocuments.spec")\nrequire("./ExplosionFx.spec")\nrequire("./EngineFx.spec")\nrequire("./ImpactFeedback.spec")\nrequire("./Difficulty.spec")\nrequire("./ThreatRules.spec")\nrequire("./EvadeRules.spec")\nrequire("./AceRules.spec")\nrequire("./WavePlan.spec")\nrequire("./SessionGuard.spec")\nrequire("./ActorPlacement.spec")\nrequire("./UnifiedMissionRunner.spec")\nrequire("./UILayout.spec")\nrequire("./NavigationLayout.spec")\nrequire("./FlightWarnings.spec")\nrequire("./RadarMath.spec")\nrequire("./EvadeGauge.spec")\nrequire("./RadioQueue.spec")\nrequire("./VoiceLines.spec")\nrequire("./PlayerSettings.spec")\nrequire("./TouchSticks.spec")\nrequire("./AssetSelection.spec")\nrequire("./AudioRules.spec")\nrequire("./HudInstruments.spec")\nrequire("./TouchControls.spec")\nrequire("./WorldPlan.spec")\nrequire("./EnvironmentPresets.spec")\nrequire("./WeatherRules.spec")\nrequire("./TerrainSchedule.spec")\nrequire("./LegacyWorlds.spec")\nrequire("./Flight.spec")\nrequire("./FlightPrediction.spec")\nrequire("./TargetBoxes.spec")\nrequire("./BomberRules.spec")\nrequire("./M02WorldPlan.spec")\nrequire("./M01WorldPlan.spec")\nrequire("./M01CarrierPlan.spec")\nrequire("./PhaseDirector.spec")\nrequire("./BomberEncounter.spec")\nrequire("./OfflineAssertions").result()\n');
const executable=requireLuauBin();
// Prove that parse errors, returned error strings, runtime errors and failed
// transitive imports all stop the process instead of silently skipping coverage.
for (const [kind, source] of Object.entries({
 parse: "return {}\nreturn true\n",
 string: 'return "synthetic module failure"\n',
 runtime: 'error("synthetic runtime failure")\n',
 nested: checkedRequire+'return require("./guard-parse")\n',
})) {
 await Bun.write(resolve(dest,`guard-${kind}.luau`),source);
 await Bun.write(resolve(dest,"guard-run.luau"),checkedRequire+`require("./guard-${kind}")\n`);
 const probe=Bun.spawn([executable,resolve(dest,"guard-run.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
 const [out,err,status]=await Promise.all([new Response(probe.stdout).text(),new Response(probe.stderr).text(),probe.exited]);
 if(status===0 || !(out+err).includes("synthetic") && !(out+err).includes("guard-parse")) throw new Error(`Module error guard failed: ${kind}: ${out}${err}`);
}
console.log("OFFLINE_MODULE_GUARD passed=4 failed=0");
const proc=Bun.spawn([executable,resolve(dest,"run.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
console.log(stdout);if(stderr)console.error(stderr);
await Bun.write(resolve(root,"build/relay-offline-results.log"),stdout+stderr);
if(code!==0)process.exitCode=code;
