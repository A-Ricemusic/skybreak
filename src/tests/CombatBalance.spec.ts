import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath } from "../shared/FlightMath";
import { CombatBalance } from "../shared/CombatBalance";
import { Difficulty } from "../shared/Difficulty";
import { MissionCatalog } from "./LegacyCatalog";
import { MissionPacing } from "../shared/MissionPacing";
import { ThreatRules } from "../shared/ThreatRules";
import { SpecialWeapons } from "../shared/SpecialWeapons";

// Analytic design estimates only: 60% firing opportunity (nose/range/cap), then
// 50% connections for a phone pilot using some evades/flares, 80% ignoring warnings.
// Ace launch opportunities are separate, with the server's +2 damage bonus.
function loss(id: number, hitRate: number): number {
	const bp = MissionCatalog.Get(id), act = bp.act - 1;
	let damage = 0;
	for (const window of MissionPacing.ContactWindows(bp)) {
		if (window.live > 0) {
			const soft = id <= CombatBalance.gentle.lastMission;
			const gate = ThreatRules.FlightGate(soft ? CombatBalance.gentle.flightGate : CombatBalance.flightGate[act], window.live,
				soft ? CombatBalance.gentle.flightDivisor : CombatBalance.flightDivisor[act], window.directed);
			damage += window.seconds / gate * 0.6 * hitRate * CombatBalance.hostileDamage[act];
		}
		if (window.ace) damage += window.seconds / CombatBalance.aceReload[act] * hitRate * (CombatBalance.hostileDamage[act] + 2);
	}
	return damage;
}

describe("Round-3 difficulty envelope", () => {
	it("keeps Normal and Act I Ace bandits at two standard hits; later Ace flights retain armor", () => {
		for (let act = 0; act < 3; act++) {
			const health = CombatBalance.banditHealth[act];
			expect(math.ceil(health / SpecialWeapons.StandardDamage)).toBe(2);
			expect(Difficulty.BanditHealth("easy", act + 1, health) < health).toBe(true);
			expect(math.ceil(Difficulty.BanditHealth("ace", act + 1, health) / SpecialWeapons.StandardDamage)).toBe(act === 0 ? 2 : 3);
		}
	});
	it("never toughens optional raiders or couriers on Ace: raiders two hits, couriers three", () => {
		// RAIDER_HEALTH 100 and COURIER_HEALTH 160 in CombatService.
		expect(math.ceil(Difficulty.SupportHealth("ace", 100) / SpecialWeapons.StandardDamage)).toBe(2);
		expect(math.ceil(Difficulty.SupportHealth("ace", 160) / SpecialWeapons.StandardDamage)).toBe(3);
		expect(Difficulty.SupportHealth("normal", 100)).toBe(100);
		expect(Difficulty.SupportHealth("easy", 100) < 100).toBe(true);
	});
	it("allows one Normal flight threat while Ace restores two outside the gentle opening", () => {
		for (let act = 0; act < 3; act++) for (const kind of Difficulty.Order) {
			const cap = Difficulty.Scale(kind, "threatCap", CombatBalance.threatCap[act]);
			expect(ThreatRules.ThreatCap(7, cap)).toBe(kind === "ace" ? 2 : 1);
		}
		expect(CombatBalance.gentle.threatCap).toBe(1);
		expect(CombatBalance.gentle.flightGate / CombatBalance.gentle.flightDivisor).toBe(17.6);
	});
	it("keeps Ace damage, flight divisor and cadence close to PR37 rather than amplifying the Normal retune", () => {
		const oldDamage = [10, 12, 13], expectedDivisor = [3, 3.5, 3.5], expectedGate = [6.23, 4.86, 4.86];
		for (let act = 0; act < 3; act++) {
			const damage = Difficulty.Scale("ace", "hostileDamage", CombatBalance.hostileDamage[act]);
			const divisor = Difficulty.Scale("ace", "flightDivisor", CombatBalance.flightDivisor[act]);
			const gate = ThreatRules.FlightGate(Difficulty.Scale("ace", "hostileGate", CombatBalance.flightGate[act]), 7, divisor);
			expect(math.abs(damage - oldDamage[act]) <= 0.5).toBe(true);
			expect(divisor).toBe(expectedDivisor[act]);
			expect(math.abs(gate - expectedGate[act]) < 0.02).toBe(true);
		}
	});
	it("bounds Act III mission contact on both sides: tension without an average-player spike", () => {
		for (const bp of MissionCatalog.ByAct(3)) {
			const average = loss(bp.id, 0.5), ignored = loss(bp.id, 0.8);
			// Ordinary sorties should end around 30-60 hull; the boss has the same
			// upper-loss guard. This catches both the original soft tuning and spikes.
			expect(average >= 40 && average <= 70).toBe(true);
			expect(ignored >= 64).toBe(true);
		}
		expect(loss(27, 0.8) >= 100).toBe(true);
	});
	it("keeps the earlier finales survivable without removing their pressure", () => {
		for (const id of [9, 18]) {
			const average = loss(id, 0.5);
			expect(average >= 25 && average <= 70).toBe(true);
		}
	});
	it("keeps ace reload flat across acts and avoids the paired-launch damage spike on Ace", () => {
		const normalHull = [200, 260, 320], oldHull = [300, 400, 500];
		for (let act = 0; act < 3; act++) {
			expect(CombatBalance.aceSalvo[act]).toBe(1);
			expect(Difficulty.Behaviour("ace").aceSalvo).toBe(1);
			expect(CombatBalance.aceReload[act]).toBe(15);
			const hull = Difficulty.Scale("ace", "aceHealth", normalHull[act]);
			expect(hull >= oldHull[act] && hull <= oldHull[act] * 1.1).toBe(true);
			expect(Difficulty.Scale("ace", "aceGate", CombatBalance.aceReload[act])).toBe(7.5);
		}
	});
});


