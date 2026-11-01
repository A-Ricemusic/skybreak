import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { FighterArrival, GroundTargetType, TypedGroundTarget } from "../CampaignEncounters";
import type { RearmPlan } from "../RearmRules";
import type { GroundProgressPlan } from "../GroundSectorRules";
import { landingPose } from "../LandingRules";
import { M09, M09_SERVICE, M09_WORLD_KEY, m09TargetLayout, type M09TargetType } from "../M09WorldPlan";
import { M09_AIRSPACE } from "../M09Limits";

// D-340: the world's provisional credited roster, not a claim of all 83 reference contacts.
export const M09_TARGET_TYPES: Record<M09TargetType, GroundTargetType> = {
 radar: "radar_dome", battery: "artillery", pillbox: "bunker", tank: "tank", launcher: "vehicle", howitzer: "artillery", aa: "aa_gun", sam: "sam",
};
export const M09_TARGET_POINTS = { radar: 80, battery: 80, pillbox: 60, tank: 50, launcher: 70, howitzer: 60, aa: 20, heavy_aa: 40, sam: 30 };
let aa = 0;
export const M09_TARGETS: TypedGroundTarget[] = m09TargetLayout().map(t => ({
 id: t.id, type: M09_TARGET_TYPES[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
 required: false, group: t.group, scoreRole: t.type === "aa" && ++aa === 7 ? "heavy_aa" : t.type,
 ...(t.type === "sam" ? { sam: true as const } : {}),
}));
const landing = { touchdown: { ...M09_SERVICE.touchdown, y: M09_SERVICE.deckY + 6 }, headingDegrees: 0,
 approachDistance: 1360, approachSeconds: 17, rolloutDistance: 160, rolloutSeconds: 4, glideDegrees: 3 };
export const M09_REARM: RearmPlan = {
 zone: landingPose(landing, 0), radius: 1500, landing, takeoffSeconds: 10,
 carrier: { centre: { x: 0, y: M09_SERVICE.deckY + 6, z: M09.carrier.z }, width: 150, length: 560,
 catapult: { ...M09_SERVICE.catapult, y: M09_SERVICE.deckY + 6, z: M09_SERVICE.catapult.z + 16 } },
 missiles: true, special: true, gun: true, health: false, weaponMenu: true,
 radio: [{ at: 1, text: "DECK: Green deck. Bring her down on the angled stripe." }, { at: 23, text: "DECK: Weapons aboard. Taxi to the bow for launch." }],
};
// D-342: clear each sector's two batteries before its landing craft advances.
export const M09_GROUND_PROGRESS: GroundProgressPlan = { sectors: M09.beaches.map(b => ({
 id: b.group, clearTargetIds: M09_TARGETS.filter(t => t.group === b.group && t.scoreRole === "battery").map(t => t.id),
 seconds: 90, health: 300, kind: "landing_craft", route: { speed: 20, waypoints: [{ x: b.x, y: 40, z: b.z + 1800 }, { x: b.x, y: 40, z: b.z + 100 }] },
 advanceCall: `SHORE: ${b.group} guns clear. Landing craft advancing.`, securedCall: `SHORE: ${b.group} beach secured.`, hitCall: `SHORE: ${b.group} landing force under air attack!`,
})) };
const helicopters: FighterArrival[] = M09.beaches.map(b => ({
 id: `m09_${b.group}_helicopter`, trigger: { kind: "approach", x: b.x, z: b.z, radius: 6000 }, count: 1,
 role: "raider", scoreRole: "helicopter", aircraft: "helicopter", route: { speed: 55, waypoints: [
 { x: b.x - 1000, y: 650, z: b.z }, { x: b.x + 1000, y: 650, z: b.z }, { x: b.x + 1000, y: 650, z: b.z - 1600 }, { x: b.x - 1000, y: 650, z: b.z - 1600 },
 ] },
}));
export const M09_ATTACK_WAVES: FighterArrival[] = M09.beaches.map((b, i) => ({
 id: `m09_${b.group}_attack`, trigger: { kind: "time", seconds: 600 + i * 25 }, count: 3, role: "raider", required: true,
 scoreRole: "attack", attackSector: b.group, spawn: { x: b.x + 2500, y: 900, z: b.z - 4800 }, headingDegrees: 205,
 call: `SERA: Three attack jets closing on the ${b.group} landing.`,
}));
export const mission: MissionBlueprint = {
 id: 9, act: 2, codename: "The frigate ring", title: "GREEN BEACON", region: "coastal_harbor", environment: "ocean_clear",
 available: true, worldKey: M09_WORLD_KEY, airspace: M09_AIRSPACE, start: { kind: "airborne", ...M09.start, speed: 160 }, countdownSeconds: 600,
 terrainRelativeWarnings: true, armament: { gun: { rounds: 1200 }, stock: { missiles: 60 }, areaAttack: { radius: 220, depth: 80, damage: 180 } },
 pressure: { playerPriority: 0.8, forwardConeDegrees: 45, tailDefence: true },
 allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", killBudget: 1, creditPlayerKills: false, allowRequiredTargets: false,
 formation: [{ x: -180, y: 30, z: 160 }, { x: 180, y: 30, z: 160 }, { x: 0, y: 50, z: 320 }] },
 scoring: { basis: "points", points: { ...M09_TARGET_POINTS, fighter: 60, helicopter: 50, ace: 240, attack: 100 }, rank: { S: 4400, A: 4000, B: 3200, C: 2200 } },
 primary: "Score 2,200 in 10:00; stop nine attack jets in 7:00",
 briefing: MISSION_STORY_TEXT[9].briefing, debrief: MISSION_STORY_TEXT[9].debrief, failure: MISSION_STORY_TEXT[9].failure,
 ground: [], phases: [
 { kind: "score_threshold", label: "Suppress the three beach sectors", beat: MISSION_STORY_TEXT[9].radio[0],
 scoreThreshold: { points: 2200, seconds: 600, waitForExpiry: true }, rearm: M09_REARM, groundTargets: M09_TARGETS, concurrentFighters: 8,
 fighterWaves: [ ...helicopters,
 { id: "m09_cover", trigger: { kind: "time", seconds: 20 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 180 },
 { id: "m09_reserve", trigger: { kind: "time", seconds: 240 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 160 } ],
 standaloneAce: { id: "m09_squall", name: "SQUALL", livery: "Vulture", health: 165, behaviour: "dogfight", scoreRole: "ace", trigger: { kind: "time", seconds: 300 }, headingDegrees: 180 },
 chatter: [{ at: 0.5, text: "SERA: Teal taught us: weather hides a turn. Keep moving." }],
 },
 { kind: "required_air", count: 9, label: "Stop the beach attackers", concurrentFighters: 9,
 update: { objective: "Stop all nine attack jets; protect the landing forces", countdownSeconds: 420, radio: ["SERA: Attack jets inbound. Keep them off the green beacons."] },
 groundProgress: M09_GROUND_PROGRESS, fighterWaves: M09_ATTACK_WAVES,
 chatter: [{ at: 1, text: MISSION_STORY_TEXT[9].radio[1] }],
 },
 ],
};
