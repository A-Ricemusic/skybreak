import { CONTROL_TOWER_PARTS, HANGAR_PARTS } from "../shared/MenuWorldGeometry";
import { JetFactory } from "../shared/JetFactory";
import { Workspace } from "@rbxts/services";
import { WorldAssets } from "./WorldAssets";

// Shared, cheap scenery generators for the disposable mission worlds.
//
// Performance contract (phones): every part is anchored, non-colliding, and
// only solid visible surfaces are queried by authoritative aircraft sweeps. A
// mission world should stay at or below PART_BUDGET BaseParts; builders call
// `Scenery.Report` at the end so an over-budget composition warns loudly in
// the server log instead of silently slowing the phone.
//
// Building runs inside the StartMission request on the server. `Scenery.Part`
// yields with task.wait() every YIELD_EVERY parts so large scatters do not
// block the heartbeat (a loading screen covers the wait on the client).

export const PART_BUDGET = 600;
const YIELD_EVERY = 150;
let sinceYield = 0;
export interface PartOptions {
	/** Visible scenery is solid unless explicitly authored as decoration. */
	flightSolid?: boolean;
	className?: "Part" | "WedgePart";
	shape?: Enum.PartType;
	transparency?: number;
	reflectance?: number;
	castShadow?: boolean;
}

export type Palette = {
	rock: Color3; rockDark: Color3; sand: Color3; grass: Color3; concrete: Color3; asphalt: Color3; metal: Color3; shallow: Color3;
};

export const PALETTES = {
	temperate: {
		rock: Color3.fromRGB(112, 104, 94), rockDark: Color3.fromRGB(78, 76, 72), sand: Color3.fromRGB(205, 189, 146), grass: Color3.fromRGB(92, 124, 78),
		concrete: Color3.fromRGB(128, 134, 137), asphalt: Color3.fromRGB(44, 49, 54), metal: Color3.fromRGB(176, 182, 186), shallow: Color3.fromRGB(92, 186, 191),
	} as Palette,
	harbor: {
		rock: Color3.fromRGB(96, 92, 88), rockDark: Color3.fromRGB(64, 62, 60), sand: Color3.fromRGB(196, 178, 138), grass: Color3.fromRGB(104, 118, 74),
		concrete: Color3.fromRGB(118, 122, 124), asphalt: Color3.fromRGB(48, 50, 54), metal: Color3.fromRGB(150, 150, 146), shallow: Color3.fromRGB(104, 160, 166),
	} as Palette,
	canyon: {
		rock: Color3.fromRGB(168, 120, 84), rockDark: Color3.fromRGB(122, 86, 66), sand: Color3.fromRGB(214, 186, 138), grass: Color3.fromRGB(128, 132, 78),
		concrete: Color3.fromRGB(142, 136, 124), asphalt: Color3.fromRGB(54, 56, 58), metal: Color3.fromRGB(160, 156, 150), shallow: Color3.fromRGB(96, 170, 176),
	} as Palette,
};

export function Part(parent: Instance, name: string, size: Vector3, at: CFrame | Vector3, color: Color3, material: Enum.Material = Enum.Material.Concrete, options: PartOptions = {}): BasePart {
	const object = (options.className === "WedgePart" ? new Instance("WedgePart") : new Instance("Part")) as BasePart;
	object.Name = name;
	object.Size = size;
	object.CFrame = typeIs(at, "CFrame") ? at : new CFrame(at);
	object.Color = color;
	object.Material = material;
	object.Anchored = true;
	object.CanCollide = false;
	object.CanTouch = false;
	// Overlays are visual only. Query the actual rendered geometry, never a proxy box.
	object.CanQuery = options.flightSolid !== false && (options.transparency ?? 0) < 1;
	object.SetAttribute("FlightSolid", object.CanQuery);
	// Shadows are a major mobile GPU cost; scenery opts in (airfield buildings near the start only).
	object.CastShadow = options.castShadow === true;
	if (options.transparency !== undefined) object.Transparency = options.transparency;
	if (options.reflectance !== undefined) object.Reflectance = options.reflectance;
	if (options.shape !== undefined && object.IsA("Part")) object.Shape = options.shape;
	object.Parent = parent;
	sinceYield += 1;
	if (sinceYield >= YIELD_EVERY) { sinceYield = 0; task.wait(); }
	return object;
}

