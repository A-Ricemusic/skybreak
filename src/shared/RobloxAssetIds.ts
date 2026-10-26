import type { UploadedAssetName } from "./UploadedAssetSpecs";

/**
 * Uploaded Roblox Model asset IDs for the Blender upload set in assets/roblox-upload.
 *
 * Every entry stays `undefined` until the coordinator has uploaded the asset, an
 * independent reviewer has approved its previews and checklist, and Roblox
 * moderation has approved it (docs/roblox-asset-pipeline.md). While an entry is
 * undefined, or if loading the uploaded asset fails at runtime, the game uses
 * the procedural path: generated Blender meshes for the aircraft and the
 * existing Scenery parts (or WorldAssets' simple fallback shapes) for the world.
 *
 * Assets must be owned by the experience owner so InsertService.LoadAsset works.
 */
export const RobloxAssetIds: Record<UploadedAssetName, number | undefined> = {
	Kestrel: undefined,
	Vanta: undefined,
	VantaVulture: undefined,
	VantaRusk: undefined,
	Frigate: undefined,
	OilPlatform: undefined,
	HarbourQuay: undefined,
	ContainerStack: undefined,
	GantryCrane: undefined,
	Hangar: undefined,
	ControlTower: undefined,
	OfficeMidrise: undefined,
	ApartmentBlock: undefined,
	CityTower: undefined,
	Farmhouse: undefined,
	Barn: undefined,
	GrainSilo: undefined,
	RadarDish: undefined,
	RelayMast: undefined,
	Pine: undefined,
	Broadleaf: undefined,
	RockA: undefined,
	RockB: undefined,
	RockC: undefined,
};
