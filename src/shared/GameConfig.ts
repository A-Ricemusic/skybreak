import { AuroraLineManifest } from "./AuroraLineManifest";

export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "SKYBREAK",
	Subtitle: "Operation Aurora Line",

	Campaign: {
		DataStoreName: "SkybreakCampaign_v1",
		SaveVersion: AuroraLineManifest.SaveVersion,
		SlotCount: 4,
		MissionCount: AuroraLineManifest.MissionCount,
		MissionKills: 3,
		MaxRecordedKills: 32,
		MissionTimeLimit: 600,
	},

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
