/** Normal ammunition and acquisition facts, not inferred performance tuning.
 * Source: https://acecombat.wiki.gg/wiki/Ace_Combat_04%3A_Shattered_Skies/Aircraft
 * Prices are retained for the forthcoming credit/shop implementation; current selection
 * enforces campaign unlock milestones. X-02 stays unavailable until its special rule is verified.
 */
export interface AC04AircraftSpec { id: string; afterMission: number; price: number; gun: number; missiles: number }
export const AC04Aircraft: AC04AircraftSpec[] = [
	{ id: "F-4E", afterMission: 0, price: 0, gun: 650, missiles: 52 },
	{ id: "F-5E", afterMission: 0, price: 52000, gun: 650, missiles: 48 },
	{ id: "F-16C", afterMission: 3, price: 97000, gun: 700, missiles: 52 },
	{ id: "A-10A", afterMission: 5, price: 123000, gun: 850, missiles: 56 },
	{ id: "Mir-2000", afterMission: 5, price: 110000, gun: 700, missiles: 52 },
	{ id: "F-14A", afterMission: 6, price: 188000, gun: 750, missiles: 64 },
	{ id: "TND-IDS", afterMission: 6, price: 172000, gun: 750, missiles: 58 },
	{ id: "F/A-18C", afterMission: 6, price: 170000, gun: 700, missiles: 60 },
	{ id: "F-15C", afterMission: 8, price: 272000, gun: 800, missiles: 68 },
	{ id: "MiG-29A", afterMission: 8, price: 259000, gun: 750, missiles: 64 },
	{ id: "F-117A", afterMission: 10, price: 386000, gun: 650, missiles: 54 },
	{ id: "EF-2000", afterMission: 10, price: 351000, gun: 800, missiles: 68 },
	{ id: "R-M01", afterMission: 10, price: 370000, gun: 800, missiles: 64 },
	{ id: "F-15E", afterMission: 12, price: 505000, gun: 850, missiles: 72 },
	{ id: "F-2A", afterMission: 12, price: 505000, gun: 800, missiles: 68 },
	{ id: "Su-35", afterMission: 15, price: 589000, gun: 850, missiles: 72 },
	{ id: "F-22A", afterMission: 16, price: 643000, gun: 850, missiles: 74 },
	{ id: "Su-37", afterMission: 16, price: 618000, gun: 850, missiles: 78 },
	{ id: "F-15ACTIVE", afterMission: 16, price: 620000, gun: 900, missiles: 78 },
	{ id: "S-37A", afterMission: 17, price: 889000, gun: 900, missiles: 78 },
	{ id: "X-02", afterMission: 99, price: 1414000, gun: 950, missiles: 82 },
];
export function ac04Aircraft(id: string): AC04AircraftSpec { return AC04Aircraft.find((a) => a.id === id) ?? AC04Aircraft[0]; }
