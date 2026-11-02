// Executes compiled pure domain contracts in the official standalone Luau VM.
// This does NOT start Studio, emulate Roblox, or count as a Roblox Jest run.
//
// Every module listed in MODULES is copied from rbxtsc's `out/` into build/offline-relay with its
// `TS.import` lines rewritten to plain `require("./Name")` calls and `@rbxts/jest-globals` replaced
// by the matcher subset in OfflineAssertions.luau. Every entry ending in `.spec` is then required by
// the generated run.luau, so a spec is registered once, here. Constraints for a module to qualify:
//   - pure Luau: no Roblox services or globals (GameConfig and UploadedAssetSpecs get Vector3/CFrame shims);
//   - every module it requires at runtime is also listed (type-only imports are erased by rbxtsc).
// Studio-only runtime specs stay out of this list and run through `bun run test:roblox`.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";

const root = resolve(import.meta.dir, "..");
const dest = resolve(root, "build/offline-relay");

const MODULES: string[] = [
	// Frozen captures of the retired 27-mission campaign; several live specs still use them as fixtures.
	"tests/legacy/LegacyStory", "tests/LegacyCampaign.spec", "tests/LegacyCatalog", "tests/LegacyPhaseRosters",
	"tests/LegacyAirspaceCapture", "tests/LegacyScoringCapture",
	...Array.from({ length: 27 }, (_, i) => `tests/legacy/legacy${String(i + 1).padStart(2, "0")}`),
	// Mission catalog, the 18 blueprints and the per-mission contract specs.
	"tests/M17Fairness.spec", "tests/M17Mission.spec", "tests/M17Review.spec", "tests/M16Fairness.spec",
	"tests/M16Mission.spec", "tests/M04M05Assets.spec", "shared/MissionPacing", "shared/MissionPolicy",
	"shared/MissionCatalog", "shared/MissionLayouts", "shared/RelayStory", "tests/MissionPolicy.spec",
	"tests/UnifiedMissionRunner.spec", "tests/M03Mission.spec", "tests/M04Mission.spec", "tests/M02Mission.spec",
	"shared/missions/index", "shared/missions/practice", "shared/missions/Phases", "shared/StoryMissionText",
	"tests/M15Mission.spec", "tests/M15Fairness.spec", "server/CombatSessionFactory", "tests/M14FlightStrategy.spec",
	"tests/M09Mission.spec", "tests/M10Mission.spec", "tests/M14Mission.spec", "tests/M12Mission.spec",
	"tests/M13Mission.spec", "tests/M18DuelCombat.spec", "shared/M18FinaleRules", "tests/M18Mission.spec",
	"tests/M11Mission.spec", "tests/M11Encounter.spec", "tests/M05Mission.spec", "tests/M06Mission.spec",
	"tests/M07Mission.spec", "tests/M08Mission.spec",
	...Array.from({ length: 18 }, (_, i) => `shared/missions/m${String(i + 1).padStart(2, "0")}`),
	// Opt-in engine features (formerly EngineBatch B, C, D2-D13): pure rules, fixtures and specs.
	"shared/LandingRules", "tests/LandingRules.spec", "shared/RearmRules", "shared/NightLighting",
	"tests/RearmRules.spec", "shared/CruiseMissileRules", "tests/CruiseMissileRules.spec",
	"tests/CruiseMissileValidation.spec", "shared/ContactInventoryRules", "tests/ContactInventoryRules.spec",
	"tests/EngineRuntimeFixture", "tests/InterceptHoldFixture", "shared/InterceptHoldRules",
	"tests/InterceptHoldRules.spec", "server/ProtectedAircraftRuntime", "server/JammerCorridorRuntime",
	"server/TargetDestruction", "tests/TargetDestruction.spec", "shared/LeaderWithdrawalRules",
	"tests/LeaderWithdrawalRules.spec", "shared/CombatMotion", "shared/CombatEnvelope", "shared/FinaleDuelRules",
	"tests/FinaleDuelRules.spec", "tests/FinaleDuelCombat.spec", "shared/RingSweepRules", "tests/RingSweepRules.spec",
	"tests/ProtectedAircraftFire.spec", "server/RepairReserveRuntime", "tests/RepairReservePhaseExit.spec",
	"shared/RepairReserveRules", "tests/RepairReserveRules.spec", "shared/JammerCorridorRules",
	"tests/JammerCorridorFixture", "tests/JammerCorridorRules.spec", "shared/EncounterKinematics",
	"shared/ProtectedAircraftRules", "tests/ProtectedAircraftFixture", "tests/ProtectedAircraftRules.spec",
	"shared/GroundSectorRules", "tests/GroundSectorRules.spec", "shared/ArtilleryRules", "tests/ArtilleryRules.spec",
	"shared/SurfaceTargetRules", "tests/SurfaceTargetRules.spec", "shared/SortieArmament", "tests/SortieArmament.spec",
	"shared/SortieCutaways",
	// Campaign progression, saves, launch handoff and result continuation.
	"shared/LaunchStage", "shared/InitialTelemetry", "tests/CountdownFlyoff.spec", "shared/DeletionObservation",
	"server/CampaignRequestBudget", "tests/DeletionObservation.spec", "shared/CampaignProgress",
	"server/CampaignRepository", "tests/DeletionStatus.spec", "tests/RelayCampaign.spec",
	"tests/BlueprintProgress.spec", "shared/LaunchLoading", "tests/LaunchLoading.spec", "shared/LoadingScreenModel",
	"tests/LoadingScreenModel.spec", "shared/WorldLifecycle", "tests/WorldLifecycle.spec",
	"shared/TerrainWriteState", "tests/TerrainWriteState.spec",
	"tests/CampaignCompletionPersistence.spec", "shared/CountdownDisplay", "shared/CampaignWire",
	"tests/CampaignWire.spec", "shared/ResultContinuation", "tests/ResultContinuation.spec", "shared/ChapterLaunch",
	"tests/ChapterContinuation.spec",
	// Combat rules: weapons, waves, aces, bombers, allies, scoring and phase direction.
	"shared/AlliedRules", "tests/AlliedRules.spec", "shared/OutcomeReason", "shared/BomberEncounter",
	"tests/BomberEncounter.spec", "tests/MissionAirspace.spec", "server/PhaseDirectorRules", "tests/PhaseDirector.spec",
	"server/SortieScore", "shared/OutcomePoints", "tests/AuthoritativeScoring.spec", "shared/BomberRules",
	"tests/BomberRules.spec", "shared/WorldAirspace", "tests/WeaponRules.spec", "shared/CombatBalance",
	"tests/CombatBalance.spec", "shared/TargetScore", "tests/TargetScore.spec", "tests/MissionScore.spec",
	"shared/NavigationPilot", "shared/FlightMath", "shared/BlueprintRunner", "shared/GameConfig", "shared/Difficulty",
	"shared/MissionScore", "tests/Difficulty.spec", "shared/WeaponRules", "shared/SpecialWeapons", "shared/ThreatRules",
	"tests/ThreatRules.spec", "shared/EvadeRules", "tests/EvadeRules.spec", "shared/AceRules", "tests/AceRules.spec",
	"shared/WavePlan", "tests/WavePlan.spec", "shared/SessionGuard", "tests/SessionGuard.spec", "shared/ActorPlacement",
	"tests/ActorPlacement.spec", "shared/CampaignEncounters", "shared/GroundAirDefence", "tests/EnginePracticeSnapshot",
	"tests/EngineM01Snapshot", "tests/CampaignEncounters.spec",
	// Flight model, telemetry packet, HUD layout, warnings, radar, target boxes and touch controls.
	"shared/UILayout", "tests/UILayout.spec", "shared/NavigationLayout", "tests/NavigationLayout.spec",
	"shared/FlightWarnings", "tests/FlightWarnings.spec", "shared/RadarMath", "tests/RadarMath.spec",
	"shared/EvadeGauge", "tests/EvadeGauge.spec", "shared/PlayerSettings", "tests/PlayerSettings.spec",
	"shared/TouchSticks", "tests/TouchSticks.spec", "shared/HudInstruments", "tests/HudInstruments.spec",
	"tests/TouchControls.spec", "tests/Flight.spec", "shared/FlightPrediction", "shared/TelemetryCodec",
	"tests/FlightPrediction.spec", "shared/TargetPriority", "tests/TargetPriority.spec", "shared/TargetBoxes",
	"tests/TargetBoxes.spec",
	// Effects, audio, voice, radio and cinematics.
	"shared/VoiceReadiness", "tests/VoiceReadiness.spec", "shared/AudioRules", "tests/AudioRules.spec",
	"shared/AssetSelection", "tests/AssetSelection.spec", "shared/CinematicInput", "tests/CinematicInput.spec",
	"shared/CinematicLayout", "tests/CinematicLayout.spec", "shared/CinematicStaging", "tests/CinematicStaging.spec",
	"shared/Teardown", "shared/CinematicSet", "tests/CinematicSet.spec", "shared/StoryDocuments",
	"tests/StoryDocuments.spec", "shared/ExplosionFx", "tests/ExplosionFx.spec", "shared/EngineFx",
	"tests/EngineFx.spec", "shared/ImpactFeedback", "tests/ImpactFeedback.spec", "shared/VoiceCues",
	"shared/VoiceBanks", "shared/VoiceLines", "tests/VoiceLines.spec", "shared/RadioQueue", "tests/RadioQueue.spec",
	"shared/VoiceDisclosure", "tests/VoiceDisclosure.spec",
	// World plans, limits, terrain, environments and uploaded asset specs.
	"shared/RobloxAssetIds", "shared/UploadedAssetOrientation", "shared/M01Geometry", "shared/M01Limits",
	"shared/M01WorldPlan", "tests/M01WorldPlan.spec", "shared/M01CarrierPlan", "tests/M01CarrierPlan.spec",
	"shared/UploadedAssetSpecs", "shared/MilitaryGroundKit", "tests/MilitaryGroundKit.spec", "shared/EnvironmentPresets", "shared/TerrainSchedule", "shared/WorldDistricts",
	"shared/WorldPlan", "shared/WorldAudit", "tests/WorldPlan.spec", "tests/TerrainSchedule.spec",
	"shared/LegacyWorlds", "tests/LegacyWorlds.spec", "tests/EnvironmentPresets.spec", "shared/WeatherRules",
	"tests/WeatherRules.spec", "shared/WorldEnvironments", "shared/LateWorldDressing", "shared/M14Limits",
	"shared/M14WorldPlan", "shared/M15Limits", "shared/M15WorldPlan", "shared/M16Limits", "shared/M16WorldPlan",
	"shared/M17Limits", "shared/M17WorldPlan", "shared/M18Limits", "shared/M18WorldPlan", "tests/M14M18WorldPlan.spec",
	"shared/M12Limits", "shared/M13Limits", "shared/M12WorldPlan", "shared/M13WorldPlan", "tests/M12M13WorldPlan.spec",
	"shared/M10Limits", "shared/M11Limits", "shared/M10WorldPlan", "shared/M11WorldPlan", "tests/M10M11WorldPlan.spec",
	"shared/M08Limits", "shared/M09Limits", "shared/M08WorldPlan", "shared/M09WorldPlan", "tests/M08M09WorldPlan.spec",
	"shared/M06M07WorldCounts", "shared/CompactWorldSurface", "shared/M06Limits", "shared/M07Limits",
	"shared/M06WorldPlan", "shared/M07WorldPlan", "tests/M06M07WorldPlan.spec", "shared/SealedWorldSurface",
	"shared/WorldCompositionCounts", "shared/M04Limits", "shared/M05Limits", "shared/M04WorldPlan",
	"shared/M05WorldPlan", "tests/M04M05WorldPlan.spec", "shared/M03WorldPlan", "shared/M03Limits",
	"tests/M03WorldPlan.spec", "shared/M02WorldPlan", "shared/M02Limits", "tests/M02WorldPlan.spec", "shared/Polyline",
];

