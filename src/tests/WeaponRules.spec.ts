import { describe, expect, it } from "@rbxts/jest-globals";
import { WeaponRules } from "../shared/WeaponRules";

interface Candidate { position: { x: number; y: number; z: number }; allowed: boolean }
function candidate(x: number, y: number, z: number, allowed = true): Candidate { return { position: { x, y, z }, allowed }; }
function fuse(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, candidates: Candidate[]): number | undefined {
	return WeaponRules.Fuse(from, to, candidates, (c) => c.position, (c) => c.allowed);
}
const launchReady = { missiles: 8, missileCooldown: 0, hasTarget: true, lockProgress: 1, distance: 900, dot: 1 };

describe("WeaponRules action gate", () => {
	it("accepts a FIRE right after a TGT tap because kinds are limited independently", () => {
		const gate = WeaponRules.NewActionGate();
		expect(WeaponRules.AcceptAction(gate, "CycleTarget", 10)).toBe(true);
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10.02)).toBe(true);
		expect(WeaponRules.AcceptAction(gate, "Evade", 10.03)).toBe(true);
	});
	it("drops a duplicate of the same kind inside the window without extending it", () => {
		const gate = WeaponRules.NewActionGate();
		const w = WeaponRules.ActionWindow;
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10)).toBe(true);
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10.01)).toBe(false);
		// One window after the accepted press (with float margin), not after the dropped duplicate.
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10 + w + 0.001)).toBe(true);
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10 + w + 0.001 + w * 0.9)).toBe(false);
		expect(WeaponRules.AcceptAction(gate, "FireMissile", 10 + 2 * (w + 0.001))).toBe(true);
	});
	it("rejects a non-finite clock and unknown action names", () => {
		const gate = WeaponRules.NewActionGate();
		expect(WeaponRules.AcceptAction(gate, "Evade", 0 / 0)).toBe(false);
		expect(WeaponRules.AcceptAction(gate, "Evade", math.huge)).toBe(false);
		expect(WeaponRules.AcceptAction(gate, "Evade", 1)).toBe(true);
		expect(WeaponRules.IsActionKind("FireMissile")).toBe(true);
		expect(WeaponRules.IsActionKind("Ready")).toBe(false);
		expect(WeaponRules.IsActionKind(5)).toBe(false);
	});
});

describe("WeaponRules launch decision", () => {
	it("is guided only with a full lock inside the envelope, otherwise blind", () => {
		expect(WeaponRules.Launch(launchReady).kind).toBe("guided");
		expect(WeaponRules.Launch({ ...launchReady, lockProgress: 0.98 }).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...launchReady, hasTarget: false }).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...launchReady, distance: WeaponRules.LockRange + 1 }).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...launchReady, dot: WeaponRules.LockDot - 0.01 }).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...launchReady, distance: WeaponRules.LockRange, dot: WeaponRules.LockDot }).kind).toBe("guided");
		// Ground targets lock through the wider cone; a protected target never gets a guided shot.
		expect(WeaponRules.Launch({ ...launchReady, dot: WeaponRules.GroundLockDot + 0.01, groundTarget: true }).kind).toBe("guided");
		expect(WeaponRules.Launch({ ...launchReady, dot: WeaponRules.GroundLockDot + 0.01, groundTarget: false }).kind).toBe("blind");
		expect(WeaponRules.Launch({ ...launchReady, canDamage: false }).kind).toBe("blind");
	});
	it("refuses with a reason only for ammo and cooldown, ammo first", () => {
		const empty = WeaponRules.Launch({ ...launchReady, missiles: 0 });
		expect(empty.kind).toBe("denied");
		expect(empty.kind === "denied" && empty.reason).toBe("no_ammo");
		const cooling = WeaponRules.Launch({ ...launchReady, missileCooldown: 0.4 });
		expect(cooling.kind === "denied" && cooling.reason).toBe("cooldown");
		const both = WeaponRules.Launch({ ...launchReady, missiles: 0, missileCooldown: 0.4 });
		expect(both.kind === "denied" && both.reason).toBe("no_ammo");
		expect(WeaponRules.Launch({ ...launchReady, missiles: 0 / 0 }).kind).toBe("denied");
		// A blind shot never needs a target: nothing is refused for "no target".
		expect(WeaponRules.Launch({ ...launchReady, hasTarget: false, lockProgress: 0, distance: 0 / 0, dot: 0 / 0 }).kind).toBe("blind");
	});
});

describe("WeaponRules proximity fuse", () => {
	const from = { x: 0, y: 250, z: 0 };
	const to = { x: 0, y: 250, z: -25 };
	it("detonates on an allowed enemy the sweep passes within 36 studs of, including mid-segment", () => {
		expect(fuse(from, to, [candidate(35, 250, -12)])).toBe(0);
		expect(fuse(from, to, [candidate(0, 250 + 36, -12)])).toBe(0);
		expect(fuse(from, to, [candidate(0, 250, -60)])).toBe(0);
		expect(fuse(from, to, [candidate(0, 250, -61.1)])).toBeUndefined();
		expect(fuse(from, to, [candidate(36.1, 250, -12)])).toBeUndefined();
	});
	it("ignores enemies the phase does not allow and picks the closest allowed one", () => {
		const protectedRadar = candidate(5, 250, -10, false);
		const far = candidate(20, 250, -10);
		const near = candidate(8, 250, -14);
		expect(fuse(from, to, [protectedRadar])).toBeUndefined();
		expect(fuse(from, to, [protectedRadar, far, near])).toBe(2);
		expect(fuse(from, to, [])).toBeUndefined();
	});
	it("handles a zero-length sweep and exposes the tuning constants the server uses", () => {
		expect(WeaponRules.SegmentDistance({ x: 3, y: 4, z: 0 }, from, from)).toBeCloseTo(math.sqrt(9 + 246 * 246), 6);
		expect(fuse(from, from, [candidate(0, 250, -30)])).toBe(0);
		expect(WeaponRules.FuseRadius).toBe(36);
		expect(WeaponRules.UnguidedLifetime).toBe(5);
		expect(WeaponRules.MissileSpeed).toBe(750);
	});
});

describe("WeaponRules FIRE button state", () => {
	it("reports EMPTY, cooldown seconds, lock progress and a filled FIRE when locked", () => {
		expect(WeaponRules.FireButton(0, 0, true, 1)).toEqual({ text: "EMPTY", filled: false, enabled: true, dimmed: true });
		expect(WeaponRules.FireButton(3, 0.84, true, 1)).toEqual({ text: "0.8", filled: false, enabled: true, dimmed: true });
		expect(WeaponRules.FireButton(3, 0, true, 0.6)).toEqual({ text: "LOCK 60%", filled: false, enabled: true, dimmed: true });
		expect(WeaponRules.FireButton(3, 0, true, 0.99)).toEqual({ text: "FIRE", filled: true, enabled: true, dimmed: false });
	});
	it("stays an enabled, unfilled FIRE (blind shot) without a target or lock", () => {
		expect(WeaponRules.FireButton(3, 0, false, 1)).toEqual({ text: "FIRE", filled: false, enabled: true, dimmed: false });
		expect(WeaponRules.FireButton(3, 0, true, 0)).toEqual({ text: "FIRE", filled: false, enabled: true, dimmed: false });
		expect(WeaponRules.FireButton(3, 0, true, 0 / 0)).toEqual({ text: "FIRE", filled: false, enabled: true, dimmed: false });
		expect(WeaponRules.FireButton(0 / 0, 0, true, 1).text).toBe("EMPTY");
	});
});
