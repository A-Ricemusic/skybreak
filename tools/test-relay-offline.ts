// Executes compiled pure domain contracts in the official standalone Luau VM.
// This does NOT start Studio, emulate Roblox, or count as a Roblox Jest run.
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const root=resolve(import.meta.dir,".."),dest=resolve(root,"build/offline-relay");
await mkdir(dest,{recursive:true});
const files=["shared/CinematicInput","tests/CinematicInput.spec","shared/NavigationPilot","shared/FlightMath","shared/MissionCatalog","shared/BlueprintRunner","shared/MissionLayouts","shared/RelayStory","shared/GameConfig","server/CampaignRepository","tests/RelayCampaign.spec","tests/BlueprintProgress.spec"];
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
	if(file.startsWith("tests/"))source+="\nreturn true\n";
	await Bun.write(resolve(dest,`${file.split("/").at(-1)}.luau`),source);
}
await Bun.write(resolve(dest,"OfflineAssertions.luau"),`
local passed,failed=0,0
local function expect(value)
 return {
  toBe=function(expected) assert(value==expected, "Expected "..tostring(expected)..", received "..tostring(value)) end,
  toBeUndefined=function() assert(value==nil,"Expected nil, received "..tostring(value)) end,
 }
end
return { expect=expect,
 describe=function(name,fn) print(name);fn() end,
 it=function(name,fn) local ok,err=pcall(fn);if ok then passed+=1;print("PASS "..name) else failed+=1;print("FAIL "..name..": "..tostring(err)) end end,
 result=function() print("OFFLINE_LUAU_RESULT passed="..passed.." failed="..failed);assert(failed==0,"Offline domain contracts failed") end }
`);
await Bun.write(resolve(dest,"run.luau"),'require("./RelayCampaign.spec")\nrequire("./BlueprintProgress.spec")\nrequire("./CinematicInput.spec")\nrequire("./OfflineAssertions").result()\n');
const executable=process.env.LUAU_BIN ?? resolve(root,"build/offline-luau/luau");
if(!(await Bun.file(executable).exists()))throw new Error("Set LUAU_BIN to the official Luau CLI. See docs/broken-relay.md. No Studio fallback will run.");
const proc=Bun.spawn([executable,resolve(dest,"run.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
console.log(stdout);if(stderr)console.error(stderr);
await Bun.write(resolve(root,"build/relay-offline-results.log"),stdout+stderr);
if(code!==0)process.exitCode=code;