const duplicates = MODULES.filter((entry, index) => MODULES.indexOf(entry) !== index);
if (duplicates.length > 0) throw new Error(`Duplicate offline modules: ${duplicates.join(", ")}`);
const SPECS = MODULES.filter((entry) => entry.endsWith(".spec"));

/** Offline file name of a staged module: the last path segment, except the missions index. */
function stagedName(entry: string): string {
	return entry === "shared/missions/index" ? "MissionIndex" : entry.split("/").at(-1)!;
}

// Some standalone Luau versions return a module's load error as a string.
// Guard every import, including transitive dependencies, and every top-level spec.
const checkedRequire = `local rawRequire = require
local function require(path)
 local result = rawRequire(path)
 assert(type(result) ~= "string", "Offline module load failed: " .. path .. ": " .. tostring(result))
 return result
end
`;

await mkdir(dest, { recursive: true });
for (const entry of MODULES) {
	const compiled = entry === "shared/missions/index" ? "shared/missions/init" : entry;
	let source = await Bun.file(resolve(root, `out/${compiled}.luau`)).text();
	source = source
		.split("\n")
		.filter((line) => !line.startsWith("local TS = require("))
		.map((line) => {
			if (!line.includes("TS.import(")) return line;
			const strings = [...line.matchAll(/"([^"\n]+)"/g)];
			const rawName = strings.at(-1)?.[1];
			const name = rawName === "missions" || rawName === "index" ? "MissionIndex" : rawName;
			if (!name) throw new Error(`Cannot adapt dependency: ${line}`);
			return line.replace(/TS\.import\(.*\)/, `require("./${line.includes('"jest-globals"') ? "OfflineAssertions" : name}")`);
		})
		.join("\n");
	if (source.includes("TS.")) throw new Error(`Unadapted runtime dependency in ${entry}`);
	if (entry.endsWith("GameConfig")) source = "local Vector3={new=function(...)return {...}end}; local CFrame={lookAt=function(...)return {...}end}\n" + source;
	if (entry.endsWith("UploadedAssetSpecs")) source = "local Vector3={new=function(x,y,z)return {X=x,Y=y,Z=z}end}\n" + source;
	source = checkedRequire + source;
	if (entry.endsWith(".spec")) source += "\nreturn true\n";
	await Bun.write(resolve(dest, `${stagedName(entry)}.luau`), source);
}

