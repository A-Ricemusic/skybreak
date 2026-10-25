import {describe,expect,it} from "@rbxts/jest-globals";
import {NavigationPilot} from "../shared/NavigationPilot";
import {FlightMath} from "../shared/FlightMath";
import {BlueprintRunner} from "../shared/BlueprintRunner";
import {MissionCatalog,MISSIONS,FlightPoint} from "../shared/MissionCatalog";
import {LEVEL_LAYOUTS} from "../shared/MissionLayouts";
import {STORY} from "../shared/RelayStory";
import {CampaignCoordinator,completeMission,highestUnlocked,normalizeProfile,mergeProfiles,resolveMissionRequest,serializeProfile} from "../server/CampaignRepository";

function coordinator(): CampaignCoordinator {
	const c=new CampaignCoordinator("offline-domain",undefined,{now:()=>1000,defer:()=>undefined});c.load();return c;
}
const origin={x:0,y:250,z:500};
describe("Broken Relay campaign contracts",()=>{
	it("authors 27 unique compositions, ordered missions and 28 three-shot story chapters",()=>{
		expect(MISSIONS.size()).toBe(27);expect(LEVEL_LAYOUTS.size()).toBe(27);expect(STORY.size()).toBe(28);
		const compositions=new Set<string>(),names=new Set<string>(),signatures=new Set<string>();
		for(const bp of MISSIONS){
			expect(bp.id).toBe(names.size()+1);names.add(bp.title);compositions.add(LEVEL_LAYOUTS[bp.id-1].name);
			expect(bp.act).toBe(math.ceil(bp.id/9));
			expect(MissionCatalog.RequiredGroundKills(bp)).toBe(bp.ground.size());
			let activeBound=0;
			for(const p of bp.phases){
				activeBound=math.max(activeBound,(p.kind==="required_air" ? p.count ?? 0 : p.kind==="ace" ? 1 : 0)+(p.optionalRaiders ?? 0));
				if(p.points){
					expect(p.points.size()>0).toBe(true);
					for(const point of p.points){expect(math.abs(point.x)<2300 && math.abs(point.z)<2300 && point.y>=40 && point.y<=900).toBe(true);}
				}
			}
			expect(activeBound<=6).toBe(true);
			if(bp.id>=3)expect(bp.phases.some((p)=>p.points!==undefined)).toBe(true);
			signatures.add(bp.phases.map((p)=>`${p.kind}:${p.count ?? p.seconds ?? 0}`).join("/"));
		}
		expect(compositions.size()).toBe(27);expect(names.size()).toBe(27);expect(signatures.size()>=18).toBe(true);
		for(let i=0;i<STORY.size();i++){expect(STORY[i].id).toBe(i);expect(STORY[i].beats.size()).toBe(3);for(const beat of STORY[i].beats)expect(beat.text.size()>20).toBe(true);}
	});
	for(const bp of MISSIONS.filter((b)=>b.id>=3)) it(`completes every authoritative phase of M${bp.id} in order`,()=>{
		const state=BlueprintRunner.NewState(bp,100);let now=100,serial=0;
		while(state.outcome===undefined && now<690){
			const phase=BlueprintRunner.ActivePhase(state)!;
			const previous=state.phaseIndex;
			if(phase.kind==="required_air" || phase.kind==="required_ground" || phase.kind==="ace"){
				const kind=phase.kind==="required_air" ? "air" : phase.kind==="required_ground" ? "ground" : "ace";
				const id=`target_${serial++}`;expect(BlueprintRunner.RecordKill(state,id,kind,true,++now)).toBe(true);
				expect(BlueprintRunner.RecordKill(state,id,kind,true,now)).toBe(false);
			}else{
				const point=BlueprintRunner.NavigationPoint(state)!;
				const observed={...point,y:math.max(phase.kind==="escort" ? 250 : 130,point.y)};
				now+=.1;BlueprintRunner.ObserveFlight(state,observed,observed,.1,now);
			}
			if(state.phaseIndex!==previous)expect(state.phaseIndex).toBe(previous+1);
		}
		expect(state.outcome).toBe("won");expect(state.phaseIndex).toBe(bp.phases.size());
		expect(state.requiredGroundKills).toBe(bp.ground.size());
		expect(state.requiredAirKills+(state.aceKilled ? 1 : 0)).toBe(MissionCatalog.RequiredAirKills(bp));
	});
	for(const bp of MISSIONS.filter((b)=>b.id>=3)) it(`flies M${bp.id} navigation volumes with legal stick and throttle`,()=>{
		for(let index=0;index<bp.phases.size();index++){
			const phase=bp.phases[index];if(!phase.points)continue;
			const run=BlueprintRunner.NewState(bp,0);run.phaseIndex=index;
			const flight=FlightMath.NewState();let clock=0;
			while(run.phaseIndex===index && run.outcome===undefined && clock<240){
				const point=BlueprintRunner.NavigationPoint(run)!;
				const input=NavigationPilot.Controls(flight,point,phase.radius!,phase.kind!=="route",phase.ceiling);
				expect(math.abs(input.x)<=1 && math.abs(input.y)<=1 && input.throttle>=0 && input.throttle<=1).toBe(true);
				const from={x:flight.x,y:flight.y,z:flight.z};FlightMath.Step(flight,input,1/30);clock+=1/30;
				BlueprintRunner.ObserveFlight(run,from,{x:flight.x,y:flight.y,z:flight.z},1/30,clock);
			}
			expect(run.phaseIndex).toBe(index+1);
		}
	});
	it("requires final broadcast after defeating the Marshal",()=>{
		const bp=MissionCatalog.Get(27),state=BlueprintRunner.NewState(bp,0);
		for(let i=0;i<3;i++)BlueprintRunner.RecordKill(state,`wing${i}`,"air",true,1+i);
		BlueprintRunner.RecordKill(state,"relay","ground",true,5);
		BlueprintRunner.RecordKill(state,"marshal","ace",true,6);
		expect(state.outcome).toBeUndefined();expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("signal");
	});
	it("ignores out-of-volume, above-ceiling and invalid observations, but detects swept gate crossing",()=>{
		const scan=BlueprintRunner.NewState(MissionCatalog.Get(4),0);
		for(let i=0;i<50;i++)BlueprintRunner.ObserveFlight(scan,origin,origin,.1,1);
		expect(scan.phaseProgress).toBe(0);
		const high={x:-400,y:900,z:-600};BlueprintRunner.ObserveFlight(scan,high,high,.1,1);
		expect(scan.phaseProgress).toBe(0);
		const point=BlueprintRunner.NavigationPoint(scan)!;BlueprintRunner.ObserveFlight(scan,point,point,10,1);
		expect(scan.phaseProgress).toBe(0);
		const gate=BlueprintRunner.NewState(MissionCatalog.Get(3),0),nav=BlueprintRunner.NavigationPoint(gate)!;
		const a:FlightPoint={...nav,x:nav.x-250},b:FlightPoint={...nav,x:nav.x+250};
		BlueprintRunner.ObserveFlight(gate,a,b,.1,1);expect(gate.phaseProgress).toBe(1);
	});
	it("does not let optional kills advance escort progress; protected loss fails the sortie",()=>{
		const state=BlueprintRunner.NewState(MissionCatalog.Get(5),0);
		expect(BlueprintRunner.RecordKill(state,"not-required","air",true,1)).toBe(false);
		expect(BlueprintRunner.RecordKill(state,"raider","air",false,1)).toBe(true);
		expect(state.phaseProgress).toBe(0);
		for(let i=0;i<300;i++)BlueprintRunner.ObserveFlight(state,origin,origin,.1,1+i*.1,5);
		expect(state.outcome).toBe("failed");expect(state.reason).toBe("protected_lost");
	});
	it("enforces deadline, monotonic time, destroyed health and immutable outcomes in all 25 new missions",()=>{
		for(const bp of MISSIONS.filter((b)=>b.id>=3)){
			const state=BlueprintRunner.NewState(bp,10);BlueprintRunner.Tick(state,30);BlueprintRunner.Tick(state,20);
			expect(state.elapsed).toBe(20);BlueprintRunner.Tick(state,610);expect(state.reason).toBe("timeout");
			expect(BlueprintRunner.RecordKill(state,"late","air",true,611)).toBe(false);
			BlueprintRunner.Tick(state,20,0);expect(state.reason).toBe("timeout");
			const destroyed=BlueprintRunner.NewState(bp,0);BlueprintRunner.Tick(destroyed,1,0);expect(destroyed.reason).toBe("destroyed");
		}
	});
	it("migrates all four completed v2 slots to M3, preserving best times and replay",()=>{
		const slots=new Map<string,object>();for(let i=1;i<=4;i++)slots.set(tostring(i),{occupied:true,completed:true,mission1Completed:true,mission2Completed:true,mission1BestTime:50+i,mission2BestTime:90+i});
		const p=normalizeProfile({version:2,slots});
		for(let i=0;i<4;i++){const s=p.slots[i];expect(s.currentMission).toBe(3);expect(s.completed).toBe(false);expect(s.missions?.[1]?.bestTime).toBe(51+i);expect(s.missions?.[2]?.bestTime).toBe(91+i);expect(resolveMissionRequest(s,3)[0]).toBe(3);expect(resolveMissionRequest(s,4)[0]).toBeUndefined();}
		const roundTrip=normalizeProfile(serializeProfile(p));expect(roundTrip.slots[3].missions?.[2]?.bestTime).toBe(94);
	});
	it("unlocks every mission sequentially, isolates slots and preserves replay and merged records",()=>{
		const c=coordinator();
		for(let id=1;id<=27;id++){
			const slot=c.getSlots()[0];expect(highestUnlocked(slot)).toBe(id);expect(resolveMissionRequest(slot,undefined)[0]).toBe(id);
			if(id<27)expect(resolveMissionRequest(slot,id+1)[0]).toBeUndefined();
			const bp=MissionCatalog.Get(id);let kind="";
			completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(bp),groundKills:MissionCatalog.RequiredGroundKills(bp),completedPhases:bp.phases.size(),elapsed:100},(m)=>kind=m.kind);
			expect(kind).toBe("Completed");expect(c.getSlots()[0].completed).toBe(id===27);
		}
		c.recordMissionResult(1,5,false,0,80);c.recordMissionResult(1,5,true,3,110);c.recordMissionResult(1,5,true,3,90);
		const slot=c.getSlots()[0];expect(slot.missions?.[5]?.bestTime).toBe(90);expect(slot.completed).toBe(true);
		for(let id=1;id<=27;id++)expect(resolveMissionRequest(slot,id)[0]).toBe(id);
		for(let i=1;i<4;i++)expect(c.getSlots()[i].occupied).toBe(false);
		const merged=mergeProfiles({version:3,slots:c.getSlots()},undefined);
		expect(normalizeProfile(serializeProfile(merged)).slots[0].completed).toBe(true);
	});
	it("rejects forged phase proof, wrong sessions, invalid mission ids and late completion",()=>{
		const c=coordinator(),bp=MissionCatalog.Get(3);let result="";
		const stats={slot:1,missionId:3,kills:4,groundKills:0,elapsed:40};
		completeMission(c,1,3,true,stats,(m)=>result=m.kind);expect(result).toBe("Failed");
		expect(completeMission(c,1,4,true,stats,()=>undefined)).toBe(false);
		completeMission(c,1,3,true,{...stats,completedPhases:bp.phases.size(),elapsed:600},(m)=>result=m.kind);
		expect(result).toBe("Failed");
		for(const id of [0,28,1.5,math.huge])expect(resolveMissionRequest(c.getSlots()[0],id)[0]).toBeUndefined();
	});
});
