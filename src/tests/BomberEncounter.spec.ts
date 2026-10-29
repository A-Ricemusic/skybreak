import { describe, expect, it } from "@rbxts/jest-globals";
import { BomberEncounter, compileBomberEncounter, laterEscortsDue } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { M01_AIRSPACE } from "../shared/M01Limits";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { AirRequest, WavePlan } from "../shared/WavePlan";

const bombers: BomberEncounter = { count: 6, waypoints: [{ x: 0, y: 700, z: 10000 }], speed: 200,
	escape: { x: 0, y: 700, z: -8000 }, escorts: { count: 4, initial: 2, role: "escort", aceName: "GREY KITE", aceAt: 150 } };
function blueprint() {
	return { ...MissionCatalog.Get(1), airspace: M01_AIRSPACE,
		phases: [{ kind: "required_air" as const, label: "Intercept bombers", count: 6, bombers }],
		scoring: { basis: "points" as const, points: { bomber: 100, escort: 60, ace: 240 }, rank: { S: 800, A: 700, B: 600, C: 0 } } };
}
describe("Dormant bomber encounters", () => {
	it("validates opt-in data and rejects mismatched counts, budgets and invalid route points", () => {
		MissionCatalog.ValidatePolicy(blueprint());
		for (const b of [{ ...bombers, count: 7 }, { ...bombers, speed: 0 }, { ...bombers, escape: { x: math.huge, y: 700, z: 0 } }, { ...bombers, escorts: { ...bombers.escorts, initial: 4 } }]) {
			const bp = blueprint(); bp.phases[0].bombers = b;
			const [ok] = pcall(() => MissionCatalog.ValidatePolicy(bp)); expect(ok).toBe(false);
		}
	});
	it("requires all bombers, accepts optional escorts and ace once, and wins on the last bomber with a surviving escort", () => {
		const bp = blueprint(), s = BlueprintRunner.NewState(bp, 0), score = new TargetScore(bp.scoring);
		expect(BlueprintRunner.CanDamage(s, "air", true)).toBe(true);
		for (const id of ["escort1", "escort2"]) expect(recordScoredKill(s, score, id, "air", false, 1, "escort")).toBe(true);
		expect(recordScoredKill(s, score, "ace", "ace", false, 151, "ace")).toBe(true);
		expect(recordScoredKill(s, score, "ace", "ace", false, 151, "ace")).toBe(false);
		expect(s.phaseProgress).toBe(0); expect(s.requiredAirKills).toBe(0);
		for (let i = 0; i < 6; i++) {
			expect(recordScoredKill(s, score, `b${i}`, "air", true, 160 + i, "bomber")).toBe(true);
			expect(recordScoredKill(s, score, `b${i}`, "air", true, 160 + i, "bomber")).toBe(false);
			if (i < 5) expect(s.outcome).toBeUndefined();
		}
		expect(s.outcome).toBe("won"); expect(s.reason).toBe("complete"); expect(score.Total()).toBe(960);
		expect(score.RoleKills("bomber")).toBe(6); expect(score.RoleKills("escort")).toBe(2); expect(score.RoleKills("ace")).toBe(1);
		expect(recordScoredKill(s, score, "survivor", "air", false, 166, "escort")).toBe(false);
	});
	it("fails on formation escape and preserves an already won outcome", () => {
		const route = compileBomberEncounter(bombers), s = BlueprintRunner.NewState(blueprint(), 0);
		expect(BomberRules.Sample(route, route.duration - .01).escaped).toBe(false);
		if (BomberRules.Sample(route, route.duration).escaped) BlueprintRunner.EscapeBombers(s);
		expect(s.outcome).toBe("failed"); expect(s.reason).toBe("escaped");
		expect(BlueprintRunner.RecordKill(s, "late", "air", true, 100)).toBe(false);
	});
	it("admits the delayed ace exactly once at 150 seconds and retains roles while slots are full", () => {
		const state = { route: compileBomberEncounter(bombers), startedAt: 20, laterSpawned: false };
		expect(laterEscortsDue(bombers, state, 169.99)).toBe(false);
		expect(laterEscortsDue(bombers, state, 170)).toBe(true);
		expect(laterEscortsDue(bombers, state, 171)).toBe(false);
		const queue: AirRequest[] = [{ role: "escort", count: 2, behind: false }, { role: "ace", count: 1, behind: false }];
		expect(WavePlan.Admit(queue, 0).size()).toBe(0);
		expect(WavePlan.Admit(queue, 1)[0].role).toBe("ace");
		expect(WavePlan.Admit(queue, 7)[0].role).toBe("escort");
		expect(queue.size()).toBe(0); expect(WavePlan.Budget()).toBe(7);
	});
	it("leaves every current authored and inserted phase on its existing application and damage policy", () => {
		for (const bp of MissionCatalog.All()) for (const phase of MissionCatalog.ExpandedPhases(bp)) {
			expect(phase.bombers).toBeUndefined();
			const s = BlueprintRunner.NewState({ ...bp, phases: [phase] }, 0);
			const legacyOptional = phase.execution?.raiderKillCap !== undefined ? phase.execution.raiderKillCap > 0 : MissionCatalog.RaiderCap(phase) > 0;
			expect(BlueprintRunner.CanDamage(s, "air", false)).toBe(phase.kind !== "tutorial_missile" && legacyOptional);
			expect(BlueprintRunner.CanDamage(s, "ace", false)).toBe(false);
			expect(MissionCatalog.InitialRaiders(phase)).toBe(phase.kind === "ace" ? 0 : math.max(0, (phase.optionalRaiders ?? 0) - (phase.reinforce ?? []).reduce((n, w) => n + w.count, 0)));
		}
	});
});
