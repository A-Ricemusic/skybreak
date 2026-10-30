import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M04_AIRSPACE: MissionAirspacePolicy = { softHalfWidth: 14000, hardHalfWidth: 15360, spawnLimit: 13500, radarRange: 18000 };
/** estimatedSeconds is the Studio-Play-calibrated load estimate (WorldCompositionCounts); 20 s is the load target. */
export const M04_BUILD_LIMITS = { voxelWrites: 240e6, jobs: 17300, parts: 200, props: 120, descendants: 3600, estimatedSeconds: 20 };
