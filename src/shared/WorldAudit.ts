import { MissionCatalog } from "./MissionCatalog";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";
import {
	APRON_TOP, GROUND, SEABED, WATER_Y, WORLD_BUDGET, countPlan, polyDist, propBox, solidTopWithin, surfaceAt, terrainTop,
	type PropSpec, type WorldPlan,
} from "./WorldPlan";

// Offline audit of a world plan (no Studio): every authored flight point and
// route leg clear of solid geometry, targets on their authored XZ and on the
// ground, grounded parts and props resting on what is under them (nothing
// floating), boats on water, and the per-world mobile budget. Each problem is
// a readable line so a failing spec says exactly what moved.

const WATERLINE_ASSETS = new Set<string>(["Frigate", "OilPlatform", "HarbourQuay"]);
/** Largest gap allowed between a footprint's bottom and the surface under it. */
const FLOAT_TOLERANCE = 1.5;

function corners(x: number, z: number, hx: number, hz: number, yaw: number): number[][] {
	const c = math.cos(yaw), s = math.sin(yaw), out: number[][] = [[x, z]];
	for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
		const lx = sx * hx * 0.9, lz = sz * hz * 0.9;
		out.push([x + c * lx + s * lz, z - s * lx + c * lz]);
	}
	return out;
}

function propProblems(plan: WorldPlan, p: PropSpec, out: string[]): void {
	const box = propBox(p);
	const tag = `${p.asset} at (${math.floor(p.x)}, ${math.floor(p.z)})`;
	if (WATERLINE_ASSETS.has(p.asset)) {
		if (math.abs(p.y - WATER_Y) > 0.01) out.push(`${tag}: waterline asset not at the water surface`);
		const t = terrainTop(plan.ops, p.x, p.z);
		if (p.asset !== "HarbourQuay" && t.water === undefined) out.push(`${tag}: not on water`);
		// The hull or legs must reach the water (or the seabed for the quay wall).
		if (box.bottom > WATER_Y) out.push(`${tag}: bottom ${box.bottom} above the waterline`);
		return;
	}
	// Every other prop rests on terrain or a quay deck. Trees and rocks are checked at their trunk or
	// contact point (a canopy or a boulder's flank may hang over a slope); buildings across 90% of the footprint.
	const small = p.asset === "Pine" || p.asset === "Broadleaf" || p.asset.sub(1, 4) === "Rock";
	// The gantry's legs stand on the quay deck; its boom and back reach overhang the berth and the yard.
	const points = small ? corners(p.x, p.z, 2, 2, p.yaw) : p.asset === "GantryCrane" ? corners(p.x, p.z, box.rect.hx, 30, p.yaw) : corners(p.x, p.z, box.rect.hx, box.rect.hz, p.yaw);
	let highest = -math.huge, lowest = math.huge;
	for (const [x, z] of points) {
		const t = supportAt(plan, x, z, p);
		if (t === undefined) { out.push(`${tag}: footprint over the void or water`); return; }
		highest = math.max(highest, t);
		lowest = math.min(lowest, t);
	}
	if (box.bottom > lowest + FLOAT_TOLERANCE) out.push(`${tag}: floats ${math.floor((box.bottom - lowest) * 10) / 10} studs over the ground`);
	if (!small && box.bottom < highest - UploadedAssetSpecs[p.asset].size.Y * p.scale * 0.25) out.push(`${tag}: buried more than a quarter of its height`);
}

/** Dry support under (x, z): terrain top, or a quay deck the prop stands on. */
function supportAt(plan: WorldPlan, x: number, z: number, own: PropSpec): number | undefined {
	const t = terrainTop(plan.ops, x, z);
	let top = t.water === undefined && t.solid > -math.huge ? t.solid : undefined;
	for (const q of plan.props) {
		if (q === own || q.asset !== "HarbourQuay") continue;
		const box = propBox(q);
		const c = math.cos(q.yaw), s = math.sin(q.yaw), dx = x - q.x, dz = z - q.z;
		if (math.abs(c * dx - s * dz) <= box.rect.hx && math.abs(s * dx + c * dz) <= box.rect.hz) top = math.max(top ?? -math.huge, box.top);
	}
	return top;
}

export interface AuditResult { problems: string[]; checkedAir: number; checkedProps: number; checkedParts: number }

