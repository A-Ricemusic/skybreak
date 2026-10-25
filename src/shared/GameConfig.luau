return {
	Name = "Test Game Coding From Phone",
	DisplayName = "SKYBREAK",
	Subtitle = "Operation Glass Horizon",

	Campaign = {
		DataStoreName = "SkybreakCampaign_v1",
		SaveVersion = 1,
		SlotCount = 4,
		MissionKills = 3,
	},

	World = {
		OceanY = -20,
		AirspaceHalfSize = 3000,
		SoftBoundary = 2400,
		HardBoundary = 2800,
		MinimumFlightAltitude = 125,
		MissionStart = Vector3.new(0, 250, 500),
		MenuCamera = CFrame.lookAt(Vector3.new(180, 95, 170), Vector3.new(0, 12, 0)),
	},
}
