import { ActorPlacement } from "./ActorPlacement";
import { FlightMath } from "./FlightMath";
import { MissionCatalog } from "./MissionCatalog";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";
import {
	APRON_TOP, CORE, EXTENT, FAR, GROUND, OUTER_CEILING, SEABED, WATER_Y, WORLD_BUDGET, countPlan, polyDist, propBox, ring, solidTopWithin, surfaceAt, terrainTop,
	type PropSpec, type WorldPlan,
} from "./WorldPlan";

// Offline audit of a world plan (no Studio): every authored flight point and
// route leg clear of solid geometry, targets on their authored XZ and on the
// ground, grounded parts and props resting on what is under them (nothing
// floating), boats on water along every escort leg (not just its vertices) with
// water under their keels, and the per-world mobile budget. Each problem is a
// readable line so a failing spec says exactly what moved.

const WATERLINE_ASSETS = new Set<string>(["Frigate", "OilPlatform", "HarbourQuay", "StoreDeck"]);
/** Flat modular pieces sunk a stud or so into the ground (or, for hardstands, half their thickness): no burial check. */
const FLAT_ASSETS = new Set<string>(["RunwaySegment", "RunwayThreshold", "ApronSlab", "RoadSegment", "DirtTrack", "TargetPad"]);
/** Eye height every backdrop crest must clear: the altitude ceiling plus a chase camera's lift. */
export const HORIZON_EYE = FlightMath.MaxAltitude + 60;
/** Studs every backdrop ridge's footprint keeps outside the hard boundary. */
const BACKDROP_CLEAR = 200;
/** Largest gap allowed between a footprint's bottom and the surface under it. */
const FLOAT_TOLERANCE = 1.5;
/** Water always left between a hull's keel and the seabed: one voxel layer. */
export const KEEL_MIN = 4;
/** The protected HarborLaunch's plan footprint (assets/mission/harborlaunch.mesh.json: 26 wide, 57 long). */
export const LAUNCH_HALF_WIDTH = 13;
export const LAUNCH_HALF_LENGTH = 28.5;
/** Spacing of the launch footprint samples along an escort leg. */
const PATH_STEP = 10;

function corners(x: number, z: number, hx: number, hz: number, yaw: number): number[][] {
	const c = math.cos(yaw), s = math.sin(yaw), out: number[][] = [[x, z]];
	for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
		const lx = sx * hx * 0.9, lz = sz * hz * 0.9;
		out.push([x + c * lx + s * lz, z - s * lx + c * lz]);
	}
	return out;
}

