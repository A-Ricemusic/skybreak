// Shared, cheap scenery generators for the disposable mission worlds.
//
// Performance contract (phones): every part is anchored, non-colliding, and
// only solid visible surfaces are queried by authoritative aircraft sweeps. A
// mission world should stay at or below PART_BUDGET BaseParts; builders call
// `Scenery.Report` at the end so an over-budget composition warns loudly in
// the server log instead of silently slowing the phone.
//
// Building runs inside the sortie build request on the server. `Scenery.Part`
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


export function Light(parent: Instance, at: Vector3, color: Color3, size = 2.5, options: PartOptions = {}): BasePart {
 return Part(parent, "Marker light", new Vector3(size,size*.7,size),at,color,Enum.Material.Neon,{flightSolid:false,castShadow:false,...options});
}
export const Scenery = {PART_BUDGET, PALETTES, Light, Part, Cylinder, Disc, Report};
