import { describe, expect, it } from "@rbxts/jest-globals";
import { AntiShipRules, navalHull, SamRules, surfacePose, validateNavalTargets } from "../shared/EngineBatchD2";
import { GROUND_TARGET_LABELS, TypedGroundTarget } from "../shared/CampaignEncounters";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { validateArmament } from "../shared/SortieArmament";
const p=(x: number,y=0,z=0)=>({x,y,z});
const hull=(): TypedGroundTarget=>({id:"hull",type:"cruiser",position:p(0),yaw:0,required:false,scoreRole:"hull",health:220,route:{waypoints:[p(0),p(0,0,-100),p(100,0,-100)],speed:10}});
const mount=(): TypedGroundTarget=>({id:"mount",type:"sam",position:p(0,25),yaw:0,required:false,scoreRole:"mount",parentId:"hull",sam:true});
function rejected(targets: TypedGroundTarget[]): boolean { const [ok]=pcall(()=>validateNavalTargets(targets,1000)); return !ok; }
describe("Dormant batch D2 contracts",()=>{
	it("labels every M6 naval/harbour class without relabelling warehouses",()=>{
		for(const t of ["destroyer","cruiser","submarine","missile_boat","supply_ship","landing_ship","container_ship"] as const) { expect(navalHull(t)).toBe(true); expect(GROUND_TARGET_LABELS[t].size()>0).toBe(true); }
		expect(GROUND_TARGET_LABELS.gun_mount).toBe("GUN"); expect(GROUND_TARGET_LABELS.storage).toBe("STORAGE"); expect(navalHull("storage")).toBe(false);
	});
	it("accepts hulls with separately scored AA, gun and opt-in SAM mounts",()=>{
		for(const t of ["sam","aa_gun","gun_mount"] as const) expect(rejected([hull(),{...mount(),type:t,sam:t==="sam" ? true : undefined}])).toBe(false);
	});
	it("requires a hull in the same phase, forbids nested/required/moving mounts",()=>{
		expect(rejected([mount()])).toBe(true);
		for(const m of [{...mount(),parentId:"mount"},{...mount(),required:true},{...mount(),route:hull().route},{...mount(),type:"storage" as const}]) expect(rejected([hull(),m])).toBe(true);
	});
	it("rejects mounts outside the hull envelope",()=>{
		for(const pos of [p(181,20),p(0,-1),p(0,101),p(0,20,181)]) expect(rejected([hull(),{...mount(),position:pos}])).toBe(true);
	});
	it("rejects non-water routes, invalid speed, jumps and repeated points",()=>{
		for(const speed of [0,-1,61,0/0,math.huge]) expect(rejected([{...hull(),route:{waypoints:[p(0),p(100)],speed}}])).toBe(true);
		for(const points of [[p(0)],[p(0),p(0)],[p(1),p(100)],[p(0),p(100,1)],[p(0),p(1001)]]) expect(rejected([{...hull(),route:{waypoints:points,speed:10}}])).toBe(true);
		expect(rejected([{...hull(),type:"storage"}])).toBe(true);
	});
	it("rejects malformed health and firing SAM data",()=>{
		for(const health of [0,-1,2001,math.huge,0/0]) expect(rejected([{...hull(),health}])).toBe(true);
		expect(rejected([{...hull(),sam:true}])).toBe(true);
		const [ok]=pcall(()=>validateArmament({antiShip:false} as unknown as MissionBlueprint["armament"],false)); expect(ok).toBe(false);
		validateArmament({antiShip:true},false);
	});
	it("samples straight surface legs at constant speed and holds the final berth",()=>{
		const r=hull().route!;
		expect(surfacePose(r,5).position).toEqual(p(0,0,-50));
		expect(surfacePose(r,10).position).toEqual(p(0,0,-100));
		expect(surfacePose(r,15).position).toEqual(p(50,0,-100));
		expect(surfacePose(r,100).position).toEqual(p(100,0,-100)); expect(surfacePose(r,100).moving).toBe(false);
		expect(surfacePose(r,-1).position).toEqual(p(0));
	});
	it("gates SAM engagement by life, phase and range with difficulty-scaled pressure",()=>{
		expect(SamRules.Eligible(true,true,1000)).toBe(true);
		for(const d of [119,2401]) expect(SamRules.Eligible(true,true,d)).toBe(false);
		expect(SamRules.Eligible(false,true,1000)).toBe(false); expect(SamRules.Eligible(true,false,1000)).toBe(false);
		expect(SamRules.Scale("easy")<SamRules.Scale("normal")).toBe(true); expect(SamRules.Scale("ace")>SamRules.Scale("normal")).toBe(true);
	});
	it("sea-skims far from the hull and terminally seeks its aim point",()=>{
		expect(AntiShipRules.Aim(p(0,500),p(1000,15),0)).toEqual(p(1000,22));
		expect(AntiShipRules.Aim(p(900,22),p(1000,15),0)).toEqual(p(1000,15));
		expect(AntiShipRules.Damage).toBe(220);
	});
	it("scores mount then hull once each while holding score phase to expiry",()=>{
		const bp: MissionBlueprint={...MissionCatalog.Get(1),ground:[],phases:[{kind:"score_threshold",label:"Harbour",groundTargets:[hull(),mount()],scoreThreshold:{points:100,seconds:900,waitForExpiry:true}}],scoring:{basis:"points",points:{hull:120,mount:30},rank:{S:150,A:140,B:130,C:100}}};
		MissionCatalog.ValidatePolicy(bp);
		const state=BlueprintRunner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
		for(const [id,role] of [["mount","mount"],["hull","hull"]]) {
			expect(recordScoredKill(state,ledger,id,"ground",false,10,role)).toBe(true);
			expect(recordScoredKill(state,ledger,id,"ground",false,10,role)).toBe(false);
		}
		expect(ledger.Total()).toBe(150); expect(state.outcome).toBeUndefined();
	});
});
