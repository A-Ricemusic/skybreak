import { validateNavalTargets, SurfaceRoute } from "./EngineBatchD2";
import { BomberRules } from "./BomberRules";
import type { AceLivery } from "./AssetSelection";
import type { MissionBlueprint, MissionPhaseBlueprint, FlightPoint } from "./MissionCatalog";
import type { MissionAirspacePolicy, MissionScoringPolicy } from "./MissionPolicy";

export const GROUND_TYPES = ["parked_bomber", "hangar", "aa_gun", "control_tower", "substation", "radar_dome", "parked_helicopter", "refinery", "fuel_tank", "pipeline", "oil_rig", "rig_tower", "ship", "crane", "sam", "control_room", "smokestack", "gas_tank", "pump_station", "destroyer", "cruiser", "submarine", "missile_boat", "supply_ship", "landing_ship", "container_ship", "gun_mount", "containers", "storage"] as const;
export type GroundTargetType = typeof GROUND_TYPES[number];
/** HUD label (model name) of each typed ground target. */
export const GROUND_TARGET_LABELS: { readonly [K in GroundTargetType]: string } = {
	parked_bomber: "BOMBER", hangar: "HANGAR", aa_gun: "AA GUN", control_tower: "CTRL TOWER", substation: "SUBSTATION", radar_dome: "RADAR",
	parked_helicopter: "HELICOPTER", refinery: "REFINERY", fuel_tank: "FUEL TANK", pipeline: "PIPELINE", oil_rig: "OIL RIG", rig_tower: "RIG TOWER",
	destroyer: "DESTROYER", cruiser: "CRUISER", submarine: "SUBMARINE", missile_boat: "MISSILE BOAT", supply_ship: "SUPPLY SHIP", landing_ship: "LANDING SHIP", container_ship: "CONTAINER SHIP", gun_mount: "GUN", containers: "CONTAINERS", storage: "STORAGE",
	ship: "SHIP", crane: "CRANE", sam: "SAM", control_room: "CONTROL ROOM", smokestack: "SMOKESTACK", gas_tank: "GAS TANK", pump_station: "PUMP STATION",
};
export interface TypedGroundTarget {
	/** Mount positions are authored world positions; movement preserves the hull-local offset. */
	naval?: true; parentId?: string; route?: SurfaceRoute; sam?: true; health?: number;
	id: string; type: GroundTargetType; position: FlightPoint; yaw: number; required: boolean; scoreRole: string; group?: string;
}
// time is mission time since control; an elapsed time fires immediately when its owning phase starts.
export type ArrivalTrigger = { kind: "time"; seconds: number } | { kind: "ground_group"; group: string }
	| { kind: "required_count"; count: number } | { kind: "phase_start"; phase: number }
	// The player's aircraft comes within `radius` horizontal studs of (x, z).
	| { kind: "approach"; x: number; z: number; radius: number };
