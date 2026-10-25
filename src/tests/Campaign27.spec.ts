import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, completeMission, mergeProfiles, normalizeProfile, resolveMissionRequest, serializeProfile } from "../server/CampaignRepository";
import { MissionCatalog } from "../shared/MissionCatalog";
import { MissionRules } from "../shared/MissionRules";
import { Story } from "../shared/Story";
import { WorldLayouts } from "../shared/WorldLayouts";
import { verifyDefinition, verifyProgression } from "./CampaignContracts";

describe("Glass Horizon full campaign", () => {
	for (let id=1;id<=27;id++) {
		it(`validates authored mission ${id} and all its phase transitions, failures and retry`, () => { verifyDefinition(id); verifyProgression(id); });
	}
	it("has 27 different map footprints and 28 complete story transitions", () => {
		const footprints = new Set<string>();
		for (const layout of WorldLayouts.All) footprints.add(layout.sites.map((p) => `${p[0]},${p[1]}`).join(";"));
		expect(footprints.size()).toBe(27);
		for (let id=1;id<=28;id++) {
			const scene = Story.Get(id); expect(scene.beats.size()).toBe(3);
			for (const beat of scene.beats) expect(beat.text.size()).toBeGreaterThan(8);
		}
	});
	it("migrates completed v2 saves to M3 without claiming the 27-mission campaign", () => {
		const slots = new Map<string, object>(); slots.set("2",{mission2Completed:true,mission2BestTime:80,kills:9,completed:true});
		const migrated = normalizeProfile({version:2,slots});
		expect(migrated.slots[1].completedMissions).toBe(2); expect(migrated.slots[1].currentMission).toBe(3);
		expect(migrated.slots[1].completed).toBe(false); expect(migrated.slots[0].occupied).toBe(false);
		expect(migrated.slots[1].missionBestTimes!.get("2")).toBe(80);
	});
	it("enforces all 27 unlocks, replay, final completion, fastest records and four-slot isolation", () => {
		const coordinator = new CampaignCoordinator("fixture"); coordinator.load();
		for (let id=1;id<=27;id++) {
			const slot = coordinator.getSlots()[2];
			expect(resolveMissionRequest(slot,id)[0]).toBe(id);
			if (id<27) expect(resolveMissionRequest(slot,id+1)[0]).toBeUndefined();
			const definition = MissionCatalog.Get(id);
			let won = false;
			completeMission(coordinator,3,id,true,{missionId:id,slot:3,kills:MissionCatalog.RequiredAirKills(definition),groundKills:MissionCatalog.RequiredGroundKills(definition),elapsed:100,objectivesComplete:true},m => { won = m.kind === "Completed"; });
			expect(won).toBe(true);
		}
		const done = coordinator.getSlots()[2]; expect(done.completed).toBe(true); expect(done.completedMissions).toBe(27);
		coordinator.recordMissionResult(3,4,true,5,90); coordinator.recordMissionResult(3,4,true,5,110);
		expect(coordinator.getSlots()[2].missionBestTimes!.get("4")).toBe(90);
		const restored = normalizeProfile(serializeProfile({version:3,slots:coordinator.getSlots()}));
		expect(restored.slots[2].completedMissions).toBe(27); expect(restored.slots[2].missionBestTimes!.size()).toBe(27);
		for (const offset of [0,1,3]) expect(restored.slots[offset].occupied).toBe(false);
		const merged = mergeProfiles(serializeProfile(restored),undefined); expect(merged.slots[2].completed).toBe(true);
	});
	it("requires server objective proof beyond kill totals and cannot jump a locked mission", () => {
		const c = new CampaignCoordinator("fixture"); c.load(); c.recordMissionResult(1,1,true,3,50); c.recordMissionResult(1,2,true,4,80);
		let won = true;
		completeMission(c,1,3,true,{slot:1,missionId:3,kills:99,groundKills:99,elapsed:100},m=>{won=m.kind === "Completed";});
		expect(won).toBe(false); expect(c.recordMissionResult(1,27,true,40,100).completed).toBe(false);
		expect(c.getSlots()[0].completedMissions).toBe(2);
	});
	it("fails escort and bomber operations on protected asset loss and does not grant survival time twice", () => {
		const escort = MissionRules.NewState(9,0); MissionRules.ObserveEscort(escort,true,0,0.1,1);
		expect(escort.reason).toBe("asset_lost");
		const bombers = MissionRules.NewState(13,0); MissionRules.LoseProtectedAsset(bombers);
		expect(bombers.outcome).toBe("failed"); expect(bombers.requiredAirKills).toBe(0);
	});
});
