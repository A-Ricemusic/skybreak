import { LifecycleScheduler, WorldClear, WorldLifecycle } from "../shared/WorldLifecycle";
import { clearTerrainIfDirty } from "./TerrainState";

/** Roblox scheduler: isolated work runs in a deferred thread; a thread killed by the script timeout reads as ended. */
export const robloxScheduler: LifecycleScheduler = {
	isolate(work) {
		let ended = false;
		const thread = task.defer(() => {
			const [ok, err] = pcall(work);
			if (!ok) warn(`SKYBREAK world lifecycle step failed: ${tostring(err)}`);
			ended = true;
		});
		return {
			ended: () => ended || coroutine.status(thread) === "dead",
			cancel: () => { if (!ended && coroutine.status(thread) === "suspended") { task.cancel(thread); ended = true; } },
		};
	},
	wait() { task.wait(); },
	now() { return os.clock(); },
	warn(message) { warn(`SKYBREAK world lifecycle: ${message}`); },
};

const clears = new Map<string, WorldClear>();
/**
 * Registers a world's own clear, keyed by its catalog world key (MissionCatalog.WorldKey). It runs in its own
 * thread through the world gate (WorldLifecycle): it may yield in bounded jobs, should return once `cancelled()`
 * is true, retaining unfinished work for retry. Successful terrain cleanup drains TerrainState
 * completely. Worlds without one drain the same tracked terrain cleanup queue.
 */
export function registerWorldClear(worldKey: string, clear: WorldClear): () => void {
	assert(worldKey.size() > 0, "World clear needs a world key");
	const previous = clears.get(worldKey);
	clears.set(worldKey, clear);
	return () => {
		if (clears.get(worldKey) !== clear) return;
		if (previous !== undefined) clears.set(worldKey, previous);
		else clears.delete(worldKey);
	};
}
export function worldClear(worldKey?: string): WorldClear {
	return (worldKey !== undefined ? clears.get(worldKey) : undefined) ?? ((cancelled) => clearTerrainIfDirty(cancelled));
}
/** The server's single world gate (see WorldLifecycle). */
export const worldLifecycle = new WorldLifecycle(robloxScheduler);
// Shutdown: never start or continue a world clear while final saves run.
game.BindToClose(() => worldLifecycle.Close());
