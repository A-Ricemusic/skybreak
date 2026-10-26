import { describe, expect, it } from "@rbxts/jest-globals";
import { STICK_DEADZONE, stickVector, TouchSticks } from "../shared/TouchSticks";
import { FlightMath } from "../shared/FlightMath";

describe("twin touch ownership", () => {
	it("supports both begin orders, ignores extra fingers and releases only the ending owner", () => {
		for (const first of ["steering", "throttle"] as const) {
			const second = first === "steering" ? "throttle" : "steering";
			const touches = new TouchSticks<number>();
			expect(touches.Begin(first, 1)).toBe(true);
			expect(touches.Begin(second, 1)).toBe(false);
			expect(touches.Begin(second, 2)).toBe(true);
			expect(touches.Begin(first, 3)).toBe(false);
			touches.End(3); // FIRE/TGT/SPECIAL finger must not release either stick.
			expect(touches[first]).toBe(1);
			expect(touches[second]).toBe(2);
			touches.End(1); // End and Cancel share this release path.
			expect(touches[first]).toBeUndefined();
			expect(touches[second]).toBe(2);
			expect(touches.Held()).toBe(true);
			expect(touches.Begin(first, 4)).toBe(true);
			touches.Clear(); // focus/menu/death/unmount
			expect(touches.Held()).toBe(false);
			expect(touches.steering).toBeUndefined();
			expect(touches.throttle).toBeUndefined();
			expect(touches.Begin(second, 5)).toBe(true);
		}
	});
	it("holds selection at neutral/deadzone and uses the same time-based RS ramp", () => {
		for (const axis of [0, 0.17, -0.18]) expect(FlightMath.AdjustThrottle(0.65, axis, 0.1)).toBe(0.65);
		let fast = 0.3, slow = 0.3;
		for (let i = 0; i < 60; i++) fast = FlightMath.AdjustThrottle(fast, 1, 1 / 60);
		for (let i = 0; i < 20; i++) slow = FlightMath.AdjustThrottle(slow, 1, 1 / 20);
		expect(math.abs(fast - 0.7)).toBeLessThan(0.00001);
		expect(math.abs(fast - slow)).toBeLessThan(0.00001);
		expect(FlightMath.AdjustThrottle(0.02, -1, 0.1)).toBe(0);
		expect(FlightMath.AdjustThrottle(0.99, 1, 0.1)).toBe(1);
	});
	it("maps a touch to stick axes in the same inset screen space as the disc", () => {
		// 844x390 notched phone: CoreUISafeInsets shifts the root 44 px right, so the
		// 96 px steering disc sits at AbsolutePosition (58, 268) and a touch on its centre reads zero.
		const centre = stickVector(58 + 48, 268 + 48, 58, 268, 96);
		expect(centre.x).toBe(0);
		expect(centre.y).toBe(0);
		// Up and right saturate at the travel radius; the knob never leaves it.
		const up = stickVector(106, 268 - 200, 58, 268, 96);
		expect(up.y).toBeCloseTo(1, 5);
		expect(math.abs(up.x)).toBeLessThan(0.00001);
		expect(up.offsetY).toBeCloseTo(-96 * 0.34, 5);
		const right = stickVector(106 + 20, 316, 58, 268, 96);
		expect(right.x).toBeGreaterThan(0.6);
		expect(right.y).toBeCloseTo(0, 5);
		// A small wobble inside the deadzone stays centred, at every stick size.
		for (const size of [80, 96, 128]) {
			const wobble = stickVector(size / 2 + 1, size / 2 + 1, 0, 0, size);
			expect(wobble.x).toBe(0);
			expect(STICK_DEADZONE).toBe(0.08);
		}
	});
});