/** (x, z) of a point given in a prop's local frame (scaled studs). */
function atLocal(p: PropSpec, lx: number, lz: number): [number, number] {
	const c = math.cos(p.yaw), s = math.sin(p.yaw);
	return [p.x + c * lx + s * lz, p.z - s * lx + c * lz];
}
/** Special rules for the bigger-world pieces; true when the prop is fully handled. */
function specialProblems(plan: WorldPlan, p: PropSpec, tag: string, out: string[]): boolean {
	const spec = UploadedAssetSpecs[p.asset], box = propBox(p);
	const hx = spec.size.X * p.scale / 2, hz = spec.size.Z * p.scale / 2;
	if (p.tag === "backdrop") {
		// The ring stands wholly past the flyable edge; its crest clears the eye height (horizonProblems checks coverage).
		for (const [x, z] of corners(p.x, p.z, hx / 0.9, hz / 0.9, p.yaw)) {
			if (ring(x, z) < FlightMath.HardBoundary + BACKDROP_CLEAR) { out.push(`${tag}: backdrop ridge reaches (${math.floor(x)}, ${math.floor(z)}) inside the flyable edge`); break; }
		}
		if (box.bottom + (spec.crest ?? 0) * p.scale < HORIZON_EYE) out.push(`${tag}: crest under the eye height ${HORIZON_EYE}`);
		return true;
	}
	if (p.tag === "island") {
		if (ring(p.x, p.z) < EXTENT + 1000) out.push(`${tag}: far island inside the voxel edge`);
		return true;
	}
	if (p.asset === "Gangway") return true; // elevated: spans from a store deck to the platform over open water
	if (p.asset === "RoadBridge") {
		// Ramp ends on the banks at the contact height; piers on the river bed.
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
			const [x, z] = atLocal(p, sx * hx * 0.6, sz * (hz - 3));
			const t = terrainTop(plan.ops, x, z);
			if (t.water !== undefined || math.abs(t.solid - p.y) > FLOAT_TOLERANCE) { out.push(`${tag}: ramp end at (${math.floor(x)}, ${math.floor(z)}) not on the bank (ground ${t.solid})`); return true; }
		}
		for (const sz of [-1, 1]) {
			const [x, z] = atLocal(p, 0, sz * 40 * p.scale);
			const t = terrainTop(plan.ops, x, z);
			if (math.abs(t.solid - box.bottom) > FLOAT_TOLERANCE) out.push(`${tag}: pier at (${math.floor(x)}, ${math.floor(z)}) meets the bed at ${t.solid}, footing at ${box.bottom}`);
		}
		return true;
	}
	let points: number[][] | undefined;
	if (p.asset === "CliffSandstone" || p.asset === "CliffGranite") {
		// The panel's back is set into a mesa wall; its front foot rests on the ground or the talus.
		points = [atLocal(p, -hx * 0.4, -hz * 0.6), atLocal(p, 0, -hz * 0.6), atLocal(p, hx * 0.4, -hz * 0.6)];
	} else if (p.asset === "PowerLineSpan") {
		// The pylon stands at the front end; the conductors overhang the ground back to the previous pylon.
		const [x, z] = atLocal(p, 0, -(hz - 7 * p.scale));
		points = corners(x, z, 6 * p.scale, 6 * p.scale, p.yaw);
	} else if (p.asset === "FenceSpan") {
		points = [atLocal(p, 0, -hz * 0.9), atLocal(p, 0, 0), atLocal(p, 0, hz * 0.9)];
	}
	if (points === undefined) return false;
	let lowest = math.huge;
	for (const [x, z] of points) {
		const t = supportAt(plan, x, z, p);
		if (t === undefined) { out.push(`${tag}: footprint over the void or water`); return true; }
		lowest = math.min(lowest, t);
	}
	if (box.bottom > lowest + FLOAT_TOLERANCE) out.push(`${tag}: floats ${math.floor((box.bottom - lowest) * 10) / 10} studs over the ground`);
	return true;
}

