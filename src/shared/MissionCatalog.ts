// Last Tide: a 27-mission arcade flight campaign.
//
// This catalog is the single data source for mission structure, world placement,
// environment presets, and narrative framing. MissionRules enforces the phase
// sequence here; MissionWorld reads the environment and placement entries;
// CutsceneCatalog pulls narrative beats keyed to these mission IDs.
//
// Missions 1 and 2 preserve the legacy "First Flight" and "Reefbreak Harbor"
// mechanics exactly: Mission 1's tutorial sequence and Mission 2's intercept
// → warehouses → ace progression (with five optional pursuers alongside the
// warehouses and ace) are hard-coded in MissionRules. The catalog records
// their canonical shape so the save, UI, cutscenes, and world builder treat
// them like every other mission.

export type MissionPhaseKind = "tutorial" | "air" | "ground" | "ace" | "nav" | "hold";

/**
 * A single mission phase. For `air` and `ace` the phase spawns enemy aircraft;
 * for `ground` the phase activates pre-placed ground models; `tutorial` is
 * mission 1 only and uses the preserved tutorial state machine.
 *
 * `required` kills advance the mission; `optional` aircraft spawn alongside
 * air, ground, or timed-hold phases but do not advance them. Optional pursuers
 * persist into later phases (as Mission 2's five raiders famously do).
 */
export interface MissionPhase {
	kind: MissionPhaseKind;
	required: number;
	optional?: number;
	/** Enemy HP override; ace defaults to 165 and air defaults to 100. */
	health?: number;
	/** Caller-friendly label used in telemetry and the briefing. */
	label: string;
	/** Ordered server-owned flight gates for navigation/recon/rescue phases. */
	route?: [number, number, number][];
}

/** Environment presets drive sky, atmosphere, cloud, time of day, and water color. */
export type EnvironmentPresetId =
	| "lagoon_noon"
	| "coral_dawn"
	| "monsoon_dusk"
	| "storm_night"
	| "harbor_hazy"
	| "mangrove_mist"
	| "typhoon_eye"
	| "amber_sunset"
	| "flood_twilight"
	| "carrier_dusk"
	| "last_horizon";

/** A placed ground target: position in world space, authored kind, and rotation. */
export interface GroundPlacement {
	kind: "warehouse" | "radar" | "corvette" | "sam";
	x: number;
	z: number;
	yaw?: number;
	/** Optional label; falls back to catalog-provided default name. */
	name?: string;
}

/** Island shape used by the world builder for mission scenery. */
export interface IslandPlacement {
	x: number;
	z: number;
	radius: number;
	height: number;
	/** When present, decorates the island with an apron/runway outline. */
	apron?: boolean;
}

/** Optional scenery part placement (containers, cranes, breakwaters). */
export interface SceneryPart {
	name: string;
	size: [number, number, number];
	position: [number, number, number];
	color: [number, number, number];
	material?: "Concrete" | "Metal" | "Asphalt" | "Rock" | "SmoothPlastic" | "CorrodedMetal" | "Sand";
}

export interface MissionDefinition {
	id: number;
	act: 1 | 2 | 3;
	codename: string;
	region: string;
	synopsis: string;
	/** Phase sequence; missions 1-2 preserve the legacy tutorial/warehouse shape. */
	phases: MissionPhase[];
	environment: EnvironmentPresetId;
	islands: IslandPlacement[];
	targets: GroundPlacement[];
	scenery?: SceneryPart[];
}

const WAREHOUSE_LAYOUT: GroundPlacement[] = [
	{ kind: "warehouse", x: -550, z: -900, name: "WAREHOUSE 1" },
	{ kind: "warehouse", x: 0, z: -1100, yaw: math.pi / 2, name: "WAREHOUSE 2" },
	{ kind: "warehouse", x: 550, z: -900, name: "WAREHOUSE 3" },
	{ kind: "warehouse", x: -350, z: -1550, yaw: math.pi / 2, name: "WAREHOUSE 4" },
	{ kind: "warehouse", x: 350, z: -1550, name: "WAREHOUSE 5" },
];

const WAREHOUSE_ISLANDS: IslandPlacement[] = [
	{ x: -550, z: -900, radius: 390, height: 62, apron: true },
	{ x: 0, z: -1100, radius: 390, height: 62, apron: true },
	{ x: 550, z: -900, radius: 390, height: 62, apron: true },
	{ x: -350, z: -1550, radius: 390, height: 62, apron: true },
	{ x: 350, z: -1550, radius: 390, height: 62, apron: true },
	{ x: -1500, z: -1500, radius: 570, height: 180 },
	{ x: 1450, z: -1600, radius: 600, height: 185 },
	{ x: 1600, z: 500, radius: 450, height: 125 },
	{ x: -1450, z: 500, radius: 490, height: 135 },
];

const WAREHOUSE_SCENERY: SceneryPart[] = [
	{ name: "Breakwater", size: [1500, 30, 45], position: [0, 8, -2050], color: [80, 86, 89], material: "Rock" },
	{ name: "CraneTowerW", size: [9, 110, 9], position: [-750, 64, -1850], color: [211, 157, 63], material: "Metal" },
	{ name: "CraneBoomW", size: [150, 9, 9], position: [-705, 115, -1850], color: [211, 157, 63], material: "Metal" },
	{ name: "CraneTowerE", size: [9, 110, 9], position: [750, 64, -1850], color: [211, 157, 63], material: "Metal" },
	{ name: "CraneBoomE", size: [150, 9, 9], position: [795, 115, -1850], color: [211, 157, 63], material: "Metal" },
];

