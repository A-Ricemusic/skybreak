// Mission 13 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M13World.ts, shared/missions/m13.ts and the world-plan specs; keep in step with M13WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M13_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 15600,
	hardHalfWidth: 16000,
	spawnLimit: 15600,
	radarRange: 24000,
};
export const M13_BUILD_LIMITS = {
	voxelWrites: 600e6,
	jobs: 15000,
	parts: 650,
	props: 60,
	descendants: 2600,
	estimatedSeconds: 16,
};