// Deterministic aligned rear-shot probes, not a combat bot or human playtest.
// Start 900 studs behind an extending bandit. Integrate the real jet at a held
// airspeed, and compare the old uncapped extension with the server's new rule.
describe("High-speed bandit extension", () => {
	it("never gives an ordinary enemy a speed boost when it breaks", () => {
		for (const speed of [15, 160, 255, 320, 360, 450, 600]) {
			const pursuit = math.clamp(speed + 24, 285, CombatBalance.banditSpeedCap);
			expect(ThreatRules.ExtendSpeed(speed, 180) <= pursuit).toBe(true);
		}
	});
	it("preserves the existing low-speed envelope", () => {
		for (const speed of [15, 160, 255, 320, 360]) {
			expect(ThreatRules.ExtendSpeed(speed, 180)).toBe(math.max(180, speed - 10));
		}
	});
	it("recovers a rear-shot opportunity in early, middle and late high-speed breaks", () => {
		for (const seconds of [1.4, 1.6, 1.8, 3]) for (const speed of [450, 600]) {
			for (const dt of [1 / 30, 1 / 60]) {
				const jet = FlightMath.NewState();
				jet.speed = speed;
				const start = jet.z;
				let oldTravel = 0, newTravel = 0;
				for (let tick = 0; tick < math.round(seconds / dt); tick++) {
					FlightMath.Step(jet, { x: 0, y: 0, throttle: FlightMath.ThrottleForSpeed(speed) }, dt);
					oldTravel += math.max(180, jet.speed - 10) * dt;
					newTravel += ThreatRules.ExtendSpeed(jet.speed, 180) * dt;
				}
				const playerTravel = start - jet.z;
				const oldGap = 900 + oldTravel - playerTravel;
				const newGap = 900 + newTravel - playerTravel;
				expect(oldGap > 860).toBe(true);
				expect(newGap <= 900 - (speed - CombatBalance.banditSpeedCap) * seconds + 0.01).toBe(true);
				expect(newGap > 0).toBe(true); // no forced pass in this starting geometry
				print(`[extension probe] speed=${speed} seconds=${seconds} hz=${1 / dt} oldGap=${oldGap} newGap=${newGap}`);
			}
		}
	});
});
