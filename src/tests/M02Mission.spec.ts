import { describe, expect, it } from "@rbxts/jest-globals";
import { arrivalDue, takeArrival, scramblePose, TriggerContext, TypedGroundTarget } from "../shared/CampaignEncounters";
import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordAlliedKill, recordScoredKill } from "../server/SortieScore";
import { MissionScore } from "../shared/MissionScore";
import { AlliedRules } from "../shared/AlliedRules";
import { buildM02Plan, M02, M02_RUNWAY, M02_WORLD_KEY, m02TargetLayout } from "../shared/M02WorldPlan";
import { M02_AIRSPACE, M02_START } from "../shared/M02Limits";
import { M02_TARGET_TYPES } from "../shared/missions/m02";

const bp = MissionCatalog.Get(2);
const phase = bp.phases[0];
const targets = phase.groundTargets!;
const waves = phase.fighterWaves!;
const ace = phase.standaloneAce!;
const scoring = bp.scoring!;
const points = (t: TypedGroundTarget) => scoring.points[t.scoreRole];
function context(elapsed: number, requiredKills: number, x = M02_START.x, z = M02_START.z, destroyed = new Set<string>()): TriggerContext {
	return { elapsed, phase: 0, requiredKills, destroyed, targets, player: { x, z } };
}

