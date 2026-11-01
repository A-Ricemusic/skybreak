import { describe, expect, it } from "@rbxts/jest-globals";
import { takeArrival, TriggerContext, TypedGroundTarget, GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordAlliedKill, recordScoredKill } from "../server/SortieScore";
import { MissionScore } from "../shared/MissionScore";
import { AlliedRules } from "../shared/AlliedRules";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { landingDuration, landingPose, validateLandingPhases } from "../shared/LandingRules";
import { validateRearmPhases } from "../shared/RearmRules";
import { AntiShipRules, navalHull, SamRules, surfacePose, validateNavalTargets } from "../shared/SurfaceTargetRules";
import { SortieArmament, validateArmament } from "../shared/SortieArmament";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { pointsLine, rearmRadioDue } from "../shared/SortieCutaways";
import { buildM06Plan, M06, M06_SURFACE, M06_WORLD_KEY, m06TargetLayout } from "../shared/M06WorldPlan";
import { M06_AIRSPACE } from "../shared/M06Limits";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
import { M06_ARMAMENT, M06_HULL_HEALTH, M06_REARM, M06_START, M06_TARGET_POINTS, M06_TARGET_TYPES, m06MountParent } from "../shared/missions/m06";
import type { MissionFinished } from "../shared/Types";

const bp = MissionCatalog.Get(6);
const strike = bp.phases[0];
const targets = strike.groundTargets!;
const scoring = bp.scoring!;
const value = (t: TypedGroundTarget) => scoring.points[t.scoreRole];
const sum = (list: TypedGroundTarget[]) => list.reduce((n, t) => n + value(t), 0);
const hulls = targets.filter((t) => navalHull(t.type));
const yards = targets.filter((t) => t.group !== undefined && t.group.find("_yard")[0] !== undefined);
const mounts = targets.filter((t) => t.parentId !== undefined);
const countOf = (list: TypedGroundTarget[], role: string) => list.filter((t) => t.scoreRole === role).size();
function context(elapsed: number, x = M06_START.x, z = M06_START.z): TriggerContext {
	return { elapsed, phase: 0, requiredKills: 0, destroyed: new Set<string>(), targets, player: { x, z } };
}
function rejects(fn: () => void): boolean { const [ok] = pcall(fn); return !ok; }
/** Missions 3 and 4 may be released by their own PRs on older bases; fixtures open them so mission 6's unlock can be exercised. */
function withEarlierMissions(fn: () => void): void {
	const before = [MISSIONS[2].available, MISSIONS[3].available, MISSIONS[4].available];
	MISSIONS[2].available = true; MISSIONS[3].available = true; MISSIONS[4].available = true;
	const [ok, err] = pcall(fn);
	MISSIONS[2].available = before[0]; MISSIONS[3].available = before[1]; MISSIONS[4].available = before[2];
	if (!ok) error(err, 0);
}
function fresh() { const c = new CampaignCoordinator("m06-unlock", undefined, { now: () => 1000, defer: () => undefined }); c.load(); return c; }
function finish(c: CampaignCoordinator, missionId: number, extra: { elapsed?: number; score?: TargetScore; phases?: number } = {}, notify: (m: MissionFinished) => void = () => undefined): boolean {
	const m = MissionCatalog.Get(missionId);
	return completeMission(c, 1, missionId, true, {
		slot: 1, missionId, kills: MissionCatalog.RequiredAirKills(m) + MissionCatalog.RequiredGroundKills(m), groundKills: MissionCatalog.RequiredGroundKills(m),
		completedPhases: extra.phases ?? MissionCatalog.TotalPhases(m), elapsed: extra.elapsed ?? 100, targetScore: extra.score?.Snapshot(),
	}, notify, 0);
}

