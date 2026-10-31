import { finiteNumber } from "./EngineBatchB";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";

/** Absolute sea-datum altitude; 2,000 reference feet at the adopted 0.96 scale. */
export const M07_SAFE_CEILING = 585;
export interface CanyonEscape {
	ceiling: number;
	/** Distant battery position used for scenery/terrain line-of-sight masking. */
	source: FlightPoint;
	warningSeconds: number;
	countdownSeconds: number;
	intervalSeconds: number;
	damage: number;
	/** Safe centreline samples, including entry/turn basins/exit; audited against the built world. */
	channel: FlightPoint[];
	clearance: number;
}
export interface AreaAttack { radius: number; depth: number; damage: number }
export interface ArtilleryState { elapsed: number; cycle: number; warned: boolean; counted: boolean; fired: boolean }
export function newArtillery(): ArtilleryState { return {elapsed:0,cycle:0,warned:false,counted:false,fired:false}; }
/** At most one impact per simulation step; no catch-up damage after a pause. */
export function stepArtillery(state: ArtilleryState, plan: CanyonEscape, dt: number): {warning: boolean; countdown: boolean; impact: boolean} {
	const result={warning:false,countdown:false,impact:false};
	if(!finiteNumber(dt) || dt<=0) return result;
	state.elapsed+=dt;
	if(!state.warned) { state.warned=true; result.warning=true; }
	if(!state.counted && state.elapsed>=plan.warningSeconds) { state.counted=true; result.countdown=true; }
	if(!state.fired && state.elapsed>=plan.warningSeconds+plan.countdownSeconds) { state.fired=true; result.impact=true; }
	if(state.elapsed>=plan.intervalSeconds) { state.elapsed=0; state.cycle++; state.warned=false; state.counted=false; state.fired=false; }
	return result;
}
/** The ceiling is absolute, not terrain clearance; a low aircraft also needs terrain cover. */
export function artilleryExposed(plan: CanyonEscape, altitude: number, masked: boolean): boolean {
	return !finiteNumber(altitude) || altitude>plan.ceiling || !masked;
}
export function insideArea(plan: AreaAttack, centre: FlightPoint, target: FlightPoint): boolean {
	return (target.x-centre.x)**2+(target.z-centre.z)**2<=plan.radius**2 && math.abs(target.y-centre.y)<=plan.depth;
}
/** Shared by authored validation and the runtime terrain audit. Missing ground fails closed. */
export function canyonSampleSafe(plan: CanyonEscape, point: FlightPoint, floor?: number): boolean {
	return floor!==undefined && finiteNumber(floor) && point.y-floor>=plan.clearance && point.y<=plan.ceiling;
}
export function validateAreaAttack(plan: AreaAttack): void {
	assert(typeIs(plan,"table"),"Invalid area attack");
	for(const n of [plan.radius,plan.depth,plan.damage]) assert(finiteNumber(n) && n>0,"Invalid area footprint/damage");
	assert(plan.radius<=400 && plan.depth<=100 && plan.damage<=500,"Area attack exceeds budget");
}
export function validateBatchD3(phases: MissionPhaseBlueprint[], limit: number, terrainWarnings: boolean): void {
	for(let i=0;i<phases.size();i++) {
		const phase=phases[i], plan=phase.canyonEscape;
		if(plan===undefined) continue;
		assert(typeIs(plan,"table") && phase.kind==="return_line" && phase.returnLine!==undefined && i>0 && phases[i-1].kind==="required_ground","Canyon escape must follow a required strike");
		assert(terrainWarnings && phase.update!==undefined && phase.update.countdownSeconds!==undefined,"Canyon escape needs terrain warnings and fresh update clock");
		for(const n of [plan.ceiling,plan.warningSeconds,plan.countdownSeconds,plan.intervalSeconds,plan.damage,plan.clearance]) assert(finiteNumber(n) && n>0,"Invalid canyon timing/altitude/damage");
		assert(plan.ceiling<=2000 && plan.clearance<plan.ceiling && plan.damage<=100 && plan.warningSeconds>=2 && plan.countdownSeconds>=2 && plan.intervalSeconds>=12 && plan.intervalSeconds>=plan.warningSeconds+plan.countdownSeconds && plan.intervalSeconds<=120,"Invalid canyon budget");
		const point=(p: FlightPoint)=>assert(finiteNumber(p.x) && finiteNumber(p.y) && finiteNumber(p.z) && math.abs(p.x)<=limit && math.abs(p.z)<=limit && p.y>=0 && p.y<=2000,"Canyon point outside airspace");
		point(plan.source);
		assert(plan.channel.size()>=2 && plan.channel.size()<=64,"Canyon needs bounded entry/exit samples");
		let length=0;
		for(let j=1;j<plan.channel.size();j++) { const a=plan.channel[j-1],b=plan.channel[j]; const distance=math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2); assert(distance>1,"Duplicate canyon sample"); length+=distance; }
		assert(length<=32000,"Canyon audit exceeds probe budget");
		for(const p of plan.channel) { point(p); assert(p.y>=plan.clearance && p.y<=plan.ceiling,"Canyon route above safe band"); }
	}
}
