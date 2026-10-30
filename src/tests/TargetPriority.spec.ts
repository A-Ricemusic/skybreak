import { describe, expect, it } from "@rbxts/jest-globals";
import { TargetPriority } from "../shared/TargetPriority";

describe("nose target priority", () => {
	const contacts = [
		{ id: 0, distance: 100, dot: -1 },
		{ id: 1, distance: 3000, dot: 1 },
		{ id: 2, distance: 500, dot: 0.8 },
	];
	it("orders by the nose before distance, leaving the input unchanged", () => {
		expect(TargetPriority.Order(contacts).map((c) => c.id)).toEqual([1, 2, 0]);
		expect(contacts[0].id).toBe(0);
	});
	it("uses a bounded distance bias for similar angles", () => {
		expect(TargetPriority.Next([{ id: 1, distance: 3000, dot: 1 }, { id: 2, distance: 100, dot: 0.999 }])).toBe(2);
		expect(TargetPriority.Next([{ id: 1, distance: 3000, dot: 1 }, { id: 2, distance: 100, dot: 1 }])).toBe(2);
	});
	it("advances and wraps in nose order", () => {
		expect(TargetPriority.Next(contacts, 1)).toBe(2);
		expect(TargetPriority.Next(contacts, 0)).toBe(1);
	});
	it("starts with the first when current is absent or foreign", () => {
		expect(TargetPriority.Next(contacts)).toBe(1);
		expect(TargetPriority.Next(contacts, 99)).toBe(1);
	});
	it("breaks exact ties by stable id", () => {
		expect(TargetPriority.Order([{ id: 2, distance: 20, dot: 1 }, { id: 1, distance: 20, dot: 1 }]).map((c) => c.id)).toEqual([1, 2]);
	});
	it("handles empty and single-contact lists", () => {
		expect(TargetPriority.Next([])).toBeUndefined();
		expect(TargetPriority.Next([contacts[0]], 0)).toBe(0);
	});
	it("preserves the auto-acquire score on both sides of the nose", () => {
		expect(TargetPriority.AcquireScore(100, 1)).toBe(100);
		expect(TargetPriority.AcquireScore(100, 0)).toBe(800);
		expect(TargetPriority.AcquireScore(100, -0.1)).toBe(5100);
	});
});