function propProblems(plan: WorldPlan, p: PropSpec, out: string[]): void {
	const box = propBox(p);
	const tag = `${p.asset} at (${math.floor(p.x)}, ${math.floor(p.z)})`;
	if (specialProblems(plan, p, tag, out)) return;
	if (WATERLINE_ASSETS.has(p.asset)) {
		if (math.abs(p.y - WATER_Y) > 0.01) out.push(`${tag}: waterline asset not at the water surface`);
		const t = terrainTop(plan.ops, p.x, p.z);
		if (p.asset !== "HarbourQuay" && t.water === undefined) out.push(`${tag}: not on water`);
		// The hull or legs must reach the water (or the seabed for the quay wall).
		if (box.bottom > WATER_Y) out.push(`${tag}: bottom ${box.bottom} above the waterline`);
		// A frigate floats: open water at the surface and the seabed clear of its keel across the hull.
		if (p.asset === "Frigate") for (const [x, z] of corners(p.x, p.z, box.rect.hx, box.rect.hz, p.yaw)) {
			const under = terrainTop(plan.ops, x, z);
			if (under.water === undefined || math.abs(under.water - WATER_Y) > 0.01) { out.push(`${tag}: hull at (${math.floor(x)}, ${math.floor(z)}) not on open water`); break; }
			if (under.solid > box.bottom - KEEL_MIN) { out.push(`${tag}: keel at ${box.bottom} within ${KEEL_MIN} of the seabed at ${under.solid}`); break; }
		}
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
	if (!small && !FLAT_ASSETS.has(p.asset) && box.bottom < highest - UploadedAssetSpecs[p.asset].size.Y * p.scale * 0.25) out.push(`${tag}: buried more than a quarter of its height`);
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

/** Why a launch hull point at (x, z) is not afloat in open water, or undefined when it is. */
function notAfloat(plan: WorldPlan, x: number, z: number): string | undefined {
	const t = terrainTop(plan.ops, x, z);
	if (t.water === undefined || math.abs(t.water - WATER_Y) > 0.01) return `no open water (terrain top ${t.solid})`;
	const keel = WATER_Y - ActorPlacement.Draught;
	if (t.solid > keel - KEEL_MIN) return `seabed ${t.solid} under the keel at ${keel}`;
	// The escort is re-grounded by a ray from above: any solid part or prop over the water lifts it.
	const s = surfaceAt(plan, x, z);
	if (s.kind !== "water") return `covered by ${s.name} at ${math.floor(s.y)}`;
	return undefined;
}
/** The launch's centre and hull corners at (x, z) heading along (ux, uz). */
function launchFootprint(x: number, z: number, ux: number, uz: number): number[][] {
	const out = [[x, z]];
	for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
		out.push([x + ux * a * LAUNCH_HALF_LENGTH - uz * b * LAUNCH_HALF_WIDTH, z + uz * a * LAUNCH_HALF_LENGTH + ux * b * LAUNCH_HALF_WIDTH]);
	}
	return out;
}
/**
 * Every escort, defend and parked launch position: a moored launch (identity rotation, long axis
 * along Z) at each authored point, and the moving launch heading along each leg every PATH_STEP
 * studs. A beach-landing escort is exempt for its last leg's ramp (it is meant to run aground there).
 */
function boatPathProblems(plan: WorldPlan, out: string[]): void {
	plan.waterPaths.forEach((path, n) => {
		const pts = path.points, last = pts.size() - 1;
		const beachRun = 90 + LAUNCH_HALF_LENGTH + PATH_STEP;
		const check = (x: number, z: number, ux: number, uz: number, label: string): boolean => {
			for (const [px, pz] of launchFootprint(x, z, ux, uz)) {
				const why = notAfloat(plan, px, pz);
				if (why !== undefined) { out.push(`boat path ${n + 1} ${label} at (${math.floor(x)}, ${math.floor(z)}): ${why}`); return false; }
			}
			return true;
		};
		for (let i = 0; i <= last; i++) {
			if (path.beachEnd && i === last) continue;
			check(pts[i][0], pts[i][1], 0, 1, `point ${i + 1}`);
		}
		for (let i = 1; i <= last; i++) {
			const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
			const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
			if (len < 1) continue;
			const ux = (bx - ax) / len, uz = (bz - az) / len, n = math.ceil(len / PATH_STEP);
			for (let k = 0; k <= n; k++) {
				const d = len * k / n;
				if (path.beachEnd && i === last && len - d < beachRun) break;
				if (!check(ax + ux * d, az + uz * d, ux, uz, `leg ${i}`)) break;
			}
		}
	});
}

/**
 * The edge is never visible: from every point of the flyable edge, rays out across the land (up to 60 degrees
 * off the outward normal) cross some backdrop ridge's crest above HORIZON_EYE, so a pilot anywhere under the
 * altitude ceiling sees mountains where the voxel terrain ends. Sea-facing rays run out over the sea skirt.
 */
function crestOver(p: PropSpec, px: number, pz: number, dx: number, dz: number, reach: number): number | undefined {
	const spec = UploadedAssetSpecs[p.asset];
	const c = math.cos(p.yaw), s = math.sin(p.yaw), ox = px - p.x, oz = pz - p.z;
	const lx = c * ox - s * oz, lz = s * ox + c * oz, ldx = c * dx - s * dz, ldz = s * dx + c * dz;
	if (math.abs(ldz) < 1e-6) return undefined;
	const t = -lz / ldz;
	if (t <= 0 || t > reach || math.abs(lx + ldx * t) > spec.size.X * p.scale / 2 * 0.98) return undefined;
	return propBox(p).bottom + (spec.crest ?? 0) * p.scale;
}
function horizonProblems(plan: WorldPlan, out: string[]): void {
	if (plan.theme === "ocean") return;
	const ridges = plan.props.filter((p) => p.tag === "backdrop");
	const edge = FlightMath.HardBoundary, cz = plan.coastZ;
	for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (let t = -edge; t <= edge; t += 400) {
		const px = nx !== 0 ? nx * edge : t, pz = nz !== 0 ? nz * edge : t;
		if (cz !== undefined && (nz < 0 || pz < cz + 1500)) continue;
		for (const turn of [-1.05, -0.6, -0.3, 0, 0.3, 0.6, 1.05]) {
			const a = math.atan2(nz, nx) + turn, dx = math.cos(a), dz = math.sin(a);
			// A ray that reaches the shore within its reach ends over the sea skirt (the sea horizon), not at an edge.
			if (cz !== undefined && pz + dz * 4500 < cz + 350) continue;
			if (!ridges.some((r) => (crestOver(r, px, pz, dx, dz, 4500) ?? -math.huge) >= HORIZON_EYE)) {
				out.push(`horizon: edge visible from (${px}, ${pz}) looking ${math.floor(math.deg(a))} degrees`);
				return;
			}
		}
	}
}
/** The flyable square has terrain or water everywhere, the ring's relief stays under OUTER_CEILING and the skirts reach FAR. */
function extentProblems(plan: WorldPlan, out: string[]): void {
	const edge = FlightMath.HardBoundary;
	for (let x = -edge; x <= edge; x += 750) for (let z = -edge; z <= edge; z += 750) {
		const t = terrainTop(plan.ops, x, z);
		if (t.water === undefined && t.solid === -math.huge) { out.push(`extent: no terrain at (${x}, ${z}) inside the flyable square`); return; }
		if (ring(x, z) > CORE && t.solid > OUTER_CEILING) out.push(`extent: explorable relief at (${x}, ${z}) rises to ${math.floor(t.solid)}`);
	}
	const skirts = plan.parts.filter((p) => p.stretch !== undefined);
	for (const d of [EXTENT + 60, (EXTENT + FAR) / 2, FAR - 60]) for (let k = 0; k < 32; k++) {
		const a = k / 32 * math.pi * 2, sq = math.max(math.abs(math.cos(a)), math.abs(math.sin(a)));
		const x = math.cos(a) * d / sq, z = math.sin(a) * d / sq;
		const covered = skirts.some((p) => math.abs(x - p.x) <= p.sx * p.stretch![0] / 2 && math.abs(z - p.z) <= p.sz * p.stretch![2] / 2);
		if (!covered) { out.push(`extent: no far skirt at (${math.floor(x)}, ${math.floor(z)})`); return; }
	}
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
		if ((s.kind !== "part" && s.kind !== "prop") || math.abs(s.y - t.baseY) > 0.01) problems.push(`target ${t.index + 1}: base surface ${s.kind} ${s.name} at ${s.y}, expected ${t.baseY}`);
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
	// Boats: every escort, defend and parked point on the coast and ocean sits on open water,
	// and the whole launch hull stays afloat along every escort leg.
	boatPathProblems(plan, problems);
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
	horizonProblems(plan, problems);
	extentProblems(plan, problems);
	const c = countPlan(plan);
	// Detail falls off with distance: the explorable ring carries at most half the core's prop density.
	const coreArea = 4 * CORE * CORE, outerArea = 4 * FlightMath.HardBoundary * FlightMath.HardBoundary - coreArea;
	if (c.outerProps / outerArea > 0.5 * math.max(c.coreProps, 1) / coreArea) problems.push(`detail: ${c.outerProps} outer props is denser than half the core's ${c.coreProps}`);
	if (c.instances > WORLD_BUDGET.instances) problems.push(`budget: ${c.instances} instances > ${WORLD_BUDGET.instances}`);
	if (c.parts > WORLD_BUDGET.parts) problems.push(`budget: ${c.parts} parts > ${WORLD_BUDGET.parts}`);
	if (c.props > WORLD_BUDGET.props) problems.push(`budget: ${c.props} props > ${WORLD_BUDGET.props}`);
	if (c.uniqueMeshes > WORLD_BUDGET.uniqueMeshes) problems.push(`budget: ${c.uniqueMeshes} unique meshes > ${WORLD_BUDGET.uniqueMeshes}`);
	if (c.voxelWrites > WORLD_BUDGET.voxelWrites) problems.push(`budget: ${c.voxelWrites} voxel writes > ${WORLD_BUDGET.voxelWrites}`);
	if (c.bumpCells > WORLD_BUDGET.bumpCells) problems.push(`budget: ${c.bumpCells} bump cells > ${WORLD_BUDGET.bumpCells}`);
	if (c.terrainOps > WORLD_BUDGET.terrainOps) problems.push(`budget: ${c.terrainOps} terrain ops > ${WORLD_BUDGET.terrainOps}`);
	return { problems, checkedAir: plan.air.size(), checkedProps: plan.props.size(), checkedParts };
}
