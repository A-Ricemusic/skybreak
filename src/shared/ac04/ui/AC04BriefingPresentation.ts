/**
 * Briefing map and objective text derived from the actual mission data and planned layout. Pure: the
 * unit-position function is injected (the client passes AC04WorldPlanner.UnitPosition).
 *
 * Spoiler rule: only forces present when the sortie opens are drawn and counted (phase 0, no timer,
 * group or kill trigger), and only the first objective is described. Later phases are revealed in
 * flight by the authoritative mission runner, as before.
 */
import type { AC04Mission, AC04Phase, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { FlightPoint } from "../../WorldTypes";
import { ac04Minutes, ac04Thousands } from "./AC04UIFormat";

export type AC04MarkerKind = "air" | "ground" | "naval" | "missile" | "protected";
export interface AC04MapPoint { x: number; y: number }
export interface AC04MapMarker {
	id: string;
	/** Unit type as the mission data names it (Tu-95, RADAR). */
	label: string;
	kind: AC04MarkerKind;
	required: boolean;
	count: number;
	/** Map-normalized unit positions: 0..1 west→east (x) and north→south (y). */
	points: AC04MapPoint[];
	centroid: AC04MapPoint;
}
export interface AC04MapWindow { x: number; y: number; size: number }
export interface AC04BriefingMap {
	markers: AC04MapMarker[];
	spawn: AC04MapPoint;
	/** Normalized y of the southern return line (rearm crossing), when inside the area. */
	returnY?: number;
	/** Whole operational area (strategic view). */
	area: AC04MapWindow;
	/** Square window framing the current objective, the start point and the return line (detail view). */
	detail: AC04MapWindow;
}
export interface AC04ForceCount { air: number; ground: number; naval: number; targets: number; total: number }
export type AC04UnitPositioner = (missionId: number, group: AC04UnitGroup, index: number) => FlightPoint;

/** Present when the sortie opens: first phase and not held back behind a timer, another group or kills. */
export function ac04InitialGroup(group: AC04UnitGroup): boolean {
	return group.phase === 0 && (group.triggerAt === undefined || group.triggerAt <= 0) && group.afterGroup === undefined && group.afterKills === undefined;
}

function normalize(point: FlightPoint, bounds: number): AC04MapPoint {
	return { x: math.clamp((point.x + bounds) / (2 * bounds), 0, 1), y: math.clamp((point.z + bounds) / (2 * bounds), 0, 1) };
}

export function ac04BriefingMap(mission: AC04Mission, layout: AC04Layout, position: AC04UnitPositioner): AC04BriefingMap {
	const bounds = math.max(1, layout.bounds);
	const markers: AC04MapMarker[] = [];
	const firstPhaseGroups = mission.phases[0]?.requiredGroupIds ?? [];
	for (const group of mission.roster) {
		if (!ac04InitialGroup(group)) continue;
		const points: AC04MapPoint[] = [];
		let sx = 0, sy = 0;
		for (let i = 0; i < group.count; i++) {
			const point = normalize(position(mission.id, group, i), bounds);
			points.push(point); sx += point.x; sy += point.y;
		}
		if (points.size() === 0) continue;
		markers.push({
			id: group.id, label: group.type, kind: group.protected === true ? "protected" : group.domain,
			required: group.protected !== true && (group.required || firstPhaseGroups.includes(group.id)), count: group.count, points,
			centroid: { x: sx / points.size(), y: sy / points.size() },
		});
	}
	const spawn = normalize(layout.spawn, bounds);
	const returnY = math.abs(layout.returnZ) < bounds ? (layout.returnZ + bounds) / (2 * bounds) : undefined;
	// Frame required markers (all initial markers when none are required), the start and the return line.
	let minX = spawn.x, maxX = spawn.x, minY = spawn.y, maxY = spawn.y;
	const anyRequired = markers.some((marker) => marker.required);
	for (const marker of markers) {
		if (anyRequired && !marker.required) continue;
		for (const point of marker.points) {
			minX = math.min(minX, point.x); maxX = math.max(maxX, point.x);
			minY = math.min(minY, point.y); maxY = math.max(maxY, point.y);
		}
	}
	if (returnY !== undefined) { minY = math.min(minY, returnY); maxY = math.max(maxY, returnY); }
	const size = math.clamp(math.max(maxX - minX, maxY - minY) * 1.25, 0.3, 1);
	const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
	const detail = { x: math.clamp(cx - size / 2, 0, 1 - size), y: math.clamp(cy - size / 2, 0, 1 - size), size };
	return { markers, spawn, returnY, area: { x: 0, y: 0, size: 1 }, detail };
}

/** Initial contacts by domain, as the briefing counts them. Protected friendlies are excluded. */
export function ac04ForceCount(map: AC04BriefingMap): AC04ForceCount {
	const count: AC04ForceCount = { air: 0, ground: 0, naval: 0, targets: 0, total: 0 };
	for (const marker of map.markers) {
		if (marker.kind === "protected") continue;
		if (marker.kind === "air") count.air += marker.count;
		else if (marker.kind === "naval") count.naval += marker.count;
		else count.ground += marker.count;
		if (marker.required) count.targets += marker.count;
		count.total += marker.count;
	}
	return count;
}

/** Window-relative position (0..1) of a map point, or undefined when it falls outside the window. */
export function ac04InWindow(point: AC04MapPoint, window: AC04MapWindow): AC04MapPoint | undefined {
	const x = (point.x - window.x) / window.size, y = (point.y - window.y) / window.size;
	return x < 0 || x > 1 || y < 0 || y > 1 ? undefined : { x, y };
}

function requiredTotal(mission: AC04Mission, phase: AC04Phase): number {
	if (phase.requiredKills !== undefined) return phase.requiredKills;
	let total = 0;
	for (const group of mission.roster) if (phase.requiredGroupIds.includes(group.id)) total += group.count;
	return total;
}

export interface AC04ObjectiveText {
	/** The first objective as authored (mission data label). */
	headline: string;
	/** Concise clear condition from the first phase's rule. */
	condition: string;
	/** Time limit of the first phase only. */
	timeLimit: string;
	/** Loss conditions that apply from the start. */
	failures: string[];
}

/** First-phase objective only; no later phase label, timer or condition is revealed. */
export function ac04ObjectiveText(mission: AC04Mission): AC04ObjectiveText {
	const phase = mission.phases[0];
	const time = ac04Minutes(phase.seconds);
	let condition: string;
	if (phase.kind === "score") condition = `Score at least ${ac04Thousands(phase.threshold ?? 0)} points before the ${time} time limit expires.`;
	else if (phase.kind === "targets") {
		const total = requiredTotal(mission, phase);
		condition = total > 0 ? `Destroy ${total === 1 ? "the designated target" : `all ${total} designated targets`} within ${time}.` : `Complete the objective within ${time}.`;
	} else if (phase.kind === "escort") condition = `Keep the protected aircraft flying for ${time}.`;
	else if (phase.kind === "missiles") condition = `Stop the missiles before they reach the defended area. Time limit ${time}.`;
	else condition = `${phase.label} within ${time}.`;
	const failures = ["Your aircraft is destroyed or crashes."];
	if (phase.kind === "score") failures.push("The required score is not reached when time expires.");
	else if (phase.kind !== "escort") failures.push("Time expires before the objective is complete.");
	if (mission.roster.some((group) => group.protected === true && group.phase === 0)) failures.push("The protected aircraft is lost.");
	if (phase.kind === "missiles") failures.push("A missile reaches the defended area.");
	return { headline: phase.label, condition, timeLimit: time, failures };
}
