import { describe, expect, it } from "@rbxts/jest-globals";
import { activateResultNext, awaitResultSettlement, nextResultMission } from "../shared/ResultContinuation";
import { CampaignCoordinator, completeMission, resolveMissionRequest } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { MissionCatalog } from "../shared/MissionCatalog";
import { LaunchLoading } from "../shared/LaunchLoading";

describe("Results continuation", () => {
	it("launches every next mission 1–17 with stale client slots, including while cloud save remains pending", () => {
		const c = new CampaignCoordinator("next", { load() { return undefined; }, update(_key, transform) { return transform(undefined); } },
			{ now: () => 1000, defer: () => undefined });
		c.load();
		const stale = c.getSlots()[0];
		expect(canLaunchMission(2, stale)).toBe(false);
		for (let id = 1; id <= 17; id++) {
			const bp = MissionCatalog.Get(id);
			let notified = false;
			expect(completeMission(c, 1, id, true, {
				slot: 1, missionId: id, kills: MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp),
				groundKills: MissionCatalog.RequiredGroundKills(bp), completedPhases: MissionCatalog.TotalPhases(bp), elapsed: 100,
			}, () => { notified = true; }, 0)).toBe(true);
			expect(notified).toBe(true);
			expect(c.hasPendingSave()).toBe(true);
			let requested = 0;
			const loading = new LaunchLoading();
			activateResultNext(true, id, (mission) => {
				requested = mission;
				expect(loading.Begin()).toBe(true);
			});
			expect(requested).toBe(id + 1);
			expect(loading.Screen()).toBe("loading");
			// This is the authoritative resolver used by CampaignService.StartMission,
			// with fresh coordinator state rather than the stale UI snapshot.
			const [accepted, problem] = resolveMissionRequest(c.getSlots()[0], requested);
			expect(accepted).toBe(id + 1);
			expect(problem).toBeUndefined();
		}
		expect(canLaunchMission(2, stale)).toBe(false);
	});

	it("accepts Next during an actual cloud update with the completion already committed", () => {
		let write: (() => void) | undefined;
		let launched = 0;
		const c = new CampaignCoordinator("writing", {
			load() { return undefined; },
			update(_key, transform) {
				expect(c.hasPendingSave()).toBe(true);
				activateResultNext(true, 1, (id) => {
					const [accepted] = resolveMissionRequest(c.getSlots()[0], id);
					launched = accepted ?? 0;
				});
				return transform(undefined);
			},
		}, { now: () => 1000, defer: (callback) => { write = callback; } });
		c.load();
		const bp = MissionCatalog.Get(1);
		completeMission(c, 1, 1, true, {
			slot: 1, missionId: 1, kills: MissionCatalog.RequiredAirKills(bp),
			groundKills: 0, completedPhases: MissionCatalog.TotalPhases(bp), elapsed: 100,
		}, () => undefined, 0);
		expect(write).toBeDefined();
		write!();
		expect(launched).toBe(2);
		expect(c.hasPendingSave()).toBe(false);
	});

	it("waits for the completion session to release before the server acceptance check", () => {
		let clock = 0, completing = true, activeSession = true;
		const accepted = awaitResultSettlement({
			completing: () => completing, present: () => true, now: () => clock,
			wait: () => { clock++; if (clock === 2) { completing = false; activeSession = false; } },
		});
		expect(accepted).toBe(true);
		expect(activeSession).toBe(false);
		expect(clock).toBe(2);
	});

	it("bounds a stalled settlement and refuses a departed player without launching", () => {
		let clock = 0;
		expect(awaitResultSettlement({ completing: () => true, present: () => true, now: () => clock, wait: () => { clock++; } }, 3)).toBe(false);
		expect(clock).toBe(3);
		expect(awaitResultSettlement({ completing: () => false, present: () => false, now: () => clock, wait: () => undefined })).toBe(false);
	});

	it("never wires Next for a failure or the mission 18 campaign completion", () => {
		let calls = 0;
		activateResultNext(true, 18, () => { calls++; });
		activateResultNext(false, 1, () => { calls++; });
		expect(nextResultMission(true, 18)).toBeUndefined();
		expect(calls).toBe(0);
	});

	it("still refuses a forged locked next mission on the server", () => {
		const c = new CampaignCoordinator("locked", undefined, { defer: () => undefined });
		c.load();
		const [accepted, problem] = resolveMissionRequest(c.getSlots()[0], 2);
		expect(accepted).toBeUndefined();
		expect(problem).toBeDefined();
	});
});
