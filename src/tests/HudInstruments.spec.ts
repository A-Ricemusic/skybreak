import { describe, expect, it } from "@rbxts/jest-globals";
import { clockLines, formatClock, hullTone, instrumentValue, kestrelOutline, outlineSegments, railsReady, weaponRows, type WeaponStatus } from "../shared/HudInstruments";

const STATUS: WeaponStatus = { missiles: 8, missileCooldown: 0, special: "FLR", specialCharges: 2, specialCooldown: 0, specialActive: 0, evadeCharges: 3, health: 100 };

describe("Ace-style HUD instruments", () => {
	it("lists MSL, the special slot, EVD and DMG with the caret on the FIRE weapon", () => {
		const rows = weaponRows(STATUS);
		expect(rows.map((row) => row.key)).toEqual(["missile", "special", "evade", "damage"]);
		expect(rows.map((row) => `${row.label} ${row.value}`)).toEqual(["MSL 8", "FLR 2", "EVD 3", "DMG 0%"]);
		expect(rows.map((row) => row.caret)).toEqual([true, false, false, false]);
		for (const row of rows) expect(row.tone).toBe("normal");
		// Other specials keep their own short name.
		expect(weaponRows({ ...STATUS, special: "4AAM", specialCharges: 1 })[1].label).toBe("4AAM");
	});

	it("dims cycling or empty weapons, flags an empty rack and an active special", () => {
		expect(weaponRows({ ...STATUS, missileCooldown: 0.4 })[0].tone).toBe("dim");
		expect(weaponRows({ ...STATUS, missiles: 0 })[0].tone).toBe("danger");
		expect(weaponRows({ ...STATUS, specialCharges: 0 })[1].tone).toBe("dim");
		expect(weaponRows({ ...STATUS, specialCooldown: 1.2 })[1].tone).toBe("dim");
		const active = weaponRows({ ...STATUS, special: "UAV", specialActive: 7.2 })[1];
		expect(active.value).toBe("ON 8");
		expect(active.tone).toBe("warn");
		expect(weaponRows({ ...STATUS, evadeCharges: 0 })[2].tone).toBe("dim");
	});

	it("reads damage as the hull lost, green to amber to red", () => {
		expect(weaponRows({ ...STATUS, health: 72.4 })[3].value).toBe("28%");
		expect(weaponRows({ ...STATUS, health: 0 })[3].value).toBe("100%");
		expect(weaponRows({ ...STATUS, health: 140 })[3].value).toBe("0%");
		expect(hullTone(100)).toBe("normal");
		expect(hullTone(61)).toBe("normal");
		expect(hullTone(60)).toBe("warn");
		expect(hullTone(31)).toBe("warn");
		expect(hullTone(30)).toBe("danger");
		expect(weaponRows({ ...STATUS, health: 25 })[3].tone).toBe("danger");
	});

	it("lights a rail per ready missile, both dark while the launcher cycles", () => {
		expect(railsReady(8, 0)).toEqual([true, true]);
		expect(railsReady(1, 0)).toEqual([true, false]);
		expect(railsReady(0, 0)).toEqual([false, false]);
		expect(railsReady(8, 0.5)).toEqual([false, false]);
	});

	it("shows TIME and the objective count (or kills) in the top-left block", () => {
		expect(formatClock(247.9)).toBe("04:07");
		expect(formatClock(-3)).toBe("00:00");
		expect(clockLines(600, 2, 4, 9, 9)).toEqual(["TIME 10:00", "TGT 2/4"]);
		expect(clockLines(59, 7, 4, 0, 0)[1]).toBe("TGT 4/4");
		expect(clockLines(90, undefined, undefined, 3, 5)[1]).toBe("KILL 3/5");
		expect(clockLines(90, undefined, 0, 2, 0)[1]).toBe("KILL 2");
	});

	it("keeps SPEED and ALT to whole numbers that fit the box", () => {
		expect(instrumentValue(412.8)).toBe("412");
		expect(instrumentValue(123456)).toBe("9999");
		expect(instrumentValue(-5000)).toBe("-999");
	});

	it("draws the Kestrel as one closed, symmetric outline inside its box", () => {
		const points = kestrelOutline();
		expect(points.size()).toBeGreaterThan(20);
		let minX = 1, maxX = 0, minY = 1, maxY = 0;
		for (const [x, y] of points) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(1);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(1);
			minX = math.min(minX, x); maxX = math.max(maxX, x); minY = math.min(minY, y); maxY = math.max(maxY, y);
		}
		// Wingtip to wingtip and nose to tail fill the box; the nose is on the centre line at the top.
		expect(minX).toBeCloseTo(0, 3);
		expect(maxX).toBeCloseTo(1, 3);
		expect(minY).toBeCloseTo(0, 3);
		expect(points[0][0]).toBeCloseTo(0.5, 3);
		// Mirror symmetry: every point has a twin across the centre line.
		for (const [x, y] of points) expect(points.some(([u, v]) => math.abs(u - (1 - x)) < 1e-6 && math.abs(v - y) < 1e-6)).toBe(true);
		const segments = outlineSegments(points, 38, 44);
		expect(segments.size()).toBe(points.size());
		for (const segment of segments) {
			expect(segment.length).toBeGreaterThan(0.5);
			expect(segment.x).toBeGreaterThanOrEqual(0);
			expect(segment.x).toBeLessThanOrEqual(38);
			expect(segment.y).toBeGreaterThanOrEqual(0);
			expect(segment.y).toBeLessThanOrEqual(44);
		}
	});
});