describe("Mission 6 data: the Iron Coast military quays", () => {
	it("is released on the harbour world with one 15:00 score phase, an airborne start and points scoring", () => {
		expect(MissionCatalog.Available(6)).toBe(true);
		expect(MissionCatalog.WorldKey(6)).toBe(M06_WORLD_KEY);
		expect(MissionCatalog.Airspace(6)).toEqual(M06_AIRSPACE);
		expect(MissionCatalog.Start(6)).toEqual(M06_START);
		expect([M06_START.x, M06_START.y, M06_START.z, M06_START.headingDegrees]).toEqual([M06.start.x, M06.start.y, M06.start.z, 0]);
		expect(MissionCatalog.CountdownSeconds(6)).toBe(900);
		expect(MissionCatalog.MaxMissionSeconds(6)).toBe(900 + 900);
		expect(MissionScore.ParSeconds(bp)).toBe(925);
		expect(bp.phases.size()).toBe(1);
		expect(strike.kind).toBe("score_threshold");
		expect(strike.scoreThreshold).toEqual({ points: 3000, seconds: 900, waitForExpiry: true });
		expect(MissionCatalog.RequiredAirKills(bp)).toBe(0);
		expect(MissionCatalog.RequiredGroundKills(bp)).toBe(0);
		expect(MissionCatalog.TotalPhases(bp)).toBe(1);
		expect(bp.ground.size()).toBe(0);
		expect(bp.terrainRelativeWarnings).toBe(true);
		expect(bp.nightLighting).toBeUndefined();
		expect(scoring.basis).toBe("points");
		expect(bp.pressure).toEqual({ playerPriority: 0.8, forwardConeDegrees: 25, tailDefence: true });
		expect(bp.title).toBe("IRON COAST");
		MissionCatalog.ValidatePolicy(bp);
	});
	it("keeps the Broken Relay chapter: story briefing, debrief, failure and radio as subtitles", () => {
		const story = MISSION_STORY_TEXT[6];
		expect([bp.briefing, bp.debrief, bp.failure]).toEqual([story.briefing, story.debrief, story.failure]);
		expect(strike.chatter![strike.chatter!.size() - 1]).toEqual({ at: 1, text: story.radio[1] });
		const lines = [strike.beat!, ...strike.chatter!.map((c) => c.text), ...strike.fighterWaves!.map((w) => w.call!),
			strike.standaloneAce!.call!, ...strike.standaloneAce!.stageLines!, ...M06_REARM.radio!.map((r) => r.text)];
		for (const line of lines) expect(line.size() > 0 && line.size() <= 72).toBe(true);
		expect(strike.label.size() <= 40).toBe(true);
		expect(bp.failure.size() <= 120).toBe(true);
	});
	it("authors every world contact once from the layout: ids, types, poses, groups and yaw", () => {
		const layout = m06TargetLayout();
		expect(targets.size()).toBe(94);
		expect(targets.size()).toBe(layout.size());
		layout.forEach((t, i) => {
			const spec = targets[i];
			expect(spec.id).toBe(t.id);
			expect(spec.type).toBe(M06_TARGET_TYPES[t.type]);
			expect(spec.position).toEqual({ x: t.x, y: t.y, z: t.z });
			expect(spec.group).toBe(t.group);
			expect(math.abs(math.rad(spec.yaw) - t.yaw)).toBeLessThan(1e-9);
			expect(spec.required).toBe(false);
			expect(spec.scoreRole).toBe(t.type);
			expect(value(spec)).toBe(M06_TARGET_POINTS[t.type]);
		});
		expect(new Set(targets.map((t) => t.id)).size()).toBe(targets.size());
		// The world draws each contact once: hulls through the composition's naval silhouettes, the rest as id-named parts or tagged props.
		const plan = buildM06Plan();
		for (const t of targets) {
			expect(plan.targets.filter((p) => p.id === t.id).size()).toBe(1);
			if (navalHull(t.type)) expect(t.position.y).toBe(M06.sea);
			else expect(plan.parts.some((p) => p.name === t.id) || plan.props.some((p) => p.tag === t.id)).toBe(true);
		}
		expect(GROUND_TARGET_LABELS.gun_mount).toBe("GUN");
		expect(GROUND_TARGET_LABELS[M06_TARGET_TYPES.frigate]).toBe("DESTROYER");
	});
	it("reconciles the roster: 36 naval hulls, a 40-contact ground roster and 18 moored mounts (58 ground kills, 1,960 points)", () => {
		expect(hulls.size()).toBe(36);
		expect(yards.size()).toBe(40);
		expect(mounts.size()).toBe(18);
		expect(hulls.size() + yards.size() + mounts.size()).toBe(targets.size());
		// Naval ledger: destroyers and frigates 100, cruisers and submarines 120, missile boats 60, support hulls 100.
		const naval: [string, number][] = [["destroyer", 6], ["frigate", 6], ["cruiser", 9], ["submarine", 3], ["missile_boat", 3], ["supply_ship", 3], ["landing_ship", 3], ["container_ship", 3]];
		for (const [role, n] of naval) expect(countOf(hulls, role)).toBe(n);
		expect(sum(hulls)).toBe(3720);
		const yard: [string, number][] = [["crane", 6], ["containers", 7], ["fuel_tank", 6], ["gas_tank", 6], ["storage", 7], ["aa", 4], ["sam", 4]];
		for (const [role, n] of yard) expect(countOf(yards, role)).toBe(n);
		expect(sum(yards)).toBe(1480);
		for (const role of ["gun", "aa", "sam"]) expect(countOf(mounts, role)).toBe(6);
		expect(sum(mounts)).toBe(480);
		// The reference debrief credits GRND TGT x58 = 1,960; our provisional 40 yard contacts plus 18 mounts match that aggregate, not a proven inventory.
		expect(yards.size() + mounts.size()).toBe(58);
		expect(sum(yards) + sum(mounts)).toBe(1960);
	});
	it("moors each defence mount to the hull beside it: same basin and row, inside the D2 hull envelope", () => {
		validateNavalTargets(targets, M06_AIRSPACE.spawnLimit);
		const parents = new Set<string>();
		for (const mount of mounts) {
			const hull = targets.find((t) => t.id === mount.parentId)!;
			expect(hull).toBeDefined();
			expect(navalHull(hull.type)).toBe(true);
			expect(hull.parentId).toBeUndefined();
			expect(hull.route).toBeUndefined();
			expect(`${hull.group}_defence`).toBe(mount.group);
			expect([mount.position.x - hull.position.x, mount.position.z - hull.position.z]).toEqual([180, 0]);
			expect(["aa_gun", "sam", "gun_mount"].includes(mount.type)).toBe(true);
			parents.add(hull.id);
		}
		expect(parents.size()).toBe(18);
		// Yard contacts and hulls never get a parent.
		for (const t of [...yards, ...hulls]) expect(t.parentId).toBeUndefined();
		const orphan = m06TargetLayout().find((t) => t.group === "west_yard")!;
		expect(m06MountParent({ ...orphan, group: "west_defence" })).toBeUndefined();
	});
	it("gives hulls their naval lifecycle and missile strength, and arms every SAM", () => {
		for (const hull of hulls) {
			expect(hull.naval).toBe(true);
			const kind = hull.scoreRole as keyof typeof M06_HULL_HEALTH;
			expect(hull.health).toBe(M06_HULL_HEALTH[kind]);
			const health = hull.health ?? 55;
			expect(health % SpecialWeapons.StandardDamage).toBe(0);
			expect(AntiShipRules.Damage >= health).toBe(true);
		}
		expect(hulls.filter((t) => t.type === "missile_boat").every((t) => t.health === undefined)).toBe(true);
		expect(hulls.filter((t) => t.type === "cruiser").every((t) => t.health === 165)).toBe(true);
		const sams = targets.filter((t) => t.type === "sam");
		expect(sams.size()).toBe(10);
		for (const sam of sams) expect(sam.sam).toBe(true);
		expect(targets.filter((t) => t.sam === true).size()).toBe(10);
		expect([SamRules.Cap("easy"), SamRules.Cap("normal"), SamRules.Cap("ace")]).toEqual([1, 2, 3]);
	});
	it("sails the three outer-channel cruisers inside native water and keeps every basin hull moored", () => {
		const moving = hulls.filter((t) => t.route !== undefined);
		expect(moving.size()).toBe(3);
		for (const hull of moving) {
			expect(hull.type).toBe("cruiser");
			expect(hull.position.z).toBe(M06.outer.z);
			const route = hull.route!;
			expect(route.speed).toBe(18);
			expect(route.waypoints[0]).toEqual(hull.position);
			expect(surfacePose(route, 0).yaw).toBeCloseTo(hull.yaw, 3);
			// Each leg, sampled every 40 studs and widened by the 180-stud half hull, stays in the native-water channel.
			for (let i = 1; i < route.waypoints.size(); i++) {
				const a = route.waypoints[i - 1], b = route.waypoints[i];
				const length = math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2), steps = math.ceil(length / 40);
				for (let s = 0; s <= steps; s++) {
					const x = a.x + (b.x - a.x) * s / steps, z = a.z + (b.z - a.z) * s / steps;
					for (const [dx, dz] of [[0, 0], [180, 0], [-180, 0], [0, 180], [0, -180]]) expect(M06_SURFACE.nativeWater!(x + dx, z + dz)).toBe(true);
				}
			}
			// About three laps fit the 15:00 clock; the hull then holds at the end of its route.
			expect(surfacePose(route, 900).moving).toBe(false);
			expect(surfacePose(route, 600).moving).toBe(true);
		}
		// The three loops never share water: west goes west, centre and east go east.
		const xs = moving.map((h) => h.route!.waypoints.map((p) => p.x));
		const span = xs.map((list) => [math.min(...list) - 180, math.max(...list) + 180]);
		span.sort((a, b) => a[0] < b[0]);
		for (let i = 1; i < span.size(); i++) expect(span[i][0] > span[i - 1][1]).toBe(true);
	});
	it("fields sixteen hostile aircraft (eleven on the reference roster, five more for pressure) and peaks at 6,800 points", () => {
		const waves = strike.fighterWaves!;
		expect(waves.map((w) => w.id)).toEqual(["m06_harbour_cap", "m06_basin_helicopters", "m06_strike_pair", "m06_reserves", "m06_outer_patrol", "m06_last_flight"]);
		expect(waves.reduce((n, w) => n + w.count, 0) + 1).toBe(16);
		expect(bp.optionalRaiderMax).toBe(16);
		expect(MissionCatalog.RaiderCap(strike, 0)).toBe(16);
		const air = waves.reduce((n, w) => n + w.count * scoring.points[w.scoreRole], 0) + scoring.points.ace;
		expect(air).toBe(11 * 60 + 2 * 60 + 2 * 50 + 240);
		expect(scoring.points.fighter).toBe(60); expect(scoring.points.fighter_bomber).toBe(60);
		expect(scoring.points.helicopter).toBe(50); expect(scoring.points.ace).toBe(240);
		expect(sum(targets) + air).toBe(6800);
		// Ground alone already clears S: a strike-only run can reach every rank.
		expect(sum(targets) >= scoring.rank.S).toBe(true);
		expect(strike.standaloneAce!.name).toBe("WARDEN LEAD");
		expect(strike.standaloneAce!.livery).toBe("Vulture");
		const helicopters = waves.filter((w) => w.aircraft === "helicopter");
		expect(helicopters.size()).toBe(1);
		for (const p of helicopters[0].route!.waypoints) expect(p.y > 240).toBe(true);
	});
	it("schedules the waves: harbour CAP, helicopters and strike jets on approach, reserves, patrol, the ace and a last flight", () => {
		const waves = strike.fighterWaves!;
		const fired = new Set<string>();
		const due = (c: TriggerContext) => [...waves, strike.standaloneAce!].filter((a) => takeArrival(a.id, a.trigger, c, fired)).map((a) => a.id);
		expect(due(context(19))).toEqual([]);
		expect(due(context(20))).toEqual(["m06_harbour_cap"]);
		expect(due(context(60, M06.basins[1].x, M06.basins[1].z + 6100))).toEqual([]);
		expect(due(context(60, M06.basins[1].x, M06.basins[1].z + 5900))).toEqual(["m06_basin_helicopters"]);
		expect(due(context(90, M06.basins[2].x - 5900, M06.basins[2].z))).toEqual(["m06_strike_pair"]);
		expect(due(context(200))).toEqual(["m06_reserves"]);
		expect(due(context(420))).toEqual(["m06_outer_patrol"]);
		expect(due(context(510))).toEqual(["m06_warden_lead"]);
		expect(due(context(660))).toEqual(["m06_last_flight"]);
		expect(due(context(899))).toEqual([]);
	});
	it("ranks S 5,000, A 4,200, B 3,600, C 3,000 inside the footage bounds; a failed sortie is D", () => {
		expect(scoring.rank).toEqual({ S: 5000, A: 4200, B: 3600, C: 3000 });
		// Footage: 3,050 read C, 4,250 read A, 4,770 still A and 5,060 S (m06 §7).
		for (const [total, rank] of [[3000, "C"], [3050, "C"], [3590, "C"], [3600, "B"], [4190, "B"], [4250, "A"], [4770, "A"], [5000, "S"], [5060, "S"], [6260, "S"], [6800, "S"]] as [number, string][]) {
			expect(MissionScore.RankPoints(total, true, scoring)).toBe(rank);
		}
		expect(MissionScore.RankPoints(6800, false, scoring)).toBe("D");
		expect(pointsLine(2750, 3000, scoring)).toBe("PTS 2750/3000");
		expect(pointsLine(3050, 3000, scoring)).toBe("PTS 3050/C");
		expect(pointsLine(4250, 3000, scoring)).toBe("PTS 4250/A");
		expect(pointsLine(5060, 3000, scoring)).toBe("PTS 5060/S");
	});
});

