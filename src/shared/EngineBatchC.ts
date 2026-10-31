import { CarrierRearm, carrierRearmPose } from "./EngineBatchD5";
import { finiteNumber, LandingPlan, landingDuration, landingPose, validateBatchB } from "./EngineBatchB";
import { FlightMath, FlightState } from "./FlightMath";
import type { MissionPhaseBlueprint, FlightPoint } from "./MissionCatalog";
export interface ScoreThreshold { points: number; seconds: number; /** Keep fighting until expiry. */ waitForExpiry: boolean }
export interface RadarJamming { visualLockRange: number; remainingCall: string; clearCall: string }
export interface RearmPlan { carrier?: CarrierRearm; zone: FlightPoint; radius: number; landing: LandingPlan; takeoffSeconds: number; missiles: boolean; special: boolean; health: boolean;
	/** Batch D1: refill the fitted gun's magazine; absent follows `missiles`. Needs `armament.gun`. */
	gun?: boolean;
	/** Hold on the runway for the TAKEOFF / CHANGE WEAPON menu (SortieCutaways). */ weaponMenu?: boolean; /** Tower cues by rearm time. */ radio?: { at: number; text: string }[] }
export function thresholdResult(plan: ScoreThreshold, score: number, elapsed: number): "continue" | "complete" | "failed" {
	if (elapsed>=plan.seconds) return score>=plan.points ? "complete" : "failed";
	return !plan.waitForExpiry && score>=plan.points ? "complete" : "continue";
}
export function jammedLockAllowed(liveJammers: number, distance: number, plan?: RadarJamming): boolean {
	return !plan || liveJammers<=0 || distance<=plan.visualLockRange;
}
export function rearmDuration(p: RearmPlan): number { return landingDuration(p.landing)+p.takeoffSeconds; }
export function rearmPose(p: RearmPlan, elapsed: number): FlightState {
	if(p.carrier) return carrierRearmPose(p,elapsed);
	const duration=landingDuration(p.landing);
	if (elapsed<duration) return landingPose(p.landing,elapsed);
	const rollout=landingPose(p.landing,duration), t=math.clamp(elapsed-duration,0,p.takeoffSeconds), angle=math.rad(p.landing.headingDegrees);
	const distance=FlightMath.CruiseSpeed*t*t/(2*p.takeoffSeconds);
	return FlightMath.FromPose(rollout.x+math.sin(angle)*distance,rollout.y+math.max(0,t-p.takeoffSeconds/2)*25,rollout.z-math.cos(angle)*distance,-angle,math.rad(8),math.max(35,FlightMath.CruiseSpeed*t/p.takeoffSeconds));
}
export function validateBatchC(phases: MissionPhaseBlueprint[], limit: number): void {
	const positive=(n: number)=>assert(finiteNumber(n) && n>0,"Batch C needs finite positive values");
	for(let i=0;i<phases.size();i++) {
		const p=phases[i], s=p.scoreThreshold;
		assert((p.kind==="score_threshold")===(s!==undefined),"score_threshold needs exclusive plan");
		if(s && i<phases.size()-1) assert(phases[i+1].update?.countdownSeconds!==undefined,"Score successor needs its own countdown");
		if(s) { assert(p.update?.countdownSeconds===undefined || p.update.countdownSeconds===s.seconds,"Score phase owns its countdown"); positive(s.points); positive(s.seconds); assert(s.points%1===0 && s.seconds<=86400 && typeIs(s.waitForExpiry,"boolean"),"Invalid score threshold"); assert(p.twist===undefined && p.points===undefined && p.count===undefined,"Score phase owns progress"); }
		if(p.jamming) { positive(p.jamming.visualLockRange); for(const line of [p.jamming.remainingCall,p.jamming.clearCall]) assert(line.size()>0 && line.size()<=72,"Invalid jammer radio"); assert((p.fighterWaves ?? []).some(w=>w.aircraft==="jammer"),"Jamming needs live jammer aircraft"); }
		if(p.rearm) {
			const r=p.rearm; assert(s!==undefined,"Rearm only in score phase"); assert(!r.health,"Rearm preserves damage"); positive(r.radius); positive(r.takeoffSeconds); assert(r.takeoffSeconds<=60 && r.radius<=2000,"Rearm budget exceeded");
			for(const n of [r.zone.x,r.zone.y,r.zone.z]) assert(finiteNumber(n),"Invalid rearm zone");
			assert(math.abs(r.zone.x)<=limit && math.abs(r.zone.z)<=limit && r.zone.y>=0 && r.zone.y<=2000,"Rearm outside airspace");
			const start=landingPose(r.landing,0);
			assert(math.sqrt((start.x-r.zone.x)**2+(start.y-r.zone.y)**2+(start.z-r.zone.z)**2)<=r.radius,"Rearm zone must include approach gate");
			for(const b of [r.missiles,r.special,r.health]) assert(typeIs(b,"boolean"),"Invalid rearm refill");
			assert(r.gun===undefined || typeIs(r.gun,"boolean"),"Invalid rearm gun refill");
			validateBatchB([{kind:"return_line" as const,returnLine:{a:{x:-1,z:0},b:{x:1,z:0},direction:{x:0,z:1},markerY:1}},{kind:"landing" as const,landing:r.landing}],limit);
		}
	}
}
