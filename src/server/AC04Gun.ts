/** Hit distance for a server ray. Solid targets use their actual surface; non-query
 * aircraft retain the arcade aim radius, clipped by the nearest obstruction. */
export function ac04GunHitDistance(model: Model, center: Vector3, origin: Vector3, forward: Vector3, range: number, obstruction?: RaycastResult): number | undefined {
	if (obstruction?.Instance.IsDescendantOf(model)) return obstruction.Distance;
	const along = center.sub(origin).Dot(forward);
	const reach = obstruction?.Distance ?? range;
	if (along < 0 || along > math.min(range, reach)) return undefined;
	const distanceFromRay = center.sub(origin.add(forward.mul(along))).Magnitude;
	return distanceFromRay <= math.max(14, model.GetExtentsSize().Magnitude * .18) ? along : undefined;
}
