// Regenerates the per-mission world counts in docs/world-realism.md from the compiled
// WorldPlan in the official standalone Luau VM. Run `bun run test:offline` first.
//   bun tools/world-report.ts             rewrite the generated block
//   bun tools/world-report.ts --check     fail when the block is stale
//   bun tools/world-report.ts --problems  print every audit problem (debugging)
import {resolve} from "node:path";
const root=resolve(import.meta.dir,".."),dir=resolve(root,"build/offline-relay"),doc=resolve(root,"docs/world-realism.md");
const BEGIN="<!-- world-counts:begin (bun tools/world-report.ts) -->",END="<!-- world-counts:end -->";
if(!(await Bun.file(resolve(dir,"WorldPlan.luau")).exists()))throw new Error("Run `bun run test:offline` first: build/offline-relay is missing.");
const executable=process.env.LUAU_BIN ?? resolve(root,"build/offline-luau/luau");
if(!(await Bun.file(executable).exists()))throw new Error("Set LUAU_BIN to the official Luau CLI.");
const problems=process.argv.includes("--problems");
const generator=String.raw`
local W=require("./WorldPlan")
local A=require("./WorldAudit")
local C=require("./MissionCatalog").MissionCatalog
local F=require("./FlightMath").FlightMath
local rows={}
table.insert(rows,"| Mission | Theme | Environment | Terrain ops | Voxel writes (M) | Hill cells (M) | Parts | Props | Core props | Ring props | Backdrop | Trees | Rocks | Buildings | Infra pieces | Unique meshes | Instances | Est. build (s) |")
table.insert(rows,"|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
for id=3,27 do
	local plan=W.WorldPlanner:Build(id)
	local c=W.WorldPlanner.Counts(plan)
	table.insert(rows,string.format("| M%d %s | %s | %s | %d | %.1f | %.2f | %d | %d | %d | %d | %d | %d | %d | %d | %d | %d | %d | %.1f |",id,plan.name,plan.theme,plan.environment,c.terrainOps,c.voxelWrites/1e6,c.bumpCells/1e6,c.parts,c.props,c.coreProps,c.outerProps,c.backdrop,c.trees,c.rocks,c.buildings,c.infrastructure,c.uniqueMeshes,c.instances,c.estimatedSeconds))
	if ${problems ? "true" : "false"} then
		for _,p in A.auditPlan(plan).problems do print("M"..id..": "..p) end
	end
end
local b=W.WORLD_BUDGET
table.insert(rows,"")
table.insert(rows,string.format("Budget per world: %d parts, %d props, %d unique meshes, %d instances, %dM voxel writes, %.1fM hill cells, %d terrain ops.",b.parts,b.props,b.uniqueMeshes,b.instances,b.voxelWrites/1e6,b.bumpCells/1e6,b.terrainOps))
table.insert(rows,string.format("Map: flyable +-%d (soft boundary +-%d), full-detail core +-%d, voxel terrain +-%d, backdrop ridges centred %d out, far skirts to +-%d.",F.HardBoundary,F.SoftBoundary,W.CORE,W.EXTENT,W.BACKDROP,W.FAR))
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
