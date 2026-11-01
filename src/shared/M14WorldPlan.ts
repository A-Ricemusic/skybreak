import type { EnvironmentSpec } from "./EnvironmentPresets";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldDressing, compactWorldCounts, type WorldContact } from "./LateWorldDressing";
export const M14_WORLD_KEY="m14_aurora_shield";
export const M14={start:{x:0,y:617,z:0,headingDegrees:0},station:{x:1920,z:9600},missileKills:16,ordinaryKills:15,highValueKills:1,seconds:1200,cloudType:"cirrus",cloudFeet:14000};
export const M14_ENVIRONMENT:EnvironmentSpec={...M06_ENVIRONMENT,label:"Polar cirrus night 02:56",clock:2+56/60,sky:"night",starCount:2500,brightness:0.6,ambient:[40,57,75],outdoorAmbient:[65,81,96],clouds:{cover:0.1,density:0.08,color:[143,164,184]},weather:"aurora",water:{...M06_ENVIRONMENT.water,color:[8,18,29]}};
export function m14Height(x:number,z:number):number{
 if(x<3072)return 32;
 if(z>8192&&x<5120)return 128;
 return 512+128*math.floor(math.abs(math.sin(x/4096)*math.cos(z/4096))*2);
}
export const M14_SURFACE:WorldSurface={height:m14Height,detail:()=>false,material:(x,z)=>m14Height(x,z)===32?"Water":"Snow",nativeWater:()=>false};
export const m14Ground=(x:number,z:number)=>surfaceGround(M14_SURFACE,x,z);
export function m14TargetLayout():WorldContact[]{
 const ts:WorldContact[]=[];
 // Credited kill slots, NOT sixteen initial carriers or an invented split predicate.
 for(let i=0;i<16;i++)ts.push({id:`m14_cruise_${i+1}`,type:i===15?"high_value_cruise":"cruise_slot",group:"intercept",x:1200+(i%3)*240,y:150,z:-7680+i*640,yaw:0});
 for(let i=0;i<4;i++)ts.push({id:`m14_air_${i+1}`,type:i<3?"stealth_fighter":"strategic_bomber",group:"optional_air",x:-4800+i*1200,y:i<3?900:1800,z:-6000,yaw:0});
 ts.push({id:"m14_crown_station",type:"friendly_dish",group:"protected",x:1920,y:80,z:9600,yaw:0});
 return ts;
}
export function m14Routes(){return [1200,1440,1680,1920].map((x,i)=>({id:`m14_corridor_${i+1}`,points:[{x,y:150,z:-7680},{x,y:150,z:8800}]}));}
export function buildM14Plan(seed=1414,checkpoint:(phase?:string)=>void=()=>{}){
 const d=worldDressing(M14_SURFACE,checkpoint),targets=m14TargetLayout();
 for(const sea of d.seaParts)sea.color=M14_ENVIRONMENT.water.color;
 for(const t of targets)if(t.group==="intercept"||t.group==="optional_air")d.part(t.id,t.x,t.y,t.z,8,8,36,"Metal",[187,194,200]);else{
  d.foundation(t.id,t.x,t.z,220);d.part(t.id,t.x,72,t.z,24,56,24);d.part(t.id,t.x,108,t.z,120,16,100,"Metal",[190,205,211]);
 }
 // Sparse original floes leave all low missile tubes open.
 for(let i=0;i<36;i++)d.part("m14_ice_floe_"+i,-9600+(i%6)*1400,40,-7000+math.floor(i/6)*2600,600,16,800,"Ice",[176,208,222]);
 return {key:M14_WORLD_KEY,seed,ops:d.ops,parts:[...d.seaParts,...d.parts],props:d.props,targets,routes:m14Routes()};
}
export const m14Counts=(p:ReturnType<typeof buildM14Plan>)=>compactWorldCounts(p,0);
