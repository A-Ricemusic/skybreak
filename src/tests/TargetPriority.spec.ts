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
		expect(TargetPriority.Best([{ id: 1, distance: 3000, dot: 1 }, { id: 2, distance: 100, dot: 0.999 }])).toBe(2);
		expect(TargetPriority.Best([{ id: 1, distance: 3000, dot: 1 }, { id: 2, distance: 100, dot: 1 }])).toBe(2);
		expect(TargetPriority.Best([{ id: 1, distance: 3000, dot: 1 }, { id: 2, distance: 100, dot: 0.98 }])).toBe(1);
	});
	it("breaks exact ties by stable id", () => {
		expect(TargetPriority.Order([{ id: 2, distance: 20, dot: 1 }, { id: 1, distance: 20, dot: 1 }]).map((c) => c.id)).toEqual([1, 2]);
	});
	it("tolerates NaN and infinite metrics without breaking the order", () => {
		const odd = [{ id: 0, distance: 0 / 0, dot: 0 / 0 }, { id: 1, distance: math.huge, dot: 0.5 }, { id: 2, distance: 10, dot: 0.5 }];
		expect(TargetPriority.Order(odd).map((c) => c.id)).toEqual([2, 1, 0]);
	});
	it("handles empty and single-contact lists", () => {
		expect(TargetPriority.Best([])).toBeUndefined();
		expect(TargetPriority.Next([])).toBeUndefined();
		expect(TargetPriority.Next([contacts[0]], 0)).toEqual({ id: 0, cursor: 0 });
	});
});

describe("automatic acquisition", () => {
	it("prefers a nose-aligned optional over a nearer off-axis required target", () => {
		const list = [{ id: 0, distance: 400, dot: 0.6, required: true }, { id: 1, distance: 1200, dot: 0.98, required: false }];
		expect(TargetPriority.Best(list)).toBe(1);
	});
	it("lets a required target win at a similar bearing", () => {
		const list = [{ id: 0, distance: 900, dot: 0.96, required: true }, { id: 1, distance: 900, dot: 0.99, required: false }];
		expect(TargetPriority.Best(list)).toBe(0);
		expect(TargetPriority.Score(list[0]) - TargetPriority.Score(list[1])).toBeCloseTo(TargetPriority.RequiredBonus - 0.03, 6);
	});
	it("orders blocked or held, out-of-range and behind contacts after clear ones ahead", () => {
		const list = [
			{ id: 0, distance: 300, dot: -0.2, required: true },
			{ id: 1, distance: 4000, dot: 1, inRange: false },
			{ id: 2, distance: 900, dot: 0.99, blocked: true },
			{ id: 3, distance: 1500, dot: 0.7, inRange: true },
			{ id: 4, distance: 800, dot: 0.95, held: true },
		];
		expect(TargetPriority.Order(list).map((c) => c.id)).toEqual([3, 2, 4, 1, 0]);
		expect(list.map((c) => TargetPriority.Tier(c))).toEqual([3, 2, 1, 0, 1]);
	});
	it("holds contacts the phase protects behind damageable ones ahead", () => {
		const list = [{ id: 0, distance: 500, dot: 0.99, required: true, held: true }, { id: 1, distance: 900, dot: 0.5 }];
		expect(TargetPriority.Best(list)).toBe(1);
		expect(TargetPriority.Best([list[0]])).toBe(0);
	});
	it("picks the nose-best among the survivors after a kill", () => {
		const before = [{ id: 0, distance: 600, dot: 0.99 }, { id: 1, distance: 700, dot: 0.9 }, { id: 2, distance: 200, dot: 0.3 }];
		expect(TargetPriority.Best(before)).toBe(0);
		const survivors = before.filter((c) => c.id !== 0);
		expect(TargetPriority.Best(survivors)).toBe(1);
	});
	it("checks line of sight only for the leading contacts that are ahead and in range", () => {
		const list = [
			{ id: 0, distance: 100, dot: -1 },
			{ id: 1, distance: 100, dot: 1 },
			{ id: 2, distance: 100, dot: 0.9 },
			{ id: 3, distance: 100, dot: 0.8 },
			{ id: 4, distance: 100, dot: 0.7 },
			{ id: 5, distance: 100, dot: 0.6 },
			{ id: 6, distance: 9000, dot: 1, inRange: false },
		];
		expect(TargetPriority.LosChecks(list).map((c) => c.id)).toEqual([1, 2, 3, 4]);
		expect(TargetPriority.LosChecks(list, 2).map((c) => c.id)).toEqual([1, 2]);
		expect(TargetPriority.LosChecks([list[0], list[6]]).size()).toBe(0);
	});
});

describe("TGT press", () => {
	const contacts = [
		{ id: 0, distance: 100, dot: -1 },
		{ id: 1, distance: 3000, dot: 1 },
		{ id: 2, distance: 500, dot: 0.8 },
	];
	it("snaps to the nose-best when the current target is not it", () => {
		expect(TargetPriority.Next(contacts, 2)).toEqual({ id: 1, cursor: 0 });
		expect(TargetPriority.Next(contacts, 0)).toEqual({ id: 1, cursor: 0 });
	});
	it("selects the nose-best with no current target or a foreign one", () => {
		expect(TargetPriority.Next(contacts)).toEqual({ id: 1, cursor: 0 });
		expect(TargetPriority.Next(contacts, 99)).toEqual({ id: 1, cursor: 0 });
	});
	it("advances to the next in order when already on the nose-best", () => {
		expect(TargetPriority.Next(contacts, 1)).toEqual({ id: 2, cursor: 1 });
	});
	it("continues a quick chain of presses through every contact and wraps", () => {
		const first = TargetPriority.Next(contacts, 2)!;
		const second = TargetPriority.Next(contacts, first.id, first.cursor)!;
		const third = TargetPriority.Next(contacts, second.id, second.cursor)!;
		const fourth = TargetPriority.Next(contacts, third.id, third.cursor)!;
		expect([first.id, second.id, third.id, fourth.id]).toEqual([1, 2, 0, 1]);
	});
	it("steps past the current target when a re-sort would land a chained press on it", () => {
		// Cursor 0 last picked id 2; the order has since shifted so id 2 now sits at index 1.
		const shifted = [{ id: 1, distance: 100, dot: 1 }, { id: 2, distance: 100, dot: 0.99 }, { id: 0, distance: 100, dot: 0.5 }];
		expect(TargetPriority.Next(shifted, 2, 0)).toEqual({ id: 0, cursor: 2 });
		expect(TargetPriority.Next([shifted[1]], 2, 0)).toEqual({ id: 2, cursor: 0 });
	});
	it("snaps back once the chain lapses", () => {
		expect(TargetPriority.Next(contacts, 0, undefined)).toEqual({ id: 1, cursor: 0 });
		expect(TargetPriority.CycleChainSeconds).toBe(2.5);
	});
});