await Bun.write(resolve(dest, "OfflineAssertions.luau"), `
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

// Every staged spec runs, in registration order, then the shared counter reports.
const runScript = checkedRequire
	+ SPECS.map((entry) => `require("./${stagedName(entry)}")\n`).join("")
	+ 'require("./OfflineAssertions").result()\n';
await Bun.write(resolve(dest, "run.luau"), runScript);

const executable = requireLuauBin();
// Prove that parse errors, returned error strings, runtime errors and failed
// transitive imports all stop the process instead of silently skipping coverage.
for (const [kind, source] of Object.entries({
	parse: "return {}\nreturn true\n",
	string: 'return "synthetic module failure"\n',
	runtime: 'error("synthetic runtime failure")\n',
	nested: checkedRequire + 'return require("./guard-parse")\n',
})) {
	await Bun.write(resolve(dest, `guard-${kind}.luau`), source);
	await Bun.write(resolve(dest, "guard-run.luau"), checkedRequire + `require("./guard-${kind}")\n`);
	const probe = Bun.spawn([executable, resolve(dest, "guard-run.luau")], { cwd: root, stdout: "pipe", stderr: "pipe" });
	const [out, err, status] = await Promise.all([new Response(probe.stdout).text(), new Response(probe.stderr).text(), probe.exited]);
	if (status === 0 || (!(out + err).includes("synthetic") && !(out + err).includes("guard-parse"))) throw new Error(`Module error guard failed: ${kind}: ${out}${err}`);
}
console.log("OFFLINE_MODULE_GUARD passed=4 failed=0");
console.log(`OFFLINE_SPECS registered=${SPECS.length}`);

const proc = Bun.spawn([executable, resolve(dest, "run.luau")], { cwd: root, stdout: "pipe", stderr: "pipe" });
const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
console.log(stdout);
if (stderr) console.error(stderr);
await Bun.write(resolve(root, "build/relay-offline-results.log"), stdout + stderr);
if (code !== 0) process.exitCode = code;
