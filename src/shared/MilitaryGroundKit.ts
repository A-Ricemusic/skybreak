// Static military ground kit: the uploaded asset names and the GroundTargetType -> asset mapping used to dress
// ground targets. Pure data, no instances. Consumed by GroundTargetFactory, the mission world builders and
// tools/assets/ground_kit_packet.py; adding an asset here requires the Blender asset safety review before upload.
import type { GroundTargetType } from "./CampaignEncounters";
export type MilitaryGroundAsset =
	| "MilitaryTank"
	| "MilitarySam"
	| "MilitaryAa"
	| "MilitaryArtillery"
	| "MilitaryBunker"
	| "MilitaryRadar"
	| "MilitaryTruck"
	| "MilitaryFuel"
	| "MilitaryBarracks"
	| "MilitaryContainers";
/** Original static kit. Independently reviewed 10/10; uploaded models approved by moderation 2026-10-31. */
export const MILITARY_GROUND_KIT: Partial<Record<GroundTargetType, MilitaryGroundAsset>> = {
	tank: "MilitaryTank",
	sam: "MilitarySam",
	aa_gun: "MilitaryAa",
	flak_gun: "MilitaryAa",
	gun_mount: "MilitaryAa",
	artillery: "MilitaryArtillery",
	bunker: "MilitaryBunker",
	pillbox: "MilitaryBunker",
	radar_dome: "MilitaryRadar",
	vehicle: "MilitaryTruck",
	fuel_tank: "MilitaryFuel",
	gas_tank: "MilitaryFuel",
	barracks: "MilitaryBarracks",
	containers: "MilitaryContainers",
	container: "MilitaryContainers",
};
export const MILITARY_GROUND_ASSETS: MilitaryGroundAsset[] = [
	"MilitaryTank",
	"MilitarySam",
	"MilitaryAa",
	"MilitaryArtillery",
	"MilitaryBunker",
	"MilitaryRadar",
	"MilitaryTruck",
	"MilitaryFuel",
	"MilitaryBarracks",
	"MilitaryContainers",
];