/** Upright cylinder (Roblox cylinders lie along X by default). */
export function Cylinder(parent: Instance, name: string, diameter: number, height: number, at: Vector3, color: Color3, material: Enum.Material, options: PartOptions = {}): BasePart {
	return Part(parent, name, new Vector3(height, diameter, diameter), new CFrame(at).mul(CFrame.Angles(0, 0, math.pi / 2)), color, material, { ...options, shape: Enum.PartType.Cylinder });
}

/** Flat disc lying in the XZ plane. */
export function Disc(parent: Instance, name: string, diameter: number, thickness: number, at: Vector3, color: Color3, material: Enum.Material, options: PartOptions = {}): BasePart {
	return Cylinder(parent, name, diameter, thickness, at, color, material, options);
}

/** True when `item` belongs to a clone of an uploaded Blender model (counted apart from primitive parts). */
function inUploaded(item: Instance): boolean {
	const model = item.FindFirstAncestorWhichIsA("Model");
	return model !== undefined && model.GetAttribute("GeometrySource") === "Uploaded";
}

/**
 * Counts BaseParts under a mission folder and warns when over budget. With `splitUploaded`, the
 * MeshParts of uploaded clones are counted separately (`UploadedParts`): they share one cached
 * template per asset and draw as instanced batches, so they are budgeted by WorldPlan, not here.
 */
export function Report(root: Instance, label: string, budget = PART_BUDGET, splitUploaded = false): number {
	let count = 0, uploaded = 0;
	for (const item of root.GetDescendants()) {
		if (!item.IsA("BasePart")) continue;
		if (splitUploaded && inUploaded(item)) uploaded += 1;
		else count += 1;
	}
	if (count > budget) warn(`[Scenery] ${label} uses ${count} BaseParts, over the ${budget} budget`);
	root.SetAttribute("PartCount", count);
	if (splitUploaded) root.SetAttribute("UploadedParts", uploaded);
	return count;
}

const OCEAN_Y = -18;
export const WATERLINE = OCEAN_Y + 2;
// The opaque sea slabs (top at OCEAN_Y + 2) hide everything below this, so no
// terrain is kept there: hidden voxels still replicate to the phone and their
// undersides are still meshed.
export const HIDDEN_FLOOR = OCEAN_Y - 6;

/** 5x5 flat sea tiles to the horizon (25 parts). */
export function Sea(parent: Instance, color: Color3): void {
	for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
		Part(parent, "Sea", new Vector3(2000, 4, 2000), new Vector3(x * 2000, OCEAN_Y, z * 2000), color, Enum.Material.SmoothPlastic, { reflectance: 0.14, castShadow: false });
	}
}

/** Cylinder centres that approximate a `width` x `depth` rounded landmass. */
function lobes(width: number, depth: number): Array<[number, number, number]> {
	const r = math.min(width, depth) / 2;
	const span = math.max(width, depth) - 2 * r;
	// Near-round footprints (aspect within 80 studs) use one averaged lobe: two
	// voxel ops and two shoreline parts fewer, and the outline is indistinguishable.
	if (span < 80) return [[0, 0, (width + depth) / 4]];
	const along = width >= depth;
	return [[along ? -span / 2 : 0, along ? 0 : -span / 2, r], [along ? span / 2 : 0, along ? 0 : span / 2, r]];
}

/**
 * Shoreline treatment for a terrain island: a translucent lighter "shallows"
 * disc just above the sea and a thin sand disc at the waterline, one pair per
 * lobe (two to four parts). Lobes are offset by a hair in Y so overlaps never
 * share a coplanar face.
 */
