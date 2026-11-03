import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionEnding } from "../shared/MissionEnding";

describe("MissionEnding", () => {
	it("maps the controller flags onto one phase", () => {
		expect(MissionEnding.PhaseOf(false, false)).toBe("stopped");
		expect(MissionEnding.PhaseOf(false, true)).toBe("stopped");
		expect(MissionEnding.PhaseOf(true, false)).toBe("flying");
		expect(MissionEnding.PhaseOf(true, true)).toBe("ending");
	});
	it("finish turns a flying sortie into a held ending without stopping it", () => {
		const ending = MissionEnding.Next("flying", "finish");
		expect(ending).toBe("ending");
		expect(MissionEnding.AcceptsControls(ending)).toBe(false);
		expect(MissionEnding.HoldsPresentation(ending)).toBe(true);
		expect(MissionEnding.Next(ending, "finish")).toBe("ending");
	});
	it("finish never revives a stopped sortie", () => {
		expect(MissionEnding.Next("stopped", "finish")).toBe("stopped");
	});
	it("stop is immediate from every phase and cancels a pending ending", () => {
		for (const phase of ["stopped", "flying", "ending"] as const) {
			const stopped = MissionEnding.Next(phase, "stop");
			expect(stopped).toBe("stopped");
			expect(MissionEnding.HoldsPresentation(stopped)).toBe(false);
			expect(MissionEnding.AcceptsControls(stopped)).toBe(false);
		}
	});
	it("a new start flies again, even mid-ending", () => {
		expect(MissionEnding.Next("ending", "start")).toBe("flying");
		expect(MissionEnding.Next("stopped", "start")).toBe("flying");
		expect(MissionEnding.AcceptsControls("flying")).toBe(true);
		expect(MissionEnding.HoldsPresentation("flying")).toBe(true);
	});
});
