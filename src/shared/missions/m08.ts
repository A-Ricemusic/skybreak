import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint, FlightPoint } from "../MissionCatalog";
import type { FighterArrival } from "../CampaignEncounters";
import { M08, M08_WORLD_KEY, m08TargetLayout } from "../M08WorldPlan";
import { M08_AIRSPACE } from "../M08Limits";

// D-320: GRND 000. Adopt the world's mast pose; never create a duplicate combat target.
export const M08_SITE_ID = "m08_broadcast_mast";
const mast = m08TargetLayout().filter(t => t.id === M08_SITE_ID)[0];
export const M08_SITE = { x: mast.x, y: mast.y, z: mast.z };
export const M08_BOMBER_IDS = [1, 2, 3, 4, 5, 6].map(i => `m08_west_bomber_${i}`);
// Long, non-jamming support patrols; existing radar-aircraft silhouette is a procedural stand-in.
const patrol: FlightPoint[] = [];
for (let lap = 0; lap < 3; lap++) for (const p of [{x:-9000,z:-9000},{x:9000,z:-9000},{x:9000,z:-4000},{x:-9000,z:-4000}]) patrol.push({ ...p, y: 1500 });
const waves: FighterArrival[] = [
 { id: "m08_opening", trigger: { kind: "phase_start", phase: 0 }, count: 8, role: "raider", scoreRole: "fighter", headingDegrees: 135 },
 { id: "m08_second", trigger: { kind: "time", seconds: 75 }, count: 8, role: "raider", scoreRole: "fighter", headingDegrees: 225 },
 { id: "m08_reserves", trigger: { kind: "time", seconds: 160 }, count: 8, role: "raider", scoreRole: "fighter", headingDegrees: 90 },
 { id: "m08_last_flight", trigger: { kind: "time", seconds: 270 }, count: 8, role: "raider", scoreRole: "fighter", headingDegrees: 180 },
 { id: "m08_tanker", trigger: { kind: "phase_start", phase: 0 }, count: 1, role: "raider", scoreRole: "tanker", aircraft: "jammer", route: { waypoints: patrol, speed: 100 } },
 { id: "m08_radar", trigger: { kind: "time", seconds: 60 }, count: 1, role: "raider", scoreRole: "radar", aircraft: "jammer", route: { waypoints: patrol.map(p => ({ ...p, z: p.z - 1000 })), speed: 100 } },
];
export const mission: MissionBlueprint = {
 id: 8, act: 2, codename: "The loyalist window", title: "OPEN FREQUENCY", region: "ocean_platform", environment: "ocean_clear",
 available: true, worldKey: M08_WORLD_KEY, airspace: M08_AIRSPACE,
 start: { kind: "airborne", ...M08.start, speed: 160 }, countdownSeconds: 420, terrainRelativeWarnings: true,
 pressure: { playerPriority: 0.8, forwardConeDegrees: 25, tailDefence: true },
 scoring: { basis: "points", points: { fighter: 60, ace: 240, tanker: 150, radar: 140, bomber: 150, escort: 60 }, rank: { S: 2900, A: 2400, B: 1700, C: 800 } },
 allies: { count: 3, model: "Kestrel", callsignPrefix: "LANTERN", killBudget: 1, creditPlayerKills: false, allowRequiredTargets: false,
  formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: 0, y: 40, z: 320 }] },
 primary: "Score 800 in 7:00, then intercept six western bombers and hold the transmitter for 6:00",
 briefing: MISSION_STORY_TEXT[8].briefing, debrief: MISSION_STORY_TEXT[8].debrief, failure: MISSION_STORY_TEXT[8].failure,
 ground: [], phases: [
  { kind: "score_threshold", label: "Score 800 points before 7:00", concurrentFighters: 8,
   beat: MISSION_STORY_TEXT[8].radio[0], scoreThreshold: { points: 800, seconds: 420, waitForExpiry: true }, fighterWaves: waves,
   standaloneAce: { id: "m08_prism", name: "PRISM LEAD", livery: "Vulture", health: 165, behaviour: "dogfight", scoreRole: "ace", trigger: { kind: "time", seconds: 300 }, headingDegrees: 90 },
  },
  { kind: "required_air", label: "Intercept bombers; hold broadcast", count: 6, concurrentFighters: 6,
   update: { objective: "Destroy six western bombers; protect the transmitter until 0:00", countdownSeconds: 360, radio: ["SERA: Six bombers west. Keep them off the tower until the window closes."] },
   interceptHold: { siteId: M08_SITE_ID, site: M08_SITE, siteName: "VARDA TRANSMITTER", ignitionSecondsRemaining: 35, ignitionCall: "SERA: Transmitter is live. Hold this sky for thirty-five seconds." },
   bombers: { count: 6, targetIds: M08_BOMBER_IDS, arrivalSeconds: [0, 15, 30, 45, 60, 75],
    waypoints: [{ ...M08.bomberEntry, y: 700 }, { ...M08.bomberMidpoint, y: 700 }], escape: { x: mast.x, y: 700, z: mast.z }, speed: 60,
    escapeCall: "SERA: A bomber reached the tower. We have lost the transmitter.",
    escorts: { count: 0, initial: 0, role: "escort", aceName: "NONE", aceAt: 0 } },
   fighterWaves: [{ id: "m08_cover", trigger: { kind: "phase_start", phase: 1 }, count: 6, role: "raider", scoreRole: "fighter", headingDegrees: 90 }],
  },
 ],
};
