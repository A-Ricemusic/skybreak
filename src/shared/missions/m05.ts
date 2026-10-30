import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { FighterArrival, GroundTargetType, StandaloneAce, TypedGroundTarget } from "../CampaignEncounters";
import type { LandingPlan, ReturnLine } from "../EngineBatchB";
import type { RearmPlan } from "../EngineBatchC";
import type { CutInPlan } from "../SortieCutaways";
import type { FlightPoint, MissionBlueprint } from "../MissionCatalog";
import type { MissionStartPolicy } from "../MissionPolicy";
import { landingPose } from "../EngineBatchB";
import { nightLightingFromAnchors, type NightLighting } from "../NightLighting";
import { M05, M05_TARGET_POINTS, M05_WORLD_KEY, m05LightAnchors, m05TargetLayout, type M05TargetType } from "../M05WorldPlan";
import { M05_AIRSPACE } from "../M05Limits";

/** World layout type -> combat target type (HUD label). The layout is the single source of ids, poses and groups. */
export const M05_TARGET_TYPES: { readonly [K in Exclude<M05TargetType, "helicopter">]: GroundTargetType } = {
	crane: "crane", tower: "rig_tower", control_room: "control_room", sam: "sam", aa: "aa_gun",
	fuel_tank_large: "fuel_tank", fuel_tank: "fuel_tank", gas_tank: "gas_tank", refinery_unit: "refinery", smokestack: "smokestack",
	pump_station: "pump_station", refinery_command: "command_post", tanker: "tanker",
};
/** Scoring role of each layout type: the world's ledger keys, so the two large and standard tank values stay distinct. */
const ROLE: { readonly [K in M05TargetType]: string } = {
	crane: "crane", tower: "rig_tower", control_room: "control_room", sam: "sam", aa: "aa_gun",
	fuel_tank_large: "fuel_tank_large", fuel_tank: "fuel_tank", gas_tank: "gas_tank", refinery_unit: "refinery_unit", smokestack: "smokestack",
	pump_station: "pump_station", refinery_command: "command_post", tanker: "tanker", helicopter: "helicopter",
};
const points: { [role: string]: number } = { fighter: 60, ace: 240, elite: 150 };
for (const [kind, value] of pairs(M05_TARGET_POINTS)) points[ROLE[kind]] = value;

// D-100: every rig, refinery and shipping contact is an optional points target drawn once by the world.
// The three helicopters are flying targets (route aircraft), so their world poses become route starts instead.
const layout = m05TargetLayout();
const targets: TypedGroundTarget[] = layout.filter((t) => t.type !== "helicopter").map((t) => ({
	id: t.id, type: M05_TARGET_TYPES[t.type as Exclude<M05TargetType, "helicopter">], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
	required: false, scoreRole: ROLE[t.type], group: t.group,
}));
const helicopterPoses = layout.filter((t) => t.type === "helicopter");

export const M05_START: MissionStartPolicy = { kind: "airborne", x: M05.start.x, y: M05.start.y, z: M05.start.z, headingDegrees: M05.start.headingDegrees, speed: 160 };
/** The world's withdrawal line, 2,700 studs south of the base, crossed southbound (+Z). */
export const M05_RETURN_LINE: ReturnLine = {
	a: { x: M05.returnLine.x1, z: M05.returnLine.z }, b: { x: M05.returnLine.x2, z: M05.returnLine.z }, direction: { x: 0, z: 1 }, markerY: 600,
};
/** Aircraft pivot above the runway surface at touchdown, as mission 3. */
export const M05_GEAR_CLEARANCE = 6;
const runway = M05.runway;
/**
 * D-101: an optional, repeatable rearm on the southern runway, landing southbound (runway one-eight) so a jet coming
 * home from the targets meets the gate on its way. Touchdown 420 studs inside the north threshold; the 3° approach
 * starts 2,400 studs out over the water at 120 studs/s; rollout 900 studs; a TAKEOFF / CHANGE WEAPON menu; 20 s takeoff.
 */
