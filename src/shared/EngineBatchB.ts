import { FlightMath, FlightState } from "./FlightMath";

export interface PointXZ { x: number; z: number }
/** Segment endpoints; direction is a unit normal toward the completing side. */
export interface ReturnLine { a: PointXZ; b: PointXZ; direction: PointXZ; markerY: number }
export interface MissionUpdate { objective: string; radio: string[]; countdownSeconds?: number }
/** Touchdown is an aircraft pivot position, above the runway surface by its authored gear clearance. */
export interface LandingPlan {
	touchdown: { x: number; y: number; z: number };
	headingDegrees: number; approachDistance: number; rolloutDistance: number;
	approachSeconds: number; rolloutSeconds: number; glideDegrees: number;
}
export function finiteNumber(n: number): boolean { return typeIs(n,"number") && n === n && math.abs(n)<math.huge; }
export function crossesReturnLine(line: ReturnLine, from: PointXZ, to: PointXZ): boolean {
	for (const n of [from.x,from.z,to.x,to.z]) if (!finiteNumber(n)) return false;
	const before=(from.x-line.a.x)*line.direction.x+(from.z-line.a.z)*line.direction.z;
	const after=(to.x-line.a.x)*line.direction.x+(to.z-line.a.z)*line.direction.z;
	if (before>=0 || after<0) return false;
	const t=-before/(after-before), x=from.x+(to.x-from.x)*t-line.a.x, z=from.z+(to.z-from.z)*t-line.a.z;
	const dx=line.b.x-line.a.x,dz=line.b.z-line.a.z, along=(x*dx+z*dz)/(dx*dx+dz*dz);
	return along>=0 && along<=1;
}
/** FIRE and skip share controls; both peers must ignore the landing handoff press. */
export const LANDING_SKIP_DELAY = 0.75;
export function canSkipLanding(elapsed: number): boolean { return finiteNumber(elapsed) && elapsed >= LANDING_SKIP_DELAY; }
export function landingDuration(plan: LandingPlan): number { return plan.approachSeconds+plan.rolloutSeconds; }
export function landingPose(plan: LandingPlan, elapsed: number): FlightState {
	const t=math.clamp(elapsed,0,landingDuration(plan)), angle=math.rad(plan.headingDegrees);
	const airborne=t<plan.approachSeconds;
	const remaining=plan.approachDistance*(1-math.min(t/plan.approachSeconds,1));
	const u=math.clamp((t-plan.approachSeconds)/plan.rolloutSeconds,0,1);
	// Ease pitch to level over the last two seconds, before the wheels touch.
	const flare = math.clamp((plan.approachSeconds-t)/2,0,1);
	const pitch = -math.rad(plan.glideDegrees)*flare*flare*(3-2*flare);
	const distance=airborne ? -remaining : plan.rolloutDistance*(2*u-u*u);
	return FlightMath.FromPose(plan.touchdown.x+math.sin(angle)*distance,
		plan.touchdown.y+remaining*math.tan(math.rad(plan.glideDegrees)), plan.touchdown.z-math.cos(angle)*distance,
		-angle,airborne ? pitch : 0,
		airborne ? plan.approachDistance/plan.approachSeconds : 2*plan.rolloutDistance/plan.rolloutSeconds*(1-u));
}
/** Missing/no-hit probes fall back to absolute altitude; never invent ground at sea level. */
export function terrainClearance(altitude: number, surfaceY?: number): number | undefined {
	return finiteNumber(altitude) && surfaceY !== undefined && finiteNumber(surfaceY) ? math.max(0,altitude-surfaceY) : undefined;
}
export function validateBatchB(phases: {kind: string; update?: MissionUpdate; returnLine?: ReturnLine; landing?: LandingPlan}[], limit: number): void {
	const point=(p: PointXZ) => assert(finiteNumber(p.x) && finiteNumber(p.z) && math.abs(p.x)<=limit && math.abs(p.z)<=limit,"Batch B point outside airspace");
	const positive=(n: number) => assert(finiteNumber(n) && n>0,"Batch B requires finite positive values");
	for (let i=0;i<phases.size();i++) {
		const p=phases[i];
		if (p.update) {
			assert(i>0 && p.kind!=="landing","Mission updates require a noninitial, nonlanding phase");
			assert(p.update.objective.size()>0 && p.update.objective.size()<=120,"Invalid mission update objective");
			assert(p.update.radio.size()>0 && p.update.radio.size()<=8,"Mission update needs radio lines");
			for (const line of p.update.radio) assert(line.size()>0 && line.size()<=72,"Invalid mission update radio");
			if (p.update.countdownSeconds !== undefined) { positive(p.update.countdownSeconds); assert(p.update.countdownSeconds<=86400,"Update clock too long"); }
		}
		assert((p.kind==="return_line") === (p.returnLine !== undefined),"return_line requires line data exclusively");
		if (p.returnLine) {
			const l=p.returnLine; point(l.a); point(l.b);
			const dx=l.b.x-l.a.x,dz=l.b.z-l.a.z;
			assert(dx*dx+dz*dz>1 && finiteNumber(l.markerY) && l.markerY>=0 && l.markerY<=2000,"Invalid return segment/height");
			assert(finiteNumber(l.direction.x) && finiteNumber(l.direction.z) && math.abs(l.direction.x*l.direction.x+l.direction.z*l.direction.z-1)<0.0001 && math.abs(dx*l.direction.x+dz*l.direction.z)<0.0001,"Return direction must be a unit segment normal");
		}
		assert((p.kind==="landing") === (p.landing !== undefined),"landing requires plan exclusively");
		if (p.landing) {
			assert(i>0 && phases[i-1].kind==="return_line" && i===phases.size()-1,"Landing must follow return line and end mission");
			const l=p.landing; point(l.touchdown); assert(finiteNumber(l.touchdown.y) && l.touchdown.y>=0 && l.touchdown.y<=2000 && finiteNumber(l.headingDegrees),"Invalid runway pose");
			for (const n of [l.approachDistance,l.rolloutDistance,l.approachSeconds,l.rolloutSeconds,l.glideDegrees]) positive(n);
			assert(math.abs(2*l.rolloutDistance/l.rolloutSeconds-l.approachDistance/l.approachSeconds)<0.01,"Landing rollout must preserve touchdown speed");
			assert(l.glideDegrees<=6 && landingDuration(l)<=180,"Invalid landing slope/duration");
			const start=landingPose(l,0),last=landingPose(l,landingDuration(l)); point(start); point(last);
		}
	}
}
