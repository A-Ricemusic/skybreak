import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { AC04World } from "../server/AC04World";
import { AircraftCollision } from "../server/AircraftCollision";
import { WorldEnvironment } from "../server/WorldEnvironment";
import { AC04MissionData } from "../shared/AC04MissionData";
import { AC04WorldPlanner } from "../shared/AC04WorldData";
import { AC04Runner } from "../shared/AC04Runner";
import { LateMegalithSpec } from "../shared/ac04/rebuild/LateMegalith";
import { lateOpenMegalithGate, lateOpenMegalithHatch } from "../shared/ac04/rebuild/LateRuntime";
import { UNSPLIT_MAX } from "../shared/TerrainSchedule";

/** Real-engine geometry contracts. These do not constitute campaign playtests. */
describe("AC04 native world geometry and lifecycle",()=>{
	it("Lifeline air arrivals originate in their authored sector above the industrial structures",()=>{
		for(const g of AC04MissionData.Get(5).roster.filter(g=>g.domain==="air"&&g.phase===0))for(let i=0;i<g.count;i++){
			const p=AC04WorldPlanner.UnitPosition(5,g,i);
			expect(p.y).toBeGreaterThanOrEqual(1100);
			if(g.site==="refinery-patrol")expect(p.x).toBeLessThan(-1000);
			if(g.site==="rig-patrol")expect(p.x).toBeGreaterThan(1000);
			if(g.site==="south-patrol")expect(p.z).toBeGreaterThan(0);
		}
	});
	let fixture:Folder|undefined;
	const make=()=>{fixture=new Instance("Folder");fixture.Name="AC04WorldFixture";fixture.Parent=Workspace;return fixture;};
	const params=(instances:Instance[],water=false)=>{const r=new RaycastParams();r.FilterType=Enum.RaycastFilterType.Include;r.FilterDescendantsInstances=instances;r.IgnoreWater=!water;return r;};
	afterEach(()=>{fixture?.Destroy();fixture=undefined;Workspace.Terrain.Clear();WorldEnvironment.Clear();});
	it("keeps unsplit native terrain regions under the engine voxel cap across all missions",()=>{
		for(let id=1;id<=18;id++)for(const op of AC04WorldPlanner.Build(id).ops)if(op.shape==="wedge"){
			const boundingCells=math.ceil((op.sx+8)/4)*math.ceil((op.sy+8)/4)*math.ceil((op.sz+8)/4);
			expect(boundingCells).toBeLessThan(UNSPLIT_MAX);
		}
	});
	it("rebuilds within an owned parent without retaining the prior world's targets",()=>{
		const parent=make(),first=AC04World.Build(2,parent);
		const unrelated=new Instance("Folder");unrelated.Name="Session-owned nonworld state";unrelated.Parent=parent;
		expect(first.groundTargets.size()).toBeGreaterThan(10);
		const oldModels=first.groundTargets.map(t=>t.model);
		AC04World.Build(1,parent);
		expect(oldModels.every(model=>model.Parent===undefined)).toBe(true);
		expect(unrelated.Parent).toBe(parent);
		expect(parent.GetChildren().filter(c=>c.GetAttribute("AC04WorldOwned")===true).size()).toBe(1);
		const spawn=AC04WorldPlanner.Layout(1).spawn;
		expect(Workspace.Raycast(new Vector3(spawn.x,spawn.y,spawn.z),new Vector3(0,0,-500),params([parent,Workspace.Terrain]))).toBeUndefined();
	});
	it("places Comberth ships over water and keeps their approach rays out of quays",()=>{
		const parent=make(),world=AC04World.Build(6,parent),mission=AC04MissionData.Get(6);
		let ships=0;
		for(const t of world.groundTargets){const g=mission.roster.find(row=>row.id===t.groupId)!;if(g.domain!=="naval")continue;
			ships++;const at=t.model.PrimaryPart!.Position;
			const water=Workspace.Raycast(new Vector3(at.X,200,at.Z),new Vector3(0,-250,0),params([Workspace.Terrain],true));
			expect(water?.Material).toBe(Enum.Material.Water);
			const approach=Workspace.Raycast(new Vector3(at.X,400,at.Z),new Vector3(0,-400,0),params([parent,Workspace.Terrain]));
			expect(approach!==undefined&&approach.Instance.IsDescendantOf(t.model)).toBe(true);
		}
		expect(ships).toBeGreaterThan(15);
		// AC04-IND61-001: the third Tanager gun launches 0.5 studs below its barrel.
		// Preserve that assembled geometry, but exclude the launcher from its own outgoing ray.
		const gun=world.groundTargets.find(t=>t.id==="tanager-gun_3")!.model;
		const origin=gun.PrimaryPart!.Position.add(new Vector3(0,0,-18));
		const flight=AircraftCollision.Parameters(parent),up=new Vector3(0,20,0);
		const originalHit=Workspace.Raycast(origin,up,flight);
		expect(originalHit?.Instance.Name).toBe("Gun barrels");
		expect(originalHit?.Instance.IsDescendantOf(gun)).toBe(true);
		const outgoing=AircraftCollision.WithoutShooter(flight,gun);
		expect(Workspace.Raycast(origin,up,outgoing)).toBeUndefined();
		// The shared aircraft/player weapon allowlist still sees the barrel.
		expect(Workspace.Raycast(origin,up,flight)?.Instance).toBe(originalHit?.Instance);
		const host=world.groundTargets.find(t=>t.groupId==="tanager")!.model;
		expect(outgoing.FilterDescendantsInstances.some(surface=>surface.IsDescendantOf(host))).toBe(true);
		expect(outgoing.FilterDescendantsInstances.includes(Workspace.Terrain)).toBe(true);
		// Another surface above the gun remains real cover for hostile missiles.
		const cover=new Instance("Part");cover.Anchored=true;cover.Size=new Vector3(20,2,20);
		cover.Position=origin.add(new Vector3(0,30,0));cover.SetAttribute("FlightSolid",true);cover.Parent=parent;
		const covered=AircraftCollision.WithoutShooter(AircraftCollision.Parameters(parent),gun);
		expect(Workspace.Raycast(origin,new Vector3(0,60,0),covered)?.Instance).toBe(cover);
	});
	it("keeps every composed Tango Line submarine berth wet at center, bow and stern",()=>{
		const parent=make(),world=AC04World.Build(10,parent),mission=AC04MissionData.Get(10);
		let submarines=0;
		for(const t of world.groundTargets){
			const g=mission.roster.find(g=>g.id===t.groupId)!;if(g.domain!=="naval")continue;
			submarines++;const at=t.model.PrimaryPart!.Position;
			for(const dz of [-65,0,65]){
				const hit=Workspace.Raycast(new Vector3(at.X,250,at.Z+dz),new Vector3(0,-300,0),params([Workspace.Terrain],true));
				expect(hit?.Material).toBe(Enum.Material.Water);
			}
		}
		expect(submarines).toBe(6);
	});
	it("builds seven distinct active Stonehenge guns and an unscored ruined eighth position",()=>{
		const parent=make(),world=AC04World.Build(12,parent);
		const guns=world.groundTargets.filter(t=>t.groupId==="stonehenge");expect(guns.size()).toBe(7);
		expect(parent.FindFirstChild("Destroyed eighth railgun foundation",true)).toBeDefined();
		for(const gun of guns){
			const center=gun.model.PrimaryPart!.Position;
			expect(math.sqrt(center.X*center.X+(center.Z+300)**2)).toBeCloseTo(650,1);
			const hit=Workspace.Raycast(center.add(new Vector3(0,500,0)),new Vector3(0,-500,0),params([parent,Workspace.Terrain]));
			expect(hit!==undefined&&hit.Instance.IsDescendantOf(gun.model)).toBe(true);
		}
		expect(world.groundTargets.filter(t=>t.groupId==="jammer").size()).toBe(1);
		const jammer=world.groundTargets.find(t=>t.groupId==="jammer")!.model;
		const jammerAt=jammer.PrimaryPart!.Position;
		const jamRay=Workspace.Raycast(jammerAt.add(new Vector3(0,0,300)),new Vector3(0,0,-300),params([parent]));
		expect(jamRay!==undefined&&jamRay.Instance.IsDescendantOf(jammer)).toBe(true);
	});
	it("keeps Megalith's arms, low duct and exit shaft clear while gating the core tube",()=>{
	const parent=make(),world=AC04World.Build(18,parent),r=params([parent,Workspace.Terrain]);
	const S=LateMegalithSpec,armY=(S.highFloor+S.highRoof)/2,ductY=(S.floor+S.barRoof)/2;
	for(const x of [-720,720])for(const o of [0,60])expect(Workspace.Raycast(new Vector3(x,armY+o,2100),new Vector3(0,0,-3700),r)).toBeUndefined();
	for(const o of [0,60])expect(Workspace.Raycast(new Vector3(2200,ductY+o,-1000),new Vector3(-4400,0,0),r)).toBeUndefined();
	for(const port of world.groundTargets.filter(t=>t.groupId==="ports")){const at=port.model.PrimaryPart!.Position;expect(at.Z).toBeGreaterThan(0);const hit=Workspace.Raycast(at.add(new Vector3(0,500,0)),new Vector3(0,-500,0),r);expect(hit!==undefined&&hit.Instance.IsDescendantOf(port.model)).toBe(true);}

	const gate=parent.FindFirstChild("AC04CoreGate",true)!;
	expect(Workspace.Raycast(new Vector3(0,armY,2100),new Vector3(0,0,-2400),r)?.Instance).toBe(gate);
		const hatch=parent.FindFirstChild(S.hatchName,true) as BasePart;
		expect(hatch.GetAttribute("FlightSolid")).toBe(true);expect(hatch.CanQuery).toBe(true);
		for(const x of [-179,0,179])for(const z of [-1449,-1150,-851])expect(Workspace.Raycast(new Vector3(x,900,z),new Vector3(0,-230,0),r)?.Instance).toBe(hatch);
		expect(Workspace.Raycast(new Vector3(0,armY,-1150),new Vector3(0,900,0),r)?.Instance).toBe(hatch);
		const collision=AircraftCollision.Parameters(parent);
		expect(AircraftCollision.Sweep(new Vector3(0,650,-1150),new Vector3(0,800,-1150),collision)?.Instance).toBe(hatch);
		const run=AC04Runner.New(18,0);
		expect(lateOpenMegalithHatch(parent,run)).toBe(false);expect(lateOpenMegalithGate(parent,run)).toBe(false);
		const kill=(id:string)=>{const g=run.mission.roster.find(g=>g.id===id)!;run.spawned.add(id);expect(AC04Runner.RecordKill(run,g,AC04MissionData.InstanceId(g,0),10)).toBe(true);};
		kill("generator-west");kill("generator-east");expect(lateOpenMegalithGate(parent,run)).toBe(false);
		kill("generator-north");expect(lateOpenMegalithGate(parent,run)).toBe(true);
		expect(lateOpenMegalithHatch(parent,run)).toBe(false);
		kill("core");expect(run.outcome).toBeUndefined();expect(lateOpenMegalithHatch(parent,run)).toBe(true);
		expect(hatch.CanQuery).toBe(false);expect(hatch.GetAttribute("FlightSolid")).toBe(false);
		expect(AircraftCollision.Sweep(new Vector3(0,650,-1150),new Vector3(0,800,-1150),collision)).toBeUndefined();
		expect(Workspace.Raycast(new Vector3(0,armY,-1150),new Vector3(0,900,0),r)).toBeUndefined();
	const core=world.groundTargets.find(t=>t.groupId==="core")!.model;
	for(const item of core.GetDescendants())if(item.IsA("BasePart")){expect(item.Transparency).toBe(1);expect(item.CanQuery).toBe(false);}
	AC04World.SetVisible(core,true);
	const active=Workspace.Raycast(new Vector3(0,armY,-800),new Vector3(0,0,-700),params([core]));
	expect(active!==undefined&&active.Instance.IsDescendantOf(core)).toBe(true);
	expect(core.GetExtentsSize().Y).toBeGreaterThan(150);
		AC04World.Build(18,parent);
		expect(hatch.Parent).toBeUndefined();
		const retryHatch=parent.FindFirstChild(S.hatchName,true) as BasePart;
		expect(retryHatch.CanQuery).toBe(true);expect(retryHatch.GetAttribute("FlightSolid")).toBe(true);
		expect(lateOpenMegalithHatch(parent,AC04Runner.New(18,0))).toBe(false);
});
	it("rejects a cancelled build before altering another owner's world",()=>{
		const parent=make();const marker=new Instance("Part");marker.Parent=parent;
		expect(()=>AC04World.Build(1,parent,()=>false)).toThrow();
		expect(marker.Parent).toBe(parent);
	});
	it("keeps every low Gnome Ravine jammer exposed above terrain",()=>{
		const parent=make(),world=AC04World.Build(13,parent);
		const balloons=world.groundTargets.filter(t=>t.groupId==="balloons");
		expect(balloons.size()).toBeGreaterThanOrEqual(25);
		for(const target of balloons){
			const at=target.model.PrimaryPart!.Position;
			const cover=Workspace.Raycast(at.add(new Vector3(0,2000,0)),new Vector3(0,-2025,0),params([Workspace.Terrain]));
			expect(cover).toBeUndefined();
		}
	});
	it("exposes Farbanti headquarters defenses and makes the scored bridge the visible bridge",()=>{
		const parent=make(),world=AC04World.Build(17,parent),r=params([parent,Workspace.Terrain]);
		for(const target of world.groundTargets.filter(t=>t.groupId==="sam")){
			const at=target.model.PrimaryPart!.Position;
			const hit=Workspace.Raycast(at.add(new Vector3(0,400,0)),new Vector3(0,-400,0),r);
			expect(hit!==undefined&&hit.Instance.IsDescendantOf(target.model)).toBe(true);
		}
		const bridge=world.groundTargets.find(t=>t.groupId==="bridge")!.model;
		const at=bridge.PrimaryPart!.Position;
		const hit=Workspace.Raycast(at.add(new Vector3(0,300,0)),new Vector3(0,-300,0),r);
		expect(hit!==undefined&&hit.Instance.IsDescendantOf(bridge)).toBe(true);
		expect(bridge.GetExtentsSize().Z).toBeGreaterThan(800);
		bridge.Destroy();
		expect(parent.FindFirstChild("Johnson Memorial Bridge deck",true)).toBeUndefined();
		expect(parent.FindFirstChild("Johnson Memorial Bridge",true)).toBeUndefined();
	});
});
