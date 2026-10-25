/** Numeric/data-only TypeScript contract checks. This runs no Roblox engine,
 * meshes, UI, flight controller, Studio, Rojo server, or Roblox Jest runner.
 * The same pure fixtures also compile into Campaign27.spec for Roblox Jest.
 */
import { plugin } from "bun";
import { strict as check } from "node:assert";
const NativeMap = Map, NativeSet = Set;
class DomainMap {
	private entries = new NativeMap();
	constructor(items?: Iterable<[unknown,unknown]>) { if(items) for(const [k,v] of items) this.entries.set(k,v); }
	get(key: unknown) { return this.entries.get(key); }
	set(key: unknown,value: unknown) { this.entries.set(key,value); return this; }
	has(key: unknown) { return this.entries.has(key); }
	size() { return this.entries.size; }
	[Symbol.iterator]() { return this.entries[Symbol.iterator](); }
}
class DomainSet {
	private entries = new NativeSet();
	add(value: unknown) { this.entries.add(value); return this; }
	has(value: unknown) { return this.entries.has(value); }
	size() { return this.entries.size; }
}
Object.defineProperties(Array.prototype, {size:{value:function(){return this.length;}},get:{value:function(index:number){return this[index-1];}}});
Object.defineProperties(String.prototype, {
	size:{value:function(){return this.length;}},
	find:{value:function(needle:string){const index=this.indexOf(needle);return [index<0?undefined:index+1];}},
	sub:{value:function(first:number,last?:number){return this.slice(first-1,last);}}
});
Object.assign(globalThis, {
	__DomainMap:DomainMap,__DomainSet:DomainSet,
	math:{...Object.fromEntries(Object.getOwnPropertyNames(Math).map(k=>[k,(Math as any)[k]])), huge:Infinity,pi:Math.PI,clamp:(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x))},
	typeIs:(value:unknown,type:string)=>type==="table"?typeof value==="object"&&value!==null:typeof value===type,
	tostring:String,$tuple:(...values:unknown[])=>values,
	assert:(value:unknown,message?:string)=>check.ok(value,message),
	os:{time:()=>Date.now()/1000}, task:{defer:(f:()=>void)=>f()}, warn:console.warn,
	string:{format:(fmt:string,...values:unknown[])=>{let i=0;return fmt.replace(/%02d|%d|%s/g,token=>{const v=String(values[i++]);return token==="%02d"?v.padStart(2,"0"):v;});}}
});
plugin({ name:"pure-domain-luau-collection-facade", setup(build) {
	build.onLoad({filter:/\/src\/(shared|server|tests)\/.*\.ts$/},async(args)=>({contents:"const Map = globalThis.__DomainMap; const Set = globalThis.__DomainSet;\n"+await Bun.file(args.path).text(),loader:"ts"}));
}});
const {verifyDefinition,verifyProgression}=await import("../src/tests/CampaignContracts");
const {CampaignCoordinator,normalizeProfile,serializeProfile,resolveMissionRequest,completeMission,mergeProfiles}=await import("../src/server/CampaignRepository");
const {MissionCatalog}=await import("../src/shared/MissionCatalog");
const {MissionRules}=await import("../src/shared/MissionRules");
const {Story}=await import("../src/shared/Story");
const {WorldLayouts}=await import("../src/shared/WorldLayouts");
let contracts=0;
for(let id=1;id<=27;id++){verifyDefinition(id);verifyProgression(id);contracts+=2;}
check.equal(new NativeSet(WorldLayouts.All.map(l=>JSON.stringify(l.sites))).size,27); contracts++;
for(let id=1;id<=28;id++){const s=Story.Get(id);check.equal(s.beats.length,3);for(const b of s.beats)check.ok(b.text.length>8);contracts++;}
const legacy = new DomainMap();legacy.set("2",{completed:true,mission2Completed:true,mission2BestTime:80,kills:9});
const migrated=normalizeProfile({version:2,slots:legacy});check.equal(migrated.slots[1].currentMission,3);check.equal(migrated.slots[1].completed,false);check.equal(migrated.slots[1].missionBestTimes!.get("2"),80);contracts++;
const c=new CampaignCoordinator("offline");c.load();
for(let id=1;id<=27;id++){
	const slot=c.getSlots()[2];check.equal(resolveMissionRequest(slot,id)[0],id);
	if(id<27)check.equal(resolveMissionRequest(slot,id+1)[0],undefined);
	const d=MissionCatalog.Get(id);let won=false;
	completeMission(c,3,id,true,{slot:3,missionId:id,kills:MissionCatalog.RequiredAirKills(d),groundKills:MissionCatalog.RequiredGroundKills(d),elapsed:100,objectivesComplete:true},m=>won=m.kind==="Completed");
	check.equal(won,true);contracts++;
}
check.equal(c.getSlots()[2].completed,true);check.equal(c.getSlots()[0].occupied,false);
c.recordMissionResult(3,4,true,5,90);c.recordMissionResult(3,4,true,5,110);check.equal(c.getSlots()[2].missionBestTimes!.get("4"),90);
const restored=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()}));check.equal(restored.slots[2].missionBestTimes!.size(),27);
check.equal(mergeProfiles(serializeProfile(restored),undefined).slots[2].completed,true);contracts++;
const fresh=new CampaignCoordinator("guard");fresh.load();check.equal(fresh.recordMissionResult(1,27,true,40,100).completed,false);
fresh.recordMissionResult(1,1,true,3,50);fresh.recordMissionResult(1,2,true,4,80);let won=true;
completeMission(fresh,1,3,true,{slot:1,missionId:3,kills:40,groundKills:40,elapsed:100},m=>won=m.kind==="Completed");check.equal(won,false);contracts++;
const escort=MissionRules.NewState(9,0);MissionRules.ObserveEscort(escort,true,0,0.1,1);check.equal(escort.reason,"asset_lost");contracts++;
for(const slug of ["relay","sam","carrier"]){
	const mesh=await Bun.file(`assets/mission/${slug}.mesh.json`).json();check.ok(mesh.faces.length<=5000);check.ok(mesh.materials.length<=7);
	for(const face of mesh.faces){check.equal(face.indices.length,3);for(const index of face.indices)check.ok(index>=0&&index<mesh.vertices.length);}
	contracts++;
}
console.log(`PASS: ${contracts} offline data/domain contracts; 27 mission paths, 28 stories, saves and mesh bounds. Roblox engine/Jest/playthrough NOT run.`);
