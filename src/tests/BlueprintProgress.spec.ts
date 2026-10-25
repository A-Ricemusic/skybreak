import {describe,expect,it} from "@rbxts/jest-globals";
import {BlueprintRunner} from "../shared/BlueprintRunner";
import {MissionCatalog,MISSIONS} from "../shared/MissionCatalog";

describe("BlueprintRunner phase progress fractions",()=>{
	it("reports a total for every phase kind that matches its objective total",()=>{
		for(const bp of MISSIONS.filter((b)=>b.id>=3)){
			const state=BlueprintRunner.NewState(bp,0);
			for(let index=0;index<bp.phases.size();index++){
				const phase=bp.phases[index];state.phaseIndex=index;state.phaseProgress=0;
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
	it("counts kills toward combat phase fractions so chatter and reinforcements can trigger",()=>{
		const bp=MissionCatalog.Get(20),state=BlueprintRunner.NewState(bp,0);
		const phase=BlueprintRunner.ActivePhase(state)!;expect(phase.kind).toBe("required_air");expect(phase.count).toBe(5);
		BlueprintRunner.RecordKill(state,"a","air",true,1);BlueprintRunner.RecordKill(state,"b","air",true,2);
		expect(BlueprintRunner.Fraction(state)).toBe(2/5);
		BlueprintRunner.RecordKill(state,"raider","air",false,3);
		expect(BlueprintRunner.Fraction(state)).toBe(2/5);
	});
});