export interface FighterArrival {
	livery?: AceLivery;
	aircraft?: "jammer" | "helicopter";
	route?: { waypoints: FlightPoint[]; speed: number };
	id: string; trigger: ArrivalTrigger; count: number; role: "raider" | "escort"; scoreRole: string;
	spawn?: FlightPoint; headingDegrees?: number; scramble?: boolean;
	/** Radio line said when the wave is really in the air. */
	call?: string;
}
export interface StandaloneAce {
	id: string; name: string; livery: AceLivery; health: number; trigger: ArrivalTrigger;
	stageLines?: string[]; call?: string;
	behaviour: "dogfight" | "ground_attack"; scoreRole: "ace"; spawn?: FlightPoint; headingDegrees?: number;
}
export interface TriggerContext { elapsed: number; phase: number; requiredKills: number; destroyed: Set<string>; retired?: Set<string>; targets: TypedGroundTarget[]; player?: { x: number; z: number } }
export function arrivalDue(trigger: ArrivalTrigger, context: TriggerContext): boolean {
	if (trigger.kind === "time") return context.elapsed >= trigger.seconds;
	if (trigger.kind === "approach") return context.player !== undefined && math.sqrt((context.player.x-trigger.x)**2 + (context.player.z-trigger.z)**2) <= trigger.radius;
	if (trigger.kind === "phase_start") return context.phase >= trigger.phase;
	if (trigger.kind === "required_count") return context.requiredKills >= trigger.count;
	let found=false;
	for(const target of context.targets) if(target.group===trigger.group) {
		found=true;
		if(!context.destroyed.has(target.id) && context.retired?.has(target.id)!==true) return false;
	}
	return found;
}
export function takeArrival(id: string, trigger: ArrivalTrigger, context: TriggerContext, fired: Set<string>): boolean {
	if (fired.has(id) || !arrivalDue(trigger, context)) return false;
	fired.add(id); return true;
}
export function scramblePose(spawn: FlightPoint, headingDegrees: number, seconds: number): FlightPoint {
	const t = math.clamp(seconds, 0, 8), distance = 35*t + 9*t*t;
	return { x: spawn.x + math.sin(math.rad(headingDegrees))*distance, y: spawn.y + math.max(0,t-3)*45, z: spawn.z - math.cos(math.rad(headingDegrees))*distance };
}
/** Pure authored formation placement: runway aircraft trail the leader on the centreline. */
export function authoredAirPose(spawn: FlightPoint, heading: number, index: number, runway: boolean, pivotAboveBottom: number) {
	const angle=math.rad(heading), lateral=runway ? 0 : index*35, trail=runway ? index*70 : 0;
	return { position: {x:spawn.x+lateral*math.cos(angle)-trail*math.sin(angle), y:spawn.y+(runway ? pivotAboveBottom : 0), z:spawn.z+lateral*math.sin(angle)+trail*math.cos(angle)}, facing:{x:math.sin(angle),y:0,z:-math.cos(angle)} };
}
export function airSpawnHeight(y: number, surfaceY?: number): number { return math.max(170,y,surfaceY !== undefined ? surfaceY+120 : 170); }
function finite(n: number): boolean { return typeIs(n,"number") && n === n && math.abs(n) < math.huge; }
export function validateCampaignEncounters(blueprint: MissionBlueprint, phases: MissionPhaseBlueprint[], airspace: MissionAirspacePolicy, scoring: MissionScoringPolicy): void {
	const ids = new Set<string>(), groups = new Set<string>();
	assert(phases.size()>0,"Mission needs at least one phase");
	const claim = (id: string) => { assert(id.size()>0 && !ids.has(id), "Encounter ids must be unique and nonempty"); ids.add(id); };
	const point = (p: FlightPoint) => { assert(finite(p.x) && finite(p.y) && finite(p.z) && math.abs(p.x)<=airspace.spawnLimit && math.abs(p.z)<=airspace.spawnLimit && p.y>=0 && p.y<=2000,"Encounter point outside airspace"); };
	const role = (key: string) => assert(key.size()>0 && key.size()<=32 && scoring.points[key] !== undefined,"Encounter needs a configured scoring role");
	for (const phase of phases) {
		assert(phase.label.size()>0 && phase.label.size()<=40,"Phase needs a short label");
		if(phase.count !== undefined) assert(finite(phase.count) && phase.count%1===0 && phase.count>0,"Phase count must be a positive integer");
		validateNavalTargets(phase.groundTargets ?? [], airspace.spawnLimit);
		let required = 0;
		for (const target of phase.groundTargets ?? []) {
			claim(target.id); point(target.position); role(target.scoreRole);
			assert(GROUND_TYPES.includes(target.type) && finite(target.yaw) && typeIs(target.required,"boolean"),"Invalid typed target");
			if (target.group !== undefined) { assert(target.group.size()>0,"Empty ground group"); groups.add(target.group); }
			if (target.required) required++;
		}
		if (phase.groundTargets !== undefined) {
			assert(phase.hazard === undefined && phase.twist === undefined,"Typed targets cannot share a legacy hazard/twist phase");
			if (phase.kind === "required_ground") assert(required === phase.count && required>0,"Typed strike must match its required count");
			else assert(required===0,"Required typed ground targets need a ground strike phase");
		}
	}
	const trigger = (t: ArrivalTrigger, owner: number) => {
		if (t.kind === "time") assert(finite(t.seconds) && t.seconds>=0,"Invalid arrival time");
		else if (t.kind === "phase_start") assert(finite(t.phase) && t.phase%1===0 && t.phase>=0 && t.phase<phases.size() && t.phase<=owner,"Invalid arrival phase");
		else if (t.kind === "required_count") assert(finite(t.count) && t.count%1===0 && t.count>0,"Invalid required kill trigger");
		else if (t.kind === "approach") assert(finite(t.x) && finite(t.z) && finite(t.radius) && t.radius>0 && math.abs(t.x)<=airspace.hardHalfWidth && math.abs(t.z)<=airspace.hardHalfWidth,"Invalid approach trigger");
		else assert(t.kind === "ground_group" && groups.has(t.group),"Unknown ground group");
	};
	for (let owner=0;owner<phases.size();owner++) {
		const phase=phases[owner];
		assert((phase.fighterWaves ?? []).filter(w=>w.aircraft!==undefined).reduce((sum,w)=>sum+w.count,0)<=6,"Route actor budget is six per phase");
		for (const wave of phase.fighterWaves ?? []) {
			assert(wave.livery===undefined || ["Vulture","Elite","Rusk"].includes(wave.livery),"Invalid wave livery");
			assert((wave.aircraft!==undefined)===(wave.route!==undefined),"Route aircraft needs route");
			if(wave.route) { assert(wave.aircraft==="jammer" || wave.aircraft==="helicopter","Invalid route aircraft"); assert(wave.count<=6 && wave.scramble!==true,"Invalid route wave"); for(const p of wave.route.waypoints) point(p); assert(wave.route.speed<= (wave.aircraft==="helicopter" ? 80 : 200),"Route aircraft too fast"); BomberRules.Create(wave.route.waypoints,wave.route.speed); }
			claim(wave.id); trigger(wave.trigger,owner); role(wave.scoreRole);
			assert(finite(wave.count) && wave.count%1===0 && wave.count>=1 && wave.count<=32 && (wave.role==="raider" || wave.role==="escort"),"Invalid fighter wave");
			if (wave.spawn) point(wave.spawn);
			if (wave.headingDegrees !== undefined) assert(finite(wave.headingDegrees),"Invalid heading");
			if (wave.call !== undefined) assert(wave.call.size()>0 && wave.call.size()<=72,"Invalid fighter wave call");
			assert(!wave.scramble || (wave.spawn !== undefined && wave.headingDegrees !== undefined),"Scramble needs runway spawn and heading");
		}
		const ace=phase.standaloneAce;
		if (ace) {
			claim(ace.id); trigger(ace.trigger,owner);
			for (const line of ace.stageLines ?? []) assert(line.size()>0 && line.size()<=72,"Invalid standalone ace stage line"); role(ace.scoreRole);
			assert(ace.name.size()>0 && ace.name.size()<=32 && (ace.livery==="Vulture" || ace.livery==="Rusk") && finite(ace.health) && ace.health>0 && ace.scoreRole==="ace" && (ace.behaviour==="dogfight" || ace.behaviour==="ground_attack"),"Invalid standalone ace");
			if (ace.spawn) point(ace.spawn);
			if (ace.headingDegrees !== undefined) assert(finite(ace.headingDegrees),"Invalid ace heading");
			if (ace.call !== undefined) assert(ace.call.size()>0 && ace.call.size()<=72,"Invalid standalone ace call");
		}
	}
}