describe("Mission 6 armament, rearm and allies", () => {
	it("fits 60 finite missiles, a 1,200-round gun and the hull-only anti-ship XLAA; a rearm restores all three", () => {
		expect(bp.armament).toBe(M06_ARMAMENT);
		validateArmament(bp.armament, true);
		expect(SortieArmament.MissileCapacity(bp.armament)).toBe(60);
		expect(SortieArmament.Regenerates(bp.armament)).toBe(false);
		expect(SortieArmament.RackTick(12, 0, 30, bp.armament)).toEqual([12, 0]);
		expect(SortieArmament.EmptyNotice(bp.armament)).toBe("missiles_spent");
		const lance = SortieArmament.NewSpecial("lance", bp.armament);
		expect(lance.finite).toBe(true);
		const refill = SortieArmament.Refill({ missiles: M06_REARM.missiles, special: M06_REARM.special, gun: M06_REARM.gun }, bp.armament, "lance");
		expect(refill.missiles).toBe(60);
		expect(refill.gunRounds).toBe(1200);
		expect(refill.special?.charges).toBe(lance.charges);
		// The anti-ship fit refuses quays and mounts and admits any hull.
		const state = SpecialWeapons.New("lance");
		expect(AntiShipRules.Activate(state, 1, "crane")).toEqual({ kind: "denied", reason: "anti_ship_hull_only" });
		expect(AntiShipRules.Activate(state, 1, "gun_mount")).toEqual({ kind: "denied", reason: "anti_ship_hull_only" });
		expect(AntiShipRules.Activate(state, 1, "cruiser")).toEqual({ kind: "ok" });
	});
	it("opens the rearm at a gate on the way home and lands southbound on the service runway", () => {
		const plan = strike.rearm!, gate = landingPose(plan.landing, 0), rollout = landingPose(plan.landing, landingDuration(plan.landing));
		expect(plan).toBe(M06_REARM);
		expect(plan.health).toBe(false); expect(plan.missiles).toBe(true); expect(plan.special).toBe(true); expect(plan.gun).toBe(true); expect(plan.weaponMenu).toBe(true);
		const runway = M06.runway, north = runway.z - runway.length / 2, south = runway.z + runway.length / 2;
		expect(math.abs(gate.x - runway.x)).toBeLessThan(1e-6);
		expect(gate.z).toBeCloseTo(north - 1980, 3);
		expect(plan.landing.touchdown.z > north && rollout.z < south).toBe(true);
		expect(plan.landing.touchdown.y).toBe(runway.y + 6);
		expect(math.sqrt((gate.x - plan.zone.x) ** 2 + (gate.y - plan.zone.y) ** 2 + (gate.z - plan.zone.z) ** 2)).toBeLessThan(1e-6);
		// The start is well outside the rearm zone, and the harbour SAMs cannot reach the approach.
		expect(math.sqrt((M06_START.x - plan.zone.x) ** 2 + (M06_START.z - plan.zone.z) ** 2) > plan.radius + 1000).toBe(true);
		for (const sam of targets.filter((t) => t.sam)) expect(math.sqrt((sam.position.x - gate.x) ** 2 + (sam.position.z - gate.z) ** 2) > SamRules.Range + plan.radius).toBe(true);
		validateRearmPhases(bp.phases, M06_AIRSPACE.hardHalfWidth);
		validateLandingPhases(bp.phases, M06_AIRSPACE.hardHalfWidth);
		expect(rejects(() => validateRearmPhases([{ ...strike, rearm: { ...plan, health: true } }], M06_AIRSPACE.hardHalfWidth))).toBe(true);
		expect(rejects(() => validateArmament({ stock: { missiles: 60 } }, true))).toBe(true);
		expect(rearmRadioDue(plan, 0, 1)).toEqual([plan.radio![0].text]);
	});
	it("limits the whole wing to one optional air kill, without player credit", () => {
		const allies = bp.allies!;
		expect(allies.count).toBe(3);
		expect(AlliedRules.MayDestroy(allies)).toBe(true);
		expect(allies.killBudget).toBe(1);
		expect(AlliedRules.Credit(allies)).toBe(false);
		const state = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring);
		expect(recordAlliedKill(state, ledger, [], allies, hulls[0].id, "ground", false, 5, hulls[0].scoreRole)).toBe(false);
		const destroyed: string[] = [];
		expect(recordAlliedKill(state, ledger, destroyed, allies, "m06_ally_victim", "air", false, 6, "raider")).toBe(true);
		expect(recordAlliedKill(state, ledger, destroyed, allies, "m06_ally_second", "air", false, 7, "raider")).toBe(false);
		expect(AlliedRules.ShotDamage(allies, destroyed.size(), false, 30)).toBe(0);
		expect(ledger.Total()).toBe(0);
	});
});

