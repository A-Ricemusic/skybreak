// Embers of Home — single-place 27-mission arcade flight campaign.
import { MISSION_COUNT } from "./MissionCatalog";

export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "EMBERS OF HOME",
	Subtitle: "A twenty-seven mission arcade flight campaign",

	Campaign: {
		DataStoreName: "SkybreakCampaign_v1",
		// Bumped to v3 to carry per-mission completion / best times across all
		// twenty-seven missions. v1 (Mission 1 only) and v2 (Mission 1 & 2) saves
		// migrate forward in CampaignRepository without data loss.
		SaveVersion: 3,
		SlotCount: 4,
		MissionCount: MISSION_COUNT,
		/** Cap for the kills field written to legacy serialized slots. */
		MaxRecordedKills: 99,
		/** Hard wall-clock deadline for every mission, in seconds. */
		MissionTimeLimit: 600,
	},

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
