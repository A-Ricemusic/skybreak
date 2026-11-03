import { describe, expect, it } from "@rbxts/jest-globals";
import { finiteOr, isFiniteNumber } from "../shared/Finite";

// Shared finite-number guards; pure, so they also run in the offline Luau VM.
describe("Finite", () => {
	it("accepts only real finite numbers", () => {
		for (const value of [0, -0, 1, -1.5, 1e300, math.pi]) expect(isFiniteNumber(value)).toBe(true);
		for (const value of [0 / 0, math.huge, -math.huge, undefined, "1", true, {}, []])
			expect(isFiniteNumber(value)).toBe(false);
	});
	it("falls back for anything that is not a finite number", () => {
		expect(finiteOr(3, 7)).toBe(3);
		expect(finiteOr(0, 7)).toBe(0);
		for (const value of [0 / 0, math.huge, -math.huge, undefined, "3", {}]) expect(finiteOr(value, 7)).toBe(7);
	});
});
