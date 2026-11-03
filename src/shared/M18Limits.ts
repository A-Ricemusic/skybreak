// Mission 18 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M18World.ts, shared/missions/m18.ts and the world-plan specs; keep in step with M18WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M18_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14000,
	hardHalfWidth: 15360,
	spawnLimit: 14000,
	radarRange: 24000,
};
export const M18_BUILD_LIMITS = {
	voxelWrites: 600e6,
	jobs: 15000,
	parts: 1000,
	props: 0,
	descendants: 1800,
	estimatedSeconds: 16,
};
