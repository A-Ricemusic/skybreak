import { describe, expect, it } from "@rbxts/jest-globals";
import { SalvoCandidate, SpecialWeapons } from "../shared/SpecialWeapons";
import { WeaponRules } from "../shared/WeaponRules";

function candidate(overrides: Partial<SalvoCandidate> = {}): SalvoCandidate {
	return { distance: 900, dot: 1, ground: false, required: true, allowed: true, current: false, ...overrides };
}

describe("SpecialWeapons catalog", () => {
	it("offers four specials in a fixed briefing order with a safe default", () => {
		expect(SpecialWeapons.Order).toEqual(["uav", "flares", "salvo", "lance"]);
		expect(SpecialWeapons.IsKind(SpecialWeapons.Default)).toBe(true);
		expect(SpecialWeapons.IsKind("uav")).toBe(true);
		expect(SpecialWeapons.IsKind("bombs")).toBe(false);
		expect(SpecialWeapons.IsKind(3)).toBe(false);
		expect(SpecialWeapons.All().size()).toBe(4);
		for (const definition of SpecialWeapons.All()) {
			expect(definition.charges).toBeGreaterThan(0);
			expect(definition.cooldown).toBeGreaterThan(0);
			expect(definition.short.size()).toBeLessThanOrEqual(4);
			expect(definition.description.size()).toBeLessThanOrEqual(100);
		}
	});
	it("cycles through every special and back to the first", () => {
		let kind = SpecialWeapons.Default;
		const seen = new Set<string>();
		for (let step = 0; step < 4; step++) { seen.add(kind); kind = SpecialWeapons.Next(kind); }
		expect(seen.size()).toBe(4);
		expect(kind).toBe(SpecialWeapons.Default);
	});
});

describe("SpecialWeapons charges and cooldowns", () => {
	it("spends a charge, starts the cooldown and refuses until it clears", () => {
		const state = SpecialWeapons.New("salvo");
		expect(state.charges).toBe(3);
		expect(SpecialWeapons.Activate(state, 2)).toEqual({ kind: "ok" });
		expect(state.charges).toBe(2);
		expect(state.cooldown).toBe(SpecialWeapons.Get("salvo").cooldown);
		expect(SpecialWeapons.Activate(state, 2)).toEqual({ kind: "denied", reason: "special_cooldown" });
		SpecialWeapons.Tick(state, state.cooldown + 0.01);
		expect(SpecialWeapons.Activate(state, 2)).toEqual({ kind: "ok" });
		SpecialWeapons.Tick(state, 10);
		expect(SpecialWeapons.Activate(state, 2)).toEqual({ kind: "ok" });
		SpecialWeapons.Tick(state, 10);
		expect(SpecialWeapons.Activate(state, 2)).toEqual({ kind: "denied", reason: "special_empty" });
		// Salvo charges never come back during the sortie.
		SpecialWeapons.Tick(state, 600);
		expect(state.charges).toBe(0);
	});
	it("refuses missiles without a target in the cone, before spending anything", () => {
		const salvo = SpecialWeapons.New("salvo");
		expect(SpecialWeapons.Activate(salvo, 0)).toEqual({ kind: "denied", reason: "special_no_target" });
		expect(salvo.charges).toBe(3);
		const lance = SpecialWeapons.New("lance");
		expect(SpecialWeapons.Activate(lance, 0)).toEqual({ kind: "denied", reason: "special_no_target" });
		expect(SpecialWeapons.Activate(lance, 0 / 0)).toEqual({ kind: "denied", reason: "special_no_target" });
		expect(SpecialWeapons.Activate(lance, 1)).toEqual({ kind: "ok" });
		// Support specials do not care about targets.
		expect(SpecialWeapons.Activate(SpecialWeapons.New("uav"), 0)).toEqual({ kind: "ok" });
		expect(SpecialWeapons.Activate(SpecialWeapons.New("flares"), 0)).toEqual({ kind: "ok" });
	});
	it("recharges flares one at a time up to the ceiling and ignores bad time steps", () => {
		const state = SpecialWeapons.New("flares");
		const definition = SpecialWeapons.Get("flares");
		expect(definition.rechargeSeconds).toBe(15);
		expect(SpecialWeapons.Activate(state, 1)).toEqual({ kind: "ok" });
		// The recharge clock runs from the first spent charge, through the second activation.
		SpecialWeapons.Tick(state, 2);
		expect(SpecialWeapons.Activate(state, 1)).toEqual({ kind: "ok" });
		expect(state.charges).toBe(1);
		SpecialWeapons.Tick(state, 12.99);
		expect(state.charges).toBe(1);
		SpecialWeapons.Tick(state, 0.02);
		expect(state.charges).toBe(2);
		SpecialWeapons.Tick(state, 15);
		expect(state.charges).toBe(3);
		SpecialWeapons.Tick(state, 100);
		expect(state.charges).toBe(3);
		expect(state.recharge).toBe(0);
		SpecialWeapons.Tick(state, 0 / 0);
		SpecialWeapons.Tick(state, -5);
		expect(state.charges).toBe(3);
	});
});

