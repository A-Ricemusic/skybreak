import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint, FlightPoint } from "../MissionCatalog";
import type { FighterArrival, GroundTargetType, TypedGroundTarget } from "../CampaignEncounters";
import { landingPose } from "../EngineBatchB";
import { M10, M10_WORLD_KEY, m10TargetLayout } from "../M10WorldPlan";
import { M10_AIRSPACE } from "../M10Limits";

// D-380: authored split of the unresolved reference inventory; world ids remain authoritative.
const types: { [key: string]: GroundTargetType } = { container:"container", barracks:"barracks", tank:"barracks", aa:"aa_gun", sam:"sam", antenna:"antenna", watchtower:"watchtower", flak:"flak_gun", fuel:"fuel_tank", radar:"control_tower", frigate:"gunboat", tanker:"container_ship", river_submarine:"submarine", gunboat:"gunboat" };
export const M10_POINTS: { [key: string]: number } = { container:30,barracks:50,tank:50,aa:20,sam:30,antenna:40,watchtower:30,flak:40,fuel:100,radar:100,frigate:30,tanker:120,river_submarine:120,gunboat:30,sub_pen:200,crane:20,helicopter:50,transport_heli:40,vtol:60,transport:100,fighter:60,ace:240 };
export const M10_WORLD_TARGETS: TypedGroundTarget[] = m10TargetLayout().map(t=>({id:t.id,type:types[t.type],position:{x:t.x,y:t.y,z:t.z},yaw:math.deg(t.yaw),required:false,scoreRole:t.type,group:t.group,naval:t.domain==="naval" ? true : undefined,sam:t.type==="sam" ? true : undefined}));
// Procedural additions at authored pads, quays and pen mouths; no imported assets.
const additions: TypedGroundTarget[] = [];
for (let i=0;i<2;i++) {
 additions.push({id:`m10_pen_${i+1}`,type:"sub_pen",position:{x:-6770,y:32,z:i===0?-10950:-8250},yaw:0,required:false,scoreRole:"sub_pen",group:"D"});
 additions.push({id:`m10_crane_${i+1}`,type:"crane",position:{x:4210,y:48,z:-4100+i*300},yaw:0,required:false,scoreRole:"crane",group:"C"});
}
const patrol: FlightPoint[]=[];
// One bounded patrol (~83 s); ignored helicopters retire through the normal route endpoint.
for(const p of [{x:-4200,z:1600},{x:-2400,z:1600},{x:-2400,z:300},{x:-4200,z:300}]) patrol.push({...p,y:320});
const waves: FighterArrival[] = [];
for(let i=0;i<12;i++) {
 const transport=i===0, heli=i>=7, group=i<7?M10.districts[0]:M10.districts[1];
 const id=`m10_parked_${i+1}`, scoreRole=transport?"transport":heli?"transport_heli":"vtol";
 const position={x:group.x-900,y:80,z:group.z-900+(i%7)*260};
 additions.push({id,type:heli?"parked_helicopter":"parked_bomber",position,yaw:0,required:false,scoreRole,group:group.group});
 waves.push({id:`m10_scramble_${i+1}`,parkedSourceId:id,count:1,role:"raider",scoreRole,trigger:{kind:"time",seconds:180+i*15},headingDegrees:180,...(heli?{aircraft:"helicopter" as const,route:{waypoints:patrol,speed:60}}:{})});
}
export const M10_TARGETS = [...M10_WORLD_TARGETS,...additions];
waves.push(
 {id:"m10_attack_helis",trigger:{kind:"phase_start",phase:0},count:4,role:"raider",scoreRole:"helicopter",aircraft:"helicopter",route:{waypoints:patrol,speed:60}},
 {id:"m10_mobile_helis",trigger:{kind:"time",seconds:60},count:4,role:"raider",scoreRole:"helicopter",aircraft:"helicopter",route:{waypoints:patrol,speed:60}},
 {id:"m10_transports",trigger:{kind:"time",seconds:100},count:2,role:"raider",scoreRole:"transport_heli",aircraft:"helicopter",route:{waypoints:patrol,speed:60}},
 {id:"m10_vtol_cover",trigger:{kind:"time",seconds:360},count:6,role:"raider",scoreRole:"vtol",headingDegrees:180},
 {id:"m10_heavy_cover",trigger:{kind:"phase_start",phase:0},count:3,role:"raider",scoreRole:"fighter",headingDegrees:45},
);
for(let i=0;i<3;i++) waves.push({id:`m10_pressure_${i+1}`,trigger:{kind:"time",seconds:480+i*180},count:4,role:"raider",scoreRole:"fighter",headingDegrees:90+i*90});
export const M10_ARTILLERY = {startSeconds:240,salvos:8,ceiling:585,source:{x:15000,y:700,z:-15000},warningSeconds:45,countdownSeconds:15,intervalSeconds:120,damage:35,clearance:60,channel:[{x:2940,y:300,z:9000},{x:2940,y:300,z:5500}]};
const landing={touchdown:{x:M10.service.x,y:86,z:11268},headingDegrees:180,approachDistance:2400,approachSeconds:20,rolloutDistance:900,rolloutSeconds:15,glideDegrees:3};
const gate=landingPose(landing,0);
export const mission: MissionBlueprint = {
 id:10,act:2,codename:"Walking the storm",title:"RIVER LINE",region:"canyon_airfield",environment:"canyon_noon",available:true,worldKey:M10_WORLD_KEY,airspace:M10_AIRSPACE,
 start:{kind:"airborne",...M10.start,speed:160},countdownSeconds:1200,terrainRelativeWarnings:true,
 armament:{gun:{rounds:750},stock:{missiles:58,specialCharges:12},areaAttack:{radius:220,depth:80,damage:180}},
 pressure:{playerPriority:0.8,forwardConeDegrees:45,tailDefence:true},
 allies:{count:4,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:20,z:160},{x:180,y:20,z:160},{x:-300,y:40,z:320},{x:300,y:40,z:320}]},
 scoring:{basis:"points",points:M10_POINTS,rank:{S:5400,A:4200,B:3800,C:3000}},
 primary:"Score 3,000 in 20:00; use valley cover during artillery warnings",
 briefing:MISSION_STORY_TEXT[10].briefing,debrief:MISSION_STORY_TEXT[10].debrief,failure:MISSION_STORY_TEXT[10].failure,ground:[],
 phases:[{kind:"score_threshold",label:"Break the river line",beat:MISSION_STORY_TEXT[10].radio[0],scoreThreshold:{points:3000,seconds:1200,waitForExpiry:true},chatter:[{at:0.3,text:MISSION_STORY_TEXT[10].radio[2]},{at:0.8,text:MISSION_STORY_TEXT[10].radio[3]}],concurrentFighters:8,concurrentRoutes:2,cheapContacts:true,groundTargets:M10_TARGETS,fighterWaves:waves,repeatedArtillery:M10_ARTILLERY,
 standaloneAce:{id:"m10_lockkeeper",name:"LOCKKEEPER",livery:"Vulture",health:165,behaviour:"dogfight",scoreRole:"ace",trigger:{kind:"time",seconds:960},headingDegrees:180},
 rearm:{zone:{x:gate.x,y:gate.y,z:gate.z},radius:1500,landing,takeoffSeconds:20,missiles:true,special:true,gun:true,health:false,weaponMenu:true,radio:[{at:0.5,text:MISSION_STORY_TEXT[10].radio[4]},{at:36,text:MISSION_STORY_TEXT[10].radio[5]}]},
 }],
};
