// Extracts every voiced line from the compiled story and mission catalog into
// assets/voice/lines.json, with stable ids (chapter/beat, mission/phase/slot) and
// the exact on-screen text. Runs in the official standalone Luau VM, like
// tools/relay-tables.ts, so the ids come from the same data the game ships.
//   bun run test:offline && bun tools/voice-lines.ts          rewrite lines.json
//   bun tools/voice-lines.ts --check                          fail when lines.json is stale
// System text (objective labels, flare/drone notices, mission results) is never
// in the catalog's radio fields, so it is never voiced.
import {resolve} from "node:path";
const root=resolve(import.meta.dir,".."),dir=resolve(root,"build/offline-relay"),out=resolve(root,"assets/voice/lines.json");
if(!(await Bun.file(resolve(dir,"MissionCatalog.luau")).exists()))throw new Error("Run `bun run test:offline` first: build/offline-relay is missing.");
const executable=process.env.LUAU_BIN ?? resolve(root,"build/offline-luau/luau");
if(!(await Bun.file(executable).exists()))throw new Error("Set LUAU_BIN to the official Luau CLI.");
const casting=await Bun.file(resolve(root,"assets/voice/casting.json")).json();
// One record per line: id TAB kind TAB speaker TAB text. Catalog text never holds tabs or newlines.
const generator=String.raw`
local C=require("./MissionCatalog")
local S=require("./RelayStory")
local M=require("./StoryMissionText")
local A=require("./AceRules").AceRules
local D=require("./Difficulty").Difficulty
local function emit(id,kind,speaker,text) print(id.."\t"..kind.."\t"..speaker.."\t"..text) end
local function two(n) return string.format("%02d",n) end
for _,ch in S.STORY do
	for b,beat in ch.beats do
		emit("story.c"..two(ch.id)..".b"..two(b-1),"story",S.speakerStyle(beat.speaker).name,beat.text)
	end
end
-- Planned radio is stable story-owned dialogue; mission builders wire these exact strings.
for id=4,18 do
 for i,text in M.MISSION_STORY_TEXT[id].radio do emit("radio.m"..two(id)..".story."..i,"radio","",text) end
end
for _,bp in C.MISSIONS do
	local m="radio.m"..two(bp.id)
	local function phase(p,tag)
		for i,c in (p.landing and p.landing.radio) or {} do emit(tag..".landing"..i,"radio","",c.text) end
		if p.beat then emit(tag..".beat","radio","",p.beat) end
		for i,c in p.chatter or {} do emit(tag..".chatter"..i,"radio","",c.text) end
		for i,g in p.groupCalls or {} do emit(tag..".group"..i,"radio","",g) end
		if p.hazard then emit(tag..".hazard","radio","",p.hazard.text) end
		if p.twist then
			emit(tag..".twist","radio","",p.twist.text)
			for j,q in p.twist.insert do phase(q,tag..".t"..j) end
		end
	end
	for i,p in bp.phases do phase(p,m..".p"..i) end
	for i,s in bp.aceStages or {} do emit(m..".ace.stage"..i,"radio","",s) end
	for i,s in bp.aceReturns or {} do emit(m..".ace.return"..i,"radio","",s) end
	-- The server's own call when a retreating ace brings in its wing (CombatService.aceCall):
	-- every raider count any difficulty can produce, so the template text matches exactly.
	if bp.aceName then
		local total=0
		for _,p in bp.phases do if p.kind=="ace" then total=p.optionalRaiders or 0 end end
		local counts={}
		for _,kind in D.Order do
			local extra=D:Behaviour(kind).extraRaiders
			for stage=1,2 do
				local base=A:RaidersForStage(total,stage)
				if base>0 then counts[base+extra]=true end
			end
		end
		for count=1,12 do
			if counts[count] then emit(m..".ace.call"..count,"radio","","SERA: "..bp.aceName.." pulled back to call his wing. "..count.." inbound.") end
		end
	end
end
`;
await Bun.write(resolve(dir,"voice-lines.luau"),generator);
const proc=Bun.spawn([executable,resolve(dir,"voice-lines.luau")],{cwd:dir,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(code!==0)throw new Error(`Luau line dump failed: ${stderr}`);
interface Line { id:string; kind:"story"|"radio"; speaker:string; voice:string; tape:boolean; text:string; spoken:string }
const speakers=casting.speakers as Record<string,{voice:string;tape?:boolean}>;
const aliases=casting.aliases as Record<string,string>;
const replacements=casting.spokenReplacements as [string,string][];
/** Text sent to the voice: no radio prefix, numbers and shouted records said the way a person would. */
function spoken(text:string): string {
	let value=text;
	for(const [from,to] of replacements)value=value.split(from).join(to);
	return value;
}
const lines:Line[]=[];
const seen=new Set<string>();
for(const row of stdout.split("\n")){
	if(row==="")continue;
	const [id,kind,rawSpeaker,text]=row.split("\t");
	if(seen.has(id))throw new Error(`Duplicate line id ${id}`);
	seen.add(id);
	let speaker=rawSpeaker,body=text,tape=false;
	if(kind==="radio"){
		// "SERA: ...", "TEAL (tape): ...". Unprefixed catalog beats are Varda Control (Sera).
		const match=/^([A-Z][A-Z0-9 ]*[A-Z0-9])( \(tape\))?: (.*)$/.exec(text);
		if(match){speaker=match[1];tape=match[2]!==undefined;body=match[3];}
		else speaker=casting.unprefixedRadio;
	}
	speaker=aliases[speaker] ?? speaker;
	const cast=speakers[speaker];
	if(!cast)throw new Error(`${id}: no casting for speaker ${speaker}`);
	tape=tape || cast.tape===true;
	lines.push({id,kind:kind as Line["kind"],speaker,voice:cast.voice,tape,text,spoken:spoken(body)});
}
const json=JSON.stringify({generatedBy:"bun tools/voice-lines.ts",lines},null,1)+"\n";
if(process.argv.includes("--check")){
	const current=await Bun.file(out).exists() ? await Bun.file(out).text() : "";
	if(current!==json){console.error("assets/voice/lines.json is stale: run bun tools/voice-lines.ts");process.exit(1);}
	console.log(`lines.json current (${lines.length} lines)`);
}else{
	await Bun.write(out,json);
	const chars=lines.reduce((n,l)=>n+l.spoken.length,0);
	const by:Record<string,number>={};
	for(const l of lines)by[l.speaker]=(by[l.speaker]??0)+1;
	console.log(`${lines.length} lines, ${chars} spoken characters`,by);
}
