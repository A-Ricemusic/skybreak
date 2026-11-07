/** Owns the dirty bit and its clear operation; tests use a local state without clearing shared Studio terrain. */
export class TerrainWriteState {
	private dirty = true;
	public constructor(private readonly clear: (cancelled?: () => boolean) => boolean | void) {}
	/** A false completion result or exception preserves dirty recovery state. */
	public ClearIfDirty(cancelled?: () => boolean): void {
		if (!this.dirty) return;
		if (cancelled?.() || this.clear(cancelled) === false)
			error("Terrain cleanup cancelled; recovery state retained");
		this.dirty = false;
	}
	public BeginWrite(): void {
		this.ClearIfDirty();
		this.dirty = true;
	}
	public MarkClean(): void {
		this.dirty = false;
	}
	public Dirty(): boolean {
		return this.dirty;
	}
}
