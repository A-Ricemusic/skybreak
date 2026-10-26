import { describe, expect, it } from "@rbxts/jest-globals";
import { CombatBalance } from "../shared/CombatBalance";
import { Difficulty } from "../shared/Difficulty";
import { MissionCatalog } from "../shared/MissionCatalog";
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
