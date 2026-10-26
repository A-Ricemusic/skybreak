import { describe, expect, it } from "@rbxts/jest-globals";
import { ThreatRules } from "../shared/ThreatRules";

// Pure threat contracts; the same file runs in the offline Luau VM (toBe/toBeUndefined only).
describe("Enemy fire gate", () => {
	const open = { separation: 900, aimDot: 0.9, fireTimer: 0, globalReady: true, evading: false, playerStraight: false, minRange: 450, maxRange: 1700, aimThreshold: 0.65, straightRelax: 0.2 };
	it("fires inside the envelope with a reload done and the flight gate open", () => {
		expect(ThreatRules.MayFire(open)).toBe(true);
	});
	it("holds fire while the player is evading, the shooter is reloading, or the flight gate is closed", () => {
		expect(ThreatRules.MayFire({ ...open, evading: true })).toBe(false);
		expect(ThreatRules.MayFire({ ...open, fireTimer: 0.1 })).toBe(false);
		expect(ThreatRules.MayFire({ ...open, globalReady: false })).toBe(false);
	});
	it("respects the per-act launch range on both ends", () => {
		expect(ThreatRules.MayFire({ ...open, separation: 450 })).toBe(false);
		expect(ThreatRules.MayFire({ ...open, separation: 451 })).toBe(true);
		expect(ThreatRules.MayFire({ ...open, separation: 1700 })).toBe(false);
		expect(ThreatRules.MayFire({ ...open, separation: 1699 })).toBe(true);
	});
	it("relaxes the aim requirement only while the player flies straight", () => {
		expect(ThreatRules.MayFire({ ...open, aimDot: 0.5 })).toBe(false);
		expect(ThreatRules.MayFire({ ...open, aimDot: 0.5, playerStraight: true })).toBe(true);
		expect(ThreatRules.MayFire({ ...open, aimDot: 0.44, playerStraight: true })).toBe(false);
	});
	it("treats a centered stick as flying straight", () => {
		expect(ThreatRules.PlayerStraight(0, 0)).toBe(true);
		expect(ThreatRules.PlayerStraight(0.2, -0.2)).toBe(true);
		expect(ThreatRules.PlayerStraight(0.3, 0)).toBe(false);
		expect(ThreatRules.PlayerStraight(0, -0.6)).toBe(false);
	});
});
describe("Bandit defensive break", () => {
	const ready = { inbound: true, cooldownRemaining: 0, extending: false, roll: 0.1, chance: 0.4 };
	it("breaks when a missile is inbound, the roll beats the act chance and the bandit is free to maneuver", () => {
		expect(ThreatRules.ShouldBreak(ready)).toBe(true);
	});
	it("never breaks without an inbound missile, mid maneuver, on cooldown, or when the roll fails", () => {
		expect(ThreatRules.ShouldBreak({ ...ready, inbound: false })).toBe(false);
		expect(ThreatRules.ShouldBreak({ ...ready, extending: true })).toBe(false);
		expect(ThreatRules.ShouldBreak({ ...ready, cooldownRemaining: 0.5 })).toBe(false);
		expect(ThreatRules.ShouldBreak({ ...ready, roll: 0.4 })).toBe(false);
		expect(ThreatRules.ShouldBreak({ ...ready, roll: 0.9, chance: 0 })).toBe(false);
	});
	it("detects only player missiles guided onto this enemy inside the inbound range", () => {
		const me = { id: "me" }, other = { id: "other" };
		const missiles = [
			{ target: other, distance: 100 },
			{ target: me, distance: ThreatRules.InboundRange + 1 },
			{ target: undefined, distance: 50 },
		];
		const targetOf = (missile: { target?: { id: string }; distance: number }) => missile.target;
		const distanceTo = (missile: { target?: { id: string }; distance: number }) => missile.distance;
		expect(ThreatRules.Inbound(me, missiles, targetOf, distanceTo)).toBe(false);
		missiles.push({ target: me, distance: ThreatRules.InboundRange });
		expect(ThreatRules.Inbound(me, missiles, targetOf, distanceTo)).toBe(true);
	});
	it("breaks to the bracket side and dives", () => {
		const pass = ThreatRules.BreakDirection({ x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, -1);
		expect(pass.x > 0.8).toBe(true);
		expect(pass.y < -0.3).toBe(true);
		expect(math.abs(math.sqrt(pass.x * pass.x + pass.y * pass.y + pass.z * pass.z) - 1) < 1e-6).toBe(true);
		const mirrored = ThreatRules.BreakDirection({ x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, 1);
		expect(mirrored.x < -0.8).toBe(true);
	});
	it("drops the seeker only when a breaking target starts opening range beyond the fuse", () => {
		expect(ThreatRules.LosesTrack({ breaking: true, distance: 120, previousDistance: 100, fuseRadius: 36 })).toBe(true);
		expect(ThreatRules.LosesTrack({ breaking: false, distance: 120, previousDistance: 100, fuseRadius: 36 })).toBe(false);
		expect(ThreatRules.LosesTrack({ breaking: true, distance: 90, previousDistance: 100, fuseRadius: 36 })).toBe(false);
		// Still inside two fuse radii: the proximity fuse gets its chance first.
		expect(ThreatRules.LosesTrack({ breaking: true, distance: 70, previousDistance: 60, fuseRadius: 36 })).toBe(false);
		// A fresh shot from far out never counts as an overshoot, whatever the bandit is doing.
		expect(ThreatRules.LosesTrack({ breaking: true, distance: 1210, previousDistance: 1200, fuseRadius: 36 })).toBe(false);
	});
});
describe("Ace pressure", () => {
	it("shortens the lock-break cadence below a third of health", () => {
		expect(ThreatRules.AceLockBreakInterval(5, 1)).toBe(5);
		expect(ThreatRules.AceLockBreakInterval(5, 0.34)).toBe(5);
		expect(ThreatRules.AceLockBreakInterval(5, 1 / 3)).toBe(3);
		expect(ThreatRules.AceLockBreakInterval(5, 0.1)).toBe(3);
	});
	it("scales catalog ace health by act and never below the catalog value", () => {
		expect(ThreatRules.ScaledHealth(165, 1)).toBe(165);
		expect(ThreatRules.ScaledHealth(220, 1.15)).toBe(253);
		expect(ThreatRules.ScaledHealth(320, 1.3)).toBe(416);
		expect(ThreatRules.ScaledHealth(165, 0.5)).toBe(165);
	});
	it("fans a second salvo missile off the first and leaves a single shot untouched", () => {
		const forward = { x: 0, y: 0, z: 1 }, right = { x: 1, y: 0, z: 0 };
		expect(ThreatRules.SalvoDirection(forward, right, 0, 1)).toBe(forward);
		expect(ThreatRules.SalvoDirection(forward, right, 0, 2)).toBe(forward);
		const second = ThreatRules.SalvoDirection(forward, right, 1, 2);
		expect(second.x > 0.1).toBe(true);
		expect(second.z < 1).toBe(true);
		expect(math.abs(math.sqrt(second.x * second.x + second.y * second.y + second.z * second.z) - 1) < 1e-6).toBe(true);
	});
});
