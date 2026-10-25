/** Independent ownership: unrelated fingers and a second finger on a held stick are ignored. */
export class TouchSticks<T> {
	public steering?: T;
	public throttle?: T;
	public Begin(stick: "steering" | "throttle", input: T): boolean {
		if (this[stick] !== undefined || this.steering === input || this.throttle === input) return false;
		this[stick] = input;
		return true;
	}
	public End(input: T): void {
		if (this.steering === input) this.steering = undefined;
		if (this.throttle === input) this.throttle = undefined;
	}
	public Clear(): void { this.steering = undefined; this.throttle = undefined; }
	public Held(): boolean { return this.steering !== undefined || this.throttle !== undefined; }
}
