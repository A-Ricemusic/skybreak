import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, completeMission, mergeProfiles, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { recordScoredKill } from "../server/SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { EncounterRole, MissionScoringPolicy } from "../shared/MissionPolicy";
import { MissionScore } from "../shared/MissionScore";
import { targetScoreLines } from "../shared/OutcomePoints";
import { TargetScore, targetScoreStats, readTargetScore } from "../shared/TargetScore";
import { MissionFinished, MissionStats } from "../shared/Types";
import { getMenuLayout } from "../shared/UILayout";
import { LEGACY_SCORING_CAPTURE } from "./LegacyScoringCapture";

// Deterministic, complete table serialization, independent of Lua hash iteration order.
function canonical(value: unknown): string {
	if (!typeIs(value, "table")) return tostring(value);
	const entries: { key: string; value: unknown }[] = [];
	for (const [key, item] of pairs(value)) entries.push({ key: tostring(key), value: item });
	entries.sort((a, b) => a.key < b.key);
	return `{${entries.map((entry) => `${entry.key}=${canonical(entry.value)}`).join(",")}}`;
}
function coordinator(): CampaignCoordinator {
	const c = new CampaignCoordinator("scoring-test", undefined, { now: () => 1000, defer: () => undefined });
	c.load();
	return c;
}
function fixedStats(id: number): MissionStats {
	const bp = MissionCatalog.Get(id);
	return { slot: 1, missionId: id, kills: MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp),
		groundKills: MissionCatalog.RequiredGroundKills(bp), elapsed: 120, completedPhases: MissionCatalog.TotalPhases(bp),
		optionalKills: 2, missilesFired: 10, missileHits: 8, damageTaken: 15, lowestHealth: 85, evades: 2, difficulty: "normal" };
}
const points: MissionScoringPolicy = { basis: "points", points: { bandit: 100, raider: 60, courier: 80, ace: 240, ground: 150 }, rank: { S: 400, A: 300, B: 200, C: 100 } };

