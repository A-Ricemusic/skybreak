import { Workspace } from "@rbxts/services";
import { isFiniteNumber } from "./Finite";

const CRITICAL_ID = "SkybreakLoadingCritical";
export interface LoadingTerrainProbe {
	origin: Vector3;
	position: Vector3;
	material: Enum.Material;
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

function terrainHit(origin: Vector3): RaycastResult | undefined {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	params.FilterDescendantsInstances = [Workspace.Terrain];
	params.IgnoreWater = false;
	return Workspace.Raycast(origin, new Vector3(0, -20000, 0), params);
}

/** Samples launch/initial-target columns, not all terrain or device rendering. No hit means no terrain prerequisite there. */
export function captureTerrainProbes(positions: Vector3[]): LoadingTerrainProbe[] {
	const probes: LoadingTerrainProbe[] = [];
	for (const position of positions) {
		const origin = position.add(new Vector3(0, 512, 0));
		const hit = terrainHit(origin);
		if (hit) probes.push({ origin, position: hit.Position, material: hit.Material });
	}
	return probes;
}

export function terrainProbesReady(probes: LoadingTerrainProbe[] | undefined): boolean {
	if (!probes) return false;
	for (const probe of probes) {
		const hit = terrainHit(probe.origin);
		if (!hit || hit.Material !== probe.material || hit.Position.sub(probe.position).Magnitude > 4) return false;
	}
	return true;
}
