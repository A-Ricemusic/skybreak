import type { EnvironmentSpec } from "./EnvironmentPresets";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldDressing, compactWorldCounts, type WorldContact } from "./LateWorldDressing";
export const M17_WORLD_KEY="m17_capital_assault";
export const M17={cloudFeet:12000,start:{x:0,y:471,z:7680,headingDegrees:0},initial:{ground:34,naval:4},creditedGround:55,wingmen:4,ruskRetreatFraction:0.25,elite:{x:0,y:1200,z:-3840},exit:{x:-13440,y:1200,z:-3840}};
export const M17_ENVIRONMENT:EnvironmentSpec={...M06_ENVIRONMENT,water:{...M06_ENVIRONMENT.water,color:[86,91,88]},label:"Capital gold low sun",clock:18+20/60,sky:"dusk",brightness:1.6,ambient:[143,115,92],outdoorAmbient:[175,141,103],atmosphere:{density:0.25,offset:0,haze:2,glare:0.8,color:[233,191,127],decay:[127,110,93]},clouds:{cover:0.2,density:0.15,color:[231,209,176]}};
function m17Height(x:number,z:number):number{if(x>=-3072&&x<0&&(z<=-6144||z>=-4096&&z<=-3072))return 80;return x<0||math.abs(z+1024)<=512||math.abs(z+5120)<=512?32:80;}
export const M17_SURFACE:WorldSurface={height:m17Height,detail:()=>false,material:(x,z)=>m17Height(x,z)===32?"Water":"Ground",nativeWater:()=>false};
export const m17Ground=(x:number,z:number)=>surfaceGround(M17_SURFACE,x,z);
export function m17TargetLayout():WorldContact[]{
 const ts:WorldContact[]=[];
 for(let i=0;i<55;i++){const x=1300+(i%8)*800,z=-7200+math.floor(i/8)*1400;ts.push({id:`m17_ground_slot_${i+1}`,type:"unresolved_ground",group:"capital",x,y:m17Ground(x,z)+12,z,yaw:0});}
 for(let i=0;i<4;i++)ts.push({id:`m17_hull_${i+1}`,type:"unresolved_hull",group:"naval",x:-9000+i*1800,y:40,z:-2400,yaw:0});
 for(let i=0;i<4;i++)ts.push({id:`m17_rusk_wingman_${i+1}`,type:"elite_wingman",group:"elite",x:-1800+i*1200,y:1200,z:-3840,yaw:0});
 const types=["attack_helicopter","attack_helicopter","attack_helicopter","attack_helicopter","fighter","fighter","fighter","fighter","active_fighter","active_fighter","active_fighter","tiltrotor","tiltrotor","tiltrotor","tiltrotor","s37_slot","euro_fighter","euro_fighter"];
 for(let i=0;i<types.size();i++)ts.push({id:`m17_air_${i+1}`,type:types[i],group:"optional_air",x:-10000+(i%9)*1000,y:650,z:4000+math.floor(i/9)*800,yaw:0});
 for(let i=48;i<55;i++){const t=ts[i],h=ts[55+(i-48)%4];t.x=h.x;t.y=80;t.z=h.z+(i<52?-60:60);t.group="naval_mount";}
 ts.push({id:"m17_rusk",type:"rusk_retreat",group:"elite",...M17.elite,yaw:0});ts.push({id:"m17_enemy_bridge",type:"bridge_section",group:"bridge",x:-1920,y:126,z:-4800,yaw:0});return ts;
}
export function buildM17Plan(seed=1717,checkpoint:(phase?:string)=>void=()=>{}){
 const d=worldDressing(M17_SURFACE,checkpoint),targets=m17TargetLayout();
 for(const sea of d.seaParts)sea.color=M17_ENVIRONMENT.water.color;
 for(const t of targets)if(t.group==="naval")d.part(t.id,t.x,48,t.z,100,32,280,"Metal");else if(t.group!=="bridge"&&t.group!=="elite"&&t.group!=="optional_air")d.contact(t,t.group==="capital");
 for(let i=0;i<80;i++){const x=900+(i%10)*950,z=-8500+math.floor(i/10)*1250;if(targets.some(t=>t.group==="capital"&&math.abs(t.x-x)<280&&math.abs(t.z-z)<280)||math.abs(x-3840)<320&&z>=-2600&&z<=600||m17Ground(x,z)===32||math.abs(x-1920)<600&&math.abs(z+6720)<600)continue;const h=70+(i%4)*28;d.part("m17_city_"+i,x,80+h/2,z,360,h,360);}
 // Sparse drowned skyline is below the elite battle/retreat tube.
 for(let i=0;i<18;i++)d.part("m17_flooded_"+i,-6400+(i%6)*650,60,-500+math.floor(i/6)*900,200,100,240);
 for(const [id,x,z] of [["m17_friendly_bridge",3840,-960],["m17_enemy_bridge",-1920,-4800]] as const){
  for(let i=0;i<3;i++)d.part(id,x,110,z+(i-1)*1024,180,32,1024);
 }
 d.runway("m17_service",11000,6200);
 d.foundation("m17_parliament",1920,-6720,500);d.part("m17_parliament",1920,156,-6720,460,128,380);
 return {key:M17_WORLD_KEY,seed,ops:d.ops,parts:[...d.seaParts,...d.parts],props:d.props,targets,routes:[{id:"m17_rusk_exit",points:[M17.elite,M17.exit]}]};
}
export const m17Counts=(p:ReturnType<typeof buildM17Plan>)=>compactWorldCounts(p,0);

/** Live combat directors own optional aircraft, wingmen and Rusk. */
export function buildM17ScenePlan(seed=1717,checkpoint:(phase?:string)=>void=()=>{}) {
 const plan=buildM17Plan(seed,checkpoint);
 const airborne=new Set(plan.targets.filter(t=>t.group==="elite"||t.group==="optional_air").map(t=>t.id));
 plan.targets=plan.targets.filter(t=>!airborne.has(t.id));
 plan.parts=plan.parts.filter(p=>!airborne.has(p.name));
 return plan;
}