export function Shoreline(parent: Instance, x: number, z: number, width: number, depth: number, palette: Palette, yaw = 0, shallows = true): void {
	const cf = new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	let i = 0;
	for (const [lx, lz, r] of lobes(width, depth)) {
		// Over Terrain water the engine's own shallows shading replaces the translucent sheet.
		if (shallows) Disc(parent, "Shallows", r * 2 + 220, 0.5, cf.mul(new CFrame(lx, WATERLINE + 0.4 + i * 0.06, lz)).Position, palette.shallow, Enum.Material.SmoothPlastic, { flightSolid: false, transparency: 0.45, reflectance: 0.08, castShadow: false });
		Disc(parent, "Beach", r * 2 + 60, 3, cf.mul(new CFrame(lx, WATERLINE + 1.6 + i * 0.06, lz)).Position, palette.sand, Enum.Material.Sand, { castShadow: false });
		i += 1;
	}
}

/**
 * Terrain island: one or two rock cylinders (a round or capsule plateau with
 * its top at `top`) and an inset grass cap so a rock ledge shows at the rim.
 * Two voxel operations per lobe; sand and shallows come from `Shoreline`.
 */
export function TerrainIsland(x: number, z: number, width: number, depth: number, top: number, yaw = 0): void {
	const terrain = Workspace.Terrain;
	const base = new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	const rockHeight = top - 4 - HIDDEN_FLOOR; // bottom at HIDDEN_FLOOR, not 20 studs further down
	for (const [lx, lz, r] of lobes(width, depth)) {
		terrain.FillCylinder(base.mul(new CFrame(lx, (top - 4) - rockHeight / 2, lz)), rockHeight, r, Enum.Material.Rock);
		terrain.FillCylinder(base.mul(new CFrame(lx, top - 5, lz)), 10, r - 45, Enum.Material.Grass);
	}
}

/** A rounded hill: rock dome with a grass crown, carved flat below the sea. Three voxel operations. */
export function TerrainHill(x: number, z: number, radius: number, base: number, peak: number): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, peak - radius, z), radius, Enum.Material.Rock);
	terrain.FillBall(new Vector3(x, peak - radius * 0.82 + 2, z), radius * 0.82, Enum.Material.Grass);
	if (base < peak - radius) terrain.FillBlock(new CFrame(x, (base + peak - radius) / 2, z), new Vector3(radius * 1.5, peak - radius - base + 8, radius * 1.5), Enum.Material.Rock);
	// The ball reaches peak - 2r (down to ~-400 for big hills); everything under the
	// sea is invisible, so carve it back to air in the same synchronous batch.
	const bottom = peak - radius * 2;
	if (bottom < HIDDEN_FLOOR) terrain.FillBlock(new CFrame(x, (bottom - 4 + HIDDEN_FLOOR) / 2, z), new Vector3(radius * 2 + 8, HIDDEN_FLOOR - bottom + 4, radius * 2 + 8), Enum.Material.Air);
}

/**
 * Distant mountain range ring near the soft boundary. Each peak is a pair of
 * wedges forming a ridge so the horizon reads as terrain instead of sea.
 */
export function Mountains(parent: Instance, seed: number, color: Color3, count = 14, radius = 2850, sectorStart = 0, sectorEnd = math.pi * 2): void {
	const rng = new Random(seed);
	const span = sectorEnd - sectorStart;
	for (let i = 0; i < count; i++) {
		const angle = sectorStart + span * ((i + 0.5) / count) + rng.NextNumber(-0.08, 0.08);
		const width = rng.NextNumber(520, 980), depth = rng.NextNumber(300, 420), height = rng.NextNumber(360, 760);
		// The playable area is a square (max(|x|,|z|) <= 2800), so the ring follows
		// a square too: every ridge's inner face stays outside the hard boundary.
		const square = math.max(math.abs(math.cos(angle)), math.abs(math.sin(angle)));
		const distance = (math.max(radius, 2800) + depth / 2 + 120 + rng.NextNumber(0, 160)) / square;
		const x = math.cos(angle) * distance, z = math.sin(angle) * distance;
		const facing = CFrame.Angles(0, -angle + math.pi / 2 + rng.NextNumber(-0.25, 0.25), 0);
		const shade = color.Lerp(Color3.fromRGB(150, 170, 190), rng.NextNumber(0.1, 0.35));
		for (const side of [-1, 1]) {
			const cf = new CFrame(x, WATERLINE + height / 2 - 20, z).mul(facing).mul(new CFrame(0, 0, side * depth / 2)).mul(CFrame.Angles(0, side < 0 ? 0 : math.pi, 0));
			Part(parent, "Mountain", new Vector3(width, height, depth), cf, side < 0 ? shade : shade.Lerp(Color3.fromRGB(40, 50, 60), 0.18), Enum.Material.Rock, { className: "WedgePart", castShadow: false });
		}
	}
}

