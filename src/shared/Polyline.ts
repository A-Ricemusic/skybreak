// Dependency-free polyline geometry, shared by world plans that must not import the mission catalog.
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
	const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
	const t = len2 > 0 ? math.clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1) : 0;
	const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
	return math.sqrt(dx * dx + dz * dz);
}
/** Horizontal distance from (px, pz) to the polyline through `points` ([x, z] pairs). */
export function polyDist(px: number, pz: number, points: number[][]): number {
	if (points.size() === 1) return math.sqrt((px - points[0][0]) * (px - points[0][0]) + (pz - points[0][1]) * (pz - points[0][1]));
	let best = math.huge;
	for (let i = 1; i < points.size(); i++) best = math.min(best, segDist(px, pz, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
	return best;
}
