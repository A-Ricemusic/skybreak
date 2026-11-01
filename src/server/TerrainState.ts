import { worldTraceScope } from "./WorldBuildTrace";
import { Workspace } from "@rbxts/services";

// Measured in Studio: a native Terrain:Clear() of mission 3 froze the server 17.6 s; clearing its voxels to Air in
// bounded jobs first did not help, because a native clear of the emptied extent still took 9-23 s, and skipping it
// moved that cost onto the next world's clear (25 s after mission 1). So each world's clear runs once, natively,
// inside the world gate's isolated step (WorldLifecycle), and builds or the menu clear again only when terrain may
// hold something: a native clear here, or a registered world clear calling markTerrainClean(), marks it empty.
let dirty = true;
/** Native Terrain:Clear() only if something may have written terrain since the terrain was last known empty. */
export function clearTerrainIfDirty(): void {
	const endTrace = worldTraceScope("previous-world-cleanup");
	try {
		if (!dirty) return;
		Workspace.Terrain.Clear();
		dirty = false;
	} finally { endTrace(); }
}
/** A world is about to write terrain: start from empty terrain, then mark it written. */
export function beginTerrainWrite(): void {
	clearTerrainIfDirty();
	dirty = true;
}
/** A registered world clear removed everything that world wrote; no native clear is needed. */
export function markTerrainClean(): void { dirty = false; }
export function terrainDirty(): boolean { return dirty; }
