// Mission 15 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M15World.ts, shared/missions/m15.ts and the world-plan specs; keep in step with M15WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M15_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14000,
	hardHalfWidth: 15360,
	spawnLimit: 14000,
	radarRange: 24000,
};
export const M15_BUILD_LIMITS = {
	voxelWrites: 600e6,
	jobs: 15000,
	parts: 1000,
	props: 0,
	descendants: 1800,
	estimatedSeconds: 16,
};