describe("Mission 6 flow: threshold, failure and settlement", () => {
	it("credits a hull and its mount once each, holds a met goal until 15:00, then wins and settles rank C", () => {
		const state = BlueprintRunner.NewState(bp, 0), ledger = new TargetScore(scoring);
		let now = 0;
		const kill = (t: TypedGroundTarget) => expect(recordScoredKill(state, ledger, t.id, "ground", false, now += 3, t.scoreRole, t.type)).toBe(true);
		const mount = mounts[0], hull = targets.find((t) => t.id === mount.parentId)!;
		kill(mount); kill(hull);
		expect(ledger.Total()).toBe(value(mount) + value(hull));
		expect(recordScoredKill(state, ledger, hull.id, "ground", false, now, hull.scoreRole)).toBe(false);
		expect(recordScoredKill(state, ledger, mount.id, "ground", false, now, mount.scoreRole)).toBe(false);
		for (const t of hulls) if (t.id !== hull.id && ledger.Total() < 3000) kill(t);
		expect(ledger.Total() >= 3000).toBe(true);
		const scored = ledger.Total();
		BlueprintRunner.Tick(state, now);
		expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(3000);
		BlueprintRunner.Tick(state, 899.9);
		expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.TimeRemaining(state)).toBeCloseTo(0.1, 3);
		BlueprintRunner.Tick(state, 900);
		expect(state.outcome).toBe("won");
		withEarlierMissions(() => {
			const c = fresh();
			for (let id = 1; id <= 5; id++) { expect(canLaunchMission(6, c.getSlots()[0])).toBe(false); expect(finish(c, id)).toBe(true); }
			expect(highestUnlocked(c.getSlots()[0])).toBe(6);
			let message: MissionFinished | undefined;
			expect(finish(c, 6, { elapsed: state.elapsed, score: ledger, phases: state.phaseIndex }, (m) => { message = m; })).toBe(true);
			expect(message?.kind).toBe("Completed");
			expect(message?.rank).toBe(scored >= 3600 ? "B" : "C");
			const record = normalizeProfile(serializeProfile({ version: 3, slots: c.getSlots() })).slots[0].missions![6];
			expect(record.completed).toBe(true);
			expect(record.bestScore).toBe(scored);
			expect(record.bestTargetScore?.total).toBe(scored);
		});
	});
	it("fails below 3,000 at 15:00 and when shot down; a short or overlong result never settles as completed", () => {
		const exact = BlueprintRunner.NewState(bp, 0); exact.score = 3000; BlueprintRunner.Tick(exact, 899);
		expect(exact.outcome).toBeUndefined(); BlueprintRunner.Tick(exact, 900); expect(exact.outcome).toBe("won");
		const low = BlueprintRunner.NewState(bp, 0); low.score = 2999; BlueprintRunner.Tick(low, 900);
		expect(low.outcome).toBe("failed"); expect(low.reason).toBe("timeout");
		const early = BlueprintRunner.NewState(bp, 0); early.score = 4000; BlueprintRunner.Tick(early, 120, 0);
		expect(early.reason).toBe("destroyed");
		withEarlierMissions(() => {
			const c = fresh();
			for (let id = 1; id <= 5; id++) finish(c, id);
			let kind: string | undefined;
			expect(finish(c, 6, { phases: 0 }, (m) => { kind = m.kind; })).toBe(true);
			expect(kind).toBe("Failed");
			expect(finish(c, 6, { elapsed: MissionCatalog.MaxMissionSeconds(6) }, (m) => { kind = m.kind; })).toBe(true);
			expect(kind).toBe("Failed");
			expect(c.getSlots()[0].missions?.[6]?.completed === true).toBe(false);
		});
	});
	it("holds the clock while a rearm runs: the runner never ticks it", () => {
		const s = BlueprintRunner.NewState(bp, 0); s.score = 3200;
		s.rearmActive = true; BlueprintRunner.Tick(s, 1200); expect(s.elapsed).toBe(0); expect(s.outcome).toBeUndefined();
		s.rearmActive = undefined; BlueprintRunner.Tick(s, 900); expect(s.outcome).toBe("won");
	});
});

