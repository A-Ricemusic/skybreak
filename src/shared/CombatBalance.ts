// Normal's numeric combat envelope. CombatService keeps movement, aiming and defensive
// maneuvers; these tables separate shooting pressure from objective length.
export const CombatBalance = {
	raiderHealth: 100, bomberHealth: 180, playerMissileCooldown: 1.15,
	fireAimDot: [0.65, 0.55, 0.45],
	straightRelax: [0.2, 0.25, 0.3],
	/** Ordinary bandits and raiders must not accelerate past their pursuit cap when breaking away. */
	banditSpeedCap: 350,
	/** Hostile missile origin ahead of the aircraft nose. */
	hostileLaunchOffset: 18,
	hostileDamage: [6, 7, 7.5],
	windup: [2.4, 2.0, 1.7],
	banditReload: [10, 7.5, 5.5],
	missileSpeed: [580, 660, 740],
	missileLife: [7, 8, 9],
	fireRange: [[450, 1700], [400, 1900], [350, 2100]],
	flightGate: [22, 20, 20],
	flightDivisor: [1.5, 1.75, 1.75],
	threatCap: [1, 1, 1],
	banditHealth: [80, 90, 100],
	aceReload: [15, 15, 15],
	aceSalvo: [1, 1, 1],
	gentle: { lastMission: 4, flightGate: 22, flightDivisor: 1.25, threatCap: 1 },
};
