import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { FighterArrival } from "../CampaignEncounters";
import { M04, M04_WORLD_KEY, m04TargetLayout } from "../M04WorldPlan";
import { M04_AIRSPACE } from "../M04Limits";

const layout = m04TargetLayout();
const transports = layout.filter(t => t.type === "transport");
const origin = transports[0];
// Keep the measured 140-stud/s closing feel: NE/east/SE, then south and west to an inland exit (D-096).
const route = [{ x: origin.x, y: origin.y, z: origin.z }, ...M04.route.filter((_, i) => i > 0).map(([x,z]) => ({x,y:1202,z}))];
const dx=route[1].x-origin.x, dz=route[1].z-origin.z, length=math.sqrt(dx*dx+dz*dz);
const fx=dx/length, fz=dz/length;
const waves: FighterArrival[] = layout.filter(t => t.type === "escort" || t.type === "jammer").map(t => ({
 id: t.id, count: 1, role: "escort", scoreRole: t.type === "jammer" ? "jammer" : "escort",
 trigger: t.group === "reinforcements" ? { kind: "required_count", count: 1 } : {kind:"time",seconds:0},
 spawn: {x:t.x,y:t.y,z:t.z}, headingDegrees:45,
 livery: t.type !== "escort" ? undefined : ["m04_escort_3","m04_escort_7"].includes(t.id) ? "Vulture" : ["m04_escort_4","m04_escort_5","m04_escort_8","m04_escort_9"].includes(t.id) ? "Elite" : undefined,
 aircraft: t.type === "jammer" ? "jammer" : undefined,
 route: t.type === "jammer" ? {speed:110,waypoints:[{x:t.x,y:t.y,z:t.z},...M04.route.filter((_,i)=>i>0).map(([x,z])=>({x,y:t.y,z}))]} : undefined,
 call: t.id === "m04_escort_6" ? "COURIER GUARD: They found us. Send the reserve flight!" : undefined,
}));
const ace = layout.find(t => t.type === "ace")!;
export const mission: MissionBlueprint = {
 id:4,act:1,codename:"The High Flyers",title:"BLIND COURIERS",region:"upland_farm",environment:"farm_morning",
 available:true,worldKey:M04_WORLD_KEY,airspace:M04_AIRSPACE,
 start:{kind:"airborne",...M04.start,speed:129.6},countdownSeconds:720,
 scoring:{basis:"points",points:{transport:160,jammer:140,escort:60,ace:240},rank:{S:1300,A:800,B:650,C:480}},
 allies:{count:2,model:"Kestrel",callsignPrefix:"LANTERN",creditPlayerKills:false,allowRequiredTargets:false,
 formation:[{x:-180,y:20,z:160},{x:180,y:20,z:160}]},
 primary:"Destroy all three transports before they escape",
 briefing:"Three high-flying couriers are guiding patrols onto the evacuation trucks below the Teklan orchard. Their escorts are hiding behind two airborne jammers. Find the aircraft by eye; destroy the jammers to restore radar. All three transports must fall before they reach the harbour route. The jammers and guards are optional targets.",
 debrief:"The three couriers are down. The patrols have lost their eyes over the orchard. Sera can move the evacuation trucks again.",
 failure:"The courier screen held. Patrols still have eyes on the evacuation road.",
 ground:[],phases:[{
 kind:"required_air",count:3,label:"Intercept three transports",
 beat:"SERA: High flyers ahead. Break their jammers to get radar back.",
 chatter:[{at:1/3,text:"SERA: One courier down. Two still watching the road."},{at:2/3,text:"LANTERN 2: One transport left. The trucks are counting on us."}],
 bombers:{aircraft:"transport",scoreRole:"transport",count:3,targetIds:transports.map(t=>t.id),
 slots:transports.map(t=>({x:(t.x-origin.x)*-fz+(t.z-origin.z)*fx,y:0,z:0-((t.x-origin.x)*fx+(t.z-origin.z)*fz)})),
 waypoints:route.filter((_,i)=>i<route.size()-1),escape:route[route.size()-1],speed:140,
 escapeCall:"SERA: A courier reached the harbour route. Pull back.",
 escorts:{count:0,initial:0,role:"escort",aceName:"ORCHARD WARRANT",aceAt:0}},
 fighterWaves:waves,
 standaloneAce:{id:ace.id,name:"ORCHARD WARRANT",livery:"Vulture",health:165,trigger:{kind:"time",seconds:0},behaviour:"dogfight",scoreRole:"ace",
 spawn:{x:ace.x,y:ace.y,z:ace.z},headingDegrees:45,call:"ORCHARD WARRANT: Keep the couriers flying. I will take the trainee.",
 stageLines:["ORCHARD WARRANT: Guard flight, keep them off my tail!","ORCHARD WARRANT: The road is ours as long as one courier flies."]},
 jamming:{visualLockRange:1200,remainingCall:"SERA: Still jammed. A second aircraft is masking the couriers.",clearCall:"SERA: Both jammers down. Radar is clear. Find those transports."},
 }],
};
