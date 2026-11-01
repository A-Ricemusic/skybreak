import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
export const M12_WORLD_KEY = "m12_command_ring";
export const M12 = { half: 16384, radius: 2400, start: { x: 0, y: 500, z: 10080, headingDegrees: 0 }, service: { x: -8640, y: 104, z: 10560, length: 2304, width: 128, approachLength: 3200 }, briefing: { air: 3, ground: 18, total: 21 }, kills: { ground: 24, air: 9 }, strikeSeconds: 900, eliteSeconds: 600 };
export const M12_ENVIRONMENT: EnvironmentSpec = { ...M06_ENVIRONMENT, label: "Clear arid daylight 10:08", clock: 10 + 8/60, sky: "day", brightness: 2.5, ambient: [161,151,132], outdoorAmbient: [186,178,158], atmosphere: { density: 0.22, offset: 0, haze: 1.3, glare: 0.4, color: [204,222,235], decay: [161,151,132] }, clouds: { cover: 0.1, density: 0.1, color: [240,242,242] } };
function m12Height(x: number, z: number): number {
 if (math.abs(x + 8640) < 1400 && math.abs(z - 10560) < 5000 || math.abs(x) < 1800 && z > 3500) return 80;
 const r = math.sqrt(x*x+z*z);
 if (r < 4200) return 80;
 if (r < 6400) return 320;
 if (r < 9000) return 544;
 return 544 + 128 * math.floor(2 * math.abs(math.sin(x/4500)*math.cos(z/4500)));
}
export const M12_SURFACE: WorldSurface = { height: m12Height, detail: () => false, material: (x,z) => m12Height(x,z) > 300 ? "Rock" : "Sandstone" };
export const m12Ground = (x: number,z: number) => surfaceGround(M12_SURFACE,x,z);
export interface M12Contact { id: string; type: string; group: string; x: number; y: number; z: number; yaw: number; live: boolean }
/** Wreck assigned southeast by authored convention, not surveyed compass evidence. */
export function m12TargetLayout(): M12Contact[] {
 const ts: M12Contact[] = [];
 for (let i=0;i<8;i++) { const a=i*math.pi/4; ts.push({ id: `m12_gun_${i+1}`, type: i===3 ? "gun_wreck" : "ring_gun", group: "ring", x: 2400*math.sin(a), y: 104, z: -2400*math.cos(a), yaw: -a, live: i!==3 }); }
 ts.push({ id: "m12_ecm", type: "ground_ecm", group: "core", x:0,y:104,z:0,yaw:0,live:true });
 for (let i=0;i<16;i++) { const a=i*math.pi/8+0.09; ts.push({ id:`m12_defence_${i+1}`, type:i<9?"aa":"sam", group:"defence", x:3300*math.sin(a), y:104,z:-3300*math.cos(a),yaw:-a,live:true }); }
 return ts;
}
export function buildM12Plan(seed=1212, checkpoint: () => void = () => {}) {
 const terrain=compactSurface(M12_SURFACE,checkpoint), parts: PartSpec[]=[], props: PropSpec[]=[];
 const part=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw=0,material="Concrete",color:[number,number,number]=[163,153,130]) => parts.push({name,x,y,z,sx,sy,sz,yaw,material,color,shape:"block",solid:true,grounded:false});
 const targets=m12TargetLayout();
 for (const t of targets) {
  const gun=t.group==="ring", w=gun?480:160;
  part(`${t.id}_foundation`,t.x,88,t.z,w,32,w);
  if (gun) parts[parts.size()-1].shape = "cylinder";
  if (gun) {
   const wreck=!t.live;
   part(t.id,t.x,104+(wreck?12:40),t.z,100,wreck?24:80,100,t.yaw,"Metal",wreck?[65,61,56]:[105,111,104]);
   // Original paired rails; wreck lies low and never owns a score actor.
   for (const side of [-1,1]) { const dx=side*22, dz=-90; part(t.id,t.x+dx*math.cos(t.yaw)+dz*math.sin(t.yaw),wreck?126:184,t.z-dx*math.sin(t.yaw)+dz*math.cos(t.yaw),12,16,240,t.yaw,"Metal",[79,87,80]); }
  } else { part(t.id,t.x,t.y+12,t.z,48,24,48,0,"Metal"); if(t.type==="ground_ecm") part(t.id,t.x,t.y+44,t.z,8,64,8,0,"Metal"); }
 }
 // Modular radial and annular paving: low, non-targetable, no overlapping target hitboxes.
 for(let i=0;i<32;i++) { const a=i*math.pi/16; part("m12_ring_road",1850*math.sin(a),86,-1850*math.cos(a),80,12,370,-a,"Concrete"); }
 for(let i=0;i<8;i++) { const a=i*math.pi/4; for(let j=0;j<3;j++) part("m12_radial_road",(450+j*500)*math.sin(a),86,-(450+j*500)*math.cos(a),64,12,500,-a); }
 for(const side of [-1,1]) { part("m12_runway_foundation",-8640,88,10560+side*576,328,32,1152); part("m12_runway",-8640,105,10560+side*576,128,2,1152,0,"Asphalt",[53,54,52]); }
 part("m12_recovery_marker",4200, m12Ground(4200,1200)+8,1200,64,16,64,0,"Concrete",[220,174,70]);
 return {...terrain,key:M12_WORLD_KEY,seed,parts,props,targets};
}
export const m12Counts=(p:ReturnType<typeof buildM12Plan>)=>compactWorldCounts(p,0);
