import type { PartSpec, PropAsset, WorldPlan } from "./WorldPlan";

export type WorldKit = "RunwayTile" | "RoadTile" | "CliffTile";
export const KIT_BOUNDS: Record<WorldKit, number[]> = {
	RunwayTile: [120, 1.45, 100], RoadTile: [38, 0.98, 100], CliffTile: [200, 100, 66.958328],
};
export const DISTRICT_MISSIONS = [3, 5, 19];

/** A representative outer district per biome. No multiplication of mission coordinates.
 * This belt was behind the old hard boundary. Its earthworks replace only the
 * east horizon ridge, leaving authored routes/targets/boats and their terrain intact.
 * Reuse the kit at authored scale; the plan's bounds are also the collision audit.
 */
export function expandDistrict(plan: WorldPlan): void {
	if (!DISTRICT_MISSIONS.includes(plan.id)) return;
	const kit = (kind: WorldKit, x: number, z: number, yaw = 0) => {
		const [sx, sy, sz] = KIT_BOUNDS[kind];
		plan.parts.push({ name: kind, mesh: kind, shape: "block", x, y: 44 + sy / 2, z, sx, sy, sz, yaw,
			color: kind === "CliffTile" ? [132, 121, 106] : [68, 72, 75], material: "Concrete", solid: true, grounded: true });
	};
	const prop = (asset: PropAsset, x: number, z: number, yaw = 0, scale = 1) => {
		plan.props.push({ asset, x, y: 44, z, yaw, scale, tint: 0, tag: "OuterDistrict" });
	};
	// Cut the former horizon into a broad pass with the district on its floor.
	// 4-stud grid alignment keeps analytic and voxel support surfaces equal.
	plan.ops.push({ shape: "block", material: "Air", x: 3200, y: 344, z: 0, sx: 1000, sy: 600, sz: 2800, yaw: 0 });
	plan.ops.push({ shape: "block", material: plan.id === 3 ? "Ground" : "Grass", x: 3200, y: 40, z: 0, sx: 1000, sy: 8, sz: 2800, yaw: 0 });
	// A repeated, bounded road network: 2.4 km in game units including a
	// west access spur, a north/south spine and two short facility turnoffs.
	for (let z = -950; z <= 950; z += 100) kit("RoadTile", 3400, z);
	for (let x = 2750; x <= 3350; x += 100) kit("RoadTile", x, 1100, math.pi / 2);
	for (const z of [-600, 600]) for (const x of [3250, 3350]) kit("RoadTile", x, z, math.pi / 2);
	// Cliff buttresses border the eastern escarpment; varied strata are real
	// geometry. They remain 150 studs away from the road and never overhang it.
	for (let z = -1100; z <= 1100; z += 200) kit("CliffTile", 3650, z, math.pi / 2);
	if (plan.id === 3) {
		for (let z = -650; z <= 650; z += 100) kit("RunwayTile", 2950, z);
		for (const z of [-450, 0, 450]) prop("Hangar", 3170, z, math.pi / 2);
		prop("RadarDish", 3170, 850);
		// Displaced thresholds and aiming blocks are separate paint, not tall obstacles.
		for (const z of [-610, 610]) for (const dx of [-32, -20, 20, 32]) {
			plan.parts.push({ name: "Outer runway threshold", shape: "block", x: 2950 + dx, y: 45.5, z, sx: 7, sy: 0.08, sz: 40, yaw: 0, color: [230, 230, 214], material: "Concrete", solid: false, grounded: false });
		}
	} else if (plan.id === 5) {
		for (const z of [-700, 0, 700]) {
			prop("Farmhouse", 3100, z); prop("Barn", 3220, z + 160); prop("GrainSilo", 3200, z + 260);
			// Field swath with inset earth margin; no transparent overlay fill cost.
			plan.ops.push({ shape: "block", material: "Ground", x: 2890, y: 42, z, sx: 300, sy: 4, sz: 480, yaw: 0 });
			for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) prop("Broadleaf", 2800 + row * 80, z - 120 + col * 120, 0, 0.7);
		}
	} else {
		// Inland port logistics district (the existing waterfront remains intact).
		for (const z of [-700, 0, 700]) {
			prop("ContainerStack", 2950, z); prop("ContainerStack", 3100, z);
			prop("OfficeMidrise", 3200, z + 200, math.pi / 2, 0.7);
		}
	}
	for (const z of [-1250, 1250]) for (let x = 2800; x <= 3500; x += 100) prop(plan.id === 3 ? "RockB" : "Pine", x, z, x / 100, plan.id === 3 ? 1.4 : 0.8);
}
