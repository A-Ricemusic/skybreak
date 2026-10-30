import { describe, expect, it } from "@rbxts/jest-globals";
import { TargetPriority, type TargetCandidate } from "../shared/TargetPriority";

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
		expect(TargetPriority.Press([])).toBeUndefined();
		expect(TargetPriority.Press([contacts[0]], 0)).toBe(0);
		expect(TargetPriority.Press([contacts[0]], 0, true)).toBe(0);
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
	// Distances from the jet; everything here is on screen unless said otherwise.
	const seen = (id: number, distance: number, extra: Partial<TargetCandidate> = {}): TargetCandidate => ({ id, distance, dot: 0.9, onScreen: true, ...extra });
	const contacts = [seen(0, 900), seen(1, 300), seen(2, 600), seen(3, 1500)];
	it("orders on-screen contacts closest first, leaving the input unchanged", () => {
		expect(TargetPriority.PressOrder(contacts).map((c) => c.id)).toEqual([1, 2, 0, 3]);
		expect(contacts[0].id).toBe(0);
	});
	it("selects the closest on-screen contact when the current target is not it", () => {
		expect(TargetPriority.Press(contacts, 0)).toBe(1);
		expect(TargetPriority.Press(contacts, 3)).toBe(1);
	});
	it("selects the closest with no current target or a foreign one", () => {
		expect(TargetPriority.Press(contacts)).toBe(1);
		expect(TargetPriority.Press(contacts, 99)).toBe(1);
	});
	it("selects the second closest when the current target is already the closest", () => {
		expect(TargetPriority.Press(contacts, 1)).toBe(2);
		expect(TargetPriority.Press(contacts, 1, true)).toBe(2);
	});
	it("walks on through the order during a quick chain and wraps", () => {
		const first = TargetPriority.Press(contacts, 0)!;
		const second = TargetPriority.Press(contacts, first, true)!;
		const third = TargetPriority.Press(contacts, second, true)!;
		const fourth = TargetPriority.Press(contacts, third, true)!;
		const fifth = TargetPriority.Press(contacts, fourth, true)!;
		expect([first, second, third, fourth, fifth]).toEqual([1, 2, 0, 3, 1]);
	});
	it("snaps back to the closest once the chain lapses", () => {
		expect(TargetPriority.Press(contacts, 0, false)).toBe(1);
		expect(TargetPriority.CycleChainSeconds).toBe(2.5);
	});
	it("ranks off-screen contacts after every on-screen one, however close", () => {
		// id 1 never learned onScreen at all (a table without the key, as the server leaves it for acquisition).
		const list = [seen(0, 50, { onScreen: false }), { id: 1, distance: 50, dot: 0.9 }, seen(2, 2000), seen(3, 1200)];
		expect(TargetPriority.PressOrder(list).map((c) => c.id)).toEqual([3, 2, 0, 1]);
		expect(TargetPriority.Press(list, 3)).toBe(2);
		expect(list.map((c) => TargetPriority.PressTier(c))).toEqual([2, 2, 0, 0]);
	});
	it("falls back to the closest contact overall when nothing is on screen", () => {
		const unseen = [seen(0, 900, { onScreen: false }), seen(1, 300, { onScreen: false }), seen(2, 600, { onScreen: false })];
		expect(TargetPriority.Press(unseen)).toBe(1);
		expect(TargetPriority.Press(unseen, 1)).toBe(2);
	});
	it("ranks blocked or held on-screen contacts behind clear ones but ahead of off-screen ones", () => {
		const list = [seen(0, 200, { blocked: true }), seen(1, 400, { held: true }), seen(2, 800), seen(3, 100, { onScreen: false })];
		expect(TargetPriority.PressOrder(list).map((c) => c.id)).toEqual([2, 0, 1, 3]);
		expect(TargetPriority.Press(list, 2)).toBe(0);
	});
	it("gives a required contact only a small distance tie-break", () => {
		expect(TargetPriority.Press([seen(0, 500), seen(1, 520, { required: true })])).toBe(1);
		expect(TargetPriority.Press([seen(0, 500), seen(1, 540, { required: true })])).toBe(0);
		expect(TargetPriority.RequiredTieStuds).toBe(30);
	});
	it("breaks exact ties by id and sorts non-finite distances last", () => {
		expect(TargetPriority.PressOrder([seen(2, 400), seen(1, 400)]).map((c) => c.id)).toEqual([1, 2]);
		expect(TargetPriority.PressOrder([seen(0, 0 / 0), seen(1, math.huge), seen(2, 9000)]).map((c) => c.id)).toEqual([2, 0, 1]);
	});
	it("spends line-of-sight checks on the nearest on-screen damageable contacts only", () => {
		const list = [seen(0, 100, { onScreen: false }), seen(1, 500), seen(2, 200), seen(3, 300, { held: true }), seen(4, 400), seen(5, 600), seen(6, 700)];
		expect(TargetPriority.PressLosChecks(list).map((c) => c.id)).toEqual([2, 4, 1, 5]);
		expect(TargetPriority.PressLosChecks(list, 2).map((c) => c.id)).toEqual([2, 4]);
		expect(TargetPriority.PressLosChecks([list[0], list[3]]).size()).toBe(0);
	});
});