export function auditPlan(plan: WorldPlan): AuditResult {
	const problems: string[] = [];
	const bp = MissionCatalog.Get(plan.id);
	// Flight clearance: terrain, solid parts and prop bounds stay under every authored point, leg and ceiling.
	for (const s of plan.air) {
		const top = solidTopWithin(plan, s.x, s.z, s.rad);
		if (top >= s.limit) problems.push(`${s.label} at (${math.floor(s.x)}, ${math.floor(s.z)}): solid top ${math.floor(top)} >= limit ${math.floor(s.limit)}`);
	}
	// Targets: authored XZ, level base on the apron or deck, apron resting on terrain or deck legs.
	if (plan.targets.size() !== bp.ground.size()) problems.push(`targets: ${plan.targets.size()} sites for ${bp.ground.size()} authored targets`);
	for (const t of plan.targets) {
		const g = bp.ground[t.index];
		if (g === undefined || math.abs(g.x - t.x) > 0.01 || math.abs(g.z - t.z) > 0.01) { problems.push(`target ${t.index + 1}: moved off its authored XZ`); continue; }
		const s = surfaceAt(plan, t.x, t.z);
		if (s.kind !== "part" || math.abs(s.y - t.baseY) > 0.01) problems.push(`target ${t.index + 1}: base surface ${s.kind} ${s.name} at ${s.y}, expected ${t.baseY}`);
		if (!t.deck) {
			if (t.baseY !== APRON_TOP) problems.push(`target ${t.index + 1}: apron top ${t.baseY}`);
			for (const [x, z] of corners(t.x, t.z, t.apron / 2, t.apron / 2, 0)) {
				const ground = terrainTop(plan.ops, x, z);
				if (ground.water !== undefined || math.abs(ground.solid - (APRON_TOP - 4)) > FLOAT_TOLERANCE) problems.push(`target ${t.index + 1}: apron corner over ${ground.water !== undefined ? "water" : `ground at ${ground.solid}`}`);
			}
		}
	}
	// Grounded parts: bottom meets the terrain (or sits inside it) at the centre and corners.
	let checkedParts = 0;
	for (const p of plan.parts) {
		if (!p.grounded) continue;
		checkedParts += 1;
		const bottom = p.y - p.sy / 2;
		const hz = p.shape === "cylinder" || p.shape === "ball" ? p.sx / 2 : p.sz / 2;
		for (const [x, z] of corners(p.x, p.z, p.sx / 2, hz, p.yaw)) {
			const t = terrainTop(plan.ops, x, z);
			if (t.solid === -math.huge || bottom > t.solid + FLOAT_TOLERANCE) { problems.push(`${p.name} at (${math.floor(p.x)}, ${math.floor(p.z)}): floats over ${t.solid === -math.huge ? "the void" : `ground at ${math.floor(t.solid)}`} (bottom ${bottom})`); break; }
		}
	}
	for (const p of plan.props) propProblems(plan, p, problems);
	// Boats: every escort, defend and parked point on the coast and ocean sits on open water.
	for (const path of plan.waterPaths) for (const pt of path.points) {
		const t = terrainTop(plan.ops, pt[0], pt[1]);
		const beached = path.beachEnd && pt === path.points[path.points.size() - 1];
		if (!beached && (t.water === undefined || t.water < WATER_Y - 0.01 || t.solid > SEABED + 0.01)) problems.push(`boat point (${pt[0]}, ${pt[1]}): no open water`);
		for (const p of plan.props) {
			if (p.asset === "Pine" || p.asset === "Broadleaf" || p.asset.sub(1, 4) === "Rock") continue;
			const r = propBox(p).rect;
			if (polyDist(p.x, p.z, [pt]) < math.min(r.hx, r.hz)) problems.push(`boat point (${pt[0]}, ${pt[1]}): inside ${p.asset}`);
		}
	}
	// Ground convoys drive on dry land at ground level.
	for (const path of plan.groundPaths) for (const pt of path) {
		const t = terrainTop(plan.ops, pt[0], pt[1]);
		if (t.water !== undefined || math.abs(t.solid - GROUND) > 0.01) problems.push(`convoy point (${pt[0]}, ${pt[1]}): ground at ${t.solid}${t.water !== undefined ? " (water)" : ""}`);
	}
	const c = countPlan(plan);
	if (c.parts > WORLD_BUDGET.parts) problems.push(`budget: ${c.parts} parts > ${WORLD_BUDGET.parts}`);
	if (c.props > WORLD_BUDGET.props) problems.push(`budget: ${c.props} props > ${WORLD_BUDGET.props}`);
	if (c.uniqueMeshes > WORLD_BUDGET.uniqueMeshes) problems.push(`budget: ${c.uniqueMeshes} unique meshes > ${WORLD_BUDGET.uniqueMeshes}`);
	if (c.voxelWrites > WORLD_BUDGET.voxelWrites) problems.push(`budget: ${c.voxelWrites} voxel writes > ${WORLD_BUDGET.voxelWrites}`);
	if (c.bumpCells > WORLD_BUDGET.bumpCells) problems.push(`budget: ${c.bumpCells} bump cells > ${WORLD_BUDGET.bumpCells}`);
	if (c.terrainOps > WORLD_BUDGET.terrainOps) problems.push(`budget: ${c.terrainOps} terrain ops > ${WORLD_BUDGET.terrainOps}`);
	return { problems, checkedAir: plan.air.size(), checkedProps: plan.props.size(), checkedParts };
}
