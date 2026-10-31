import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { FighterArrival, GroundTargetType, StandaloneAce, TypedGroundTarget } from "../CampaignEncounters";
import type { LandingPlan } from "../EngineBatchB";
import type { RearmPlan } from "../EngineBatchC";
import type { SurfaceRoute } from "../EngineBatchD2";
import type { SortieArmament } from "../SortieArmament";
import type { FlightPoint, MissionBlueprint } from "../MissionCatalog";
import type { MissionStartPolicy } from "../MissionPolicy";
import { landingPose } from "../EngineBatchB";
import { M06, M06_WORLD_KEY, m06TargetLayout, type M06Target, type M06TargetType } from "../M06WorldPlan";
import { M06_AIRSPACE } from "../M06Limits";

/** World layout type -> combat target type (HUD label). The world's frigates fly the destroyer label (no frigate class in the engine). */
export const M06_TARGET_TYPES: { readonly [K in M06TargetType]: GroundTargetType } = {
	destroyer: "destroyer", frigate: "destroyer", cruiser: "cruiser", submarine: "submarine", missile_boat: "missile_boat",
	supply_ship: "supply_ship", landing_ship: "landing_ship", container_ship: "container_ship",
	crane: "crane", gas_tank: "gas_tank", fuel_tank: "fuel_tank", containers: "containers", storage: "storage",
	aa: "aa_gun", sam: "sam", gun: "gun_mount",
};
/** D-261: the spec's per-type values (m06 §4a); a frigate pays as a destroyer. */
export const M06_TARGET_POINTS: { readonly [K in M06TargetType]: number } = {
	destroyer: 100, frigate: 100, cruiser: 120, submarine: 120, missile_boat: 60, supply_ship: 100, landing_ship: 100, container_ship: 100,
	crane: 40, gas_tank: 40, fuel_tank: 40, containers: 40, storage: 40, aa: 20, sam: 30, gun: 30,
};
/** D-262: hull strength in standard-missile hits (55 each); the anti-ship XLAA (220) sinks any hull at once. */
export const M06_HULL_HEALTH: { readonly [K in M06TargetType]?: number } = {
	destroyer: 110, frigate: 110, cruiser: 165, submarine: 110, supply_ship: 110, landing_ship: 110, container_ship: 110,
};
const points: { [role: string]: number } = { fighter: 60, fighter_bomber: 60, helicopter: 50, ace: 240 };
for (const [kind, value] of pairs(M06_TARGET_POINTS)) points[kind] = value;

const layout = m06TargetLayout();
const NAVAL_GROUPS = new Set(["west", "central", "east"]);
const naval = (t: M06Target) => NAVAL_GROUPS.has(t.group);
/** A defence pontoon belongs to the hull it is moored beside: same basin, same row, 180 studs east (D-260). */
export function m06MountParent(mount: M06Target): M06Target | undefined {
	const basin = mount.group.gsub("_defence$", "")[0];
	return layout.find((t) => t.group === basin && t.z === mount.z && t.x === mount.x - 180);
}
/**
 * D-263: the three outer-channel cruisers slip their moorings and patrol the native-water channel (|x| < 3,400,
 * Z 2,740-4,940; legs Z 2,960-4,640 keep the 360-stud hull inside) at 18 studs/s: north first (their drawn heading), then a rectangle away from the centreline, three laps.
 */
