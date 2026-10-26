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
		for(let i=0;i<phase.seconds!*10;i++){clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);}
		expect(state.outcome).toBe("won");
		expect(BlueprintRunner.Fraction(state)).toBe(1);
	});
	it("fires a twist exactly once at its fraction and never before",()=>{
		// M16: the storm patrol dives after the second of three silos (at 0.67).
		const state=BlueprintRunner.NewState(MissionCatalog.Get(16),0);state.phaseIndex=2;
		const silos=BlueprintRunner.ActivePhase(state)!;expect(silos.twist?.at).toBe(0.66);
		BlueprintRunner.RecordKill(state,"s1","ground",true,1);
		expect(BlueprintRunner.Fraction(state)).toBe(1/3);expect(state.phaseTwisted).toBe(false);expect(BlueprintRunner.TakeRadio(state)).toBeUndefined();
		BlueprintRunner.RecordKill(state,"s2","ground",true,2);
		expect(state.phaseTwisted).toBe(true);expect(BlueprintRunner.Phases(state)[3].label).toBe("Catch the storm patrol");
		expect(BlueprintRunner.TakeRadio(state)).toBe(silos.twist!.text);
		BlueprintRunner.RecordKill(state,"s3","ground",true,3);
		expect(state.phaseIndex).toBe(3);expect(state.phaseTwisted).toBe(false);
		expect(BlueprintRunner.Phases(state).size()).toBe(MissionCatalog.TotalPhases(MissionCatalog.Get(16)));
		// Finishing the inserted phase moves on to the authored relay phase; no second insert happens.
		for(let i=0;i<BlueprintRunner.Total(BlueprintRunner.ActivePhase(state)!);i++)BlueprintRunner.RecordKill(state,`p${i}`,"air",true,4+i);
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
		const scout=BlueprintRunner.ActivePhase(state)!;expect(scout.kind).toBe("recon");
		expect(scout.parkedEscort?.x).toBe(leg.points![1].x);expect(scout.parkedEscort?.z).toBe(leg.points![1].z);
		// The truck waits at the fork until the mill road is checked.
		expect(BlueprintRunner.RecordKill(state,"skip-scout","air",true,clock)).toBe(false);
		while(state.phaseIndex===1){clock+=.1;const p=BlueprintRunner.NavigationPoint(state)!;BlueprintRunner.ObserveFlight(state,p,p,.1,clock);}
		expect(state.phaseIndex).toBe(2);
		const reroute=BlueprintRunner.ActivePhase(state)!;expect(reroute.kind).toBe("escort");expect(reroute.label).toBe("Cover the reroute along the mill road");
		const handoff=leg.points![1],start=BlueprintRunner.NavigationPoint(state)!;
		expect(start.x).toBe(handoff.x);expect(start.z).toBe(handoff.z);
		expect(BlueprintRunner.Objective(state).objectiveTotal).toBe(reroute.seconds!);
	});
	it("counts kills toward combat phase fractions so chatter and reinforcements can trigger",()=>{
		const bp=MissionCatalog.Get(20),state=BlueprintRunner.NewState(bp,0);
		const phase=BlueprintRunner.ActivePhase(state)!;expect(phase.kind).toBe("required_air");expect(phase.count).toBe(9);expect(phase.groups).toBe(3);
		BlueprintRunner.RecordKill(state,"a","air",true,1);BlueprintRunner.RecordKill(state,"b","air",true,2);
		expect(BlueprintRunner.Fraction(state)).toBe(2/9);
		// Raider kills never count toward the required tally (M20's wing phase allows none, so this one is refused too).
		BlueprintRunner.RecordKill(state,"raider","air",false,3);
		expect(BlueprintRunner.Fraction(state)).toBe(2/9);
	});
});
describe("Round-2 phase mechanics in the runner",()=>{
	it("lets a courier escape when its clock runs out and counts its kill as a required air kill",()=>{
		const bp=MissionCatalog.Get(7),phases=MissionCatalog.ExpandedPhases(bp);
		const index=phases.findIndex((p)=>p.kind==="chase");expect(index>=0).toBe(true);
		const chase=phases[index];expect(chase.seconds).toBe(90);expect(chase.count).toBe(1);
		const escaped=BlueprintRunner.NewState(bp,0);escaped.phaseIndex=index;
		const p={x:0,y:300,z:0};let clock=0;
		for(let i=0;i<899;i++){clock+=.1;BlueprintRunner.ObserveFlight(escaped,p,p,.1,clock);}
		expect(escaped.outcome).toBeUndefined();
		expect(math.abs(BlueprintRunner.Fraction(escaped)-0.999)<0.01).toBe(true);
		clock+=.1;BlueprintRunner.ObserveFlight(escaped,p,p,.1,clock);
		expect(escaped.outcome).toBe("failed");expect(escaped.reason).toBe("escaped");
		const caught=BlueprintRunner.NewState(bp,0);caught.phaseIndex=index;
		expect(BlueprintRunner.CanDamage(caught,"air",true)).toBe(true);
		expect(BlueprintRunner.RecordKill(caught,"courier","air",true,5)).toBe(true);
		expect(caught.requiredAirKills).toBe(1);expect(caught.outcome).toBeUndefined();expect(BlueprintRunner.ActivePhase(caught)?.kind).toBe("route");
	});
	it("freezes a jammed signal hold until its jammers die, and they count as required ground kills",()=>{
		const bp=MissionCatalog.Get(15),state=BlueprintRunner.NewState(bp,0);
		const hold=BlueprintRunner.ActivePhase(state)!;expect(hold.kind).toBe("signal");expect(hold.hazard?.effect).toBe("jam");
		const point=BlueprintRunner.NavigationPoint(state)!;let clock=0;
		expect(BlueprintRunner.CanDamage(state,"ground",true)).toBe(false);
		while(!state.hazardFired && clock<200){clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);}
		expect(math.abs(state.phaseProgress-hold.seconds!*hold.hazard!.at)<0.2).toBe(true);
		expect(BlueprintRunner.TakeRadio(state)).toBe(hold.hazard!.text);
		const frozen=state.phaseProgress;
		for(let i=0;i<100;i++){clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);}
		expect(state.phaseProgress).toBe(frozen);
		expect(BlueprintRunner.CanDamage(state,"ground",true)).toBe(true);
		expect(BlueprintRunner.RecordKill(state,"jammer1","ground",true,clock)).toBe(true);
		expect(BlueprintRunner.HazardLive(state)).toBe(true);
		expect(BlueprintRunner.RecordKill(state,"jammer2","ground",true,clock)).toBe(true);
		expect(BlueprintRunner.HazardLive(state)).toBe(false);expect(state.requiredGroundKills).toBe(2);
		expect(BlueprintRunner.CanDamage(state,"ground",true)).toBe(false);
		clock+=.1;BlueprintRunner.ObserveFlight(state,point,point,.1,clock);
		expect(state.phaseProgress>frozen).toBe(true);
		expect(MissionCatalog.RequiredGroundKills(bp)).toBe(bp.ground.size());
	});
	it("holds an escort at its end while bank guns live and lets them drain the convoy",()=>{
		const bp=MissionCatalog.Get(20),phases=MissionCatalog.ExpandedPhases(bp);
		const index=phases.findIndex((p)=>p.kind==="escort");const escort=phases[index];
		expect(escort.hazard?.effect).toBe("guns");
		const state=BlueprintRunner.NewState(bp,0);state.phaseIndex=index;let clock=0;
		const step=()=>{clock+=.1;const p=BlueprintRunner.NavigationPoint(state)!;BlueprintRunner.ObserveFlight(state,{...p,y:250},{...p,y:250},.1,clock);};
		while(!state.hazardFired && clock<200)step();
		expect(state.protectedHealth).toBe(100);
		// Two live guns drain like three raiders on an otherwise empty sky.
		for(let i=0;i<50;i++)step();
		const drained=100-state.protectedHealth;
		expect(math.abs(drained-5*2*BlueprintRunner.GunWeight*BlueprintRunner.ProtectDrain)<0.5).toBe(true);
		BlueprintRunner.RecordKill(state,"gunW","ground",true,clock);
		while(state.phaseProgress<escort.seconds! && clock<400)step();
		// The launch reached the end of its route but waits under the last gun.
		for(let i=0;i<20;i++)step();
		expect(state.phaseIndex).toBe(index);expect(BlueprintRunner.HazardLive(state)).toBe(true);expect(state.outcome).toBeUndefined();
		BlueprintRunner.RecordKill(state,"gunE","ground",true,clock);
		expect(state.outcome).toBeUndefined();expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("route");
	});
	it("widens the optional kill cap by one per raider wave when every wave brings an extra raider",()=>{
		const bp=MissionCatalog.Get(5),phase=bp.phases[0];expect(phase.kind).toBe("escort");
		expect(MissionCatalog.RaiderWaves(phase)).toBe(2);
		expect(MissionCatalog.RaiderCap(phase,0)).toBe(phase.optionalRaiders!);
		expect(MissionCatalog.RaiderCap(phase,1)).toBe(phase.optionalRaiders!+2);
		for(const extra of [0,1]){
			const state=BlueprintRunner.NewState(bp,0,extra);let kills=0;
			while(BlueprintRunner.RecordKill(state,`raider${kills}`,"air",false,1))kills+=1;
			expect(kills).toBe(MissionCatalog.RaiderCap(phase,extra));
		}
		// An ace phase's raiders arrive in its two retreat calls.
		const ace=MissionCatalog.Get(27).phases.find((p)=>p.kind==="ace")!;
		expect(MissionCatalog.RaiderWaves(ace)).toBe(2);expect(MissionCatalog.InitialRaiders(ace)).toBe(0);
	});
	it("allocates ground targets to strikes and hazards in phase order, hiding hazards and hidden strikes",()=>{
		const m10=MissionCatalog.Get(10),phases=MissionCatalog.ExpandedPhases(m10);
		const kiro=phases.findIndex((p)=>p.label==="Cut Node Kiro's transmitter"),radar=phases.findIndex((p)=>p.label==="Kill the camp radar");
		expect(MissionCatalog.GroundStart(phases,kiro)).toBe(0);expect(MissionCatalog.GroundStart(phases,radar)).toBe(1);
		expect(m10.ground[1].name).toBe("CAMP RADAR");expect(phases[radar].directed).toBe(true);
		const hidden=MissionCatalog.HiddenGround(m10);expect(hidden.has(1)).toBe(true);expect(hidden.has(0)).toBe(false);
		const m15=MissionCatalog.HiddenGround(MissionCatalog.Get(15));expect(m15.has(0) && m15.has(1)).toBe(true);
		const m8=MissionCatalog.Get(8);const m8Hidden=MissionCatalog.HiddenGround(m8);
		expect(m8Hidden.has(0) && m8Hidden.has(1)).toBe(true);expect(m8.ground.size()).toBe(2);
		for(const bp of MISSIONS)for(const index of MissionCatalog.HiddenGround(bp))expect(index>=0 && index<bp.ground.size()).toBe(true);
	});
});

