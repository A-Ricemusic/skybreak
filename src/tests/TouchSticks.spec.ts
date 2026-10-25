import { describe, expect, it } from "@rbxts/jest-globals";
import { TouchSticks } from "../shared/TouchSticks";
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
});
