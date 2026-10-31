import { describe, expect, it } from "@rbxts/jest-globals";
import { arrivalDue, takeArrival, TriggerContext, TypedGroundTarget, GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordAlliedKill, recordScoredKill } from "../server/SortieScore";
import { MissionScore } from "../shared/MissionScore";
import { AlliedRules } from "../shared/AlliedRules";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { landingDuration, landingPose, validateBatchB } from "../shared/EngineBatchB";
import { rearmDuration, validateBatchC } from "../shared/EngineBatchC";
import { validateNightLighting } from "../shared/NightLighting";
import { cutInCaption, cutInDue, pointsLine, rearmClock, rearmMenuDue, rearmRadioDue, REARM_LANDING_CLOCK, REARM_TAKEOFF_CLOCK, takeoffChoice, validateCutIn } from "../shared/SortieCutaways";
import { buildM05Plan, M05, M05_TARGET_POINTS, M05_WORLD_KEY, m05LightAnchors, m05TargetLayout } from "../shared/M05WorldPlan";
import { M05_AIRSPACE } from "../shared/M05Limits";
import { weatherPlan } from "../shared/WeatherRules";
import { M05_CUT_IN, M05_REARM, M05_RETURN_LINE, M05_START, M05_TARGET_TYPES, m05LightPoint } from "../shared/missions/m05";
import type { MissionFinished } from "../shared/Types";

const bp = MissionCatalog.Get(5);
const strike = bp.phases[0], escape = bp.phases[1];
const targets = strike.groundTargets!;
const scoring = bp.scoring!;
const value = (t: TypedGroundTarget) => scoring.points[t.scoreRole];
const sum = (list: TypedGroundTarget[]) => list.reduce((n, t) => n + value(t), 0);
const group = (name: string) => targets.filter((t) => t.group === name);
function context(elapsed: number, phase: number, x = M05_START.x, z = M05_START.z): TriggerContext {
	return { elapsed, phase, requiredKills: 0, destroyed: new Set<string>(), targets, player: { x, z } };
}
function rejects(fn: () => void): boolean { const [ok] = pcall(fn); return !ok; }
/** Mission 4 (and mission 3 on older bases) is released by its own PR; fixtures open them so mission 5's unlock can be exercised. */
function withEarlierMissions(fn: () => void): void {
	const before = [MISSIONS[2].available, MISSIONS[3].available];
	MISSIONS[2].available = true; MISSIONS[3].available = true;
	const [ok, err] = pcall(fn);
	MISSIONS[2].available = before[0]; MISSIONS[3].available = before[1];
	if (!ok) error(err, 0);
}
function fresh() { const c = new CampaignCoordinator("m05-unlock", undefined, { now: () => 1000, defer: () => undefined }); c.load(); return c; }
function finish(c: CampaignCoordinator, missionId: number, extra: { elapsed?: number; score?: TargetScore; phases?: number } = {}, notify: (m: MissionFinished) => void = () => undefined): boolean {
	const m = MissionCatalog.Get(missionId);
	return completeMission(c, 1, missionId, true, {
		slot: 1, missionId, kills: MissionCatalog.RequiredAirKills(m) + MissionCatalog.RequiredGroundKills(m), groundKills: MissionCatalog.RequiredGroundKills(m),
		completedPhases: extra.phases ?? MissionCatalog.TotalPhases(m), elapsed: extra.elapsed ?? 100, targetScore: extra.score?.Snapshot(),
	}, notify, 0);
}

