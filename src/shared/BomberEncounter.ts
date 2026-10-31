import { BomberPoint, BomberRoute, BomberRules, BomberSlotPose } from "./BomberRules";
import type { MissionPhaseBlueprint } from "./MissionCatalog";
import type { MissionAirspacePolicy, MissionScoringPolicy } from "./MissionPolicy";

/** Opt-in required_air encounter. count is the bomber count, never the escorts. */
export interface BomberEncounter {
	/** Seconds after phase entry for each bomber, ordered by slot. Absent: formation at entry. */
	arrivalSeconds?: number[];
	aircraft?: "transport";
	scoreRole?: string;
	targetIds?: string[];
	/** Formation offsets, local right/up/aft. */
	slots?: BomberPoint[];
	count: number;
	waypoints: BomberPoint[];
	speed: number;
	/** Final route endpoint; reaching it fails the encounter. */
	escape: BomberPoint;
	/** Optional endpoint radio; absent uses a location-neutral intercept failure call. */
	escapeCall?: string;
	escorts: { count: number; initial: number; role: "escort"; aceName: string; aceAt: number };
}
export interface BomberEncounterState { route: BomberRoute; startedAt: number; laterSpawned: boolean; escortsSpawned: number; bombersSpawned?: number }
const finite = (n: number) => n === n && math.abs(n) < math.huge;
export function validateBomberEncounter(phase: MissionPhaseBlueprint, bounds: MissionAirspacePolicy, scoring: MissionScoringPolicy): void {
	const b = phase.bombers;
	if (!b) return;
	assert(scoring.basis === "points", "Bomber encounters require points-basis scoring");
	assert(b.aircraft===undefined || b.aircraft==="transport","Invalid route aircraft");
	assert(b.scoreRole===undefined || scoring.points[b.scoreRole]!==undefined,"Invalid route score role");
	for (const role of [b.scoreRole ?? "bomber", "escort", "ace"]) { const n = scoring.points[role]; assert(n !== undefined && finite(n) && n > 0, "Bomber encounter needs bomber/escort/ace point values"); }
	assert(phase.kind === "required_air" && phase.count === b.count, "Bombers require matching required_air count");
	assert(b.count % 1 === 0 && b.count >= 1 && b.count <= 6, "Bomber route budget is six");
	assert(finite(b.speed) && b.speed > 0, "Invalid bomber speed");
	assert(b.escapeCall === undefined || b.escapeCall.size() > 0, "Bomber escape call must not be empty");
	const e = b.escorts;
	assert(e.count % 1 === 0 && e.count >= 0 && e.count <= 7 && e.initial % 1 === 0 && e.initial >= 0 && (e.count === 0 ? e.initial === 0 : e.initial < e.count), "Invalid escort budget");
	assert(e.role === "escort" && e.aceName.size() > 0 && e.aceName.size() <= 40 && finite(e.aceAt) && e.aceAt >= 0, "Invalid escort ace");
	for (const p of [...b.waypoints, b.escape]) assert(finite(p.x) && finite(p.y) && finite(p.z) && math.abs(p.x) <= bounds.spawnLimit && math.abs(p.z) <= bounds.spawnLimit && p.y >= 40 && p.y <= (b.aircraft ? 2000 : 900), "Bomber route outside mission airspace");
	assert(phase.groups === undefined && phase.stagger === undefined && phase.execution === undefined && phase.twist === undefined && phase.hazard === undefined, "Bomber encounter owns its wave schedule");
	if (b.targetIds) assert(b.targetIds.size() === b.count && new Set(b.targetIds).size() === b.count, "Unique route ids must match count");
	if (b.slots) assert(b.slots.size() === b.count, "Route slots must match count");
	compileBomberEncounter(b);
}
export function compileBomberEncounter(b: BomberEncounter): BomberRoute {
	return BomberRules.Create([...b.waypoints, b.escape], b.speed, b.slots ?? BomberRules.DefaultSlots.filter((_, i) => i < b.count));
}
/** Beside/above the leading bomber in its sampled frame. A unique ordinal alternates sides and steps outward. */
export function bomberEscortPose(leading: BomberSlotPose, slot: number): BomberSlotPose {
	const f = leading.facing, p = leading.position;
	const horizontal = math.sqrt(f.x * f.x + f.z * f.z);
	const right = { x: -f.z / horizontal, y: 0, z: f.x / horizontal };
	const up = { x: -right.z * f.y, y: right.z * f.x - right.x * f.z, z: right.x * f.y };
	const lateral = (slot % 2 === 0 ? -1 : 1) * 120 * (math.floor(slot / 2) + 1);
	return { position: { x: p.x + right.x * lateral + up.x * 90, y: p.y + up.y * 90, z: p.z + right.z * lateral + up.z * 90 }, facing: { ...f } };
}
/** Pure once-only elapsed trigger, independent of kills or queued admissions. Ace is part of count. */
export function laterEscortsDue(b: BomberEncounter, state: BomberEncounterState, elapsed: number): boolean {
	if (b.escorts.count === 0 || state.laterSpawned || elapsed - state.startedAt < b.escorts.aceAt) return false;
	state.laterSpawned = true;
	return true;
}

/** Bomber optional waves follow the route clock, never the player's required kills. */
export function reinforcementFraction(objectiveFraction: number, elapsed: number, route?: BomberRoute): number {
	return route ? math.clamp(elapsed / route.duration, 0, 1) : objectiveFraction;
}
