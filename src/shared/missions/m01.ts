import { BomberRules } from "../BomberRules";
import type { MissionBlueprint } from "../MissionCatalog";
import { M01, M01_WORLD_KEY } from "../M01Geometry";
import { M01_AIRSPACE } from "../M01Limits";
import { m01CarrierFlyoffStart } from "../M01CarrierPlan";

// Follow the reserved south-to-north band: coast, city, Varda Rim, north exit.
// Owner tuning: advance only the encounter; preserve the world terrain reservation.
const route = M01.route.map(([x, z], index) => ({ x, y: 727, z: index === 0 ? 5200 : z }));
const distance = BomberRules.Create(route, 1).length;
export const mission: MissionBlueprint = {
 id: 1, act: 1, codename: "Rim Static", title: "OUR OWN PAINT", region: "coastal_city", environment: "farm_overcast",
 available: true, worldKey: M01_WORLD_KEY, airspace: M01_AIRSPACE, start: m01CarrierFlyoffStart(), countdownSeconds: 600,
 pressure: { playerPriority: 0.8, forwardConeDegrees: 25, tailDefence: true },
 scoring: { basis: "points", points: { bomber: 100, escort: 60, ace: 240, raider: 60 }, rank: { S: 1320, A: 1020, B: 600, C: 500 } },
 allies: { count: 4, model: "Kestrel", callsignPrefix: "LANTERN", creditPlayerKills: false, allowRequiredTargets: false,
 formation: [{x:-180,y:20,z:160},{x:180,y:20,z:160},{x:-360,y:40,z:320},{x:360,y:40,z:320}] },
 primary: "Destroy all six bombers before they leave the island",
 briefing: "Teal's unsigned checkout is cut short. Six bombers in Varda's own paint are crossing the islands toward Varda Rim's runway on the headland. They squawk our codes; the warning came late. You are the nearest jet. Fly off the training carrier and stop them. Escorts are optional targets.",
 debrief: "The six bombers are down and Varda Rim's runway is clear. The quartermaster hands you a sealed case from Teal's bunk, addressed to Sera.",
 failure: "The raid was not stopped. Varda Rim's runway remains under threat.",
 ground: [], phases: [{ optionalRaiders: 8, reinforce: [{ at: 0.5, count: 2 }], kind: "required_air", count: 6, label: "Intercept six bombers", beat: "Six bombers, our paint and codes. Stop them before the north coast.",
 bombers: { count: 6, waypoints: route.filter((_,i)=>i<route.size()-1), escape: route[route.size()-1], speed: distance/240,
 escapeCall: "The bombers crossed the north coast. Varda Rim, clear the runway.",
 escorts: { count: 4, initial: 2, role: "escort", aceName: "ASH WARRANT", aceAt: 150 } } }],
};
