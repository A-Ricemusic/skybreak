// Normal's numeric combat envelope. CombatService keeps movement, aiming and defensive
// maneuvers; these tables separate shooting pressure from objective length.
export const CombatBalance = {
	hostileDamage: [4, 5, 5.5],
	flightGate: [24, 24, 27],
	flightDivisor: [1.25, 1.5, 1.5],
	threatCap: [1, 1, 1],
	banditHealth: [80, 90, 100],
	aceReload: [16, 18, 20],
	aceSalvo: [1, 1, 1],
	gentle: { lastMission: 4, flightGate: 26, flightDivisor: 1.25, threatCap: 1 },
};