describe("Mission 5 data: the night fuel works", () => {
	it("is released on the night refinery world with a 10:00 strike, airborne start, night lights and points scoring", () => {
		expect(MissionCatalog.Available(5)).toBe(true);
		expect(MissionCatalog.WorldKey(5)).toBe(M05_WORLD_KEY);
		expect(MissionCatalog.Airspace(5)).toEqual(M05_AIRSPACE);
		expect(MissionCatalog.Start(5)).toEqual(M05_START);
		expect([M05_START.x, M05_START.y, M05_START.z, M05_START.headingDegrees]).toEqual([M05.start.x, M05.start.y, M05.start.z, 0]);
		expect(MissionCatalog.CountdownSeconds(5)).toBe(600);
		expect(MissionCatalog.MaxMissionSeconds(5)).toBe(600 + 600 + 240);
		// Par counts the full strike clock (it was 0:45 before score phases had a par rule).
		expect(MissionScore.ParSeconds(bp)).toBe(635);
		expect(bp.phases.size()).toBe(2);
		expect([strike.kind, escape.kind]).toEqual(["score_threshold", "return_line"]);
		expect(strike.scoreThreshold).toEqual({ points: 2000, seconds: 600, waitForExpiry: true });
		expect(MissionCatalog.RequiredAirKills(bp)).toBe(0);
		expect(MissionCatalog.RequiredGroundKills(bp)).toBe(0);
		expect(MissionCatalog.TotalPhases(bp)).toBe(2);
		expect(bp.ground.size()).toBe(0);
		expect(bp.terrainRelativeWarnings).toBe(true);
		expect(scoring.basis).toBe("points");
		expect(AlliedRules.Credit(bp.allies!)).toBe(false);
		MissionCatalog.ValidatePolicy(bp);
	});
	it("lights the world's own anchors inside the phone budget", () => {
		const lights = bp.nightLighting!, anchors = m05LightAnchors();
		validateNightLighting(lights, M05_AIRSPACE.hardHalfWidth);
		expect(lights.searchlights.size()).toBe(anchors.filter((a) => a.kind === "searchlight").size());
		expect(lights.searchlights.size()).toBe(8);
		const points = anchors.filter((a) => a.kind !== "searchlight");
		expect(lights.fields.size()).toBe(points.size() + 8);
		expect(lights.fields.reduce((n, f) => n + f.rows * f.columns, 0)).toBe(points.size() + 64);
		expect(lights.fields.reduce((n, f) => n + f.realLights, 0)).toBe(16);
		// Clear pre-dawn: the client draws no rain or dust, and the world key no longer errors in the weather lookup.
		expect(weatherPlan(M05_WORLD_KEY, false, false)).toEqual({});
		// Anchors keep their X/Z; one inside a structure rises to its roof, never lower than authored.
		let lifted = 0;
		points.forEach((a, i) => {
			const f = lights.fields[i];
			expect([f.origin.x, f.origin.z]).toEqual([a.x, a.z]);
			expect(f.origin.y >= a.y).toBe(true);
			if (f.origin.y > a.y) lifted++;
		});
		expect(lifted > 0).toBe(true);
		const tank = m05TargetLayout().find((t) => t.type === "fuel_tank_large")!;
		expect(m05LightPoint(tank.x, 60, tank.z).y).toBe(tank.y + 72 + 3);
		expect(m05LightPoint(0, 60, 0).y).toBe(60);
		// The rig deck fields stay on the eight decks (280 x 600, top Y=120).
		for (const f of lights.fields.filter((x) => x.rows === 4)) {
			const deck = math.round((f.origin.x + 90 - 8340) / 360);
			expect(deck >= 0 && deck < 8).toBe(true);
			for (const dx of [0, f.spacing]) expect(math.abs(f.origin.x + dx - (8340 + deck * 360)) <= 140).toBe(true);
			expect(f.origin.z >= -7800 && f.origin.z + 3 * f.spacing <= -7200).toBe(true);
			expect(f.origin.y).toBe(124);
		}
	});
	it("authors every ground and naval target once from the world layout: ids, poses, groups and yaw", () => {
		const layout = m05TargetLayout().filter((t) => t.type !== "helicopter");
		expect(targets.size()).toBe(90);
		expect(targets.size()).toBe(layout.size());
		layout.forEach((t, i) => {
			const spec = targets[i];
			expect(spec.id).toBe(t.id);
			expect(spec.type).toBe(M05_TARGET_TYPES[t.type as Exclude<typeof t.type, "helicopter">]);
			expect(spec.position).toEqual({ x: t.x, y: t.y, z: t.z });
			expect(spec.group).toBe(t.group);
			expect(math.abs(math.rad(spec.yaw) - t.yaw)).toBeLessThan(1e-9);
			expect(spec.required).toBe(false);
			expect(value(spec)).toBe(M05_TARGET_POINTS[t.type]);
		});
		expect(new Set(targets.map((t) => t.id)).size()).toBe(targets.size());
		// The world draws each contact exactly once: a model per id, with the ground silhouettes' parts named by it.
		const plan = buildM05Plan();
		for (const t of targets) {
			expect(plan.targets.filter((p) => p.id === t.id).size()).toBe(1);
			if (t.group !== "shipping") expect(plan.parts.filter((p) => p.name === t.id).size() > 0).toBe(true);
		}
		expect(GROUND_TARGET_LABELS.command_post).toBe("COMMAND POST");
		expect(GROUND_TARGET_LABELS.tanker).toBe("TANKER");
	});
	it("scores the world's 4,500-point ledger: rig 2,400, refinery 1,740 with the 100-point command contact, ships and helicopters 360", () => {
		expect(group("rig").size()).toBe(48); expect(sum(group("rig"))).toBe(2400);
		expect(group("refinery").size()).toBe(40); expect(sum(group("refinery"))).toBe(1740);
		expect(group("shipping").size()).toBe(2); expect(sum(group("shipping"))).toBe(240);
		const command = targets.filter((t) => t.type === "command_post");
		expect(command.size()).toBe(1); expect(value(command[0])).toBe(100); expect(command[0].group).toBe("refinery");
		const helicopters = strike.fighterWaves!.filter((w) => w.aircraft === "helicopter");
		expect(helicopters.size()).toBe(1); expect(helicopters[0].count).toBe(3); expect(scoring.points[helicopters[0].scoreRole]).toBe(40);
		expect(sum(targets) + 3 * 40).toBe(4500);
		// A thorough rig run reaches the goal on its own (m05 A3).
		expect(sum(group("rig")) >= strike.scoreThreshold!.points).toBe(true);
	});
	it("fields ten strike aircraft and the five-ship surprise, so 5,940 is the maximum", () => {
		const waves = strike.fighterWaves!;
		expect(waves.reduce((n, w) => n + w.count, 0) + 1).toBe(10);
		expect(strike.standaloneAce!.name).toBe("CINDER LEAD");
		expect(scoring.points.fighter).toBe(60); expect(scoring.points.ace).toBe(240); expect(scoring.points.elite).toBe(150);
		const fighters = waves.filter((w) => w.aircraft === undefined).reduce((n, w) => n + w.count, 0);
		expect(fighters).toBe(6);
		const phaseOne = sum(targets) + 3 * 40 + fighters * 60 + 240;
		expect(phaseOne).toBe(5100);
		const lead = escape.standaloneAce!, wing = escape.fighterWaves!;
		expect(lead.name).toBe("VULTURE LEAD"); expect(lead.livery).toBe("Vulture");
		expect(wing.size()).toBe(1); expect(wing[0].count).toBe(4); expect(wing[0].livery).toBe("Elite"); expect(wing[0].scoreRole).toBe("elite");
		expect(phaseOne + 240 + 4 * 150).toBe(5940);
		expect(bp.optionalRaiderMax).toBe(15);
		expect(MissionCatalog.RaiderCap(strike, 0)).toBe(10);
		expect(MissionCatalog.RaiderCap(escape, 0)).toBe(5);
	});
	it("ranks S 4,000, A 3,000, B 2,500, C 2,000 inside the footage bounds; a failed sortie is D", () => {
		expect(scoring.rank).toEqual({ S: 4000, A: 3000, B: 2500, C: 2000 });
		for (const [total, rank] of [[2000, "C"], [2490, "C"], [2540, "B"], [2780, "B"], [3050, "A"], [3980, "A"], [4080, "S"], [4860, "S"], [5940, "S"]] as [number, string][]) {
			expect(MissionScore.RankPoints(total, true, scoring)).toBe(rank);
		}
		expect(MissionScore.RankPoints(5940, false, scoring)).toBe("D");
		expect(pointsLine(1850, 2000, scoring)).toBe("PTS 1850/2000");
		expect(pointsLine(2000, 2000, scoring)).toBe("PTS 2000/C");
		expect(pointsLine(3050, 2000, scoring)).toBe("PTS 3050/A");
		expect(pointsLine(4080, 2000, scoring)).toBe("PTS 4080/S");
	});
	it("schedules the strike waves: interceptors, rig helicopters on approach, reserves, a late pair and Cinder Lead near the refinery", () => {
		const waves = strike.fighterWaves!;
		expect(waves.map((w) => w.id)).toEqual(["m05_interceptors", "m05_rig_helicopters", "m05_reserves", "m05_late_pair"]);
		const fired = new Set<string>();
		const due = (c: TriggerContext) => [...waves, strike.standaloneAce!].filter((a) => takeArrival(a.id, a.trigger, c, fired)).map((a) => a.id);
		expect(due(context(39, 0))).toEqual([]);
		expect(due(context(40, 0))).toEqual(["m05_interceptors"]);
		expect(due(context(100, 0, M05.rig.x - 5000, M05.rig.z))).toEqual(["m05_rig_helicopters"]);
		expect(due(context(150, 0, M05.rig.x, M05.rig.z))).toEqual(["m05_reserves"]);
		expect(due(context(330, 0, M05.rig.x, M05.rig.z))).toEqual(["m05_late_pair"]);
		expect(due(context(400, 0, M05.refinery.x + 6900, M05.refinery.z))).toEqual(["m05_cinder_lead"]);
		// The helicopters start from the world's helicopter poses and stay above the 240-stud crane tops.
		const route = waves[1].route!;
		const poses = m05TargetLayout().filter((t) => t.type === "helicopter");
		expect([route.waypoints[0].x, route.waypoints[0].z]).toEqual([poses[0].x, poses[0].z]);
		for (const p of route.waypoints) expect(p.y > 240).toBe(true);
		for (const line of [...waves.map((w) => w.call!), strike.standaloneAce!.call!, ...strike.standaloneAce!.stageLines!]) expect(line.size() > 0 && line.size() <= 72).toBe(true);
	});
});

