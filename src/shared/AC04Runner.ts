import { AC04Mission, AC04MissionData, AC04Phase, AC04UnitGroup } from "./AC04MissionData";
import { ac04Finite } from "./AC04Progress";

/** Pure server-owned campaign execution. No client supplies progress, score or outcome. */
export interface AC04Run {
	mission: AC04Mission; startedAt: number; elapsed: number; phaseIndex: number; phaseAt: number;
	dead: Set<string>; spawned: Set<string>; groupKills: Map<string, number>; groupClearedAt: Map<string, number>;
	score: number; groundKills: number; requiredKills: number; optionalKills: number;
	outcome?: "won" | "failed"; reason?: string;
}
function finishRun(s: AC04Run, won: boolean, reason: string): void {
	if (s.outcome !== undefined) return;
	s.outcome = won ? "won" : "failed"; s.reason = reason;
}
function advancePhase(s: AC04Run, phaseAt = s.elapsed): void {
	s.phaseIndex++; s.phaseAt = phaseAt;
	if (s.phaseIndex >= s.mission.phases.size()) finishRun(s, true, "complete");
}
function targetCount(s: AC04Run, phase: AC04Phase): number {
	if (phase.requiredKills !== undefined) return phase.requiredKills;
	let count = 0;
	for (const group of s.mission.roster) if (phase.requiredGroupIds.includes(group.id)) count += group.count;
	return count;
}
function down(s: AC04Run, phase: AC04Phase): number {
	let count = 0; for (const id of phase.requiredGroupIds) count += s.groupKills.get(id) ?? 0; return count;
}
function targetsDone(s: AC04Run, phase: AC04Phase): boolean { return down(s, phase) >= targetCount(s, phase); }
export const AC04Runner = {
	New(missionId: number, now: number): AC04Run {
		return { mission: AC04MissionData.Get(missionId), startedAt: now, elapsed: 0, phaseIndex: 0, phaseAt: 0,
			dead: new Set(), spawned: new Set(), groupKills: new Map(), groupClearedAt: new Map(), score: 0, groundKills: 0, requiredKills: 0, optionalKills: 0 };
	},
	Phase(s: AC04Run): AC04Phase { return s.mission.phases[math.min(s.phaseIndex, s.mission.phases.size() - 1)]; },
	/** The return objective is an infinite east/west line, with no radius or ceiling. */
	ReturnNavigation(s: AC04Run, returnZ: number): {x:number;y:number;z:number} | undefined {
		return s.outcome === undefined && AC04Runner.Phase(s).kind === "return" ? {x:0,y:0,z:returnZ} : undefined;
	},
	Remaining(s: AC04Run): number { return math.max(0, AC04Runner.Phase(s).seconds - (s.elapsed - s.phaseAt)); },
	/** Source updates retire these groups even if a previously launched weapon arrives later. */
	Retired(s: AC04Run, group: AC04UnitGroup): boolean {
		if (s.phaseIndex === 0 || group.phase > 0) return false;
		return s.mission.id === 5 || (s.mission.id === 9 && group.domain === "ground") || (s.mission.id === 13 && group.id === "balloons");
	},
	Tick(s: AC04Run, now: number, health = 100): void {
		if (s.outcome !== undefined || !ac04Finite(now)) return;
		s.elapsed = math.max(s.elapsed, now - s.startedAt);
		if (health <= 0) { finishRun(s, false, "destroyed"); return; }
		const p = AC04Runner.Phase(s);
		const expired = s.elapsed - s.phaseAt >= p.seconds;
		if (p.kind === "escort") {
			// AC04 Escort succeeds on safe arrival OR destruction of all ten attackers.
			// finishAtTimer is the bomber-defense hold rule, not this arrival contract.
			if (expired || targetsDone(s, p)) advancePhase(s, expired ? s.phaseAt + p.seconds : s.elapsed);
		} else if (p.kind === "score") {
			if (expired) { if (s.score >= (p.threshold ?? 0)) advancePhase(s, s.phaseAt + p.seconds); else finishRun(s, false, "score_requirement"); }
		} else if (p.kind === "targets" || p.kind === "missiles") {
			if (targetsDone(s, p) && (!p.finishAtTimer || expired)) advancePhase(s, p.finishAtTimer ? s.phaseAt + p.seconds : s.elapsed);
			else if (expired) finishRun(s, false, "timeout");
		} else if (expired) finishRun(s, false, "timeout");
	},
	GroupDue(s: AC04Run, group: AC04UnitGroup): boolean {
		if (s.outcome !== undefined || s.spawned.has(group.id) || group.phase > s.phaseIndex || AC04Runner.Retired(s, group)) return false;
		if (group.afterKills !== undefined) {
			let kills = 0;
			for (const id of group.afterKills.groups) kills += s.groupKills.get(id) ?? 0;
			if (kills < group.afterKills.count) return false;
		}
		const prior = group.afterGroup;
		const cleared = prior !== undefined && s.groupClearedAt.has(prior);
		const phaseElapsed = s.elapsed - s.phaseAt;
		// Both: delay from predecessor's clearance; either: fixed mission/phase clock OR clearance.
		if (group.triggerMode === "both" && prior !== undefined) return cleared && s.elapsed - s.groupClearedAt.get(prior)! >= (group.triggerAt ?? 0);
		const timed = group.triggerAt !== undefined && phaseElapsed >= group.triggerAt;
		if (group.triggerMode === "either") return timed || cleared;
		if (prior !== undefined && !cleared) return false;
		return group.triggerAt === undefined || timed;
	},
	RecordKill(s: AC04Run, group: AC04UnitGroup, id: string, now: number): boolean {
		AC04Runner.Tick(s, now);
		if (s.outcome !== undefined || group.protected || group.invulnerable || AC04Runner.Retired(s, group) || !s.spawned.has(group.id) || s.dead.has(id)) return false;
		let validId = false;
		for (let index = 0; index < group.count; index++) if (id === AC04MissionData.InstanceId(group, index)) { validId = true; break; }
		if (!validId) return false;
		s.dead.add(id);
		const count = (s.groupKills.get(group.id) ?? 0) + 1;
		if (count > group.count) { s.dead.delete(id); return false; }
		s.groupKills.set(group.id, count);
		if (count === group.count) s.groupClearedAt.set(group.id, s.elapsed);
		s.score += group.points;
		if (group.required) s.requiredKills++; else s.optionalKills++;
		if (group.domain === "ground" || group.domain === "naval") s.groundKills++;
		AC04Runner.Tick(s, now);
		return true;
	},
	CrossReturn(s: AC04Run, now?: number): void { if (now !== undefined) AC04Runner.Tick(s, now); if (s.outcome === undefined && AC04Runner.Phase(s).kind === "return") advancePhase(s); },
	Escape(s: AC04Run, now?: number): void {
		if (now !== undefined) AC04Runner.Tick(s, now);
		if (s.outcome !== undefined || AC04Runner.Phase(s).kind !== "escape") return;
		if (targetsDone(s, AC04Runner.Phase(s))) advancePhase(s); else finishRun(s, false, "core_not_destroyed");
	},
	Fail(s: AC04Run, reason: string): void { finishRun(s, false, reason); },
	Objective(s: AC04Run): { phase: string; objective: string; objectiveProgress: number; objectiveTotal: number; tutorialStep: string } {
		const p = AC04Runner.Phase(s);
		const score = p.kind === "score", travel = p.kind === "return" || p.kind === "escort" || p.kind === "escape";
		return { phase: `ac04_${p.id}`, objective: p.label,
			objectiveProgress: score ? s.score : travel ? math.floor(s.elapsed - s.phaseAt) : down(s, p),
			objectiveTotal: score ? p.threshold ?? 0 : travel ? p.seconds : targetCount(s, p), tutorialStep: "" };
	},
};