describe("SpecialWeapons recon drone", () => {
	it("flies for its duration, cannot be relaunched while up, and extends the lock envelope meanwhile", () => {
		const state = SpecialWeapons.New("uav");
		expect(SpecialWeapons.LockRange(state)).toBe(WeaponRules.LockRange);
		expect(SpecialWeapons.LockBuildSeconds(state)).toBe(WeaponRules.LockBuildSeconds);
		expect(SpecialWeapons.Activate(state, 0)).toEqual({ kind: "ok" });
		expect(state.active).toBe(20);
		expect(SpecialWeapons.LockRange(state)).toBeCloseTo(WeaponRules.LockRange * SpecialWeapons.UavRangeFactor, 6);
		expect(SpecialWeapons.LockBuildSeconds(state)).toBe(SpecialWeapons.UavLockBuildSeconds);
		expect(SpecialWeapons.UavLockBuildSeconds).toBeLessThan(WeaponRules.LockBuildSeconds);
		SpecialWeapons.Tick(state, 19.5);
		expect(state.active).toBeCloseTo(0.5, 6);
		expect(SpecialWeapons.Activate(state, 0)).toEqual({ kind: "denied", reason: "special_active" });
		SpecialWeapons.Tick(state, 0.5);
		expect(state.active).toBe(0);
		expect(SpecialWeapons.LockRange(state)).toBe(WeaponRules.LockRange);
		// The cooldown outlasts the flight, so there is a gap before the second drone.
		expect(SpecialWeapons.Activate(state, 0)).toEqual({ kind: "denied", reason: "special_cooldown" });
		SpecialWeapons.Tick(state, SpecialWeapons.Get("uav").cooldown);
		expect(SpecialWeapons.Activate(state, 0)).toEqual({ kind: "ok" });
		expect(state.charges).toBe(0);
	});
});

describe("SpecialWeapons flares", () => {
	it("always decoys a standard missile and decoys ace missiles by chance", () => {
		expect(SpecialWeapons.FlareChance(false)).toBe(1);
		expect(SpecialWeapons.FlareChance(true)).toBe(0.65);
		for (const roll of [0, 0.3, 0.64, 0.99]) expect(SpecialWeapons.FlareDecoys(roll, false)).toBe(true);
		expect(SpecialWeapons.FlareDecoys(0.64, true)).toBe(true);
		expect(SpecialWeapons.FlareDecoys(0.65, true)).toBe(false);
		expect(SpecialWeapons.FlareDecoys(0.9, true)).toBe(false);
		expect(SpecialWeapons.FlareDecoys(0 / 0, false)).toBe(false);
		// The cloud reaches well past the evade roll's 700-stud decoy radius.
		expect(SpecialWeapons.FlareDecoyRadius).toBe(1200);
		expect(SpecialWeapons.Get("flares").duration).toBe(2.5);
	});
});

