import { BomberPoint, BomberRoute, BomberRules } from "./BomberRules";
import type { MissionPhaseBlueprint } from "./MissionCatalog";
import type { MissionAirspacePolicy, MissionScoringPolicy } from "./MissionPolicy";

/** Opt-in required_air encounter. count is the bomber count, never the escorts. */
export interface BomberEncounter {
	count: number;
	waypoints: BomberPoint[];
	speed: number;
	/** Final route endpoint: author at/past the island's north end. */
	escape: BomberPoint;
	escorts: { count: number; initial: number; role: "escort"; aceName: string; aceAt: number };
}
export interface BomberEncounterState { route: BomberRoute; startedAt: number; laterSpawned: boolean }
const finite = (n: number) => n === n && math.abs(n) < math.huge;
export function validateBomberEncounter(phase: MissionPhaseBlueprint, bounds: MissionAirspacePolicy, scoring: MissionScoringPolicy): void {
	const b = phase.bombers;
	if (!b) return;
	assert(scoring.basis === "points", "Bomber encounters require points-basis scoring");
	for (const role of ["bomber", "escort", "ace"]) { const n = scoring.points[role]; assert(n !== undefined && finite(n) && n > 0, "Bomber encounter needs bomber/escort/ace point values"); }
	assert(phase.kind === "required_air" && phase.count === b.count, "Bombers require matching required_air count");
	assert(b.count % 1 === 0 && b.count >= 1 && b.count <= 6, "Bomber route budget is six");
	assert(finite(b.speed) && b.speed > 0, "Invalid bomber speed");
	const e = b.escorts;
	assert(e.count % 1 === 0 && e.count >= 1 && e.count <= 7 && e.initial % 1 === 0 && e.initial >= 0 && e.initial < e.count, "Invalid escort budget");
	assert(e.role === "escort" && e.aceName.size() > 0 && e.aceName.size() <= 40 && finite(e.aceAt) && e.aceAt >= 0, "Invalid escort ace");
	for (const p of [...b.waypoints, b.escape]) assert(finite(p.x) && finite(p.y) && finite(p.z) && math.abs(p.x) <= bounds.spawnLimit && math.abs(p.z) <= bounds.spawnLimit && p.y >= 40 && p.y <= 900, "Bomber route outside mission airspace");
	assert(phase.groups === undefined && phase.stagger === undefined && phase.execution === undefined && phase.optionalRaiders === undefined && phase.reinforce === undefined && phase.twist === undefined && phase.hazard === undefined, "Bomber encounter owns its wave schedule");
	compileBomberEncounter(b);
}
export function compileBomberEncounter(b: BomberEncounter): BomberRoute {
	return BomberRules.Create([...b.waypoints, b.escape], b.speed, BomberRules.DefaultSlots.filter((_, i) => i < b.count));
}
/** Pure once-only elapsed trigger, independent of kills or queued admissions. Ace is part of count. */
export function laterEscortsDue(b: BomberEncounter, state: BomberEncounterState, elapsed: number): boolean {
	if (state.laterSpawned || elapsed - state.startedAt < b.escorts.aceAt) return false;
	state.laterSpawned = true;
	return true;
}
