import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04Runner, AC04Run } from "../shared/AC04Runner";
import { AC04MissionData } from "../shared/AC04MissionData";
function killGroup(s: AC04Run, id: string, now: number, count?: number): void {
	const group = s.mission.roster.find((g) => g.id === id)!;
	s.spawned.add(id);
	for (let i=0;i<(count??group.count);i++) AC04Runner.RecordKill(s,group,AC04MissionData.InstanceId(group,i),now);
}
describe("AC04 authoritative campaign phases",()=>{
	it("Lifeline opens with a patrol, gates refinery arrivals by local kills, and replenishes only cleared groups",()=>{
		const s=AC04Runner.New(5,0), roster=s.mission.roster;
		const group=(id:string)=>roster.find(g=>g.id===id)!;
		expect(roster.filter(g=>g.domain==="air"&&AC04Runner.GroupDue(s,g)).reduce((n,g)=>n+g.count,0)).toBe(7);
		for(const unitType of ["F-16","MiG-29","MIR-2000"])expect(roster.filter(g=>g.type===unitType).reduce((n,g)=>n+g.count,0)).toBe(unitType==="MiG-29"?13:7);
		killGroup(s,"cranes",10);expect(AC04Runner.GroupDue(s,group("mig"))).toBe(false);
		killGroup(s,"fuel-small",11);killGroup(s,"pumps",12,1);
		expect(AC04Runner.GroupDue(s,group("mig"))).toBe(false);
		expect(AC04Runner.RecordKill(s,group("fuel-small"),"fuel-small_1",13)).toBe(false);
		expect(AC04Runner.GroupDue(s,group("mig"))).toBe(false);
		killGroup(s,"refinery",14,1);expect(AC04Runner.GroupDue(s,group("mig"))).toBe(true);
		AC04Runner.Tick(s,100);expect(AC04Runner.GroupDue(s,group("f16-return-1"))).toBe(false);
		killGroup(s,"f16",101);AC04Runner.Tick(s,130);expect(AC04Runner.GroupDue(s,group("f16-return-1"))).toBe(false);
		AC04Runner.Tick(s,131);expect(AC04Runner.GroupDue(s,group("f16-return-1"))).toBe(true);
		s.spawned.add("f16-return-1");expect(AC04Runner.GroupDue(s,group("f16-return-1"))).toBe(false);
	});
	it("Lifeline has legitimate fixed-target score independent of waves, waits 600s, retires all old waves and requires timely return",()=>{
		const s=AC04Runner.New(5,0);
		for(const g of s.mission.roster)if(g.domain==="ground"||g.domain==="naval"){
			expect(AC04Runner.GroupDue(s,g)).toBe(true);killGroup(s,g.id,100);
		}
		expect(s.score).toBeGreaterThanOrEqual(4000);expect(s.phaseIndex).toBe(0);
		AC04Runner.Tick(s,599.9);expect(s.phaseIndex).toBe(0);AC04Runner.Tick(s,600);
		expect(s.phaseIndex).toBe(1);expect(AC04Runner.Remaining(s)).toBe(240);expect(s.outcome).toBeUndefined();
		for(const g of s.mission.roster.filter(g=>g.phase===0))expect(AC04Runner.GroupDue(s,g)).toBe(false);
		const yellow=s.mission.roster.find(g=>g.id==="yellow")!;expect(AC04Runner.GroupDue(s,yellow)).toBe(true);
		killGroup(s,"yellow",601);expect(s.groupKills.get("yellow")).toBeUndefined();
		AC04Runner.CrossReturn(s,839);expect(s.outcome).toBe("won");
		const failed=AC04Runner.New(5,0);AC04Runner.Tick(failed,600);expect(failed.reason).toBe("score_requirement");
	});

	it("exposes the real M3 return line only after all radars, without completing or shortening its clock",()=>{
		const s=AC04Runner.New(3,0);
		expect(AC04Runner.ReturnNavigation(s,3200)).toBeUndefined();
		for(const g of s.mission.roster.filter(g=>g.required))killGroup(s,g.id,20);
		expect(AC04Runner.Phase(s).kind).toBe("return");
		expect(AC04Runner.ReturnNavigation(s,3200)).toEqual({x:0,y:0,z:3200});
		expect(AC04Runner.Remaining(s)).toBe(900);expect(s.outcome).toBeUndefined();
		AC04Runner.Tick(s,31);expect(AC04Runner.Objective(s).objectiveProgress).toBe(11);
		AC04Runner.CrossReturn(s,32);expect(s.outcome).toBe("won");
		expect(AC04Runner.ReturnNavigation(s,3200)).toBeUndefined();
	});
	it("Bunker Shot uses verified 80-point batteries and permits the source S threshold arithmetically",()=>{
		// AC04-MIDDLE-REBUILD: per-beach groups; 60-unit aggregate and every per-type count remain provisional.
		const mission=AC04MissionData.Get(9), batteries=mission.roster.filter(g=>g.type==="BATTERY");
		expect(batteries.every(g=>g.points===80&&g.provisional===true)).toBe(true);expect(batteries.reduce((n,g)=>n+g.count,0)).toBe(9);
		const points=(groups:typeof mission.roster)=>groups.reduce((sum,g)=>sum+g.count*g.points,0);
		const initial=mission.roster.filter(g=>g.phase===0), ground=initial.filter(g=>g.domain==="ground");
		expect(ground.reduce((sum,g)=>sum+g.count,0)).toBe(60);
		expect(points(ground)).toBe(3030); expect(points(initial)).toBe(3780);
		expect(mission.roster.filter(g=>g.domain==="air").reduce((sum,g)=>sum+g.count,0)).toBe(23);
		expect(points(mission.roster)).toBe(4620); expect(mission.sRank).toBe(4400);
		expect(points(mission.roster)>=mission.sRank).toBe(true);
	});
	it("requires all six bombers; escorts do not substitute, duplicate and foreign identities cannot score",()=>{
		const s=AC04Runner.New(1,100); killGroup(s,"escorts-f5",101);
		expect(s.outcome).toBeUndefined();killGroup(s,"bombers",102,5);expect(s.outcome).toBeUndefined();
		const group=s.mission.roster[0],before=s.score;
		expect(AC04Runner.RecordKill(s,group,"bombers_1",103)).toBe(false);
		expect(AC04Runner.RecordKill(s,group,"fake_6",103)).toBe(false);expect(s.score).toBe(before);
		expect(AC04Runner.RecordKill(s,group,"bombers_6",103)).toBe(true);expect(s.outcome).toBe("won");
	});
	it("does not accept the last kill at or after the target deadline",()=>{
		const s=AC04Runner.New(1,0);killGroup(s,"bombers",599,5);
		expect(AC04Runner.RecordKill(s,s.mission.roster[0],"bombers_6",600)).toBe(false);
		expect(s.reason).toBe("timeout");expect(s.requiredKills).toBe(5);
	});
	it("score threshold does not skip the initial operation clock",()=>{
		const s=AC04Runner.New(15,0);s.score=2000;AC04Runner.Tick(s,599);expect(s.phaseIndex).toBe(0);
		AC04Runner.Tick(s,600);expect(s.phaseIndex).toBe(1);expect(AC04Runner.Remaining(s)).toBe(600);
	});
	it("fails a score phase at expiry when the threshold is unmet",()=>{
		const s=AC04Runner.New(16,0);s.score=3499;AC04Runner.Tick(s,1200);expect(s.outcome).toBe("failed");expect(s.reason).toBe("score_requirement");
	});
	it("Escort arrival is success, protected loss is failure, and all ten attackers can finish early",()=>{
		const arrival=AC04Runner.New(11,0);AC04Runner.Tick(arrival,330);expect(arrival.outcome).toBe("won");
		const loss=AC04Runner.New(11,0);AC04Runner.Fail(loss,"protected_lost");AC04Runner.Tick(loss,330);expect(loss.outcome).toBe("failed");
		const early=AC04Runner.New(11,0);for(const id of ["wave-1","wave-2","wave-3","wave-4"])killGroup(early,id,10);
		expect(early.outcome).toBeUndefined();killGroup(early,"wave-4-mig",11);expect(early.outcome).toBe("won");
	});
	it("Escort reinforcements are due by preceding kills OR authored timer",()=>{
		const s=AC04Runner.New(11,0),g=s.mission.roster.find((x)=>x.id==="wave-2")!;
		expect(AC04Runner.GroupDue(s,g)).toBe(false);AC04Runner.Tick(s,100);expect(AC04Runner.GroupDue(s,g)).toBe(true);
		const early=AC04Runner.New(11,0);killGroup(early,"wave-1",10);expect(AC04Runner.GroupDue(early,g)).toBe(true);
	});
	it("Shattered Skies holds the bomber-defense phase until its clock ends",()=>{
		const s=AC04Runner.New(8,0);s.score=800;AC04Runner.Tick(s,420);killGroup(s,"b2",430);
		expect(s.outcome).toBeUndefined();AC04Runner.Tick(s,780);expect(s.outcome).toBe("won");
	});
	it("Stonehenge ends the encounter after one Yellow loss, not five",()=>{
		const s=AC04Runner.New(12,0);killGroup(s,"stonehenge",10);expect(s.phaseIndex).toBe(1);
		killGroup(s,"yellow",11,1);expect(s.outcome).toBe("won");
	});
	it("source-protected Yellow Squadron cannot be scored as kills",()=>{
		const s=AC04Runner.New(5,0);s.score=2000;AC04Runner.Tick(s,600);killGroup(s,"yellow",601);
		expect(s.groupKills.get("yellow")).toBeUndefined();expect(s.score).toBe(2000);
	});
	it("return is a separate requirement and crossing after expiry cannot win",()=>{
		const s=AC04Runner.New(7,0);for(const id of ["solar-tower","control","radar"])killGroup(s,id,10);
		expect(s.phaseIndex).toBe(1);expect(s.outcome).toBeUndefined();AC04Runner.CrossReturn(s,610);expect(s.outcome).toBe("failed");
		const live=AC04Runner.New(7,0);for(const id of ["solar-tower","control","radar"])killGroup(live,id,10);AC04Runner.CrossReturn(live,609);expect(live.outcome).toBe("won");
	});
	it("Megalith requires three generators, the core and an actual escape event",()=>{
		const s=AC04Runner.New(18,0);for(const id of ["generator-west","generator-east","generator-north"])killGroup(s,id,10);
		expect(s.phaseIndex).toBe(1);killGroup(s,"core",11);expect(s.outcome).toBeUndefined();AC04Runner.Escape(s,12);expect(s.outcome).toBe("won");
		const failed=AC04Runner.New(18,0);for(const id of ["generator-west","generator-east","generator-north"])killGroup(failed,id,10);AC04Runner.Escape(failed,11);expect(failed.reason).toBe("core_not_destroyed");
	});
	it("paused spans do not advance phase clocks when the owning session shifts its origin",()=>{
		const s=AC04Runner.New(1,100);AC04Runner.Tick(s,200);s.startedAt+=300;AC04Runner.Tick(s,500);expect(s.elapsed).toBe(100);expect(AC04Runner.Remaining(s)).toBe(500);
	});
	it("Bunker Shot retires ground targets at the update before a stale weapon can score",()=>{
		const s=AC04Runner.New(9,0),ground=s.mission.roster.find(g=>g.domain==="ground")!,air=s.mission.roster.find(g=>g.domain==="air"&&g.phase===0)!;
		s.score=2200;s.spawned.add(ground.id);s.spawned.add(air.id);
		expect(AC04Runner.RecordKill(s,ground,AC04MissionData.InstanceId(ground,0),600)).toBe(false);
		expect(s.phaseIndex).toBe(1);expect(s.score).toBe(2200);expect(s.dead.size()).toBe(0);
		expect(AC04Runner.RecordKill(s,air,AC04MissionData.InstanceId(air,0),601)).toBe(true);
	});
	it("Safe Return balloons cease scoring after update while the frigate remains eligible",()=>{
		const s=AC04Runner.New(13,0),balloons=s.mission.roster.find(g=>g.id==="balloons")!,frigate=s.mission.roster.find(g=>g.id==="frigate")!;
		s.score=1300;s.spawned.add(balloons.id);s.spawned.add(frigate.id);
		expect(AC04Runner.RecordKill(s,balloons,AC04MissionData.InstanceId(balloons,0),420)).toBe(false);
		expect(s.score).toBe(1300);expect(AC04Runner.RecordKill(s,frigate,AC04MissionData.InstanceId(frigate,0),421)).toBe(true);
	});
	it("retired delayed groups cannot spawn again and Lifeline's old battle cannot score",()=>{
		const s=AC04Runner.New(5,0),group=s.mission.roster[0];s.score=2000;AC04Runner.Tick(s,600);
		expect(AC04Runner.GroupDue(s,group)).toBe(false);s.spawned.add(group.id);
		expect(AC04Runner.RecordKill(s,group,AC04MissionData.InstanceId(group,0),601)).toBe(false);
	});
});
