import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M05_AIRSPACE: MissionAirspacePolicy = { softHalfWidth: 14000, hardHalfWidth: 15360, spawnLimit: 13500, radarRange: 22000 };
/** Loading-only terrain schedule; estimate excludes cold uploads, replication and cleanup. */
export const M05_BUILD_LIMITS = { voxelWrites: 480e6, jobs: 17300, parts: 400, props: 12, descendants: 1100, estimatedSeconds: 16 };
