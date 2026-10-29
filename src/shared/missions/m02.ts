import type { FighterArrival, GroundTargetType, StandaloneAce, TypedGroundTarget } from "../CampaignEncounters";
import type { MissionBlueprint } from "../MissionCatalog";
import { M02, M02_RUNWAY, M02_WORLD_KEY, m02TargetLayout, type M02TargetType } from "../M02WorldPlan";
import { M02_AIRSPACE, M02_START } from "../M02Limits";

/** World layout type -> combat target type. The layout is the single source of ids, poses and groups. */
export const M02_TARGET_TYPES: { readonly [K in M02TargetType]: GroundTargetType } = {
	bomber: "parked_bomber", hangar: "hangar", aa: "aa_gun", control_tower: "control_tower", substation: "substation",
};
// D-057: parked bombers never escape; failure is shot down or timeout.
// D-058: existing missiles and gun substitute for reference bombs.
// Only the eleven parked bombers are indicated targets; the rest score points.
const targets: TypedGroundTarget[] = m02TargetLayout().map((t) => ({
	id: t.id, type: M02_TARGET_TYPES[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
	required: t.type === "bomber", scoreRole: M02_TARGET_TYPES[t.type], group: t.group,
}));
const base = M02.base;
// Eight aircraft in all, as the reference player killed: 2 head-on, 2 base defenders, 1 runway scramble, a late pair and the ace.
const waves: FighterArrival[] = [
	{ id: "m02_intercept", trigger: { kind: "time", seconds: 35 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 180,
		call: "LANTERN 2: Two bandits off the nose, low over the fields." },
	{ id: "m02_defenders", trigger: { kind: "approach", x: base.x, z: base.z, radius: 9000 }, count: 2, role: "raider", scoreRole: "fighter",
		spawn: { x: base.x, y: 700, z: base.z - 600 }, headingDegrees: 180, call: "FARM CONTROL: Raid from the south. This is not a drill!" },
	{ id: "m02_scramble", trigger: { kind: "approach", x: base.x, z: base.z, radius: 4500 }, count: 1, role: "raider", scoreRole: "fighter",
		spawn: { x: M02_RUNWAY.threshold.x, y: M02_RUNWAY.threshold.y, z: M02_RUNWAY.threshold.z }, headingDegrees: 0, scramble: true,
		call: "FARM CONTROL: Runway is yours. Get up, get up!" },
	{ id: "m02_late_pair", trigger: { kind: "required_count", count: 6 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 90,
		call: "SERA: Two more from the west valley. They waited for you." },
];
const ace: StandaloneAce = {
	id: "m02_ace", name: "HARROW SIX", livery: "Vulture", health: 165, trigger: { kind: "required_count", count: 4 },
	behaviour: "ground_attack", scoreRole: "ace", spawn: { x: base.x, y: 300, z: base.z - 1300 }, headingDegrees: 180,
	call: "HARROW SIX: Harrow Six, rolling in. Get off my pads, trainee.",
	stageLines: ["HARROW SIX: Varda paint on a Varda kid. Shame to waste it.", "HARROW SIX: Harrow, breaking low. Somebody cover the bombers!"],
};
export const mission: MissionBlueprint = {
	id: 2, act: 1, codename: "The Sealed Case", title: "NO ANIMALS", region: "upland_farm", environment: "farm_overcast",
	available: true, worldKey: M02_WORLD_KEY, airspace: M02_AIRSPACE, start: M02_START, countdownSeconds: 900,
	scoring: { basis: "points", points: { parked_bomber: 120, hangar: 50, aa_gun: 20, control_tower: 100, substation: 100, fighter: 60, ace: 240 },
		rank: { S: 2200, A: 1750, B: 1500, C: 1320 } },
	allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", creditPlayerKills: false, allowRequiredTargets: false,
		formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: 0, y: 40, z: 320 }] },
	primary: "Destroy all eleven parked bombers on the farm airfield",
	briefing: "The grain drums in Teal's manifest lead north to a 'farm' with a runway and no animals. Yesterday's bombers flew from it; eleven more are parked on its pads. Follow the power line and destroy them before they raid. Hangars, AA guns, the tower and the substation are optional. Hit aircraft, not the farmhouses.",
	debrief: "All eleven bombers are burning on their pads. The farm will not launch another raid. Sera wants to know who paid for its runway.",
	failure: "The bombers survived. The farm can launch its next raid.",
	ground: [],
	phases: [{
		kind: "required_ground", count: 11, label: "Destroy eleven parked bombers",
		beat: "SERA: Follow the power line north. Their bombers are parked on the farm.",
		chatter: [
			{ at: 1 / 11, text: "FARM CONTROL: Bombers, start engines! Get them off the ground!" },
			{ at: 4 / 11, text: "SERA: Four down. Their guns are still up, watch the base edges." },
			{ at: 8 / 11, text: "FARM CONTROL: The pads are burning. Nobody takes off from here." },
			{ at: 10 / 11, text: "LANTERN 2: One bomber left. Finish it, trainee." },
		],
		groundTargets: targets, fighterWaves: waves, standaloneAce: ace,
	}],
};
