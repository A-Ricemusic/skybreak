import { describe, expect, it } from "@rbxts/jest-globals";
import { launchWithChapter } from "../shared/ChapterLaunch";
import { activateResultNext } from "../shared/ResultContinuation";
import { CampaignCoordinator, completeMission } from "../server/CampaignRepository";
import { MissionCatalog } from "../shared/MissionCatalog";
import { LaunchLoading } from "../shared/LaunchLoading";

function campaignThrough(last: number): CampaignCoordinator {
	const c = new CampaignCoordinator("chapters", undefined, { defer: () => undefined });
	c.load();
	for (let id = 1; id <= last; id++) {
		const bp = MissionCatalog.Get(id);
		completeMission(c, 1, id, true, { slot: 1, missionId: id,
			kills: MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp),
			groundKills: MissionCatalog.RequiredGroundKills(bp), completedPhases: MissionCatalog.TotalPhases(bp), elapsed: 100,
		}, () => undefined, 0);
	}
	return c;
}

describe("Chapter-aware results continuation", () => {
	for (const id of [1, 17]) for (const skip of [false, true]) {
		it(`M${id} Next plays chapter ${id} before loading M${id + 1} (${skip ? "skip" : "natural end"})`, () => {
			const c = campaignThrough(id);
			const loading = new LaunchLoading();
			let chapter = -1, launches = 0;
			let finish: (() => void) | undefined;
			activateResultNext(true, id, (mission) => launchWithChapter(mission, undefined, false, false, (played) => {
				launches++;
				expect(loading.Begin()).toBe(true);
				expect(mission).toBe(id + 1);
				expect(c.acknowledgeChapter(1, mission, played)).toBe(true);
			}, (nextChapter, callback) => { chapter = nextChapter; finish = callback; }));
			expect(chapter).toBe(id);
			expect(launches).toBe(0);
			expect(loading.Pending()).toBe(false);
			expect(c.getSlots()[0].cutscenesSeen?.includes(id) ?? false).toBe(false);
			// RelayCinematic routes both Skip and natural completion to this onFinish callback.
			finish!(); finish!();
			expect(launches).toBe(1);
			expect(loading.Screen()).toBe("loading");
			expect(c.getSlots()[0].cutscenesSeen?.includes(id)).toBe(true);
		});
	}
	it("replay of a seen chapter launches directly without claiming another playback", () => {
		let launches = 0, chapters = 0;
		activateResultNext(true, 1, (mission) => launchWithChapter(mission, [1], true, false,
			(played) => { launches++; expect(played).toBeUndefined(); }, () => { chapters++; }));
		expect(launches).toBe(1); expect(chapters).toBe(0);
	});
	it("launch without playback and cancellation leave the chapter unseen", () => {
		const c = campaignThrough(1);
		c.recordMissionStarted(1, 2);
		expect(c.acknowledgeChapter(1, 2, undefined)).toBe(false);
		launchWithChapter(2, undefined, false, false, () => { error("cancel must not launch"); }, () => undefined);
		expect(c.getSlots()[0].cutscenesSeen?.includes(1) ?? false).toBe(false);
	});
	it("rejects forged chapter progress and records the finale only after acknowledgement", () => {
		const c = campaignThrough(1);
		expect(c.acknowledgeChapter(1, 18, 17)).toBe(false);
		expect(c.acknowledgeChapter(1, 2, 12)).toBe(false);
		expect(c.acknowledgeChapter(1, 18, 18)).toBe(false);
		const won = campaignThrough(18);
		expect(won.getSlots()[0].cutscenesSeen?.includes(18) ?? false).toBe(false);
		expect(won.acknowledgeChapter(1, 18, 18)).toBe(true);
	});
});