describe("Review regressions: real cover and visible handoffs", () => {
	it("lets each new protected beat lose its actor when the pilot abandons it, on all difficulties", () => {
		const labels = [
			[19, "Escort the harbor workers"], [21, "Cover the repair launch"],
			[22, "Cover the harbor inspection launch"], [23, "Cover the blockade inspection launch"],
			[24, "Escort the deck crew's rescue launch"], [26, "Protect the parliament quay launch"],
			[26, "Cover the witness launch to parliament"],
		] as [number, string][];
		for (const [id, label] of labels) for (const scale of [0.75, 1, 1.25]) {
			const bp = MissionCatalog.Get(id), phases = MissionCatalog.ExpandedPhases(bp);
			const index = phases.findIndex((p) => p.label === label), phase = phases[index];
			expect(phase.kind === "escort" || phase.kind === "defend").toBe(true);
			const initial = MissionCatalog.InitialRaiders(phase);
			expect(initial).toBe(2);
			const abandoned = BlueprintRunner.NewState(bp, 0); abandoned.phases = phases; abandoned.phaseIndex = index;
			// Outside the station volume: no free objective progress while the raiders
			// stay over the actor. The same server drain used by older escorts applies.
			const away = { x: -2200, y: 800, z: 2200 };
			for (let tick = 1; tick <= 1400 && abandoned.outcome === undefined; tick++) {
				BlueprintRunner.ObserveFlight(abandoned, away, away, 0.1, tick / 10, initial, scale);
			}
			expect(abandoned.reason).toBe("protected_lost");
			const defended = BlueprintRunner.NewState(bp, 0); defended.phases = phases; defended.phaseIndex = index;
			// Clear the two real optional raiders, then cover the full route/hold.
			for (let enemy = 0; enemy < initial; enemy++) expect(BlueprintRunner.RecordKill(defended, `r${enemy}`, "air", false, 0)).toBe(true);
			for (let tick = 1; tick <= 600 && defended.phaseIndex === index; tick++) {
				const point = BlueprintRunner.NavigationPoint(defended)!;
				BlueprintRunner.ObserveFlight(defended, point, point, 0.1, tick / 10, 0, scale);
			}
			expect(defended.phaseIndex).toBe(index + 1);
			expect(defended.protectedHealth).toBe(100);
		}
	});
	it("keeps parked truck and launch positions at their preceding escort endpoint", () => {
		for (const id of [12, 20, 21]) {
			const phases = MissionCatalog.ExpandedPhases(MissionCatalog.Get(id));
			let last: { x: number; y: number; z: number } | undefined;
			for (const phase of phases) {
				if (phase.kind === "escort") last = phase.points![phase.points!.size() - 1];
				if (phase.parkedEscort && phase.kind !== "recon") {
					expect(phase.parkedEscort.x).toBe(last?.x);
					expect(phase.parkedEscort.z).toBe(last?.z);
				}
			}
		}
		const phases = MissionCatalog.ExpandedPhases(MissionCatalog.Get(26));
		const defend = phases.find((p) => p.kind === "defend")!, escort = phases.find((p) => p.kind === "escort")!;
		expect(defend.points![0]).toEqual(escort.points![0]);
	});
	it("makes M10's trace short, directed and reinforced before the radar strike", () => {
		const phases = MissionCatalog.ExpandedPhases(MissionCatalog.Get(10));
		const index = phases.findIndex((p) => p.kind === "signal"), trace = phases[index];
		expect(trace.seconds! <= 20).toBe(true); expect(trace.directed).toBe(true);
		expect(MissionCatalog.InitialRaiders(trace)).toBe(1);
		expect(trace.reinforce?.[0].at).toBe(0.5);
		expect(phases[index + 1].label).toBe("Kill the camp radar");
	});
});
