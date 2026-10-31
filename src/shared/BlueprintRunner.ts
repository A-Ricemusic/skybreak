import { thresholdResult } from "./EngineBatchC";
import { canSkipLanding, crossesReturnLine, landingDuration, landingSkipTarget, landingTimeRemaining } from "./EngineBatchB";
import { FlightMath, FlightState } from "./FlightMath";
import { FlightPoint, MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "./MissionCatalog";
import { GameConfig } from "./GameConfig";

export type BlueprintReason = "complete" | "timeout" | "destroyed" | "protected_lost" | "escaped" | "bombers_escaped";
/** Hull a protected convoy or site loses per second per raider near it (before the difficulty scale). */
const PROTECT_DRAIN = 0.55;
/** Each live hazard gun drains the protected actor like this many raiders. */
const GUN_WEIGHT = 1.5;
export interface BlueprintState {
	rearmActive?: boolean;
	/** A HUD-less cut-in holds the mission clock like a rearm (SortieCutaways). */
	cutInActive?: boolean;
	score?: number;
	scorePhaseStarted?: number;
	updateSerial?: number;
	updateUntil?: number;
	countdownDeadline?: number;
	landingElapsed?: number;
	ignitionAnnounced?: boolean;
	turnObserved: number;
	pitchObserved: number;
	stepSince: number;
	cycled: boolean;
	banditsDueAt?: number;
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
	optionalGroundKills: number;
	phaseOptionalKills: number;
	aceKilled: boolean;
	optionalAceKilled?: boolean;
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
	phase: string;
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: "move" | "target" | "missile" | "";
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
	if (p.scoreThreshold) return p.scoreThreshold.points;
	if (p.kind === "tutorial_move") return (p.execution?.movementDuration ?? 3)*2;
	if (p.kind === "tutorial_target") return 1;
	if (p.kind === "ace" || p.kind === "return_line" || p.kind === "landing") return 1;
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
function enter(s: BlueprintState): void {
	const p=s.phases[s.phaseIndex];
	if (p?.scoreThreshold) { s.scorePhaseStarted=s.elapsed; s.countdownDeadline=s.elapsed+p.scoreThreshold.seconds; }
	if (p?.update) {
		s.updateSerial=(s.updateSerial ?? 0)+1; s.updateUntil=s.elapsed+8;
		for (const line of p.update.radio) s.radioQueue.push(line);
		if (p.update.countdownSeconds !== undefined) s.countdownDeadline=s.elapsed+p.update.countdownSeconds;
	}
	s.ignitionAnnounced=undefined;
	s.landingElapsed=p?.landing ? 0 : undefined;
}
function advance(s: BlueprintState): void {
	s.phaseIndex++; s.phaseProgress=0; s.pointIndex=0; s.phaseOptionalKills=0; s.protectedHealth=100; s.phaseTwisted=false;
	s.phaseClock=0; s.hazardFired=false; s.hazardAlive=0;
	s.stepSince=s.elapsed; s.cycled=false;
	const nextPhase=s.phases[s.phaseIndex];
	s.banditsDueAt=nextPhase?.execution?.launchDelay !== undefined ? s.elapsed+nextPhase.execution.launchDelay : undefined;
	if (s.phaseIndex >= s.phases.size()) finish(s,"won","complete");
	else enter(s);
}
/** Teaching actions latch immediately; advancing waits for the prompt's own dwell. */
function advanceTeaching(s: BlueprintState): void {
	if (s.outcome !== undefined) return;
	const p=s.phases[s.phaseIndex];
	if (!p || s.elapsed-s.stepSince<(p.execution?.minimumDwell ?? 0)) return;
	const duration=p.execution?.movementDuration ?? 3;
	if ((p.kind === "tutorial_move" && s.turnObserved>=duration && s.pitchObserved>=duration)
		|| (p.kind === "tutorial_target" && s.cycled)
		|| (p.kind === "tutorial_missile" && s.phaseProgress>0)) advance(s);
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
	MovementDuration: 3,
	TeachMinimum: 2.5,
	BanditBeat: 4,
	LiveWarning: "Protection OFF now: impacts fatal. LOCK, fire; EVADE / F / B missiles.",
	PracticeReset: "Practice reset; progress saved. Release holds; opposite pitch levels.",
	ProtectDrain: PROTECT_DRAIN,
	GunWeight: GUN_WEIGHT,
	NewState(blueprint: MissionBlueprint, startedAt: number, extraRaiders=0): BlueprintState {
		assert(finite(startedAt) && blueprint.phases.size()>0,"Invalid blueprint/clock");
		const phases: MissionPhaseBlueprint[]=[];
		for (const phase of blueprint.phases) phases.push(phase);
		const state: BlueprintState = {turnObserved:0,pitchObserved:0,stepSince:0,cycled:false,blueprint,phases,radioQueue:[],phaseTwisted:false,startedAt,elapsed:0,phaseIndex:0,phaseProgress:0,pointIndex:0,protectedHealth:100,
			killedIds:new Set<string>(),requiredAirKills:0,requiredGroundKills:0,optionalAirKills:0,optionalGroundKills:0,phaseOptionalKills:0,aceKilled:false,
			extraRaiders:math.max(0,math.floor(finite(extraRaiders) ? extraRaiders : 0)),phaseClock:0,hazardFired:false,hazardAlive:0};
		enter(state); return state;
	},
	/** Called once when loading/launch staging gives way to player control. */
	BeginControl(s: BlueprintState, now: number): void {
		s.startedAt = now; s.elapsed = 0;
	},
	EscapeBombers(s: BlueprintState): void {
		if (BlueprintRunner.ActivePhase(s)?.bombers && s.outcome === undefined) {
			if (BlueprintRunner.ActivePhase(s)?.interceptHold) s.protectedHealth=0;
			finish(s, "failed", "bombers_escaped");
		}
	},
	Tick(s: BlueprintState, now: number, health=100): void {
		if (s.outcome !== undefined || s.rearmActive || s.cutInActive || s.landingElapsed !== undefined || !finite(now)) return;
		s.elapsed=math.max(s.elapsed,now-s.startedAt,0);
		const threshold=BlueprintRunner.ActivePhase(s)?.scoreThreshold;
		if (threshold && finite(health) && health<=0) { finish(s,"failed","destroyed"); return; }
		if(threshold) {
			s.phaseProgress=math.min(threshold.points,s.score ?? 0);
			const result=thresholdResult(threshold,s.score ?? 0,s.elapsed-(s.scorePhaseStarted ?? 0));
			if(result==="failed") finish(s,"failed","timeout");
			else if(result==="complete") { s.countdownDeadline=undefined; advance(s); }
			return;
		}
		const hold=BlueprintRunner.ActivePhase(s)?.interceptHold;
		if (hold) {
			if (finite(health) && health<=0) { finish(s,"failed","destroyed"); return; }
			if (!s.ignitionAnnounced && BlueprintRunner.TimeRemaining(s)<=hold.ignitionSecondsRemaining) {
				s.ignitionAnnounced=true; s.radioQueue.push(hold.ignitionCall);
			}
			if (BlueprintRunner.TimeRemaining(s)<=0) {
				if (s.phaseProgress>=total(BlueprintRunner.ActivePhase(s)!)) advance(s);
				else finish(s,"failed","timeout");
			}
			return;
		}
		if (s.elapsed>=(s.countdownDeadline ?? MissionCatalog.CountdownSeconds(s.blueprint))) finish(s,"failed","timeout");
		else if (finite(health) && health<=0) finish(s,"failed","destroyed");
		advanceTeaching(s);
	},
	ObserveControls(s: BlueprintState, x: number, y: number, dt: number, now: number): void {
		BlueprintRunner.Tick(s,now);
		const p=BlueprintRunner.ActivePhase(s);
		if (s.outcome !== undefined || p?.kind !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed=math.clamp(dt,0,0.1), duration=p.execution?.movementDuration ?? 3;
		if (math.abs(x)>=0.2) s.turnObserved=math.min(duration,s.turnObserved+observed);
		if (math.abs(y)>=0.2) s.pitchObserved=math.min(duration,s.pitchObserved+observed);
		advanceTeaching(s);
	},
	CycleTarget(s: BlueprintState, now: number): void {
		BlueprintRunner.Tick(s,now);
		if (s.outcome === undefined && BlueprintRunner.ActivePhase(s)?.kind === "tutorial_target") { s.cycled=true; advanceTeaching(s); }
	},
	RecoverPractice(s: BlueprintState, flight: FlightState): boolean {
		if (s.outcome !== undefined) return false;
		const p=BlueprintRunner.ActivePhase(s);
		if (!p?.execution?.practice && !(s.banditsDueAt !== undefined && s.elapsed<s.banditsDueAt)) return false;
		flight.x=0; flight.y=800; flight.z=500; flight.lean=0;
		FlightMath.SetAttitude(flight,0,0);
		return true;
	},
	BanditsDue(s: BlueprintState): boolean {
		return s.outcome === undefined && s.banditsDueAt !== undefined && s.elapsed>=s.banditsDueAt;
	},
	TimeRemaining(s: BlueprintState): number {
		const landing=s.landingElapsed !== undefined ? BlueprintRunner.ActivePhase(s)?.landing : undefined;
		const clock=landing ? landingTimeRemaining(landing,s.landingElapsed!) : undefined;
		return clock ?? math.max(0,(s.countdownDeadline ?? MissionCatalog.CountdownSeconds(s.blueprint))-s.elapsed);
	},
	AdvanceLanding(s: BlueprintState, dt: number, skip=false): void {
		const plan=BlueprintRunner.ActivePhase(s)?.landing;
		if (!plan || s.outcome !== undefined || !finite(dt) || dt<0) return;
		s.landingElapsed=math.min(landingDuration(plan),(s.landingElapsed ?? 0)+dt);
		// A skip lands on the runway hold when the plan has one (MISSION ACCOMPLISHED), else it ends at once.
		if (skip && canSkipLanding(s.landingElapsed)) s.landingElapsed=landingSkipTarget(plan,s.landingElapsed);
		if (s.landingElapsed>=landingDuration(plan)) advance(s);
	},
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
	NavigationPoint(s: BlueprintState, position?: FlightPoint): FlightPoint | undefined {
		const p=BlueprintRunner.ActivePhase(s);
		if (p?.interceptHold) return p.interceptHold.site;
		if (p?.returnLine) {
			const line=p.returnLine, dx=line.b.x-line.a.x, dz=line.b.z-line.a.z;
			const t=position ? math.clamp(((position.x-line.a.x)*dx+(position.z-line.a.z)*dz)/(dx*dx+dz*dz),0,1) : 0.5;
			return {x:line.a.x+dx*t,y:line.markerY,z:line.a.z+dz*t};
		}
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
		if (p.returnLine) { if ((!p.canyonEscape || (from.y<=p.canyonEscape.ceiling && to.y<=p.canyonEscape.ceiling)) && crossesReturnLine(p.returnLine,from,to)) { s.phaseProgress=1; advance(s); } return; }
		if (p.kind === "chase") {
			s.phaseClock+=dt;
			if (s.phaseClock+0.00001>=(p.seconds ?? 0)) finish(s,"failed","escaped");
			return;
		}
		if (p.interceptHold) return;
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
		if (p.kind === "tutorial_missile") return required && kind === "ground" && s.phaseProgress === 0;
		if (!required && kind === "ground" && p.groundTargets !== undefined) return true;
		if (!required && p.standaloneAce && kind === "ace") return true;
		if (!required && p.bombers) return (kind === "air" || kind === "ace") && s.phaseOptionalKills < MissionCatalog.RaiderCap(p,s.extraRaiders);
		if (!required && p.execution?.raiderKillCap !== undefined) return kind === "air" && s.optionalAirKills<p.execution.raiderKillCap;
		if (!required) return kind==="air" && s.phaseOptionalKills<MissionCatalog.RaiderCap(p,s.extraRaiders);
		return (kind==="ace" && p.kind==="ace") || (kind==="ground" && (p.kind==="required_ground" || hazardLive(s)))
			|| (kind==="air" && (p.kind==="required_air" || p.kind==="chase"));
	},
	RecordKill(s: BlueprintState,id: string,kind: "air" | "ground" | "ace",required: boolean,now: number): boolean {
		BlueprintRunner.Tick(s,now);
		if (id==="" || s.killedIds.has(id) || !BlueprintRunner.CanDamage(s,kind,required)) return false;
		s.killedIds.add(id);
		if (!required && kind === "ground") { s.optionalGroundKills++; return true; }
		if (!required) { if (kind === "ace" && BlueprintRunner.ActivePhase(s)?.standaloneAce) s.optionalAceKilled=true; s.optionalAirKills++; s.phaseOptionalKills++; return true; }
		const p=BlueprintRunner.ActivePhase(s)!;
		if (p.kind === "tutorial_missile") {
			s.requiredGroundKills++; s.phaseProgress++; advanceTeaching(s); return true;
		}
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
		if (!p.interceptHold && s.phaseProgress>=total(BlueprintRunner.ActivePhase(s)!)) advance(s);
		return true;
	},
	Objective(s: BlueprintState): BlueprintObjective {
		if (s.outcome==="won" && s.phases[s.phases.size()-1].execution?.hudPhase === undefined) return {phase:"complete",objective:"Objective complete",objectiveProgress:1,objectiveTotal:1,tutorialStep:""};
		const p=BlueprintRunner.ActivePhase(s) ?? s.phases[s.phases.size()-1];
		const waiting=s.banditsDueAt !== undefined && !BlueprintRunner.BanditsDue(s);
		const progress=s.outcome === "won" ? total(p) : p.kind === "tutorial_move" ? math.floor(s.turnObserved+1e-6)+math.floor(s.pitchObserved+1e-6) : p.kind === "tutorial_target" ? (s.cycled ? 1 : 0) : s.phaseProgress;
		return {phase:p.execution?.hudPhase ?? p.kind,objective:waiting ? "Protection ends when bandits arrive; prepare to fight" : p.update?.objective ?? p.execution?.objective ?? p.label,
			objectiveProgress:math.floor(progress),objectiveTotal:total(p),tutorialStep:p.tutorialStep ?? "",beat:p.beat};
	},
};