/** Low rock pillars rising from the sea between the islands and the horizon. */
export function SeaStacks(parent: Instance, seed: number, palette: Palette, count: number, inner: number, outer: number, avoid: (x: number, z: number) => boolean = () => false): void {
	const rng = new Random(seed);
	let placed = 0, attempts = 0;
	while (placed < count && attempts < count * 6) {
		attempts += 1;
		const angle = rng.NextNumber(0, math.pi * 2), distance = rng.NextNumber(inner, outer);
		const x = math.cos(angle) * distance, z = math.sin(angle) * distance;
		if (avoid(x, z)) continue;
		const height = rng.NextNumber(34, 92), size = rng.NextNumber(18, 44);
		const cf = new CFrame(x, WATERLINE + height / 2 - 12, z).mul(CFrame.Angles(rng.NextNumber(-0.08, 0.08), rng.NextNumber(0, math.pi), rng.NextNumber(-0.1, 0.1)));
		Part(parent, "Sea stack", new Vector3(size, height, size * rng.NextNumber(0.6, 1.3)), cf, placed % 3 === 0 ? palette.rockDark : palette.rock, Enum.Material.Rock);
		placed += 1;
	}
}

/** Terrain surface under (x, z), if it is dry land with a gentle slope and nothing authored on top of it. */
function groundSpot(parent: Instance, x: number, z: number, floor: number): RaycastResult | undefined {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	// The scenery folder too: a hit on a road, apron or building means the spot is taken.
	params.FilterDescendantsInstances = [Workspace.Terrain, parent];
	params.IgnoreWater = false;
	const hit = Workspace.Raycast(new Vector3(x, floor + 600, z), new Vector3(0, -900, 0), params);
	if (hit === undefined || hit.Instance !== Workspace.Terrain || hit.Material === Enum.Material.Water) return undefined;
	if (hit.Normal.Y < 0.82 || hit.Position.Y < floor - 30) return undefined;
	return hit;
}

/**
 * Boulders inside a rectangle: clones of the uploaded RockA/B/C models (primitive boulders only when the
 * upload fails), each resting on the terrain found by a downward ray, never over water or on a road.
 */
export function Rocks(parent: Instance, seed: number, palette: Palette, x: number, z: number, width: number, depth: number, floor: number, count: number, avoid: (x: number, z: number) => boolean = () => false): void {
	const rng = new Random(seed);
	let placed = 0, attempts = 0;
	while (placed < count && attempts < count * 8) {
		attempts += 1;
		const px = x + rng.NextNumber(-width / 2, width / 2), pz = z + rng.NextNumber(-depth / 2, depth / 2);
		if (avoid(px, pz)) continue;
		const hit = groundSpot(parent, px, pz, floor);
		if (hit === undefined) continue;
		const variant = rng.NextInteger(0, 2) as 0 | 1 | 2, scale = rng.NextNumber(0.9, 2.4);
		const at = new CFrame(hit.Position.sub(new Vector3(0, 0.5, 0))).mul(CFrame.Angles(0, rng.NextNumber(0, math.pi * 2), 0));
		if (WorldAssets.PlaceUploaded((["RockA", "RockB", "RockC"] as const)[variant], parent, at, scale) === undefined) {
			const size = new Vector3(rng.NextNumber(12, 40), rng.NextNumber(8, 26), rng.NextNumber(12, 40));
			Part(parent, "Boulder", size, at.mul(new CFrame(0, size.Y * 0.3, 0)).mul(CFrame.Angles(rng.NextNumber(-0.25, 0.25), 0, rng.NextNumber(-0.25, 0.25))), placed % 4 === 0 ? palette.rockDark : palette.rock, placed % 5 === 0 ? Enum.Material.Slate : Enum.Material.Rock);
		}
		placed += 1;
	}
}