const FIRST_FLIGHT_ISLANDS: IslandPlacement[] = [
	{ x: 0, z: -850, radius: 440, height: 70, apron: true },
	{ x: -1000, z: -1450, radius: 460, height: 125 },
	{ x: 1200, z: -1350, radius: 510, height: 135 },
	{ x: -1450, z: 650, radius: 350, height: 95 },
	{ x: 1600, z: 350, radius: 400, height: 110 },
	{ x: -650, z: 450, radius: 510, height: 48, apron: true },
];

const FIRST_FLIGHT_TARGETS: GroundPlacement[] = [{ kind: "radar", x: 0, z: -850, name: "TRAINING RADAR" }];

function ring(
	count: number,
	centerX: number,
	centerZ: number,
	radius: number,
	kind: GroundPlacement["kind"],
	namePrefix: string,
): GroundPlacement[] {
	const result: GroundPlacement[] = [];
	for (let index = 0; index < count; index++) {
		const theta = (index / count) * math.pi * 2;
		result.push({
			kind,
			x: math.floor(centerX + math.cos(theta) * radius),
			z: math.floor(centerZ + math.sin(theta) * radius),
			yaw: theta + math.pi / 2,
			name: `${namePrefix} ${index + 1}`,
		});
	}
	return result;
}

function islandRing(
	count: number,
	centerX: number,
	centerZ: number,
	radius: number,
	islandRadius: number,
	height: number,
): IslandPlacement[] {
	const result: IslandPlacement[] = [];
	for (let index = 0; index < count; index++) {
		const theta = (index / count) * math.pi * 2;
		result.push({
			x: math.floor(centerX + math.cos(theta) * radius),
			z: math.floor(centerZ + math.sin(theta) * radius),
			radius: islandRadius,
			height,
			apron: true,
		});
	}
	return result;
}

/**
 * The canonical 27 mission definitions. Missions 1 and 2 keep their legacy
 * phase declarations; MissionRules continues to enforce their special gates.
 */
