import { describe, expect, it } from "@rbxts/jest-globals";
import { arrivalDue, TriggerContext, TypedGroundTarget } from "../shared/CampaignEncounters";
import { crossesReturnLine, landingAccomplishedAt, landingDistance, landingDuration, landingPose, landingRadioDue, returnLineDots } from "../shared/EngineBatchB";
import { FlightMath } from "../shared/FlightMath";
import { LaunchStage } from "../shared/LaunchStage";
import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionScore } from "../shared/MissionScore";
import { TargetScore } from "../shared/TargetScore";
import { returnProgressLine } from "../shared/HudInstruments";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission } from "../server/CampaignRepository";
import { buildM03Plan, M03, M03_RUNWAY_TOP, M03_WORLD_KEY, m03Ground, m03Height, m03TargetLayout } from "../shared/M03WorldPlan";
import { M03_AIRSPACE } from "../shared/M03Limits";
import { M03_GEAR_CLEARANCE, M03_LANDING, M03_RETURN_LINE, M03_START, M03_TARGET_TYPES } from "../shared/missions/m03";
import type { MissionFinished } from "../shared/Types";

const bp = MissionCatalog.Get(3);
const strike = bp.phases[0];
const targets = strike.groundTargets!;
const waves = strike.fighterWaves!;
const ace = strike.standaloneAce!;
const scoring = bp.scoring!;
const points = (t: TypedGroundTarget) => scoring.points[t.scoreRole];
const radars = (group: string) => targets.filter((t) => t.type === "radar_dome" && t.group === group);
function context(elapsed: number, destroyed: string[]): TriggerContext {
	return { elapsed, phase: 0, requiredKills: destroyed.size(), destroyed: new Set(destroyed), targets, player: { x: M03_START.x, z: M03_START.z } };
}
function coordinator() {
	const c = new CampaignCoordinator("m03-test", undefined, { now: () => 1000, defer: () => undefined });
	c.load();
	return c;
}
/** The reference player's kill order (§4c), in mission seconds; landing time is excluded from the result. */
function footageRun(lastRadarAt = 335, crossing = 71.71) {
	const s = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring);
	const fighter = (id: string, at: number) => recordScoredKill(s, ledger, id, "air", false, at, "fighter");
	const ground = (id: string, at: number) => {
		const t = targets.find((x) => x.id === id)!;
		return recordScoredKill(s, ledger, id, "ground", t.required, at, t.scoreRole);
	};
	fighter("a1", 35); fighter("b1", 63); fighter("b2", 85); fighter("a2", 108);
	ground("m03_s1_radar_1", 118); ground("m03_s1_radar_2", 140); ground("m03_s1_radar_3", 151); ground("m03_s1_radar_4", 151);
	ground("m03_s1_radar_5", 166); ground("m03_s1_aa_1", 166);
	fighter("c1", 194); fighter("c2", 210);
	recordScoredKill(s, ledger, "m03_ace", "ace", false, 247, "ace");
	fighter("b3", 270);
	ground("m03_s2_radar_1", 284); ground("m03_s2_radar_2", 284); ground("m03_s2_aa_1", 303);
	ground("m03_s2_radar_3", 309); ground("m03_s2_aa_2", 309); ground("m03_s2_helicopter", 326); ground("m03_s2_aa_3", 326);
	ground("m03_s2_radar_4", lastRadarAt);
	const update = { phase: BlueprintRunner.ActivePhase(s)?.kind, remaining: BlueprintRunner.TimeRemaining(s), serial: s.updateSerial,
		objective: BlueprintRunner.Objective(s).objective };
	BlueprintRunner.ObserveFlight(s, { x: -10080, y: 1200, z: 11000 }, { x: -10080, y: 1200, z: 11100 }, 0.1, lastRadarAt + crossing);
	return { s, ledger, update };
}

