import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { GroundTargetType, TypedGroundTarget, FighterArrival } from "../CampaignEncounters";
import { M07, M07_CANYON, M07_WORLD_KEY, m07TargetLayout, type M07TargetType } from "../M07WorldPlan";
import { M07_AIRSPACE } from "../M07Limits";

export const M07_TARGET_TYPES: { readonly [K in M07TargetType]: GroundTargetType } = {
 solar_panel: "solar_panel", radar: "radar_dome", control_room: "control_room", solar_tower: "solar_tower",
 flak: "flak_gun", sam: "sam", aa: "aa_gun", pillbox: "pillbox",
};
// D-280: preserve stable world ids and all 52 drawings; the last panel is scenery, not a contact.
export const M07_SCENERY_ID = "m07_plant_solar_panel_41";
export const M07_TARGETS: TypedGroundTarget[] = m07TargetLayout().filter(t => t.id !== M07_SCENERY_ID).map(t => ({
 id: t.id, type: M07_TARGET_TYPES[t.type], position: { x: t.x, y: t.y, z: t.z }, yaw: math.deg(t.yaw),
 required: t.type === "radar" || t.type === "control_room" || t.type === "solar_tower", scoreRole: t.type, group: t.group,
}));
const route = [
 { x: -1100, y: 400, z: -9800 }, { x: 1400, y: 400, z: -9800 },
 { x: 1400, y: 400, z: -7400 }, { x: -1100, y: 400, z: -7400 },
];
const helicopterRoute = [];
for (let lap = 0; lap < 10; lap++) for (const point of route) helicopterRoute.push(point);
const waves: FighterArrival[] = [
 { id: "m07_approach", trigger: { kind: "phase_start", phase: 0 }, count: 6, role: "raider", scoreRole: "fighter", headingDegrees: 180 },
 { id: "m07_middle", trigger: { kind: "approach", x: M07.middle.x, z: M07.middle.z, radius: 6500 }, count: 5, role: "raider", scoreRole: "fighter", headingDegrees: 180 },
 { id: "m07_plant", trigger: { kind: "approach", x: M07.plant.x, z: M07.plant.z, radius: 6500 }, count: 5, role: "raider", scoreRole: "fighter", headingDegrees: 160 },
 { id: "m07_helicopters", trigger: { kind: "approach", x: M07.plant.x, z: M07.plant.z, radius: 6500 }, count: 3, role: "raider", scoreRole: "helicopter", aircraft: "helicopter", route: { waypoints: helicopterRoute, speed: 60 } },
];
export const mission: MissionBlueprint = {
 id: 7, act: 2, codename: "Two ridges", title: "ARRAY BREAK", region: "canyon_pass", environment: "canyon_dusk",
 available: true, worldKey: M07_WORLD_KEY, airspace: M07_AIRSPACE,
 start: { kind: "airborne", ...M07.start, speed: 160 }, countdownSeconds: 900, terrainRelativeWarnings: true,
 armament: { gun: { rounds: 1200 }, areaAttack: { radius: 220, depth: 80, damage: 180 } },
 pressure: { playerPriority: 0.8, forwardConeDegrees: 60, tailDefence: true },
 // Shared per-sortie budget permits approximately one optional allied kill.
 allies: { count: 2, model: "Kestrel", callsignPrefix: "LANTERN", killBudget: 1, creditPlayerKills: false, allowRequiredTargets: false,
  formation: [{ x: -180, y: 30, z: 160 }, { x: 180, y: 30, z: 160 }] },
 scoring: { basis: "points", points: { solar_panel: 15, radar: 100, control_room: 120, solar_tower: 120, flak: 40, sam: 30, aa: 20, pillbox: 60, fighter: 60, helicopter: 50, ace: 240 }, rank: { S: 1600, A: 1400, B: 1000, C: 340 } },
 primary: "Destroy three marked installations in 15:00, then escape south in 5:00",
 briefing: MISSION_STORY_TEXT[7].briefing, debrief: MISSION_STORY_TEXT[7].debrief, failure: MISSION_STORY_TEXT[7].failure,
 ground: [], phases: [
  { kind: "required_ground", count: 3, label: "Copy logs; cut three transmitters", beat: MISSION_STORY_TEXT[7].radio[0],
   groundTargets: M07_TARGETS, fighterWaves: waves,
   standaloneAce: { id: "m07_shale", name: "SHALE", livery: "Vulture", health: 165, behaviour: "dogfight", scoreRole: "ace", trigger: { kind: "approach", x: M07.plant.x, z: M07.plant.z, radius: 6000 }, headingDegrees: 180 },
   chatter: [{ at: 1 / 3, text: "SERA: Lira log copied. Keep moving to the next installation." }, { at: 2 / 3, text: "SERA: Merel log copied. One transmitter remains." }],
  },
  { kind: "return_line", label: "Below 2,000 ft; escape south",
   update: { objective: "Descend below 2,000 ft; use canyon cover and exit south", countdownSeconds: 300, radio: [MISSION_STORY_TEXT[7].radio[1]] },
   returnLine: { a: { x: -1200, z: M07.escape.z }, b: { x: 1200, z: M07.escape.z }, direction: { x: 0, z: 1 }, markerY: 200 },
   canyonEscape: { ceiling: M07.artilleryCeiling, source: { x: 10000, y: 1600, z: -12000 }, warningSeconds: 8, countdownSeconds: 7, intervalSeconds: 25, damage: 35, clearance: 40,
    channel: M07_CANYON.map(p => ({ x: p.x, y: p.floor + 80, z: p.z })) },
  },
 ],
};
