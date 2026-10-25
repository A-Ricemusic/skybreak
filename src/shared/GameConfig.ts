export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "SKYBREAK",
	Subtitle: "Operation Glass Horizon",

	Campaign: {
		DataStoreName: "SkybreakCampaign_v1",
		SaveVersion: 2,
		SlotCount: 4,
		MissionCount: 2,
		MissionKills: 3,
		MaxRecordedKills: 9,
		MissionTimeLimit: 600,
		Missions: {
			1: { Name: "FIRST FLIGHT", RequiredAirKills: 3, RequiredGroundKills: 1 },
			2: { Name: "IRON COAST", RequiredAirKills: 4, RequiredGroundKills: 5 },
		},
	},

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