describe("Mission 6 unlock", () => {
	it("unlocks only after mission 5, in order, and refuses forged, skipped or locked results", () => {
		let notified = 0;
		// Without mission 5 released, mission 6 can be neither launched nor recorded.
		const before = MISSIONS[4].available;
		MISSIONS[4].available = false;
		const [ok, err] = pcall(() => {
			const c = fresh();
			for (let id = 1; id <= 4; id++) if (MissionCatalog.Available(id)) finish(c, id);
			expect(canLaunchMission(6, c.getSlots()[0])).toBe(false);
			expect(finish(c, 6, {}, () => notified++)).toBe(false);
		});
		MISSIONS[4].available = before;
		if (!ok) error(err, 0);
		withEarlierMissions(() => {
			const d = fresh();
			expect(finish(d, 6, {}, () => notified++)).toBe(false);
			for (let id = 1; id <= 4; id++) finish(d, id);
			expect(canLaunchMission(6, d.getSlots()[0])).toBe(false);
			expect(finish(d, 6, {}, () => notified++)).toBe(false);
			finish(d, 5);
			expect(canLaunchMission(6, d.getSlots()[0])).toBe(true);
			expect(canLaunchMission(7, d.getSlots()[0])).toBe(false);
			// A forged slot claiming every mission still stops at mission 11, the last available one.
			const forged = d.getSlots()[0];
			forged.missions ??= {};
			for (let id = 1; id <= 18; id++) forged.missions[id] = { completed: true };
			expect(highestUnlocked(forged)).toBe(18);
			expect(canLaunchMission(18,forged)).toBe(true);expect(canLaunchMission(19,forged)).toBe(false);
			expect(canLaunchMission(7, forged)).toBe(true); expect(canLaunchMission(8, forged)).toBe(true); expect(canLaunchMission(9, forged)).toBe(true);
		});
		expect(notified).toBe(0);
	});
});
