import { Workspace } from "@rbxts/services";

// Measured in Studio: a native Terrain:Clear() of mission 3 froze the server 17.6 s, and even after its voxels were
// cleared to Air in bounded jobs a native clear still took 8.8 s (the allocated extent), long enough to hit the
// script execution limit inside the next launch. So the native call runs only when terrain may hold something: a
// world cleared by its own registered clear marks the terrain clean, and the next build or menu skips the call.
let dirty = true;
/** Native Terrain:Clear() only if something may have written terrain since the terrain was last known empty. */
export function clearTerrainIfDirty(): void {
	if (!dirty) return;
	Workspace.Terrain.Clear();
	dirty = false;
}
/** A world is about to write terrain: start from empty terrain, then mark it written. */
export function beginTerrainWrite(): void {
	clearTerrainIfDirty();
	dirty = true;
}
/** A registered world clear removed everything that world wrote; no native clear is needed. */
export function markTerrainClean(): void { dirty = false; }
export function terrainDirty(): boolean { return dirty; }
