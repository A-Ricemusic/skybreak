import type { MissionPhaseBlueprint, FlightPoint, PhaseChatter, PhaseReinforcement, PhaseTwist, PhaseHazard } from "../MissionCatalog";

interface FlyExtra { directed?: boolean; parkedEscort?: FlightPoint; beat?: string; chatter?: PhaseChatter[]; reinforce?: PhaseReinforcement[]; twist?: PhaseTwist; hazard?: PhaseHazard }
/**
 * @param kind Server-observed volume rule.
 * @param label HUD objective label.
 * @param points World-space [x, y, z] centers in traversal order.
 * @param seconds Hold duration (per point for recon; unused for route).
 * @param optionalRaiders Total optional pursuers, including reinforcements.
 * @param ceiling Maximum observed altitude, if constrained.
 * @param extra Radio, hazard, reinforcement, twist and escort details.
 */
export function fly(kind: "route" | "recon" | "signal" | "escort" | "defend", label: string, points: number[][], seconds = 0, optionalRaiders = 0, ceiling?: number, extra: FlyExtra = {}): MissionPhaseBlueprint {
	return { kind, label, points: points.map((p) => ({ x: p[0], y: p[1], z: p[2] })),
		radius: kind === "route" ? 210 : kind === "recon" ? 420 : 1000,
		seconds, optionalRaiders, ceiling, directed: extra.directed, parkedEscort: extra.parkedEscort, beat: extra.beat, chatter: extra.chatter, reinforce: extra.reinforce, twist: extra.twist, hazard: extra.hazard };
}
interface AirExtra { groups?: number; stagger?: number; flank?: boolean; groupAt?: number[]; groupCalls?: string[]; optionalRaiders?: number; reinforce?: PhaseReinforcement[]; chatter?: PhaseChatter[]; twist?: PhaseTwist; directed?: boolean }
/** Parameters: label = HUD text; count = required bandits; beat = entry radio; extra = wave and event options.
 * A required air phase: `count` bandits, optionally in staggered groups, with raiders and reinforcements. */
export function air(label: string, count: number, beat: string, extra: AirExtra = {}): MissionPhaseBlueprint {
	return { kind: "required_air", label, count, beat, groups: extra.groups, stagger: extra.stagger, flank: extra.flank,
		groupAt: extra.groupAt, groupCalls: extra.groupCalls, optionalRaiders: extra.optionalRaiders, reinforce: extra.reinforce, chatter: extra.chatter, twist: extra.twist, directed: extra.directed };
}
interface GroundExtra { optionalRaiders?: number; reinforce?: PhaseReinforcement[]; chatter?: PhaseChatter[]; twist?: PhaseTwist; directed?: boolean; hidden?: boolean }
/** Parameters: label = HUD text; count = next targets; beat = entry radio; extra = pursuer and event options.
 * A required ground strike on the next `count` targets of the mission's ground list. */
export function ground(label: string, count: number, beat: string, extra: GroundExtra = {}): MissionPhaseBlueprint {
	return { kind: "required_ground", label, count, beat, optionalRaiders: extra.optionalRaiders, reinforce: extra.reinforce,
		chatter: extra.chatter, twist: extra.twist, directed: extra.directed, hidden: extra.hidden };
}
/** Parameters: label = HUD text; seconds = escape deadline; escape = [x,y,z] destination;
 * beat = entry radio; chatter = progress radio; optionalRaiders = total optional pursuers.
 * A courier chase: one fast non-firing target that runs for `escape` and gets away after `seconds`. */
export function chase(label: string, seconds: number, escape: number[], beat: string, chatter: PhaseChatter[], optionalRaiders = 0): MissionPhaseBlueprint {
	return { kind: "chase", label, count: 1, seconds, escape: { x: escape[0], y: escape[1], z: escape[2] }, beat, chatter, optionalRaiders };
}

