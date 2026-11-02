import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
export const M13_WORLD_KEY="m13_evidence_ravine";
export const M13={half:16384,start:{x:0,y:383,z:11520,headingDegrees:0},scoreGoal:1300,sweepSeconds:420,interceptSeconds:900,jammerKills:32,routeSeconds:418};
export const M13_ENVIRONMENT: EnvironmentSpec={...M06_ENVIRONMENT,label:"Grey stratus ravine 11:05",clock:11+5/60,sky:"overcast",brightness:1.4,sunSize:0,ambient:[106,108,105],outdoorAmbient:[130,132,126],atmosphere:{density:0.42,offset:0.1,haze:3,glare:0,color:[160,164,162],decay:[91,95,88]},clouds:{cover:1,density:0.3,color:[162,165,162]},grade:{saturation:-0.3,contrast:0.04,brightness:0,tint:[230,232,225]}};
export const M13_ANCHORS=[{x:0,z:11520},{x:-3360,z:6240},{x:2400,z:0},{x:-1920,z:-5760},{x:0,z:-11520}];
export function m13RouteX(z:number):number {
 for(let i=0;i<4;i++){const a=M13_ANCHORS[i],b=M13_ANCHORS[i+1];if(z<=a.z&&z>=b.z)return a.x+(b.x-a.x)*(a.z-z)/(a.z-b.z);}
 return 0;
}
export function m13RoutePoint(t:number){const z=11520-23040*t;return {x:m13RouteX(z),y:383,z};}
function m13Height(x:number,z:number):number {
 // Reserve the entire cell's swept route, including steep bends at LOD boundaries.
 const row=math.floor(z/1024)*1024,a=m13RouteX(row),b=m13RouteX(row+1024);
 if(x>=math.min(a,b)-1100&&x<=math.max(a,b)+1100)return 128;
 // Wider side basins and branches place optional balloons off the main track.
 if(math.abs(x-m13RouteX(z))<2500&&math.abs(z%3072)<900)return 256;
 return 768+128*math.floor(2*math.abs(math.sin(x/4096)*math.cos(z/4096)));
}
export const M13_SURFACE:WorldSurface={height:m13Height,detail:()=>false,material:(x,z)=>m13Height(x,z)<300?"LeafyGrass":"Rock"};
export const m13Ground=(x:number,z:number)=>surfaceGround(M13_SURFACE,x,z);
export function m13JammerLayout(){
 const ts=new Array<{id:string;type:string;group:string;x:number;y:number;z:number;yaw:number}>();
 for(let c=0;c<8;c++)for(let j=0;j<4;j++){
  const z=9000-c*2500+(j<2?-200:200), x=m13RouteX(z)+[-850,-350,350,850][j];
  ts.push({id:`m13_jammer_${c*4+j+1}`,type:"airship",group:`cluster_${c+1}`,x,y:450+j*140,z,yaw:0});
 }
 return ts;
}
function m13Routes(){const points=new Array<{x:number;y:number;z:number}>();for(let i=0;i<=128;i++)points.push(m13RoutePoint(i/128));return [{id:"m13_evidence_plane",durationSeconds:418,points}];}
export function buildM13Plan(seed=1313,checkpoint:(phase?:string)=>void=()=>{}){
 const terrain=compactSurface(M13_SURFACE,checkpoint),parts:PartSpec[]=[],props:PropSpec[]=[],jammers=m13JammerLayout(),p=m13RoutePoint(0);
 const targets=[...jammers,{id:"m13_evidence_plane",type:"evidence_plane",group:"protected",...p,yaw:0}];
 const part=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:[number,number,number])=>parts.push({name,x,y,z,sx,sy,sz,color,yaw:0,material:"Metal",shape:"block",solid:true,grounded:false});
 // Original procedural review silhouettes, not combat actors or uploaded assets.
 for(const t of jammers){part(t.id,t.x,t.y,t.z,26,24,60,[169,173,160]);part(t.id,t.x,t.y-18,t.z,12,12,28,[72,80,73]);}
 part("m13_evidence_plane",p.x,p.y,p.z,6,6,36,[214,221,213]);part("m13_evidence_plane",p.x,p.y,p.z,36,2,8,[169,181,174]);part("m13_evidence_plane",p.x,p.y+3,p.z+14,14,6,6,[169,181,174]);
 return {...terrain,key:M13_WORLD_KEY,seed,parts,props,targets,routes:m13Routes()};
}
export const m13Counts=(p:ReturnType<typeof buildM13Plan>)=>compactWorldCounts(p,0);