describe("Mission 5 flow: threshold, surprise, escape and settlement", () => {
	it("holds a met goal until 10:00, then the surprise phase with its own 4:00 clock; a south crossing wins and settles", () => {
		const state = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring);
		let now = 0;
		const kill = (t: TypedGroundTarget) => expect(recordScoredKill(state, ledger, t.id, "ground", false, now += 4, t.scoreRole, t.type)).toBe(true);
		group("shipping").forEach(kill);
		group("rig").forEach(kill);
		expect(ledger.Total()).toBe(2640);
		BlueprintRunner.Tick(state, now);
		expect(state.phaseIndex).toBe(0);
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(2000);
		// Wingmen never take the works' points, and a duplicate kill never counts.
		expect(recordAlliedKill(state, ledger, [], bp.allies!, group("refinery")[0].id, "ground", false, now, undefined)).toBe(false);
		expect(recordScoredKill(state, ledger, group("rig")[0].id, "ground", false, now, "crane")).toBe(false);
		expect(recordScoredKill(state, ledger, "cinder", "ace", false, now += 5, "ace")).toBe(true);
		BlueprintRunner.Tick(state, 599.9);
		expect(state.phaseIndex).toBe(0);
		expect(BlueprintRunner.TimeRemaining(state)).toBeCloseTo(0.1, 3);
		BlueprintRunner.Tick(state, 600);
		expect(state.outcome).toBeUndefined();
		expect(state.phaseIndex).toBe(1);
		expect(BlueprintRunner.TimeRemaining(state)).toBe(240);
		expect(state.updateSerial).toBe(1);
		expect(BlueprintRunner.TakeRadio(state)).toBe(escape.update!.radio[0]);
		// Phase 2: the works is inert; the elite flight is optional points.
		expect(BlueprintRunner.CanDamage(state, "ground", false)).toBe(false);
		expect(recordScoredKill(state, ledger, group("refinery")[1].id, "ground", false, 601, "fuel_tank")).toBe(false);
		const fired = new Set<string>();
		for (const a of [...escape.fighterWaves!, escape.standaloneAce!]) { expect(takeArrival(a.id, a.trigger, context(611, 1), fired)).toBe(false); expect(takeArrival(a.id, a.trigger, context(612, 1), fired)).toBe(true); }
		expect(cutInDue(M05_CUT_IN, 612, 5)).toBe(true);
		expect(recordScoredKill(state, ledger, "elite1", "air", false, 640, "elite")).toBe(true);
		expect(recordScoredKill(state, ledger, "vulture", "ace", false, 650, "ace")).toBe(true);
		expect(state.optionalAceKilled).toBe(true);
		// Northbound or outside the segment never counts; the southbound crossing wins.
		BlueprintRunner.ObserveFlight(state, { x: 0, y: 400, z: 9450 }, { x: 0, y: 400, z: 9390 }, 0.1, 700);
		BlueprintRunner.ObserveFlight(state, { x: 20000, y: 400, z: 9390 }, { x: 20000, y: 400, z: 9410 }, 0.1, 700);
		expect(state.outcome).toBeUndefined();
		BlueprintRunner.ObserveFlight(state, { x: -500, y: 400, z: 9395 }, { x: -500, y: 400, z: 9405 }, 0.1, 707.35);
		expect(state.outcome).toBe("won");
		expect(state.phaseIndex).toBe(2);
		expect(ledger.Total()).toBe(2640 + 240 + 150 + 240);
		// Settlement: missions 1-4 completed in order through the real path, then mission 5's win records rank A.
		withEarlierMissions(() => {
			const c = fresh();
			for (let id = 1; id <= 4; id++) { expect(canLaunchMission(5, c.getSlots()[0])).toBe(false); expect(finish(c, id)).toBe(true); }
			expect(highestUnlocked(c.getSlots()[0])).toBe(5);
			let message: MissionFinished | undefined;
			expect(finish(c, 5, { elapsed: state.elapsed, score: ledger, phases: state.phaseIndex }, (m) => { message = m; })).toBe(true);
			expect(message?.kind).toBe("Completed");
			expect(message?.rank).toBe("A");
			const record = normalizeProfile(serializeProfile({ version: 3, slots: c.getSlots() })).slots[0].missions![5];
			expect(record.completed).toBe(true);
			expect(record.bestScore).toBe(ledger.Total());
			expect(record.bestTargetScore?.total).toBe(ledger.Total());
		});
	});
	it("fails below 2,000 at 10:00, when shot down in either phase, and when the 4:00 escape clock runs out", () => {
		const low = BlueprintRunner.NewState(bp, 0); low.score = 1999; BlueprintRunner.Tick(low, 600);
		expect(low.outcome).toBe("failed"); expect(low.reason).toBe("timeout");
		const early = BlueprintRunner.NewState(bp, 0); early.score = 2400; BlueprintRunner.Tick(early, 120, 0);
		expect(early.reason).toBe("destroyed");
		const late = BlueprintRunner.NewState(bp, 0); late.score = 2000; BlueprintRunner.Tick(late, 600); BlueprintRunner.Tick(late, 700, 0);
		expect(late.reason).toBe("destroyed");
		const slow = BlueprintRunner.NewState(bp, 0); slow.score = 2000; BlueprintRunner.Tick(slow, 600); BlueprintRunner.Tick(slow, 839.9);
		expect(slow.outcome).toBeUndefined(); BlueprintRunner.Tick(slow, 840);
		expect(slow.outcome).toBe("failed"); expect(slow.reason).toBe("timeout");
		// A win that never completed both phases, or outside the clock budget, does not settle as completed.
		withEarlierMissions(() => {
			const c = fresh();
			for (let id = 1; id <= 4; id++) finish(c, id);
			let kind: string | undefined;
			expect(finish(c, 5, { phases: 1 }, (m) => { kind = m.kind; })).toBe(true);
			expect(kind).toBe("Failed");
			expect(finish(c, 5, { elapsed: MissionCatalog.MaxMissionSeconds(5) }, (m) => { kind = m.kind; })).toBe(true);
			expect(kind).toBe("Failed");
			expect(c.getSlots()[0].missions?.[5]?.completed === true).toBe(false);
		});
	});
	it("holds the clock while a rearm or the cut-in runs: the runner never ticks them", () => {
		const s = BlueprintRunner.NewState(bp, 0); s.score = 2400;
		s.rearmActive = true; BlueprintRunner.Tick(s, 900); expect(s.elapsed).toBe(0); expect(s.phaseIndex).toBe(0);
		s.rearmActive = undefined; BlueprintRunner.Tick(s, 600); expect(s.phaseIndex).toBe(1);
		s.cutInActive = true; BlueprintRunner.Tick(s, 1000); expect(s.outcome).toBeUndefined(); expect(BlueprintRunner.TimeRemaining(s)).toBe(240);
	});
});

