import { Workspace } from "@rbxts/services";
import { sphereSweep } from "../shared/SphereSweep";

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
	/** Conservative destination volume check. Bounds queries include off-centre
	 * initial part overlaps (Spherecast does not); voxel occupancy also covers
	 * terrain and water, which part overlap queries omit. Same authored allowlist. */
	DestinationClear(origin: Vector3, params: RaycastParams): boolean {
		const overlap = new OverlapParams();
		overlap.FilterType = params.FilterType;
		overlap.FilterDescendantsInstances = params.FilterDescendantsInstances;
		overlap.CollisionGroup = params.CollisionGroup;
		overlap.RespectCanCollide = params.RespectCanCollide;
		if (Workspace.GetPartBoundsInRadius(origin, 4, overlap).size() > 0) return false;
		const region = new Region3(origin.sub(new Vector3(4, 4, 4)), origin.add(new Vector3(4, 4, 4))).ExpandToGrid(4);
		const [, occupancy] = Workspace.Terrain.ReadVoxels(region, 4);
		// ReadVoxels tables include a Size Vector3; generalized iteration visits
		// that metadata too. Index only the numeric voxel dimensions.
		const size = occupancy.Size;
		for (let x = 0; x < size.X; x++) {
			for (let y = 0; y < size.Y; y++) {
				for (let z = 0; z < size.Z; z++) if (occupancy[x][y][z] > 0) return false;
			}
		}
		return true;
	},
	/** Sweep a compact 4-stud fuselage radius, not the visual wings' enclosing box.
	 * At the 600 studs/s cap this sweeps all 20 studs of a 1/30 s step.
	 */
	Sweep(from: Vector3, to: Vector3, params: RaycastParams): RaycastResult | undefined {
		return sphereSweep(from, 4, to.sub(from), params)?.hit;
	},
	Reason(hit: RaycastResult): string {
		return hit.Material === Enum.Material.Water || (hit.Instance.Name === "Sea" || hit.Instance.Name === "River") ? "crash_water" : "crash_terrain";
	},
};
