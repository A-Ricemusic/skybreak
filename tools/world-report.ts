// Regenerates the per-mission world counts in docs/world-realism.md from the compiled
// WorldPlan in the official standalone Luau VM. Run `bun run test:offline` first.
//   bun tools/world-report.ts             rewrite the generated block
//   bun tools/world-report.ts --check     fail when the block is stale
//   bun tools/world-report.ts --problems  print every audit problem (debugging)
import {resolve} from "node:path";
import {requireLuauBin} from "./luau-bin";
const root=resolve(import.meta.dir,".."),dir=resolve(root,"build/offline-relay"),doc=resolve(root,"docs/world-realism.md");
const BEGIN="<!-- world-counts:begin (bun tools/world-report.ts) -->",END="<!-- world-counts:end -->";
if(!(await Bun.file(resolve(dir,"WorldPlan.luau")).exists()))throw new Error("Run `bun run test:offline` first: build/offline-relay is missing.");
const executable=requireLuauBin();
const problems=process.argv.includes("--problems");
const generator=String.raw`
local W=require("./WorldPlan")
local A=require("./WorldAudit")
local C=require("./MissionCatalog").MissionCatalog
local rows={}
table.insert(rows,"| Mission | Theme | Environment | Terrain ops | Voxel writes (M) | Hill cells (M) | Parts | Props | Trees | Rocks | Buildings | Ships | Unique meshes | Instances |")
table.insert(rows,"|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
local M=require("./M01WorldPlan")
local p=M.buildM01Plan()
local c=M.m01Counts(p)
table.insert(rows,"| Practice | Legacy training islands | canyon_noon | engine-built | - | - | - | - | - | - | - | - | - | - |")
table.insert(rows,string.format("| M1 | Sea and island | sea overcast afternoon | %d | %.1f | - | %d | %d | - | - | - | - | - | %d |",#p.ops,c.voxels/1e6,c.parts,c.props,c.descendants))

table.insert(rows, "")
table.insert(rows, "Current worlds only. Practice is engine-built; numeric counts require Studio. M1 counts are pure-plan estimates including the carrier stand-in allowance, not assembled runtime measurements.")
table.insert(rows, "M1 budgets: 340 parts, 240 props, 1300 descendants, 260M voxel writes, 30000 scheduled jobs. Practice retains the 600 primitive-part engine budget.")
print("@@BEGIN")
print(table.concat(rows,"\n"))
print("@@END")
`;
const script=resolve(dir,"world-report.luau");
await Bun.write(script,generator);
const proc=Bun.spawn([executable,script],{cwd:root,stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(code!==0){console.error(stdout+stderr);process.exit(code);}
const [before,rest]=stdout.split("@@BEGIN\n");
if(before.trim())console.log(before.trim());
if(problems)process.exit(0);
const table=rest.split("\n@@END")[0];
const current=await Bun.file(doc).exists() ? await Bun.file(doc).text() : "";
const start=current.indexOf(BEGIN),end=current.indexOf(END);
if(start<0||end<0)throw new Error(`docs/world-realism.md needs the ${BEGIN} ... ${END} markers`);
const next=current.slice(0,start+BEGIN.length)+"\n"+table+"\n"+current.slice(end);
if(process.argv.includes("--check")){
	if(next!==current){console.error("docs/world-realism.md world counts are stale: run bun tools/world-report.ts");process.exit(1);}
	console.log("world counts up to date");
}else{await Bun.write(doc,next);console.log("wrote docs/world-realism.md");}
