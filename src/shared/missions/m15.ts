import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint, FlightPoint } from "../MissionCatalog";
import type { FighterArrival, TypedGroundTarget } from "../CampaignEncounters";
import type { GroundProgressPlan } from "../EngineBatchD5";
import { landingPose } from "../EngineBatchB";
import { M15, M15_WORLD_KEY, m15TargetLayout } from "../M15WorldPlan";
import { M15_AIRSPACE } from "../M15Limits";

// D-600: unknown ground subtypes stay provisional generic armour, not invented reference counts.
// First 53 (including the relay) reconcile the observed 2440-point ground ledger.
export const M15_POINTS = { relay:100, ground:45, reserve:40, transport:100, helicopter:80, attack:60, fighter:150, pressure:60, bomber:160, escort:60, ace:240 };
const layout=m15TargetLayout();
export const M15_TARGETS: TypedGroundTarget[]=layout.filter(t=>t.group==="city" || t.group==="airfield").map((t,i)=>({
 id:t.id, type:t.type==="command_relay" ? "control_tower" : t.type==="parked_transport" ? "parked_bomber" : "vehicle",
 position:{x:t.x,y:t.y,z:t.z},yaw:math.deg(t.yaw),required:t.id==="m15_command_relay",group:t.group,
 scoreRole:t.type==="command_relay" ? "relay" : t.type==="parked_transport" ? "transport" : i>=53 ? "reserve" : "ground",
 reinforceAfterSector:i>=53 && i<62 ? "m15_arch_squad" : undefined,
}));
export const M15_GROUND:GroundProgressPlan={sectors:[
 {id:"m15_arch_squad",clearTargetIds:["m15_ground_slot_2","m15_ground_slot_3"],x:-3840,z:-2700},
 {id:"m15_avenue_squad",clearTargetIds:["m15_ground_slot_10","m15_ground_slot_11"],x:-1500,z:-1000},
 {id:"m15_relay_squad",clearTargetIds:["m15_command_relay"],x:2600,z:-4500},
].map(s=>({id:s.id,clearTargetIds:s.clearTargetIds,formation:"city_squad",kind:"troops",seconds:60,health:600,
 route:{speed:12,waypoints:[{x:s.x,y:98,z:s.z+600},{x:s.x,y:98,z:s.z}]},
 advanceCall:"GROUND: Street clear. Squad moving.",securedCall:"GROUND: District secured. Hold the sky.",hitCall:"GROUND: Aircraft attacking our squad!",
}))};
const patrol:FlightPoint[]=[];
for(let lap=0;lap<6;lap++) for(const p of [{x:-6000,z:2000},{x:-2000,z:2000},{x:-2000,z:-2000},{x:-6000,z:-2000}]) patrol.push({...p,y:600});
export const M15_WAVES:FighterArrival[]=[];
for(let i=0;i<4;i++) M15_WAVES.push({id:`m15_air_${i+1}`,count:1,role:"raider",scoreRole:"helicopter",aircraft:"helicopter",trigger:{kind:"time",seconds:i*45},route:{speed:55,waypoints:patrol}});
for(let i=0;i<2;i++) M15_WAVES.push({id:`m15_air_${i+5}`,count:1,role:"raider",scoreRole:"attack",trigger:{kind:"time",seconds:120+i*45},headingDegrees:180});
M15_WAVES.push({id:"m15_air_7",count:1,role:"raider",scoreRole:"fighter",trigger:{kind:"time",seconds:45},headingDegrees:180});
// D-601: two scheduled pairs per district; eight-second reload + two-second warning, 10 damage.
for(let wave=0;wave<2;wave++) for(let i=0;i<3;i++) M15_WAVES.push({id:`m15_pressure_${wave}_${i}`,count:2,role:"raider",scoreRole:"pressure",attackSector:M15_GROUND.sectors[i].id,trigger:{kind:"time",seconds:150+i*60+wave*180},spawn:{x:M15_GROUND.sectors[i].route.waypoints[0].x,y:700,z:M15_GROUND.sectors[i].route.waypoints[0].z-1200},headingDegrees:180});
const landing={touchdown:{x:M15.service.x,y:M15.service.y+6,z:M15.service.z+800},headingDegrees:0,approachDistance:2400,approachSeconds:20,rolloutDistance:900,rolloutSeconds:15,glideDegrees:3};
export const mission:MissionBlueprint={
 id:15,act:3,codename:"A city answers",title:"SILENT STREETS",region:"canyon_airfield",environment:"farm_overcast",available:true,
 worldKey:M15_WORLD_KEY,airspace:M15_AIRSPACE,start:{kind:"airborne",...M15.start,speed:160},countdownSeconds:600,terrainRelativeWarnings:true,
 armament:{gun:{rounds:1200},stock:{missiles:80,specialCharges:16},areaAttack:{radius:220,depth:80,damage:180}},
 pressure:{playerPriority:0.8,forwardConeDegrees:45,tailDefence:true},
 allies:{count:4,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:20,z:160},{x:180,y:20,z:160},{x:-300,y:40,z:320},{x:300,y:40,z:320}]},
 scoring:{basis:"points",points:M15_POINTS,rank:{S:4930,A:4000,B:3200,C:2000}},
 primary:"Score 2,000 and silence the relay in 10:00; protect squads, then stop six bombers",
 briefing:MISSION_STORY_TEXT[15].briefing,debrief:MISSION_STORY_TEXT[15].debrief,failure:MISSION_STORY_TEXT[15].failure,ground:[],phases:[
 {kind:"score_threshold",label:"Liberate the city; silence Rusk's relay",beat:MISSION_STORY_TEXT[15].radio[0],scoreThreshold:{points:2000,seconds:600,waitForExpiry:true,requiredTargetIds:["m15_command_relay"]},groundTargets:M15_TARGETS,groundProgress:M15_GROUND,cheapContacts:true,concurrentFighters:10,concurrentRoutes:2,fighterWaves:M15_WAVES,
 standaloneAce:{id:"m15_air_8",name:"NIGHTWARD",livery:"Vulture",health:165,behaviour:"dogfight",scoreRole:"ace",trigger:{kind:"time",seconds:300},headingDegrees:180},
 rearm:{zone:landingPose(landing,0),radius:1500,landing,takeoffSeconds:15,missiles:true,special:true,gun:true,health:true,weaponMenu:true,radio:[{at:1,text:"CITY TOWER: Cleared northbound. Repairs and weapons ready."},{at:36,text:"CITY TOWER: Repairs complete. Select weapons, then take off."}]},
 },
 {kind:"required_air",count:6,label:"Stop the bomber retaliation",concurrentFighters:12,
 update:{objective:"Destroy six bombers before they reach the city",countdownSeconds:600,radio:[MISSION_STORY_TEXT[15].radio[1]]},
 bombers:{count:6,targetIds:layout.filter(t=>t.type==="bomber").map(t=>t.id),waypoints:[{x:-9600,y:850,z:-13440},{x:-4800,y:850,z:-9000}],escape:{x:2880,y:850,z:-4800},speed:55,escapeCall:"GROUND: Bombers reached the city. We have lost the districts.",escorts:{count:0,initial:0,role:"escort",aceName:"NONE",aceAt:0}},
 fighterWaves:[{id:"m15_retaliation_cover",count:6,role:"raider",scoreRole:"pressure",trigger:{kind:"phase_start",phase:1},headingDegrees:135}],
 },
 ],
};
