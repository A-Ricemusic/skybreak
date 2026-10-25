import { describe, expect, it } from "@rbxts/jest-globals";
import { flightWarning } from "../shared/FlightWarnings";

describe("flight and combat warnings shared by touch, keyboard and gamepad", () => {
	it("retains incoming and lock threats alongside each flight warning", () => {
		for (const [speed, altitude, label] of [[230, 80, "LOW ALTITUDE"], [150, 250, "LOW SPEED"], [100, 250, "STALL"]] as Array<[number, number, string]>) {
			expect(flightWarning({ speed, altitude, incoming: true, lockWarning: true })).toBe(`MISSILE INBOUND · ${label}`);
			expect(flightWarning({ speed, altitude, incoming: false, lockWarning: true })).toBe(`MISSILE LOCK · ${label}`);
		}
	});
	it("gives recovery advice when stalled without a combat threat", () => {
		expect(flightWarning({ speed: 100, altitude: 250, incoming: false, lockWarning: false })).toBe("STALL · ACCELERATE + NOSE DOWN");
		expect(flightWarning({ speed: 230, altitude: 250, incoming: false, lockWarning: false })).toBe("");
	});
});