describe("Mission 5 rearm, weapon menu and cut-in presentation", () => {
	it("opens the rearm at a gate on the way home, lands southbound on the runway and takes off within its clocks", () => {
		const plan = strike.rearm!, gate = landingPose(plan.landing, 0), rollout = landingPose(plan.landing, landingDuration(plan.landing));
		expect(plan).toBe(M05_REARM);
		expect(plan.health).toBe(false); expect(plan.missiles).toBe(true); expect(plan.special).toBe(true); expect(plan.weaponMenu).toBe(true);
		expect(math.abs(gate.x - M05.runway.x)).toBeLessThan(1e-6);
		expect(gate.z).toBeCloseTo(M05.runway.z - M05.runway.length / 2 - 1980, 3);
		expect(gate.z < M05.base.z && gate.z > -M05_AIRSPACE.softHalfWidth).toBe(true);
		const north = M05.runway.z - M05.runway.length / 2, south = M05.runway.z + M05.runway.length / 2;
		expect(plan.landing.touchdown.z > north && rollout.z < south).toBe(true);
		expect(plan.landing.touchdown.y).toBe(M05.runway.y + 6);
		expect(math.sqrt((gate.x - plan.zone.x) ** 2 + (gate.y - plan.zone.y) ** 2 + (gate.z - plan.zone.z) ** 2)).toBeLessThan(1e-6);
		validateBatchC(bp.phases, M05_AIRSPACE.hardHalfWidth);
		validateBatchB(bp.phases, M05_AIRSPACE.hardHalfWidth);
		expect(rejects(() => validateBatchC([{ ...strike, rearm: { ...plan, health: true } }, escape], M05_AIRSPACE.hardHalfWidth))).toBe(true);
	});
	it("runs the reference's LANDING 3:00 and TAKEOFF 1:00 clocks and holds the jet for TAKEOFF / CHANGE WEAPON", () => {
		const plan = M05_REARM, landed = landingDuration(plan.landing);
		expect(rearmClock(plan, 0, false)).toEqual({ label: "LANDING", seconds: REARM_LANDING_CLOCK });
		expect(rearmClock(plan, 10, false)).toEqual({ label: "LANDING", seconds: 170 });
		expect(rearmClock(plan, plan.landing.approachSeconds + 3, false)).toEqual({ label: "LANDING", seconds: 180 - plan.landing.approachSeconds });
		expect(rearmClock(plan, landed, true)).toEqual({ label: "TAKEOFF", seconds: REARM_TAKEOFF_CLOCK });
		expect(rearmClock(plan, landed + 5, false)).toEqual({ label: "TAKEOFF", seconds: 55 });
		expect(rearmClock(plan, rearmDuration(plan), false)).toEqual({ label: "TAKEOFF", seconds: 40 });
		expect(rearmMenuDue(plan, landed - 0.1, false)).toBe(false);
		expect(rearmMenuDue(plan, landed, false)).toBe(true);
		expect(rearmMenuDue(plan, landed, true)).toBe(false);
		expect(rearmMenuDue({ ...plan, weaponMenu: undefined }, landed, false)).toBe(false);
		expect(takeoffChoice("lance")).toBe("lance");
		for (const bad of ["health", 5, undefined, "LANCE"]) expect(takeoffChoice(bad)).toBeUndefined();
		expect(rearmRadioDue(plan, 0, 1)).toEqual([plan.radio![0].text]);
		expect(rearmRadioDue(plan, 1, landed)).toEqual([plan.radio![1].text, plan.radio![2].text]);
		expect(rearmRadioDue(plan, landed, rearmDuration(plan))).toEqual([plan.radio![3].text]);
		for (const cue of plan.radio!) expect(cue.text.size() <= 72).toBe(true);
	});
	it("plays the elite cut-in once the flight is up (or after a short grace) with timed captions", () => {
		const plan = escape.cutIn!;
		expect(plan).toBe(M05_CUT_IN);
		expect(plan.subjects).toEqual(["ace", "elite"]);
		expect(cutInDue(plan, 611.9, 5)).toBe(false);
		expect(cutInDue(plan, 612, 0)).toBe(false);
		expect(cutInDue(plan, 612, 1)).toBe(true);
		expect(cutInDue(plan, 617, 0)).toBe(true);
		expect(cutInCaption(plan, 0)).toBeUndefined();
		expect(cutInCaption(plan, 1)).toBe(plan.captions[0].text);
		expect(cutInCaption(plan, 8.9)).toBe(plan.captions[1].text);
		validateCutIn(bp.phases);
		expect(rejects(() => validateCutIn([{ kind: "required_air", cutIn: plan }]))).toBe(true);
		expect(rejects(() => validateCutIn([strike, { ...escape, cutIn: { ...plan, seconds: 60 } }]))).toBe(true);
		expect(rejects(() => validateCutIn([strike, { ...escape, cutIn: { ...plan, captions: [{ at: 2, text: "A" }, { at: 1, text: "B" }] } }]))).toBe(true);
	});
	it("keeps the escape line on the world's withdrawal line and every story line short and its own", () => {
		expect(M05_RETURN_LINE.a).toEqual({ x: M05.returnLine.x1, z: M05.returnLine.z });
		expect(M05_RETURN_LINE.direction).toEqual({ x: 0, z: 1 });
		expect(escape.returnLine).toBe(M05_RETURN_LINE);
		expect(escape.update!.countdownSeconds).toBe(240);
		const lines = [strike.beat!, ...strike.chatter!.map((c) => c.text), ...escape.update!.radio, ...M05_CUT_IN.captions.map((c) => c.text), ...M05_CUT_IN.after!, ...escape.standaloneAce!.stageLines!];
		for (const line of lines) expect(line.size() > 0 && line.size() <= 72).toBe(true);
		for (const phase of bp.phases) expect(phase.label.size() <= 40).toBe(true);
		expect(bp.failure.size() <= 120).toBe(true);
		expect(bp.title).toBe("LIGHTS OFF");
		expect(arrivalDue(escape.standaloneAce!.trigger, context(612, 1))).toBe(true);
	});
});

