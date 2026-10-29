import type { MissionAirspacePolicy } from "./MissionPolicy";

/** Dormant companion to M01WorldPlan (±16,384). Campaign cutover selects it.
 * Hard edge leaves 1,024 studs of sea coverage; soft recovery starts 1,360
 * studs earlier (2.27 seconds at 600 studs/s). Spawns remain inside soft.
 */
export const M01_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14000,
	hardHalfWidth: 15360,
	spawnLimit: 13500,
	radarRange: 18000,
};
