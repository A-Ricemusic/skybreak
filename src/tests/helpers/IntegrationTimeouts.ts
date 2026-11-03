import { boundedWorldWork } from "../BoundedWorldWork";

/**
 * Jest deadline for heavyweight world/terrain cleanup hooks. tools/run-jest.luau sets a
 * 20-second default that also applies to hooks, and per-test timeouts do not extend
 * hooks. That is too short for cold-Studio terrain clears. Pass this only to world
 * cleanup hooks. Unit-test hooks keep the 20-second default. Calibrate it from the
 * WORLD_HOOK_CLEANUP lines.
 */
export const WORLD_HOOK_TIMEOUT_MS = 120_000;
/** The cleanup worker is cancelled this long before Jest gives up on the hook. */
const CANCEL_MARGIN_SECONDS = 10;
export const WORLD_HOOK_WORK_SECONDS = WORLD_HOOK_TIMEOUT_MS / 1000 - CANCEL_MARGIN_SECONDS;

/**
 * Runs yielding world/terrain cleanup in a bounded worker and logs its duration. If the
 * worker overruns, it is cancelled before Jest's hook deadline. Jest alone does not stop
 * a yielded hook body, and an uncancelled body would keep writing terrain under the next
 * test. A cancelled TerrainState clear keeps its dirty bit and footprint, so the next
 * clear can still recover the terrain. Keep `expect` calls outside `body`:
 * boundedWorldWork rethrows body failures as strings.
 */
export function worldHookCleanup(spec: string, body: () => void): void {
	const started = os.clock();
	let ok = false;
	try {
		boundedWorldWork(`${spec} world cleanup hook`, body, WORLD_HOOK_WORK_SECONDS);
		ok = true;
	} finally {
		print(
			`WORLD_HOOK_CLEANUP spec=${spec} seconds=${string.format("%.2f", os.clock() - started)} limit=${WORLD_HOOK_WORK_SECONDS} ok=${ok}`,
		);
	}
}