describe("Authoritative sortie scoring", () => {
	it("settles a 16-minute update-clock win, preserves true timeouts and rejects elapsed beyond the effective maximum", () => {
		const bp = MissionCatalog.Get(3);
		const oldPhases = bp.phases, oldCountdown = bp.countdownSeconds, oldAvailable = bp.available;
		bp.available = true; bp.countdownSeconds = 600;
		bp.phases = [{kind:"required_air",label:"First",count:1}, {kind:"required_air",label:"Update",count:1,
			update:{objective:"Continue",radio:["New orders"],countdownSeconds:900}}];
		const [ok, message] = pcall(() => {
			// Latest possible reset at the 10:00 boundary extends the bound to 25:00.
			expect(MissionCatalog.MaxMissionSeconds(3)).toBe(1500);
			const settle = (won: boolean, elapsed: number, reason?: "timeout") => {
				const c = coordinator(); let packet: MissionFinished | undefined;
				expect(completeMission(c,1,3,won,{...fixedStats(3),elapsed,reason},m=>{packet=m;},0)).toBe(true);
				return {packet,saved:c.getSlots()[0].missions?.[3]};
			};
			// Enter immediately before the 10:00 timeout boundary, then finish at 16:00.
			const run = BlueprintRunner.NewState(bp,0);
			BlueprintRunner.RecordKill(run,"first","air",true,599.99);
			expect(BlueprintRunner.TimeRemaining(run)).toBe(900);
			BlueprintRunner.RecordKill(run,"last","air",true,960);
			expect(run.outcome).toBe("won");
			const win = settle(run.outcome === "won",run.elapsed);
			expect(win.packet?.kind).toBe("Completed");expect(win.packet?.reason).toBeUndefined();expect(win.saved?.completed).toBe(true);
			// Early reset can time out before the maximum; the runner's failure still wins.
			const expired = BlueprintRunner.NewState(bp,0);
			BlueprintRunner.RecordKill(expired,"first","air",true,100);
			BlueprintRunner.Tick(expired,1000);
			expect(expired.outcome).toBe("failed");expect(expired.reason).toBe("timeout");
			const timeout = settle(expired.outcome === "won",expired.elapsed,"timeout");
			expect(timeout.packet?.kind).toBe("Failed");expect(timeout.packet?.reason).toBe("timeout");
			for (const elapsed of [1500,1501]) {
				const forged = settle(true,elapsed);
				expect(forged.packet?.kind).toBe("Failed");expect(forged.packet?.reason).toBe("timeout");expect(forged.saved?.completed === true).toBe(false);
			}
		});
		bp.phases=oldPhases; bp.countdownSeconds=oldCountdown; bp.available=oldAvailable;
		if (!ok) error(tostring(message));
		for (const id of [0,1]) expect(MissionCatalog.MaxMissionSeconds(id)).toBe(MissionCatalog.CountdownSeconds(id));
	});


	it("admits optional kills once, rejects duplicate/invalid events and settles the exact server ledger", () => {
		const bp = MissionCatalog.Get(3);
		const authored = { ...bp, phases: [{ ...bp.phases[0], kind: "required_air" as const, count: 10, optionalRaiders: 3 }] };
		const state = BlueprintRunner.NewState(authored, 0);
		const ledger = new TargetScore(points);
		expect(recordScoredKill(state, ledger, "optional", "air", false, 1, "raider")).toBe(true);
		expect(recordScoredKill(state, ledger, "optional", "air", false, 1, "raider")).toBe(false);
		expect(recordScoredKill(state, ledger, "invalid", "ground", true, 1)).toBe(false);
		for (const role of ["bandit", "courier", "ace"] as EncounterRole[]) {
			expect(recordScoredKill(state, ledger, role, "air", true, 1, role)).toBe(true);
		}
		expect(ledger.Total()).toBe(480);
		expect(ledger.Snapshot().kills.raider).toBe(1);
		expect(state.optionalAirKills).toBe(1);
		// Opt in only for the duration of this synchronous test; production catalog remains rating.
		const available = bp.available; bp.available = true;
		const old = bp.scoring;
		bp.scoring = points;
		const [ok, message] = pcall(() => {
			const c = coordinator();
			const stats = { ...fixedStats(3), ...targetScoreStats(ledger, points) };
			let packet: MissionFinished | undefined;
			expect(completeMission(c, 1, 3, true, stats, (message) => { packet = message; }, 0)).toBe(true);
			expect(packet?.score).toBe(ledger.Total());
			expect(packet?.rank).toBe("S");
			expect(packet?.targetScore).toEqual(ledger.Snapshot());
			const saved = serializeProfile({ version: 3, slots: c.getSlots() });
			const loaded = normalizeProfile(saved).slots[0].missions?.[3];
			expect(loaded?.bestScore).toBe(480);
			expect(loaded?.bestTargetScore).toEqual(ledger.Snapshot());
			expect(loaded?.bestRank).toBe("S");
			// Lower replay/failure cannot replace the existing best.
			completeMission(c, 1, 3, false, { ...stats, targetScore: new TargetScore(points).Snapshot() }, () => undefined, 0);
			expect(c.getSlots()[0].missions?.[3]?.bestScore).toBe(480);
			const fallback = MissionScore.Compute({ won: true, airKills: 3, groundKills: 0, elapsed: 120, par: 220, missilesFired: 0, missileHits: 0, damageTaken: 0, targetPoints: packet?.targetScore?.total }, points);
			expect(fallback.score).toBe(packet?.score);
			expect(fallback.rank).toBe(packet?.rank);
		});
		bp.scoring = old; bp.available = available;
		if (!ok) error(tostring(message));
	});

	it("maps ground and unannotated air/ace kills without guessing optional roles", () => {
		const bp = MissionCatalog.Get(3);
		for (const kind of ["ground", "air", "ace"] as const) {
			const phaseKind = kind === "ground" ? "required_ground" : kind === "ace" ? "ace" : "required_air";
			const state = BlueprintRunner.NewState({ ...bp, phases: [{ ...bp.phases[0], kind: phaseKind, count: 3 }] }, 0);
			const ledger = new TargetScore(points);
			expect(recordScoredKill(state, ledger, kind, kind, true, 1)).toBe(true);
			expect(ledger.RoleKills(kind === "air" ? "bandit" : kind)).toBe(1);
		}
	});

	it("keeps the breakdown paired with the winning score through cloud merge and lower replays", () => {
		const a = coordinator(), b = coordinator();
		const low = new TargetScore(points), high = new TargetScore(points);
		low.RecordKill("bandit", "bandit");
		high.RecordKill("ace", "ace");
		a.recordMissionResult(1, 3, true, 1, 120, { score: low.Total(), rank: "C", targetScore: low.Snapshot() });
		b.recordMissionResult(1, 3, true, 1, 120, { score: high.Total(), rank: "B", targetScore: high.Snapshot() });
		const left = serializeProfile({ version: 3, slots: a.getSlots() });
		const right = serializeProfile({ version: 3, slots: b.getSlots() });
		for (const merged of [mergeProfiles(left, right), mergeProfiles(right, left)]) {
			expect(merged.slots[0].missions?.[3]?.bestScore).toBe(240);
			expect(merged.slots[0].missions?.[3]?.bestTargetScore).toEqual(high.Snapshot());
		}
		b.recordMissionResult(1, 3, true, 1, 100, { score: low.Total(), rank: "C", targetScore: low.Snapshot() });
		expect(b.getSlots()[0].missions?.[3]?.bestTargetScore).toEqual(high.Snapshot());
	});

	it("ignores malformed saved breakdowns and detaches valid saved tables", () => {
		expect(readTargetScore({ total: 100, kills: { bandit: 1 }, points: { bandit: 50 } }, 100)).toBeUndefined();
		expect(readTargetScore({ total: 100, kills: { bandit: -1 }, points: { bandit: 100 } }, 100)).toBeUndefined();
		expect(readTargetScore({ total: math.huge, kills: {}, points: {} })).toBeUndefined();
		const ledger = new TargetScore(points);
		ledger.RecordKill("bandit", "bandit");
		const source = ledger.Snapshot();
		const saved = readTargetScore(source, 100)!;
		source.kills.bandit = 99;
		expect(saved.kills.bandit).toBe(1);
	});

	it("keeps all seven role rows inside narrow scrolling results without changing legacy rows", () => {
		expect(targetScoreLines()).toEqual([]);
		const ledger = new TargetScore(points);
		for (const role of ["bandit", "raider", "courier", "ace", "ground", "bomber", "escort"] as EncounterRole[]) ledger.RecordKill(role, role);
		const rows = targetScoreLines(ledger.Snapshot());
		expect(rows.size()).toBe(7);
		expect(rows[1]).toEqual({ key: "Target_raider", label: "RAIDER ×1", value: "60" });
		for (const [width, height] of [[320, 182], [320, 568], [390, 705], [568, 320]]) {
			const menu = getMenuLayout(width, height);
			const rowWidth = menu.panel.width - 16;
			const size = menu.compact ? 11 : 13;
			for (const row of rows) {
				// Conservative mono glyph width; matches DebriefRow's 62/38 split.
				expect(row.label.size() * size * 0.65).toBeLessThanOrEqual(rowWidth * 0.62);
				expect(row.value.size() * size * 0.65).toBeLessThanOrEqual(rowWidth * 0.38);
			}
			expect(menu.panel.height - (menu.compact ? 50 : 56)).toBeGreaterThan(0);
		}
	});
});
