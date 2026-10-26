import { FlightPoint, MissionBlueprint, MissionCatalog, MissionPhaseBlueprint, PhaseKind } from "./MissionCatalog";
import { GameConfig } from "./GameConfig";

export type BlueprintReason = "complete" | "timeout" | "destroyed" | "protected_lost" | "escaped";
/** Hull a protected convoy or site loses per second per raider near it (before the difficulty scale). */
const PROTECT_DRAIN = 0.55;
/** Each live hazard gun drains the protected actor like this many raiders. */
const GUN_WEIGHT = 1.5;
export interface BlueprintState {
	blueprint: MissionBlueprint;
	/** This sortie's live phase list: the authored phases plus any twist inserts fired so far. */
	phases: MissionPhaseBlueprint[];
	/** Radio lines raised by twists, drained by the server in order. */
	radioQueue: string[];
	/** True once the active phase's twist has fired (reset on every advance). */
	phaseTwisted: boolean;
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
	/** Extra raiders every wave brings (Ace difficulty); widens each phase's optional kill cap. */
	extraRaiders: number;
	/** Seconds the active phase has been observed (chase timer). */
	phaseClock: number;
	/** The active phase's hazard has lit up, and how many of its targets are still alive. */
	hazardFired: boolean;
	hazardAlive: number;
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
	if (p.kind === "chase") return p.count ?? 1;
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
	s.phaseIndex++; s.phaseProgress=0; s.pointIndex=0; s.phaseOptionalKills=0; s.protectedHealth=100; s.phaseTwisted=false;
	s.phaseClock=0; s.hazardFired=false; s.hazardAlive=0;
	if (s.phaseIndex >= s.phases.size()) finish(s,"won","complete");
}
/**
 * Fires the active phase's twist once its progress fraction reaches `at`: queues the radio
 * line and splices the inserted phases right after the active one. Returns true when the
 * twist ended the active phase itself (mode "now"), so callers skip their own advance.
 */
