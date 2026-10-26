import { describe, expect, it } from "@rbxts/jest-globals";
import { EvadeRules } from "../shared/EvadeRules";

// Pure evade contracts; also run in the offline Luau VM (toBe/toBeUndefined only).
describe("Evade charges", () => {
	it("starts with three charges and spends one per accepted press", () => {
		const state = EvadeRules.New();
		expect(state.charges).toBe(3);
		expect(EvadeRules.Cooldown(state, 0)).toBe(0);
		expect(EvadeRules.Use(state, false)).toBe(true);
		expect(state.charges).toBe(2);
		expect(EvadeRules.Open(state)).toBe(true);
	});
	it("refuses a press while the roll is still running or with no charge left", () => {
		const state = EvadeRules.New();
		expect(EvadeRules.Use(state, true)).toBe(false);
		expect(state.charges).toBe(3);
		for (let index = 0; index < 3; index++) expect(EvadeRules.Use(state, false)).toBe(true);
		expect(state.charges).toBe(0);
		expect(EvadeRules.Use(state, false)).toBe(false);
		// With nothing in hand the HUD counts down to the next charge; during a roll it shows the roll.
		expect(EvadeRules.Cooldown(state, 0)).toBe(EvadeRules.RechargeSeconds);
		expect(EvadeRules.Cooldown(state, 1.2)).toBe(1.2);
	});
	it("recharges one charge every 12 s, never past three", () => {
		const state = EvadeRules.New();
		EvadeRules.Use(state, false); EvadeRules.Use(state, false); EvadeRules.Use(state, false);
		for (let index = 0; index < 119; index++) EvadeRules.Tick(state, 0.1);
		expect(state.charges).toBe(0);
		EvadeRules.Tick(state, 0.11);
		expect(state.charges).toBe(1);
		EvadeRules.Tick(state, 12);
		expect(state.charges).toBe(2);
		EvadeRules.Tick(state, 100);
		expect(state.charges).toBe(3);
		expect(state.recharge).toBe(0);
		EvadeRules.Tick(state, 0 / 0);
		expect(state.charges).toBe(3);
	});
	it("closes the decoy window 0.6 s after the press", () => {
		const state = EvadeRules.New();
		EvadeRules.Use(state, false);
		EvadeRules.Tick(state, 0.5);
		expect(EvadeRules.Open(state)).toBe(true);
		EvadeRules.Tick(state, 0.11);
		expect(EvadeRules.Open(state)).toBe(false);
	});
	it("decoys only missiles inside 350 studs or in their last 1.2 s of flight", () => {
		expect(EvadeRules.Decoys(350, 5)).toBe(true);
		expect(EvadeRules.Decoys(351, 5)).toBe(false);
		expect(EvadeRules.Decoys(1500, 1.2)).toBe(true);
		expect(EvadeRules.Decoys(1500, 1.3)).toBe(false);
		expect(EvadeRules.Decoys(0 / 0, 5)).toBe(false);
	});
	it("makes timing the skill: an early press wastes the charge, a late one saves the hull", () => {
		// A missile closing at 740 studs/s (Act III) from 2000 studs, pressed at three moments.
		const closing = 740;
		const outcome = (pressAt: number): boolean => {
			const state = EvadeRules.New();
			let distance = 2000;
			let decoyed = false;
			for (let t = 0; t < 4 && distance > 0; t += 1 / 30) {
				if (math.abs(t - pressAt) < 1 / 60) EvadeRules.Use(state, false);
				if (EvadeRules.Open(state) && EvadeRules.Decoys(distance, 9 - t)) { decoyed = true; break; }
				EvadeRules.Tick(state, 1 / 30);
				distance -= closing / 30;
			}
			return decoyed;
		};
		expect(outcome(0.2)).toBe(false); // 1850 studs out: window closes long before it arrives
		expect(outcome(1.9)).toBe(true); // ~600 studs out: it enters 350 inside the window
		expect(outcome(2.4)).toBe(true); // ~225 studs out: decoyed on the press
	});
});