export const M05_REARM_LANDING: LandingPlan = {
	touchdown: { x: runway.x, y: runway.y + M05_GEAR_CLEARANCE, z: runway.z - runway.length / 2 + 420 },
	headingDegrees: 180, approachDistance: 2400, approachSeconds: 20, rolloutDistance: 900, rolloutSeconds: 15, glideDegrees: 3,
};
const gate = landingPose(M05_REARM_LANDING, 0);
export const M05_REARM: RearmPlan = {
	zone: { x: runway.x, y: gate.y, z: gate.z }, radius: 1500, landing: M05_REARM_LANDING, takeoffSeconds: 20,
	missiles: true, special: true, health: false, weaponMenu: true,
	radio: [
		{ at: 0.5, text: "SHORE TOWER: Trainee, you're cleared to land, runway one-eight." },
		{ at: 9, text: "SHORE TOWER: One mile. On the glide path, hold it there." },
		{ at: 20.5, text: "SHORE TOWER: Touchdown. Ground crew's loading you now." },
		{ at: 36, text: "SHORE TOWER: Cleared for takeoff. Height limit lifted. Go back." },
	],
};
const rig = M05.rig, refinery = M05.refinery;
/**
 * D-108, from the Studio night check. The world's anchors (384 refinery, 8 rig, 50 runway, 8 searchlights) stay as
 * authored, except that a refinery point inside a structure's footprint moves to that structure's roof (the 120-stud
 * grid at Y=60 otherwise sits inside tanks up to 72 studs tall). Each of the rig's eight working decks (280 x 600, top
 * Y=120, X = 8,340 + 360i, centred on Z = -7,500) also gets a 2 x 4 deck-light field: in Studio the rig read as a black
 * silhouette with one light per deck. 506 points, inside D-073's 512-point budget.
 */