export const MISSIONS: MissionDefinition[] = [
	{
		id: 1,
		act: 1,
		codename: "First Flight",
		region: "Yurei Atoll · Yurei Reef · training airspace",
		synopsis:
			"Learn to pitch and turn, cycle to the training radar, fire a missile, then intercept three raiders probing the atoll.",
		phases: [
			{ kind: "tutorial", required: 0, label: "Flight controls" },
			{ kind: "ground", required: 1, label: "Training radar" },
			{ kind: "air", required: 3, label: "Three bandits" },
		],
		environment: "lagoon_noon",
		islands: FIRST_FLIGHT_ISLANDS,
		targets: FIRST_FLIGHT_TARGETS,
	},
	{
		id: 2,
		act: 1,
		codename: "Reefbreak Harbor",
		region: "Reefbreak Harbor · Admiralty blockade quay",
		synopsis:
			"Punch through the first blockade cordon: intercept three required bandits, destroy five dockside warehouses with five patrol fighters pursuing, then down the faster, tougher ace.",
		phases: [
			{ kind: "air", required: 3, label: "Blockade intercept" },
			{ kind: "ground", required: 5, optional: 5, label: "Dockside warehouses" },
			{ kind: "ace", required: 1, health: 165, label: "Vanta ace" },
		],
		environment: "amber_sunset",
		islands: WAREHOUSE_ISLANDS,
		targets: WAREHOUSE_LAYOUT,
		scenery: WAREHOUSE_SCENERY,
	},
	{
		id: 3,
		act: 1,
		codename: "Shallow Patrol",
		region: "Yurei Shallows · tide-reef gap",
		synopsis:
			"Four Admiralty scouts cross the shallows at low tide. Siaosi and Varo intercept while the reef cities move to shelter.",
		phases: [
			{ kind: "nav", required: 3, label: "Sweep the shallow-water patrol route", route: [[-1100, 260, -900], [0, 210, -1550], [1200, 280, -850]] },
			{ kind: "air", required: 4, label: "Scout flight" },
		],
		environment: "lagoon_noon",
		islands: [
			{ x: 0, z: -600, radius: 320, height: 48, apron: true },
			{ x: -1400, z: -1200, radius: 420, height: 95 },
			{ x: 1500, z: -1000, radius: 460, height: 105 },
			{ x: -1300, z: 900, radius: 380, height: 68 },
			{ x: 1300, z: 1100, radius: 400, height: 78 },
		],
		targets: [],
	},
	{
		id: 4,
		act: 1,
		codename: "Pearl Lagoon",
		region: "Pearl Lagoon · pearl-raider mooring",
		synopsis:
			"Raiders have moored stolen cutters inside the pearl lagoon. Burn their corvettes before their crews cast off, then shake the patrol they called in.",
		phases: [
			{ kind: "ground", required: 3, label: "Pearl raider corvettes" },
			{ kind: "air", required: 2, label: "Raider CAP" },
		],
		environment: "coral_dawn",
		islands: [
			{ x: -200, z: -700, radius: 420, height: 55, apron: true },
			{ x: 900, z: -1200, radius: 360, height: 70 },
			{ x: -1100, z: -1400, radius: 400, height: 92 },
			{ x: 1500, z: 500, radius: 390, height: 60 },
		],
		targets: [
			{ kind: "corvette", x: -200, z: -1050, name: "RAIDER MISTBREAK" },
			{ kind: "corvette", x: -400, z: -1250, yaw: math.pi / 2, name: "RAIDER TIDELINE" },
			{ kind: "corvette", x: 0, z: -1200, name: "RAIDER PEARLDRIFT" },
		],
	},
	{
		id: 5,
		act: 1,
		codename: "Monsoon Rising",
		region: "Yurei Approach · leading edge of the first monsoon",
		synopsis:
			"The monsoon front slides across the Reefwatch. Hold the sky while the fleet repositions through the squall line.",
		phases: [
			{ kind: "nav", required: 4, label: "Thread the monsoon weather buoys", route: [[-1400, 300, -950], [-450, 240, -1750], [650, 330, -1450], [1450, 260, -500]] },
			{ kind: "hold", required: 25, optional: 3, label: "Cover the fleet through the squall" },
			{ kind: "air", required: 3, label: "Squall-line rear guard" },
		],
		environment: "monsoon_dusk",
		islands: [
			{ x: 0, z: -500, radius: 340, height: 55, apron: true },
			{ x: -1500, z: -1500, radius: 500, height: 110 },
			{ x: 1600, z: -1200, radius: 440, height: 95 },
			{ x: -1400, z: 1000, radius: 420, height: 80 },
			{ x: 1400, z: 800, radius: 400, height: 72 },
		],
		targets: [],
	},
	{
		id: 6,
		act: 1,
		codename: "Driftwood Dock",
		region: "Driftwood Pier · forward smuggling depot",
		synopsis:
			"A smuggling depot keeps the blockade loaded. Flatten the four stockyards, then survive three fighters scrambled from the next atoll.",
		phases: [
			{ kind: "ground", required: 4, label: "Driftwood stockyards" },
			{ kind: "air", required: 3, label: "Scrambled CAP" },
		],
		environment: "harbor_hazy",
		islands: [
			{ x: 0, z: -600, radius: 420, height: 60, apron: true },
			{ x: -700, z: -1200, radius: 390, height: 70, apron: true },
			{ x: 700, z: -1200, radius: 390, height: 70, apron: true },
			{ x: 0, z: -1600, radius: 420, height: 72, apron: true },
			{ x: -1600, z: 600, radius: 420, height: 110 },
		],
		targets: [
			{ kind: "warehouse", x: -700, z: -1200, name: "DRIFTWOOD 1" },
			{ kind: "warehouse", x: 700, z: -1200, yaw: math.pi / 2, name: "DRIFTWOOD 2" },
			{ kind: "warehouse", x: 0, z: -1600, name: "DRIFTWOOD 3" },
			{ kind: "warehouse", x: 0, z: -1250, yaw: math.pi / 2, name: "DRIFTWOOD 4" },
		],
	},
	{
		id: 7,
		act: 1,
		codename: "Bone Reef",
		region: "Bone Reef · old shipwreck graveyard",
		synopsis:
			"An Admiralty ace runs patrols through the Bone Reef shipwrecks. Break the escort first, then take him down.",
		phases: [
			{ kind: "air", required: 6, label: "Reef escort" },
			{ kind: "ace", required: 1, health: 150, label: "Reef ace" },
		],
		environment: "coral_dawn",
		islands: [
			{ x: 0, z: -500, radius: 360, height: 50, apron: true },
			{ x: -900, z: -1300, radius: 420, height: 110 },
			{ x: 1000, z: -1200, radius: 440, height: 115 },
			{ x: 1300, z: 1100, radius: 380, height: 70 },
			{ x: -1400, z: 1300, radius: 400, height: 75 },
		],
		targets: [],
	},
	{
		id: 8,
		act: 1,
		codename: "Signal Fire",
		region: "Signal Keys · four relay radars",
		synopsis:
			"Four Admiralty relays feed the blockade targeting net. Burn each tower while six Vanta patrols try to spoil the strike.",
		phases: [{ kind: "ground", required: 4, optional: 6, label: "Signal relays" }],
		environment: "amber_sunset",
		islands: [
			{ x: -1100, z: -800, radius: 300, height: 60, apron: true },
			{ x: 1100, z: -800, radius: 300, height: 60, apron: true },
			{ x: 0, z: -1400, radius: 320, height: 60, apron: true },
			{ x: 0, z: 400, radius: 320, height: 60, apron: true },
			{ x: 0, z: -500, radius: 300, height: 48, apron: true },
		],
		targets: [
			{ kind: "radar", x: -1100, z: -800, name: "RELAY ALPHA" },
			{ kind: "radar", x: 1100, z: -800, name: "RELAY BRAVO" },
			{ kind: "radar", x: 0, z: -1400, name: "RELAY CHARLIE" },
			{ kind: "radar", x: 0, z: 400, name: "RELAY DELTA" },
		],
	},
	{
		id: 9,
		act: 1,
		codename: "Mira's Deal",
		region: "Open Reef · defector rendezvous",
		synopsis:
			"Mira, a defecting Admiralty navigator, waits in the open reef. Clear her tail — five pursuers and one ace — before she can land at Yurei.",
		phases: [
			{ kind: "nav", required: 2, label: "Reach Mira's rendezvous", route: [[-800, 260, -1400], [700, 230, -1550]] },
			{ kind: "air", required: 5, label: "Pursuer flight" },
			{ kind: "ace", required: 1, health: 170, label: "Admiralty flight lead" },
		],
		environment: "monsoon_dusk",
		islands: [
			{ x: 0, z: -600, radius: 340, height: 50, apron: true },
			{ x: -1200, z: -1400, radius: 440, height: 95 },
			{ x: 1300, z: -1200, radius: 460, height: 105 },
			{ x: -1500, z: 900, radius: 440, height: 80 },
			{ x: 1500, z: 1000, radius: 420, height: 72 },
		],
		targets: [],
	},
	// ----- Act II: The Flood Wall -----
	{
		id: 10,
		act: 2,
		codename: "Dawn Siren",
		region: "Shelter Pass · dawn SAM battery",
		synopsis:
			"The Admiralty seeded three SAM batteries along Shelter Pass. Mira flies second seat for the first time; take out the launchers, then the fighters they wake.",
		phases: [
			{ kind: "ground", required: 3, label: "Shelter SAM line" },
			{ kind: "air", required: 4, label: "Alarm response" },
		],
		environment: "coral_dawn",
		islands: [
			{ x: -700, z: -800, radius: 320, height: 60, apron: true },
			{ x: 0, z: -1200, radius: 320, height: 60, apron: true },
			{ x: 700, z: -800, radius: 320, height: 60, apron: true },
			{ x: 0, z: 500, radius: 360, height: 55, apron: true },
			{ x: -1600, z: 1100, radius: 400, height: 75 },
			{ x: 1600, z: 1100, radius: 400, height: 75 },
		],
		targets: [
			{ kind: "sam", x: -700, z: -800, name: "SAM SHELTER 1" },
			{ kind: "sam", x: 0, z: -1200, name: "SAM SHELTER 2" },
			{ kind: "sam", x: 700, z: -800, name: "SAM SHELTER 3" },
		],
	},
	{
		id: 11,
		act: 2,
		codename: "Flood Gate",
		region: "Yurei Flood Wall · tide barrier array",
		synopsis:
			"The Admiralty tries to breach four tide barriers. Each one lost drowns a reef city. Protect the array while seven interceptors harry you.",
		phases: [
			{ kind: "hold", required: 35, optional: 5, label: "Defend the flood-wall control span" },
			{ kind: "ground", required: 4, label: "Break the attack corvettes" },
		],
		environment: "flood_twilight",
		islands: [
			{ x: -900, z: -800, radius: 320, height: 55, apron: true },
			{ x: -300, z: -1100, radius: 320, height: 55, apron: true },
			{ x: 300, z: -1100, radius: 320, height: 55, apron: true },
			{ x: 900, z: -800, radius: 320, height: 55, apron: true },
			{ x: 0, z: 500, radius: 360, height: 55, apron: true },
			{ x: -1700, z: 900, radius: 420, height: 90 },
			{ x: 1700, z: 900, radius: 420, height: 90 },
		],
		targets: [
			{ kind: "corvette", x: -900, z: -800, name: "ADM ATTACK 1" },
			{ kind: "corvette", x: -300, z: -1100, name: "ADM ATTACK 2" },
			{ kind: "corvette", x: 300, z: -1100, name: "ADM ATTACK 3" },
			{ kind: "corvette", x: 900, z: -800, name: "ADM ATTACK 4" },
		],
	},
	{
		id: 12,
		act: 2,
		codename: "Blackwater Yard",
		region: "Blackwater Shipyard · corvette drydock complex",
		synopsis:
			"Six drydocks, six corvettes in frame, two aces guarding them. Varo opens the attack while Mira calls targets.",
		phases: [
			{ kind: "ground", required: 6, label: "Blackwater drydocks" },
			{ kind: "ace", required: 1, health: 160, label: "First yardmaster" },
			{ kind: "ace", required: 1, health: 180, label: "Second yardmaster" },
		],
		environment: "harbor_hazy",
		islands: [
			...islandRing(6, 0, -1100, 420, 290, 60),
			{ x: 0, z: -500, radius: 340, height: 50, apron: true },
			{ x: -1800, z: 900, radius: 440, height: 90 },
			{ x: 1800, z: 900, radius: 440, height: 90 },
		],
		targets: ring(6, 0, -1100, 420, "warehouse", "DRYDOCK"),
	},
	{
		id: 13,
		act: 2,
		codename: "Storm Eye",
		region: "Typhoon Eye · calm within chaos",
		synopsis:
			"The second monsoon closes over Yurei. Seven Vantas push into the eye; hold while the fleet rides the storm.",
		phases: [
			{ kind: "nav", required: 3, label: "Find the calm channel", route: [[-1200, 350, -1300], [0, 480, -1850], [1250, 320, -1200]] },
			{ kind: "hold", required: 40, optional: 6, label: "Hold inside the typhoon eye" },
		],
		environment: "typhoon_eye",
		islands: [
			{ x: 0, z: -600, radius: 360, height: 55, apron: true },
			{ x: -1500, z: -1400, radius: 460, height: 95 },
			{ x: 1500, z: -1400, radius: 460, height: 95 },
			{ x: -1500, z: 1200, radius: 420, height: 80 },
			{ x: 1500, z: 1200, radius: 420, height: 80 },
		],
		targets: [],
	},
	{
		id: 14,
		act: 2,
		codename: "Reefline Convoy",
		region: "Reefline Strait · corvette convoy",
		synopsis:
			"Five Admiralty corvettes press between the atolls, three fighters flying cover. Sink the ships and keep the escorts off Mira.",
		phases: [
			{ kind: "nav", required: 3, label: "Shadow the convoy through the strait", route: [[-900, 230, -800], [0, 200, -1450], [900, 250, -900]] },
			{ kind: "ground", required: 5, label: "Reefline convoy" },
			{ kind: "air", required: 3, label: "Convoy escort" },
		],
		environment: "harbor_hazy",
		islands: [
			{ x: 0, z: -400, radius: 340, height: 50, apron: true },
			{ x: -1500, z: -1200, radius: 440, height: 90 },
			{ x: 1500, z: -1200, radius: 440, height: 90 },
			{ x: -1500, z: 1100, radius: 420, height: 80 },
			{ x: 1500, z: 1100, radius: 420, height: 80 },
		],
		targets: [
			{ kind: "corvette", x: -600, z: -1300, name: "ADM CONVOY 1" },
			{ kind: "corvette", x: -300, z: -1500, name: "ADM CONVOY 2" },
			{ kind: "corvette", x: 0, z: -1700, name: "ADM CONVOY 3" },
			{ kind: "corvette", x: 300, z: -1500, name: "ADM CONVOY 4" },
			{ kind: "corvette", x: 600, z: -1300, name: "ADM CONVOY 5" },
		],
	},
	{
		id: 15,
		act: 2,
		codename: "Night Rains",
		region: "Yurei Night Approach · low ceiling",
		synopsis:
			"Six night interceptors ride the rain in low. Mira calls them off the HUD. End it with their flight ace.",
		phases: [
			{ kind: "air", required: 6, label: "Night interceptors" },
			{ kind: "ace", required: 1, health: 170, label: "Night ace" },
		],
		environment: "storm_night",
		islands: [
			{ x: 0, z: -500, radius: 340, height: 50, apron: true },
			{ x: -1500, z: -1400, radius: 440, height: 90 },
			{ x: 1500, z: -1400, radius: 440, height: 90 },
			{ x: -1500, z: 1100, radius: 420, height: 80 },
			{ x: 1500, z: 1100, radius: 420, height: 80 },
		],
		targets: [],
	},
	{
		id: 16,
		act: 2,
		codename: "Breakwater Siege",
		region: "Yurei Breakwater · last outer wall",
		synopsis:
			"Three SAM batteries, two radar relays and four interceptors go into one siege. If the breakwater falls the Admiralty beaches the carrier.",
		phases: [
			{ kind: "ground", required: 5, label: "Breakwater defenses" },
			{ kind: "air", required: 4, label: "Breakwater CAP" },
			{ kind: "ace", required: 1, health: 185, label: "Siege lead" },
		],
		environment: "flood_twilight",
		islands: [
			{ x: -900, z: -900, radius: 340, height: 55, apron: true },
			{ x: 0, z: -1200, radius: 340, height: 55, apron: true },
			{ x: 900, z: -900, radius: 340, height: 55, apron: true },
			{ x: -500, z: -500, radius: 300, height: 55, apron: true },
			{ x: 500, z: -500, radius: 300, height: 55, apron: true },
			{ x: 0, z: 500, radius: 360, height: 50, apron: true },
			{ x: -1700, z: 1100, radius: 420, height: 80 },
			{ x: 1700, z: 1100, radius: 420, height: 80 },
		],
		targets: [
			{ kind: "sam", x: -900, z: -900, name: "BREAKWATER SAM 1" },
			{ kind: "sam", x: 0, z: -1200, name: "BREAKWATER SAM 2" },
			{ kind: "sam", x: 900, z: -900, name: "BREAKWATER SAM 3" },
			{ kind: "radar", x: -500, z: -500, name: "BREAKWATER RELAY 1" },
			{ kind: "radar", x: 500, z: -500, name: "BREAKWATER RELAY 2" },
		],
	},
	{
		id: 17,
		act: 2,
		codename: "Admiral's Shadow",
		region: "Open Reef · twin ace intercept",
		synopsis:
			"Admiral Reyne sends two aces at once to break the Reef Watch's morale. Varo trails Siaosi while Mira calls shots.",
		phases: [
			{ kind: "ace", required: 1, health: 175, label: "Shadow ace alpha" },
			{ kind: "ace", required: 1, health: 190, label: "Shadow ace beta" },
		],
		environment: "monsoon_dusk",
		islands: [
			{ x: 0, z: -500, radius: 320, height: 50, apron: true },
			{ x: -1500, z: -1400, radius: 440, height: 90 },
			{ x: 1500, z: -1400, radius: 440, height: 90 },
			{ x: -1500, z: 1100, radius: 420, height: 80 },
			{ x: 1500, z: 1100, radius: 420, height: 80 },
		],
		targets: [],
	},
	{
		id: 18,
		act: 2,
		codename: "The Second Tide",
		region: "Yurei Flood Wall · breach night",
		synopsis:
			"The Admiralty throws the second wave at the Flood Wall: eight ground emplacements and five interceptors. Hold until the civilian ships clear.",
		phases: [
			{ kind: "hold", required: 35, optional: 5, label: "Keep the flood wall firing" },
			{ kind: "ground", required: 8, label: "Second-tide line" },
		],
		environment: "flood_twilight",
		islands: [
			{ x: -1050, z: -900, radius: 300, height: 55, apron: true },
			{ x: -350, z: -900, radius: 300, height: 55, apron: true },
			{ x: 350, z: -900, radius: 300, height: 55, apron: true },
			{ x: 1050, z: -900, radius: 300, height: 55, apron: true },
			{ x: -700, z: -1400, radius: 300, height: 55, apron: true },
			{ x: 0, z: -1600, radius: 300, height: 55, apron: true },
			{ x: 700, z: -1400, radius: 300, height: 55, apron: true },
			{ x: 0, z: -400, radius: 300, height: 55, apron: true },
			{ x: 0, z: 500, radius: 340, height: 50, apron: true },
		],
		targets: [
			{ kind: "sam", x: -1050, z: -900, name: "WALL SAM 1" },
			{ kind: "sam", x: -350, z: -900, name: "WALL SAM 2" },
			{ kind: "sam", x: 350, z: -900, name: "WALL SAM 3" },
			{ kind: "sam", x: 1050, z: -900, name: "WALL SAM 4" },
			{ kind: "radar", x: -700, z: -1400, name: "WALL RELAY 1" },
			{ kind: "radar", x: 700, z: -1400, name: "WALL RELAY 2" },
			{ kind: "warehouse", x: 0, z: -1600, name: "WALL DEPOT" },
			{ kind: "corvette", x: 0, z: -400, name: "WALL CUTTER" },
		],
	},
	// ----- Act III: The Last Tide -----
	{
		id: 19,
		act: 3,
		codename: "Carrier Deck",
		region: "Carrier Groups Approach · outer ring",
		synopsis:
			"Siaosi, Varo, and Mira hit the Admiralty's outer carrier screen. Five escort ships, four pursuers. The carrier itself is beyond.",
		phases: [
			{ kind: "nav", required: 3, label: "Skim the carrier approach lanes", route: [[-1100, 220, -650], [0, 185, -1500], [1100, 220, -650]] },
			{ kind: "ground", required: 5, label: "Carrier screen" },
			{ kind: "air", required: 4, label: "Carrier CAP" },
		],
		environment: "carrier_dusk",
		islands: [
			{ x: 0, z: -500, radius: 340, height: 48, apron: true },
			{ x: -1700, z: 900, radius: 440, height: 95 },
			{ x: 1700, z: 900, radius: 440, height: 95 },
		],
		targets: [
			{ kind: "corvette", x: -700, z: -900, name: "ESCORT 1" },
			{ kind: "corvette", x: 700, z: -900, name: "ESCORT 2" },
			{ kind: "corvette", x: 0, z: -1200, name: "ESCORT 3" },
			{ kind: "corvette", x: -300, z: -1500, name: "ESCORT 4" },
			{ kind: "corvette", x: 300, z: -1500, name: "ESCORT 5" },
		],
	},
	{
		id: 20,
		act: 3,
		codename: "Lone Spire",
		region: "Lone Spire · isolated monsoon command tower",
		synopsis:
			"The Admiralty retreats to a single tower rising from the storm. Burn its six emplacements, then down the senior ace who waits above.",
		phases: [
			{ kind: "ground", required: 6, label: "Spire defenses" },
			{ kind: "ace", required: 1, health: 195, label: "Spire ace" },
		],
		environment: "monsoon_dusk",
		islands: [
			{ x: 0, z: -1000, radius: 500, height: 150, apron: true },
			{ x: -1600, z: 900, radius: 420, height: 90 },
			{ x: 1600, z: 900, radius: 420, height: 90 },
			{ x: 0, z: 500, radius: 320, height: 50, apron: true },
		],
		targets: ring(6, 0, -1000, 220, "sam", "SPIRE EMPLACEMENT"),
	},
	{
		id: 21,
		act: 3,
		codename: "Twin Horizon",
		region: "Open Reef · twin-pronged intercept",
		synopsis:
			"The Admiralty throws ten pilots at once. No ground targets; no backup. Survive, or Yurei falls.",
		phases: [
			{ kind: "nav", required: 4, label: "Relay Mira's decoy signal", route: [[-1500, 300, -300], [-700, 240, -1500], [700, 240, -1500], [1500, 300, -300]] },
			{ kind: "air", required: 7, label: "Twin-horizon rush" },
		],
		environment: "storm_night",
		islands: [
			{ x: 0, z: -500, radius: 320, height: 50, apron: true },
			{ x: -1600, z: -1300, radius: 440, height: 95 },
			{ x: 1600, z: -1300, radius: 440, height: 95 },
			{ x: -1600, z: 1200, radius: 420, height: 80 },
			{ x: 1600, z: 1200, radius: 420, height: 80 },
		],
		targets: [],
	},
	{
		id: 22,
		act: 3,
		codename: "Reef Beacon",
		region: "Reef Beacon · last civilian relay",
		synopsis:
			"Admiralty raiders light four batteries on Reef Beacon and an ace lead them. Preserve the beacon's broadcast so the islanders know how to retreat.",
		phases: [
			{ kind: "ground", required: 4, label: "Raider batteries" },
			{ kind: "ace", required: 1, health: 220, label: "Admiralty flight lord" },
		],
		environment: "typhoon_eye",
		islands: [
			{ x: 0, z: -900, radius: 420, height: 90, apron: true },
			{ x: -1500, z: -1500, radius: 440, height: 95 },
			{ x: 1500, z: -1500, radius: 440, height: 95 },
			{ x: 0, z: 500, radius: 340, height: 50, apron: true },
		],
		targets: [
			{ kind: "sam", x: -300, z: -800, name: "BEACON BATTERY 1" },
			{ kind: "sam", x: 300, z: -800, name: "BEACON BATTERY 2" },
			{ kind: "sam", x: 0, z: -1200, name: "BEACON BATTERY 3" },
			{ kind: "sam", x: 0, z: -600, name: "BEACON BATTERY 4" },
		],
	},
	{
		id: 23,
		act: 3,
		codename: "Monsoon Veil",
		region: "Deep Monsoon · wall of weather",
		synopsis:
			"Deep in the monsoon: seven Vanta at once, no horizon, Mira flying everyone's instruments.",
		phases: [
			{ kind: "nav", required: 5, label: "Map a path through the monsoon veil", route: [[-1500, 260, -300], [-900, 380, -1200], [0, 220, -1800], [900, 380, -1200], [1500, 260, -300]] },
			{ kind: "hold", required: 30, optional: 5, label: "Mask the refugee convoy" },
		],
		environment: "storm_night",
		islands: [
			{ x: 0, z: -500, radius: 320, height: 50, apron: true },
			{ x: -1700, z: -1400, radius: 440, height: 95 },
			{ x: 1700, z: -1400, radius: 440, height: 95 },
			{ x: -1500, z: 1200, radius: 420, height: 80 },
			{ x: 1500, z: 1200, radius: 420, height: 80 },
		],
		targets: [],
	},
	{
		id: 24,
		act: 3,
		codename: "Last Light",
		region: "Admiral's Reach · final supply chain",
		synopsis:
			"Burn five supply nodes, then down the two aces guarding them. One more objective and the Admiral is isolated.",
		phases: [
			{ kind: "ground", required: 5, label: "Admiral supply chain" },
			{ kind: "ace", required: 1, health: 190, label: "First escort ace" },
			{ kind: "ace", required: 1, health: 205, label: "Second escort ace" },
		],
		environment: "amber_sunset",
		islands: [
			{ x: -800, z: -900, radius: 320, height: 55, apron: true },
			{ x: 0, z: -1100, radius: 320, height: 55, apron: true },
			{ x: 800, z: -900, radius: 320, height: 55, apron: true },
			{ x: -400, z: -1500, radius: 320, height: 55, apron: true },
			{ x: 400, z: -1500, radius: 320, height: 55, apron: true },
			{ x: 0, z: 500, radius: 340, height: 50, apron: true },
			{ x: -1700, z: 1100, radius: 420, height: 80 },
			{ x: 1700, z: 1100, radius: 420, height: 80 },
		],
		targets: [
			{ kind: "warehouse", x: -800, z: -900, name: "ADMIRAL DEPOT 1" },
			{ kind: "warehouse", x: 0, z: -1100, name: "ADMIRAL DEPOT 2" },
			{ kind: "warehouse", x: 800, z: -900, name: "ADMIRAL DEPOT 3" },
			{ kind: "warehouse", x: -400, z: -1500, name: "ADMIRAL DEPOT 4" },
			{ kind: "warehouse", x: 400, z: -1500, name: "ADMIRAL DEPOT 5" },
		],
	},
	{
		id: 25,
		act: 3,
		codename: "Admiral's Carrier",
		region: "Admiral's Carrier · superstructure assault",
		synopsis:
			"The flagship fills the screen: eight anchor emplacements plus three fighters launched from the deck. Peel it open before the Admiral lifts the launch bar.",
		phases: [
			{ kind: "nav", required: 2, label: "Mark the carrier's blind quarter", route: [[-1200, 240, -900], [1200, 240, -900]] },
			{ kind: "ground", required: 8, label: "Carrier emplacements" },
			{ kind: "air", required: 3, label: "Launch-deck fighters" },
		],
		environment: "carrier_dusk",
		islands: [
			{ x: 0, z: -1100, radius: 620, height: 72, apron: true },
			{ x: 0, z: 500, radius: 340, height: 48, apron: true },
			{ x: -1800, z: 1100, radius: 420, height: 90 },
			{ x: 1800, z: 1100, radius: 420, height: 90 },
		],
		targets: [
			{ kind: "sam", x: -400, z: -800, name: "FLAG SAM 1" },
			{ kind: "sam", x: 400, z: -800, name: "FLAG SAM 2" },
			{ kind: "sam", x: -400, z: -1400, name: "FLAG SAM 3" },
			{ kind: "sam", x: 400, z: -1400, name: "FLAG SAM 4" },
			{ kind: "radar", x: -200, z: -1100, name: "FLAG RELAY 1" },
			{ kind: "radar", x: 200, z: -1100, name: "FLAG RELAY 2" },
			{ kind: "corvette", x: -550, z: -1100, name: "FLAG BOW" },
			{ kind: "corvette", x: 550, z: -1100, name: "FLAG STERN" },
		],
	},
	{
		id: 26,
		act: 3,
		codename: "Breaking Wave",
		region: "Breaking Wave · final blockade line",
		synopsis:
			"The Admiralty regroups one last time: six ground points, six pursuers. Punch the line open so the islanders can walk Admiral Reyne to a tribunal.",
		phases: [
			{ kind: "hold", required: 40, optional: 6, label: "Hold the evacuation corridor" },
			{ kind: "ground", required: 6, label: "Breaking-wave line" },
		],
		environment: "flood_twilight",
		islands: [
			{ x: -900, z: -900, radius: 320, height: 55, apron: true },
			{ x: -300, z: -1100, radius: 320, height: 55, apron: true },
			{ x: 300, z: -1100, radius: 320, height: 55, apron: true },
			{ x: 900, z: -900, radius: 320, height: 55, apron: true },
			{ x: -500, z: -1600, radius: 320, height: 55, apron: true },
			{ x: 500, z: -1600, radius: 320, height: 55, apron: true },
			{ x: 0, z: 500, radius: 340, height: 50, apron: true },
			{ x: -1700, z: 1100, radius: 420, height: 80 },
			{ x: 1700, z: 1100, radius: 420, height: 80 },
		],
		targets: [
			{ kind: "sam", x: -900, z: -900, name: "WAVE SAM 1" },
			{ kind: "sam", x: -300, z: -1100, name: "WAVE SAM 2" },
			{ kind: "sam", x: 300, z: -1100, name: "WAVE SAM 3" },
			{ kind: "sam", x: 900, z: -900, name: "WAVE SAM 4" },
			{ kind: "corvette", x: -500, z: -1600, name: "WAVE CUTTER 1" },
			{ kind: "corvette", x: 500, z: -1600, name: "WAVE CUTTER 2" },
		],
	},
	{
		id: 27,
		act: 3,
		codename: "Last Tide",
		region: "Last Horizon · Admiral Reyne's ship",
		synopsis:
			"The Admiral's own aircraft, three ace lieutenants, and a final line of flag defenses. Finish the war, bring the islanders home.",
		phases: [
			{ kind: "air", required: 4, label: "Flag intercept" },
			{ kind: "ground", required: 4, label: "Flag defenses" },
			{ kind: "ace", required: 1, health: 220, label: "Lieutenant ace alpha" },
			{ kind: "ace", required: 1, health: 230, label: "Lieutenant ace beta" },
			{ kind: "ace", required: 1, health: 260, label: "Admiral Reyne" },
		],
		environment: "last_horizon",
		islands: [
			{ x: 0, z: -1100, radius: 620, height: 95, apron: true },
			{ x: 0, z: 500, radius: 340, height: 48, apron: true },
			{ x: -1800, z: 1100, radius: 440, height: 95 },
			{ x: 1800, z: 1100, radius: 440, height: 95 },
		],
		targets: [
			{ kind: "sam", x: -500, z: -1100, name: "FLAG LAST SAM 1" },
			{ kind: "sam", x: 500, z: -1100, name: "FLAG LAST SAM 2" },
			{ kind: "radar", x: 0, z: -800, name: "FLAG LAST RELAY" },
			{ kind: "corvette", x: 0, z: -1400, name: "FLAG LAST CUTTER" },
		],
	},
];

