import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { FighterArrival, TypedGroundTarget } from "../CampaignEncounters";
import { M17, M17_WORLD_KEY, m17TargetLayout } from "../M17WorldPlan";
import { M17_AIRSPACE } from "../M17Limits";
import { landingPose } from "../EngineBatchB";
// D-640: provisional subtype allocation; the aggregate score ledger is evidence-backed.
export const M17_POINTS = { tank:50, aa:20, sam:60, mount:50, bridge:0, battleship:200, destroyer:140, submarine:120, supply:120, helicopter:50, fighter:60, active:120, tiltrotor:50, scout:60, interceptor:60, bandit:150 };
const layout=m17TargetLayout();
export const M17_TARGETS: TypedGroundTarget[] = layout.filter(t=>t.id.sub(1,16)==="m17_ground_slot_").map((t,i)=>({
 id:t.id,type:i<30?"tank":i<40?"aa_gun":i<48?"sam":"gun_mount",position:{x:t.x,y:t.y,z:t.z},yaw:0,required:false,
 scoreRole:i<30?"tank":i<40?"aa":i<48?"sam":"mount",...(i>=40&&i<48?{sam:true as const}:{}),
}));
// Seven mounts belong to the four adopted hulls; their scores partition the 55 ground credits.
for(let i=48;i<55;i++) { const hull=layout.find(t=>t.id===`m17_hull_${(i-48)%4+1}`)!; const t=M17_TARGETS[i]; t.parentId=hull.id;t.position={x:hull.x,y:80,z:hull.z+(i<52?-60:60)}; }
const hullTypes=["cruiser","destroyer","submarine","supply_ship"] as const;
const hullRoles=["battleship","destroyer","submarine","supply"];
for(let i=0;i<4;i++) {const t=layout.find(t=>t.id===`m17_hull_${i+1}`)!;
 M17_TARGETS.push({id:t.id,type:hullTypes[i],position:{x:t.x,y:t.y,z:t.z},yaw:0,required:false,naval:true,scoreRole:hullRoles[i],health:220,
 ...(i===3?{route:{speed:12,waypoints:[{x:t.x,y:40,z:t.z},{x:t.x,y:40,z:-4800},{x:-1920,y:40,z:-4800},{x:-1920,y:40,z:-5700}]}}:{})});
}
M17_TARGETS.push({id:"m17_enemy_bridge",type:"bridge_section",position:{x:-1920,y:126,z:-4800},yaw:0,required:false,scoreRole:"bridge"});
export const M17_WAVES: FighterArrival[]=layout.filter(t=>t.group==="optional_air").map((t,i)=>({
 id:t.id,count:1,role:"raider",scoreRole:i<4?"helicopter":i<8?"fighter":i<11?"active":i<15?"tiltrotor":i===15?"scout":"interceptor",
 trigger:i<4?{kind:"phase_start",phase:0}:{kind:"time",seconds:60+(i-4)*30},
 spawn:{x:t.x,y:650,z:t.z},headingDegrees:0,
 ...(i<4||i>=11&&i<15?{aircraft:"helicopter" as const,route:{speed:80,waypoints:[{x:t.x,y:650,z:t.z},{x:t.x,y:650,z:-2000},{x:t.x+1500,y:650,z:-2000},{x:t.x+1500,y:650,z:5000}]}}:{}),
}));
const landing={touchdown:{x:11000,y:100,z:6000},headingDegrees:0,approachDistance:2400,approachSeconds:20,rolloutDistance:900,rolloutSeconds:15,glideDegrees:3};
export const mission: MissionBlueprint = {
 id:17,act:3,codename:"The last fracture",title:"LAST WING",region:"coastal_harbor",environment:"ocean_clear",available:true,worldKey:M17_WORLD_KEY,airspace:M17_AIRSPACE,
 start:{kind:"airborne",...M17.start,speed:160},countdownSeconds:720,terrainRelativeWarnings:true,
 pressure:{playerPriority:0.8,forwardConeDegrees:45,tailDefence:true},
 allies:{count:4,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:20,z:160},{x:180,y:20,z:160},{x:-300,y:40,z:320},{x:300,y:40,z:320}]},
 scoring:{basis:"points",points:M17_POINTS,rank:{S:4500,A:3900,B:3200,C:2100}},
 primary:"Score 2,100 in 12:00; defeat four wingmen and confirm Rusk's departure in 18:00",
 briefing:MISSION_STORY_TEXT[17].briefing,debrief:MISSION_STORY_TEXT[17].debrief,failure:MISSION_STORY_TEXT[17].failure,ground:[],
 phases:[{kind:"score_threshold",label:"Open the capital approaches",beat:MISSION_STORY_TEXT[17].radio[2],
 scoreThreshold:{points:2100,seconds:720,waitForExpiry:true},groundTargets:M17_TARGETS,fighterWaves:M17_WAVES,concurrentFighters:8,concurrentRoutes:2,cheapContacts:true,
 bridgeClosures:[{targetId:"m17_enemy_bridge",sectorIds:[],hullIds:["m17_hull_4"]}],
 groundProgress:{sectors:[{id:"m17_witnesses",clearTargetIds:["m17_ground_slot_4","m17_ground_slot_12"],seconds:120,health:300,kind:"column",route:{speed:20,waypoints:[{x:3840,y:140,z:160},{x:3840,y:140,z:-2240}]},advanceCall:MISSION_STORY_TEXT[17].radio[6],securedCall:MISSION_STORY_TEXT[17].radio[7],hitCall:MISSION_STORY_TEXT[17].radio[8]}]},
 // D-523: use D11 completed-service repair for this mission.
 rearm:{zone:landingPose(landing,0),radius:1500,landing,takeoffSeconds:20,missiles:true,special:true,health:true,weaponMenu:true,radio:[{at:1,text:MISSION_STORY_TEXT[17].radio[5]}]},
 chatter:[{at:0.5,text:MISSION_STORY_TEXT[17].radio[3]}],
 },{kind:"required_air",count:4,label:"Break Rusk's last wing",execution:{directSpawn:true},
 update:{objective:"Defeat all four wingmen; confirm Rusk's coastward departure",countdownSeconds:1080,radio:[MISSION_STORY_TEXT[17].radio[0],MISSION_STORY_TEXT[17].radio[4]]},
 leaderWithdrawal:{departure:{speed:220,waypoints:[M17.elite,M17.exit]}},
 }],
};
