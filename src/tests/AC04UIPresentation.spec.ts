import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04MissionData } from "../shared/AC04MissionData";
import { ac04BlankSlot, type AC04Slot } from "../shared/AC04Progress";
import { AC04WorldPlanner } from "../shared/AC04WorldData";
import type { MissionFinished } from "../shared/Types";
import { ac04BriefingMap, ac04ForceCount, ac04InitialGroup, ac04ObjectiveText } from "../shared/ac04/ui/AC04BriefingPresentation";
import { ac04AircraftRows, ac04ChaptersAfterSuccess, ac04ContinueRecord, ac04CycleAircraft, ac04MissionRows, ac04PendingChapters, ac04RecordSummary, ac04StoryArchive } from "../shared/ac04/ui/AC04RecordSummary";
import { AC04_GENERIC_FAILURE, ac04RequestErrorText } from "../shared/ac04/ui/AC04RequestErrors";
import { ac04Debrief } from "../shared/ac04/ui/AC04ResultPresentation";
import { ac04Clock, ac04Distance, ac04Pad, ac04SplitRadio, ac04Thousands } from "../shared/ac04/ui/AC04UIFormat";

function completed(slot: AC04Slot, ...ids: number[]): AC04Slot {
	for (const id of ids) slot.missions[id] = { completed: true, bestScore: 100 * id, bestTime: 60 + id };
	return slot;
}

describe("AC04 briefing map from actual mission data", () => {
	for (const id of [1, 3, 6, 11, 13, 18]) {
		it(`mission ${id}: draws only opening forces inside the area and frames the start and return line`, () => {
			const mission = AC04MissionData.Get(id), layout = AC04WorldPlanner.Layout(id);
			const map = ac04BriefingMap(mission, layout, AC04WorldPlanner.UnitPosition);
			for (const marker of map.markers) {
				const group = mission.roster.find((g) => g.id === marker.id)!;
				expect(ac04InitialGroup(group)).toBe(true);
				expect(marker.points.size()).toBe(group.count);
				for (const point of marker.points) {
					expect(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1).toBe(true);
				}
			}
			for (const group of mission.roster) {
				if (!ac04InitialGroup(group)) expect(map.markers.some((marker) => marker.id === group.id)).toBe(false);
			}
			const detail = map.detail;
			expect(detail.x >= 0 && detail.y >= 0 && detail.x + detail.size <= 1.0001 && detail.y + detail.size <= 1.0001).toBe(true);
			expect(map.spawn.x >= detail.x && map.spawn.x <= detail.x + detail.size).toBe(true);
			if (map.returnY !== undefined) expect(map.returnY >= detail.y && map.returnY <= detail.y + detail.size).toBe(true);
			const forces = ac04ForceCount(map);
			expect(forces.total).toBe(forces.air + forces.ground + forces.naval);
			expect(forces.targets).toBeLessThanOrEqual(forces.total);
		});
	}
	it("uses the layout's real return line position", () => {
		const layout = AC04WorldPlanner.Layout(5);
		const map = ac04BriefingMap(AC04MissionData.Get(5), layout, AC04WorldPlanner.UnitPosition);
		expect(map.returnY).toBeCloseTo((layout.returnZ + layout.bounds) / (2 * layout.bounds));
	});
});

describe("AC04 objective confirmation text", () => {
	it("describes only the first phase, never a later update", () => {
		for (const mission of AC04MissionData.All()) {
			const text = ac04ObjectiveText(mission);
			expect(text.headline).toBe(mission.phases[0].label);
			for (const later of mission.phases) {
				if (later === mission.phases[0] || later.label === mission.phases[0].label) continue;
				expect(text.condition.find(later.label, 1, true)[0]).toBeUndefined();
			}
			expect(text.failures.size()).toBeGreaterThanOrEqual(1);
		}
	});
	it("states score thresholds and target totals from mission data", () => {
		const lifeline = AC04MissionData.Get(5);
		expect(ac04ObjectiveText(lifeline).condition).toContain(ac04Thousands(lifeline.phases[0].threshold!));
		expect(ac04ObjectiveText(AC04MissionData.Get(1)).condition).toContain("6");
	});
});

describe("AC04 debrief presentation", () => {
	const base = { kind: "Completed", slot: 1, missionId: 3, kills: 9, elapsed: 69.4, score: 900, saved: true, persistence: "cloud" } as MissionFinished;
	it("shows the authoritative score and time and never a rank", () => {
		const debrief = ac04Debrief({ ...base, rank: "S", bestRank: "S" }, 1, "The Northern Eye");
		const all = [...debrief.summary, ...debrief.statistics];
		expect(all.find((row) => row.label === "POINTS")!.value).toBe("900");
		expect(all.find((row) => row.label === "TIME")!.value).toBe(ac04Clock(69.4));
		for (const row of all) {
			expect(row.label.find("RANK", 1, true)[0]).toBeUndefined();
			expect(row.label.find("REWARD", 1, true)[0]).toBeUndefined();
			expect(row.label.find("CREDIT", 1, true)[0]).toBeUndefined();
		}
	});
	it("lists only statistics the result carries", () => {
		const debrief = ac04Debrief(base, 1, "The Northern Eye");
		expect(debrief.statistics.size()).toBe(1);
		const richer = ac04Debrief({ ...base, missilesFired: 12, missileHits: 7 }, 1, "The Northern Eye");
		expect(richer.statistics.size()).toBe(3);
	});
	it("adds record bests only once the record holds the completion", () => {
		expect(ac04Debrief(base, 1, "x").summary.size()).toBe(4);
		expect(ac04Debrief(base, 1, "x", { completed: true, bestScore: 1200, bestTime: 60 }).summary.size()).toBe(6);
	});
	it("reports persistence truthfully", () => {
		expect(ac04Debrief(base, 1, "x").saveNote).toBe("Flight record saved.");
		expect(ac04Debrief({ ...base, persistence: "session" }, 1, "x").saveNote).toContain("session");
		const unsaved = ac04Debrief({ ...base, saved: false }, 1, "x");
		expect(unsaved.saveWarning).toBe(true);
		const failed = ac04Debrief({ ...base, kind: "Failed", saved: false, reason: "timeout" }, 1, "x");
		expect(failed.saveWarning).toBe(false);
		expect(failed.outcome).toBe("MISSION FAILED");
	});
});

