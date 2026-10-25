import { describe, expect, it } from "@rbxts/jest-globals";

import {
	CONTROL_TOWER_PARTS,
	HANGAR_PARTS,
	MENU_JET_CLEARANCE,
	MENU_OBSTACLES,
	MenuPartSpec,
	findPenetratingPairs,
	partsPenetrate,
} from "../shared/MenuWorldGeometry";

// The menu scene is rendered under a continuous sine-wave camera sway
// (`GameUI.setMenuCamera`). Overlapping coplanar faces can z-fight under
// that motion. Disjoint building volumes are a conservative construction
// invariant that prevents the specific corner overlaps fixed here.

function describePart(part: MenuPartSpec): string {
	const half = part.size.div(2);
	const lo = part.offset.sub(half);
	const hi = part.offset.add(half);
	return `${part.name} X[${lo.X}, ${hi.X}] Y[${lo.Y}, ${hi.Y}] Z[${lo.Z}, ${hi.Z}]`;
}

describe("menu-world geometry has no co-penetrating parts", () => {
	it("buts touching surfaces together without reporting penetration", () => {
		const floor: MenuPartSpec = { name: "Floor", size: new Vector3(10, 2, 10), offset: Vector3.zero };
		const wall: MenuPartSpec = { name: "Wall", size: new Vector3(10, 10, 2), offset: new Vector3(0, 6, 4) };
		// Floor top at Y=1, wall bottom at Y=1 — touching but not penetrating.
		expect(partsPenetrate(floor, wall)).toBe(false);
	});

	it("flags any strict interior volume overlap", () => {
		const a: MenuPartSpec = { name: "A", size: new Vector3(10, 10, 10), offset: Vector3.zero };
		const b: MenuPartSpec = { name: "B", size: new Vector3(10, 10, 10), offset: new Vector3(1, 0, 0) };
		expect(partsPenetrate(a, b)).toBe(true);
	});

	it("keeps the hangar parts strictly non-penetrating", () => {
		const bad = findPenetratingPairs(HANGAR_PARTS);
		expect(bad).toEqual([]);
		if (bad.size() > 0) {
			for (const [left, right] of bad) {
				const a = HANGAR_PARTS.find((p) => p.name === left)!;
				const b = HANGAR_PARTS.find((p) => p.name === right)!;
				print(`hangar penetration: ${describePart(a)} vs ${describePart(b)}`);
			}
		}
	});

	it("keeps the control-tower parts strictly non-penetrating", () => {
		const bad = findPenetratingPairs(CONTROL_TOWER_PARTS);
		expect(bad).toEqual([]);
		if (bad.size() > 0) {
			for (const [left, right] of bad) {
				const a = CONTROL_TOWER_PARTS.find((p) => p.name === left)!;
				const b = CONTROL_TOWER_PARTS.find((p) => p.name === right)!;
				print(`tower penetration: ${describePart(a)} vs ${describePart(b)}`);
			}
		}
	});

	it("preserves the hangar's exterior silhouette (72 wide × 52 deep)", () => {
		let minX = math.huge;
		let maxX = -math.huge;
		let minY = math.huge;
		let maxY = -math.huge;
		let minZ = math.huge;
		let maxZ = -math.huge;
		for (const part of HANGAR_PARTS) {
			const half = part.size.div(2);
			minX = math.min(minX, part.offset.X - half.X);
			maxX = math.max(maxX, part.offset.X + half.X);
			minY = math.min(minY, part.offset.Y - half.Y);
			maxY = math.max(maxY, part.offset.Y + half.Y);
			minZ = math.min(minZ, part.offset.Z - half.Z);
			maxZ = math.max(maxZ, part.offset.Z + half.Z);
		}
		// Includes the 1.5-stud roof eave on each horizontal axis.
		expect(maxX - minX).toBe(75);
		expect(maxZ - minZ).toBe(55);
		// Floor rests at Y=-1 to Y=1; roof caps at Y=30.
		expect(minY).toBe(-1);
		expect(maxY).toBe(30);
	});

	it("has an open hangar door front with no part obstructing the entry", () => {
		// The door opening is the front half of the hangar below the header
		// bottom. Nothing should occupy X [-33, 33] × Y [1, 22] × Z [-26, 23].
		const opening: MenuPartSpec = {
			name: "DoorOpening",
			size: new Vector3(66, 21, 49),
			offset: new Vector3(0, 11.5, -1.5),
		};
		for (const part of HANGAR_PARTS) {
			expect(partsPenetrate(part, opening)).toBe(false);
		}
	});

	it("parks the display jet clear of every hangar and the control tower", () => {
		const bad = findPenetratingPairs([MENU_JET_CLEARANCE, ...MENU_OBSTACLES]);
		expect(bad).toEqual([]);
		if (bad.size() > 0) {
			for (const [left, right] of bad) print(`menu jet collision: ${left} vs ${right}`);
		}
		// Sanity: the obstacle boxes really describe the buildings (three hangars, one tower).
		expect(MENU_OBSTACLES.size()).toBe(4);
		const hangar = MENU_OBSTACLES[2];
		expect(hangar.offset.X).toBeCloseTo(195, 3);
		expect(hangar.size.X).toBeCloseTo(55, 1);
	});
});
