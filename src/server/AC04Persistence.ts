import { AC04Profile, ac04Merge, ac04Normalize, ac04Readable } from "../shared/AC04Progress";
export interface AC04PersistenceState {
	profile: AC04Profile; loaded: boolean; loading: boolean; saving: boolean; dirty: boolean; closing: boolean;
	persistence: "cloud" | "session" | "unavailable";
}
export interface AC04PersistenceIO<P> {
	get(player: P): unknown;
	update(player: P, transform: (current: unknown) => AC04Profile): unknown;
	present(player: P, state: AC04PersistenceState): boolean;
	now(): number; wait(seconds: number): void; warn(message: string): void;
}
/** Production persistence boundary. IO may yield; states remain owned until drain finishes. */
export class AC04Persistence<P> {
	constructor(private readonly io: AC04PersistenceIO<P>) {}
	load(player: P, state: AC04PersistenceState): boolean {
		if (state.loaded) return true;
		if (state.loading || state.closing) return false;
		state.loading = true;
		const [ok, value] = pcall(() => this.io.get(player));
		state.loading = false;
		if (state.closing || !this.io.present(player, state)) return false;
		if (!ok) { this.io.warn(`AC04 save load failed: ${tostring(value)}`); return false; }
		if (!ac04Readable(value)) { this.io.warn("AC04 save schema is unsupported; existing record has been left untouched."); return false; }
		state.profile = ac04Normalize(value); state.loaded = true; state.persistence = "cloud";
		return true;
	}
	save(player: P, state: AC04PersistenceState): boolean {
		if (state.persistence === "session") { state.dirty = false; return false; }
		if (!state.loaded || state.persistence !== "cloud" || state.saving) return false;
		state.saving = true;
		// Snapshot before yielding; merge the returned cloud record with any newer in-memory changes.
		const snapshot = ac04Normalize(state.profile);
		state.dirty = false;
		const [ok, updated] = pcall(() => this.io.update(player, (current) => ac04Merge(current, snapshot)));
		state.saving = false;
		if (!ok) { state.dirty = true; this.io.warn(`AC04 save failed: ${tostring(updated)}`); return false; }
		if (!ac04Readable(updated) || updated === undefined) { state.dirty = true; this.io.warn("AC04 save returned no readable record."); return false; }
		state.profile = ac04Merge(updated, state.profile);
		return true;
	}
	/** Drain the latest dirty revision after an in-flight save, bounded by shutdown allowance. */
	drain(player: P, state: AC04PersistenceState, deadline: number): void {
		let attempts = 0;
		while (this.io.now() < deadline) {
			if (state.saving) { this.io.wait(.05); continue; }
			if (!state.dirty || state.persistence === "unavailable") return;
			if (++attempts > 3) break;
			this.save(player, state);
			if (state.dirty) this.io.wait(.25 * attempts);
		}
		if (state.dirty || state.saving) this.io.warn("AC04 shutdown ended before the latest record was durably saved.");
	}
}
