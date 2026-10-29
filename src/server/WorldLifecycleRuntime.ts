import { Workspace } from "@rbxts/services";
import { LifecycleScheduler, WorldLifecycle } from "../shared/WorldLifecycle";

/** Roblox scheduler: isolated work runs in a deferred thread; a thread killed by the script timeout reads as ended. */
export const robloxScheduler: LifecycleScheduler = {
	isolate(work) {
		let ended = false;
		const thread = task.defer(() => {
			const [ok, err] = pcall(work);
			if (!ok) warn(`SKYBREAK world lifecycle step failed: ${tostring(err)}`);
			ended = true;
		});
		return () => ended || coroutine.status(thread) === "dead";
	},
	wait() { task.wait(); },
	now() { return os.clock(); },
	warn(message) { warn(`SKYBREAK world lifecycle: ${message}`); },
};

const clears = new Map<string, () => void>();
/**
 * Per-world clear, keyed by catalog world key. It runs in its own thread and may yield (for example a chunked
 * clear of a very large world); it must leave no mission terrain behind. Worlds without one use Terrain:Clear().
 */
export function registerWorldClear(worldKey: string, clear: () => void): void {
	assert(worldKey.size() > 0, "World clear needs a world key");
	clears.set(worldKey, clear);
}
export function worldClear(worldKey?: string): () => void {
	return (worldKey !== undefined ? clears.get(worldKey) : undefined) ?? (() => Workspace.Terrain.Clear());
}
/** The server's single world gate (see WorldLifecycle). */
export const worldLifecycle = new WorldLifecycle(robloxScheduler);
