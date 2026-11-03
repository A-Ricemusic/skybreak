// Shared campaign-unlock fixture. Mission specs temporarily mark earlier MISSIONS entries available so
// a later mission's sequential unlock can be exercised, then restore every entry (even when `fn`
// throws) so the production catalog is untouched for the rest of the run. Pure Luau; stages offline.
import { MISSIONS } from "../../shared/MissionCatalog";

/** Marks `MISSIONS[i]` available for every index in `indices` while `fn` runs, then restores all entries. */
export function withMissionsAvailable(indices: ReadonlyArray<number>, fn: () => void): void {
	const before = MISSIONS.map((m) => m.available);
	for (const i of indices) MISSIONS[i].available = true;
	const [ok, err] = pcall(fn);
	MISSIONS.forEach((m, i) => (m.available = before[i]));
	if (!ok) error(err, 0);
}

/** Opens `MISSIONS[0 .. count - 1]` (missions 1..count) while `fn` runs. `count = 0` only snapshots and restores. */
export function withEarlierMissions(count: number, fn: () => void): void {
	const indices: number[] = [];
	for (let i = 0; i < count; i++) indices.push(i);
	withMissionsAvailable(indices, fn);
}
