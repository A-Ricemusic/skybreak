import { FlightMath, FlightState } from "../shared/FlightMath";
import { evadeGauge } from "../shared/EvadeGauge";
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
	it("recharges one charge every 10 s, never past three", () => {
		const state = EvadeRules.New();
		EvadeRules.Use(state, false); EvadeRules.Use(state, false); EvadeRules.Use(state, false);
		for (let index = 0; index < 99; index++) EvadeRules.Tick(state, 0.1);
		expect(state.charges).toBe(0);
		EvadeRules.Tick(state, 0.11);
		expect(state.charges).toBe(1);
		EvadeRules.Tick(state, 10);
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
	it("decoys only missiles inside 450 studs or in their last 1.2 s of flight", () => {
		expect(EvadeRules.Decoys(450, 5)).toBe(true);
		expect(EvadeRules.Decoys(451, 5)).toBe(false);
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
		expect(outcome(1.9)).toBe(true); // ~600 studs out: it enters 450 inside the window
		expect(outcome(2.4)).toBe(true); // ~225 studs out: decoyed on the press
	});
});

describe("Current-speed EVADE timing regression", () => {
	it("avoids the old early-charge waste and measures delayed responses in head-on closure probes", () => {
		// Straight, level head-on kinematics only: FlightMath jet plus constant-speed missile.
		// All difficulties share these act speeds/lifetimes/fuses; their steering/damage differ.
		// This does not simulate guidance, other enemies, a human reaction or network transport.
		const run = (speed: number, act: number, dt: number, delay: number, old: boolean): boolean => {
			const jet: FlightState = { x: 0, y: 500, z: 0, qw: 1, qx: 0, qy: 0, qz: 0, lean: 0, yaw: 0, pitch: 0, roll: 0, speed };
			const input = { x: 0, y: 0, throttle: FlightMath.ThrottleForSpeed(speed) };
			const state = EvadeRules.New();
			let missileZ = -1799, pressAt: number | undefined, pressed = false, nextTelemetry = 0;
			for (let time = 0; time < 10; time += dt) {
				const range = math.abs(missileZ - jet.z);
				if (range <= [32, 40, 48][act]) return false;
				if (time + 1e-6 >= nextTelemetry) {
					nextTelemetry += 0.1;
					const advice = evadeGauge({ incoming: range < 1800, evadeCharges: state.charges, evadeCooldown: 0, evadeThreat: EvadeRules.Decoys(range, [7, 8, 9][act] - time) });
					if (pressAt === undefined && (old ? range < 1800 : advice.flash)) pressAt = time + delay;
				}
				if (!pressed && pressAt !== undefined && time + 1e-6 >= pressAt) { EvadeRules.Use(state, false); pressed = true; }
				if (EvadeRules.Open(state) && EvadeRules.Decoys(range, [7, 8, 9][act] - time)) return true;
				EvadeRules.Tick(state, dt);
				FlightMath.Step(jet, input, dt);
				missileZ += [580, 660, 740][act] * dt;
			}
			return false;
		};
		for (const delay of [0, 0.15, 0.3, 0.6]) {
			let saved = 0, samples = 0;
			for (const speed of [160, 320, 450, 600]) for (const act of [0, 1, 2]) for (const dt of [1 / 30, 1 / 60]) {
				expect(run(speed, act, dt, 0, true)).toBe(false);
				const decoyed = run(speed, act, dt, delay, false);
				if (delay === 0) expect(decoyed).toBe(true);
				if (decoyed) saved++;
				samples++;
			}
			print(`EVADE_CLOSURE delay=${delay} decoyed=${saved}/${samples}`);
			// Pin the bounds, not a claim that any delay is universally safe.
			if (delay === 0.6) expect(saved).toBe(0);
		}
	});
});