describe("AC04 record selectors", () => {
	it("summarizes a fresh record honestly", () => {
		const summary = ac04RecordSummary(ac04BlankSlot(2));
		expect(summary.empty).toBe(true);
		expect(summary.nextMission).toBe(1);
		expect(ac04ContinueRecord([ac04BlankSlot(1), ac04BlankSlot(2), ac04BlankSlot(3), ac04BlankSlot(4)])).toEqual({ index: 1, fresh: true });
	});
	it("continues the most recently updated record", () => {
		const slots = [ac04BlankSlot(1), completed(ac04BlankSlot(2), 1), completed(ac04BlankSlot(3), 1, 2), ac04BlankSlot(4)];
		slots[1].updatedAt = 50; slots[2].updatedAt = 40;
		expect(ac04ContinueRecord(slots)).toEqual({ index: 2, fresh: false });
	});
	it("lists all 18 missions in order with the authoritative lock rule", () => {
		const rows = ac04MissionRows(completed(ac04BlankSlot(1), 1, 2));
		expect(rows.size()).toBe(18);
		for (let i = 0; i < 18; i++) expect(rows[i].id).toBe(i + 1);
		expect(rows[2].locked).toBe(false);
		expect(rows[3].locked).toBe(true);
		expect(rows[0].bestScore).toBe(100);
		expect(rows[2].bestScore).toBeUndefined();
	});
	it("keeps mandatory unseen chapters pending until acknowledged", () => {
		const slot = ac04BlankSlot(1);
		expect(ac04PendingChapters(slot)).toEqual(["ac04-i01"]);
		slot.seen.push("ac04-i01");
		expect(ac04PendingChapters(slot).size()).toBe(0);
		completed(slot, 1);
		expect(ac04PendingChapters(slot)).toEqual(["ac04-i02"]);
		expect(ac04ChaptersAfterSuccess(1, slot.seen)).toEqual(["ac04-i02"]);
		expect(ac04ChaptersAfterSuccess(1, [...slot.seen, "ac04-i02"]).size()).toBe(0);
		expect(ac04StoryArchive(slot).size()).toBe(2);
	});
	it("offers only milestone-unlocked aircraft and never the X-02", () => {
		const rows = ac04AircraftRows(ac04BlankSlot(1));
		const available = rows.filter((row) => row.available).map((row) => row.spec.id);
		expect(available).toEqual(["F-4E", "F-5E"]);
		const x02 = rows.find((row) => row.spec.id === "X-02")!;
		expect(x02.available).toBe(false);
		expect(x02.lockedReason).toBe("Not available in this campaign");
		expect(ac04CycleAircraft(rows, "F-5E", 1)).toBe("F-4E");
		expect(ac04CycleAircraft(rows, "F-4E", -1)).toBe("F-5E");
		const later = ac04AircraftRows(completed(ac04BlankSlot(1), 1, 2, 3));
		expect(later.find((row) => row.spec.id === "F-16C")!.available).toBe(true);
	});
});

describe("AC04 interface text helpers", () => {
	it("never shows raw or unknown server errors", () => {
		expect(ac04RequestErrorText("ServerScriptService.AC04CampaignService:42: attempt to index nil")).toBe(AC04_GENERIC_FAILURE);
		expect(ac04RequestErrorText(undefined)).toBe(AC04_GENERIC_FAILURE);
		expect(ac04RequestErrorText("Choose a valid aircraft.")).toBe("Choose an available aircraft.");
		expect(ac04RequestErrorText("AC04 records could not be loaded. Existing saves are protected; retry shortly.").find("AC04", 1, true)[0]).toBeUndefined();
	});
	it("formats instrument values", () => {
		expect(ac04Pad(52, 3)).toBe("052");
		expect(ac04Pad(-4, 3)).toBe("000");
		expect(ac04Thousands(1234567)).toBe("1,234,567");
		expect(ac04Clock(125.5)).toBe(`02'05"50`);
		expect(ac04Clock(math.huge, false)).toBe(`99'59"`);
		expect(ac04Distance(100)).toBe("500");
		expect(ac04Distance(0 / 0)).toBe("----");
	});
	it("splits radio speakers without losing unattributed lines", () => {
		expect(ac04SplitRadio("SkyEye: Bandits inbound.")).toEqual({ speaker: "SKYEYE", line: "Bandits inbound." });
		expect(ac04SplitRadio("Base control: Aircraft serviced.")).toEqual({ speaker: "BASE CONTROL", line: "Aircraft serviced." });
		expect(ac04SplitRadio("Cross the southern return line.")).toEqual({ line: "Cross the southern return line." });
	});
});