describe("view frustum", () => {
	const origin = { x: 0, y: 100, z: 0 };
	const look = { x: 0, y: 0, z: -1 }, right = { x: 1, y: 0, z: 0 }, up = { x: 0, y: 1, z: 0 };
	// 90 degree vertical FOV, 2:1 aspect: half-angles of 45 degrees vertically and about 63 degrees horizontally.
	const view = TargetPriority.Frustum(origin, look, right, up, 90, 2)!;
	it("builds a frustum from a plausible camera", () => {
		expect(view).toBeDefined();
		expect(view.tanHalfFov).toBeCloseTo(1, 6);
		expect(view.aspect).toBe(2);
	});
	it("sees contacts ahead inside both half-angles", () => {
		expect(TargetPriority.InView(view, { x: 0, y: 100, z: -1000 })).toBe(true);
		expect(TargetPriority.InView(view, { x: 1900, y: 100, z: -1000 })).toBe(true);
		expect(TargetPriority.InView(view, { x: 0, y: 1090, z: -1000 })).toBe(true);
		expect(TargetPriority.InView(view, { x: -1900, y: -890, z: -1000 })).toBe(true);
	});
	it("excludes contacts behind the camera, at it, or outside the frustum edges", () => {
		expect(TargetPriority.InView(view, { x: 0, y: 100, z: 1000 })).toBe(false);
		expect(TargetPriority.InView(view, { x: 0, y: 100, z: 0 })).toBe(false);
		expect(TargetPriority.InView(view, { x: 0, y: 100, z: -0.5 })).toBe(false);
		expect(TargetPriority.InView(view, { x: 2100, y: 100, z: -1000 })).toBe(false);
		expect(TargetPriority.InView(view, { x: 0, y: 1110, z: -1000 })).toBe(false);
		expect(TargetPriority.InView(view, { x: 0 / 0, y: 100, z: -1000 })).toBe(false);
	});
	it("honours the aspect ratio: a portrait phone shows less to the sides", () => {
		const portrait = TargetPriority.Frustum(origin, look, right, up, 90, 0.5)!;
		expect(TargetPriority.InView(portrait, { x: 600, y: 100, z: -1000 })).toBe(false);
		expect(TargetPriority.InView(portrait, { x: 400, y: 100, z: -1000 })).toBe(true);
	});
	it("clamps FOV and aspect and defaults non-finite or missing ones", () => {
		const bounds = TargetPriority.FovBounds, aspects = TargetPriority.AspectBounds;
		expect(TargetPriority.Frustum(origin, look, right, up, 1000, 99)!.tanHalfFov).toBeCloseTo(math.tan(math.rad(bounds.max) / 2), 6);
		expect(TargetPriority.Frustum(origin, look, right, up, 1000, 99)!.aspect).toBe(aspects.max);
		expect(TargetPriority.Frustum(origin, look, right, up, -5, 0)!.tanHalfFov).toBeCloseTo(math.tan(math.rad(bounds.min) / 2), 6);
		expect(TargetPriority.Frustum(origin, look, right, up, -5, 0)!.aspect).toBe(aspects.min);
		expect(TargetPriority.Frustum(origin, look, right, up, 0 / 0, "wide")!.tanHalfFov).toBeCloseTo(math.tan(math.rad(bounds.default) / 2), 6);
		expect(TargetPriority.Frustum(origin, look, right, up, undefined, math.huge)!.aspect).toBe(aspects.default);
	});
	it("rejects non-finite positions, non-unit or non-finite axes", () => {
		expect(TargetPriority.Frustum({ x: 0 / 0, y: 0, z: 0 }, look, right, up, 70, 1.7)).toBeUndefined();
		expect(TargetPriority.Frustum(origin, { x: 0, y: 0, z: -5 }, right, up, 70, 1.7)).toBeUndefined();
		expect(TargetPriority.Frustum(origin, look, { x: 0, y: 0, z: 0 }, up, 70, 1.7)).toBeUndefined();
		expect(TargetPriority.Frustum(origin, look, right, { x: 0, y: math.huge, z: 0 }, 70, 1.7)).toBeUndefined();
	});
	it("rejects a camera far from the jet and accepts a chase camera", () => {
		const jet = { x: 0, y: 100, z: 60 };
		expect(TargetPriority.Frustum(origin, look, right, up, 70, 1.7, jet)).toBeDefined();
		expect(TargetPriority.Frustum(origin, look, right, up, 70, 1.7, { x: 0, y: 100, z: TargetPriority.MaxCameraOffset + 1 })).toBeUndefined();
		expect(TargetPriority.Frustum(origin, look, right, up, 70, 1.7, { x: 0 / 0, y: 0, z: 0 })).toBeUndefined();
		expect(TargetPriority.MaxCameraOffset).toBe(500);
	});
	it("normalises near-unit axes", () => {
		const skewed = TargetPriority.Frustum(origin, { x: 0, y: 0, z: -1.05 }, right, up, 90, 1)!;
		expect(skewed.look.z).toBeCloseTo(-1, 6);
	});
});
