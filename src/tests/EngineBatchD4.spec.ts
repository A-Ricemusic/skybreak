import { describe, expect, it } from "@rbxts/jest-globals";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import { d4Fixture } from "./EngineBatchD4Fixture";
function ready() { const s=R.NewState(d4Fixture(),0);s.score=800;R.Tick(s,420);return s; }
describe("Dormant D4 intercept hold",()=>{
	it("validates the 27-air, 800/7:00 to six-western-bomber fresh 6:00 contract",()=>{
		const bp=d4Fixture();MissionCatalog.ValidatePolicy(bp);expect(MissionCatalog.Start(bp).headingDegrees).toBe(315);const s=R.NewState(bp,0);s.score=800;R.Tick(s,419.99);expect(s.phaseIndex).toBe(0);R.Tick(s,420);expect(s.phaseIndex).toBe(1);expect(s.score).toBe(800);expect(R.TimeRemaining(s)).toBe(360);expect(s.updateSerial).toBe(1);
	});
	it("holds after six once-only kills, cues ignition once and wins at zero",()=>{
		const s=ready();for(let i=1;i<=6;i++) expect(R.RecordKill(s,`west-${i}`,"air",true,430+i)).toBe(true);
		expect(R.RecordKill(s,"west-6","air",true,440)).toBe(false);expect(s.requiredAirKills).toBe(6);expect(s.outcome).toBeUndefined();
		R.Tick(s,744.99);expect(s.ignitionAnnounced).toBeUndefined();R.Tick(s,745);expect(s.ignitionAnnounced).toBe(true);const n=s.radioQueue.size();R.Tick(s,746);expect(s.radioQueue.size()).toBe(n);
		R.Tick(s,779.99);expect(s.outcome).toBeUndefined();R.Tick(s,780);expect(s.outcome).toBe("won");expect(R.TimeRemaining(s)).toBe(0);
	});
	it("never counts flight near the protected site as an intercept kill",()=>{
		const s=ready();R.ObserveFlight(s,{x:0,y:80,z:0},{x:0,y:80,z:0},0.1,421);expect(s.phaseProgress).toBe(0);
	});
	it("fails low score, incomplete hold, penetration and destruction",()=>{
		const low=R.NewState(d4Fixture(),0);low.score=799;R.Tick(low,420);expect(low.reason).toBe("timeout");
		const incomplete=ready();R.Tick(incomplete,780);expect(incomplete.reason).toBe("timeout");
		const escaped=ready();R.EscapeBombers(escaped);expect(escaped.reason).toBe("bombers_escaped");expect(escaped.protectedHealth).toBe(0);
		const dead=ready();R.Tick(dead,780,0);expect(dead.reason).toBe("destroyed");
	});
	it("queues exactly 27 finite fighters, never exceeding seven concurrent",()=>{
		const queue:AirRequest[]=[{role:"raider",count:27,behind:false}];let admitted=0;
		for(const free of [7,0,3,7,7,7]) { const batch=WavePlan.Admit(queue,free);const n=batch.reduce((sum,b)=>sum+b.count,0);expect(n<=free).toBe(true);admitted+=n; }
		expect(admitted).toBe(27);expect(queue.size()).toBe(0);
	});
	it("samples a western stream with independent launch clocks and endpoints",()=>{
		const b=d4Fixture().phases[1].bombers!, route=compileBomberEncounter(b);
		expect(BomberRules.Sample(route,0).slots[0].facing.x).toBeCloseTo(1);
		expect(BomberRules.Sample(route,240).escaped).toBe(true);expect(BomberRules.Sample(route,240-b.arrivalSeconds![5]).escaped).toBe(false);
	});
	it("rejects malformed budgets, streams, hold clocks, sites and cues",()=>{
		const mutations:((b:MissionBlueprint)=>void)[]=[
			b=>{b.phases[0].concurrentFighters=13;},b=>{b.phases[0].concurrentFighters=0/0;},b=>{b.phases[0].execution={directSpawn:true};},
			b=>{b.phases[1].update!.countdownSeconds=undefined;},b=>{b.phases[1].bombers!.targetIds=undefined;},
			b=>{b.phases[1].bombers!.arrivalSeconds=[0];},b=>{b.phases[1].bombers!.arrivalSeconds=[0,10,9,30,40,50];},b=>{b.phases[1].bombers!.speed=1;},
			b=>{b.phases[1].interceptHold!.site.x=math.huge;},b=>{b.phases[1].interceptHold!.ignitionSecondsRemaining=360;},b=>{b.phases[1].interceptHold!.ignitionCall="";},
		];
		for(const mutate of mutations) {const bp=d4Fixture();mutate(bp);const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(bp));expect(ok).toBe(false);}
	});
	it("keeps settlement's time bound above the full D4 score and intercept windows",()=>{
		const bp=d4Fixture(), s=R.NewState(bp,1000);s.score=800;
		R.Tick(s,1420);expect(R.TimeRemaining(s)).toBe(360);
		for(let i=1;i<=6;i++) R.RecordKill(s,`west-${i}`,"air",true,1420+i);
		R.Tick(s,1780);expect(s.outcome).toBe("won");expect(s.elapsed).toBe(780);
		expect(MissionCatalog.MaxMissionSeconds(bp)).toBe(MissionCatalog.CountdownSeconds(bp)+420+360);
		expect(s.elapsed<=MissionCatalog.MaxMissionSeconds(bp)).toBe(true);
	});
	it("samples only the requested bomber slot with the same curved-route pose",()=>{
		const route=BomberRules.Create([{x:-1000,y:400,z:0},{x:0,y:600,z:0},{x:1000,y:700,z:-1000}],50);
		for(const t of [-1,0,10,30,route.duration]) for(let slot=0;slot<6;slot++) {
			const all=BomberRules.Sample(route,t), one=BomberRules.Sample(route,t,slot);
			expect(one.slots.size()).toBe(1);expect(one.slots[0]).toEqual(all.slots[slot]);expect(one.escaped).toBe(all.escaped);
		}
	});
	it("leaves missions other than M08 dormant",()=>{for(const b of MissionCatalog.All().filter(b=>b.id!==8)) for(const p of MissionCatalog.ExpandedPhases(b)) {expect(p.interceptHold).toBeUndefined();expect(p.concurrentFighters).toBeUndefined();expect(p.bombers?.arrivalSeconds).toBeUndefined();}});
});
