import { describe, expect, it } from "@rbxts/jest-globals";
import { DeletionObservation } from "../shared/DeletionObservation";
import { CampaignRequestBudget } from "../server/CampaignRequestBudget";

describe("deletion observation lifetime", () => {
	it("does not dispatch after navigation before the RPC", () => {
		const observation = new DeletionObservation();
		const token = observation.capture();
		let calls = 0; let notices = 0;
		observation.cancel();
		observation.read(token, () => true, () => { calls++; return "confirmed"; }, () => { notices++; });
		expect(calls).toBe(0); expect(notices).toBe(0);
	});
	it("suppresses stale notifications when navigation happens inside a yielding RPC, even after returning to the same screen", () => {
		const observation = new DeletionObservation();
		const token = observation.capture();
		let notices = 0;
		observation.read(token, () => true, () => {
			observation.cancel(); observation.cancel(); return "confirmed";
		}, () => { notices++; });
		expect(notices).toBe(0);
		observation.read(observation.capture(), () => true, () => "confirmed", () => { notices++; });
		expect(notices).toBe(1);
	});
	it("suppresses results when unmounted or superseded during the RPC", () => {
		const observation = new DeletionObservation(); let alive = true; let notices = 0;
		observation.read(observation.capture(), () => alive, () => { alive = false; return "failed"; }, () => { notices++; });
		expect(notices).toBe(0);
	});
});

describe("independent campaign request budgets", () => {
	it("allows poll then foreground and foreground then poll within 120ms", () => {
		for (const statusFirst of [true, false]) {
			const budget = new CampaignRequestBudget();
			expect(budget.accept(10, statusFirst)).toBe(true);
			expect(budget.accept(10.01, !statusFirst)).toBe(true);
		}
	});
	it("bounds status spam without consuming or extending the command budget", () => {
		const budget = new CampaignRequestBudget();
		expect(budget.accept(10, false)).toBe(true);
		expect(budget.accept(10, true)).toBe(true);
		for (let i = 1; i < 50; i++) expect(budget.accept(10 + i / 100, true)).toBe(false);
		expect(budget.accept(10.13, false)).toBe(true);
		expect(budget.accept(10.14, false)).toBe(false);
		expect(budget.accept(10.5, true)).toBe(true);
		expect(budget.accept(10.26, false)).toBe(true);
	});
});
