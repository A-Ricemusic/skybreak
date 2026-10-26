// Regenerates the mission manifest and the par/estimate tables in docs/broken-relay.md from the
// compiled catalog (MissionCatalog, MissionLayouts) and MissionScore.ParSeconds, in the official
// standalone Luau VM. Run `bun run test:offline` first (it adapts the compiled modules).
//   bun tools/relay-tables.ts          rewrite the generated block
//   bun tools/relay-tables.ts --check  fail when the block is stale
import {resolve} from "node:path";
const root=resolve(import.meta.dir,".."),dir=resolve(root,"build/offline-relay"),doc=resolve(root,"docs/broken-relay.md");
const BEGIN="<!-- relay-tables:begin (bun tools/relay-tables.ts) -->",END="<!-- relay-tables:end -->";
if(!(await Bun.file(resolve(dir,"MissionCatalog.luau")).exists()))throw new Error("Run `bun run test:offline` first: build/offline-relay is missing.");
const executable=process.env.LUAU_BIN ?? resolve(root,"build/offline-luau/luau");
if(!(await Bun.file(executable).exists()))throw new Error("Set LUAU_BIN to the official Luau CLI.");
// Design estimate for an average phone pilot (seconds), kept here because it is documentation, not game rules.
const generator=String.raw`
local C=require("./MissionCatalog")
local L=require("./MissionLayouts")
local S=require("./MissionScore")
local Catalog=C.MissionCatalog
local P=require("./MissionPacing")
-- Non-ASCII glyphs as code points: Bun escapes them inside a raw template.
local ARROW,TWIST,DASH=utf8.char(0x2192),utf8.char(0x21E2),utf8.char(0x2014)
local function pct(x) return string.format("%d%%",math.floor(x*100+0.5)) end
local function note(p,bp)
	local parts={}
	if p.kind=="required_air" and (p.groups or 1)>1 then
		local g=string.format("%d in %d groups",p.count,p.groups)
		if p.groupAt then local at={} for _,a in p.groupAt do table.insert(at,pct(a)) end g..=(#at==1 and ", the second at " or ", later groups at ")..table.concat(at,"/").." of the phase" end
		if p.flank then g..=", flanking" end
		table.insert(parts,g)
	elseif p.kind=="required_air" and p.flank then table.insert(parts,"flanking") end
	if p.kind=="escort" or p.kind=="defend" or p.kind=="signal" then table.insert(parts,string.format("%d s",p.seconds)) end
	if p.hazard then table.insert(parts,string.format("%d %s",p.hazard.count,p.hazard.effect=="jam" and "jammers freeze it" or "bank guns")) end
	if p.kind=="chase" then table.insert(parts,string.format("escapes after %d s",p.seconds)) end
	if p.kind=="ace" then table.insert(parts,string.format("%d hull, 3 stages",bp.aceHealth or 165)) end
	if p.directed then table.insert(parts,"directed") end
	local raiders=p.optionalRaiders or 0
	if raiders>0 then
		if p.kind=="ace" then table.insert(parts,string.format("raiders %d + %d on its calls",math.ceil(raiders/2),raiders-math.ceil(raiders/2)))
		else
			local r={} local first=Catalog:InitialRaiders(p)
			if first>0 then table.insert(r,tostring(first)) end
			for _,w in p.reinforce or {} do table.insert(r,string.format("%d at %s",w.count,pct(w.at))) end
			table.insert(parts,"raiders "..table.concat(r," + "))
		end
	end
	return #parts>0 and (" ("..table.concat(parts,"; ")..")") or ""
end
local function render(p,bp) return p.label..note(p,bp) end
print("| # | Mission / composition | Required phase sequence |")
print("|---|---|---|")
for _,bp in C.MISSIONS do
	local seq={}
	for _,p in bp.phases do
		local text=render(p,bp)
		if p.twist then local ins={} for _,q in p.twist.insert do table.insert(ins,render(q,bp)) end text..=" "..TWIST.." *twist* "..table.concat(ins," "..ARROW.." ") end
		table.insert(seq,text)
	end
	print(string.format("| %d | %s %s %s | %s |",bp.id,bp.title,DASH,L.LEVEL_LAYOUTS[bp.id].name,table.concat(seq," "..ARROW.." ")))
end
print("")
local rows,total={},0
for _,bp in C.MISSIONS do
	local seconds=P.MissionPacing:EstimateSeconds(bp)
	total+=seconds
	rows[bp.id]=string.format("| %d | %d s | %.1f min |",bp.id,S.MissionScore:ParSeconds(bp),seconds/60)
end
print("| # | Par | Average human (design est.) | | # | Par | Average human (design est.) | | # | Par | Average human (design est.) |")
print("|--:|--:|--:|---|--:|--:|--:|---|--:|--:|--:|")
for i=1,9 do print(rows[i].." "..rows[i+9].." "..rows[i+18]) end
print("")
print(string.format("Design-estimate campaign total for the average pilot: about %d minutes of flying.",math.floor(total/60+0.5)))
`;
await Bun.write(resolve(dir,"relay-tables.luau"),generator);
const proc=Bun.spawn([executable,resolve(dir,"relay-tables.luau")],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(code!==0)throw new Error(`relay-tables generator failed:\n${stderr}`);
const text=await Bun.file(doc).text();
const start=text.indexOf(BEGIN),end=text.indexOf(END);
if(start<0 || end<start)throw new Error(`docs/broken-relay.md needs the ${BEGIN} ... ${END} markers`);
const next=text.slice(0,start+BEGIN.length)+"\n\n"+stdout.trim()+"\n\n"+text.slice(end);
if(process.argv.includes("--check")){
	if(next!==text){console.error("docs/broken-relay.md tables are stale: run bun tools/relay-tables.ts");process.exitCode=1;}
	else console.log("docs/broken-relay.md tables match the catalog.");
}else{await Bun.write(doc,next);console.log("docs/broken-relay.md tables regenerated.");}