/**
 * Trees inside a rectangle: clones of the uploaded Pine and Broadleaf models at varied scale and yaw
 * (trunk + canopy primitives only when the upload fails), each grounded on the terrain under it.
 * `pineShare` is the fraction of conifers.
 */
export function Trees(parent: Instance, seed: number, x: number, z: number, width: number, depth: number, floor: number, count: number, avoid: (x: number, z: number) => boolean = () => false, pineShare = 0.4): void {
	const rng = new Random(seed);
	let placed = 0, attempts = 0;
	while (placed < count && attempts < count * 8) {
		attempts += 1;
		const px = x + rng.NextNumber(-width / 2, width / 2), pz = z + rng.NextNumber(-depth / 2, depth / 2);
		if (avoid(px, pz)) continue;
		const hit = groundSpot(parent, px, pz, floor);
		if (hit === undefined) continue;
		const pine = rng.NextNumber() < pineShare, scale = rng.NextNumber(0.75, 1.3);
		const at = new CFrame(hit.Position.sub(new Vector3(0, 1, 0))).mul(CFrame.Angles(0, rng.NextNumber(0, math.pi * 2), 0));
		if (WorldAssets.PlaceUploaded(pine ? "Pine" : "Broadleaf", parent, at, scale) === undefined) {
			const trunk = rng.NextNumber(10, 18), crown = rng.NextNumber(18, 30), base = hit.Position;
			Part(parent, "Trunk", new Vector3(3, trunk, 3), base.add(new Vector3(0, trunk / 2, 0)), Color3.fromRGB(96, 70, 48), Enum.Material.Wood, { castShadow: false });
			Part(parent, "Canopy", new Vector3(crown, crown * 0.9, crown), base.add(new Vector3(0, trunk + crown * 0.35, 0)), Color3.fromRGB(58 + placed % 3 * 9, 104 + placed % 2 * 12, 58), Enum.Material.Grass, { shape: Enum.PartType.Ball });
		}
		placed += 1;
	}
}

/**
 * Terrain water from the hidden floor up to the waterline over the whole terrain square, on a mud
 * seabed, with flat sea parts beyond it to the horizon. Call before any island or coast fill: those
 * overwrite the water where land rises.
 */
export function TerrainSea(parent: Instance, color: Color3, extent = 4000, far = 6000): void {
	const terrain = Workspace.Terrain;
	for (let x = -extent; x < extent; x += 2000) for (let z = -extent; z < extent; z += 2000) {
		terrain.FillBlock(new CFrame(x + 1000, (HIDDEN_FLOOR + WATERLINE) / 2, z + 1000), new Vector3(2000, WATERLINE - HIDDEN_FLOOR, 2000), Enum.Material.Water);
		terrain.FillBlock(new CFrame(x + 1000, HIDDEN_FLOOR - 2, z + 1000), new Vector3(2000, 4, 2000), Enum.Material.Mud);
	}
	for (let x = -far; x < far; x += 2000) for (let z = -far; z < far; z += 2000) {
		if (x >= -extent && x + 2000 <= extent && z >= -extent && z + 2000 <= extent) continue;
		Part(parent, "Sea", new Vector3(2000, 4, 2000), new Vector3(x + 1000, WATERLINE - 2, z + 1000), color, Enum.Material.SmoothPlastic, { reflectance: 0.12, castShadow: false });
	}
}

/** Polyline road; segments are split so no part exceeds 2000 studs. */
export function Road(parent: Instance, points: Vector3[], width = 24, color = Color3.fromRGB(54, 58, 62)): void {
	for (let i = 1; i < points.size(); i++) {
		const a = points[i - 1], b = points[i];
		const pieces = math.ceil(a.sub(b).Magnitude / 1800);
		for (let k = 0; k < pieces; k++) {
			const start = a.Lerp(b, k / pieces), finish = a.Lerp(b, (k + 1) / pieces);
			const length = start.sub(finish).Magnitude;
			Part(parent, "Road", new Vector3(width, 1, length + width * 0.6), CFrame.lookAt(start.add(finish).div(2), finish), color, Enum.Material.Asphalt, { castShadow: false });
		}
	}
}

