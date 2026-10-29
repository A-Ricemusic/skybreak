import type { M05LightAnchor } from "./M05WorldPlan";
import { finiteNumber } from "./EngineBatchB";
import type { FlightPoint } from "./MissionCatalog";
export interface LightField { origin: FlightPoint; rows: number; columns: number; spacing: number; realLights: number }
export interface SearchlightPlan { position: FlightPoint; heading: number; sweep: number; period: number; length: number }
export interface NightLighting { fields: LightField[]; searchlights: SearchlightPlan[] }
export function searchlightHeading(p: SearchlightPlan, seconds: number): number { return p.heading+math.sin(seconds*2*math.pi/p.period)*p.sweep; }
export function validateNightLighting(plan: NightLighting, limit: number): void {
	let count=0,lights=0;
	const point=(p:FlightPoint)=>assert([p.x,p.y,p.z].every(finiteNumber) && math.abs(p.x)<=limit && math.abs(p.z)<=limit && p.y>=0 && p.y<=2000,"Invalid night light point");
	for(const f of plan.fields) { point(f.origin); assert([f.rows,f.columns,f.spacing,f.realLights].every(finiteNumber) && f.rows%1===0 && f.columns%1===0 && f.rows>0 && f.columns>0 && f.spacing>0 && f.realLights%1===0 && f.realLights>=0 && f.realLights<=f.rows*f.columns,"Invalid light field"); count+=f.rows*f.columns; lights+=f.realLights; point({x:f.origin.x+(f.columns-1)*f.spacing,y:f.origin.y,z:f.origin.z+(f.rows-1)*f.spacing}); }
	assert(count<=512 && lights<=16 && plan.searchlights.size()<=8,"Night light budget exceeded");
	for(const s of plan.searchlights) { point(s.position); assert([s.heading,s.sweep,s.period,s.length].every(finiteNumber) && s.sweep>=0 && s.sweep<=180 && s.period>=2 && s.length>0 && s.length<=2000,"Invalid searchlight"); }
}

/** Structural contract of #144's M05LightAnchor; accepts m05LightAnchors() directly.
	* The world authors every position/yaw; this adapter adds rendering budgets only. */
export function nightLightingFromAnchors(anchors: M05LightAnchor[]): NightLighting {
	let realLights = 0;
	return {
		fields: anchors.filter(a => a.kind !== "searchlight").map(a => ({origin:{x:a.x,y:a.y,z:a.z},rows:1,columns:1,spacing:1,realLights:realLights++ < 16 ? 1 : 0})),
		searchlights: anchors.filter(a => a.kind === "searchlight").map(a => ({position:{x:a.x,y:a.y,z:a.z},heading:math.deg(a.yaw),sweep:35,period:12,length:800})),
	};
}
