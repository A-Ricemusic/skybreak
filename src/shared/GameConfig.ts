export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "SKYBREAK",
	Subtitle: "Broken Relay",

	Campaign: {
		DataStoreName: "SkybreakCampaign18_v1",
		// Fresh namespace; schema v3 stores practice plus 18 numbered mission records.
		// No old namespace is read, migrated or deleted.
		SaveVersion: 3,
		SlotCount: 4,
		MissionCount: 18,
		// Legacy legacy total-air-kills counter kept clamped for display safety.
		MaxRecordedKills: 99,
		// Sortie deadline in seconds, read by the mission runner, the save layer and the HUD.
		// Sorties are authored for 3-7 minutes (the finale ~8); 15 minutes leaves a slow pilot room.
		MissionTimeLimit: 900,

	},

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