describe("SpecialWeapons salvo targeting", () => {
	it("picks at most four distinct targets inside the lock cone, current target first", () => {
		const candidates = [
			candidate({ distance: 500 }),
			candidate({ distance: 1200, current: true }),
			candidate({ distance: 300, required: false }),
			candidate({ distance: 800 }),
			candidate({ distance: 900 }),
			candidate({ distance: 100, dot: WeaponRules.LockDot - 0.01 }),
			candidate({ distance: 100, allowed: false }),
			candidate({ distance: WeaponRules.LockRange + 1 }),
		];
		const picked = SpecialWeapons.SalvoTargets(candidates, WeaponRules.LockRange);
		expect(picked.size()).toBe(SpecialWeapons.SalvoMax);
		expect(picked[0]).toBe(1);
		// Required targets by distance, then the optional raider is squeezed out.
		expect(picked).toEqual([1, 0, 3, 4]);
	});
	it("lets ground targets use the wide ground cone and respects the extended range", () => {
		const ground = candidate({ distance: 2000, dot: WeaponRules.GroundLockDot + 0.01, ground: true });
		const air = candidate({ distance: 2000, dot: WeaponRules.GroundLockDot + 0.01, ground: false });
		expect(SpecialWeapons.SalvoTargets([ground, air], WeaponRules.LockRange)).toEqual([0]);
		const far = candidate({ distance: 3000, ground: true });
		expect(SpecialWeapons.SalvoTargets([far], WeaponRules.LockRange)).toEqual([]);
		expect(SpecialWeapons.SalvoTargets([far], 3300)).toEqual([0]);
		// Air targets use the shorter air envelope of the same (ground-scale) range.
		const farAir = candidate({ distance: 2000 });
		expect(SpecialWeapons.SalvoTargets([farAir], WeaponRules.LockRange)).toEqual([]);
		expect(SpecialWeapons.SalvoTargets([farAir], 3000)).toEqual([0]);
		expect(SpecialWeapons.SalvoTargets([], WeaponRules.LockRange)).toEqual([]);
		expect(SpecialWeapons.SalvoTargets([candidate({ distance: 0 / 0 })], WeaponRules.LockRange)).toEqual([]);
	});
});

describe("SpecialWeapons standard envelope", () => {
	it("keeps the standard missile's range with the lance equipped; only an active drone extends it", () => {
		expect(SpecialWeapons.StandardLockRange(SpecialWeapons.New("lance"))).toBe(WeaponRules.LockRange);
		expect(SpecialWeapons.StandardLockRange(SpecialWeapons.New("salvo"))).toBe(WeaponRules.LockRange);
		const drone = SpecialWeapons.New("uav");
		expect(SpecialWeapons.StandardLockRange(drone)).toBe(WeaponRules.LockRange);
		expect(SpecialWeapons.Activate(drone, 1).kind).toBe("ok");
		expect(SpecialWeapons.StandardLockRange(drone)).toBeCloseTo(WeaponRules.LockRange * SpecialWeapons.UavRangeFactor, 6);
	});
});

describe("SpecialWeapons lance", () => {
	it("locks far beyond the standard envelope and hits twice as hard", () => {
		const state = SpecialWeapons.New("lance");
		expect(SpecialWeapons.LockRange(state)).toBe(SpecialWeapons.LanceRange);
		expect(SpecialWeapons.LanceRange).toBeGreaterThan(WeaponRules.LockRange * 1.5);
		expect(SpecialWeapons.MissileDamage("lance")).toBe(110);
		expect(SpecialWeapons.MissileDamage("salvo")).toBe(SpecialWeapons.StandardDamage);
		expect(SpecialWeapons.MissileSpeed("lance")).toBeGreaterThan(WeaponRules.MissileSpeed);
		expect(SpecialWeapons.MissileSpeed("salvo")).toBe(WeaponRules.MissileSpeed);
		// The standard launch decision honours the extended range when it is handed one.
		const far = { missiles: 8, missileCooldown: 0, hasTarget: true, lockProgress: 1, distance: 3500, dot: 1 };
		expect(WeaponRules.Launch(far).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...far, lockRange: SpecialWeapons.LanceRange }).kind).toBe("guided");
	});
});

describe("SpecialWeapons HUD button", () => {
	it("shows the short name with charges, the cooldown, the active timer, or an empty slot", () => {
		expect(SpecialWeapons.Button("uav", 2, 0, 0)).toEqual({ text: "UAV 2", filled: false, enabled: true, dimmed: false });
		expect(SpecialWeapons.Button("uav", 1, 24.3, 18.2)).toEqual({ text: "UAV 19", filled: true, enabled: true, dimmed: false });
		expect(SpecialWeapons.Button("salvo", 2, 3.26, 0)).toEqual({ text: "3.3", filled: false, enabled: true, dimmed: true });
		expect(SpecialWeapons.Button("flares", 0, 0, 0)).toEqual({ text: "FLR 0", filled: false, enabled: true, dimmed: true });
		expect(SpecialWeapons.Button("lance", 0 / 0, 0, 0).text).toBe("XLAA 0");
	});
});
