/** A kit export is one mesh + SurfaceAppearance today (3 instances including its Model).
 * Reserve 24 including the root for import wrappers, attachments and future detail. Each
 * decoration is bounded at placement; the original world cap still bounds its target owner,
 * scenery, aim roots and collision proxies. Other uploads retain their existing world budget.
 */
export const GROUND_KIT_INSTANCE_ALLOWANCE = 24;
export const GROUND_KIT_BUDGET_ATTRIBUTE = "GroundKitBudgeted";

export function worldInstanceCounts(scene: Instance): { base: number; kit: number; models: number } {
 let base = 0, kit = 0, models = 0;
 const visit = (owner: Instance): void => {
  for (const child of owner.GetChildren()) {
   if (child.IsA("Model") && child.GetAttribute(GROUND_KIT_BUDGET_ATTRIBUTE) === true) {
    const count = 1 + child.GetDescendants().size();
    assert(count <= GROUND_KIT_INSTANCE_ALLOWANCE, "Ground kit decoration exceeded its instance allowance");
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
