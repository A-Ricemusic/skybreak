/** Owns the dirty bit and its clear operation; tests use a local state without clearing shared Studio terrain. */
export class TerrainWriteState {
	private dirty = true;
	public constructor(private readonly clear: () => void) {}
	public ClearIfDirty(): void {
		if (!this.dirty) return;
		this.clear();
		this.dirty = false;
	}
	public BeginWrite(): void { this.ClearIfDirty(); this.dirty = true; }
	public MarkClean(): void { this.dirty = false; }
	public Dirty(): boolean { return this.dirty; }
}
