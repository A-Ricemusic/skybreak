// Glass Horizon — authored 27-mission campaign catalog.
//
// Each mission is a pure data record consumed by MissionRules, MissionWorld,
// CombatService, CutsceneCatalog, and the UI. Keep this file pure (no engine
// imports) so Roblox Jest can validate every definition offline.

export const MISSION_COUNT = 27;
export const MISSION_DURATION = 600;

/** Chapter grouping used by the mission select grid and the story cutscenes. */
export type ChapterId = 1 | 2 | 3;

/** A phase describes one authoritative progression step inside a mission. */
export type PhaseKind =
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	| "destroy_air_required"
	| "destroy_ground_required"
	| "destroy_ace_required"
	| "survive_pursuit";

/**
 * Server-authoritative progression unit. All counts are integer and >= 1 so
 * objective progress is always safe to render. ``optionalAirBudget`` caps the
 * number of optional raiders a mission is willing to count toward its visible
 * optional-kills tally.
 */
export interface MissionPhase {
	readonly kind: PhaseKind;
	readonly count?: number;
	readonly duration?: number;
	readonly objective: string;
	readonly enemyKind?: EnemyArchetype;
	readonly groundKind?: GroundArchetype;
}

export type EnemyArchetype =
	/** Standard aggressive bandit (RAIDER palette). */
	| "bandit"
	/** Faster bandit, more aggressive dives (same hull, higher pursuit). */
	| "interceptor"
	/** Hull-tough ace, the mission boss. */
	| "ace";

export type GroundArchetype =
	/** Target reuses the warehouse Blender mesh. */
	| "warehouse"
	/** Target reuses the training radar Blender mesh. */
	| "radar"
	/** Target reuses the new desert relay Blender mesh. */
	| "relay"
	/** Target reuses the new mobile SAM Blender mesh. */
	| "sam"
	/** Target reuses the new carrier Blender mesh (sea placement). */
	| "carrier";

export type OptionalRaiderSpec = {
	readonly count: number;
	readonly spawnOnPhase: PhaseKind;
	readonly archetype: EnemyArchetype;
};

/** Which authored world the mission requests. */
export type EnvironmentId =
	| "mediterranean_dawn"
	| "coastal_dusk"
	| "reef_coast"
	| "port_breakwater"
	| "desert_relay"
	| "scattered_islands"
	| "industrial_coast"
	| "night_islands"
	| "fleet_open_sea"
	| "radar_mountain"
	| "coastal_sam_belt"
	| "desert_dusk"
	| "coast_storm"
	| "fleet_dawn"
	| "desert_night"
	| "fleet_storm"
	| "radar_mountain_dawn"
	| "glass_horizon_finale";

export interface MissionDefinition {
	readonly id: number;
	readonly chapter: ChapterId;
	readonly name: string;
	readonly callsign: string;
	readonly environmentId: EnvironmentId;
	readonly briefing: string;
	readonly story: string;
	readonly phases: ReadonlyArray<MissionPhase>;
	readonly optionalRaiders?: OptionalRaiderSpec;
	readonly targetTime: number;
}

const PHASE: {
	move(): MissionPhase;
	target(): MissionPhase;
	missile(radarName?: string): MissionPhase;
	air(count: number, archetype?: EnemyArchetype, objective?: string): MissionPhase;
	ground(count: number, groundKind: GroundArchetype, objective?: string): MissionPhase;
	ace(archetype?: EnemyArchetype, objective?: string): MissionPhase;
	survive(seconds: number, objective: string): MissionPhase;
} = {
	move: (): MissionPhase => ({ kind: "tutorial_move", objective: "Turn and pitch using the flight controls" }),
	target: (): MissionPhase => ({ kind: "tutorial_target", objective: "Cycle target to select the practice target" }),
	missile: (): MissionPhase => ({ kind: "tutorial_missile", count: 1, objective: "Aim at the practice target, wait for lock, then fire a missile", groundKind: "radar" }),
	air: (count, archetype = "bandit", objective) => ({
		kind: "destroy_air_required",
		count,
		objective: objective ?? `Destroy ${count} ${archetype === "interceptor" ? "interceptors" : "bandits"}`,
		enemyKind: archetype,
	}),
	ground: (count, groundKind, objective) => ({
		kind: "destroy_ground_required",
		count,
		groundKind,
		objective: objective ?? `Destroy ${count} ${groundLabel(groundKind, count)}`,
	}),
	ace: (archetype = "ace", objective) => ({
		kind: "destroy_ace_required",
		count: 1,
		objective: objective ?? "Destroy the ace",
		enemyKind: archetype,
	}),
	survive: (duration, objective) => ({
		kind: "survive_pursuit",
		duration,
		objective,
	}),
};

