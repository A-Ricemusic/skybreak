import { describe, expect, it } from "@rbxts/jest-globals";
import { BomberRules, BomberPoint } from "../shared/BomberRules";
const origin = [{ x: 0, y: 0, z: 0 }];
const distance = (a: BomberPoint, b: BomberPoint) => math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const straight = [{ x: 0, y: 590, z: 0 }, { x: 0, y: 590, z: -2000 }, { x: 0, y: 590, z: -4000 }];
describe("BomberRules absolute-time routes", () => {
	it("traverses waypoints at the configured speed with outgoing boundary ownership", () => {
		const route = BomberRules.Create(straight, 200, origin);
		expect(route.duration).toBeCloseTo(20, 8);
		expect(BomberRules.Sample(route, 5).slots[0].position.z).toBeCloseTo(-1000, 6);
		expect(BomberRules.Sample(route, 10).slots[0].position.z).toBeCloseTo(-2000, 6);
		expect(BomberRules.Sample(route, 10).leg).toBe(1);
		expect(BomberRules.Sample(route, 5).distanceRemaining).toBeCloseTo(3000, 6);
		expect(BomberRules.Sample(BomberRules.Create(straight, 100, origin), 10).slots[0].position.z).toBeCloseTo(-1000, 6);
	});
	it("escapes exactly at the final waypoint and holds there", () => {
		const route = BomberRules.Create(straight, 200, origin);
		expect(BomberRules.Sample(route, route.duration - 0.00001).escaped).toBe(false);
		const finalPose = BomberRules.Sample(route, route.duration);
		expect(finalPose.escaped).toBe(true);
		expect(finalPose.distanceRemaining).toBe(0);
		expect(finalPose.slots[0].position).toEqual(straight[2]);
		expect(BomberRules.Sample(route, 100)).toEqual(finalPose);
		expect(BomberRules.Sample(route, -1)).toEqual(BomberRules.Sample(route, 0));
	});
	it("keeps every pairwise formation distance through a climbing turn", () => {
		const route = BomberRules.Create([straight[0], straight[1], { x: 2000, y: 790, z: -2000 }]);
		for (const t of [0, 3, 8, 10, 12, 16, route.duration]) {
			const pose = BomberRules.Sample(route, t);
			for (let i = 0; i < pose.slots.size(); i++) for (let j = i + 1; j < pose.slots.size(); j++) {
				expect(distance(pose.slots[i].position, pose.slots[j].position)).toBeCloseTo(distance(BomberRules.DefaultSlots[i], BomberRules.DefaultSlots[j]), 6);
			}
		}
	});
	it("passes the corner with continuous heading and approximately constant arc speed", () => {
		const route = BomberRules.Create([straight[0], straight[1], { x: 2000, y: 590, z: -2000 }], 200, origin);
		const boundary = route.curves[0].length / route.speed;
		expect(distance(BomberRules.Sample(route, boundary - 0.0001).slots[0].facing, BomberRules.Sample(route, boundary + 0.0001).slots[0].facing)).toBeLessThan(0.001);
		expect(distance(BomberRules.Sample(route, boundary).slots[0].position, straight[1])).toBeLessThan(0.00001);
		for (const t of [2, 8, boundary, 14, 18]) {
			expect(distance(BomberRules.Sample(route, t).slots[0].position, BomberRules.Sample(route, t + 0.01).slots[0].position) / 0.01).toBeCloseTo(200, 0);
		}
	});
	it("is deterministic regardless of sampling history and copies its inputs", () => {
		const points = straight.map((p) => ({ ...p }));
		const route = BomberRules.Create(points);
		const first = BomberRules.Sample(route, 7.125);
		BomberRules.Sample(route, 18); BomberRules.Sample(route, 2);
		points[0].x = 10000;
		expect(BomberRules.Sample(route, 7.125)).toEqual(first);
		expect(BomberRules.Sample(BomberRules.Create(straight), 7.125)).toEqual(first);
	});
	it("only describes a non-firing non-dogfighting route role", () => {
		expect(BomberRules.Role).toEqual({ role: "bomber", movement: "route", canFire: false, canDogfight: false });
		expect(BomberRules.DefaultSpeed).toBe(200);
		expect(BomberRules.DefaultSlots.size()).toBe(6);
	});
	it("rejects invalid speeds and unsupported routes", () => {
		let rejected = 0;
		for (const speed of [0, -1, math.huge, 0 / 0]) {
			const [ok] = pcall(() => BomberRules.Create(straight, speed));
			if (!ok) rejected++;
		}
		expect(rejected).toBe(4);
		expect(pcall(() => BomberRules.Create([straight[0], straight[0]]))[0]).toBe(false);
		expect(pcall(() => BomberRules.Create([straight[0], straight[1], straight[0]]))[0]).toBe(false);
	});
});
