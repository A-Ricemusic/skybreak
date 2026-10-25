import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath } from "../shared/FlightMath";

describe("numeric arcade flight rules", () => {
	it("rejects NaN, infinities and nonnumeric controls", () => {
		for (const value of [0 / 0, math.huge, -math.huge, "1", false, {}]) expect(FlightMath.IsFinite(value)).toBe(false);
		expect(FlightMath.IsFinite(undefined)).toBe(false);
		for (const value of [-100, 0, 0.5, 100]) expect(FlightMath.IsFinite(value)).toBe(true);
	});
	it("clamps input and preserves explicit invalid-input fallbacks", () => {
		expect(FlightMath.ClampInput(4)).toBe(1);
		expect(FlightMath.ClampInput(-4)).toBe(-1);
		expect(FlightMath.ClampInput(0.25)).toBe(0.25);
		expect(FlightMath.ClampInput(0 / 0)).toBe(0);
		expect(FlightMath.ClampInput(math.huge, 0.4)).toBe(0.4);
	});
	it("starts independent states in safe forward flight", () => {
		const first = FlightMath.NewState();
		const second = FlightMath.NewState();
		FlightMath.Step(first, { x: 0, y: 0, throttle: 0.65 }, 1 / 30);
		expect(first.z).toBeLessThan(500);
		expect(first.x).toBeCloseTo(0);
		expect(first.y).toBeCloseTo(250);
		expect(second.z).toBe(500);
	});
	it("returns normalized forward vectors with the correct axis signs", () => {
		const [x, y, z] = FlightMath.Forward(0, 0);
		expect(x).toBeCloseTo(0); expect(y).toBeCloseTo(0); expect(z).toBeCloseTo(-1);
		const [a, b, c] = FlightMath.Forward(-0.8, 0.4);
		expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(0);
		expect(a * a + b * b + c * c).toBeCloseTo(1, 6);
	});
	it("turns right and banks on positive horizontal input", () => {
		const state = FlightMath.NewState();
		FlightMath.Step(state, { x: 1, y: 1, throttle: 0.65 }, 0.1);
		expect(state.yaw).toBeLessThan(0);
		expect(state.roll).toBeLessThan(0);
		expect(state.x).toBeGreaterThan(0);
		expect(state.y).toBeGreaterThan(250);
	});
	it("keeps throttle speed between the arcade limits", () => {
		for (const throttle of [-50, 50, 0 / 0, math.huge, -math.huge]) {
			const state = FlightMath.NewState();
			for (let step = 0; step < 300; step++) FlightMath.Step(state, { x: 0, y: 0, throttle }, 1 / 30);
			expect(FlightMath.IsFinite(state.speed)).toBe(true);
			expect(state.speed).toBeGreaterThanOrEqual(FlightMath.MinSpeed);
			expect(state.speed).toBeLessThanOrEqual(FlightMath.MaxSpeed);
		}
	});
	it("falls back to neutral steering and cruise throttle for invalid controls", () => {
		const state = FlightMath.NewState();
		const expected = FlightMath.NewState();
		FlightMath.Step(state, { x: 0 / 0, y: math.huge, throttle: -math.huge }, 0.1);
		FlightMath.Step(expected, { x: 0, y: 0, throttle: 0.65 }, 0.1);
		expect(state).toEqual(expected);
	});
	it("uses time based damping with no reverse-time interpolation", () => {
		expect(FlightMath.DampAlpha(8, -1)).toBe(0);
		expect(FlightMath.DampAlpha(8, 0)).toBe(0);
		const half = FlightMath.DampAlpha(8, 0.05);
		expect(1 - (1 - half) * (1 - half)).toBeCloseTo(FlightMath.DampAlpha(8, 0.1), 6);
	});
	it("wraps angles and approaches across the shortest seam", () => {
		expect(FlightMath.WrapAngle(3 * math.pi)).toBeCloseTo(-math.pi);
		expect(FlightMath.WrapAngle(-3 * math.pi)).toBeCloseTo(-math.pi);
		const result = FlightMath.ApproachAngle(math.pi - 0.1, -math.pi + 0.1, 0.05);
		expect(FlightMath.WrapAngle(result - (math.pi - 0.1))).toBeCloseTo(0.05);
	});
	it("caps stalled simulation steps and ignores negative elapsed time", () => {
		const capped = FlightMath.NewState();
		const normal = FlightMath.NewState();
		const input = { x: 0.4, y: 0.2, throttle: 1 };
		FlightMath.Step(capped, input, 10);
		FlightMath.Step(normal, input, 0.1);
		expect(capped).toEqual(normal);
		const stationary = FlightMath.NewState();
		FlightMath.Step(stationary, input, -1);
		expect(stationary).toEqual(FlightMath.NewState());
	});
	it("recovers at world edges and the ceiling without protecting the ground", () => {
		const edge = FlightMath.NewState();
		edge.x = 2700;
		FlightMath.Step(edge, { x: 0, y: 0, throttle: 1 }, 0.1);
		expect(edge.yaw).toBeGreaterThan(0);
		for (const sign of [-1, 1]) {
			const state = FlightMath.NewState();
			state.x = sign * 4000; state.z = sign * 4000; state.y = sign > 0 ? 2000 : 0;
			FlightMath.Step(state, { x: sign, y: sign, throttle: 1 }, 0.1);
			expect(math.abs(state.x)).toBeLessThanOrEqual(FlightMath.HardBoundary);
			expect(math.abs(state.z)).toBeLessThanOrEqual(FlightMath.HardBoundary);
			if (sign < 0) expect(state.y).toBeLessThan(0);
			expect(state.y).toBeLessThanOrEqual(FlightMath.MaxAltitude);
			if (sign > 0) expect(state.pitch).toBeLessThan(0);
		}
	});
	it("permits a sustained dive through the old floor", () => {
		const state = FlightMath.NewState();
		for (let i = 0; i < 120; i++) FlightMath.Step(state, { x: 0, y: -1, throttle: 0.65 }, 1 / 30);
		expect(state.y).toBeLessThan(0);
		expect(state.pitch).toBeLessThan(-0.5);
	});
	it("decelerates gradually into lost lift and recovers with engine and nose down", () => {
		const state = FlightMath.NewState(); state.y = 1000;
		FlightMath.Step(state, { x: 0, y: 0, throttle: 0 }, 1 / 30);
		expect(state.speed).toBeGreaterThan(250);
		for (let i = 0; i < 240; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: 0 }, 1 / 30);
		expect(state.speed).toBeLessThan(140);
		expect(state.y).toBeLessThan(900);
		const low = state.speed;
		for (let i = 0; i < 180; i++) FlightMath.Step(state, { x: 0, y: -0.3, throttle: 1 }, 1 / 30);
		expect(state.speed).toBeGreaterThan(low + 100);
		expect(FlightMath.StallSeverity(state.speed)).toBe(0);
	});
	it("loses turn authority and lift at low speed even with pull-up input", () => {
		const fast = FlightMath.NewState(); fast.speed = 240;
		const slow = FlightMath.NewState(); slow.speed = 95;
		const input = { x: 1, y: 1, throttle: 0 };
		FlightMath.Step(fast, input, 0.1); FlightMath.Step(slow, input, 0.1);
		expect(math.abs(slow.yaw)).toBeLessThan(math.abs(fast.yaw) * 0.75);
		expect(slow.y).toBeLessThan(250);
		expect(fast.y).toBeGreaterThan(250);
	});
	it("right-stick throttle rejects drift, ramps and persists at neutral", () => {
		expect(FlightMath.AdjustThrottle(0.6, 0 / 0, 0.1)).toBe(0.6);
		expect(FlightMath.AdjustThrottle(0.6, 0.17, 0.1)).toBe(0.6);
		expect(FlightMath.AdjustThrottle(0.6, -0.17, 0.1)).toBe(0.6);
		expect(FlightMath.AdjustThrottle(0.6, 0, 0.1)).toBe(0.6);
		expect(FlightMath.AdjustThrottle(0.6, 1, 0.1)).toBeCloseTo(0.64);
		expect(FlightMath.AdjustThrottle(0.6, -1, 0.1)).toBeCloseTo(0.56);
		expect(FlightMath.AdjustThrottle(1, 1, 0.1)).toBe(1);
		expect(FlightMath.AdjustThrottle(0, -1, 0.1)).toBe(0);
	});

});