describe("Mission 3 data: the mountain radar strike and return", () => {
	it("is released on the M03 world with its airspace, airborne start, two 15:00 clocks and terrain-relative warnings", () => {
		expect(MissionCatalog.Available(3)).toBe(true);
		expect(MissionCatalog.WorldKey(3)).toBe(M03_WORLD_KEY);
		expect(MissionCatalog.Airspace(3)).toBe(M03_AIRSPACE);
		expect(MissionCatalog.Start(3)).toEqual(M03_START);
		expect(M03_START.kind).toBe("airborne");
		expect(MissionCatalog.CountdownSeconds(3)).toBe(900);
		expect(bp.phases[1].update?.countdownSeconds).toBe(900);
		expect(MissionCatalog.MaxMissionSeconds(3)).toBe(1800);
		expect(bp.terrainRelativeWarnings).toBe(true);
		for (const id of [0, 1, 2]) expect(MissionCatalog.Get(id).terrainRelativeWarnings).toBeUndefined();
		expect(bp.phases.map((p) => p.kind)).toEqual(["required_ground", "return_line", "landing"]);
		expect(MissionCatalog.TotalPhases(bp)).toBe(3);
		expect(MissionCatalog.RequiredGroundKills(bp)).toBe(9);
		expect(MissionCatalog.RequiredAirKills(bp)).toBe(0);
	});
	it("starts clear of the mountains, inside the soft airspace and pointing at site 1", () => {
		expect(math.max(math.abs(M03_START.x), math.abs(M03_START.z))).toBeLessThan(M03_AIRSPACE.softHalfWidth);
		expect(M03_START.y).toBeGreaterThan(m03Height(M03_START.x, M03_START.z) + 100);
		const [fx, , fz] = FlightMath.ForwardOf(LaunchStage.Pose(M03_START));
		const dx = M03.site1.x - M03_START.x, dz = M03.site1.z - M03_START.z, length = math.sqrt(dx * dx + dz * dz);
		expect((fx * dx + fz * dz) / length).toBeGreaterThan(0.99);
		// Hands-off, the opening 50 s at 160 studs/s clear a 400-stud-wide corridor by 100 studs.
		for (let d = 0; d <= 8000; d += 100) for (let o = -200; o <= 200; o += 50) {
			const x = M03_START.x + (dx * d - dz * o) / length, z = M03_START.z + (dz * d + dx * o) / length;
			expect(m03Height(x, z)).toBeLessThan(M03_START.y - 100);
		}
	});
	it("authors every target once from the world layout: nine required radars, four AA guns and a helicopter", () => {
		const layout = m03TargetLayout();
		expect(targets.size()).toBe(layout.size());
		const ids = new Set<string>();
		for (let i = 0; i < layout.size(); i++) {
			const t = targets[i], l = layout[i];
			expect(ids.has(t.id)).toBe(false); ids.add(t.id);
			expect(t.id).toBe(l.id);
			expect(t.type).toBe(M03_TARGET_TYPES[l.type]);
			expect(t.position).toEqual({ x: l.x, y: l.y, z: l.z });
			expect(t.yaw).toBeCloseTo(math.deg(l.yaw));
			expect(t.group).toBe(l.type === "radar" ? l.group : `${l.group}_defence`);
		}
		// Each world-drawn model is keyed by exactly these ids (M03World adopts them; no factory copies).
		expect(buildM03Plan().targets.map((t) => t.id)).toEqual(targets.map((t) => t.id));
		expect(radars("site1").size()).toBe(5);
		expect(radars("site2").size()).toBe(4);
		for (const t of targets) {
			expect(t.required).toBe(t.type === "radar_dome");
			expect(points(t)).toBe(t.type === "radar_dome" ? 100 : t.type === "aa_gun" ? 20 : 40);
		}
		expect(targets.filter((t) => t.type === "aa_gun").size()).toBe(4);
		expect(targets.filter((t) => t.type === "parked_helicopter").size()).toBe(1);
		expect(strike.count).toBe(9);
	});
	it("scores 1,680 for everything, as the reference S run, with ranks inside the footage bounds", () => {
		let ground = 0;
		for (const t of targets) ground += points(t);
		let fighters = 0;
		for (const wave of waves) fighters += wave.count;
		expect(ground).toBe(1020);
		expect(fighters).toBe(7);
		const max = ground + fighters * scoring.points.fighter + scoring.points.ace;
		expect(max).toBe(1680);
		const rank = scoring.rank;
		// C is all nine radars; HUD bounds: B at 1,120, A at 1,180, S at 1,380.
		expect(rank.C).toBe(900);
		expect(rank.B).toBeLessThanOrEqual(1120);
		expect(rank.A).toBeGreaterThan(1120); expect(rank.A).toBeLessThanOrEqual(1180);
		expect(rank.S).toBeGreaterThan(1180); expect(rank.S).toBeLessThanOrEqual(1380);
		expect(max - scoring.points.ace).toBeGreaterThanOrEqual(rank.S);
		expect(ground).toBeLessThan(rank.S);
		expect(MissionScore.RankPoints(900, true, scoring)).toBe("C");
		expect(MissionScore.RankPoints(1680, true, scoring)).toBe("S");
		expect(MissionScore.RankPoints(1680, false, scoring)).toBe("D");
	});
	it("brings the second wave and the ace when site 1's five domes fall, not its AA gun or site 2", () => {
		const site1 = radars("site1").map((t) => t.id), site2 = radars("site2").map((t) => t.id);
		const second = waves.find((w) => w.id === "m03_second_wave")!;
		for (const trigger of [second.trigger, ace.trigger]) {
			expect(trigger).toEqual({ kind: "ground_group", group: "site1" });
			expect(arrivalDue(trigger, context(200, site1))).toBe(true);
			expect(arrivalDue(trigger, context(200, [...site1.filter((_, i) => i < 4), "m03_s1_aa_1"]))).toBe(false);
			expect(arrivalDue(trigger, context(200, [...site2, "m03_s2_helicopter"]))).toBe(false);
		}
		expect(second.count + 1).toBe(3);
		const timed = waves.filter((w) => w.trigger.kind === "time").map((w) => [w.count, (w.trigger as { seconds: number }).seconds]);
		expect(timed).toEqual([[2, 10], [3, 39]]);
		expect(ace.name).toBe("CAIRN LEAD");
		for (const line of [ace.call!, ...ace.stageLines!, ...waves.map((w) => w.call!)]) expect(line.size()).toBeLessThanOrEqual(72);
	});
	it("spawns the second wave and ace between the sites, above the peaks and inside the spawn limit", () => {
		for (const spawn of [waves[2].spawn!, ace.spawn!]) {
			expect(math.max(math.abs(spawn.x), math.abs(spawn.z))).toBeLessThan(M03_AIRSPACE.spawnLimit);
			expect(spawn.y).toBeGreaterThan(M03.summit + 120);
			expect(spawn.x).toBeLessThan(M03.site1.x); expect(spawn.x).toBeGreaterThan(M03.site2.x);
		}
	});
	it("crosses PR #139's return line southbound only, with a dotted marker spanning it", () => {
		expect(M03_RETURN_LINE.a).toEqual({ x: -13500, z: 11040 });
		expect(M03_RETURN_LINE.b).toEqual({ x: 13500, z: 11040 });
		expect(crossesReturnLine(M03_RETURN_LINE, { x: -10080, z: 11000 }, { x: -10080, z: 11080 })).toBe(true);
		expect(crossesReturnLine(M03_RETURN_LINE, { x: -10080, z: 11080 }, { x: -10080, z: 11000 })).toBe(false);
		const dots = returnLineDots(M03_RETURN_LINE, 400);
		expect(dots.size()).toBe(67);
		expect(dots[0].x).toBeGreaterThan(-13500); expect(dots[dots.size() - 1].x).toBeLessThan(13500);
		for (const d of dots) expect(d.z).toBe(11040);
		expect(M03_RETURN_LINE.markerY).toBeGreaterThan(M03.summit);
		expect(returnProgressLine("return_line")).toBe("RTB");
		expect(returnProgressLine("landing", 2099.6)).toBe("DIST 2100");
		expect(returnProgressLine("required_ground")).toBeUndefined();
	});
	it("lands northbound on the raised M03 runway, clear of terrain and structures and inside the soft airspace", () => {
		const r = M03.landing, plan = M03_LANDING, threshold = r.z + r.length / 2, far = r.z - r.length / 2;
		expect(plan.touchdown.y).toBe(M03_RUNWAY_TOP + M03_GEAR_CLEARANCE);
		expect(plan.touchdown.x).toBe(r.x);
		expect(plan.headingDegrees).toBe(0);
		expect(plan.touchdown.z).toBeLessThan(threshold);
		expect(plan.touchdown.z - plan.rolloutDistance).toBeGreaterThan(far);
		expect(2 * plan.rolloutDistance / plan.rolloutSeconds).toBeCloseTo(plan.approachDistance / plan.approachSeconds);
		const parts = buildM03Plan().parts.filter((q) => q.solid && q.name !== "Landing runway" && q.name !== "Landing apron");
		let samples = 0;
		for (let t = 0; t <= landingDuration(plan); t += 0.1) {
			const pose = landingPose(plan, t);
			expect(math.max(math.abs(pose.x), math.abs(pose.z))).toBeLessThanOrEqual(M03_AIRSPACE.softHalfWidth);
			// Wheels never sink below the pavement; while airborne, a 96-stud-wide corridor 8 studs under the wheels is clear.
			const wheels = pose.y - M03_GEAR_CLEARANCE;
			expect(wheels).toBeGreaterThanOrEqual(M03_RUNWAY_TOP - 1e-6);
			if (pose.z > threshold) for (let dx = -48; dx <= 48; dx += 16) {
				expect(m03Ground(pose.x + dx, pose.z)).toBeLessThan(wheels - 8);
				expect(m03Height(pose.x + dx, pose.z)).toBeLessThan(wheels - 8);
			}
			for (const q of parts) if (math.abs(pose.x - q.x) <= q.sx / 2 + 48 && math.abs(pose.z - q.z) <= q.sz / 2 + 24)
				expect(q.y + q.sy / 2).toBeLessThan(wheels);
			samples++;
		}
		expect(samples).toBeGreaterThan(350);
		const start = landingPose(plan, 0);
		expect(start.y - plan.touchdown.y).toBeCloseTo(plan.approachDistance * math.tan(math.rad(3)));
		expect(landingDistance(plan, 0)).toBe(2100);
		expect(landingDistance(plan, plan.approachSeconds)).toBe(0);
		expect(landingAccomplishedAt(plan)).toBe(34);
	});
	it("talks the landing down in order and never repeats a cue", () => {
		const plan = M03_LANDING, heard: string[] = [];
		let t = 0;
		while (t < landingDuration(plan)) { const step = math.min(landingDuration(plan), t + 1 / 30); for (const line of landingRadioDue(plan, t, step)) heard.push(line); t = step; }
		expect(heard).toEqual(plan.radio!.map((cue) => cue.text));
		expect(plan.countdownSeconds).toBe(180);
		for (const cue of plan.radio!) expect(cue.text.size()).toBeLessThanOrEqual(72);
	});
	it("replays the reference run: update and clock reset, return line, landing clock, skip to MISSION ACCOMPLISHED, S 1,680", () => {
		const { s, ledger, update } = footageRun();
		expect(update.phase).toBe("return_line");
		expect(update.remaining).toBe(900);
		expect(update.serial).toBe(1);
		expect(update.objective).toBe("Return to base: fly south across the return line");
		expect(BlueprintRunner.TakeRadio(s)).toBe("SERA: All nine domes confirmed destroyed. Good work.");
		expect(BlueprintRunner.ActivePhase(s)?.kind).toBe("landing");
		expect(BlueprintRunner.TimeRemaining(s)).toBe(180);
		BlueprintRunner.Tick(s, 9999, 0);
		expect(s.outcome).toBeUndefined();
		BlueprintRunner.AdvanceLanding(s, 10);
		expect(BlueprintRunner.TimeRemaining(s)).toBe(170);
		BlueprintRunner.AdvanceLanding(s, 0, true);
		expect(s.outcome).toBeUndefined();
		expect(s.landingElapsed).toBe(34);
		expect(BlueprintRunner.TimeRemaining(s)).toBe(146);
		BlueprintRunner.AdvanceLanding(s, 2);
		expect(BlueprintRunner.TimeRemaining(s)).toBe(146);
		BlueprintRunner.AdvanceLanding(s, 2);
		expect(s.outcome).toBe("won");
		expect(s.elapsed).toBeCloseTo(406.71);
		expect(ledger.Total()).toBe(1680);
		expect(MissionScore.RankPoints(ledger.Total(), true, scoring)).toBe("S");
	});
	it("settles a win after the clock reset, beyond the first 15:00, once missions 1 and 2 are complete", () => {
		const { s, ledger } = footageRun(899, 880);
		BlueprintRunner.AdvanceLanding(s, landingDuration(M03_LANDING));
		expect(s.outcome).toBe("won");
		expect(s.elapsed).toBeGreaterThan(900);
		expect(s.elapsed).toBeLessThan(MissionCatalog.MaxMissionSeconds(3));
		const c = coordinator();
		const stats = (id: number, elapsed: number) => {
			const blueprint = MissionCatalog.Get(id);
			return { slot: 1, missionId: id, kills: MissionCatalog.RequiredAirKills(blueprint) + MissionCatalog.RequiredGroundKills(blueprint),
				groundKills: MissionCatalog.RequiredGroundKills(blueprint), completedPhases: MissionCatalog.TotalPhases(blueprint), elapsed };
		};
		// Locked until mission 2: the same result is refused and not recorded.
		expect(completeMission(c, 1, 3, true, stats(3, s.elapsed), () => undefined, 0)).toBe(false);
		for (const id of [1, 2]) expect(completeMission(c, 1, id, true, stats(id, 200), () => undefined, 0)).toBe(true);
		let packet: MissionFinished | undefined;
		expect(completeMission(c, 1, 3, true, { ...stats(3, s.elapsed), targetScore: ledger.Snapshot() }, (m) => { packet = m; }, 0)).toBe(true);
		expect(packet?.kind).toBe("Completed");
		expect(packet?.rank).toBe("S");
		expect(c.getSlots()[0].missions?.[3]?.completed).toBe(true);
		expect(c.getSlots()[0].missions?.[3]?.bestScore).toBe(1680);
	});
	it("fails on either countdown or when shot down; the landing itself cannot fail", () => {
		const first = BlueprintRunner.NewState(bp, 0);
		BlueprintRunner.Tick(first, 900);
		expect(first.outcome).toBe("failed"); expect(first.reason).toBe("timeout");
		const late = footageRun(400, 1);
		const returning = BlueprintRunner.NewState(bp, 0);
		for (const t of targets) if (t.required) BlueprintRunner.RecordKill(returning, t.id, "ground", true, 400);
		expect(BlueprintRunner.ActivePhase(returning)?.kind).toBe("return_line");
		BlueprintRunner.Tick(returning, 1299);
		expect(returning.outcome).toBeUndefined();
		BlueprintRunner.Tick(returning, 1300);
		expect(returning.outcome).toBe("failed"); expect(returning.reason).toBe("timeout");
		const shot = BlueprintRunner.NewState(bp, 0);
		BlueprintRunner.Tick(shot, 50, 0);
		expect(shot.outcome).toBe("failed"); expect(shot.reason).toBe("destroyed");
		expect(BlueprintRunner.ActivePhase(late.s)?.kind).toBe("landing");
		BlueprintRunner.Tick(late.s, 5000, 0);
		expect(late.s.outcome).toBeUndefined();
	});
});
