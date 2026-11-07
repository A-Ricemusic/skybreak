import { HttpService, ServerStorage, Workspace } from "@rbxts/services";
import { TerrainWriteState } from "../shared/TerrainWriteState";

// Composition plans own an exact sparse write footprint. Erase those boxes rather
// than asking native Clear to traverse the entire tall, hollow world's extent.
// Keep the footprint until every write finishes: a failed/cancelled build or clear
// must still be recoverable. Untracked legacy terrain retains native cleanup.
import { terrainCleanupOp, terrainBoundsOp } from "../shared/TerrainSchedule";
import type { TerrainOp } from "../shared/WorldPlan";
import { TerrainWriter } from "./TerrainWriter";
// Server-only storage survives module reloads without replicating the large plan.
const OWNER = "SKYBREAKTerrainFootprint";
function loadFootprint(): TerrainOp[] | undefined {
	const stored = ServerStorage.FindFirstChild(OWNER);
	if (stored === undefined) return undefined;
	const pages: string[] = [];
	const count = stored.GetAttribute("Pages") as number;
	for (let i = 0; i < count; i++) pages.push((stored.FindFirstChild(tostring(i)) as StringValue).Value);
	return HttpService.JSONDecode(pages.join("")) as TerrainOp[];
}
let footprint = loadFootprint();
function saveFootprint() {
	const started = os.clock();
	ServerStorage.FindFirstChild(OWNER)?.Destroy();
	if (footprint === undefined)
		return { jsonElapsedSeconds: 0, storageElapsedSeconds: os.clock() - started, pages: 0, encodedBytes: 0 };
	// StringValue has a 200,000-byte ceiling; large legacy plans need multiple pages.
	const jsonStart = os.clock();
	const encoded = HttpService.JSONEncode(footprint);
	const jsonEnd = os.clock();
	const folder = new Instance("Folder");
	folder.Name = OWNER;
	let count = 0;
	for (let start = 0; start < encoded.size(); start += 180000) {
		const page = new Instance("StringValue");
		page.Name = tostring(count++);
		page.Value = encoded.sub(start + 1, start + 180000);
		page.Parent = folder;
	}
	folder.SetAttribute("Pages", count);
	folder.Parent = ServerStorage;
	return {
		jsonElapsedSeconds: jsonEnd - jsonStart,
		storageElapsedSeconds: jsonStart - started + os.clock() - jsonEnd,
		pages: count,
		encodedBytes: encoded.size(),
	};
}
let canTrack = false;
const state = new TerrainWriteState((cancelled) => {
	if (footprint === undefined) {
		// Jest isolates module state between suites, but Terrain and its empty bounds
		// survive. A completed clear is shared evidence; never repeat native Clear
		// over a tall empty extent just because this module was required again.
		if (Workspace.Terrain.GetAttribute("SKYBREAKTerrainClean") !== true) Workspace.Terrain.Clear();
	} else {
		const started = os.clock();
		const timing = TerrainWriter.Write(footprint, 0.25, undefined, cancelled, true);
		if (!timing.complete) return false;
		print(
			`MISSION_TERRAIN_CLEANUP mode=sparse seconds=${os.clock() - started} jobs=${timing.jobs} work=${timing.total} yields=${timing.yields}`,
		);
	}
	footprint = undefined;
	saveFootprint();
	canTrack = false;
	Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", true);
});
/** Called before the first write, so partial builds have the same cleanup owner. */
export function trackTerrainFootprint(ops: TerrainOp[]) {
	const started = os.clock();
	// Every planned shape registers its own bounded cleanup box before any write.
	if (!canTrack) beginTerrainWrite();
	canTrack = false;
	const conversionStart = os.clock();
	footprint = ops.map(terrainCleanupOp);
	const persistenceStart = os.clock();
	const persistence = saveFootprint();
	const finishedAt = os.clock();
	return {
		elapsedSeconds: finishedAt - started,
		preludeElapsedSeconds: conversionStart - started,
		conversionElapsedSeconds: persistenceStart - conversionStart,
		persistenceElapsedSeconds: finishedAt - persistenceStart,
		...persistence,
	};
}
/** Conservative grid box for a legacy curved write. Terrain is exclusively owned,
 * so erasing surrounding air is safe; never expand this to the campaign extent.
 * Register before writing so a partial Practice build remains recoverable. */
export function trackTerrainBounds(min: Vector3, max: Vector3): void {
	if (footprint === undefined) footprint = [];
	footprint.push(terrainBoundsOp([min.X, min.Y, min.Z], [max.X, max.Y, max.Z]));
	saveFootprint();
}
/** Clear the owned sparse footprint, or native terrain when writes were untracked. */
export function clearTerrainIfDirty(cancelled?: () => boolean): void {
	if (!state.Dirty() && Workspace.Terrain.GetAttribute("SKYBREAKTerrainClean") === false) state.BeginWrite();
	state.ClearIfDirty(cancelled);
}
/** A world is about to write terrain: start from empty terrain, then mark it written. */
export function beginTerrainWrite(): void {
	state.BeginWrite();
	Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", false);
	canTrack = true;
}
/** A registered world clear removed everything that world wrote; no native clear is needed. */
export function markTerrainClean(): void {
	footprint = undefined;
	saveFootprint();
	canTrack = false;
	state.MarkClean();
	Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", true);
}
export function terrainDirty(): boolean {
	return state.Dirty();
}

/** Vertical envelope of this world's registered voxel writes (all campaign builders and Practice register).
 * No owned writes is an explicitly terrain-free fixture/world; still inspect through the launch column to y=0.
 */
export function terrainReadinessBounds(): { minY: number; maxY: number } {
	let minY = 0,
		maxY = 0;
	for (const op of footprint ?? []) {
		minY = math.min(minY, op.y - op.sy / 2);
		maxY = math.max(maxY, op.y + op.sy / 2);
	}
	return { minY, maxY };
}
