// Mission 4 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M04World.ts, shared/missions/m04.ts and the world-plan specs; keep in step with M04WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M04_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14000,
	hardHalfWidth: 15360,
	spawnLimit: 13500,
	radarRange: 18000,
};
/** Loading-only terrain schedule; estimate excludes cold uploads, replication and cleanup. */
export const M04_BUILD_LIMITS = {
	voxelWrites: 240e6,
	jobs: 17300,
	parts: 200,
	props: 120,
	descendants: 3600,
	estimatedSeconds: 16,
};
