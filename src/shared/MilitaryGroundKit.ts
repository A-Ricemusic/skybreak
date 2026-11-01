import type { GroundTargetType } from "./CampaignEncounters";
export type MilitaryGroundAsset = "MilitaryTank" | "MilitarySam" | "MilitaryAa" | "MilitaryArtillery" | "MilitaryBunker" | "MilitaryRadar" | "MilitaryTruck" | "MilitaryFuel" | "MilitaryBarracks" | "MilitaryContainers";
/** Original static kit. IDs stay undefined until independent exact-export approval and upload. */
export const MILITARY_GROUND_KIT: Partial<Record<GroundTargetType, MilitaryGroundAsset>> = {
 tank: "MilitaryTank", sam: "MilitarySam", aa_gun: "MilitaryAa", flak_gun: "MilitaryAa", gun_mount: "MilitaryAa",
 artillery: "MilitaryArtillery", bunker: "MilitaryBunker", pillbox: "MilitaryBunker",
 radar_dome: "MilitaryRadar", vehicle: "MilitaryTruck", fuel_tank: "MilitaryFuel", gas_tank: "MilitaryFuel",
 barracks: "MilitaryBarracks", containers: "MilitaryContainers", container: "MilitaryContainers",
};
export const MILITARY_GROUND_ASSETS: MilitaryGroundAsset[] = [
 "MilitaryTank", "MilitarySam", "MilitaryAa", "MilitaryArtillery", "MilitaryBunker",
 "MilitaryRadar", "MilitaryTruck", "MilitaryFuel", "MilitaryBarracks", "MilitaryContainers",
];