/** Small neon marker light (one part). */
export function Light(parent: Instance, at: Vector3, color: Color3, size = 2.5, options: PartOptions = {}): BasePart {
	return Part(parent, "Marker light", new Vector3(size, size * 0.7, size), at, color, Enum.Material.Neon, { flightSolid: false, castShadow: false, ...options });
}

/**
 * Runway slab with shoulders, threshold bars, centreline dashes and edge
 * lights. `cf` is the runway centre at its top surface; length along local Z.
 */
export function Runway(parent: Instance, cf: CFrame, length: number, width: number, palette: Palette): void {
	Part(parent, "Runway shoulder", new Vector3(width + 30, 2, length + 40), cf.mul(new CFrame(0, -2, 0)), palette.concrete, Enum.Material.Concrete);
	Part(parent, "Runway", new Vector3(width, 2, length), cf.mul(new CFrame(0, -0.5, 0)), palette.asphalt, Enum.Material.Asphalt);
	const stripe = Color3.fromRGB(236, 234, 214);
	const dashes = math.floor((length - 260) / 90);
	for (let i = 0; i < dashes; i++) Part(parent, "Centreline", new Vector3(3, 0.3, 45), cf.mul(new CFrame(0, 0.6, -(dashes - 1) * 45 + i * 90)), stripe, Enum.Material.SmoothPlastic, { flightSolid: false, castShadow: false });
	for (const tip of [-1, 1]) {
		for (let s = -3; s <= 3; s++) {
			if (s === 0) continue;
			Part(parent, "Threshold", new Vector3(width / 10, 0.3, 50), cf.mul(new CFrame(s * width / 8, 0.6, tip * (length / 2 - 45))), stripe, Enum.Material.SmoothPlastic, { flightSolid: false, castShadow: false });
		}
		Part(parent, "Threshold bar", new Vector3(width - 6, 0.3, 5), cf.mul(new CFrame(0, 0.6, tip * (length / 2 - 12))), stripe, Enum.Material.SmoothPlastic, { flightSolid: false, castShadow: false });
		Part(parent, "Approach bar", new Vector3(width * 0.8, 1.5, 3), cf.mul(new CFrame(0, 1.5, tip * (length / 2 + 60))), Color3.fromRGB(255, 240, 200), Enum.Material.Neon, { flightSolid: false, castShadow: false });
	}
	const lights = math.floor(length / 120);
	for (let i = 0; i <= lights; i++) for (const side of [-1, 1]) {
		Light(parent, cf.mul(new CFrame(side * (width / 2 + 6), 1.2, -length / 2 + i * (length / lights))).Position, i === 0 || i === lights ? Color3.fromRGB(255, 120, 90) : Color3.fromRGB(255, 244, 210));
	}
}

/** Hangar with the menu-world footprint (72 x 52, six parts). */
export function Hangar(parent: Instance, pivot: CFrame, palette: Palette, accent: Color3): void {
	for (const spec of HANGAR_PARTS) {
		const color = spec.name === "DoorHeader" ? accent : spec.name === "Roof" || spec.name === "Back" ? Color3.fromRGB(70, 78, 86) : palette.concrete;
		Part(parent, `Hangar ${spec.name}`, spec.size, pivot.mul(new CFrame(spec.offset)), color, spec.name === "Floor" ? Enum.Material.Concrete : Enum.Material.Metal, { castShadow: spec.name !== "Floor" });
	}
}

