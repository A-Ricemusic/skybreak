import { CampaignConfig } from "./CampaignConfig";
export const GameConfig = {
	Name: "Test Game Coding From Phone",
	DisplayName: "SKYBREAK",
	Subtitle: "Operation Glass Horizon",

	Campaign: CampaignConfig,

	World: {
		OceanY: -20,
		MenuCamera: CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 12, 0)),
	},
} as const;
