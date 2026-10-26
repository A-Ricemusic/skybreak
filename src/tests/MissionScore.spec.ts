import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { MissionScore, ScoreInput } from "../shared/MissionScore";
import { CampaignCoordinator, completeMission, mergeProfiles, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { MissionFinished } from "../shared/Types";
import { GameConfig } from "../shared/GameConfig";

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
			expect(par > 20 && par < GameConfig.Campaign.MissionTimeLimit).toBe(true);
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
		const older = { version: 3, slots: [{ ...saved.slots[0], missions: { 3: { completed: true, bestTime: 50, timeVersion: MissionCatalog.TimeVersion(3), bestScore: 10, bestRank: "C" } } }] };
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

describe("MissionScore round-2 calibration", () => {
	it("needs 85% accuracy for an S: a fast, unhurt run carried by speed alone tops out at A", () => {
		// 40 time + 30 x 0.8 accuracy + 30 survival = 94, which used to be an S.
		const fastWild = MissionScore.Compute({ ...perfect, missilesFired: 10, missileHits: 8 });
		expect(fastWild.rating >= 90).toBe(true);
		expect(fastWild.rank).toBe("A");
		const fastTidy = MissionScore.Compute({ ...perfect, missilesFired: 20, missileHits: 17 });
		expect(fastTidy.accuracy >= MissionScore.SAccuracy).toBe(true);
		expect(fastTidy.rank).toBe("S");
		// A sortie with no shots fired is not held to the accuracy bar.
		expect(MissionScore.Compute({ ...perfect, missilesFired: 0, missileHits: 0 }).rank).toBe("S");
	});
	it("sets par below the average-phone estimates while allowing objective handoffs", () => {
		const par = (id: number) => MissionScore.ParSeconds(MissionCatalog.Get(id));
		for (const bp of MISSIONS) {
			const value = par(bp.id);
			if (bp.id <= 2) expect(value >= 90 && value <= 240).toBe(true);
			else if (bp.act === 1) expect(value >= 140 && value <= 300).toBe(true);
			else expect(value >= 200 && value <= 480).toBe(true);
		}
		// Historical scripted times predate the added objective work and remain shorter than the new good-run pars.
		const qaSeconds = [14.5, 36.3, 28.5, 33.1, 56.4, 37.1, 32.9, 61.8, 53.5, 34.5, 37, 66.6, 47, 38.6, 50.9, 34, 46.9, 55.5, 49, 86.8, 33.6, 70.9, 78.5, 42.4, 102.8, 64.3, 99.6];
		let longer = 0;
		for (let index = 0; index < qaSeconds.size(); index++) if (par(index + 1) > qaSeconds[index] * 2) longer += 1;
		expect(longer >= 24).toBe(true);
		// Act finales run longer than their act's average sortie.
		for (const [finale, first, last] of [[9, 3, 8], [18, 10, 17], [27, 19, 26]] as [number, number, number][]) {
			let sum = 0;
			for (let id = first; id <= last; id++) sum += par(id);
			expect(par(finale) >= sum / (last - first + 1)).toBe(true);
		}
	});
	it("keeps every par well inside the sortie deadline", () => {
		for (const bp of MISSIONS) expect(MissionScore.ParSeconds(bp) * 1.6 < GameConfig.Campaign.MissionTimeLimit).toBe(true);
	});
});
