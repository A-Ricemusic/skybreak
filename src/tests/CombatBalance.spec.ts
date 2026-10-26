import { describe, expect, it } from "@rbxts/jest-globals";
import { CombatBalance } from "../shared/CombatBalance";
import { Difficulty } from "../shared/Difficulty";
import { ThreatRules } from "../shared/ThreatRules";
import { SpecialWeapons } from "../shared/SpecialWeapons";

describe("Round-3 difficulty envelope", () => {
	it("keeps Normal bandits at two standard hits throughout, Easy at one or two, Ace armored", () => {
		for (const health of CombatBalance.banditHealth) {
			expect(math.ceil(health / SpecialWeapons.StandardDamage)).toBe(2);
			expect(Difficulty.Scale("easy", "banditHealth", health) < health).toBe(true);
			expect(Difficulty.Scale("ace", "banditHealth", health) > 110).toBe(true);
		}
	});
	it("allows one Normal flight threat even with seven hostiles, while Ace restores two", () => {
		for (let act = 0; act < 3; act++) {
			for (const kind of Difficulty.Order) {
				const cap = Difficulty.Scale(kind, "threatCap", CombatBalance.threatCap[act]);
				expect(ThreatRules.ThreatCap(7, cap)).toBe(kind === "ace" ? 2 : 1);
			}
		}
	});
	it("restores approximately PR37 damage and flight cadence on Ace", () => {
		const oldDamage = [10, 12, 13], oldGate = [7, 5.2, 5];
		for (let act = 0; act < 3; act++) {
			const damage = Difficulty.Scale("ace", "hostileDamage", CombatBalance.hostileDamage[act]);
			const gate = ThreatRules.FlightGate(Difficulty.Scale("ace", "hostileGate", CombatBalance.flightGate[act]), 7,
				Difficulty.Scale("ace", "flightDivisor", CombatBalance.flightDivisor[act]));
			expect(math.abs(damage - oldDamage[act]) < 0.5).toBe(true);
			expect(gate <= oldGate[act] * 1.1).toBe(true);
		}
	});
	it("leaves at least 50 hull in a seven-minute Normal flight envelope at 30% hostile hit rate", () => {
		// A tuning estimate, not a live-player claim: constant seven-ship contact, no evades,
		// no kills, no regeneration. Radar-directed phases and aces have separate envelopes.
		for (let act = 0; act < 3; act++) {
			const gate = ThreatRules.FlightGate(CombatBalance.flightGate[act], 7, CombatBalance.flightDivisor[act]);
			const loss = math.ceil(420 / gate) * CombatBalance.hostileDamage[act] * 0.3;
			expect(100 - loss >= 50).toBe(true);
			const easyGate = ThreatRules.FlightGate(Difficulty.Scale("easy", "hostileGate", CombatBalance.flightGate[act]), 7,
				Difficulty.Scale("easy", "flightDivisor", CombatBalance.flightDivisor[act]));
			const easyLoss = math.ceil(420 / easyGate) * Difficulty.Scale("easy", "hostileDamage", CombatBalance.hostileDamage[act]) * 0.3;
			expect(easyLoss < loss * 0.6).toBe(true);
		}
	});
	it("paces Normal ace launches separately and restores staged boss hull on Ace", () => {
		const normalHull = [200, 260, 320], oldHull = [300, 400, 500];
		for (let act = 0; act < 3; act++) {
			expect(CombatBalance.aceSalvo[act]).toBe(1);
			expect(CombatBalance.aceReload[act] >= 16).toBe(true);
			const hull = Difficulty.Scale("ace", "aceHealth", normalHull[act]);
			expect(hull >= oldHull[act] && hull <= oldHull[act] * 1.1).toBe(true);
			expect(Difficulty.Scale("ace", "aceGate", CombatBalance.aceReload[act]) <= 8).toBe(true);
		}
	});
});
