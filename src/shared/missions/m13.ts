import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { ProtectedAircraftPlan } from "../EngineBatchD7";
import type { SpatialJamming } from "../EngineBatchD9";
import type { FighterArrival } from "../CampaignEncounters";
import { CombatBalance } from "../CombatBalance";
import { M13, M13_WORLD_KEY, M13_ANCHORS, m13JammerLayout, m13RouteX } from "../M13WorldPlan";
import { M13_AIRSPACE } from "../M13Limits";

// D-560: world ids are the sole actor identities; procedural world models are adopted.
// D-561: 600-second route, plus at most 20 seconds of local navigation hold.
// Fixed hull; tests derive conditional hit/fire budgets for all difficulties.
// Actual acquisition, impacts and pilot response require runtime observation.
export const M13_HEALTH = CombatBalance.hostileDamage[2] * 10;
export const M13_SAFE_SECONDS = 600;
const waypoints = M13_ANCHORS.map(p=>({x:p.x,y:383,z:p.z}));
let distance=0;
for(let i=1;i<waypoints.size();i++) {const a=waypoints[i-1],b=waypoints[i];distance+=math.sqrt((a.x-b.x)**2+(a.z-b.z)**2);}
export const M13_PLANE: ProtectedAircraftPlan = {id:"m13_evidence_plane",callsign:"PAPER ONE",health:M13_HEALTH,route:{waypoints,speed:distance/M13_SAFE_SECONDS}};
export const M13_JAMMING: SpatialJamming = {
 navigationHoldSeconds:20,
 airships:m13JammerLayout().map(t=>({id:t.id,position:{x:t.x,y:t.y,z:t.z},health:48,scoreRole:"jammer"})),
 corridors:m13JammerLayout().map(t=>({sourceId:t.id,a:{x:m13RouteX(t.z+700),y:383,z:t.z+700},b:{x:m13RouteX(t.z-700),y:383,z:t.z-700},radius:1100})),
};
// D-562: eight required attackers vs four ordinary in reference; optional ace stays 240.
// All pursuers; no route actors can occupy their concurrent fighter slots.
export const M13_WAVES: FighterArrival[] = [0,1,2,3].map(i=>({
 id:`m13_intercept_${i+1}`,trigger:{kind:"time",seconds:420+i*30},count:2,role:"raider",scoreRole:"fighter",required:true,
 attackProtected:M13_PLANE.id,spawn:{x:(i%2===0?-1:1)*3000,y:850,z:-6500-i*900},headingDegrees:180,
 call:i===0?MISSION_STORY_TEXT[13].radio[1]:MISSION_STORY_TEXT[13].radio[5],
}));
// Optional wingman targets never attack Paper One or own required-kill progress.
export const M13_ESCORTS: FighterArrival[] = [{
 id:"m13_escort_screen",trigger:{kind:"time",seconds:420},count:2,role:"escort",scoreRole:"fighter",
 spawn:{x:-2200,y:850,z:-6500},headingDegrees:180,
}];
const protection={aircraft:[M13_PLANE],accompaniment:true as const};
export const mission: MissionBlueprint = {
 id:13,act:3,codename:"The evidence launch",title:"EVIDENCE THROUGH THE GREY",region:"canyon_airfield",environment:"farm_overcast",
 available:true,worldKey:M13_WORLD_KEY,airspace:M13_AIRSPACE,start:{kind:"airborne",...M13.start,speed:160},countdownSeconds:420,terrainRelativeWarnings:true,
 armament:{gun:{rounds:1200},stock:{missiles:68,specialCharges:16}},
 allies:{count:2,model:"Kestrel",callsignPrefix:"LANTERN",killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:30,z:160},{x:180,y:30,z:160}]},
 scoring:{basis:"points",points:{jammer:100,fighter:60,ace:240},rank:{S:2800,A:2100,B:1900,C:1300}},
 primary:"Gun the airship jammers: 1,300 in 7:00. Then stop eight attackers and escort Paper One to safety.",
 briefing:MISSION_STORY_TEXT[13].briefing,debrief:MISSION_STORY_TEXT[13].debrief,failure:MISSION_STORY_TEXT[13].failure,ground:[],
 phases:[
 {kind:"score_threshold",label:"Gun the navigation jammers",beat:MISSION_STORY_TEXT[13].radio[0],
  scoreThreshold:{points:1300,seconds:420,waitForExpiry:true},protection,execution:{raiderKillCap:32},
  spatialJamming:M13_JAMMING,jamming:{visualLockRange:700,remainingCall:"PAPER ONE: Local interference. Holding navigation.",clearCall:"PAPER ONE: This stretch is clear. Continuing north."},
  chatter:[{at:0.01,text:MISSION_STORY_TEXT[13].radio[2]},{at:0.5,text:MISSION_STORY_TEXT[13].radio[3]}],
 },
 {kind:"required_air",count:8,label:"Stop the interceptors; protect Paper One",protection,concurrentFighters:8,
  update:{objective:"Destroy eight attackers and keep Paper One alive until safe",countdownSeconds:900,radio:[MISSION_STORY_TEXT[13].radio[1]]},
  fighterWaves:[...M13_WAVES,...M13_ESCORTS],standaloneAce:{id:"m13_veil",name:"VEIL",livery:"Vulture",health:165,behaviour:"dogfight",scoreRole:"ace",trigger:{kind:"time",seconds:470},spawn:{x:3500,y:1000,z:-9000},headingDegrees:180},
  chatter:[{at:0.1,text:MISSION_STORY_TEXT[13].radio[4]}],
 },
 ],
};
