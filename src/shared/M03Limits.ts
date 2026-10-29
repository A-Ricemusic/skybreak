import type { MissionAirspacePolicy } from "./MissionPolicy";

/** Centred full-scale snowy world; selection belongs to the mission author. */
export const M03_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: 14000, hardHalfWidth: 15360, spawnLimit: 13500, radarRange: 18000,
};

/** Planned work caps, independent of the mission airspace policy. */
export const M03_BUILD_LIMITS = { voxelWrites: 130e6, jobs: 29000, parts: 120, descendants: 140, estimatedSeconds: 20 };
