import { describe, expect, it } from "@rbxts/jest-globals";
import { EVADE_MAX_CHARGES, EVADE_RECHARGE_SECONDS, evadeGauge } from "../shared/EvadeGauge";
import { EvadeRules } from "../shared/EvadeRules";

describe("EVADE charges, ring and flash", () => {
	it("reads the server's charges: ready with a charge in hand and no roll running", () => {
		expect(EVADE_MAX_CHARGES).toBe(3);
		expect(EVADE_RECHARGE_SECONDS).toBe(EvadeRules.RechargeSeconds);
		const full = evadeGauge({ evadeCharges: 3, evadeCooldown: 0, incoming: false });
		expect(full.ready).toBe(true);
		expect(full.charges).toBe(3);
		expect(full.maxCharges).toBe(3);
		expect(full.recharge).toBe(1);
		expect(full.label).toBe("EVADE");
		// The server reports cooldown 0 while a charge is in hand (EvadeRules.Cooldown).
		const two = evadeGauge({ evadeCharges: 2, evadeCooldown: 0, incoming: false });
		expect(two.ready).toBe(true);
		expect(two.charges).toBe(2);
		// During a roll the server reports the roll's remaining time and refuses another press.
		const rolling = evadeGauge({ evadeCharges: 2, evadeCooldown: 1.2, incoming: true });
		expect(rolling.ready).toBe(false);
		expect(rolling.flash).toBe(false);
		// With none in hand the cooldown is the time to the next charge.
		const empty = evadeGauge({ evadeCharges: 0, evadeCooldown: 3.2, incoming: true });
		expect(empty.ready).toBe(false);
		expect(empty.flash).toBe(false);
		expect(empty.label).toBe("4");
		expect(empty.recharge).toBeCloseTo(1 - 3.2 / EvadeRules.RechargeSeconds, 5);
	});
	it("flashes only for authoritative decoy timing with a charge ready", () => {
		expect(evadeGauge({ evadeCharges: 1, evadeCooldown: 0, incoming: true, evadeThreat: true }).flash).toBe(true);
		expect(evadeGauge({ evadeCharges: 1, evadeCooldown: 0, incoming: false }).flash).toBe(false);
	});
	it("degrades to one charge gated by the cooldown when the server sends no charges", () => {
		const ready = evadeGauge({ evadeCooldown: 0, incoming: true });
		expect(ready.maxCharges).toBe(1);
		expect(ready.charges).toBe(1);
		expect(ready.ready).toBe(true);
		expect(ready.flash).toBe(false);
		const cooling = evadeGauge({ evadeCooldown: 3, incoming: true });
		expect(cooling.ready).toBe(false);
		expect(cooling.charges).toBe(0);
		expect(cooling.recharge).toBeCloseTo(0.5, 5);
		expect(cooling.label).toBe("3");
	});
	it("clamps junk from the wire", () => {
		const junk = evadeGauge({ evadeCharges: 99, evadeCooldown: -4, incoming: false });
		expect(junk.charges).toBe(3);
		expect(junk.cooldown).toBe(0);
		const nan = evadeGauge({ evadeCharges: 0 / 0, evadeCooldown: 0 / 0, incoming: false });
		expect(nan.maxCharges).toBe(1);
		expect(nan.ready).toBe(true);
	});
});

describe("EVADE timing advice", () => {
	it("does not promote a distant inbound missile, but does promote both decoy paths", () => {
		const gauge = (distance: number, life: number) => evadeGauge({
			evadeCooldown: 0, evadeCharges: 3, incoming: distance < 1800,
			evadeThreat: EvadeRules.Decoys(distance, life),
		});
		expect(gauge(1799, 6).flash).toBe(false);
		expect(gauge(451, 1.21).flash).toBe(false);
		expect(gauge(450, 6).flash).toBe(true);
		expect(gauge(1801, 1.2).flash).toBe(true);
		// Older telemetry supplies no timing evidence: keep the control usable without urging a press.
		const legacy = evadeGauge({ evadeCooldown: 0, incoming: true });
		expect(legacy.ready).toBe(true);
		expect(legacy.flash).toBe(false);
		expect(evadeGauge({ evadeCooldown: 0, evadeCharges: 0, incoming: true, evadeThreat: true }).flash).toBe(false);
		expect(evadeGauge({ evadeCooldown: 1, evadeCharges: 2, incoming: true, evadeThreat: true }).flash).toBe(false);
	});
});
