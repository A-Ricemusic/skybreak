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
// Round 2: flight-wide fire control that scales with the number of live hostiles.
interface Cadence { launches: number; peakThreats: number; minSpacing: number }
/** Pure model of CombatService's bandit fire control: every bandit always in the envelope and aimed. */
function simulate(bandits: number, gateBase: number, maxDivisor: number, maxCap: number, reload: number, windup: number, flight: number, seconds = 60): Cadence {
	const dt = 1 / 30;
	const fire: number[] = [], lit: number[] = [];
	for (let index = 0; index < bandits; index++) { fire.push(4 + index * 1.5); lit.push(0); }
	const missiles: number[] = [];
	let lastWindup = -math.huge, launches = 0, peak = 0, minSpacing = math.huge;
	for (let t = 0; t < seconds; t += dt) {
		for (let index = missiles.size() - 1; index >= 0; index--) { missiles[index] -= dt; if (missiles[index] <= 0) missiles.remove(index); }
		let threats = missiles.size();
		for (const value of lit) if (value > 0) threats += 1;
		const gate = ThreatRules.FlightGate(gateBase, bandits, maxDivisor);
		const cap = ThreatRules.ThreatCap(bandits, maxCap);
		let ready = ThreatRules.FlightReady({ sinceLastWindup: t - lastWindup, gate, threats, cap });
		for (let index = 0; index < bandits; index++) {
			fire[index] = math.max(0, fire[index] - dt);
			if (lit[index] > 0) {
				lit[index] -= dt;
				if (lit[index] <= 0) { missiles.push(flight); launches += 1; fire[index] = reload; }
			} else if (ready && ThreatRules.MayFire({ separation: 1000, aimDot: 1, fireTimer: fire[index], globalReady: true, evading: false, playerStraight: false, minRange: 350, maxRange: 2100, aimThreshold: 0.45, straightRelax: 0.3 })) {
				lit[index] = windup;
				minSpacing = math.min(minSpacing, t - lastWindup);
				lastWindup = t; threats += 1; ready = false;
			}
		}
		peak = math.max(peak, threats);
	}
	return { launches, peakThreats: peak, minSpacing };
}
describe("Flight fire control scales with live hostiles", () => {
	it("divides the gate by +50% per extra hostile, capped, and never below 1.5 s", () => {
		expect(ThreatRules.FlightDivisor(1, 3)).toBe(1);
		expect(ThreatRules.FlightDivisor(3, 3)).toBe(2);
		expect(ThreatRules.FlightDivisor(5, 3)).toBe(3);
		expect(ThreatRules.FlightDivisor(9, 3)).toBe(3);
		expect(ThreatRules.FlightDivisor(0, 3)).toBe(1);
		expect(ThreatRules.FlightGate(12, 5, 3)).toBe(4);
		expect(ThreatRules.FlightGate(12, 5, 3, true)).toBe(2);
		expect(ThreatRules.FlightGate(2, 5, 3, true)).toBe(ThreatRules.GlobalSpacing);
		expect(ThreatRules.ThreatCap(1, 3)).toBe(1);
		expect(ThreatRules.ThreatCap(5, 3)).toBe(3);
		expect(ThreatRules.ThreatCap(5, 1)).toBe(1);
	});
	it("Act III: five bandits launch close to three times as often as one, never closer than 1.5 s", () => {
		const one = simulate(1, 12, 3, 3, 5.5, 1.7, 2.5);
		const five = simulate(5, 12, 3, 3, 5.5, 1.7, 2.5);
		expect(one.launches >= 4 && one.launches <= 6).toBe(true);
		expect(five.launches >= one.launches * 2.5).toBe(true);
		expect(five.launches <= 60 / ThreatRules.GlobalSpacing).toBe(true);
		expect(five.minSpacing >= ThreatRules.GlobalSpacing - 1e-6).toBe(true);
		expect(five.peakThreats <= 3).toBe(true);
	});
	it("keeps the opening sorties gentle: one threat in the air at a time, whatever the count", () => {
		const gentle = simulate(3, 14, 1.5, 1, 10, 2.4, 3);
		expect(gentle.peakThreats).toBe(1);
		expect(gentle.launches <= 7).toBe(true);
	});
});
describe("Bandit lock breaks, flares and extensions", () => {
	const close = { lockProgress: 0.85, distance: 800, cooldownRemaining: 0, extending: false, roll: 0.2, chance: 1 };
	it("breaks a lock building past 80% inside 900 studs", () => {
		expect(ThreatRules.ShouldLockBreak(close)).toBe(true);
		expect(ThreatRules.ShouldLockBreak({ ...close, lockProgress: 0.8 })).toBe(false);
		expect(ThreatRules.ShouldLockBreak({ ...close, distance: 900 })).toBe(false);
		expect(ThreatRules.ShouldLockBreak({ ...close, cooldownRemaining: 1 })).toBe(false);
		expect(ThreatRules.ShouldLockBreak({ ...close, extending: true })).toBe(false);
		expect(ThreatRules.ShouldLockBreak({ ...close, chance: 0 })).toBe(false);
		expect(ThreatRules.BreakCooldown).toBe(12);
	});
	it("pops a flare against a missile inside 260 studs, then decoys everything near it for 2.5 s", () => {
		expect(ThreatRules.ShouldFlare(250, 1, 0)).toBe(true);
		expect(ThreatRules.ShouldFlare(270, 1, 0)).toBe(false);
		expect(ThreatRules.ShouldFlare(250, 0, 0)).toBe(false);
		expect(ThreatRules.ShouldFlare(250, 2, 1)).toBe(false);
		expect(ThreatRules.FlareDecoys(200, 12.5, 10)).toBe(true);
		expect(ThreatRules.FlareDecoys(200, 12.5, 12.5)).toBe(false);
		expect(ThreatRules.FlareDecoys(300, 12.5, 10)).toBe(false);
		expect(ThreatRules.FlareSeconds).toBe(2.5);
	});
	it("slows an extending bandit below the player so a turn back in gets a rear shot", () => {
		expect(ThreatRules.ExtendSpeed(255, 180)).toBe(245);
		expect(ThreatRules.ExtendSpeed(150, 180)).toBe(180);
	});
	it("keeps a fair range through the windup: the ace always, a bandit after a held shot, only on the tail", () => {
		expect(ThreatRules.KeepsRange(true, false)).toBe(true);
		expect(ThreatRules.KeepsRange(false, true)).toBe(true);
		expect(ThreatRules.KeepsRange(false, false)).toBe(false);
		expect(ThreatRules.HoldsStandoff(-0.9, 700, 600)).toBe(true);
		expect(ThreatRules.HoldsStandoff(0.2, 700, 600)).toBe(false);
		expect(ThreatRules.HoldsStandoff(-0.9, 1100, 600)).toBe(false);
		// Falls back while inside the range (never slower than 180), closes while beyond it, never above cruise.
		expect(ThreatRules.StandoffSpeed(500, 600, 255, 330)).toBe(195);
		expect(ThreatRules.StandoffSpeed(200, 600, 255, 330)).toBe(180);
		expect(ThreatRules.StandoffSpeed(700, 600, 255, 330)).toBe(315);
		expect(ThreatRules.StandoffSpeed(900, 600, 255, 330)).toBe(330);
		expect(ThreatRules.StandoffMargin("ace") > ThreatRules.StandoffMargin("normal")).toBe(true);
	});
});
