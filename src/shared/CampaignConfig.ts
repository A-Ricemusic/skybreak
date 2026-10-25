export const CampaignConfig = {
	DataStoreName: "SkybreakCampaign_v1",
	SaveVersion: 3,
	SlotCount: 4,
	MissionCount: 27,
	MissionKills: 3,
	MaxRecordedKills: 40,
	MissionTimeLimit: 600,
	Missions: {
		1: { Name: "FIRST FLIGHT", RequiredAirKills: 3, RequiredGroundKills: 1 },
		2: { Name: "IRON COAST", RequiredAirKills: 4, RequiredGroundKills: 5 },
	},
} as const;
