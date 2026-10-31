import { SpecialWeapons, SpecialState, SpecialDecision } from "./SpecialWeapons";
// Dormant naval/shore defence rules. No mission roster is activated here.
import type { FlightPoint } from "./MissionCatalog";
import type { GroundTargetType, TypedGroundTarget } from "./CampaignEncounters";
import type { DifficultyKind } from "./Difficulty";
export const NAVAL_TYPES: readonly GroundTargetType[] = ["ship", "destroyer", "cruiser", "submarine", "missile_boat", "supply_ship", "landing_ship", "container_ship", "gunboat"];
export interface SurfaceRoute { waypoints: FlightPoint[]; speed: number }
export function navalHull(targetType: GroundTargetType): boolean { return NAVAL_TYPES.includes(targetType); }
export function surfacePose(route: SurfaceRoute, elapsed: number): { position: FlightPoint; yaw: number; moving: boolean } {
	let distance = math.max(0, elapsed) * route.speed;
	for (let i=1;i<route.waypoints.size();i++) {
		const a=route.waypoints[i-1], b=route.waypoints[i], dx=b.x-a.x, dz=b.z-a.z, length=math.sqrt(dx*dx+dz*dz);
		if(distance<length || i===route.waypoints.size()-1) {
			const t=math.clamp(distance/length,0,1);
			return {position:{x:a.x+dx*t,y:a.y,z:a.z+dz*t},yaw:math.deg(math.atan2(-dx,-dz)),moving:distance<length};
		}
		distance-=length;
	}
	error("Surface route needs two points");
}
export function validateNavalTargets(targets: TypedGroundTarget[], limit: number): void {
	const finite=(v: number)=>typeIs(v,"number") && v===v && math.abs(v)<math.huge;
	for(const t of targets) {
		if(t.naval!==undefined) assert(t.naval===true && navalHull(t.type),"Invalid naval lifecycle opt-in");
		if(t.health!==undefined) assert(finite(t.health) && t.health>=1 && t.health<=2000,"Invalid target health");
		if(t.sam!==undefined) assert(t.sam===true && t.type==="sam","Firing SAM needs explicit sam target");
		if(t.parentId!==undefined) {
			const parent=targets.find(p=>p.id===t.parentId);
			assert(parent!==undefined && navalHull(parent.type) && parent.parentId===undefined,"Mount needs a same-phase hull");
			assert(["aa_gun","sam","gun_mount"].includes(t.type) && !t.required && t.route===undefined,"Invalid naval mount");
			assert(math.abs(t.position.x-parent.position.x)<=180 && math.abs(t.position.z-parent.position.z)<=180 && t.position.y>=parent.position.y && t.position.y<=parent.position.y+100,"Mount outside hull envelope");
		}
		if(t.route!==undefined) {
			const r=t.route;
			assert(navalHull(t.type) && r.waypoints.size()>=2 && r.waypoints.size()<=32 && finite(r.speed) && r.speed>0 && r.speed<=60,"Invalid surface route");
			assert(r.waypoints[0].x===t.position.x && r.waypoints[0].y===t.position.y && r.waypoints[0].z===t.position.z,"Surface route must start at hull position");
			for(let i=0;i<r.waypoints.size();i++) {
				const p=r.waypoints[i];
				assert(finite(p.x) && finite(p.y) && finite(p.z) && math.abs(p.x)<=limit && math.abs(p.z)<=limit && p.y===t.position.y,"Surface route outside water plane/airspace");
				if(i>0) { const a=r.waypoints[i-1]; assert((p.x-a.x)**2+(p.z-a.z)**2>1,"Duplicate surface waypoint"); }
			}
			const firstYaw=surfacePose(r,0).yaw;
			const difference=(t.yaw-firstYaw+180)%360-180;
			assert(finite(t.yaw) && math.abs(difference)<=0.1,"Surface yaw must match first route leg (0.1 degree tolerance)");
		}
	}
}
export interface SamShooter { typedGround?: {sam?: true}; health: number; enabled: boolean; windup: number }
export interface SamProjectile { sam?: boolean; hostile: boolean }
export const SamRules = {
	/** A warmup transfers its occupied slot to its projectile on launch. No temporary arrays. */
	Threats(enemies: readonly SamShooter[], projectiles: readonly SamProjectile[]): number {
		let count=0;
		for(const e of enemies) if(e.typedGround?.sam===true && e.health>0 && e.enabled && e.windup>0) count++;
		for(const p of projectiles) if(p.sam===true && p.hostile) count++;
		return count;
	},
	Range: 2400, MinimumRange: 120, Windup: 2, Reload: 10,
	Cap(d: DifficultyKind): number { return d==="easy" ? 1 : d==="ace" ? 3 : 2; },
	Scale(d: DifficultyKind): number { return d==="easy" ? 0.65 : d==="ace" ? 1.25 : 1; },
	Eligible(alive: boolean, enabled: boolean, distance: number): boolean { return alive && enabled && distance>=SamRules.MinimumRange && distance<=SamRules.Range; },
};
/** An opted-in XLAA becomes a hull-only sea-skimming strike. No blast/splash credits. */
export const AntiShipRules = {
	Damage: 220, Speed: 600, CruiseHeight: 22, LookAhead: 160, TerminalRange: 240,
	/** Lock range stays owned by SpecialWeapons (the selected XLAA envelope). */
	Activate(state: SpecialState, lockedTargets: number, targetType?: GroundTargetType): SpecialDecision {
		if(targetType===undefined || !navalHull(targetType)) return {kind:"denied",reason:"anti_ship_hull_only"};
		return SpecialWeapons.Activate(state,lockedTargets);
	},
	Aim(from: FlightPoint, target: FlightPoint, waterY: number): FlightPoint {
		const distance=math.sqrt((target.x-from.x)**2+(target.z-from.z)**2);
		if(distance<=AntiShipRules.TerminalRange) return target;
		const fraction=AntiShipRules.LookAhead/distance;
		return {x:from.x+(target.x-from.x)*fraction,y:waterY+AntiShipRules.CruiseHeight,z:from.z+(target.z-from.z)*fraction};
	},
};
