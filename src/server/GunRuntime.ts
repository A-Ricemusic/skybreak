import { Workspace } from "@rbxts/services";
import { GunRules } from "../shared/SortieArmament";

/** The session's terrain/scenery filter with water ignored: water is not cover, so waterline hulls stay hittable. Build once per sortie. */
export function gunRaycastParams(surfaces: RaycastParams): RaycastParams {
	const params = new RaycastParams();
	params.FilterType = surfaces.FilterType;
	params.FilterDescendantsInstances = surfaces.FilterDescendantsInstances;
	params.RespectCanCollide = surfaces.RespectCanCollide;
	params.IgnoreWater = true;
	return params;
}
/** Any terrain/scenery hit before the aim point blocks the round (GunRules.Occluded); the target's own parts never do. */
export function gunOccluded(params: RaycastParams, from: Vector3, aim: Vector3, target: Instance): boolean {
	const delta = aim.sub(from);
	const result = Workspace.Raycast(from, delta, params);
	return GunRules.Occluded(result?.Distance, result !== undefined && result.Instance.IsDescendantOf(target), delta.Magnitude);
}
