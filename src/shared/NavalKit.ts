// Naval visual kit: asset names, the hull-type -> asset mapping and navalVisual(), which picks a hull or deck
// mount silhouette for a ground target by type, layout type and group. Pure data/functions, no instances.
// Consumed by GroundTargetFactory, NavalDecoration, WorldInstanceBudget and the M06/M09/M17 world builders.
import type { GroundTargetType } from "./CampaignEncounters";
export type NavalAsset =
	| "NavalFrigate"
	| "NavalDestroyer"
	| "NavalCruiser"
	| "NavalContainerShip"
	| "NavalSupplyShip"
	| "NavalLandingShip"
	| "NavalMissileBoat"
	| "NavalSubmarine"
	| "NavalLandingCraft"
	| "NavalGun"
	| "NavalAa"
	| "NavalSam";
/** Dormant original visual kit. Exact exports are independently approved on main; no model IDs or uploads. */
export const NAVAL_ASSETS: NavalAsset[] = [
	"NavalFrigate",
	"NavalDestroyer",
	"NavalCruiser",
	"NavalContainerShip",
	"NavalSupplyShip",
	"NavalLandingShip",
	"NavalMissileBoat",
	"NavalSubmarine",
	"NavalLandingCraft",
	"NavalGun",
	"NavalAa",
	"NavalSam",
];
export const NAVAL_HULL_KIT: Partial<Record<GroundTargetType, NavalAsset>> = {
	destroyer: "NavalDestroyer",
	cruiser: "NavalCruiser",
	container_ship: "NavalContainerShip",
	supply_ship: "NavalSupplyShip",
	landing_ship: "NavalLandingShip",
	missile_boat: "NavalMissileBoat",
	submarine: "NavalSubmarine",
};
export function navalVisual(targetType: GroundTargetType, layoutType?: string, group?: string): NavalAsset | undefined {
	if (layoutType === "frigate") return "NavalFrigate";
	if (
		group === "naval_mount" ||
		group === "west_defence" ||
		group === "central_defence" ||
		group === "east_defence"
	) {
		if (targetType === "sam") return "NavalSam";
		if (targetType === "aa_gun" || targetType === "flak_gun") return "NavalAa";
		if (targetType === "gun_mount") return "NavalGun";
	}
	return NAVAL_HULL_KIT[targetType];
}
