import type { MissionAirspacePolicy, MissionStartPolicy } from "./MissionPolicy";

/** Dormant policies; mission data must opt in explicitly. North is -Z. */
export const M02_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14500, hardHalfWidth: 15360, spawnLimit: 14000, radarRange: 18000,
};
export const M02_START: MissionStartPolicy = {
	kind: "airborne", x: 0, y: 500, z: 12500, headingDegrees: 0, speed: 160,
};
