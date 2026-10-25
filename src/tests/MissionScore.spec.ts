import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { MissionScore, ScoreInput } from "../shared/MissionScore";
import { CampaignCoordinator, completeMission, mergeProfiles, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { MissionFinished } from "../shared/Types";

const perfect: ScoreInput = { won: true, airKills: 4, groundKills: 1, elapsed: 60, par: 120, missilesFired: 8, missileHits: 8, damageTaken: 0 };

function coordinator(): CampaignCoordinator {
	const c = new CampaignCoordinator("offline-score", undefined, { now: () => 1000, defer: () => undefined });
	c.load();
	return c;
}

function finishMission3(c: CampaignCoordinator, extra: { elapsed: number; missilesFired: number; missileHits: number; damageTaken: number }): MissionFinished {
	const bp = MissionCatalog.Get(3);
	let message: MissionFinished | undefined;
	completeMission(c, 1, 3, true, {
		slot: 1, missionId: 3, kills: MissionCatalog.RequiredAirKills(bp), groundKills: 0, completedPhases: bp.phases.size(), ...extra,
	}, (m) => message = m, 0);
	return message!;
}

describe("MissionScore", () => {
	it("ranks a fast, accurate, undamaged win S with kill and rating points", () => {
		const result = MissionScore.Compute(perfect);
		expect(result.rank).toBe("S");
		expect(result.rating).toBe(100);
		expect(result.score).toBe(4 * 100 + 150 + 100 * 50);
	});

	it("steps down through A, B, C and D as time, accuracy and damage worsen", () => {
		expect(MissionScore.Compute({ ...perfect, missileHits: 4 }).rank).toBe("A"); // 40 + 15 + 30 = 85
		expect(MissionScore.Compute({ ...perfect, missileHits: 4, damageTaken: 50 }).rank).toBe("B"); // 70
		expect(MissionScore.Compute({ ...perfect, elapsed: 210, missileHits: 4, damageTaken: 50 }).rank).toBe("C"); // 20 + 15 + 15 = 50
		expect(MissionScore.Compute({ ...perfect, elapsed: 300, missileHits: 0, damageTaken: 90 }).rank).toBe("D");
	});

	it("always ranks a failure D and scores only its kills", () => {
		const result = MissionScore.Compute({ ...perfect, won: false });
		expect(result.rank).toBe("D");
		expect(result.score).toBe(550);
	});

	it("is monotonic: finishing faster, hitting more or taking less damage never lowers the score", () => {
		let previous = -1;
		for (let elapsed = 400; elapsed >= 40; elapsed -= 20) {
			const score = MissionScore.Compute({ ...perfect, elapsed }).score;
			expect(score >= previous).toBe(true);
			previous = score;
		}
		expect(MissionScore.Compute({ ...perfect, missileHits: 7 }).score < MissionScore.Compute(perfect).score).toBe(true);
		expect(MissionScore.Compute({ ...perfect, damageTaken: 10 }).score < MissionScore.Compute(perfect).score).toBe(true);
	});

	it("does not penalise accuracy when nothing was fired and sanitises hostile input", () => {
		expect(MissionScore.Compute({ ...perfect, missilesFired: 0, missileHits: 0 }).accuracy).toBe(1);
		const odd = MissionScore.Compute({ won: true, airKills: -3, groundKills: 0 / 0, elapsed: math.huge, par: 0, missilesFired: 2, missileHits: 9, damageTaken: 500 });
		expect(odd.accuracy).toBe(1);
		expect(odd.survival).toBe(0);
		expect(odd.score >= 0).toBe(true);
		expect(MissionScore.IsRank(odd.rank)).toBe(true);
	});

	it("authors a positive, 5-second-rounded par and a failure outcome for every mission", () => {
		for (const bp of MISSIONS) {
			const par = MissionScore.ParSeconds(bp);
			expect(par > 20 && par < 600).toBe(true);
			expect(par % 5).toBe(0);
			expect(bp.failure.size() > 0).toBe(true);
			expect(bp.failure).never.toBe(bp.debrief);
		}
	});

	it("picks the better rank", () => {
		expect(MissionScore.BetterRank("B", "S")).toBe("S");
		expect(MissionScore.BetterRank("A", "C")).toBe("A");
		expect(MissionScore.BetterRank(undefined, "D")).toBe("D");
		expect(MissionScore.BetterRank(undefined, undefined)).toBeUndefined();
	});
});

describe("Mission debrief results", () => {
	it("sends the server score and flight record with the result and saves bests monotonically", () => {
		const c = coordinator();
		const par = MissionScore.ParSeconds(MissionCatalog.Get(3));
		const first = finishMission3(c, { elapsed: par * 2, missilesFired: 10, missileHits: 5, damageTaken: 40 });
		expect(first.kind).toBe("Completed");
		expect(first.par).toBe(par);
		expect(first.missilesFired).toBe(10);
		expect(first.missileHits).toBe(5);
		expect(first.newBestScore).toBe(true);
		expect(first.newBestRank).toBe(true);
		expect(first.bestScore).toBe(first.score);

		const better = finishMission3(c, { elapsed: par - 5, missilesFired: 4, missileHits: 4, damageTaken: 0 });
		expect(better.rank).toBe("S");
		expect(better.newBestScore).toBe(true);
		expect(better.newBestRank).toBe(true);

		const worse = finishMission3(c, { elapsed: par * 2, missilesFired: 10, missileHits: 2, damageTaken: 80 });
		expect(worse.newBestScore).toBe(false);
		expect(worse.newBestRank).toBe(false);
		expect(worse.bestScore).toBe(better.score);
		expect(worse.bestRank).toBe("S");

		// Bests survive a save round trip and merge by max with an older stored copy.
		const saved = normalizeProfile(serializeProfile({ version: 3, slots: c.getSlots() }));
		expect(saved.slots[0].missions?.[3]?.bestScore).toBe(better.score);
		expect(saved.slots[0].missions?.[3]?.bestRank).toBe("S");
		const older = { version: 3, slots: [{ ...saved.slots[0], missions: { 3: { completed: true, bestTime: 50, bestScore: 10, bestRank: "C" } } }] };
		const merged = mergeProfiles(older, saved);
		expect(merged.slots[0].missions?.[3]?.bestScore).toBe(better.score);
		expect(merged.slots[0].missions?.[3]?.bestRank).toBe("S");
		expect(merged.slots[0].missions?.[3]?.bestTime).toBe(50);
	});

	it("does not record a best for a failed sortie", () => {
		const c = coordinator();
		let message: MissionFinished | undefined;
		completeMission(c, 1, 3, false, { slot: 1, missionId: 3, kills: 1, groundKills: 0, completedPhases: 1, elapsed: 90, reason: "destroyed" }, (m) => message = m, 0);
		expect(message!.kind).toBe("Failed");
		expect(message!.rank).toBe("D");
		expect(message!.completedPhases).toBe(1);
		expect(message!.newBestScore).toBeUndefined();
		expect(c.getSlots()[0].missions?.[3]?.bestScore).toBeUndefined();
	});
});