describe("Mission 5 unlock", () => {
	it("unlocks only after mission 4, in order, and refuses forged, skipped or locked results", () => {
		const c = fresh();
		let notified = 0;
		// Without mission 4 released, nothing past the last released mission before it can be launched or recorded.
		const before = MISSIONS[3].available;
		MISSIONS[3].available = false;
		const [ok, err] = pcall(() => {
			for (let id = 1; id <= 3; id++) if (MissionCatalog.Available(id)) finish(c, id);
			expect(highestUnlocked(c.getSlots()[0]) <= 3).toBe(true);
			expect(canLaunchMission(5, c.getSlots()[0])).toBe(false);
			expect(finish(c, 5, {}, () => notified++)).toBe(false);
		});
		MISSIONS[3].available = before;
		if (!ok) error(err, 0);
		withEarlierMissions(() => {
			const d = fresh();
			const slot = d.getSlots()[0];
			for (const skip of [2, 3, 4]) expect(finish(d, skip + 1, {}, () => notified++)).toBe(false);
			expect(finish(d, 5, {}, () => notified++)).toBe(false);
			finish(d, 1); finish(d, 2); finish(d, 3);
			expect(canLaunchMission(5, d.getSlots()[0])).toBe(false);
			expect(finish(d, 5, {}, () => notified++)).toBe(false);
			finish(d, 4);
			expect(canLaunchMission(5, d.getSlots()[0])).toBe(true);
			expect(canLaunchMission(6, d.getSlots()[0])).toBe(false);
			// A forged slot claiming every mission still stops at the last released mission (9 since mission 9's release).
			const forged = d.getSlots()[0];
			forged.missions ??= {};
			for (let id = 1; id <= 18; id++) forged.missions[id] = { completed: true };
			expect(highestUnlocked(forged)).toBe(9);
			for(let id=10;id<=18;id++) expect(canLaunchMission(id,forged)).toBe(false);
			void slot;
		});
		expect(notified).toBe(0);
	});
});
