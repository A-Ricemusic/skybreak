import { describe, expect, it } from "@rbxts/jest-globals";
import { clockLines, formatClock, hullFraction, hullTone, instrumentValue, STATUS_SEPARATOR, statusLine, type WeaponStatus } from "../shared/HudInstruments";

const STATUS: WeaponStatus = { missiles: 8, missileCooldown: 0, special: "FLR", specialCharges: 3, specialCooldown: 0, specialActive: 0, evadeCharges: 3 };
const line = (status: WeaponStatus) => statusLine(status).map((cell) => cell.text).join(STATUS_SEPARATOR);

describe("Ace-style HUD instruments", () => {
	it("reads the ammo as one short line: MSL, the special slot, EVD", () => {
		const cells = statusLine(STATUS);
		expect(cells.map((cell) => cell.key)).toEqual(["missile", "special", "evade"]);
		expect(line(STATUS)).toBe("MSL 8 · FLR 3 · EVD 3");
		for (const cell of cells) expect(cell.tone).toBe("normal");
		// Other specials keep their own short name; the running special reads ON (its button shows the countdown).
		expect(line({ ...STATUS, special: "4AAM", specialCharges: 1 })).toBe("MSL 8 · 4AAM 1 · EVD 3");
		expect(line({ ...STATUS, missiles: 12, special: "XLAA", specialActive: 7.2 })).toBe("MSL 12 · XLAA ON · EVD 3");
		expect(line({ ...STATUS, missiles: -2, specialCharges: 2.7, evadeCharges: 1.5 })).toBe("MSL 0 · FLR 2 · EVD 1");
	});

	it("dims cycling or empty weapons, flags an empty rack and an active special", () => {
		expect(statusLine({ ...STATUS, missileCooldown: 0.4 })[0].tone).toBe("dim");
		expect(statusLine({ ...STATUS, missiles: 0 })[0].tone).toBe("danger");
		expect(statusLine({ ...STATUS, specialCharges: 0 })[1].tone).toBe("dim");
		expect(statusLine({ ...STATUS, specialCooldown: 1.2 })[1].tone).toBe("dim");
		expect(statusLine({ ...STATUS, special: "UAV", specialActive: 7.2 })[1].tone).toBe("warn");
		expect(statusLine({ ...STATUS, evadeCharges: 0 })[2].tone).toBe("dim");
	});

	it("fills the hull bar with the hull left, green to amber to red", () => {
		expect(hullFraction(100)).toBe(1);
		expect(hullFraction(72.5)).toBeCloseTo(0.725, 5);
		expect(hullFraction(0)).toBe(0);
		expect(hullFraction(140)).toBe(1);
		expect(hullFraction(-20)).toBe(0);
		expect(hullFraction(0 / 0)).toBe(0);
		expect(hullTone(100)).toBe("normal");
		expect(hullTone(61)).toBe("normal");
		expect(hullTone(60)).toBe("warn");
		expect(hullTone(31)).toBe("warn");
		expect(hullTone(30)).toBe("danger");
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
});