/** Control tower from the menu-world spec (five parts, ~79 studs tall). */
export function ControlTower(parent: Instance, pivot: CFrame, palette: Palette): void {
	for (const spec of CONTROL_TOWER_PARTS) {
		const glass = spec.name === "Cab";
		Part(parent, `Tower ${spec.name}`, spec.size, pivot.mul(new CFrame(spec.offset)), glass ? Color3.fromRGB(62, 110, 128) : spec.name === "Beacon" ? Color3.fromRGB(255, 150, 70) : spec.name === "Roof" ? Color3.fromRGB(50, 58, 66) : palette.concrete,
			glass ? Enum.Material.Glass : spec.name === "Beacon" ? Enum.Material.Neon : spec.name === "Base" ? Enum.Material.Concrete : Enum.Material.Metal, { transparency: glass ? 0.2 : undefined, shape: spec.name === "Beacon" ? Enum.PartType.Ball : undefined, castShadow: spec.name === "Base" || spec.name === "Cab" });
	}
}

/** Row of upright fuel tanks inside a low bund wall. `count` + 1 parts. */
export function FuelFarm(parent: Instance, x: number, z: number, floor: number, count: number, color = Color3.fromRGB(226, 228, 224)): void {
	Part(parent, "Bund", new Vector3(count * 34 + 20, 4, 54), new Vector3(x, floor + 2, z), Color3.fromRGB(102, 106, 108), Enum.Material.Concrete);
	for (let i = 0; i < count; i++) Cylinder(parent, "Fuel tank", 26, 24, new Vector3(x - (count - 1) * 17 + i * 34, floor + 4 + 12, z), color, Enum.Material.Metal);
}

/** A grid of small buildings (body + roof, plus lit windows at night). */
export function Buildings(parent: Instance, seed: number, x: number, z: number, columns: number, rows: number, floor: number, spacingX: number, spacingZ: number, walls: Color3[], night: boolean, tall = false): void {
	const rng = new Random(seed);
	for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) {
		const height = tall ? 60 + rng.NextInteger(0, 5) * 20 : 14 + rng.NextInteger(0, 3) * 6;
		const size = new Vector3(tall ? 56 : rng.NextNumber(34, 54), height, tall ? 62 : rng.NextNumber(34, 52));
		const pos = new Vector3(x + c * spacingX + rng.NextNumber(-6, 6), floor + height / 2, z + r * spacingZ + rng.NextNumber(-6, 6));
		Part(parent, "Building", size, pos, walls[(c + r) % walls.size()], Enum.Material.Concrete);
		Part(parent, "Roof", new Vector3(size.X + 3, 2, size.Z + 3), pos.add(new Vector3(0, height / 2 + 1, 0)), (c + r) % 3 === 0 ? Color3.fromRGB(128, 72, 58) : Color3.fromRGB(58, 66, 72), Enum.Material.Metal, { castShadow: false });
		if (night) Part(parent, "Lit windows", new Vector3(size.X * 0.7, 3, 0.6), pos.add(new Vector3(0, height * 0.2, -size.Z / 2 - 0.2)), Color3.fromRGB(232, 204, 132), Enum.Material.Neon, { flightSolid: false, castShadow: false });
	}
}

/** Parked jets on an apron with trails disabled. Grounded at `floor`. */
export function ParkedJets(parent: Instance, positions: Vector3[], floor: number, yaw: number): void {
	for (let i = 0; i < positions.size(); i++) {
		const model = JetFactory.Create(`Parked jet ${i + 1}`, false);
		for (const item of model.GetDescendants()) {
			if (JetFactory.IsCosmetic(item)) item.Enabled = false;
			if (item.IsA("BasePart")) { item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = false; }
		}
		model.ScaleTo(1.4);
		const [bounds, size] = model.GetBoundingBox();
		model.PivotTo(new CFrame(positions[i].X, floor + (model.GetPivot().Position.Y - (bounds.Position.Y - size.Y / 2)), positions[i].Z).mul(CFrame.Angles(0, yaw + (i % 2) * 0.12, 0)));
		model.Parent = parent;
	}
}

