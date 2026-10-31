import type { EnvironmentSpec } from "./EnvironmentPresets";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldDressing, compactWorldCounts, type WorldContact } from "./LateWorldDressing";
export const M15_WORLD_KEY="m15_city_answers";
export const M15={start:{x:0,y:383,z:7680,headingDegrees:0},service:{x:-4800,y:92,z:-9600,length:2304,width:128,approachLength:3200},initialGround:62,creditedGround:53,scoreGoal:2000,bombers:6};
export const M15_ENVIRONMENT:EnvironmentSpec={...M06_ENVIRONMENT,water:{...M06_ENVIRONMENT.water,color:[16,23,32]},label:"Warm illuminated city night",clock:22,sky:"night",brightness:0.8,ambient:[78,65,60],outdoorAmbient:[108,88,75],atmosphere:{density:0.32,offset:0,haze:2.8,glare:0,color:[133,108,89],decay:[67,55,51]},clouds:{cover:0.6,density:0.2,color:[119,100,88]}};
export const M15_SURFACE:WorldSurface={height:(x)=>x>=1024&&x<2048?32:80,detail:()=>false,material:(x)=>x>=1024&&x<2048?"Water":"Ground",nativeWater:()=>false};
export const m15Ground=(x:number,z:number)=>surfaceGround(M15_SURFACE,x,z);
export function m15TargetLayout():WorldContact[]{
 const ts:WorldContact[]=[];
 for(let i=0;i<62;i++)ts.push({id:i===0?"m15_command_relay":`m15_ground_slot_${i+1}`,type:i===0?"command_relay":"unresolved_ground",group:"city",x:i===0?2880:-7200+(i%8)*900,y:92,z:i===0?-4800:-6000+math.floor(i/8)*1000,yaw:0});
 for(let i=0;i<7;i++)ts.push({id:`m15_transport_${i+1}`,type:"parked_transport",group:"airfield",x:-5400,y:92,z:-10400+i*260,yaw:0});
 for(let i=0;i<6;i++)ts.push({id:`m15_bomber_${i+1}`,type:"bomber",group:"retaliation",x:-9600+i*240,y:1300+i*60,z:-13440,yaw:0});
 for(let i=0;i<8;i++)ts.push({id:`m15_air_${i+1}`,type:i<4?"city_helicopter":i<6?"attack_jet":i===6?"fighter":"named_ace_slot",group:"optional_air",x:-6000+i*800,y:600,z:2000,yaw:0});
 return ts;
}
export function m15BomberRoutes(){return m15TargetLayout().filter(t=>t.type==="bomber").map(t=>({id:t.id,points:[{x:t.x,y:t.y,z:t.z},{x:2880,y:900,z:-4800}]}));}
export function buildM15Plan(seed=1515,checkpoint:()=>void=()=>{}){
 const d=worldDressing(M15_SURFACE,checkpoint),targets=m15TargetLayout();
 for(const sea of d.seaParts)sea.color=M15_ENVIRONMENT.water.color;
 for(const t of targets)if(t.id!=="m15_command_relay")d.contact(t,t.group!=="retaliation"&&t.group!=="optional_air");
 d.runway("m15_runway",-4800,-9600);
 // 96 two-Part blocks: broad roads remain between blocks, no individual window instances.
 for(let i=0;i<96;i++){
  const x=-7600+(i%12)*1100,z=-6800+math.floor(i/12)*1100,h=64+(i%4)*24;
  if(targets.some(t=>t.group==="city"&&math.abs(t.x-x)<300&&math.abs(t.z-z)<300)||x>=700&&x<=3400||math.abs(x+4800)<800&&z<-6000||math.abs(x+3840)<500&&math.abs(z+2880)<600||math.abs(x-2880)<600&&math.abs(z+4800)<600)continue;
  d.part("m15_block_"+i,x,80+h/2,z,420,h,420);
  d.part("m15_windows_"+i,x,80+h*0.65,z+211,350,8,2,"Neon",[241,180,94],false);
 }
 for(const z of [-2000,2000])d.part("m15_river_bridge",1536,104,z,2048,24,180);
 for(const x of [-4020,-3660])d.part("m15_arch_pier",x,160,-2880,60,160,80);
 d.part("m15_arch_crown",-3840,248,-2880,420,16,80);
 d.foundation("m15_command_relay",2880,-4800,400);d.part("m15_command_relay",2880,172,-4800,320,160,320);
 return {key:M15_WORLD_KEY,seed,ops:d.ops,parts:[...d.seaParts,...d.parts],props:d.props,targets,routes:m15BomberRoutes()};
}
export const m15Counts=(p:ReturnType<typeof buildM15Plan>)=>compactWorldCounts(p,0);

/** Runtime composition: airborne inventory IDs belong exclusively to live aircraft. */
export function buildM15ScenePlan(seed=1515,checkpoint:()=>void=()=>{}) {
 const plan=buildM15Plan(seed,checkpoint);
 const airborne=new Set(plan.targets.filter(t=>t.group==="retaliation"||t.group==="optional_air").map(t=>t.id));
 plan.parts=plan.parts.filter(p=>!airborne.has(p.name));
 plan.targets=plan.targets.filter(t=>!airborne.has(t.id));
 return plan;
}