describe("Mission 2 data: the farm airfield strike", () => {
	it("is released on its own world with the reference countdown, airborne start and points scoring", () => {
		expect(MissionCatalog.Available(2)).toBe(true);
		expect(MissionCatalog.WorldKey(2)).toBe(M02_WORLD_KEY);
		expect(MissionCatalog.CountdownSeconds(2)).toBe(900);
		expect(MissionCatalog.Start(2)).toEqual(M02_START);
		expect(M02_START.kind).toBe("airborne");
		expect(MissionCatalog.Airspace(2)).toEqual(M02_AIRSPACE);
		expect(bp.phases.size()).toBe(1);
		expect(phase.kind).toBe("required_ground");
		expect(bp.ground.size()).toBe(0);
		expect(MissionCatalog.RequiredGroundKills(bp)).toBe(11);
		expect(MissionCatalog.RequiredAirKills(bp)).toBe(0);
		expect(scoring.basis).toBe("points");
		expect(bp.allies?.count).toBe(3);
		expect(AlliedRules.Credit(bp.allies!)).toBe(false);
	});
	it("authors every typed target from the world layout: ids, poses, groups and yaw", () => {
		const layout = m02TargetLayout();
		expect(targets.size()).toBe(layout.size());
		expect(targets.size()).toBe(24);
		layout.forEach((t, i) => {
			const spec = targets[i];
			expect(spec.id).toBe(t.id);
			expect(spec.type).toBe(M02_TARGET_TYPES[t.type]);
			expect(spec.position).toEqual({ x: t.x, y: t.y, z: t.z });
			expect(spec.group).toBe(t.group);
			expect(math.abs(math.rad(spec.yaw) - t.yaw)).toBeLessThan(1e-9);
		});
	});
	it("draws every non-bomber target exactly once in the world plan, tagged with its id, and no untagged copy", () => {
		const plan = buildM02Plan();
		for (const t of targets) {
			const props = plan.props.filter((p) => p.tag === t.id), parts = plan.parts.filter((p) => p.target === t.id);
			if (t.type === "hangar" || t.type === "control_tower") {
				expect(props.size()).toBe(1); expect(parts.size()).toBe(0);
				expect(props[0].asset).toBe(t.type === "hangar" ? "Hangar" : "ControlTower");
				expect([props[0].x, props[0].z]).toEqual([t.position.x, t.position.z]);
			} else if (t.type === "aa_gun") { expect(props.size()).toBe(0); expect(parts.map((p) => p.name)).toEqual(["AA emplacement", "AA turret", "AA barrel"]); }
			else if (t.type === "substation") { expect(props.size()).toBe(0); expect(parts.map((p) => p.name)).toEqual(["Transformer", "Transformer", "Transformer"]); }
			// Parked bombers are placed by the world as models (only their pavement is in the plan).
			else { expect(props.size()).toBe(0); expect(parts.size()).toBe(0); }
		}
		for (const p of plan.props) if (p.asset === "Hangar" || p.asset === "ControlTower") expect(p.tag !== undefined).toBe(true);
		for (const p of plan.parts) if (p.name.sub(1, 3) === "AA " || p.name === "Transformer") expect(p.target !== undefined).toBe(true);
		const ids = new Set(targets.map((t) => t.id));
		for (const p of plan.props) if (p.tag !== undefined) expect(ids.has(p.tag)).toBe(true);
		for (const p of plan.parts) if (p.target !== undefined) expect(ids.has(p.target)).toBe(true);
	});
	it("requires only the eleven parked bombers and scores 120/50/20/100/100", () => {
		const expected: [string, number, boolean, number][] = [["parked_bomber", 11, true, 120], ["hangar", 7, false, 50], ["aa_gun", 4, false, 20], ["control_tower", 1, false, 100], ["substation", 1, false, 100]];
		for (const [targetType, count, required, value] of expected) {
			const group = targets.filter((t) => t.type === targetType);
			expect(group.size()).toBe(count);
			for (const t of group) { expect(t.required).toBe(required); expect(t.scoreRole).toBe(targetType); expect(points(t)).toBe(value); }
		}
		expect(targets.filter((t) => t.required).size()).toBe(phase.count);
	});
	it("fields the reference's eight aircraft and makes 2,610 the maximum score", () => {
		expect(waves.reduce((n, w) => n + w.count, 0)).toBe(7);
		for (const w of waves) { expect(w.role).toBe("raider"); expect(scoring.points[w.scoreRole]).toBe(60); }
		expect(ace.name).toBe("HARROW SIX");
		expect(scoring.points[ace.scoreRole]).toBe(240);
		expect(bp.optionalRaiderMax).toBe(8);
		expect(MissionCatalog.RaiderCap(phase, 0)).toBe(8);
		let ground = 0, required = 0;
		for (const t of targets) { ground += points(t); if (t.required) required += points(t); }
		expect(required).toBe(1320);
		expect(ground).toBe(1950);
		expect(ground + 7 * 60 + 240).toBe(2610);
	});
	it("ranks S 2,200, A 1,750, B 1,500, C 1,320 (all bombers), inside the footage bounds", () => {
		expect(scoring.rank).toEqual({ S: 2200, A: 1750, B: 1500, C: 1320 });
		// Footage: 1,700 read B; 1,750 read A; 2,370 read S.
		for (const [total, rank] of [[1320, "C"], [1499, "C"], [1500, "B"], [1700, "B"], [1750, "A"], [1950, "A"], [2199, "A"], [2200, "S"], [2370, "S"], [2610, "S"]] as [number, string][]) {
			expect(MissionScore.RankPoints(total, true, scoring)).toBe(rank);
		}
		expect(MissionScore.RankPoints(2610, false, scoring)).toBe("D");
		// S is reachable without the ace (2,370) but not on ground targets alone (1,950).
		expect(2610 - 240 >= scoring.rank.S).toBe(true);
		expect(1950 < scoring.rank.S).toBe(true);
	});
	it("schedules the waves: head-on at T+35, base defence and runway scramble on approach, late pair and ace on bomber kills", () => {
		const ids = waves.map((w) => w.id);
		expect(ids).toEqual(["m02_intercept", "m02_defenders", "m02_scramble", "m02_late_pair"]);
		const [intercept, defenders, scramble, late] = waves;
		expect(intercept.trigger).toEqual({ kind: "time", seconds: 35 });
		expect(arrivalDue(intercept.trigger, context(34.9, 0))).toBe(false);
		expect(arrivalDue(intercept.trigger, context(35, 0))).toBe(true);
		// Flying the power line north: nothing triggers at the start or over the substation; the defenders
		// come up first, the scramble rolls once the base is close, and both fire before the base centre.
		let defendersAt: number | undefined, scrambleAt: number | undefined;
		for (let z = M02_START.z; z >= M02.base.z; z -= 50) {
			const c = context(0, 0, M02.base.x * (M02_START.z - z) / (M02_START.z - M02.base.z), z);
			if (defendersAt === undefined && arrivalDue(defenders.trigger, c)) defendersAt = z;
			if (scrambleAt === undefined && arrivalDue(scramble.trigger, c)) scrambleAt = z;
		}
		expect(defendersAt).toBeDefined(); expect(scrambleAt).toBeDefined();
		expect(defendersAt! < M02.substation.z).toBe(true);
		expect(defendersAt! > scrambleAt!).toBe(true);
		expect(scrambleAt! > M02.base.z + M02.base.hz).toBe(true);
		expect(arrivalDue(defenders.trigger, { ...context(600, 11), player: undefined })).toBe(false);
		expect(late.trigger).toEqual({ kind: "required_count", count: 6 });
		expect(ace.trigger).toEqual({ kind: "required_count", count: 4 });
		expect(arrivalDue(ace.trigger, context(0, 3))).toBe(false);
		expect(arrivalDue(ace.trigger, context(0, 4))).toBe(true);
		for (const w of waves) expect(w.call !== undefined && w.call.size() <= 72).toBe(true);
		expect(ace.behaviour).toBe("ground_attack");
	});
	it("scrambles one fighter northbound from the south runway threshold, staying on the runway until airborne", () => {
		const scramble = waves[2];
		expect(scramble.scramble).toBe(true);
		expect(scramble.count).toBe(1);
		expect(scramble.spawn).toEqual({ x: M02_RUNWAY.threshold.x, y: M02_RUNWAY.threshold.y, z: M02_RUNWAY.threshold.z });
		expect(scramble.headingDegrees).toBe(M02_RUNWAY.threshold.yaw);
		const half = M02_RUNWAY.centreline.length / 2;
		for (let t = 0; t <= 8; t += 0.5) {
			const p = scramblePose(scramble.spawn!, 0, t);
			expect(math.abs(p.x - M02_RUNWAY.centreline.x)).toBeLessThan(1e-6);
			expect(p.z <= M02_RUNWAY.threshold.z && p.z >= M02_RUNWAY.centreline.z - half).toBe(true);
			if (t <= 3) expect(p.y).toBe(M02_RUNWAY.threshold.y);
		}
		expect(scramblePose(scramble.spawn!, 0, 8).y).toBeGreaterThan(M02_RUNWAY.threshold.y + 200);
	});
	it("plays the footage kill order to a win on the eleventh bomber at 2,610 points, rank S", () => {
		const state = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring), fired = new Set<string>();
		const byType = (targetType: string) => targets.filter((t) => t.type === targetType);
		const bombers = byType("parked_bomber"), hangars = byType("hangar"), guns = byType("aa_gun");
		let now = 0, fighters = 0;
		const ground = (t: TypedGroundTarget) => expect(recordScoredKill(state, ledger, t.id, "ground", t.required, now += 5, t.scoreRole, t.type)).toBe(true);
		const fighter = () => expect(recordScoredKill(state, ledger, `fighter${++fighters}`, "air", false, now += 5, "fighter")).toBe(true);
		const due = () => {
			const c = context(now, state.requiredGroundKills, M02.base.x, M02.base.z, state.killedIds);
			const out: string[] = [];
			for (const a of [...waves, ace]) if (takeArrival(a.id, a.trigger, c, fired)) out.push(a.id);
			return out;
		};
		ground(byType("substation")[0]); fighter(); fighter();
		guns.forEach(ground); fighter(); fighter();
		ground(bombers[0]);
		for (let i = 0; i < 2; i++) ground(hangars[i]);
		for (let i = 1; i < 4; i++) ground(bombers[i]);
		expect(due()).toEqual(["m02_intercept", "m02_defenders", "m02_scramble", "m02_ace"]);
		expect(recordScoredKill(state, ledger, "ace", "ace", false, now += 5, "ace")).toBe(true);
		for (let i = 4; i < 7; i++) ground(bombers[i]);
		ground(byType("control_tower")[0]);
		expect(due()).toEqual(["m02_late_pair"]);
		for (let i = 2; i < 7; i++) ground(hangars[i]);
		fighter(); fighter(); fighter();
		for (let i = 7; i < 10; i++) { ground(bombers[i]); expect(state.outcome).toBeUndefined(); }
		// An ally may not take the last bomber, and a duplicate kill never counts.
		expect(recordAlliedKill(state, ledger, [], bp.allies!, bombers[10].id, "ground", true, now, "parked_bomber")).toBe(false);
		expect(recordScoredKill(state, ledger, bombers[0].id, "ground", true, now, "parked_bomber")).toBe(false);
		ground(bombers[10]);
		expect(state.outcome).toBe("won");
		expect(state.requiredGroundKills).toBe(11);
		expect(ledger.Total()).toBe(2610);
		expect(MissionScore.RankPoints(ledger.Total(), true, scoring)).toBe("S");
		expect(now).toBeLessThan(MissionCatalog.CountdownSeconds(bp));
	});
	it("wins on the eleven bombers alone (C) and leaves optional targets optional", () => {
		const state = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring);
		const bombers = targets.filter((t) => t.required);
		bombers.forEach((t, i) => expect(recordScoredKill(state, ledger, t.id, "ground", true, 10 + i, t.scoreRole, t.type)).toBe(true));
		expect(state.outcome).toBe("won");
		expect(ledger.Total()).toBe(1320);
		expect(MissionScore.RankPoints(ledger.Total(), true, scoring)).toBe("C");
	});
	it("fails when the player is shot down or the 15:00 countdown runs out; bombers never escape", () => {
		for (const cause of ["timeout", "destroyed"]) {
			const s = BlueprintRunner.NewState(bp, 0);
			BlueprintRunner.Tick(s, cause === "timeout" ? 900 : 20, cause === "destroyed" ? 0 : 100);
			expect(s.outcome).toBe("failed");
			expect(s.reason).toBe(cause);
		}
		const s = BlueprintRunner.NewState(bp, 0);
		BlueprintRunner.Tick(s, 899, 100);
		expect(s.outcome).toBeUndefined();
		expect(phase.bombers).toBeUndefined();
	});
	it("keeps all radio and story text short and its own (Broken Relay voice)", () => {
		const lines = [phase.beat!, ...phase.chatter!.map((c) => c.text), ...waves.map((w) => w.call!), ace.call!, ...ace.stageLines!];
		for (const line of lines) expect(line.size() > 0 && line.size() <= 72).toBe(true);
		expect(phase.label.size() <= 40).toBe(true);
		expect(bp.failure.size() <= 120).toBe(true);
		expect(bp.title).toBe("NO ANIMALS");
	});
});
