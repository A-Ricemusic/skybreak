// Last Tide: an original 27-mission arcade flight campaign for Roblox.
//
// MissionCount, SaveVersion, and the per-mission required-kill table are the
// single source of truth. CampaignRepository persists save files under
// `DataStoreName`; migrating v1 (two-mission) and v2 (two-mission) saves
// forward to v3 is handled centrally so that each change here propagates.

export const GameConfig = {
	Name: "Last Tide",
	DisplayName: "LAST TIDE",
	Subtitle: "Reef Watch Chronicles",

	Campaign: {
		DataStoreName: "LastTideCampaign_v1",
		SaveVersion: 3,
		SlotCount: 4,
		MissionCount: 27,
		/** Legacy ceiling for the Mission 2 air-kill display; new missions use the catalog. */
		MaxRecordedKills: 32,
		MissionTimeLimit: 600,
	},

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