export function m06OuterRoute(hull: M06Target): SurfaceRoute {
	const side = hull.x < -1 ? -1 : 1, x = hull.x, wide = x + side * 800;
	const waypoints: FlightPoint[] = [{ x, y: hull.y, z: hull.z }, { x, y: hull.y, z: 2960 }];
	for (let lap = 0; lap < 3; lap++) {
		waypoints.push({ x: wide, y: hull.y, z: 2960 }, { x: wide, y: hull.y, z: 4640 }, { x, y: hull.y, z: 4640 }, { x, y: hull.y, z: 2960 });
	}
	return { waypoints, speed: 18 };
}
// D-260: every world contact is one optional points target drawn once by the world: 36 naval hulls, the 40-contact
// ground roster (yards) and 18 moored defence mounts, which the reference credits as extra ground kills (40 + 18 = 58).
const targets: TypedGroundTarget[] = layout.map((t) => {
	const spec: TypedGroundTarget = {
		id: t.id, type: M06_TARGET_TYPES[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
		required: false, scoreRole: t.type, group: t.group,
	};
	if (naval(t)) { spec.naval = true; spec.health = M06_HULL_HEALTH[t.type]; }
	if (naval(t) && t.z === M06.outer.z) spec.route = m06OuterRoute(t);
	if (t.type === "sam") spec.sam = true;
	if (t.group.find("_defence")[0] !== undefined) spec.parentId = m06MountParent(t)?.id;
	return spec;
});

export const M06_START: MissionStartPolicy = { kind: "airborne", x: M06.start.x, y: M06.start.y, z: M06.start.z, headingDegrees: M06.start.headingDegrees, speed: 160 };
export const M06_GEAR_CLEARANCE = 6;
const runway = M06.runway;
/**
 * D-264: optional, repeatable rearm on the service runway south-west of the harbour, landing southbound (runway
 * one-eight) so a jet coming home from the quays meets the gate on its way. Same envelope as mission 5.
 */
export const M06_REARM_LANDING: LandingPlan = {
	touchdown: { x: runway.x, y: runway.y + M06_GEAR_CLEARANCE, z: runway.z - runway.length / 2 + 420 },
	headingDegrees: 180, approachDistance: 2400, approachSeconds: 20, rolloutDistance: 900, rolloutSeconds: 15, glideDegrees: 3,
};
const gate = landingPose(M06_REARM_LANDING, 0);
export const M06_REARM: RearmPlan = {
	zone: { x: runway.x, y: gate.y, z: gate.z }, radius: 1500, landing: M06_REARM_LANDING, takeoffSeconds: 20,
	missiles: true, special: true, gun: true, health: false, weaponMenu: true,
	radio: [
		{ at: 0.5, text: "COAST TOWER: Trainee, cleared to land, runway one-eight. Wind calm." },
		{ at: 9, text: "COAST TOWER: One mile. Slightly high. Ease it down." },
		{ at: 20.5, text: "COAST TOWER: Down and rolling. Crews are bringing the racks out." },
		{ at: 36, text: "COAST TOWER: Racks full, magazine full. Cleared for takeoff." },
	],
};
/**
 * D-265: finite sortie stocks so the service stop matters (m06 §10): 60 missiles, the special's own charges without
 * recharge, a 1,200-round gun, and the hull-only sea-skimming XLAA fit. A rearm restores all three.
 */
export const M06_ARMAMENT: SortieArmament = { gun: { rounds: 1200 }, stock: { missiles: 60 }, antiShip: true };

const central = M06.basins[1], east = M06.basins[2];
/** Two harbour helicopters circle the central basin above the 240-stud crane tops. */
const basinLap: FlightPoint[] = [
	{ x: central.x - 1600, y: 300, z: central.z + 1200 }, { x: central.x + 1600, y: 300, z: central.z + 1200 },
	{ x: central.x + 1600, y: 300, z: central.z - 2400 }, { x: central.x - 1600, y: 300, z: central.z - 2400 },
];
const helicopterRoute: FlightPoint[] = [];
for (let lap = 0; lap < 4; lap++) for (const p of basinLap) helicopterRoute.push(p);
// D-266: sixteen hostile aircraft against the reference's 11-contact roster: the owner asked for more attackers.
const strikeWaves: FighterArrival[] = [
	{ id: "m06_harbour_cap", trigger: { kind: "time", seconds: 20 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 180,
		call: "SERA: Four fighters up from the harbour field. They saw you coming." },
	{ id: "m06_basin_helicopters", trigger: { kind: "approach", x: central.x, z: central.z, radius: 6000 }, count: 2, role: "raider", scoreRole: "helicopter",
		aircraft: "helicopter", route: { waypoints: helicopterRoute, speed: 60 }, call: "LANTERN 2: Helicopters lifting off the central quay." },
	{ id: "m06_strike_pair", trigger: { kind: "approach", x: east.x, z: east.z, radius: 6000 }, count: 2, role: "raider", scoreRole: "fighter_bomber", headingDegrees: 230,
		call: "LANTERN 3: Two strike jets low over the east basin. Coming for us." },
	{ id: "m06_reserves", trigger: { kind: "time", seconds: 200 }, count: 3, role: "raider", scoreRole: "fighter", headingDegrees: 160,
		call: "HARBOUR CONTROL: All flights, launch! Defend the fleet!" },
	{ id: "m06_outer_patrol", trigger: { kind: "time", seconds: 420 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 20,
		call: "SERA: Two more from the south, off the outer channel." },
	{ id: "m06_last_flight", trigger: { kind: "time", seconds: 660 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 200,
		call: "LANTERN 2: Another pair inbound. They're throwing everything up." },
];
/** The reference's lone 240-point named fighter (~8:50 of active time), with an original callsign. */
const harbourWarden: StandaloneAce = {
	id: "m06_warden_lead", name: "WARDEN LEAD", livery: "Vulture", health: 165, trigger: { kind: "time", seconds: 510 },
	behaviour: "dogfight", scoreRole: "ace", headingDegrees: 180,
	call: "WARDEN LEAD: Warden Lead. Those ships are my charge, trainee.",
	stageLines: ["WARDEN LEAD: You fly like Teal. He didn't listen either.", "WARDEN LEAD: Warden is hit! Breaking off over the quays!"],
};
export const mission: MissionBlueprint = {
	id: 6, act: 1, codename: "Military quays", title: "IRON COAST", region: "coastal_harbor", environment: "ocean_clear",
	available: true, worldKey: M06_WORLD_KEY, airspace: M06_AIRSPACE, start: M06_START, countdownSeconds: 900,
	// D-051: LOW ALTITUDE reads clearance over the quays, cranes and northern hills.
	terrainRelativeWarnings: true,
	// D-266: hostile fighters keep the player as their main target, as mission 1.
	pressure: { playerPriority: 0.8, forwardConeDegrees: 25, tailDefence: true },
	armament: M06_ARMAMENT,
	// D-267: ranks inside the footage bounds (C <= 3,050; A <= 4,250; S in (4,770, 5,060]).
	scoring: { basis: "points", points, rank: { S: 5000, A: 4200, B: 3600, C: 3000 } },
	// D-268: allies fly for show until the per-sortie allied kill budget (#174) lands; then they get its default of one.
	allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", mayKill: false, creditPlayerKills: false, allowRequiredTargets: false,
		formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: 0, y: 40, z: 320 }] },
	primary: "Score 3,000 points at the Iron Coast quays within 15:00",
	briefing: MISSION_STORY_TEXT[6].briefing, debrief: MISSION_STORY_TEXT[6].debrief, failure: MISSION_STORY_TEXT[6].failure,
	ground: [],
	phases: [
		{
			kind: "score_threshold", label: "Score 3,000 points before 15:00",
			beat: "SERA: Iron Coast. Warships and fuel barges only; leave the market clear.",
			scoreThreshold: { points: 3000, seconds: 900, waitForExpiry: true },
			rearm: M06_REARM,
			chatter: [
				{ at: 0.25, text: "LANTERN 2: Ships are slipping their moorings. Catch them in the basin." },
				{ at: 0.5, text: "SERA: Halfway. The pontoon SAMs are still awake. Mind the warnings." },
				{ at: 0.9, text: "LANTERN 3: Nearly there. Don't stop at the number, trainee." },
				{ at: 1, text: MISSION_STORY_TEXT[6].radio[1] },
			],
			groundTargets: targets, fighterWaves: strikeWaves, standaloneAce: harbourWarden,
		},
	],
};
