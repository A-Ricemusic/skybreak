import { describe, expect, it } from "@rbxts/jest-globals";
import { AirRequest, WavePlan } from "../shared/WavePlan";

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
	it("sends an authored group at its share of the whole phase, never on the timer or half the last group", () => {
		// M26: eight in two groups of four; the rear flight comes at 50% of the phase.
		const plan = WavePlan.Groups(8, 2);
		const due = (killed: number, sinceLast: number) => WavePlan.Due({ next: 1, plan, sinceLast, stagger: 18, killed, groupAt: [0.5] });
		expect(due(0, 999)).toBe(false);
		expect(due(2, 1)).toBe(false);
		expect(due(3, 999)).toBe(false);
		expect(due(4, 0)).toBe(true);
	});
	it("budgets seven live hostile aircraft on every difficulty", () => {
		expect(WavePlan.Budget()).toBe(7);
		expect(WavePlan.Budget(0)).toBe(7);
		expect(WavePlan.Budget(1)).toBe(7);
	});
	it("admits bandits before raiders and holds back what does not fit", () => {
		const queue: AirRequest[] = [
			{ role: "raider", count: 2, behind: true },
			{ role: "bandit", count: 3, behind: false, call: "SERA: Second flight on your six! Turn!" },
		];
		const first = WavePlan.Admit(queue, 2);
		expect(first.size()).toBe(1);
		expect(first[0].role).toBe("bandit");
		expect(first[0].count).toBe(2);
		// The group's call goes out with the first of it to fly, once.
		expect(first[0].call).toBe("SERA: Second flight on your six! Turn!");
		expect(WavePlan.Queued(queue, "bandit")).toBe(1);
		expect(WavePlan.Queued(queue, "raider")).toBe(2);
		const second = WavePlan.Admit(queue, 2);
		expect(second.size()).toBe(2);
		expect(second[0].role).toBe("bandit");
		expect(second[0].call).toBeUndefined();
		expect(second[1].role).toBe("raider");
		expect(second[1].count).toBe(1);
		expect(second[1].behind).toBe(true);
		expect(WavePlan.Admit(queue, 0).size()).toBe(0);
		expect(WavePlan.Admit(queue, -3).size()).toBe(0);
		expect(WavePlan.Admit(queue, 5)[0].count).toBe(1);
		expect(queue.size()).toBe(0);
	});
	it("preserves unrestricted route admissions when the opt-in route cap is absent", () => {
		for (const room of [-1, 0, 1, 2, 7, 8]) {
			const route = { id: "patrol", route: { speed: 90, waypoints: [{x:0,y:400,z:0},{x:1000,y:400,z:0}] } } as AirRequest["arrival"];
			const queue = (): AirRequest[] => [{ role:"raider",count:4,behind:false,arrival:route }, {role:"raider",count:4,behind:true}];
			const legacy=queue(), explicit=queue();
			expect(WavePlan.Admit(legacy,room)).toEqual(WavePlan.Admit(explicit,room,room));
			expect(legacy).toEqual(explicit);
		}
	});

});
