import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint, FlightPoint } from "../MissionCatalog";
import type { FighterArrival } from "../CampaignEncounters";
import { M11, M11_WORLD_KEY, m11RoutePoint } from "../M11WorldPlan";
import { M11_AIRSPACE } from "../M11Limits";
import type { ProtectedAircraftPlan } from "../EngineBatchD7";

// D-440: 17 ordinary attackers + optional ace; two independent, time-matched routes.
// D-444: thirteen Normal hits to lose either escort; shared combat tuning is unchanged.
export const M11_AIRCRAFT_HEALTH = 91;
export const M11_SAFE_SECONDS = 313.28;
export const M11_AIRCRAFT: ProtectedAircraftPlan[] = [false, true].map(high => {
 const waypoints: FlightPoint[] = [];
 // Sample the same world curves inside D7's 32-waypoint route limit.
 for (let i=0;i<=24;i++) {
  const p=m11RoutePoint(high,i/24);
  // JSON snapshots normalize -0; canonicalize the low route endpoint for stable saves.
  waypoints.push({x:p.x===0 ? 0 : p.x,y:p.y,z:p.z});
 }
 let distance=0;
 for(let i=1;i<waypoints.size();i++) { const a=waypoints[i-1],b=waypoints[i]; distance+=math.sqrt((b.x-a.x)**2+(b.z-a.z)**2); }
 return { id: high ? "m11_civilian_high" : "m11_civilian_low", callsign: high ? "ORCHARD ONE" : "ORCHARD TWO", health: M11_AIRCRAFT_HEALTH,
  route: { waypoints, speed: distance/M11_SAFE_SECONDS } };
});
// Authored timing, not recovered source spawns. No route/patrol enemies consume the pursuit budget.
export const M11_WAVES: FighterArrival[] = [
 { id:"m11_high_first", trigger:{kind:"time",seconds:0}, count:3, role:"raider", scoreRole:"fighter", attackProtected:"m11_civilian_high", spawn:{x:4400,y:2800,z:3800}, headingDegrees:180, call:MISSION_STORY_TEXT[11].radio[2] },
 { id:"m11_high_second", trigger:{kind:"time",seconds:55}, count:3, role:"raider", scoreRole:"fighter", attackProtected:"m11_civilian_high", spawn:{x:3800,y:2800,z:400}, headingDegrees:180, call:MISSION_STORY_TEXT[11].radio[3] },
 { id:"m11_low_first", trigger:{kind:"time",seconds:110}, count:4, role:"raider", scoreRole:"fighter", attackProtected:"m11_civilian_low", spawn:{x:-3800,y:900,z:-2600}, headingDegrees:180, call:MISSION_STORY_TEXT[11].radio[4] },
 { id:"m11_low_second", trigger:{kind:"time",seconds:170}, count:4, role:"raider", scoreRole:"fighter", attackProtected:"m11_civilian_low", spawn:{x:-3600,y:900,z:-6200}, headingDegrees:180, call:MISSION_STORY_TEXT[11].radio[5] },
 { id:"m11_high_last", trigger:{kind:"time",seconds:230}, count:3, role:"raider", scoreRole:"fighter", attackProtected:"m11_civilian_high", spawn:{x:2800,y:2800,z:-9700}, headingDegrees:180, call:MISSION_STORY_TEXT[11].radio[6] },
];
export const mission: MissionBlueprint = {
 id:11, act:2, codename:"High crossing", title:"HIGH CROSSING", region:"snow_mountains", environment:"farm_overcast",
 available:true, worldKey:M11_WORLD_KEY, airspace:M11_AIRSPACE,
 start:{kind:"airborne",...M11.start,speed:160}, countdownSeconds:330, terrainRelativeWarnings:true,
 armament:{gun:{rounds:1200}},
 allies:{count:2,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,
  formation:[{x:-180,y:30,z:160},{x:180,y:30,z:160}]},
 scoring:{basis:"points",points:{fighter:60,ace:240},rank:{S:780,A:360,B:240,C:120}},
 primary:"Protect both airliners through the crossing in 5:30; either loss fails",
 briefing:MISSION_STORY_TEXT[11].briefing,debrief:MISSION_STORY_TEXT[11].debrief,failure:MISSION_STORY_TEXT[11].failure,
 ground:[],phases:[{kind:"protected_air",label:"Protect Orchard One and Orchard Two",beat:MISSION_STORY_TEXT[11].radio[0],concurrentFighters:6,
  protection:{aircraft:M11_AIRCRAFT,altitudeCeiling:2800},fighterWaves:M11_WAVES,
  standaloneAce:{id:"m11_rime",name:"RIME",livery:"Vulture",health:165,behaviour:"dogfight",scoreRole:"ace",trigger:{kind:"time",seconds:250},
   spawn:{x:3000,y:1900,z:-9000},headingDegrees:180,call:MISSION_STORY_TEXT[11].radio[7]},
  chatter:[{at:0.33,text:MISSION_STORY_TEXT[11].radio[8]},{at:0.86,text:MISSION_STORY_TEXT[11].radio[9]}],
 }],
};
