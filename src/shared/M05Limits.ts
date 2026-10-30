import type { MissionAirspacePolicy } from "./MissionPolicy";
export const M05_AIRSPACE: MissionAirspacePolicy = { softHalfWidth: 14000, hardHalfWidth: 15360, spawnLimit: 13500, radarRange: 22000 };
/** estimatedSeconds is the Studio-Play-calibrated load estimate (WorldCompositionCounts). M05 is NOT within
 * the 20 s target yet: its 256M voxels of native sea water make every loading frame about twice as costly as
 * land (measured about 37 s of terrain in Studio Play before D-121's water-only sea columns). 40 is a regression guard
 * until a measured fix (see m05-composition.md) brings it under 20.
 */
export const M05_BUILD_LIMITS = { voxelWrites: 480e6, jobs: 17300, parts: 400, props: 12, descendants: 1100, estimatedSeconds: 40 };
