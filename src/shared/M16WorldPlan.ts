import type { EnvironmentSpec } from "./EnvironmentPresets";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldDressing, compactWorldCounts, type WorldContact } from "./LateWorldDressing";
export const M16_WORLD_KEY="m16_road_home";
export const M16={start:{x:0,y:383,z:9600,headingDegrees:315},service:{x:-8640,y:92,z:7680,length:2304,width:128,approachLength:3200},initial:{ground:113,air:13},credited:{ground:138,air:14}};
export const M16_ENVIRONMENT:EnvironmentSpec={...M06_ENVIRONMENT,label:"Pale dusty desert daylight",clock:12,sky:"day",brightness:2.4,ambient:[158,146,121],outdoorAmbient:[190,178,151],atmosphere:{density:0.28,offset:0,haze:2.8,glare:0.2,color:[216,218,202],decay:[166,149,122]},clouds:{cover:0.1,density:0.1,color:[234,230,218]}};
export function m16Height(x:number,z:number):number{
 if(math.abs(x+8640)<1500&&math.abs(z-7680)<5000)return 80;
 if(math.abs(x+3840)<1400&&math.abs(z+3840)<1400)return 48;
 if(math.abs(x)<6500)return 80;
 return 384+128*math.floor(math.abs(math.sin(x/6000)*math.cos(z/6000))*2);
}
export const M16_SURFACE:WorldSurface={height:m16Height,detail:()=>false,material:(x,z)=>m16Height(x,z)>300?"Sandstone":"Sand"};
export const m16Ground=(x:number,z:number)=>surfaceGround(M16_SURFACE,x,z);
export function m16TargetLayout():WorldContact[]{
 const ts:WorldContact[]=[];
 for(let i=0;i<138;i++){const x=-2400+(i%12)*440,z=2880-math.floor(i/12)*900;ts.push({id:`m16_ground_slot_${i+1}`,type:"unresolved_ground",group:`line_${math.floor(i/12)+1}`,x,y:m16Ground(x,z)+12,z,yaw:0});}
 const types=["strike_jet","strike_jet","strike_jet","attack_jet","attack_jet","stealth_strike","stealth_strike","stealth_strike","attack_helicopter","attack_helicopter","attack_helicopter","attack_helicopter","attack_helicopter","strike_fighter"];
 for(let i=0;i<14;i++)ts.push({id:`m16_air_${i+1}`,type:types[i],group:"air_cover",x:-4000+(i%7)*1200,y:600+math.floor(i/7)*300,z:-10000-math.floor(i/7)*600,yaw:0});
 return ts;
}
export function m16ColumnRoute(){return [{x:0,y:104,z:9600},{x:0,y:104,z:4000},{x:0,y:104,z:-6000},{x:1920,y:104,z:-7680}];}
export function buildM16Plan(seed=1616,checkpoint:(phase?:string)=>void=()=>{}){
 const d=worldDressing(M16_SURFACE,checkpoint),targets=m16TargetLayout();
 for(const t of targets)d.contact(t,t.group!=="air_cover");
 d.runway("m16_runway",-8640,7680);
 for(let i=0;i<16;i++){const x=1200+(i%4)*480,z=-7200-math.floor(i/4)*480;d.foundation("m16_ruin_"+i,x,z,220);d.part("m16_ruin_"+i,x,128,z,200,72,180);}
 for(let i=0;i<8;i++)d.part("m16_friendly_column_"+i,0,96,9600-i*120,24,32,48,"Metal",[105,126,92]);
 return {key:M16_WORLD_KEY,seed,ops:d.ops,parts:d.parts,props:d.props,targets,routes:[{id:"m16_column",points:m16ColumnRoute()}]};
}
export const m16Counts=(p:ReturnType<typeof buildM16Plan>)=>compactWorldCounts(p,0);

/** Live directors own airborne contacts and the moving column. */
export function buildM16ScenePlan(seed=1616,checkpoint:(phase?:string)=>void=()=>{}) {
 const plan=buildM16Plan(seed,checkpoint);
 const airborne=new Set(plan.targets.filter(t=>t.group==="air_cover").map(t=>t.id));
 plan.targets=plan.targets.filter(t=>!airborne.has(t.id));
 plan.parts=plan.parts.filter(p=>!airborne.has(p.name)&&p.name.sub(1,20)!=="m16_friendly_column_");
 return plan;
}
