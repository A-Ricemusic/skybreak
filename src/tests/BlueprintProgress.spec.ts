import {describe,expect,it} from "@rbxts/jest-globals";
import {BlueprintRunner} from "../shared/BlueprintRunner";
import {MissionCatalog,MISSIONS} from "../shared/MissionCatalog";

describe("BlueprintRunner phase progress fractions",()=>{
	it("reports a total for every phase kind that matches its objective total",()=>{
		for(const bp of MISSIONS.filter((b)=>b.id>=3)){
			const state=BlueprintRunner.NewState(bp,0);
			const phases=MissionCatalog.ExpandedPhases(bp);state.phases=phases;
			for(let index=0;index<phases.size();index++){
				const phase=phases[index];state.phaseIndex=index;state.phaseProgress=0;
				const total=BlueprintRunner.Total(phase);
				expect(total>0).toBe(true);
				expect(BlueprintRunner.Objective(state).objectiveTotal).toBe(total);
				if(phase.kind==="ace")expect(total).toBe(1);
				else if(phase.kind==="route")expect(total).toBe(phase.points!.size());
				else if(phase.kind==="recon")expect(total).toBe(phase.points!.size()*phase.seconds!);
				else if(phase.kind==="signal" || phase.kind==="escort" || phase.kind==="defend")expect(total).toBe(phase.seconds!);
				else expect(total).toBe(phase.count!);
			}
		}
	});
	it("tracks route checkpoints as a fraction and clamps to 0-1",()=>{
		const bp=MissionCatalog.Get(3),state=BlueprintRunner.NewState(bp,0);
		expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("route");
		expect(BlueprintRunner.Fraction(state)).toBe(0);
		const points=BlueprintRunner.ActivePhase(state)!.points!;
		for(let i=0;i<points.size();i++){
			const expected=i/points.size();
			expect(math.abs(BlueprintRunner.Fraction(state)-expected)<1e-6).toBe(true);
			const point=BlueprintRunner.NavigationPoint(state)!;
			BlueprintRunner.ObserveFlight(state,point,point,.1,1+i*.1);
		}
		expect(state.phaseIndex).toBe(1);
		expect(BlueprintRunner.Fraction(state)).toBe(0);
		state.phaseProgress=99;expect(BlueprintRunner.Fraction(state)).toBe(1);
		state.phaseProgress=-5;expect(BlueprintRunner.Fraction(state)).toBe(0);
	});
	it("advances timed volumes by observed seconds and reports 1 once the mission is won",()=>{
		const bp=MissionCatalog.Get(27),state=BlueprintRunner.NewState(bp,0);
		state.phaseIndex=bp.phases.size()-1;
		const phase=BlueprintRunner.ActivePhase(state)!;expect(phase.kind).toBe("signal");
		const point=BlueprintRunner.NavigationPoint(state)!;
		let clock=0;
		for(let i=0;i<150;i++){clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);}
		expect(state.outcome).toBeUndefined();
		expect(math.abs(BlueprintRunner.Fraction(state)-15/phase.seconds!)<1e-3).toBe(true);
		for(let i=0;i<160;i++){clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);}
		expect(state.outcome).toBe("won");
		expect(BlueprintRunner.Fraction(state)).toBe(1);
	});
	it("fires a twist exactly once at its fraction and never before",()=>{
		// M16: the storm patrol dives after the second of three silos (at 0.67).
		const state=BlueprintRunner.NewState(MissionCatalog.Get(16),0);state.phaseIndex=1;
		const silos=BlueprintRunner.ActivePhase(state)!;expect(silos.twist?.at).toBe(0.66);
		BlueprintRunner.RecordKill(state,"s1","ground",true,1);
		expect(BlueprintRunner.Fraction(state)).toBe(1/3);expect(state.phaseTwisted).toBe(false);expect(BlueprintRunner.TakeRadio(state)).toBeUndefined();
		BlueprintRunner.RecordKill(state,"s2","ground",true,2);
		expect(state.phaseTwisted).toBe(true);expect(BlueprintRunner.Phases(state)[2].label).toBe("Catch the storm patrol");
		expect(BlueprintRunner.TakeRadio(state)).toBe(silos.twist!.text);
		BlueprintRunner.RecordKill(state,"s3","ground",true,3);
		expect(state.phaseIndex).toBe(2);expect(state.phaseTwisted).toBe(false);
		expect(BlueprintRunner.Phases(state).size()).toBe(MissionCatalog.TotalPhases(MissionCatalog.Get(16)));
		// Finishing the inserted phase moves on to the authored relay phase; no second insert happens.
		BlueprintRunner.RecordKill(state,"p1","air",true,4);BlueprintRunner.RecordKill(state,"p2","air",true,5);
		expect(BlueprintRunner.ActivePhase(state)!.label).toBe("Destroy the forward relay");
		expect(BlueprintRunner.Phases(state).size()).toBe(MissionCatalog.TotalPhases(MissionCatalog.Get(16)));
	});
	it("resets a rerouted escort's protected health and moves the convoy marker to the new leg",()=>{
		// M12: the forged broadcast fires at half the first leg; the reroute starts where the truck is.
		const state=BlueprintRunner.NewState(MissionCatalog.Get(12),0);
		const leg=BlueprintRunner.ActivePhase(state)!;expect(leg.kind).toBe("escort");
		let clock=0;
		while(state.phaseIndex===0 && clock<120){clock+=.1;const p=BlueprintRunner.NavigationPoint(state)!;const o={...p,y:250};BlueprintRunner.ObserveFlight(state,o,o,.1,clock,2);}
		expect(state.phaseIndex).toBe(1);expect(state.protectedHealth).toBe(100);
		const reroute=BlueprintRunner.ActivePhase(state)!;expect(reroute.kind).toBe("escort");expect(reroute.label).toBe("Cover the reroute along the mill road");
		const handoff=leg.points![1],start=BlueprintRunner.NavigationPoint(state)!;
		expect(start.x).toBe(handoff.x);expect(start.z).toBe(handoff.z);
		expect(BlueprintRunner.Objective(state).objectiveTotal).toBe(reroute.seconds!);
	});
	it("counts kills toward combat phase fractions so chatter and reinforcements can trigger",()=>{
		const bp=MissionCatalog.Get(20),state=BlueprintRunner.NewState(bp,0);
		const phase=BlueprintRunner.ActivePhase(state)!;expect(phase.kind).toBe("required_air");expect(phase.count).toBe(5);
		BlueprintRunner.RecordKill(state,"a","air",true,1);BlueprintRunner.RecordKill(state,"b","air",true,2);
		expect(BlueprintRunner.Fraction(state)).toBe(2/5);
		BlueprintRunner.RecordKill(state,"raider","air",false,3);
		expect(BlueprintRunner.Fraction(state)).toBe(2/5);
	});
});
