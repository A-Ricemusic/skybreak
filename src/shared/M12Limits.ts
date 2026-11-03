// Mission 12 airspace policy and loading-screen build budget (pure data, no instances).
// Read by server/M12World.ts, shared/missions/m12.ts and the world-plan specs; keep in step with M12WorldPlan.
import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M12_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 15600,
	hardHalfWidth: 16000,
	spawnLimit: 15600,
	radarRange: 24000,
};
export const M12_BUILD_LIMITS = {
	voxelWrites: 600e6,
	jobs: 15000,
	parts: 650,
	props: 60,
	descendants: 2600,
	estimatedSeconds: 16,
};
