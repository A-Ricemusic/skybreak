// Normal's numeric combat envelope. CombatService keeps movement, aiming and defensive
// maneuvers; these tables separate shooting pressure from objective length.
export const CombatBalance = {
	/** Ordinary bandits and raiders must not accelerate past their pursuit cap when breaking away. */
	banditSpeedCap: 350,
	hostileDamage: [6, 7, 7.5],
	flightGate: [22, 20, 20],
	flightDivisor: [1.5, 1.75, 1.75],
	threatCap: [1, 1, 1],
	banditHealth: [80, 90, 100],
	aceReload: [15, 15, 15],
	aceSalvo: [1, 1, 1],
	gentle: { lastMission: 4, flightGate: 22, flightDivisor: 1.25, threatCap: 1 },
};
