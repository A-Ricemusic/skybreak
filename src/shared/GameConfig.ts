export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "SKYBREAK",
	Subtitle: "Broken Relay",

	Campaign: {
		DataStoreName: "SkybreakCampaign_v1",
		// Save schema v3 adds per-mission completion/best time for all 27 missions
		// while remaining fully backward-compatible with v1 and v2 serialized data.
		SaveVersion: 3,
		SlotCount: 4,
		MissionCount: 27,
		// Legacy legacy total-air-kills counter kept clamped for display safety.
		MaxRecordedKills: 99,
		// Sortie deadline in seconds, read by both mission runners, the save layer and the HUD.
		// Sorties are authored for 3-7 minutes (the finale ~8); 15 minutes leaves a slow pilot room.
		MissionTimeLimit: 900,
		// Legacy per-mission required counts (used for v1/v2 compatibility and tests).
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