function groundLabel(groundKind: GroundArchetype, count: number): string {
	const plural = count === 1 ? "" : "s";
	if (groundKind === "warehouse") return `warehouse${plural}`;
	if (groundKind === "radar") return `radar installation${plural}`;
	if (groundKind === "relay") return `relay dish${plural}`;
	if (groundKind === "sam") return `SAM launcher${plural}`;
	return `command carrier${plural}`;
}

// -------------------------------------------------------------------------
// Mission 1 and 2 preserve the shipped tutorial + Iron Coast behavior exactly.
// Both are expressed as data so the generalized rule engine still runs them.
// -------------------------------------------------------------------------

const MISSION_1: MissionDefinition = {
	id: 1,
	chapter: 1,
	name: "FIRST FLIGHT",
	callsign: "KESTREL-01",
	environmentId: "mediterranean_dawn",
	briefing: "Learn to pitch and turn, cycle to the marked ground target, fire a missile, then destroy the three bandits that chase you home.",
	story: "Your first solo over the Blue Horizon. The sea is quiet, your flight engineer is cheerful on the radio, and the island airbase glitters in the dawn.",
	phases: [PHASE.move(), PHASE.target(), PHASE.missile(), PHASE.air(3)],
	targetTime: 180,
};

const MISSION_2: MissionDefinition = {
	id: 2,
	chapter: 1,
	name: "IRON COAST",
	callsign: "KESTREL-02",
	environmentId: "coastal_dusk",
	briefing: "Intercept three bandits, then destroy five warehouses while raiders pursue, and finish the faster, tougher ace.",
	story: "Reports come in from Iron Coast: a strike fleet is forming inside Mediterranean waters that neither your side nor the opposing coast will claim.",
	phases: [PHASE.air(3), PHASE.ground(5, "warehouse"), PHASE.ace()],
	optionalRaiders: { count: 5, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 260,
};

// -------------------------------------------------------------------------
// Missions 3-27 — Glass Horizon campaign.
// Each is a hand-authored phase sequence intended to escalate pacing and vary
// terrain. See docs/glass-horizon-campaign.md for the design rationale.
// -------------------------------------------------------------------------

const MISSION_3: MissionDefinition = {
	id: 3,
	chapter: 1,
	name: "REEF PATROL",
	callsign: "KESTREL-03",
	environmentId: "reef_coast",
	briefing: "Sweep the Thalassa reef for scouts, then crack three fishing-boat relays feeding them targeting data.",
	story: "An unmarked trawler fleet is pinging friendly aircraft over the reef. Fleet orders are to clear the air first, then silence the relays.",
	phases: [PHASE.air(4), PHASE.ground(3, "relay")],
	targetTime: 220,
};

const MISSION_4: MissionDefinition = {
	id: 4,
	chapter: 1,
	name: "BREAKWATER",
	callsign: "KESTREL-04",
	environmentId: "port_breakwater",
	briefing: "Destroy four warehouses on the breakwater port while a staggered three-ship CAP tries to peel you off.",
	story: "The dock cranes you flew past as a cadet are stacking crates onto unmarked barges. Breakwater is the first strike your squadron commander admits he does not understand.",
	phases: [PHASE.ground(4, "warehouse"), PHASE.air(3, "interceptor")],
	optionalRaiders: { count: 3, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 260,
};

const MISSION_5: MissionDefinition = {
	id: 5,
	chapter: 1,
	name: "SIGNAL BLACKOUT",
	callsign: "KESTREL-05",
	environmentId: "desert_relay",
	briefing: "Knock out four desert relay dishes, then survive 45 seconds of pursuit while the signal gap carries home.",
	story: "The relays are the Network's southern throat. Keep them silent long enough that fleet intel can time the next intercept.",
	phases: [PHASE.ground(4, "relay"), PHASE.survive(45, "Keep the relays dark for 45 seconds while bandits pursue"), PHASE.air(2)],
	optionalRaiders: { count: 3, spawnOnPhase: "survive_pursuit", archetype: "bandit" },
	targetTime: 300,
};

const MISSION_6: MissionDefinition = {
	id: 6,
	chapter: 1,
	name: "OLIVE GROVE",
	callsign: "KESTREL-06",
	environmentId: "scattered_islands",
	briefing: "Five bandits move in two waves between the Olive Grove islands. Clean up the first wave before the second commits.",
	story: "Your wingmate wants to know why both sides pretend the trawlers do not exist. The sky over Olive Grove is the first that gives you a straight answer: nobody is pretending anymore.",
	phases: [PHASE.air(5)],
	targetTime: 240,
};

const MISSION_7: MissionDefinition = {
	id: 7,
	chapter: 1,
	name: "COLUMN OF SMOKE",
	callsign: "KESTREL-07",
	environmentId: "industrial_coast",
	briefing: "Six industrial warehouses line the coast. Four bandits CAP the strike. Pull the warehouses apart in any order.",
	story: "The warehouses were a civilian cannery the week you enlisted. Today they are something else, and your orders insist it was always that way.",
	phases: [PHASE.ground(6, "warehouse"), PHASE.air(4)],
	optionalRaiders: { count: 4, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 340,
};

const MISSION_8: MissionDefinition = {
	id: 8,
	chapter: 1,
	name: "NIGHT OVER THERA",
	callsign: "KESTREL-08",
	environmentId: "night_islands",
	briefing: "Four SAM launchers in the Thera chain can see you now. Punch them down, then finish the three-ship escort before the ace arrives.",
	story: "Your first night sortie. The runway lights fade behind you and the only directions are a static-torn voice and the shape of islands against darker water.",
	phases: [PHASE.ground(4, "sam"), PHASE.air(3), PHASE.ace("interceptor")],
	targetTime: 360,
};

const MISSION_9: MissionDefinition = {
	id: 9,
	chapter: 1,
	name: "FIRST DOUBT",
	callsign: "KESTREL-09",
	environmentId: "fleet_open_sea",
	briefing: "A command carrier is docked in open water with a defector aboard. Destroy the carrier, then survive the ace sent to erase the evidence.",
	story: "You are told the defector will be rescued. You are not told who gives the order to sink the carrier he is standing on. By the time the ace is on your six you know the answer.",
	phases: [PHASE.ground(1, "carrier", "Destroy the command carrier"), PHASE.air(3, "interceptor"), PHASE.ace()],
	targetTime: 320,
};

// -------------------------------------------------------------------------
// Act 2 - Gray Horizon
// -------------------------------------------------------------------------

const MISSION_10: MissionDefinition = {
	id: 10,
	chapter: 2,
	name: "RADAR MOUNTAIN",
	callsign: "SPEAR-10",
	environmentId: "radar_mountain",
	briefing: "Climb the Spear Range and knock four ridge radars off the peaks. Expect three bandits riding the thermals.",
	story: "The mountains were supposed to be dead ground. The radars that are not supposed to exist say otherwise.",
	phases: [PHASE.ground(4, "radar"), PHASE.air(3)],
	targetTime: 320,
};

const MISSION_11: MissionDefinition = {
	id: 11,
	chapter: 2,
	name: "DESERT RELAY CHAIN",
	callsign: "SPEAR-11",
	environmentId: "desert_relay",
	briefing: "Five relay dishes form the Chain. Collapse it, then dogfight the five-ship escort and the ace that leads them.",
	story: "The chain feeds every target to every side. Cutting it means neither coast will know who to blame first.",
	phases: [PHASE.ground(5, "relay"), PHASE.air(5), PHASE.ace()],
	targetTime: 420,
};

const MISSION_12: MissionDefinition = {
	id: 12,
	chapter: 2,
	name: "SAM BELT",
	callsign: "SPEAR-12",
	environmentId: "coastal_sam_belt",
	briefing: "Six SAM launchers stripe the shoreline. Peel them off; four bandits will try to pin you between the SAM arcs.",
	story: "You can see the launcher crews running when a tube goes up. Your flight engineer stops asking what you are flying against.",
	phases: [PHASE.ground(6, "sam"), PHASE.air(4)],
	optionalRaiders: { count: 3, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 360,
};

const MISSION_13: MissionDefinition = {
	id: 13,
	chapter: 2,
	name: "CARRIER HUNT",
	callsign: "SPEAR-13",
	environmentId: "fleet_open_sea",
	briefing: "A lone command carrier is making for international water. Sink it. The CAP of four bandits will try to buy it the horizon.",
	story: "You cannot find a flag on the carrier even in daylight. The order comes anyway, in the same voice as the training exercises.",
	phases: [PHASE.ground(1, "carrier", "Sink the command carrier"), PHASE.air(4)],
	targetTime: 300,
};

const MISSION_14: MissionDefinition = {
	id: 14,
	chapter: 2,
	name: "LANTERN PROTOCOL",
	callsign: "SPEAR-14",
	environmentId: "fleet_dawn",
	briefing: "Intercept six bomber drones before they close on the friendly carrier, then hold the air for 60 seconds while damage control works.",
	story: "The Lantern Protocol was supposed to be theoretical. The drones overhead did not read the memo.",
	phases: [PHASE.air(6, "interceptor"), PHASE.survive(60, "Hold the air for 60 seconds while damage control works")],
	optionalRaiders: { count: 2, spawnOnPhase: "survive_pursuit", archetype: "bandit" },
	targetTime: 360,
};

const MISSION_15: MissionDefinition = {
	id: 15,
	chapter: 2,
	name: "GHOST CONVOY",
	callsign: "SPEAR-15",
	environmentId: "desert_dusk",
	briefing: "Five warehouses and two relays rest beside a convoy track at dusk. Hit everything before the escort of five bandits closes.",
	story: "The convoy will not exist on any report. You will not exist to your family if you file one.",
	phases: [PHASE.ground(5, "warehouse"), PHASE.ground(2, "relay"), PHASE.air(5)],
	targetTime: 420,
};

const MISSION_16: MissionDefinition = {
	id: 16,
	chapter: 2,
	name: "HOLLOW MOUNTAIN",
	callsign: "SPEAR-16",
	environmentId: "radar_mountain",
	briefing: "Four mountain radars sit above the cloud deck. Collapse them, then clear five bandits and finish the ace waiting in the valley.",
	story: "The radars face inland. Whoever built them was not watching for the other side at all.",
	phases: [PHASE.ground(4, "radar"), PHASE.air(5), PHASE.ace("interceptor")],
	targetTime: 460,
};

const MISSION_17: MissionDefinition = {
	id: 17,
	chapter: 2,
	name: "RAIN LINE",
	callsign: "SPEAR-17",
	environmentId: "coast_storm",
	briefing: "The storm front gives you cover against six SAM launchers. Four bandits will try to use it the same way.",
	story: "Flight ops wants to scrub. The admiral does not. The rain goes on either way.",
	phases: [PHASE.ground(6, "sam"), PHASE.air(4)],
	targetTime: 400,
};

const MISSION_18: MissionDefinition = {
	id: 18,
	chapter: 2,
	name: "CONFESSION AT SEA",
	callsign: "SPEAR-18",
	environmentId: "fleet_open_sea",
	briefing: "The Network's regional commander is aboard a flagship. Four bandits intercept, then the ace himself. End it.",
	story: "The commander wrote the orders that turned your old flight school into Breakwater. You are told to let him finish his sentence.",
	phases: [PHASE.air(4, "interceptor"), PHASE.ground(1, "carrier", "Sink the command flagship"), PHASE.ace()],
	targetTime: 380,
};

// -------------------------------------------------------------------------
// Act 3 - Glass Horizon
// -------------------------------------------------------------------------

const MISSION_19: MissionDefinition = {
	id: 19,
	chapter: 3,
	name: "SWITCHBOARD",
	callsign: "GLASS-19",
	environmentId: "desert_relay",
	briefing: "Six relays form the Network's southern Switchboard. Collapse the lot. The four bandits already know you are coming.",
	story: "The Network treats Switchboard as a nervous reflex. You intend to make it a scar.",
	phases: [PHASE.ground(6, "relay"), PHASE.air(4, "interceptor"), PHASE.ace()],
	targetTime: 440,
};

const MISSION_20: MissionDefinition = {
	id: 20,
	chapter: 3,
	name: "SAM VEIL",
	callsign: "GLASS-20",
	environmentId: "coastal_sam_belt",
	briefing: "Eight SAM launchers form the Veil along the Mediterranean cliffs. Peel it. Five bandits will try to put you back under it.",
	story: "The Veil is the last layer that keeps the Network's fleet off the horizon. Tear it and both coasts can see what has been feeding them orders.",
	phases: [PHASE.ground(8, "sam"), PHASE.air(5)],
	optionalRaiders: { count: 3, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 480,
};

const MISSION_21: MissionDefinition = {
	id: 21,
	chapter: 3,
	name: "CARRIER PICKET",
	callsign: "GLASS-21",
	environmentId: "fleet_dawn",
	briefing: "Two Network carriers sail with a six-ship CAP. Sink both, clear the escort. Keep moving.",
	story: "This is the first morning the fleet calls themselves yours.",
	phases: [PHASE.air(3, "interceptor"), PHASE.ground(2, "carrier", "Sink both Network carriers"), PHASE.air(3)],
	targetTime: 460,
};

const MISSION_22: MissionDefinition = {
	id: 22,
	chapter: 3,
	name: "MOUNTAIN OF GLASS",
	callsign: "GLASS-22",
	environmentId: "radar_mountain",
	briefing: "Five peak radars make up the central Network sensor array. Smash them, then fight five bandits and the ace who built them.",
	story: "He designed the Spear Range radars for you to fly past; now he intends to use them against you.",
	phases: [PHASE.ground(5, "radar"), PHASE.air(5, "interceptor"), PHASE.ace()],
	targetTime: 500,
};

const MISSION_23: MissionDefinition = {
	id: 23,
	chapter: 3,
	name: "DEAD SIGNAL",
	callsign: "GLASS-23",
	environmentId: "desert_night",
	briefing: "Hit four Network relays, then hold the dark corridor for 90 seconds so the counter-signal reaches home.",
	story: "You will not see the sun again until the Network does not know your name.",
	phases: [PHASE.ground(4, "relay"), PHASE.survive(90, "Hold the dark corridor for 90 seconds"), PHASE.air(5, "interceptor")],
	optionalRaiders: { count: 4, spawnOnPhase: "survive_pursuit", archetype: "bandit" },
	targetTime: 500,
};

const MISSION_24: MissionDefinition = {
	id: 24,
	chapter: 3,
	name: "SUNFALL",
	callsign: "GLASS-24",
	environmentId: "industrial_coast",
	briefing: "Six warehouses, six bandits, one ace. Everything the Network stored for the next war is in there. Burn it.",
	story: "The man on the radio starts calling the Network ``it''. By the ace's second missile pass you understand why.",
	phases: [PHASE.ground(6, "warehouse"), PHASE.air(6), PHASE.ace()],
	optionalRaiders: { count: 4, spawnOnPhase: "destroy_ground_required", archetype: "bandit" },
	targetTime: 520,
};

const MISSION_25: MissionDefinition = {
	id: 25,
	chapter: 3,
	name: "THE MIRROR CARRIER",
	callsign: "GLASS-25",
	environmentId: "fleet_storm",
	briefing: "Three carriers hold the Mirror formation. Six bandits CAP them. Break the mirror before the storm closes.",
	story: "They painted your squadron's chevrons on the Mirror hulls. The point of the gesture is not clear until the third carrier burns.",
	phases: [PHASE.ground(1, "carrier", "Sink the first Mirror carrier"), PHASE.air(3, "interceptor"), PHASE.ground(1, "carrier", "Sink the second Mirror carrier"), PHASE.air(3), PHASE.ground(1, "carrier", "Sink the final Mirror carrier")],
	targetTime: 540,
};

const MISSION_26: MissionDefinition = {
	id: 26,
	chapter: 3,
	name: "EDGE OF THE HORIZON",
	callsign: "GLASS-26",
	environmentId: "radar_mountain_dawn",
	briefing: "Five mountain SAMs cover the Network's inland core. Peel them, then clear five bandits and finish the ace that trained you.",
	story: "He signed your flight log at graduation. You are told to put him in it one last time.",
	phases: [PHASE.ground(5, "sam"), PHASE.air(5, "interceptor"), PHASE.ace()],
	targetTime: 520,
};

const MISSION_27: MissionDefinition = {
	id: 27,
	chapter: 3,
	name: "GLASS HORIZON",
	callsign: "GLASS-27",
	environmentId: "glass_horizon_finale",
	briefing: "Three Network core radars, six bandits, and two aces defend the autonomous command node. End it. Nobody is listening on the other side anymore.",
	story: "The autonomous defense network is a glass arc over the Mediterranean. You go through it or you do not come back.",
	phases: [PHASE.ground(3, "radar", "Destroy the three Network core radars"), PHASE.air(6, "interceptor"), PHASE.ace("ace", "Destroy the inner-ring ace"), PHASE.ace("ace", "Destroy the Network overseer")],
	targetTime: 560,
};

const CATALOG: ReadonlyArray<MissionDefinition> = [
	MISSION_1, MISSION_2, MISSION_3, MISSION_4, MISSION_5, MISSION_6, MISSION_7, MISSION_8, MISSION_9,
	MISSION_10, MISSION_11, MISSION_12, MISSION_13, MISSION_14, MISSION_15, MISSION_16, MISSION_17, MISSION_18,
	MISSION_19, MISSION_20, MISSION_21, MISSION_22, MISSION_23, MISSION_24, MISSION_25, MISSION_26, MISSION_27,
];

export const MissionCatalog = {
	Count: MISSION_COUNT,
	Duration: MISSION_DURATION,
	All(): ReadonlyArray<MissionDefinition> {
		return CATALOG;
	},
	Get(id: number): MissionDefinition {
		assert(id === math.floor(id) && id >= 1 && id <= MISSION_COUNT, `Unknown mission ${id}`);
		return CATALOG[id - 1];
	},
	IsValidId(value: unknown): value is number {
		return typeIs(value, "number") && value === value && value >= 1 && value <= MISSION_COUNT && value % 1 === 0;
	},
	RequiredAirKills(definition: MissionDefinition): number {
		let total = 0;
		for (const phase of definition.phases) {
			if (phase.kind === "destroy_air_required" && phase.count !== undefined) total += phase.count;
			else if (phase.kind === "destroy_ace_required") total += phase.count ?? 1;
		}
		return total;
	},
	RequiredGroundKills(definition: MissionDefinition): number {
		let total = 0;
		for (const phase of definition.phases) {
			if (phase.kind === "destroy_ground_required" && phase.count !== undefined) total += phase.count;
			else if (phase.kind === "tutorial_missile" && phase.count !== undefined) total += phase.count;
		}
		return total;
	},
	/** Combined air + ground + survive seconds hint for the HUD "total" field. */
	HudTotal(definition: MissionDefinition): number {
		return MissionCatalog.RequiredAirKills(definition) + MissionCatalog.RequiredGroundKills(definition);
	},
	/** Mission 2 is the legacy ``Iron Coast'' profile which has 4 air kills (3 bandits + 1 ace) and 5 ground. */
	IsLegacyIronCoast(definition: MissionDefinition): boolean {
		return definition.id === 2;
	},
};
