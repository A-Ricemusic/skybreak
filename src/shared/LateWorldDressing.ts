import type { PartSpec, PropSpec } from "./WorldPlan";
import type { WorldSurface } from "./CompactWorldSurface";
import { compactSurface, surfaceGround } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
export interface WorldContact { id:string; type:string; group:string; x:number; y:number; z:number; yaw:number }
export function worldDressing(surface:WorldSurface, checkpoint:(phase?:string)=>void){
 const terrain=compactSurface(surface,checkpoint), parts:PartSpec[]=[], props:PropSpec[]=[];
 const part=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,material="Concrete",color:[number,number,number]=[117,124,128],solid=true)=>{
  parts.push({name,x,y,z,sx,sy,sz,material,color,solid,yaw:0,shape:"block",grounded:false});
 };
 const foundation=(id:string,x:number,z:number,w=100,d=w)=>{
  const g=surfaceGround(surface,x,z);part(id+"_foundation",x,g+4,z,w,16,d);return g+12;
 };
 const contact=(t:WorldContact,ground=false)=>{
  if(ground)foundation(t.id,t.x,t.z,96);
  part(t.id,t.x,t.y+12,t.z,40,24,56,"Metal");
 };
 const runway=(id:string,x:number,z:number)=>{
  for(const dz of [-576,576]){
   foundation(id,x,z+dz,328,1152);part(id,x, surfaceGround(surface,x,z)+13,z+dz,128,2,1152,"Asphalt",[48,51,54]);
  }
 };
 return {...terrain,parts,props,part,foundation,contact,runway};
}
export { compactWorldCounts };