const ROOF: { readonly [K in M05TargetType]?: { radius: number; height: number } } = {
	fuel_tank_large: { radius: 68, height: 72 }, fuel_tank: { radius: 50, height: 72 }, gas_tank: { radius: 32, height: 40 },
	smokestack: { radius: 14, height: 360 }, refinery_unit: { radius: 14, height: 96 }, control_room: { radius: 28, height: 32 },
	pump_station: { radius: 28, height: 32 }, refinery_command: { radius: 28, height: 32 }, aa: { radius: 12, height: 16 },
};
export function m05LightPoint(x: number, y: number, z: number): FlightPoint {
	let top = y;
	for (const t of layout) {
		const roof = ROOF[t.type];
		if (roof && t.group === "refinery" && math.abs(x - t.x) <= roof.radius + 3 && math.abs(z - t.z) <= roof.radius + 3) top = math.max(top, t.y + roof.height + 3);
	}
	return { x, y: top, z };
}
const anchorLighting = nightLightingFromAnchors(m05LightAnchors());
export const M05_NIGHT_LIGHTING: NightLighting = {
	fields: [
		...anchorLighting.fields.map((f) => ({ ...f, origin: m05LightPoint(f.origin.x, f.origin.y, f.origin.z) })),
		...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ origin: { x: 8340 + i * 360 - 90, y: 124, z: -7500 - 270 }, rows: 4, columns: 2, spacing: 180, realLights: 0 })),
	],
	searchlights: anchorLighting.searchlights,
};
/** Two laps of the platform at 260 studs (cranes top out at 240), 60 studs/s: they defend it for most of the strike. */
const rigLap: FlightPoint[] = [
	{ x: helicopterPoses[0].x, y: 260, z: helicopterPoses[0].z }, { x: 11300, y: 260, z: -6600 }, { x: 11300, y: 260, z: -8400 },
	{ x: 7900, y: 260, z: -8400 }, { x: 7900, y: 260, z: -6600 },
];
const helicopterRoute: FlightPoint[] = [];
for (let lap = 0; lap < 4; lap++) for (const p of rigLap) helicopterRoute.push(p);
// D-102: ten enemy aircraft as the select screen (ENEMY AIR 010): six fighters, the named ace and three helicopters.
const strikeWaves: FighterArrival[] = [
	{ id: "m05_interceptors", trigger: { kind: "time", seconds: 40 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 200,
		call: "SERA: Two interceptors off the platform, low over the water." },
	{ id: "m05_rig_helicopters", trigger: { kind: "approach", x: rig.x, z: rig.z, radius: 6500 }, count: 3, role: "raider", scoreRole: "helicopter",
		aircraft: "helicopter", route: { waypoints: helicopterRoute, speed: 60 }, call: "LANTERN 2: Helicopters lifting off the platform. Three of them." },
	{ id: "m05_reserves", trigger: { kind: "time", seconds: 150 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 160,
		call: "WORKS CONTROL: All reserves, get up! Protect the platform!" },
	{ id: "m05_late_pair", trigger: { kind: "time", seconds: 330 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 150,
		call: "SERA: Two more bandits, bearing three-three-zero. Fast movers." },
];
const cinderLead: StandaloneAce = {
	id: "m05_cinder_lead", name: "CINDER LEAD", livery: "Vulture", health: 165, trigger: { kind: "approach", x: refinery.x, z: refinery.z, radius: 7000 },
	behaviour: "dogfight", scoreRole: "ace", headingDegrees: 90,
	call: "CINDER LEAD: Cinder Lead on station. Nobody burns my works and leaves.",
	stageLines: ["CINDER LEAD: That's a trainee? Somebody lied to me.", "CINDER LEAD: Cinder is hit! Breaking off over the tanks!"],
};
// D-074 / D-103: the surprise elite flight. Vulture Lead (Vulture livery, 240 like every named ace) leads four Elite
// wingmen (150 each) 12 s after the clock runs out, from the north, behind a jet heading home; none are required.
const ELITE_AT = 612;
const vultureLead: StandaloneAce = {
	id: "m05_vulture_lead", name: "VULTURE LEAD", livery: "Vulture", health: 165, trigger: { kind: "time", seconds: ELITE_AT },
	behaviour: "dogfight", scoreRole: "ace", headingDegrees: 180,
	stageLines: ["VULTURE LEAD: Teal flew like that. Right up until the pass.", "VULTURE LEAD: Vulture Lead is hit. Somebody get this kid off me!"],
};
const eliteWing: FighterArrival[] = [
	{ id: "m05_vulture_wing", trigger: { kind: "time", seconds: ELITE_AT }, count: 4, role: "raider", scoreRole: "elite", livery: "Elite", headingDegrees: 186 },
];
/** Reference: a HUD-less cut-in of the five under the moon, with the clock paused, then their clearance call. */
export const M05_CUT_IN: CutInPlan = {
	at: ELITE_AT, seconds: 9, subjects: ["ace", "elite"],
	captions: [
		{ at: 0.3, text: "LANTERN 2: Five of them. No lights. That's the Vulture flight." },
		{ at: 4.6, text: "SERA: All aircraft, disengage. Head south across the line, now." },
	],
	after: [
		"VULTURE LEAD: Vulture flight, you're cleared. Anything that isn't ours.",
		"LANTERN 3: Don't engage them! Jettison and run for the line!",
	],
};
export const mission: MissionBlueprint = {
	id: 5, act: 1, codename: "Fuel under grain", title: "LIGHTS OFF", region: "ocean_platform", environment: "ocean_night",
	available: true, worldKey: M05_WORLD_KEY, airspace: M05_AIRSPACE, start: M05_START, countdownSeconds: 600,
	// D-051: LOW ALTITUDE reads clearance over the decks, tanks and coastal hills at night.
	terrainRelativeWarnings: true,
	// D-073: the world's 392 industrial, 50 runway and 8 searchlight anchors, within the phone light budget.
	nightLighting: M05_NIGHT_LIGHTING,
	// D-104: provisional ranks inside the footage bounds (m05 A2).
	scoring: { basis: "points", points, rank: { S: 4000, A: 3000, B: 2500, C: 2000 } },
	allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", creditPlayerKills: false, allowRequiredTargets: false,
		formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: 0, y: 40, z: 320 }] },
	primary: "Score 2,000 points at the fuel works within 10:00, then withdraw south",
	// D-130 / #159: the remapped Broken Relay story owns the briefing and results text.
	briefing: MISSION_STORY_TEXT[5].briefing, debrief: MISSION_STORY_TEXT[5].debrief, failure: MISSION_STORY_TEXT[5].failure,
	ground: [],
	phases: [
		{
			kind: "score_threshold", label: "Score 2,000 points before 10:00",
			beat: "SERA: Rig to the east, refinery to the west. Burn them before dawn.",
			scoreThreshold: { points: 2000, seconds: 600, waitForExpiry: true },
			rearm: M05_REARM,
			chatter: [
				{ at: 0.25, text: "LANTERN 2: Tanks are going up like flares. Keep it coming." },
				{ at: 0.5, text: "SERA: Halfway there. The platform's guns are still awake." },
				{ at: 0.9, text: "LANTERN 3: Nearly there. Don't stop at the number, trainee." },
				{ at: 1, text: "SERA: That's two thousand. Keep burning it until the clock runs out." },
			],
			groundTargets: targets, fighterWaves: strikeWaves, standaloneAce: cinderLead,
		},
		{
			kind: "return_line", label: "Withdraw south across the line", returnLine: M05_RETURN_LINE,
			update: {
				objective: "Withdraw south across the line before the clock runs out", countdownSeconds: 240,
				// The second line is #159's planned story radio for mission 5, wired as exact text.
				radio: ["SERA: Clock's out and the works is burning. Good. Now go south.", MISSION_STORY_TEXT[5].radio[1]],
			},
			cutIn: M05_CUT_IN,
			fighterWaves: eliteWing, standaloneAce: vultureLead,
		},
	],
};
