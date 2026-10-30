import { describe, expect, it } from "@rbxts/jest-globals";
import { sinkNavalTarget, stepSurfaceTargets, stepSamDefence } from "../server/EngineBatchD2Runtime";
import { CombatSession, Enemy } from "../server/CombatSession";
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
});
