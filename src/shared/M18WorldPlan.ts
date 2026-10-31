import { FlightMath } from "./FlightMath";
import type { EnvironmentSpec } from "./EnvironmentPresets";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldDressing, compactWorldCounts, type WorldContact } from "./LateWorldDressing";
export const M18_WORLD_KEY="m18_voice_breaks";
export const M18={start:{x:0,y:617,z:7680,headingDegrees:0},grooves:[-1920,0,1920],width:180,clearHeight:140,floor:104,roof:244,core:{x:-130,y:174,z:-4000},duel:{x:0,z:-2880,radius:5760,minY:800,maxY:2400,seconds:300},assaultSeconds:1200,coreSeconds:1800};
export const M18_ENVIRONMENT:EnvironmentSpec={...M06_ENVIRONMENT,water:{...M06_ENVIRONMENT.water,color:[52,67,79]},label:"Grey storm relay 08:00",clock:8,sky:"overcast",weather:"storm",brightness:1.3,ambient:[94,105,115],outdoorAmbient:[128,139,147],clouds:{cover:0.9,density:0.3,color:[144,152,161]},atmosphere:{density:0.38,offset:0,haze:2.5,glare:0,color:[156,168,180],decay:[86,98,112]}};
export function m18Height(x:number,z:number):number{return math.abs(x)<4096&&z<0&&z>=-6144?80:32;}
export const M18_SURFACE:WorldSurface={height:m18Height,detail:()=>false,material:(x,z)=>m18Height(x,z)===32?"Water":"Rock",nativeWater:()=>false};
export const m18Ground=(x:number,z:number)=>surfaceGround(M18_SURFACE,x,z);
export function m18TargetLayout():WorldContact[]{return [
 ...M18.grooves.map((x,i)=>({id:`m18_generator_${i+1}`,type:"generator",group:`groove_${i+1}`,x,y:104,z:-2880,yaw:0})),
 {id:"m18_core",type:"core",group:"vent",...M18.core,yaw:0},
 ...[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>({id:`m18_air_${i+1}`,type:i===11?"named_ace_slot":"elite_fighter",group:"optional_air",x:-10000+(i%6)*700,y:500,z:4000+math.floor(i/6)*800,yaw:0})),
 ...[0,1,2,3].map(i=>({id:`m18_ascending_${i+1}`,type:"ascending_missile_slot",group:"optional_missile",x:5000+i*400,y:400,z:-4000,yaw:0}))
];}
/** Smooth two-arc descent, then a straight enclosed run. Turn geometry uses the real cruise pitch radius. */
export function m18VentRoute(){
 const radius=FlightMath.CruiseSpeed/FlightMath.PitchRate,angle=0.65;
 const points=[{x:0,y:617,z:-2960}];
 let y=617,z=-2960;
 for(let i=1;i<=24;i++){const a=angle*i/24;points.push({x:0,y:y-radius*(1-math.cos(a)),z:z-radius*math.sin(a)});}
 y=points[points.size()-1].y;z=points[points.size()-1].z;
 const drop=y-174-radius*(1-math.cos(angle));
 y-=drop;z-=drop/math.tan(angle);points.push({x:0,y,z});
 for(let i=1;i<=24;i++){const a=angle*(1-i/24);points.push({x:0,y:y-radius*(math.cos(a)-math.cos(angle)),z:z-radius*(math.sin(angle)-math.sin(a))});}
 points.push({x:0,y:174,z:-3700},{x:0,y:174,z:-3800},{x:0,y:174,z:-7000});
 return points;
}
export function buildM18Plan(seed=1818,checkpoint:()=>void=()=>{}){
 const d=worldDressing(M18_SURFACE,checkpoint),targets=m18TargetLayout();
 for(const sea of d.seaParts)sea.color=M18_ENVIRONMENT.water.color;
 // Structural floor/support columns run from Y=0 to the unchanged deck Y=104.
 // The vent spans the walls too, including its local over-water exit foundation.
 // Axis-aligned convex modules; internal 180 x 140 clear openings, no hidden ribs.
 for(const x of M18.grooves){
  for(let i=0;i<3;i++){const z=-480-i*960;
   d.part("m18_groove_floor",x,52,z,244,104,i===2?1040:960);
   for(const side of [-1,1])d.part("m18_groove_wall",x+side*106,174,z,32,156,960);
   d.part("m18_groove_roof",x,252,z,244,16,960);
  }
 }
 for(const t of targets){if(t.type==="generator")d.part(t.id,t.x,144,t.z,60,80,40,"Metal",[132,175,181]);else if(t.type==="core")d.part(t.id,t.x,t.y,t.z,40,140,100,"Metal",[201,142,69]);}
 // Airborne inventory slots are spawned by runtime directors, never static scenery.
 // Separate vertical entry aperture at z=-3400. Roof starts after descent;
 // floor/side walls continue to an independent open north exit.
 for(let i=0;i<4;i++){const z=-3750-i*900;
  d.part("m18_vent_floor",0,52,z,392,104,900);
  for(const side of [-1,1])d.part("m18_vent_wall",side*180,174,z,32,156,900);
  if(i>0&&i<3)d.part("m18_vent_roof",0,252,z,392,16,900);
 }
 // Exterior buttresses give the works a silhouette below the duel's 800-stud floor.
 for(const x of [-3200,3200])for(let i=0;i<5;i++)d.part("m18_buttress",x,200,-600-i*1000,600,240,600);
 return {key:M18_WORLD_KEY,seed,ops:d.ops,parts:[...d.seaParts,...d.parts],props:d.props,targets,routes:[{id:"m18_vent",points:m18VentRoute()}]};
}
export const m18Counts=(p:ReturnType<typeof buildM18Plan>)=>compactWorldCounts(p,0);
