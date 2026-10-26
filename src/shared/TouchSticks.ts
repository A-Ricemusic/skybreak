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

/** Share of the stick disc's half-width the knob may travel before the axis saturates. */
export const STICK_TRAVEL = 0.68;
/** Axis magnitude under which a steering stick reads as centred. */
export const STICK_DEADZONE = 0.08;

/**
 * Steering axes for a touch at (touchX, touchY) on a stick whose AbsolutePosition
 * is (left, top) and whose edge is `size`. Both points are in the same screen
 * space (CoreUISafeInsets shifts AbsolutePosition by the notch inset, and touch
 * positions include it too), so a notched phone needs no extra offset.
 * Returns the knob offset in pixels and the -1..1 axes (+y = stick pushed up).
 */
export function stickVector(touchX: number, touchY: number, left: number, top: number, size: number): { offsetX: number; offsetY: number; x: number; y: number } {
	const radius = math.max(1, size * STICK_TRAVEL * 0.5);
	let offsetX = touchX - (left + size / 2);
	let offsetY = touchY - (top + size / 2);
	const length = math.sqrt(offsetX * offsetX + offsetY * offsetY);
	if (length > radius) { offsetX = (offsetX / length) * radius; offsetY = (offsetY / length) * radius; }
	let x = offsetX / radius, y = -offsetY / radius;
	if (math.sqrt(x * x + y * y) < STICK_DEADZONE) { x = 0; y = 0; }
	return { offsetX, offsetY, x, y };
}
