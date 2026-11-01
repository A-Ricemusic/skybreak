import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { TypedGroundTarget, GroundTargetType } from "../CampaignEncounters";
import { M12, M12_WORLD_KEY, m12TargetLayout } from "../M12WorldPlan";
import { M12_AIRSPACE } from "../M12Limits";
import { landingPose } from "../LandingRules";
import type { LandingPlan } from "../LandingRules";

// D-460: adopt world ids; southeast wreck remains scenery, never a combat actor.
const types: { [key: string]: GroundTargetType } = { ring_gun: "railgun_emplacement", ground_ecm: "ground_ecm", aa: "aa_gun", sam: "sam" };
export const M12_TARGETS: TypedGroundTarget[] = m12TargetLayout().filter(t => t.live).map(t => ({
 id: t.id, type: types[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: t.yaw === 0 ? 0 : math.deg(t.yaw),
 required: t.type === "ring_gun", scoreRole: t.type, group: t.group,
 ecm: t.type === "ground_ecm" ? true : undefined, sam: t.type === "sam" ? true : undefined,
 health: t.type === "ring_gun" ? 165 : undefined,
}));
const landing: LandingPlan = {
 touchdown: { x: M12.service.x, y: M12.service.y + 6, z: M12.service.z - M12.service.length / 2 + 420 },
 headingDegrees: 180, approachDistance: 2400, approachSeconds: 20, rolloutDistance: 900, rolloutSeconds: 15, glideDegrees: 3,
};
const gate = landingPose(landing, 0);
export const mission: MissionBlueprint = {
 id: 12, act: 2, codename: "Vulture Two", title: "THE COMMAND RING", region: "plateau_relay", environment: "canyon_noon",
 available: true, worldKey: M12_WORLD_KEY, airspace: M12_AIRSPACE,
 start: { kind: "airborne", ...M12.start, speed: 160 }, countdownSeconds: 900, terrainRelativeWarnings: true,
 armament: { gun: { rounds: 1200 }, stock: { missiles: 54, specialCharges: 14 }, guidedBomb: { radius: 30, depth: 80, damage: 180 } },
 pressure: { playerPriority: 0.8, forwardConeDegrees: 25, tailDefence: true },
 allies: { count: 4, model: "Kestrel", callsignPrefix: "LANTERN", mayKill: true, killBudget: 1, creditPlayerKills: false, allowRequiredTargets: false,
  formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: -320, y: 40, z: 320 }, { x: 320, y: 40, z: 320 }] },
 scoring: { basis: "points", points: { ring_gun: 250, ground_ecm: 100, aa: 20, sam: 30, fighter: 60, ace: 240, bandit: 150 }, rank: { S: 2900, A: 2400, B: 2100, C: 1750 } },
 primary: "Destroy seven live guns in 15:00, then defeat one elite in 10:00",
 briefing: MISSION_STORY_TEXT[12].briefing, debrief: MISSION_STORY_TEXT[12].debrief, failure: MISSION_STORY_TEXT[12].failure,
 ground: [], phases: [
  { kind: "required_ground", count: 7, label: "Destroy seven live command guns", beat: MISSION_STORY_TEXT[12].radio[0], groundTargets: M12_TARGETS, concurrentFighters: 6,
   jamming: { visualLockRange: 650, remainingCall: "SERA: Central ECM active. Close for visual lock.", clearCall: "SERA: Jammer down. Radar and long-range locks restored." },
   rearm: { zone: { x: gate.x, y: gate.y, z: gate.z }, radius: 1500, landing, takeoffSeconds: 20, missiles: true, special: true, gun: true, health: false, weaponMenu: true,
    radio: [{ at: 0.5, text: "CRATER TOWER: Cleared to land. Your target damage is holding." }, { at: 36, text: "CRATER TOWER: Racks full. Cleared for departure." }] },
   ringSweep: { ceiling: 900, guns: M12_TARGETS.filter(t => t.required).map(t => ({ targetId: t.id, source: { ...t.position, y: 184 }, bearingDegrees: t.yaw === 0 ? 0 : -t.yaw })),
    warningSeconds: 8, countdownSeconds: 8, intervalSeconds: 30, damage: 25, sweepDegrees: 30, halfWidth: 80, range: 6000 },
   fighterWaves: [
    { id: "m12_cap", trigger: { kind: "phase_start", phase: 0 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 90 },
    { id: "m12_reserve", trigger: { kind: "time", seconds: 120 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 270 },
    { id: "m12_response", trigger: { kind: "time", seconds: 300 }, count: 4, role: "raider", scoreRole: "fighter", headingDegrees: 180 },
    { id: "m12_last_cover", trigger: { kind: "time", seconds: 480 }, count: 2, role: "raider", scoreRole: "fighter", headingDegrees: 45 },
   ],
   standaloneAce: { id: "m12_cairn", name: "CAIRN", livery: "Vulture", health: 165, behaviour: "dogfight", scoreRole: "ace", trigger: { kind: "time", seconds: 420 }, headingDegrees: 180, call: "CAIRN: Those guns answer to me. Clear the crater." },
   chatter: [{ at: 1/7, text: "SERA: Six live guns remain. Wreckage is no target." }, { at: 4/7, text: "LANTERN 2: Three left. Watch the barrel sweep." }, { at: 6/7, text: "SERA: One gun left. Keep clear of its firing line." }],
  },
  { kind: "required_air", count: 5, label: "Defeat one elite; mark ejection", execution: { directSpawn: true }, eliteFormation: { ejectionFlag: "vulture_two_recovered" },
   update: { objective: "Defeat one elite; survivors withdraw", countdownSeconds: 600, radio: [MISSION_STORY_TEXT[12].radio[1]] },
   cutIn: { at: 0, seconds: 6, subjects: ["bandit"], captions: [{ at: 0, text: "VULTURE TWO: You broke the array. Show me what Teal taught you." }], after: ["SERA: LANTERN, leave this to the trainee. Mark the ejection."] },
  },
 ],
};
