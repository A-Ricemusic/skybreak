// Waits for the replicated aircraft and mission folder, then preloads their mesh/texture content.
// Reports completion only for essential replication; optional downloads have a cancellable watchdog.
// Called by GameUI.tsx while the loading screen is up.
import { ContentProvider } from "@rbxts/services";
import { isFiniteNumber } from "../shared/Finite";
import { LoadingGate } from "../shared/LoadingGate";
import { criticalGeometryReady, terrainProbesReady, type LoadingTerrainProbe } from "../shared/MissionReadiness";
import { countParts } from "../shared/MissionParts";

function isModel(value: unknown): value is Model {
	return typeIs(value, "Instance") && value.IsA("Model");
}
function preloadable(root: Instance): Instance[] {
	const items: Instance[] = [];
	for (const item of root.GetDescendants()) {
		if (
			item.IsA("MeshPart") ||
			item.IsA("Decal") ||
			item.IsA("Texture") ||
			item.IsA("ImageLabel") ||
			item.IsA("SpecialMesh")
		)
			items.push(item);
	}
	return items;
}
/** Essential replication is mandatory. Cosmetic content is best effort within the same bound. */
export function preloadMission(
	aircraft: unknown,
	expectedParts: number | undefined,
	alive: () => boolean,
	onProgress: (fraction: number) => void,
	timeout = 6,
	resolveAircraft?: () => unknown,
	preload = (items: Instance[]) => ContentProvider.PreloadAsync(items),
	requiredGeometry?: number,
	terrainProbes?: LoadingTerrainProbe[],
): boolean {
	const deadline = os.clock() + timeout;
	const remaining = () => deadline - os.clock();
	const current = () => (resolveAircraft ? resolveAircraft() : aircraft);
	const playable = (): Model | undefined => {
		const value = current();
		if (!isModel(value) || !value.Parent || !value.IsDescendantOf(game)) return undefined;
		if (!value.PrimaryPart?.IsDescendantOf(value)) return undefined;
		if (!isFiniteNumber(expectedParts) || expectedParts <= 0 || countParts(value.Parent) < expectedParts)
			return undefined;
		if (!criticalGeometryReady(value.Parent, requiredGeometry) || !terrainProbesReady(terrainProbes))
			return undefined;
		return value;
	};
	let model: Model | undefined;
	while (alive() && remaining() > 0) {
		model = playable();
		if (model) break;
		const value = current();
		const parts = isModel(value) && value.Parent ? countParts(value.Parent) : 0;
		onProgress(math.min(0.79, LoadingGate.Progress(parts, expectedParts) * 0.8));
		task.wait(0.1);
	}
	if (!alive() || !model || !playable()) return false;
	onProgress(0.8);
	if (!alive() || !playable()) return false;
	const items = preloadable(model.Parent!);
	let finished = items.size() === 0;
	let worker: thread | undefined;
	if (!finished)
		worker = task.spawn(() => {
			pcall(() => preload(items));
			finished = true;
		});
	// Cancellation terminates the yielding worker so repeated launches cannot retain preload jobs.
	while (alive() && !finished && remaining() > 0) task.wait(0.1);
	if (worker && !finished) task.cancel(worker);
	if (!alive() || !playable()) return false;
	onProgress(1);
	return alive() && playable() !== undefined;
}
