/** Navigation invalidates observations independently of foreground request ownership. */
export class DeletionObservation {
	private epoch = 0;
	public cancel(): void { this.epoch++; }
	public capture(): number { return this.epoch; }
	public current(token: number): boolean { return token === this.epoch; }
	/** RPCs can yield: check both before dispatch and before delivering a result. */
	public read<T>(token: number, alive: () => boolean, invoke: () => T, deliver: (result: T) => void): void {
		if (!this.current(token) || !alive()) return;
		const result = invoke();
		if (this.current(token) && alive()) deliver(result);
	}
}