/** Shipping container yard: `columns` x `rows` footprints, each stacked `stack` high. */
export function Containers(parent: Instance, seed: number, x: number, z: number, floor: number, columns: number, rows: number, stack: number, yaw = 0): void {
	const colors = [Color3.fromRGB(150, 84, 52), Color3.fromRGB(52, 94, 118), Color3.fromRGB(178, 150, 54), Color3.fromRGB(86, 118, 86), Color3.fromRGB(142, 142, 138), Color3.fromRGB(128, 56, 60)];
	const rng = new Random(seed);
	const origin = new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) {
		const high = stack - (rng.NextNumber() < 0.3 ? 1 : 0);
		for (let s = 0; s < high; s++) {
			Part(parent, "Container", new Vector3(16, 13, 42), origin.mul(new CFrame((c - (columns - 1) / 2) * 20, floor + 6.5 + s * 13, (r - (rows - 1) / 2) * 48)), colors[rng.NextInteger(0, colors.size() - 1)], Enum.Material.CorrodedMetal);
		}
	}
}

/** Quayside gantry crane: two legs, portal beam, boom and counterweight (five parts). */
export function Crane(parent: Instance, x: number, z: number, floor: number, yaw: number, height: number, color = Color3.fromRGB(214, 160, 66)): void {
	const cf = new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	for (const side of [-1, 1]) Part(parent, "Crane leg", new Vector3(7, height, 7), cf.mul(new CFrame(side * 22, floor + height / 2, 0)), color, Enum.Material.Metal);
	Part(parent, "Crane portal", new Vector3(52, 8, 10), cf.mul(new CFrame(0, floor + height - 4, 0)), color, Enum.Material.Metal);
	Part(parent, "Crane boom", new Vector3(8, 6, 150), cf.mul(new CFrame(0, floor + height + 3, -55)), color, Enum.Material.Metal);
	Part(parent, "Crane cab", new Vector3(14, 12, 18), cf.mul(new CFrame(0, floor + height - 10, 26)), Color3.fromRGB(70, 74, 80), Enum.Material.Metal);
}

/** Simple moored boat: hull, deck house, mast (three parts). */
export function Boat(parent: Instance, x: number, z: number, yaw: number, length: number, hull: Color3): void {
	const cf = new CFrame(x, WATERLINE, z).mul(CFrame.Angles(0, yaw, 0));
	Part(parent, "Hull", new Vector3(length * 0.32, 7, length), cf.mul(new CFrame(0, 1.5, 0)), hull, Enum.Material.Metal);
	Part(parent, "Deck house", new Vector3(length * 0.22, 7, length * 0.28), cf.mul(new CFrame(0, 8, length * 0.12)), Color3.fromRGB(226, 228, 224), Enum.Material.SmoothPlastic);
	Part(parent, "Mast", new Vector3(1.5, 20, 1.5), cf.mul(new CFrame(0, 18, -length * 0.1)), Color3.fromRGB(60, 62, 64), Enum.Material.Metal, { castShadow: false });
}

/** Lighthouse: tower, gallery, lamp, cap (four parts) resting on `floor`. */
export function Lighthouse(parent: Instance, x: number, z: number, floor: number): void {
	Cylinder(parent, "Lighthouse", 16, 56, new Vector3(x, floor + 28, z), Color3.fromRGB(236, 236, 230), Enum.Material.Concrete);
	Part(parent, "Lighthouse band", new Vector3(17, 8, 17), new Vector3(x, floor + 34, z), Color3.fromRGB(190, 54, 48), Enum.Material.SmoothPlastic);
	Part(parent, "Lighthouse lamp", new Vector3(12, 8, 12), new Vector3(x, floor + 60, z), Color3.fromRGB(255, 232, 170), Enum.Material.Neon);
	Part(parent, "Lighthouse cap", new Vector3(14, 3, 14), new Vector3(x, floor + 65.5, z), Color3.fromRGB(60, 64, 70), Enum.Material.Metal);
}

export const Scenery = {
	PART_BUDGET, WATERLINE, HIDDEN_FLOOR, PALETTES, Part, Cylinder, Disc, Report, Sea, TerrainSea, Shoreline, TerrainIsland, TerrainHill, Mountains, SeaStacks, Rocks, Trees, Road, Light, Runway, Hangar, ControlTower, FuelFarm, Buildings, ParkedJets, Containers, Crane, Boat, Lighthouse,
};
