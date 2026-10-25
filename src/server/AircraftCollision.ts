import { Workspace } from "@rbxts/services";

/** Allowlist contains only authored scenery and visible ground-target surfaces.
 * No aircraft, projectiles, navigation rings, UI markers or invisible aim roots.
 * CanCollide stays false: server flight, not Roblox rigid-body physics, owns motion.
 */
export const AircraftCollision = {
	Parameters(folder: Instance): RaycastParams {
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		const surfaces: Instance[] = [Workspace.Terrain];
		for (const item of folder.GetDescendants()) {
			if (item.IsA("BasePart") && item.GetAttribute("FlightSolid") === true) surfaces.push(item);
		}
		params.FilterDescendantsInstances = surfaces;
		params.IgnoreWater = false;
		params.RespectCanCollide = false;
		return params;
	},
	/** Sweep a compact 4-stud fuselage radius, not the visual wings' enclosing box.
	 * At 320 studs/s this still covers the entire fixed-step path (no tunnelling).
	 */
	Sweep(from: Vector3, to: Vector3, params: RaycastParams): RaycastResult | undefined {
		const delta = to.sub(from);
		return delta.Magnitude > 0.00001 ? Workspace.Spherecast(from, 4, delta, params) : undefined;
	},
	Reason(hit: RaycastResult): string {
		return hit.Material === Enum.Material.Water || (hit.Instance.Name === "Sea" || hit.Instance.Name === "River") ? "crash_water" : "crash_terrain";
	},
};
