import type { FighterArrival, GroundTargetType, StandaloneAce, TypedGroundTarget } from "../CampaignEncounters";
import type { LandingPlan, ReturnLine } from "../LandingRules";
import type { MissionBlueprint } from "../MissionCatalog";
import type { MissionStartPolicy } from "../MissionPolicy";
import { M03, M03_RUNWAY_TOP, M03_WORLD_KEY, m03TargetLayout, type M03Target } from "../M03WorldPlan";
import { M03_AIRSPACE } from "../M03Limits";

/** World layout type -> combat target type. The layout is the single source of ids, poses and sites. */
export const M03_TARGET_TYPES: { readonly [K in M03Target["type"]]: GroundTargetType } = {
	radar: "radar_dome", aaGun: "aa_gun", helicopter: "parked_helicopter",
};
// D-061: a site's trigger group is its radar domes alone, so "site 1 destroyed" means its five domes;
// the AA guns and helicopter keep the site name with a "_defence" suffix.
const targets: TypedGroundTarget[] = m03TargetLayout().map((t) => ({
	id: t.id, type: M03_TARGET_TYPES[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
	required: t.type === "radar", scoreRole: M03_TARGET_TYPES[t.type], group: t.type === "radar" ? t.group : `${t.group}_defence`,
}));
/** Altitude of the airborne start: a ridge of about 700-764 studs crosses the opening heading 15-20 s out, which the
 * world plan's 640 would fly into hands-off (measured in Studio); 880 clears the first 50 s by over 100 studs. */
export const M03_START_ALTITUDE = 880;
/** Airborne start from the world plan: heading about 313° (CFrame yaw +47.3°) toward site 1, three LANTERN wingmen. */
export const M03_START: MissionStartPolicy = {
	kind: "airborne", x: M03.start.x, y: M03_START_ALTITUDE, z: M03.start.z, headingDegrees: M03.start.headingDegrees, speed: 160,
};
/** PR #139's return line: X ±13,500 at Z=11,040, crossed southbound (+Z). */
export const M03_RETURN_LINE: ReturnLine = {
	a: { x: M03.returnLine.x1, z: M03.returnLine.z }, b: { x: M03.returnLine.x2, z: M03.returnLine.z }, direction: { x: 0, z: 1 }, markerY: 1000,
};
/** Aircraft pivot above the runway surface at touchdown; the cockpit camera rides 5 studs above it. */
export const M03_GEAR_CLEARANCE = 6;
const runway = M03.landing;
/**
 * D-063: automatic northbound landing on the M03 runway. Touchdown 520 studs inside the south threshold; the
 * 3° approach starts 2,100 studs out (inside the soft airspace) at 87.5 studs/s, then a 14 s rollout whose last
 * 4 s hold MISSION ACCOMPLISHED. Landing-only 3:00 clock as in the reference.
 */
export const M03_LANDING: LandingPlan = {
	touchdown: { x: runway.x, y: M03_RUNWAY_TOP + M03_GEAR_CLEARANCE, z: runway.z + runway.length / 2 - 520 },
	headingDegrees: runway.headingDegrees, approachDistance: 2100, approachSeconds: 24, rolloutDistance: 612.5, rolloutSeconds: 14,
	glideDegrees: 3, countdownSeconds: 180, accomplishedSeconds: 4,
	radio: [
		{ at: 0.5, text: "RIM TOWER: Trainee, gear check. Cleared to land, runway three-six." },
		{ at: 7, text: "RIM TOWER: Runway in sight. You're on the centreline." },
		{ at: 14, text: "RIM TOWER: Short final. Glide path is good, hold it there." },
		{ at: 24.5, text: "RIM TOWER: Touchdown. Nice and gentle." },
		{ at: 34.5, text: "RIM TOWER: Welcome home. Sera wants that film before you unstrap." },
	],
};
// D-062: the reference roster. Two fighter-bombers head-on and three escorts from the start; site 1's five
// domes bring two fighters and the ace from between the sites. Every fighter is 60 points, the ace 240.
const site1 = M03.site1, site2 = M03.site2;
const waves: FighterArrival[] = [
	{ id: "m03_strike_pair", trigger: { kind: "time", seconds: 10 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 133,
		call: "RIDGE STATION: Intruders from the south-east. Fighters, intercept." },
	{ id: "m03_escorts", trigger: { kind: "time", seconds: 39 }, count: 3, role: "raider", scoreRole: "fighter", headingDegrees: 150,
		call: "RIDGE STATION: Escorts, keep them away from the domes!" },
	{ id: "m03_second_wave", trigger: { kind: "ground_group", group: "site1" }, count: 2, role: "raider", scoreRole: "fighter",
		spawn: { x: -4800, y: 1300, z: -5000 }, headingDegrees: 121,
		call: "SERA: Site one is silent. Three fighters inbound from the west." },
];
const ace: StandaloneAce = {
	id: "m03_ace", name: "CAIRN LEAD", livery: "Vulture", health: 165, trigger: { kind: "ground_group", group: "site1" },
	behaviour: "dogfight", scoreRole: "ace", spawn: { x: -5200, y: 1400, z: -5300 }, headingDegrees: 121,
	call: "CAIRN LEAD: You found our little station. Now you stay up here.",
	stageLines: ["CAIRN LEAD: A training jet. They sent a training jet.", "CAIRN LEAD: Missile! Breaking hard. Cairn is hit!"],
};
export const mission: MissionBlueprint = {
	id: 3, act: 1, codename: "An Unlisted Station", title: "NOBODY SIGNED", region: "snow_mountains", environment: "ocean_clear",
	available: true, worldKey: M03_WORLD_KEY, airspace: M03_AIRSPACE, start: M03_START, countdownSeconds: 900,
	// D-051: LOW ALTITUDE measures clearance over the mountains, not height above the valley datum.
	terrainRelativeWarnings: true,
	scoring: { basis: "points", points: { radar_dome: 100, aa_gun: 20, parked_helicopter: 40, fighter: 60, ace: 240 },
		rank: { S: 1300, A: 1150, B: 1000, C: 900 } },
	allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", creditPlayerKills: false, allowRequiredTargets: false,
		formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: 0, y: 40, z: 320 }] },
	primary: "Destroy all nine radar domes, then return to base",
	briefing: "Teal's receiver names a radar inside our own training box that nobody signed for: nine domes on two snowy mountain sites north-west of the pass. Destroy all nine with the gun camera running, then turn south across the return line and land with the film. AA guns and a parked helicopter are optional.",
	debrief: "Nine domes are down and the film is home. Sera locks the gun-camera tape in her desk: the station watched trainees, and its memory names the Teklan orchard.",
	failure: "The station is still watching, and the film never reached Varda Rim.",
	ground: [],
	phases: [{
		kind: "required_ground", count: 9, label: "Destroy nine radar domes",
		beat: "SERA: Enemy airspace. Site one is on the ridge north-west of you.",
		chatter: [
			{ at: 1 / 9, text: "LANTERN 2: Dome down. Good hit, trainee." },
			{ at: 5 / 9, text: "SERA: Five domes down. Site two is on the saddle west-north-west." },
			{ at: 8 / 9, text: "LANTERN 2: One dome left. Finish it and we go home." },
		],
		groundTargets: targets, fighterWaves: waves, standaloneAce: ace,
	}, {
		kind: "return_line", label: "Return to base", returnLine: M03_RETURN_LINE,
		update: {
			objective: "Return to base: fly south across the return line", countdownSeconds: 900,
			radio: [
				"SERA: All nine domes confirmed destroyed. Good work.",
				"SERA: All aircraft, turn south. Cross the return line to leave the area.",
				"SERA: Follow the green cue to the white dashes on the ground below.",
			],
		},
	}, {
		kind: "landing", label: "Land at Varda Rim", landing: M03_LANDING,
	}],
};

