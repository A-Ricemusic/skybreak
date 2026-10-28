import { describe, expect, it } from "@rbxts/jest-globals";
import { EncounterRole, MissionScoringPolicy } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";

const m01: MissionScoringPolicy = {
	points: { bomber: 100, escort: 60, ace: 240 },
	basis: "points",
	rank: { S: 800, A: 700, B: 600, C: 500 },
};

describe("TargetScore", () => {
	it("counts each target id once and keeps bomber, escort and ace breakdowns", () => {
		const ledger = new TargetScore(m01);
		expect(ledger.RecordKill("bomber-1", "bomber")).toBe(true);
		expect(ledger.RecordKill("bomber-1", "ace")).toBe(false);
		expect(ledger.RecordKill("escort-1", "escort")).toBe(true);
		expect(ledger.RecordKill("ace-1", "ace")).toBe(true);
		expect(ledger.Total()).toBe(400);
		expect(ledger.Snapshot()).toEqual({
			total: 400,
			kills: { bomber: 1, escort: 1, ace: 1 },
			points: { bomber: 100, escort: 60, ace: 240 },
		});
	});

	it("matches the mission 1 reference arithmetic", () => {
		const ledger = new TargetScore(m01);
		for (let index = 1; index <= 6; index++) ledger.RecordKill(`bomber-${index}`, "bomber");
		ledger.RecordKill("escort-1", "escort");
		ledger.RecordKill("escort-2", "escort");
		ledger.RecordKill("ace-1", "ace");
		expect(ledger.Total()).toBe(6 * 100 + 2 * 60 + 240);
		expect(ledger.Total()).toBe(960);
		expect(ledger.RoleKills("bomber")).toBe(6);
		expect(ledger.RolePoints("bomber")).toBe(600);
	});

	it("records unknown or invalidly-valued roles for diagnosis without awarding points", () => {
		const policy: MissionScoringPolicy = {
			...m01,
			points: { bomber: 100, ace: math.huge, ground: 0 / 0 },
		};
		const ledger = new TargetScore(policy);
		expect(ledger.RecordKill("unknown-1", "raider")).toBe(true);
		expect(ledger.RecordKill("ace-1", "ace")).toBe(true);
		expect(ledger.RecordKill("ground-1", "ground")).toBe(true);
		expect(ledger.RecordKill("", "bomber")).toBe(false);
		expect(ledger.RecordKill("invalid-role", math.huge as unknown as EncounterRole)).toBe(false);
		expect(ledger.Total()).toBe(0);
		expect(ledger.Snapshot()).toEqual({
			total: 0,
			kills: { raider: 1, ace: 1, ground: 1 },
			points: { raider: 0, ace: 0, ground: 0 },
		});
	});

	it("returns a detached serialisable snapshot", () => {
		const ledger = new TargetScore(m01);
		ledger.RecordKill("bomber-1", "bomber");
		const snapshot = ledger.Snapshot();
		snapshot.kills.bomber = 99;
		snapshot.points.bomber = 9900;
		expect(ledger.RoleKills("bomber")).toBe(1);
		expect(ledger.RolePoints("bomber")).toBe(100);
	});
});
