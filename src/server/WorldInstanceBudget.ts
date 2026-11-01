import { NAVAL_ASSETS, type NavalAsset } from "../shared/NavalKit";
/** A kit export is one mesh + SurfaceAppearance today (3 instances including its Model).
 * Reserve 24 including the root for import wrappers, attachments and future detail. Each
 * decoration is bounded at placement; the original world cap still bounds its target owner,
 * scenery, aim roots and collision proxies. Other uploads retain their existing world budget.
 */
export const GROUND_KIT_INSTANCE_ALLOWANCE = 24;
/** Each naval model uses the same bounded decoration lane as the military kit. */
export const NAVAL_KIT_INSTANCE_ALLOWANCES: Record<NavalAsset, number> = {
 NavalFrigate: 24, NavalDestroyer: 24, NavalCruiser: 24, NavalContainerShip: 24,
 NavalSupplyShip: 24, NavalLandingShip: 24, NavalMissileBoat: 24, NavalSubmarine: 24,
 NavalLandingCraft: 24, NavalGun: 24, NavalAa: 24, NavalSam: 24,
};
export function kitInstanceAllowance(name: string): number {
 return NAVAL_ASSETS.includes(name as NavalAsset) ? NAVAL_KIT_INSTANCE_ALLOWANCES[name as NavalAsset] : GROUND_KIT_INSTANCE_ALLOWANCE;
}
export const GROUND_KIT_BUDGET_ATTRIBUTE = "GroundKitBudgeted";

export function worldInstanceCounts(scene: Instance): { base: number; kit: number; models: number } {
 let base = 0, kit = 0, models = 0;
 const visit = (owner: Instance): void => {
  for (const child of owner.GetChildren()) {
   if (child.IsA("Model") && child.GetAttribute(GROUND_KIT_BUDGET_ATTRIBUTE) === true) {
    const count = 1 + child.GetDescendants().size();
    assert(count <= kitInstanceAllowance(child.Name), "Ground kit decoration exceeded its instance allowance");
    kit += count; models++;
   } else { base++; visit(child); }
  }
 };
 visit(scene);
 return { base, kit, models };
}

export function assertWorldInstanceBudget(scene: Instance, limit: number, reserve = 0): void {
 const counts = worldInstanceCounts(scene);
 scene.SetAttribute("WorldBaseInstances", counts.base);
 scene.SetAttribute("WorldKitInstances", counts.kit);
 scene.SetAttribute("WorldKitModels", counts.models);
 assert(counts.base + reserve <= limit, `${scene.Name} base descendants exceed budget`);
}