export const MISSION_COUNT = 27;

/** Validates the catalog shape; called on module load so bad data fails fast. */
function validate(): void {
	assert(MISSIONS.size() === MISSION_COUNT, "MissionCatalog must contain 27 missions");
	for (let index = 0; index < MISSION_COUNT; index++) {
		const mission = MISSIONS[index];
		assert(mission.id === index + 1, `MissionCatalog entry ${index + 1} has mismatched id`);
		assert(mission.phases.size() > 0, `Mission ${mission.id} must define at least one phase`);
		for (const phase of mission.phases) {
			assert(phase.required >= 0, `Mission ${mission.id} phase has negative required`);
			if (phase.optional !== undefined) assert(phase.optional >= 0, `Mission ${mission.id} optional count must be non-negative`);
			if (phase.kind === "nav") assert(phase.route !== undefined && phase.route.size() === phase.required, `Mission ${mission.id} navigation route must match required gates`);
			else assert(phase.route === undefined, `Mission ${mission.id} non-navigation phase cannot define a route`);
		}
		const required = requiredGround(mission);
		assert(mission.targets.size() >= required, `Mission ${mission.id} needs at least ${required} ground placements`);
	}
}

export function requiredGround(mission: MissionDefinition): number {
	let total = 0;
	for (const phase of mission.phases) if (phase.kind === "ground") total += phase.required;
	return total;
}

export function requiredAir(mission: MissionDefinition): number {
	let total = 0;
	for (const phase of mission.phases) if (phase.kind === "air" || phase.kind === "ace") total += phase.required;
	return total;
}

export function getMission(missionId: number): MissionDefinition {
	assert(missionId >= 1 && missionId <= MISSION_COUNT && missionId % 1 === 0, `Unknown mission id ${missionId}`);
	return MISSIONS[missionId - 1];
}

export function isValidMissionId(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

validate();
