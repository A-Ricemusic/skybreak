import { Workspace } from "@rbxts/services";
import { ActorPlacement } from "../shared/ActorPlacement";

/** How a protected actor sits: its pivot's height above its bounds' bottom, and whether it floats. */
export interface ActorFooting { pivotAboveBottom: number; boat: boolean }
const PROBE_TOP = 1500;
const PROBE_DEPTH = 1700;

/**
 * Grounds protected actors from their bounds and the surface under them, so a truck rides the
 * road, a tower stands on its pad and a launch floats at the waterline (or sits on a beach),
 * whatever the world builder put there.
 */
export const ActorGrounding = {
	Footing(model: Model, boat: boolean): ActorFooting {
		const [bounds, size] = model.GetBoundingBox();
		return { pivotAboveBottom: model.GetPivot().Position.Y - (bounds.Position.Y - size.Y / 2), boat };
	},
	/** Surface height under (x, z) among `params` (scenery and terrain, water surfaces included), if any. */
	Sample(x: number, z: number, params: RaycastParams): { y: number; water: boolean } | undefined {
		const hit = Workspace.Raycast(new Vector3(x, PROBE_TOP, z), new Vector3(0, -PROBE_DEPTH, 0), params);
		if (!hit) return undefined;
		return { y: hit.Position.Y, water: ActorPlacement.IsWater(hit.Material.Name, hit.Instance.Name) };
	},
	/** Pivot height for an actor at (x, z); `fallbackY` when nothing is underneath. */
	PivotY(footing: ActorFooting, x: number, z: number, params: RaycastParams, fallbackY: number): number {
		const surface = ActorGrounding.Sample(x, z, params);
		if (!surface) return fallbackY;
		return ActorPlacement.PivotY(surface.y, footing.pivotAboveBottom, footing.boat && surface.water);
	},
};
