import { describe, expect, it } from "@rbxts/jest-globals";
import { WavePlan } from "../shared/WavePlan";

// Pure staggered-wave contracts; also run in the offline Luau VM (toBe/toBeUndefined only).
describe("Staggered waves", () => {
	it("splits a phase's count into even groups, larger first", () => {
		const join = (plan: number[]) => plan.map((n) => tostring(n)).join(",");
		expect(join(WavePlan.Groups(9, 3))).toBe("3,3,3");
		expect(join(WavePlan.Groups(5, 2))).toBe("3,2");
		expect(join(WavePlan.Groups(10, 2))).toBe("5,5");
		expect(join(WavePlan.Groups(4))).toBe("4");
		expect(join(WavePlan.Groups(2, 5))).toBe("1,1");
		expect(WavePlan.Groups(0, 2).size()).toBe(0);
	});
	it("sends the next group after the stagger, or once half the previous group is down", () => {
		const plan = WavePlan.Groups(6, 2);
		expect(WavePlan.Due({ next: 1, plan, sinceLast: 5, stagger: 18, killed: 0 })).toBe(false);
		expect(WavePlan.Due({ next: 1, plan, sinceLast: 5, stagger: 18, killed: 1 })).toBe(false);
		expect(WavePlan.Due({ next: 1, plan, sinceLast: 5, stagger: 18, killed: 2 })).toBe(true);
		expect(WavePlan.Due({ next: 1, plan, sinceLast: 18, stagger: 18, killed: 0 })).toBe(true);
	});
	it("counts only the previous group's kills toward the half-down trigger", () => {
		const plan = WavePlan.Groups(9, 3);
		// Group two is out (six spawned); three kills means only one of group two is down.
		expect(WavePlan.Due({ next: 2, plan, sinceLast: 3, stagger: 18, killed: 3 })).toBe(false);
		expect(WavePlan.Due({ next: 2, plan, sinceLast: 3, stagger: 18, killed: 5 })).toBe(true);
	});
	it("never spawns past the plan", () => {
		const plan = WavePlan.Groups(4, 2);
		expect(WavePlan.Due({ next: 2, plan, sinceLast: 99, stagger: 1, killed: 4 })).toBe(false);
		expect(WavePlan.Due({ next: 0, plan, sinceLast: 99, stagger: 1, killed: 0 })).toBe(false);
	});
	it("staggers a ten-bandit wing so no more than five are up at once when the player keeps pace", () => {
		const plan = WavePlan.Groups(10, 2);
		let spawned = plan[0], nextGroup = 1, killed = 0, peak = spawned, sinceLast = 0;
		// One kill every 8 s, checked each second.
		for (let t = 1; t <= 200 && killed < 10; t++) {
			sinceLast += 1;
			if (t % 8 === 0 && killed < spawned) killed += 1;
			if (WavePlan.Due({ next: nextGroup, plan, sinceLast, stagger: 40, killed })) { spawned += plan[nextGroup]; nextGroup += 1; sinceLast = 0; }
			peak = math.max(peak, spawned - killed);
		}
		expect(killed).toBe(10);
		expect(peak <= 8).toBe(true);
		expect(nextGroup).toBe(2);
	});
	it("alternates bracket sides inside a group and across groups", () => {
		const join = (sides: number[]) => sides.map((n) => tostring(n)).join(",");
		// A four-ship group used to come in all on one side (the list grew while the index did).
		expect(join(WavePlan.BracketSides(0, 4))).toBe("1,-1,1,-1");
		expect(join(WavePlan.BracketSides(7, 4))).toBe("-1,1,-1,1");
		// A three-ship group then the next pair: the pair continues the alternation.
		expect(join(WavePlan.BracketSides(0, 3))).toBe("1,-1,1");
		expect(join(WavePlan.BracketSides(3, 2))).toBe("-1,1");
		expect(WavePlan.BracketSides(5, 0).size()).toBe(0);
	});
});

