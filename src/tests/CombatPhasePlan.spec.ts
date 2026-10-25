import { describe, expect, it } from "@rbxts/jest-globals";
import { getCombatPhasePlan, shouldApplyCombatPhase } from "../shared/CombatPhasePlan";
import { getMission, MISSIONS } from "../shared/MissionCatalog";

describe("production combat phase deployment routing", () => {
	it("routes Signal Fire's ground targets and all six optional pursuers", () => {
		const deployment = getCombatPhasePlan(8, "ground_0");
		expect(deployment).toBeDefined();
		expect(deployment!.kind).toBe("ground");
		expect(deployment!.groundCount).toBe(4);
		expect(deployment!.optionalAir).toBe(6);
		expect(deployment!.requiredAir).toBe(0);
	});

	it("preserves Mission 2's bespoke intercept, warehouse-raider, and ace routes", () => {
		const intercept = getCombatPhasePlan(2, "intercept")!;
		const warehouses = getCombatPhasePlan(2, "warehouses")!;
		const ace = getCombatPhasePlan(2, "ace")!;
		expect(intercept.requiredAir).toBe(3);
		expect(warehouses.activateAllGround).toBe(true);
		expect(warehouses.optionalAir).toBe(5);
		expect(ace.aceCount).toBe(1);
	});

	it("routes every catalog phase through the same planner used by CombatService", () => {
		for (const mission of MISSIONS) {
			if (mission.id < 3) continue;
			for (let phaseIndex = 0; phaseIndex < mission.phases.size(); phaseIndex++) {
				const phase = mission.phases[phaseIndex];
				const deployment = getCombatPhasePlan(mission.id, `${phase.kind}_${phaseIndex}`);
				expect(deployment).toBeDefined();
				expect(deployment!.kind).toBe(phase.kind);
				expect(deployment!.phaseIndex).toBe(phaseIndex);
				if (phase.kind === "ground") expect(deployment!.groundCount).toBe(phase.required);
				if (phase.kind === "air") expect(deployment!.requiredAir).toBe(phase.required);
				if (phase.kind === "ace") expect(deployment!.aceCount).toBe(1);
				if (phase.kind === "ground" || phase.kind === "air" || phase.kind === "hold") {
					expect(deployment!.optionalAir).toBe(phase.optional ?? 0);
				}
			}
		}
	});

	it("rejects stale routing and retains exact-once phase application", () => {
		expect(getCombatPhasePlan(8, "air_0")).toBeUndefined();
		expect(getCombatPhasePlan(8, "ground_1")).toBeUndefined();
		expect(shouldApplyCombatPhase(undefined, "ground_0", false)).toBe(true);
		expect(shouldApplyCombatPhase("air_0", "ground_0", false)).toBe(true);
		expect(shouldApplyCombatPhase("ground_0", "ground_0", false)).toBe(false);
		expect(shouldApplyCombatPhase(undefined, "ground_0", true)).toBe(false);
	});

	it("keeps navigation phase data paired with its authored route", () => {
		const mission = getMission(3);
		const deployment = getCombatPhasePlan(3, "nav_0")!;
		expect(deployment.kind).toBe("nav");
		expect(deployment.phaseIndex).toBe(0);
		expect(mission.phases[deployment.phaseIndex!].route).toHaveLength(3);
	});
});
