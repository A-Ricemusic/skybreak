import { Workspace } from "@rbxts/services";
import { isFiniteNumber } from "./Finite";

const CRITICAL_ID = "SkybreakLoadingCritical";
export interface TerrainReadinessBounds {
	minY: number;
	maxY: number;
}
export interface TerrainColumnExpectation {
	minY: number;
	maxY: number;
	material: Enum.Material;
}
export interface LoadingTerrainProbe {
	origin: Vector3;
	distance: number;
	/** Absence is explicit, authoritative voxel evidence for an empty column, never a missed ray. */
	expected?: TerrainColumnExpectation;
	position?: Vector3;
}
export interface TerrainColumnHit {
	Position: Vector3;
	Material: Enum.Material;
}

/** Exact identities for flight collision scenery and initial actor/target roots; cosmetic counts cannot substitute. */
export function markCriticalGeometry(folder: Instance, roots: BasePart[]): number {
	const required = new Set(roots);
	let id = 0;
	for (const item of folder.GetDescendants()) {
		if (!item.IsA("BasePart") || (item.GetAttribute("FlightSolid") !== true && !required.has(item))) continue;
		item.SetAttribute(CRITICAL_ID, ++id);
	}
	return id;
}

export function criticalGeometryReady(folder: Instance, expected: number | undefined): boolean {
	if (!isFiniteNumber(expected) || expected < 1 || expected % 1 !== 0) return false;
	const ids = new Set<number>();
	for (const item of folder.GetDescendants()) {
		if (!item.IsA("BasePart")) continue;
		const id = item.GetAttribute(CRITICAL_ID);
		if (isFiniteNumber(id) && id >= 1 && id <= expected && id % 1 === 0) {
			if (ids.has(id)) return false;
			ids.add(id);
		}
	}
	return ids.size() === expected;
}

/** WorldRoot.Raycast's documented maximum is 15,000 studs. */
export const MAX_TERRAIN_RAY = 15000;
export function terrainColumnHit(origin: Vector3, distance: number): TerrainColumnHit | undefined {
	assert(isFiniteNumber(distance) && distance > 0 && distance <= MAX_TERRAIN_RAY, "Invalid terrain ray range");
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	params.FilterDescendantsInstances = [Workspace.Terrain];
	params.IgnoreWater = false;
	return Workspace.Raycast(origin, new Vector3(0, -distance, 0), params);
}

/** Read the highest occupied voxel in one owned-world column; native voxel writes are synchronous. */
export function snapshotTerrainColumn(position: Vector3, bounds: TerrainReadinessBounds): LoadingTerrainProbe {
	assert(
		isFiniteNumber(bounds.minY) && isFiniteNumber(bounds.maxY) && bounds.minY <= bounds.maxY,
		"Invalid owned terrain bounds",
	);
	const bottom = math.floor(bounds.minY / 4) * 4 - 4;
	const top = math.ceil(math.max(bounds.maxY, position.Y) / 4) * 4 + 8;
	const x = math.floor(position.X / 4) * 4;
	const z = math.floor(position.Z / 4) * 4;
	const distance = top - bottom;
	assert(distance > 0 && distance <= MAX_TERRAIN_RAY, "Owned terrain column exceeds supported ray range");
	const [materials, occupancy] = Workspace.Terrain.ReadVoxels(
		new Region3(new Vector3(x, bottom, z), new Vector3(x + 4, top, z + 4)),
		4,
	);
	const origin = new Vector3(x + 2, top, z + 2);
	for (let y = materials.Size.Y - 1; y >= 0; y--) {
		if (materials[0][y][0] !== Enum.Material.Air && occupancy[0][y][0] > 0) {
			return {
				origin,
				distance,
				expected: { minY: bottom + y * 4, maxY: bottom + y * 4 + 4, material: materials[0][y][0] },
			};
		}
	}
	return { origin, distance };
}

function matchesColumn(probe: LoadingTerrainProbe, hit: TerrainColumnHit | undefined): boolean {
	const expected = probe.expected;
	if (!expected) return hit === undefined;
	return (
		hit !== undefined &&
		hit.Material === expected.material &&
		hit.Position.Y >= expected.minY - 4 &&
		hit.Position.Y <= expected.maxY + 4
	);
}

/** Settle collision against authoritative post-write voxels, with no fixed sleep or omitted required misses. */
export function captureTerrainProbes(
	positions: Vector3[],
	options: {
		bounds: TerrainReadinessBounds;
		alive?: () => boolean;
		timeout?: number;
		snapshot?: (position: Vector3, bounds: TerrainReadinessBounds) => LoadingTerrainProbe;
		raycast?: (origin: Vector3, distance: number) => TerrainColumnHit | undefined;
	},
): LoadingTerrainProbe[] | undefined {
	const alive = options.alive ?? (() => true);
	const deadline = os.clock() + (options.timeout ?? 2);
	if (!alive() || positions.isEmpty()) return undefined;
	const probes = positions.map((position) => (options.snapshot ?? snapshotTerrainColumn)(position, options.bounds));
	const cast = options.raycast ?? terrainColumnHit;
	while (alive() && os.clock() < deadline) {
		let settled = true;
		for (const probe of probes) {
			const hit = cast(probe.origin, probe.distance);
			if (!matchesColumn(probe, hit)) settled = false;
			else probe.position = hit?.Position;
		}
		if (settled && alive()) return probes;
		task.wait();
	}
	return undefined;
}

export function terrainProbesReady(probes: LoadingTerrainProbe[] | undefined): boolean {
	if (!probes || probes.isEmpty()) return false;
	for (const probe of probes) {
		const expected = probe.expected;
		const localColumn = snapshotTerrainColumn(probe.origin.sub(new Vector3(0, 8, 0)), {
			minY: probe.origin.Y - probe.distance + 4,
			maxY: probe.origin.Y - 8,
		});
		if (
			expected === undefined
				? localColumn.expected !== undefined
				: localColumn.expected === undefined ||
					localColumn.expected.material !== expected.material ||
					localColumn.expected.minY !== expected.minY
		)
			return false;
		const hit = terrainColumnHit(probe.origin, probe.distance);
		if (!matchesColumn(probe, hit)) return false;
		if (probe.position && (!hit || hit.Position.sub(probe.position).Magnitude > 4)) return false;
	}
	return true;
}
