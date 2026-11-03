// Mission 6 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M06World.ts, shared/missions/m06.ts and the world-plan specs; keep in step with M06WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M06_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 15600,
	hardHalfWidth: 16000,
	spawnLimit: 15600,
	radarRange: 24000,
};
export const M06_BUILD_LIMITS = {
	voxelWrites: 600e6,
	jobs: 15000,
	parts: 480,
	props: 60,
	descendants: 2400,
	estimatedSeconds: 16,
};
