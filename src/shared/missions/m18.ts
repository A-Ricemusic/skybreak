import { M18_ASCENDING } from "../M18FinaleRules";
import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { TypedGroundTarget } from "../CampaignEncounters";
import { M18, M18_WORLD_KEY, m18TargetLayout } from "../M18WorldPlan";
import { M18_AIRSPACE } from "../M18Limits";
import type { VentRun } from "../FinaleDuelRules";

export const M18_TARGETS: TypedGroundTarget[] = m18TargetLayout().filter(t=>t.type==="generator" || t.type==="core").map(t=>({id:t.id,type:t.type as "generator"|"core",position:{x:t.x,y:t.y,z:t.z},yaw:0,required:true,scoreRole:t.type,group:t.group}));
const volume=(z:number)=>({center:{x:0,y:174,z},half:{x:70,y:45,z:30}});
export const M18_VENT: VentRun={generators:M18_TARGETS.filter(t=>t.type==="generator").map(t=>t.id),core:"m18_core",gate:volume(-3700),checkpoints:[volume(-3700),volume(-3800)],exit:volume(-7000),openingSeconds:3};
// D-660: provisional cuts; 4,920 is the observed S run, NOT an observed cutoff.
export const M18_RANKS={S:4920,A:4200,B:3300,C:2730};
export const mission: MissionBlueprint={
 id:18,act:3,codename:"The voice breaks",title:"CLEAR FREQUENCY",region:"canyon_airfield",environment:"farm_overcast",available:true,
 worldKey:M18_WORLD_KEY,airspace:M18_AIRSPACE,start:{kind:"airborne",...M18.start,speed:160},countdownSeconds:M18.assaultSeconds,terrainRelativeWarnings:true,
 pressure:{playerPriority:1,forwardConeDegrees:45,tailDefence:true},
 allies:{count:4,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:30,z:180},{x:180,y:30,z:180},{x:-320,y:60,z:360},{x:320,y:60,z:360}]},
 optionalRaiderMax:16,
 scoring:{basis:"points",points:{generator:500,core:990,elite:90,ace:240,ascending:300},rank:M18_RANKS},aceHealth:2500,aceName:"RUSK",
 primary:"Three generators → central vent and escape → Rusk alone",
 briefing:MISSION_STORY_TEXT[18].briefing,debrief:MISSION_STORY_TEXT[18].debrief,failure:MISSION_STORY_TEXT[18].failure,ground:[],
 phases:[
  {kind:"required_ground",count:3,label:"Silence the three generators",finale:{enclosed:true},beat:MISSION_STORY_TEXT[18].radio[0],groundTargets:M18_TARGETS.filter(t=>t.type==="generator"),concurrentFighters:12,
   fighterWaves:m18TargetLayout().filter(t=>t.type==="elite_fighter").map(t=>({id:t.id,count:1,role:"raider" as const,scoreRole:"elite",livery:"Elite" as const,spawn:{x:t.x,y:t.y,z:t.z},headingDegrees:90,trigger:{kind:"phase_start" as const,phase:0}})),
   standaloneAce:{id:"m18_air_12",name:"LAST ECHO",livery:"Vulture",health:165,behaviour:"dogfight",scoreRole:"ace",spawn:{x:-6500,y:1000,z:4800},headingDegrees:90,trigger:{kind:"phase_start",phase:0}},
   chatter:[{at:0.25,text:MISSION_STORY_TEXT[18].radio[2]},{at:0.75,text:MISSION_STORY_TEXT[18].radio[3]}]},
  {kind:"required_ground",count:1,hidden:true,label:"Break the core and escape",execution:{preservePursuers:true,raiderKillCap:16},groundTargets:M18_TARGETS.filter(t=>t.type==="core"),
   update:{objective:"Descend north of the grooves; cyan route, core, then north exit",countdownSeconds:M18.coreSeconds,radio:[MISSION_STORY_TEXT[18].radio[4],MISSION_STORY_TEXT[18].radio[5]]},finale:{vent:M18_VENT,ascending:M18_ASCENDING},
   chatter:[{at:0.3,text:MISSION_STORY_TEXT[18].radio[6]}]},
  {kind:"ace",label:"Rusk · the last transmission",update:{objective:"Rusk alone · five minutes · allies hold fire",countdownSeconds:300,radio:[MISSION_STORY_TEXT[18].radio[1],MISSION_STORY_TEXT[18].radio[7],MISSION_STORY_TEXT[18].radio[8]]},finale:{duel:{center:{x:0,y:1400,z:M18.duel.z},radius:M18.duel.radius,minY:M18.duel.minY,maxY:M18.duel.maxY},environment:M18_WORLD_KEY}},
 ],
};
