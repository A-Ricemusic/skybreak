import { ContentProvider } from "@rbxts/services";
import { LoadingGate } from "../shared/LoadingGate";
import { countParts } from "../shared/MissionParts";

function isModel(value: unknown): value is Model {
	return typeIs(value, "Instance") && value.IsA("Model");
}
function preloadable(root: Instance): Instance[] {
	const items: Instance[] = [];
	for (const item of root.GetDescendants()) {
		if (item.IsA("MeshPart") || item.IsA("Decal") || item.IsA("Texture") || item.IsA("ImageLabel") || item.IsA("SpecialMesh")) items.push(item);
	}
	return items;
}
/**
 * Yields until the replicated aircraft and mission folder are present locally
 * and their mesh/texture content is preloaded, or until `timeout` seconds pass.
 * `alive` lets the caller abandon a stale load; progress is reported in 0..1.
 */
export function preloadMission(aircraft: unknown, expectedParts: number | undefined, alive: () => boolean, onProgress: (fraction: number) => void, timeout = 6): boolean {
	const deadline = os.clock() + timeout;
	const remaining = () => deadline - os.clock();
	if (!isModel(aircraft)) return false;
	const model = aircraft;
	while (alive() && remaining() > 0 && !(model.PrimaryPart && model.Parent)) task.wait(0.1);
	if (!alive()) return false;
	const folder = model?.Parent;
	if (!folder) return false;
	// Replication progress: parts arriving in the mission folder.
	let parts = countParts(folder);
	onProgress(LoadingGate.Progress(parts, expectedParts) * 0.8);
	while (alive() && remaining() > 0 && expectedParts !== undefined && parts < expectedParts) {
		task.wait(0.15);
		parts = countParts(folder);
		onProgress(LoadingGate.Progress(parts, expectedParts) * 0.8);
	}
	if (!alive()) return false;
	// Content preload with a watchdog, since PreloadAsync has no timeout of its own.
	const items = preloadable(folder);
	let finished = items.size() === 0;
	if (!finished) task.spawn(() => { pcall(() => ContentProvider.PreloadAsync(items)); finished = true; });
	while (alive() && !finished && remaining() > 0) task.wait(0.1);
	onProgress(1);
	return alive();
}
