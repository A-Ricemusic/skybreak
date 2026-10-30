import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, completeMission, normalizeProfile, normalizeSlot, serializeProfile } from "../server/CampaignRepository";
import { MissionCatalog } from "../shared/MissionCatalog";
import { TargetScore, TargetScoreSnapshot } from "../shared/TargetScore";
import { MissionFinished } from "../shared/Types";

function fresh() {
	const coordinator = new CampaignCoordinator("completion-regression", undefined, { now: () => 1000, defer: () => undefined });
	coordinator.load();
	return coordinator;
}
function breakdown(extraEscort = false): TargetScoreSnapshot {
	const ledger = new TargetScore(MissionCatalog.Scoring(1));
	for (let i = 0; i < 6; i++) ledger.RecordKill(`b${i}`, "bomber");
	if (extraEscort) ledger.RecordKill("escort", "escort");
	return ledger.Snapshot();
}
function finish(c: CampaignCoordinator, missionId: number, score?: TargetScoreSnapshot, notify: (message: MissionFinished) => void = () => undefined) {
	const bp = MissionCatalog.Get(missionId);
	return completeMission(c, 1, missionId, true, {
		slot: 1, missionId, kills: MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp),
		groundKills: MissionCatalog.RequiredGroundKills(bp), completedPhases: MissionCatalog.TotalPhases(bp),
		elapsed: 100, targetScore: score,
	}, notify, 0);
}
function roundTrip(c: CampaignCoordinator) {
	return normalizeProfile(serializeProfile({ version: 3, slots: c.getSlots() })).slots[0];
}

describe("Campaign completion persistence (offline and Roblox Jest)", () => {
	it("retains mission 1's entire saved record after legitimate mission 2 completion and serialization", () => {
		const c = fresh();
		expect(finish(c, 1, breakdown())).toBe(true);
		const before = c.getSlots()[0].missions![1];
		expect(before.bestTargetScore).toEqual(breakdown());
		let kind: string | undefined;
		expect(finish(c, 2, undefined, (message) => { kind = message.kind; })).toBe(true);
		expect(kind).toBe("Completed");
		expect(c.getSlots()[0].missions![2].completed).toBe(true);
		expect(c.getSlots()[0].missions![1]).toEqual(before);
		expect(roundTrip(c).missions![1]).toEqual(before);
	});

	for (const improves of [false, true]) it(`mission 1 replay after mission 2 ${improves ? "updates" : "keeps"} its best breakdown`, () => {
		const c = fresh();
		finish(c, 1, breakdown());
		finish(c, 2);
		const replay = breakdown(improves);
		let kind: string | undefined;
		expect(finish(c, 1, replay, (message) => { kind = message.kind; })).toBe(true);
		expect(kind).toBe("Completed");
		expect(c.getSlots()[0].missions![1].bestTargetScore).toEqual(replay);
		expect(c.getSlots()[0].missions![1].bestScore).toBe(replay.total);
		expect(roundTrip(c).missions![1].bestTargetScore).toEqual(replay);
	});

	for (const completed of [false, true]) it(`normalizes a loaded mission 1 record (completed=${completed}) without losing its bests`, () => {
		const record = { completed, timeVersion: MissionCatalog.TimeVersion(1), bestTime: 100,
			firstCompletedAt: 1000, bestScore: 600, bestRank: "B", bestTargetScore: breakdown() };
		const loaded = normalizeSlot({ missions: { "1": record, "2": { completed: true } } }, 1);
		expect(loaded.missions![1]).toEqual({ ...record, completed: true });
		expect(normalizeSlot(loaded, 1).missions![1]).toEqual(loaded.missions![1]);
	});

	it("rejects locked mission 2 and mission 3 results without recording or notifying", () => {
		const c = fresh();
		let notifications = 0;
		const notify = () => { notifications++; };
		const before = c.getSlots()[0];
		expect(finish(c, 2, undefined, notify)).toBe(false);
		expect(finish(c, 3, undefined, notify)).toBe(false);
		expect(c.getSlots()[0]).toEqual(before);
		// Mission 1 opens mission 2 only: a mission 3 result is still forged.
		finish(c, 1, breakdown());
		const unlocked = c.getSlots()[0];
		expect(finish(c, 3, undefined, notify)).toBe(false);
		expect(c.getSlots()[0]).toEqual(unlocked);
		expect(notifications).toBe(0);
		expect(roundTrip(c).missions?.[3]).toBeUndefined();
	});

	it("accepts mission 3 after mission 2 and keeps both earlier records", () => {
		const c = fresh();
		finish(c, 1, breakdown());
		finish(c, 2);
		const earlier = { ...c.getSlots()[0].missions! };
		let kind: string | undefined;
		expect(finish(c, 3, undefined, (message) => { kind = message.kind; })).toBe(true);
		expect(kind).toBe("Completed");
		expect(c.getSlots()[0].missions![3].completed).toBe(true);
		expect(c.getSlots()[0].missions![1]).toEqual(earlier[1]);
		expect(c.getSlots()[0].missions![2]).toEqual(earlier[2]);
		expect(roundTrip(c).missions![3].completed).toBe(true);
	});
});
