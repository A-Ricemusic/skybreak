import { describe, expect, it } from "@rbxts/jest-globals";
import { normalizeProfile, resolveMissionRequest, StoredProfile } from "../server/CampaignRepository";
import { AuroraLineCutscenes, AuroraLineManifest, ObjectiveKind } from "../shared/AuroraLineManifest";
import { MissionRules } from "../shared/MissionRules";

function clearMission(missionId: number): void {
	const state = MissionRules.NewState(missionId, 0);
	let serial = 0;
	if (missionId === 1) {
		for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 1, -1, 0.1, 1);
		MissionRules.CycleTarget(state, 2);
	}
	while (state.outcome === undefined) {
		const step = MissionRules.CurrentStep(state);
		expect(step).toBeDefined();
		const kind = step!.kind === "tutorial_missile" || step!.kind === "strike" ? "ground" : step!.kind === "ace" ? "ace" : "air";
		for (let count = 0; count < step!.required; count++) {
			serial++;
			expect(MissionRules.RecordKill(state, `${missionId}_${serial}`, kind, true, 3 + serial)).toBe(true);
		}
	}
	expect(state.outcome).toBe("won");
	expect(state.reason).toBe("complete");
}

describe("Aurora Line 27-mission domain", () => {
	it("has 27 ordered, distinct, fully authored mission plans", () => {
		expect(AuroraLineManifest.Plans).toHaveLength(27);
		const names = new Set<string>();
		const signatures = new Set<string>();
		const objectiveKinds = new Set<ObjectiveKind>();
		for (let index = 0; index < AuroraLineManifest.Plans.size(); index++) {
			const plan = AuroraLineManifest.Plans[index];
			expect(plan.id).toBe(index + 1);
			expect(plan.codename.size()).toBeGreaterThan(2);
			expect(plan.briefing.size()).toBeGreaterThan(24);
			expect(plan.debrief.victory.size()).toBeGreaterThan(16);
			expect(plan.steps.size()).toBeGreaterThan(0);
			names.add(plan.codename);
			const signature = plan.steps.map((step) => `${step.kind}:${step.required}`).join("|");
			signatures.add(`${plan.environment.theme}:${signature}:${plan.groundTargets.asset}`);
			for (const step of plan.steps) objectiveKinds.add(step.kind);
		}
		expect(names.size()).toBe(27);
		expect(signatures.size()).toBeGreaterThanOrEqual(20);
		expect(objectiveKinds.has("escort")).toBe(true);
		expect(objectiveKinds.has("protect")).toBe(true);
		expect(objectiveKinds.has("intercept")).toBe(true);
		expect(objectiveKinds.has("strike")).toBe(true);
		expect(objectiveKinds.has("ace")).toBe(true);
	});

	it("provides an opening, every inter-mission bridge, and a finale", () => {
		expect(AuroraLineCutscenes.List).toHaveLength(28);
		expect(AuroraLineCutscenes.Opening.kind).toBe("opening");
		expect(AuroraLineCutscenes.Finale.kind).toBe("finale");
		for (let completedMission = 1; completedMission < 27; completedMission++) {
			const scene = AuroraLineCutscenes.ByActOf(completedMission);
			expect(scene).toBeDefined();
			expect(scene!.beats.size()).toBeGreaterThan(0);
			for (const beat of scene!.beats) {
				expect(beat.duration).toBeGreaterThanOrEqual(3);
				expect(beat.cameraKeyframes.size()).toBeGreaterThanOrEqual(2);
				expect(beat.subtitle.size()).toBeGreaterThan(8);
			}
		}
	});

	it("can complete every authoritative objective chain without client success claims", () => {
		for (let missionId = 1; missionId <= 27; missionId++) clearMission(missionId);
	});

	it("migrates v2 progress and unlocks only the next legal mission", () => {
		const slots = new Map<string, object>();
		slots.set("1", { occupied: true, mission1Completed: true, mission2Completed: true, mission1BestTime: 42, mission2BestTime: 77 });
		const profile = normalizeProfile({ version: 2, slots } as StoredProfile);
		const slot = profile.slots[0];
		expect(slot.missions).toHaveLength(27);
		expect(slot.missions![0].completed).toBe(true);
		expect(slot.missions![1].completed).toBe(true);
		expect(slot.missions![2].completed).toBe(false);
		expect(slot.currentMission).toBe(3);
		expect(slot.completed).toBe(false);
		expect(resolveMissionRequest(slot, 2)[0]).toBe(2);
		expect(resolveMissionRequest(slot, 3)[0]).toBe(3);
		expect(resolveMissionRequest(slot, 4)[0]).toBeUndefined();
	});

	it("keeps the wall-clock deadline at 600 seconds for expansion missions", () => {
		for (const missionId of [3, 11, 18, 27]) {
			const state = MissionRules.NewState(missionId, 100);
			MissionRules.Tick(state, 699.999);
			expect(state.outcome).toBeUndefined();
			MissionRules.Tick(state, 700);
			expect(state.outcome).toBe("failed");
			expect(state.reason).toBe("timeout");
		}
	});
});