function twist(s: BlueprintState): boolean {
	const p=s.phases[s.phaseIndex];
	const t=p?.twist;
	if (!t || s.phaseTwisted) return false;
	const span=total(p);
	if (span<=0 || s.phaseProgress+0.00001 < t.at*span) return false;
	s.phaseTwisted=true;
	s.radioQueue.push(t.text);
	const spliced: MissionPhaseBlueprint[]=[];
	for (let i=0;i<=s.phaseIndex;i++) spliced.push(s.phases[i]);
	for (const inserted of t.insert) spliced.push(inserted);
	for (let i=s.phaseIndex+1;i<s.phases.size();i++) spliced.push(s.phases[i]);
	s.phases=spliced;
	if (t.mode !== "now") return false;
	advance(s);
	return true;
}
/** The active phase's hazard targets are lit and at least one is still standing. */
function hazardLive(s: BlueprintState): boolean { return s.hazardFired && s.hazardAlive>0; }
/** Lights the active phase's hazard once its fraction reaches `at`; its radio call queues like a twist's. */
function hazard(s: BlueprintState, p: MissionPhaseBlueprint): void {
	if (!p.hazard || s.hazardFired) return;
	const span=total(p);
	if (span>0 && s.phaseProgress+0.00001 < p.hazard.at*span) return;
	s.hazardFired=true; s.hazardAlive=p.hazard.count;
	s.radioQueue.push(p.hazard.text);
}
export const BlueprintRunner = {
	/** The sortie deadline in seconds (GameConfig.Campaign.MissionTimeLimit). */
	Duration: GameConfig.Campaign.MissionTimeLimit,
	ProtectDrain: PROTECT_DRAIN,
	GunWeight: GUN_WEIGHT,
	NewState(blueprint: MissionBlueprint, startedAt: number, extraRaiders=0): BlueprintState {
		assert(finite(startedAt) && blueprint.phases.size()>0,"Invalid blueprint/clock");
		const phases: MissionPhaseBlueprint[]=[];
		for (const phase of blueprint.phases) phases.push(phase);
		return {blueprint,phases,radioQueue:[],phaseTwisted:false,startedAt,elapsed:0,phaseIndex:0,phaseProgress:0,pointIndex:0,protectedHealth:100,
			killedIds:new Set<string>(),requiredAirKills:0,requiredGroundKills:0,optionalAirKills:0,phaseOptionalKills:0,aceKilled:false,
			extraRaiders:math.max(0,math.floor(finite(extraRaiders) ? extraRaiders : 0)),phaseClock:0,hazardFired:false,hazardAlive:0};
	},
	Tick(s: BlueprintState, now: number, health=100): void {
		if (s.outcome !== undefined || !finite(now)) return;
		s.elapsed=math.max(s.elapsed,now-s.startedAt,0);
		if (s.elapsed>=BlueprintRunner.Duration) finish(s,"failed","timeout");
		else if (finite(health) && health<=0) finish(s,"failed","destroyed");
	},
	TimeRemaining(s: BlueprintState): number { return math.max(0,BlueprintRunner.Duration-s.elapsed); },
	ActivePhase(s: BlueprintState): MissionPhaseBlueprint | undefined { return s.phases[s.phaseIndex]; },
	/** The live phase list (authored phases plus twist inserts fired so far). Read-only for callers. */
	Phases(s: BlueprintState): MissionPhaseBlueprint[] { return s.phases; },
	/** Next twist radio line, or undefined. The server drains this after every observation. */
	TakeRadio(s: BlueprintState): string | undefined { return s.radioQueue.size()>0 ? s.radioQueue.shift() : undefined; },
	/** Phase progress total: kills for combat phases, checkpoints for routes, seconds for timed volumes. */
	Total(p: MissionPhaseBlueprint): number { return total(p); },
	/** Active phase progress as a 0-1 fraction (1 when the mission is complete or the phase has no total). A chase reads its escape clock. */
	Fraction(s: BlueprintState): number {
		const p=BlueprintRunner.ActivePhase(s);
		if (!p) return 1;
		if (p.kind === "chase") return math.clamp(s.phaseClock/math.max(0.001,p.seconds ?? 1),0,1);
		const t=total(p);
		if (t<=0) return 1;
		return math.clamp(s.phaseProgress/t,0,1);
	},
	/** The active phase's hazard targets are lit and alive (they may be struck; the phase cannot finish). */
	HazardLive(s: BlueprintState): boolean { return hazardLive(s); },
	NavigationPoint(s: BlueprintState): FlightPoint | undefined {
		const p=BlueprintRunner.ActivePhase(s);
		if (!p?.points) return undefined;
		if (p.kind !== "escort") return p.points[s.pointIndex] ?? p.points[0];
		const segment=math.clamp(s.phaseProgress/p.seconds!,0,1)*(p.points.size()-1);
		const i=math.min(math.floor(segment),p.points.size()-2), alpha=segment-i;
		const a=p.points[i],b=p.points[i+1];
		return {x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};
	},
	/**
	 * Called only with authoritative server simulation. dt is bounded; invalid observations cannot win.
	 * `threats` counts raiders near a protected convoy or site; `drainScale` is the difficulty's protectDrain.
	 */
	ObserveFlight(s: BlueprintState, from: FlightPoint, to: FlightPoint, dt: number, now: number, threats=0, drainScale=1): void {
		BlueprintRunner.Tick(s,now);
		if (s.outcome !== undefined || !finite(dt) || dt<=0 || dt>0.1) return;
		for (const n of [from.x,from.y,from.z,to.x,to.y,to.z,threats,drainScale]) if (!finite(n)) return;
		const p=BlueprintRunner.ActivePhase(s)!;
		if (p.kind === "chase") {
			s.phaseClock+=dt;
			if (s.phaseClock+0.00001>=(p.seconds ?? 0)) finish(s,"failed","escaped");
			return;
		}
		const point=BlueprintRunner.NavigationPoint(s);
		if (!point) return;
		hazard(s,p);
		if (p.kind === "escort" || p.kind === "defend") {
			const guns=hazardLive(s) && p.hazard?.effect === "guns" ? s.hazardAlive*GUN_WEIGHT : 0;
			s.protectedHealth=math.max(0,s.protectedHealth-(math.clamp(threats,0,5)+guns)*PROTECT_DRAIN*math.clamp(drainScale,0,2)*dt);
			if (s.protectedHealth<=0) { finish(s,"failed","protected_lost"); return; }
		}
		// Live jammers freeze a signal hold's timer until they are destroyed.
		if (hazardLive(s) && p.hazard?.effect === "jam") return;
		if (p.ceiling !== undefined && (to.y>p.ceiling || from.y>p.ceiling)) return;
		if (p.kind === "route") {
			if (sweptDistance(point,from,to) <= (p.radius ?? 210)) {
				s.pointIndex++; s.phaseProgress++;
				twist(s);
				if (s.pointIndex>=p.points!.size()) advance(s);
			}
			return;
		}
		if (distance(point,to) > (p.radius ?? 1000)) return;
		// A convoy reaching the end of its route waits there until any hazard guns are silenced.
		s.phaseProgress=math.min(total(p),s.phaseProgress+dt);
		if (p.kind === "recon") s.pointIndex=math.min(p.points!.size()-1,math.floor((s.phaseProgress+0.00001)/p.seconds!));
		hazard(s,p);
		if (twist(s)) return;
		if (s.phaseProgress+0.00001>=total(p) && !hazardLive(s)) advance(s);
	},
	CanDamage(s: BlueprintState, kind: "air" | "ground" | "ace", required: boolean): boolean {
		if (s.outcome !== undefined) return false;
		const p=BlueprintRunner.ActivePhase(s);
		if (!p) return false;
		if (!required) return kind==="air" && s.phaseOptionalKills<MissionCatalog.RaiderCap(p,s.extraRaiders);
		return (kind==="ace" && p.kind==="ace") || (kind==="ground" && (p.kind==="required_ground" || hazardLive(s)))
			|| (kind==="air" && (p.kind==="required_air" || p.kind==="chase"));
	},
	RecordKill(s: BlueprintState,id: string,kind: "air" | "ground" | "ace",required: boolean,now: number): boolean {
		BlueprintRunner.Tick(s,now);
		if (id==="" || s.killedIds.has(id) || !BlueprintRunner.CanDamage(s,kind,required)) return false;
		s.killedIds.add(id);
		if (!required) { s.optionalAirKills++; s.phaseOptionalKills++; return true; }
		const p=BlueprintRunner.ActivePhase(s)!;
		if (kind==="ground" && p.kind!=="required_ground") {
			// A hazard target: a required ground kill that clears the way, not phase progress.
			s.requiredGroundKills++; s.hazardAlive=math.max(0,s.hazardAlive-1);
			if (!hazardLive(s) && s.phaseProgress+0.00001>=total(p)) advance(s);
			return true;
		}
		if (kind==="ace") s.aceKilled=true;
		else if (kind==="air") s.requiredAirKills++;
		else s.requiredGroundKills++;
		s.phaseProgress++;
		if (twist(s)) return true;
		if (s.phaseProgress>=total(BlueprintRunner.ActivePhase(s)!)) advance(s);
		return true;
	},
	Objective(s: BlueprintState): BlueprintObjective {
		if (s.outcome==="won") return {phase:"complete",objective:"Objective complete",objectiveProgress:1,objectiveTotal:1,tutorialStep:""};
		const p=BlueprintRunner.ActivePhase(s)!;
		return {phase:p.kind,objective:p.label,objectiveProgress:math.floor(s.phaseProgress),objectiveTotal:total(p),tutorialStep:"",beat:p.beat};
	},
};
