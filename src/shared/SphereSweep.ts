import { Workspace } from "@rbxts/services";
import { FlightMath } from "./FlightMath";

/** WorldRoot Spherecast allows 1024 studs and radius 256. Leave room for
 * Vector3 float rounding, including diagonal directions, at each segment.
 * https://create.roblox.com/docs/reference/engine/classes/WorldRoot#Spherecast
 */
export const SPHERE_SEGMENT_LENGTH = 1000;
function finiteVector(v: Vector3): boolean {
	return FlightMath.IsFinite(v.X) && FlightMath.IsFinite(v.Y) && FlightMath.IsFinite(v.Z);
}

/** First hit along the whole path. Distance is sphere travel from the original
 * origin, not the last segment's origin or the surface contact position.
 * As with Spherecast, initial overlaps are not detected. Callers own filters.
 */
export function sphereSweep(origin: Vector3, radius: number, delta: Vector3, params: RaycastParams): { hit: RaycastResult; distance: number } | undefined {
	if (!finiteVector(origin) || !finiteVector(delta) || !FlightMath.IsFinite(radius) || radius <= 0 || radius > 256) return undefined;
	const length = delta.Magnitude;
	// Reject corrupt paths rather than spending unbounded time in the render loop.
	// One million studs is far beyond any mission/correction, not an airspeed cap.
	if (!FlightMath.IsFinite(length) || length <= 0.00001 || length > 1000000) return undefined;
	const unit = delta.div(length);
	const count = math.ceil(length / SPHERE_SEGMENT_LENGTH);
	for (let i = 0; i < count; i++) {
		const offset = i * SPHERE_SEGMENT_LENGTH;
		const hit = Workspace.Spherecast(origin.add(unit.mul(offset)), radius, unit.mul(math.min(SPHERE_SEGMENT_LENGTH, length - offset)), params);
		if (hit) return { hit, distance: offset + hit.Distance };
	}
	return undefined;
}
