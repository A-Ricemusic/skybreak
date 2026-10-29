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
	Kestrel: 112234026185056,
	Vanta: 138996120906774,
	VantaVulture: 104517441099825,
	VantaRusk: 105331320955130,
	// Version 2 aircraft (assets/roblox-upload/*-v2*): preferred over v1 when set.
	KestrelV2: 133879661006824,
	VantaV2: 93195734008147,
	VantaV2Vulture: 101186966862069,
	VantaV2Rusk: 93509098875902,
	// Approved 2026-10-28; dormant bomber encounter and mission 1 world only.
	HeavyBomber: 112476761254185,
	Carrier: 118082412288291,
	// Approved 2026-10-29; reserved for missions 4–5, no live sortie consumers.
	HeavyTransport: 135095912449793,
	RadarJammer: 80069408823339,
	FuelTanker: 83861380699092,
	AttackHelicopter: 80747426523090,
	VantaV2Elite: 139083376207373,
	Frigate: 83984523694725,
	OilPlatform: 76182723177049,
	HarbourQuay: 133121801627949,
	ContainerStack: 104517116041280,
	GantryCrane: 104921012785525,
	Hangar: 128288825519992,
	ControlTower: 119289413907051,
	OfficeMidrise: 98108658324591,
	ApartmentBlock: 117532758282483,
	CityTower: 98373556846097,
	Farmhouse: 107969774575516,
	Barn: 134648911960733,
	GrainSilo: 135732862435178,
	RadarDish: 108771748936984,
	RelayMast: 127629803273844,
	Pine: 115274628091272,
	Broadleaf: 121144711284344,
	RockA: 116039802470338,
	RockB: 132942349903345,
	RockC: 124683188002264,
};
