import { Workspace } from "@rbxts/services";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { SamRules } from "../shared/SurfaceTargetRules";
import { arrivalDue } from "../shared/CampaignEncounters";
import { describe, expect, it } from "@rbxts/jest-globals";
import { sinkNavalTarget, stepSurfaceTargets, stepSamDefence, antiShipObstructed } from "../server/SurfaceTargetRuntime";
import { CombatSession, Enemy, Projectile } from "../server/CombatSession";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { TypedGroundTarget } from "../shared/CampaignEncounters";
import { FlightMath } from "../shared/FlightMath";
function target(spec: TypedGroundTarget, folder: Folder): Enemy {
	const model=createGroundTarget(spec); model.Parent=folder;
	return {id:spec.id,typedGround:spec,model,position:model.PrimaryPart!.Position,velocity:Vector3.zero,enabled:true,health:55,windup:0,fireTimer:0} as Enemy;
}
const spec=(id: string): TypedGroundTarget=>({id,type:"cruiser",position:{x:0,y:10,z:0},yaw:0,required:false,scoreRole:"hull",route:{waypoints:[{x:0,y:10,z:0},{x:0,y:10,z:-100}],speed:10}});
function fixture() {
	const folder=new Instance("Folder");
	const hull=target(spec("h"),folder), mount=target({...spec("m"),type:"sam",route:undefined,parentId:"h",position:{x:0,y:30,z:-20},sam:true},folder);
	const s={folder,enemies:[hull,mount],projectiles:[],state:FlightMath.FromPose(0,400,-1000,0,0,160),difficulty:"normal"} as unknown as CombatSession;
	return {s,hull,mount,folder};
}
const warning=(m: Model)=>{const w=new Instance("BillboardGui");w.Parent=m;return w;};
describe("Batch D2 Roblox instance lifecycle (Studio lease required)",()=>{
	it("moves the hull and independent mount models together and holds at route end",()=>{
		const {s,hull,mount,folder}=fixture();
		try {
			const gap=mount.position.sub(hull.position);
			stepSurfaceTargets(s,5); expect(hull.position.Z).toBeCloseTo(-50); expect(mount.position.sub(hull.position)).toEqual(gap);
			stepSurfaceTargets(s,100); expect(hull.position.Z).toBeCloseTo(-100);
			stepSurfaceTargets(s,1); expect(hull.velocity.Magnitude).toBeCloseTo(0);
		} finally {folder.Destroy();}
	});
	it("does not move or fire inactive or destroyed targets",()=>{
		const {s,hull,mount,folder}=fixture();
		try {
			hull.enabled=false; mount.enabled=false;
			stepSurfaceTargets(s,5); stepSamDefence(s,5,warning);
			expect(hull.surfaceStartedAt).toBeUndefined(); expect(s.projectiles.size()).toBe(0);
			hull.enabled=true; hull.health=0; mount.enabled=true; mount.health=0;
			stepSurfaceTargets(s,5); stepSamDefence(s,5,warning); expect(s.projectiles.size()).toBe(0);
		} finally {folder.Destroy();}
	});
	it("retires surviving mounts on sinking without touching a separate hull or projectiles",()=>{
		const {s,hull,mount,folder}=fixture();
		try {
			const other=target({...spec("other"),route:undefined},folder); s.enemies.push(other);
			mount.windup=1; mount.warning=warning(mount.model); mount.warning.Enabled=true;
			expect(sinkNavalTarget(s,hull)).toBe(true);
			expect(mount.health).toBe(0); expect(mount.enabled).toBe(false); expect(s.retiredGroundIds!.has(mount.id)).toBe(true);
			expect(mount.warning.Enabled).toBe(false); expect(mount.model.GetAttribute("Damageable")).toBe(false);
			expect(hull.model.GetAttribute("Sinking")).toBe(true); expect(mount.model.GetAttribute("Sinking")).toBe(true);
			expect(other.health).toBe(55); expect(s.projectiles.size()).toBe(0);
		} finally {folder.Destroy();}
	});
	it("leaves legacy generic ship destruction unchanged unless explicitly fitted",()=>{
		const {s,folder}=fixture();
		try { const legacy=target({...spec("legacy"),type:"ship",route:undefined},folder); expect(sinkNavalTarget(s,legacy)).toBe(false); } finally {folder.Destroy();}
	});
	it("winds up with a visible warning, launches a guided hostile projectile and reloads",()=>{
		const {s,mount,folder}=fixture();
		try {
			stepSamDefence(s,0.1,warning); expect(mount.windup).toBe(2); expect(mount.warning!.Enabled).toBe(true);
			stepSamDefence(s,2,warning); expect(s.projectiles.size()).toBe(1); expect(mount.warning!.Enabled).toBe(false);
			expect(s.projectiles[0].hostile).toBe(true); expect(s.projectiles[0].life).toBe(10); expect(mount.fireTimer).toBe(10);
			stepSamDefence(s,0.1,warning); expect(s.projectiles.size()).toBe(1);
		} finally {folder.Destroy();}
	});
	it("requires explicit SAM opt-in and cancels windup on leaving range",()=>{
		const {s,mount,folder}=fixture();
		try {
			mount.typedGround!.sam=undefined; stepSamDefence(s,5,warning); expect(s.projectiles.size()).toBe(0); expect(mount.windup).toBe(0);
			mount.typedGround!.sam=true; stepSamDefence(s,0.1,warning);
			s.state.x=10000; stepSamDefence(s,5,warning); expect(s.projectiles.size()).toBe(0); expect(mount.windup).toBe(0); expect(mount.warning!.Enabled).toBe(false);
		} finally {folder.Destroy();}
	});
	it("keeps warmups plus airborne SAM missiles inside each difficulty budget until a missile is removed",()=>{
		for(const difficulty of ["easy","normal","ace"] as const) {
			const {s,folder}=fixture();
			try {
				s.difficulty=difficulty;
				for(let i=0;i<8;i++) s.enemies.push(target({...spec(`sam${i}`),type:"sam",route:undefined,sam:true},folder));
				const cap=SamRules.Cap(difficulty), count=()=>s.projectiles.size()+s.enemies.reduce((n,e)=>n+(e.windup>0 ? 1 : 0),0);
				stepSamDefence(s,0.1,warning); expect(count()).toBe(cap);
				stepSamDefence(s,4,warning); expect(s.projectiles.size()).toBe(cap); expect(count()).toBe(cap);
				for(let i=0;i<30;i++) { stepSamDefence(s,1,warning); expect(count()).toBe(cap); }
				for(const missile of s.projectiles) expect(missile.sam).toBe(true);
				s.projectiles.remove(0)!.part.Destroy();
				stepSamDefence(s,0.1,warning); expect(count()).toBe(cap); expect(s.projectiles.size()).toBe(cap-1);
			} finally {folder.Destroy();}
		}
	});
	it("credits a destroyed hull once, sinks surviving mounts without tally/score credit, and releases a deck-group arrival",()=>{
		const {s,hull,mount,folder}=fixture();
		try {
			hull.typedGround!.group="deck"; mount.typedGround!.group="deck"; mount.typedGround!.scoreRole="mount";
			const bp: MissionBlueprint={...MissionCatalog.Get(1),ground:[],phases:[{kind:"score_threshold",label:"Harbour",groundTargets:[hull.typedGround!,mount.typedGround!],scoreThreshold:{points:100,seconds:900,waitForExpiry:true}}],scoring:{basis:"points",points:{hull:120,mount:30},rank:{S:150,A:140,B:130,C:100}}};
			MissionCatalog.ValidatePolicy(bp);
			const state=BlueprintRunner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
			const destroy=()=>{
				const accepted=recordScoredKill(state,ledger,hull.id,"ground",false,10,"hull");
				if(accepted) sinkNavalTarget(s,hull);
				return accepted;
			};
			expect(destroy()).toBe(true); expect(hull.model.GetAttribute("Sinking")).toBe(true); expect(mount.model.GetAttribute("Sinking")).toBe(true);
			expect(ledger.Total()).toBe(120); expect(state.optionalGroundKills).toBe(1); expect(state.killedIds.has(mount.id)).toBe(false);
			expect(destroy()).toBe(false); expect(ledger.Total()).toBe(120); expect(state.optionalGroundKills).toBe(1);
			// Simulate the combat list dropping dead instances; retired group membership survives.
			s.enemies.clear();
			expect(arrivalDue({kind:"ground_group",group:"deck"},{elapsed:10,phase:0,requiredKills:0,destroyed:state.killedIds,retired:s.retiredGroundIds,targets:[hull.typedGround!,mount.typedGround!]})).toBe(true);
		} finally {folder.Destroy();}
	});
	it("blocks the actual anti-ship flight segment on scenery, ignoring the hull and preserving legacy missiles",()=>{
		const {s,hull,folder}=fixture(); folder.Parent=Workspace;
		try {
			const blocker=new Instance("Part"); blocker.Anchored=true; blocker.Size=new Vector3(20,20,2); blocker.Position=new Vector3(0,5000,-50); blocker.Parent=folder;
			const params=new RaycastParams(); params.FilterType=Enum.RaycastFilterType.Include; params.FilterDescendantsInstances=[folder]; s.groundParams=params;
			const missile={antiShip:true,target:hull,position:new Vector3(0,5000,0)} as Projectile, endpoint=new Vector3(0,5000,-100);
			expect(antiShipObstructed(s,missile,endpoint)).toBe(true);
			missile.antiShip=false; expect(antiShipObstructed(s,missile,endpoint)).toBe(false);
			missile.antiShip=true; blocker.Parent=hull.model; expect(antiShipObstructed(s,missile,endpoint)).toBe(false);
			blocker.Parent=undefined; expect(antiShipObstructed(s,missile,endpoint)).toBe(false); blocker.Destroy();
		} finally {folder.Destroy();}
	});

});
