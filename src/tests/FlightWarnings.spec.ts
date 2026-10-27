import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath } from "../shared/FlightMath";
import {
	flightAdvice,
	flightWarning,
	LOW_ALTITUDE,
	lowSpeed,
	STALL_MARGIN,
	TERRAIN_LOOKAHEAD,
	TERRAIN_MIN_PROBE,
	terrainProbeLength,
	terrainSeconds,
} from "../shared/FlightWarnings";

describe("flight and combat warnings shared by touch, keyboard and gamepad", () => {
	it("uses complete compact guidance and prioritizes threats on narrow touch screens", () => {
		expect(flightWarning({ speed: 15, altitude: 80, incoming: false }, true)).toBe("STALL: POWER↑ NOSE↓");
		expect(flightWarning({ speed: 15, altitude: 80, incoming: true }, true)).toBe("MISSILE INBOUND");
		expect(flightWarning({ speed: 230, altitude: 250, incoming: false, terrainSeconds: 1 }, true)).toBe("TERRAIN · PULL UP");
	});
	it("retains incoming and lock threats alongside each flight warning", () => {
		for (const [speed, altitude, label] of [[230, 80, "LOW ALTITUDE"], [18, 250, "LOW SPEED"], [15, 250, "STALL"]] as Array<[number, number, string]>) {
			expect(flightWarning({ speed, altitude, incoming: true, lockWarning: true })).toBe(`MISSILE INBOUND · ${label}`);
			expect(flightWarning({ speed, altitude, incoming: false, lockWarning: true })).toBe(`MISSILE LOCK · ${label}`);
		}
		expect(flightWarning({ speed: 230, altitude: 250, incoming: true, terrainSeconds: 1.5 })).toBe("MISSILE INBOUND · TERRAIN");
	});
	it("gives recovery advice when stalled without a combat threat", () => {
		expect(flightWarning({ speed: 15, altitude: 250, incoming: false, lockWarning: false })).toBe("STALL · ACCELERATE + NOSE DOWN");
		expect(flightWarning({ speed: 230, altitude: 250, incoming: false, lockWarning: false })).toBe("");
	});
	it("warns LOW SPEED inside the stall margin and while bleeding toward the stall", () => {
		expect(STALL_MARGIN).toBe(5);
		expect(lowSpeed(FlightMath.StallSpeed + STALL_MARGIN - 1)).toBe(true);
		expect(lowSpeed(FlightMath.StallSpeed + STALL_MARGIN)).toBe(false);
		// 200 studs/s losing 32/s reaches 136 inside the 2 s trend window.
		expect(lowSpeed(70, -32)).toBe(true);
		expect(lowSpeed(200, -10)).toBe(false);
		// Accelerating never warns early, and junk trends are ignored.
		expect(lowSpeed(175, 20)).toBe(false);
		expect(lowSpeed(175, 0 / 0)).toBe(false);
		expect(flightAdvice({ speed: 70, altitude: 400, incoming: false, acceleration: -32 })).toBe("LOW SPEED");
	});
	it("ranks terrain first, then stall, low speed, absolute altitude and the airspace edge", () => {
		expect(flightAdvice({ speed: 15, altitude: 50, incoming: false, terrainSeconds: 0.5, boundaryWarning: true })).toBe("PULL UP");
		expect(flightAdvice({ speed: 15, altitude: 50, incoming: false, boundaryWarning: true })).toBe("STALL");
		expect(flightAdvice({ speed: 18, altitude: 50, incoming: false, boundaryWarning: true })).toBe("LOW SPEED");
		expect(flightAdvice({ speed: 250, altitude: LOW_ALTITUDE - 1, incoming: false, boundaryWarning: true })).toBe("LOW ALTITUDE");
		expect(flightAdvice({ speed: 250, altitude: 300, incoming: false, boundaryWarning: true })).toBe("AIRSPACE LIMIT");
		expect(flightAdvice({ speed: 250, altitude: 300, incoming: false })).toBe("");
	});
	it("turns the 2 s forward probe into seconds to impact", () => {
		expect(TERRAIN_LOOKAHEAD).toBe(2);
		expect(terrainProbeLength(300)).toBe(600);
		expect(terrainProbeLength(40)).toBe(TERRAIN_MIN_PROBE);
		expect(terrainProbeLength(0 / 0)).toBe(TERRAIN_MIN_PROBE);
		expect(terrainSeconds(undefined, 300)).toBeUndefined();
		expect(terrainSeconds(300, 300)).toBe(1);
		expect(terrainSeconds(590, 300)).toBeLessThanOrEqual(2);
		// Beyond the lookahead (a slow jet's minimum probe) is not a warning yet.
		expect(terrainSeconds(150, 70)).toBeUndefined();
		expect(terrainSeconds(-5, 300)).toBe(0);
	});
});
