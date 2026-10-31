import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { FighterArrival, GroundTargetType, TypedGroundTarget } from "../CampaignEncounters";
import type { GroundProgressPlan } from "../EngineBatchD5";
import { landingPose } from "../EngineBatchB";
import { M16, M16_WORLD_KEY, m16ColumnRoute, m16TargetLayout } from "../M16WorldPlan";

// D-620: provisional subtype split, not a recovered reference inventory. Sum = 6,830.
export const M16_POINTS = { tank:50, aa_gun:20, artillery:60, bunker:100, vehicle:25, strike:60, stealth:120, helicopter:50 };
export const M16_TARGETS: TypedGroundTarget[] = m16TargetLayout().filter(t=>t.group!=="air_cover").map((t,i)=>{
 const targetType: GroundTargetType = i<100?"tank":i<114?"aa_gun":i<124?"artillery":i<132?"bunker":"vehicle";
 return {id:t.id,type:targetType,position:{x:t.x,y:t.y,z:t.z},yaw:0,required:false,scoreRole:targetType,group:t.group,reinforceAfterSector:i>=113?"m16_south":undefined};
});
const route=m16ColumnRoute();
export const M16_COLUMN: GroundProgressPlan = {sectors:[0,1,2].map(i=>({
 id:["m16_south","m16_crater","m16_town"][i],after:i===0?undefined:["m16_south","m16_crater"][i-1],
 kind:"column",formation:"desert_column",health:i===0?320:240,seconds:[200,340,100][i],
 clearTargetIds:[0,1,2,3].map(k=>M16_TARGETS[i*48+k].id),
 route:{waypoints:[route[i],route[i+1]],speed:30},
 advanceCall:["COLUMN: Southern road open. Rolling north.","COLUMN: Passing the crater. Keep the guns off us.","COLUMN: Entering town. Two squads moving in."][i],
 securedCall:["COLUMN: South secured. Reserve armour leaving cover.","COLUMN: Crater road secured.","COLUMN: Both squads answering from the streets."][i],
 hitCall:"COLUMN: Aircraft attacking our vehicles. We need cover!",
}))};
export const M16_WAVES: FighterArrival[]=[];
// Authored windows, not inferred reference spawn predicates. Opening 13 / later 19.
M16_WAVES.push(
 {id:"m16_open_strike",trigger:{kind:"phase_start",phase:0},count:3,role:"raider",scoreRole:"strike",attackSector:"m16_south",spawn:{x:0,y:650,z:9600},headingDegrees:180},
 {id:"m16_open_cover",trigger:{kind:"phase_start",phase:0},count:2,role:"raider",scoreRole:"strike",headingDegrees:180},
 {id:"m16_open_stealth",trigger:{kind:"phase_start",phase:0},count:3,role:"raider",scoreRole:"stealth",headingDegrees:90},
 {id:"m16_low_cover",trigger:{kind:"phase_start",phase:0},count:5,role:"raider",scoreRole:"helicopter",aircraft:"helicopter",route:{waypoints:[{x:-4200,y:360,z:3000},{x:-4200,y:360,z:-3000}],speed:60}},
 {id:"m16_late_cover",trigger:{kind:"time",seconds:540},count:1,role:"raider",scoreRole:"strike",headingDegrees:180},
);
// Town ingress leaves time to turn and cycle past cover before attackers reach the column.
for(let i=0;i<6;i++) M16_WAVES.push({id:`m16_column_attack_${i+1}`,trigger:{kind:"time",seconds:180+i*160},count:3,role:"raider",scoreRole:"strike",attackSector:M16_COLUMN.sectors[i%3].id,spawn:{x:0,y:650,z:[8000,2000,-1000][i%3]},headingDegrees:180,call:"SERA: Strike aircraft inbound on the column. Break their attack."});
const landing={touchdown:{x:M16.service.x,y:92,z:8480},headingDegrees:0,approachDistance:2400,approachSeconds:20,rolloutDistance:900,rolloutSeconds:15,glideDegrees:3};
const gate=landingPose(landing,0);
export const mission: MissionBlueprint = {
 id:16,act:3,codename:"The road home",title:"DUST ROAD",region:"canyon_airfield",environment:"farm_overcast",available:true,worldKey:M16_WORLD_KEY,
 airspace:{softHalfWidth:14000,hardHalfWidth:15360,spawnLimit:14000,radarRange:24000},start:{kind:"airborne",...M16.start,speed:160},countdownSeconds:1200,terrainRelativeWarnings:true,
 armament:{gun:{rounds:1000},stock:{missiles:80,specialCharges:16},areaAttack:{radius:400,depth:100,damage:180}},
 pressure:{playerPriority:0.8,forwardConeDegrees:45,tailDefence:true},
 allies:{count:4,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:20,z:160},{x:180,y:20,z:160},{x:-300,y:40,z:320},{x:300,y:40,z:320}]},
 scoring:{basis:"points",points:M16_POINTS,rank:{S:7800,A:6000,B:4500,C:3500}},
 primary:"Score 3,500 in 20:00; protect the column and clear its road",
 briefing:MISSION_STORY_TEXT[16].briefing,debrief:MISSION_STORY_TEXT[16].debrief,failure:MISSION_STORY_TEXT[16].failure,ground:[],
 phases:[{kind:"score_threshold",label:"Cover the road home",beat:MISSION_STORY_TEXT[16].radio[0],scoreThreshold:{points:3500,seconds:1200,waitForExpiry:true},concurrentFighters:11,concurrentRoutes:2,cheapContacts:true,groundTargets:M16_TARGETS,groundProgress:M16_COLUMN,fighterWaves:M16_WAVES,
 rearm:{zone:{x:gate.x,y:gate.y,z:gate.z},radius:1500,landing,takeoffSeconds:20,missiles:true,special:true,gun:true,health:true,weaponMenu:true,radio:[{at:0.5,text:"SERVICE: Weapons and repairs underway. Battle clock held."},{at:36,text:"SERVICE: Hull restored. Return to the column."}]},
 }],
};
