import { FlightMath } from "./FlightMath";
import type { MissionStartPolicy } from "./MissionPolicy";
import { M01 } from "./M01WorldPlan";

/** Exact carrier-2 export dimensions needed before its generated upload spec exists. */
export const M01_CARRIER_MODEL = {
	size: { x: 181.031, y: 153.76, z: 560 },
	waterlineAboveKeel: 20,
	deckAboveKeel: 54,
	/** Starboard bow catapult end in model space; bow/front is -Z. */
	catapultEnd: { x: 24.5155, y: 54, z: -276 },
};

export const M01_CARRIER_PLACEMENT = {
	x: M01.carrier.x,
	y: M01.waterY,
	z: M01.carrier.z,
	headingDegrees: 0,
};

export const M01_FLYOFF_AHEAD = 96;
export const M01_FLYOFF_ABOVE_DECK = 24;

/** Rotate a model-space point into M01 world space around the carrier waterline contact. */
export function m01CarrierPoint(point: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
	const yaw = math.rad(M01_CARRIER_PLACEMENT.headingDegrees);
	const c = math.cos(yaw), s = math.sin(yaw);
	return {
		x: M01_CARRIER_PLACEMENT.x + c * point.x + s * point.z,
		y: M01_CARRIER_PLACEMENT.y - M01_CARRIER_MODEL.waterlineAboveKeel + point.y,
		z: M01_CARRIER_PLACEMENT.z - s * point.x + c * point.z,
	};
}

/** Dormant scripted-fly-off pose. Campaign cutover may select it; no mission does today. */
export function m01CarrierFlyoffStart(): MissionStartPolicy {
	const catapult = m01CarrierPoint(M01_CARRIER_MODEL.catapultEnd);
	const yaw = math.rad(M01_CARRIER_PLACEMENT.headingDegrees);
	return {
		kind: "carrier_flyoff",
		x: catapult.x - math.sin(yaw) * M01_FLYOFF_AHEAD,
		y: catapult.y + M01_FLYOFF_ABOVE_DECK,
		z: catapult.z - math.cos(yaw) * M01_FLYOFF_AHEAD,
		headingDegrees: M01_CARRIER_PLACEMENT.headingDegrees,
		speed: FlightMath.CruiseSpeed + 20,
	};
}
