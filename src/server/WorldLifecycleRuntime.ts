import { Workspace } from "@rbxts/services";
import { LifecycleScheduler, WorldClear, WorldLifecycle } from "../shared/WorldLifecycle";

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
 * is true, and must leave no mission terrain behind. Worlds without one use Terrain:Clear().
 */
export function registerWorldClear(worldKey: string, clear: WorldClear): void {
	assert(worldKey.size() > 0, "World clear needs a world key");
	clears.set(worldKey, clear);
}
export function worldClear(worldKey?: string): WorldClear {
	return (worldKey !== undefined ? clears.get(worldKey) : undefined) ?? (() => Workspace.Terrain.Clear());
}
/** The server's single world gate (see WorldLifecycle). */
export const worldLifecycle = new WorldLifecycle(robloxScheduler);
// Shutdown: never start or continue a world clear while final saves run.
game.BindToClose(() => worldLifecycle.Close());
