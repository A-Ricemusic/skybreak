import { FlightPoint, MissionBlueprint, MissionPhaseBlueprint, PhaseKind } from "./MissionCatalog";

export type BlueprintReason = "complete" | "timeout" | "destroyed" | "protected_lost";
export interface BlueprintState {
	blueprint: MissionBlueprint;
	startedAt: number;
	elapsed: number;
	phaseIndex: number;
	phaseProgress: number;
	pointIndex: number;
	protectedHealth: number;
	killedIds: Set<string>;
	requiredAirKills: number;
	requiredGroundKills: number;
	optionalAirKills: number;
	phaseOptionalKills: number;
	aceKilled: boolean;
	outcome?: "won" | "failed";
	reason?: BlueprintReason;
}
export interface BlueprintObjective {
	phase: PhaseKind | "complete";
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: "";
	beat?: string;
}
function finite(n: number): boolean { return n === n && math.abs(n) < math.huge; }
function distance(a: FlightPoint, b: FlightPoint): number {
	return math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
}
function sweptDistance(p: FlightPoint, a: FlightPoint, b: FlightPoint): number {
	const dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
	const d=dx*dx+dy*dy+dz*dz;
	const t=d > 0 ? math.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/d,0,1) : 0;
	return distance(p,{x:a.x+dx*t,y:a.y+dy*t,z:a.z+dz*t});
}
function total(p: MissionPhaseBlueprint): number {
	if (p.kind === "ace") return 1;
	if (p.kind === "route") return p.points!.size();
	if (p.kind === "recon") return p.points!.size() * p.seconds!;
	if (p.kind === "signal" || p.kind === "escort" || p.kind === "defend") return p.seconds!;
	return p.count ?? 0;
}
function finish(s: BlueprintState, outcome: "won" | "failed", reason: BlueprintReason): void {
	if (s.outcome !== undefined) return;
	s.outcome=outcome; s.reason=reason;
}
function advance(s: BlueprintState): void {
	s.phaseIndex++; s.phaseProgress=0; s.pointIndex=0; s.phaseOptionalKills=0; s.protectedHealth=100;
	if (s.phaseIndex >= s.blueprint.phases.size()) finish(s,"won","complete");
}
export const BlueprintRunner = {
	Duration: 600,
	NewState(blueprint: MissionBlueprint, startedAt: number): BlueprintState {
		assert(finite(startedAt) && blueprint.phases.size()>0,"Invalid blueprint/clock");
		return {blueprint,startedAt,elapsed:0,phaseIndex:0,phaseProgress:0,pointIndex:0,protectedHealth:100,
			killedIds:new Set<string>(),requiredAirKills:0,requiredGroundKills:0,optionalAirKills:0,phaseOptionalKills:0,aceKilled:false};
	},
	Tick(s: BlueprintState, now: number, health=100): void {
		if (s.outcome !== undefined || !finite(now)) return;
		s.elapsed=math.max(s.elapsed,now-s.startedAt,0);
		if (s.elapsed>=600) finish(s,"failed","timeout");
		else if (finite(health) && health<=0) finish(s,"failed","destroyed");
	},
	TimeRemaining(s: BlueprintState): number { return math.max(0,600-s.elapsed); },
	ActivePhase(s: BlueprintState): MissionPhaseBlueprint | undefined { return s.blueprint.phases[s.phaseIndex]; },
	NavigationPoint(s: BlueprintState): FlightPoint | undefined {
		const p=BlueprintRunner.ActivePhase(s);
		if (!p?.points) return undefined;
		if (p.kind !== "escort") return p.points[s.pointIndex] ?? p.points[0];
		const segment=math.clamp(s.phaseProgress/p.seconds!,0,1)*(p.points.size()-1);
		const i=math.min(math.floor(segment),p.points.size()-2), alpha=segment-i;
		const a=p.points[i],b=p.points[i+1];
		return {x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};
	},
	/** Called only with authoritative server simulation. dt is bounded; invalid observations cannot win. */
	ObserveFlight(s: BlueprintState, from: FlightPoint, to: FlightPoint, dt: number, now: number, threats=0): void {
		BlueprintRunner.Tick(s,now);
		if (s.outcome !== undefined || !finite(dt) || dt<=0 || dt>0.1) return;
		for (const n of [from.x,from.y,from.z,to.x,to.y,to.z,threats]) if (!finite(n)) return;
		const p=BlueprintRunner.ActivePhase(s)!;
		const point=BlueprintRunner.NavigationPoint(s);
		if (!point) return;
		if (p.kind === "escort" || p.kind === "defend") {
			s.protectedHealth=math.max(0,s.protectedHealth-math.clamp(threats,0,5)*0.7*dt);
			if (s.protectedHealth<=0) { finish(s,"failed","protected_lost"); return; }
		}
		if (p.ceiling !== undefined && (to.y>p.ceiling || from.y>p.ceiling)) return;
		if (p.kind === "route") {
			if (sweptDistance(point,from,to) <= (p.radius ?? 210)) {
				s.pointIndex++; s.phaseProgress++;
				if (s.pointIndex>=p.points!.size()) advance(s);
			}
			return;
		}
		if (distance(point,to) > (p.radius ?? 1000)) return;
		s.phaseProgress+=dt;
		if (p.kind === "recon") s.pointIndex=math.min(p.points!.size()-1,math.floor((s.phaseProgress+0.00001)/p.seconds!));
		if (s.phaseProgress+0.00001>=total(p)) advance(s);
	},
	CanDamage(s: BlueprintState, kind: "air" | "ground" | "ace", required: boolean): boolean {
		if (s.outcome !== undefined) return false;
		const p=BlueprintRunner.ActivePhase(s);
		if (!p) return false;
		if (!required) return kind==="air" && s.phaseOptionalKills<(p.optionalRaiders ?? 0);
		return (kind==="ace" && p.kind==="ace") || (kind==="ground" && p.kind==="required_ground") || (kind==="air" && p.kind==="required_air");
	},
	RecordKill(s: BlueprintState,id: string,kind: "air" | "ground" | "ace",required: boolean,now: number): boolean {
		BlueprintRunner.Tick(s,now);
		if (id==="" || s.killedIds.has(id) || !BlueprintRunner.CanDamage(s,kind,required)) return false;
		s.killedIds.add(id);
		if (!required) { s.optionalAirKills++; s.phaseOptionalKills++; return true; }
		if (kind==="ace") s.aceKilled=true;
		else if (kind==="air") s.requiredAirKills++;
		else s.requiredGroundKills++;
		s.phaseProgress++;
		if (s.phaseProgress>=total(BlueprintRunner.ActivePhase(s)!)) advance(s);
		return true;
	},
	Objective(s: BlueprintState): BlueprintObjective {
		if (s.outcome==="won") return {phase:"complete",objective:"Objective complete",objectiveProgress:1,objectiveTotal:1,tutorialStep:""};
		const p=BlueprintRunner.ActivePhase(s)!;
		return {phase:p.kind,objective:p.label,objectiveProgress:math.floor(s.phaseProgress),objectiveTotal:total(p),tutorialStep:"",beat:p.beat};
	},
};
