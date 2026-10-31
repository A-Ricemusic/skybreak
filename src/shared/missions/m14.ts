import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
import type { CruisePlan, CruiseTarget } from "../EngineBatchD10";
import { cruiseRoute } from "../EngineBatchD10";
import { BomberRules } from "../BomberRules";
import { M14, M14_WORLD_KEY, m14TargetLayout } from "../M14WorldPlan";
import { M14_AIRSPACE } from "../M14Limits";

const layout=m14TargetLayout();
export const M14_SITE=layout.find(t=>t.id==="m14_crown_station")!;
const site={x:M14_SITE.x,y:150,z:M14_SITE.z};
function missile(n:number,arrivalSeconds:number):CruiseTarget {
 const anchor=layout.find(t=>t.id===`m14_cruise_${n}`)!;
 // World kill-slot ids are stable; mobile ingress is authored, not the static inventory pose.
 return {id:anchor.id,scoreRole:n===16?"high_value_cruise":"cruise",speed:90,arrivalSeconds,
 route:[{x:anchor.x,y:150,z:-7680},site]};
}
const opening=[1,2,3,4,5].map((n)=>missile(n,20+(n-1)*12));
const separating:CruiseTarget[]=[];
for(let i=0;i<2;i++) {
 const carrier: CruiseTarget={...missile(6+i*3,20+i*40),id:`m14_carrier_${i+1}`,scoreRole:"cruise_carrier",separateSeconds:20};
 separating.push(carrier);
 const release=BomberRules.Sample(cruiseRoute(carrier),20).slots[0].position;
 for(let j=0;j<3;j++) separating.push({...missile(6+i*3+j,0),arrivalSeconds:undefined,parentId:carrier.id,route:[release,site]});
}
for(let n=12;n<=15;n++) separating.push(missile(n,110+(n-12)*18));
export const M14_SALVOS:CruisePlan[]=[{site,targets:opening},{site,targets:separating},{site,targets:[missile(16,45)]}];
export const M14_POINTS={cruise_carrier:300,cruise:100,high_value_cruise:200,stealth_fighter:120,strategic_bomber:200};
const story=MISSION_STORY_TEXT[14];
export const mission:MissionBlueprint={
 id:14,act:3,codename:"Aurora shield",title:"AURORA SHIELD",region:"canyon_airfield",environment:"farm_overcast",
 available:true,worldKey:M14_WORLD_KEY,airspace:M14_AIRSPACE,start:{kind:"airborne",...M14.start,speed:160},countdownSeconds:1200,terrainRelativeWarnings:true,
 pressure:{playerPriority:0.8,forwardConeDegrees:45,tailDefence:true},
 allies:{count:2,model:"Kestrel",callsignPrefix:"LANTERN",mayKill:true,killBudget:1,creditPlayerKills:false,allowRequiredTargets:false,formation:[{x:-180,y:30,z:160},{x:180,y:30,z:160}]},
 scoring:{basis:"points",points:M14_POINTS,rank:{S:2260,A:2000,B:1850,C:1700}},
 primary:"Stop every cruise weapon before it hits the crown station",briefing:story.briefing,debrief:story.debrief,failure:story.failure,ground:[],
 phases:M14_SALVOS.map((plan,i)=>({kind:"required_air",count:plan.targets.size(),label:["Intercept the ice-coast salvo","Stop the separating weapons","Intercept the final weapon"][i],
 beat:story.radio[i===0?0:i===1?2:3],cruiseIntercept:plan,concurrentFighters:8,concurrentRoutes:1,
 ...(i===0?{fighterWaves:[1,2,3].map(n=>({id:`m14_air_${n}`,count:1,role:"raider" as const,scoreRole:"stealth_fighter",trigger:{kind:"phase_start" as const,phase:0},spawn:layout.find(t=>t.id===`m14_air_${n}`)!,headingDegrees:180}))}:i===1?{fighterWaves:[{id:"m14_pressure",count:6,role:"raider" as const,scoreRole:"stealth_fighter",trigger:{kind:"phase_start" as const,phase:1},headingDegrees:180}]}:{fighterWaves:[{id:"m14_air_4",count:1,role:"escort" as const,aircraft:"strategic_bomber" as const,scoreRole:"strategic_bomber",trigger:{kind:"phase_start" as const,phase:2},route:{speed:140,waypoints:[{x:-1200,y:1800,z:-6000},{x:-1200,y:1800,z:12000}]}}]}),
 })),
};
