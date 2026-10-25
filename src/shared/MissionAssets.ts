import { AssetService, HttpService, RunService, ServerStorage } from "@rbxts/services";

type MissionAssetKind = "Warehouse" | "Radar" | "Corvette" | "Sam";
type MaterialRole = "Concrete" | "Steel" | "DarkMetal" | "Accent" | "Roof" | "Glass" | "Warning";

interface MeshMaterial {
	name: MaterialRole;
	baseColorRGBA: number[];
}

interface MeshFace {
	indices: number[];
	normals: number[][];
	material: MaterialRole;
}

interface MeshBounds {
	min: number[];
	max: number[];
	dimensions: number[];
}

interface MeshData {
	schema: string;
	vertices: number[][];
	faces: MeshFace[];
	materials: MeshMaterial[];
	bounds: MeshBounds;
}

// This API is newer than the installed @rbxts/types. Keep the compatibility
// declaration narrow and preserve the method's real multiple-return shape.
interface StaticContentService {
	CreateDataModelContentAsync(this: StaticContentService, content: Content): LuaTuple<[EnumItem, Content]>;
}

interface TemplateCache {
	data?: MeshData;
	templates?: Model;
	building: boolean;
	generationFailure?: string;
}

const staticContentService = AssetService as unknown as StaticContentService;
const materialRoles: MaterialRole[] = ["Concrete", "Steel", "DarkMetal", "Accent", "Roof", "Glass", "Warning"];
const caches = new Map<MissionAssetKind, TemplateCache>();

function vector(values: number[]): Vector3 {
	return new Vector3(values[0], values[1], values[2]);
}

function validateVector(values: number[], sourceName: string): void {
	assert(typeIs(values, "table") && values.size() === 3, `${sourceName}: expected an XYZ vector`);
	for (const value of values) {
		assert(typeIs(value, "number") && value === value && math.abs(value) < math.huge, `${sourceName}: invalid coordinate`);
	}
}

function getCache(kind: MissionAssetKind): TemplateCache {
	let cache = caches.get(kind);
	if (cache === undefined) {
		cache = { building: false };
		caches.set(kind, cache);
	}
	return cache;
}

function readData(kind: MissionAssetKind): MeshData {
	const cache = getCache(kind);
	if (cache.data !== undefined) return cache.data;
	const sourceName = `${kind}Geometry`;
	const source = ServerStorage.FindFirstChild(sourceName);
	assert(source?.IsA("StringValue"), `${sourceName}: missing ServerStorage.${sourceName} StringValue; run the asset packager`);
	const data = HttpService.JSONDecode(source.Value) as MeshData;
	assert(data.schema === "skybreak.triangulated-mesh.v1", `${sourceName}: unsupported mesh schema`);
	assert(
		data.vertices.size() > 0 && data.vertices.size() <= 10000 && data.faces.size() > 0 && data.faces.size() <= 5000,
		`${sourceName}: empty mesh or exceeds the 10,000 vertex / 5,000 triangle mobile budget`,
	);
	assert(data.materials.size() > 0 && data.materials.size() <= 7, `${sourceName}: expected one to seven material groups`);
	validateVector(data.bounds.min, sourceName);
	validateVector(data.bounds.max, sourceName);
	validateVector(data.bounds.dimensions, sourceName);
	for (const dimension of data.bounds.dimensions) assert(dimension > 0, `${sourceName}: invalid bounds`);

	const seen = new Set<MaterialRole>();
	for (const material of data.materials) {
		assert(materialRoles.includes(material.name) && !seen.has(material.name), `${sourceName}: invalid material group`);
		assert(material.baseColorRGBA.size() === 4, `${sourceName}: invalid material color`);
		for (const channel of material.baseColorRGBA) {
			assert(typeIs(channel, "number") && channel >= 0 && channel <= 1, `${sourceName}: invalid material color channel`);
		}
		seen.add(material.name);
	}
	for (const vertex of data.vertices) validateVector(vertex, sourceName);
	const used = new Set<MaterialRole>();
	for (const face of data.faces) {
		assert(seen.has(face.material) && face.indices.size() === 3 && face.normals.size() === 3, `${sourceName}: invalid triangle`);
		used.add(face.material);
		for (const index of face.indices) {
			assert(
				typeIs(index, "number") && index % 1 === 0 && index >= 0 && index < data.vertices.size(),
				`${sourceName}: invalid vertex index`,
			);
		}
		for (const normal of face.normals) {
			validateVector(normal, sourceName);
			assert(vector(normal).Magnitude > 0, `${sourceName}: zero corner normal`);
		}
	}
	assert(used.size() === seen.size(), `${sourceName}: empty material group`);
	cache.data = data;
	return data;
}

function robloxMaterial(role: MaterialRole): Enum.Material {
	if (role === "Concrete") return Enum.Material.Concrete;
	if (role === "Steel" || role === "DarkMetal" || role === "Roof") return Enum.Material.Metal;
	if (role === "Glass") return Enum.Material.Glass;
	if (role === "Warning") return Enum.Material.Neon;
	return Enum.Material.SmoothPlastic;
}

function buildTemplates(data: MeshData, kind: MissionAssetKind): Model {
	const model = new Instance("Model");
	model.Name = `${kind}MeshTemplates`;
	let editable: EditableMesh | undefined;
	const [ok, result] = pcall(() => {
		for (const material of data.materials) {
			const mesh = AssetService.CreateEditableMesh();
			assert(mesh !== undefined, "CreateEditableMesh returned nil (mesh memory budget unavailable)");
			editable = mesh;
			const vertices = new Map<number, number>();
			let triangles = 0;
			for (const face of data.faces) {
				if (face.material !== material.name) continue;
				const ids = face.indices.map((index) => {
					const existing = vertices.get(index);
					if (existing !== undefined) return existing;
					const id = mesh.AddVertex(vector(data.vertices[index]));
					vertices.set(index, id);
					return id;
				});
				const triangle = mesh.AddTriangle(ids[0], ids[1], ids[2]);
				mesh.SetFaceNormals(triangle, face.normals.map((normal) => mesh.AddNormal(vector(normal))));
				triangles += 1;
			}
			const center = mesh.GetCenter();
			const size = mesh.GetSize();
			// Static content retains vertex-space offsets. Recenter each authored
			// material mesh, then restore that offset with the MeshPart CFrame.
			for (const id of mesh.GetVertices()) {
				mesh.SetPosition(id, mesh.GetPosition(id).sub(center));
			}
			const [status, content] = staticContentService.CreateDataModelContentAsync(Content.fromObject(mesh));
			assert(tostring(status) === "Enum.CreateContentResult.Success", `CreateDataModelContentAsync: ${tostring(status)}`);
			mesh.Destroy();
			editable = undefined;
			const item = AssetService.CreateMeshPartAsync(content, {
				CollisionFidelity: Enum.CollisionFidelity.Box,
				RenderFidelity: Enum.RenderFidelity.Automatic,
			});
			item.Name = material.name;
			item.SetAttribute("BlenderMaterial", material.name);
			item.SetAttribute("BlenderVertexCount", vertices.size());
			item.SetAttribute("BlenderTriangleCount", triangles);
			item.CFrame = new CFrame(center);
			item.Size = size;
			const color = material.baseColorRGBA;
			item.Color = new Color3(color[0], color[1], color[2]);
			item.Material = robloxMaterial(material.name);
			item.Transparency = 1 - color[3];
			item.Anchored = true;
			item.CanCollide = false;
			item.CanTouch = false;
			item.CanQuery = false;
			item.CastShadow = true;
			item.Parent = model;
		}
	});
	editable?.Destroy();
	if (!ok) {
		model.Destroy();
		error(result);
	}
	return model;
}

function getTemplates(kind: MissionAssetKind, data: MeshData): Model | undefined {
	const cache = getCache(kind);
	while (cache.building) task.wait();
	if (cache.templates !== undefined) return cache.templates;
	if (cache.generationFailure !== undefined) return undefined;
	cache.building = true;
	const [ok, result] = pcall(() => buildTemplates(data, kind));
	if (ok) {
		cache.templates = result;
	} else {
		cache.generationFailure = tostring(result);
		warn(
			`${kind} Blender mission geometry is unavailable on this platform; using its safe fallback: ${cache.generationFailure}`,
		);
	}
	cache.building = false;
	return cache.templates;
}

function createRoot(data: MeshData): Part {
	const root = new Instance("Part");
	root.Name = "Root";
	root.Size = vector(data.bounds.dimensions);
	root.CFrame = new CFrame();
	root.Transparency = 1;
	root.Anchored = true;
	root.CanCollide = false;
	root.CanTouch = false;
	root.CanQuery = false;
	root.CastShadow = false;
	return root;
}

function proceduralPart(parent: Instance, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material): Part {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.CFrame = cframe;
	p.Color = color;
	p.Material = material;
	p.Anchored = true;
	p.CanCollide = false;
	p.CanTouch = false;
	p.CanQuery = false;
	p.CastShadow = true;
	p.Parent = parent;
	return p;
}

/**
 * Builds a procedural corvette out of basic parts. Dimensions roughly 42x14x12
 * studs, oriented along -Z. Used as a Blender-import fallback or when the
 * authored mesh is intentionally omitted (test places, lean distributions).
 */
function proceduralCorvette(name: string): Model {
	const model = new Instance("Model");
	model.Name = name;
	model.SetAttribute("GeometryAsset", "Corvette");
	model.SetAttribute("GeometrySource", "Procedural");
	const root = new Instance("Part");
	root.Name = "Root";
	root.Size = new Vector3(14, 11, 42);
	root.Transparency = 1;
	root.Anchored = true;
	root.CanCollide = false;
	root.CanTouch = false;
	root.CanQuery = false;
	root.CastShadow = false;
	root.Parent = model;
	model.PrimaryPart = root;
	const hullColor = Color3.fromRGB(72, 84, 93);
	const deckColor = Color3.fromRGB(94, 106, 116);
	const accentColor = Color3.fromRGB(203, 112, 70);
	proceduralPart(model, "Hull", new Vector3(13, 5, 38), new CFrame(0, -0.5, 0), hullColor, Enum.Material.Metal);
	proceduralPart(model, "HullBow", new Vector3(10, 4, 10), new CFrame(0, -0.2, -22), hullColor, Enum.Material.Metal);
	proceduralPart(model, "Deck", new Vector3(13.5, 1, 32), new CFrame(0, 2.4, 2), deckColor, Enum.Material.Metal);
	proceduralPart(model, "Bridge", new Vector3(8, 4, 10), new CFrame(0, 5, 4), hullColor, Enum.Material.Metal);
	proceduralPart(model, "Mast", new Vector3(1.4, 7, 1.4), new CFrame(0, 10, 4), Color3.fromRGB(50, 60, 68), Enum.Material.Metal);
	proceduralPart(model, "Funnel", new Vector3(3.4, 3.4, 3.4), new CFrame(0, 6, -3), Color3.fromRGB(32, 40, 48), Enum.Material.Metal);
	proceduralPart(model, "GunMount", new Vector3(3, 2, 5), new CFrame(0, 4, -17), accentColor, Enum.Material.Metal);
	proceduralPart(model, "WaterLine", new Vector3(14.5, 0.4, 40), new CFrame(0, -3, 0), accentColor, Enum.Material.SmoothPlastic);
	return model;
}

/**
 * Builds a procedural SAM battery: a radar dish on a short tower with four
 * missile tubes around a central mount. Oriented upward and visually distinct
 * from the training radar.
 */
function proceduralSam(name: string): Model {
	const model = new Instance("Model");
	model.Name = name;
	model.SetAttribute("GeometryAsset", "Sam");
	model.SetAttribute("GeometrySource", "Procedural");
	const root = new Instance("Part");
	root.Name = "Root";
	root.Size = new Vector3(20, 16, 20);
	root.Transparency = 1;
	root.Anchored = true;
	root.CanCollide = false;
	root.CanTouch = false;
	root.CanQuery = false;
	root.CastShadow = false;
	root.Parent = model;
	model.PrimaryPart = root;
	const concrete = Color3.fromRGB(118, 124, 128);
	const steel = Color3.fromRGB(72, 82, 90);
	const warn = Color3.fromRGB(236, 141, 60);
	proceduralPart(model, "Base", new Vector3(18, 2, 18), new CFrame(0, -7, 0), concrete, Enum.Material.Concrete);
	proceduralPart(model, "Pedestal", new Vector3(8, 4, 8), new CFrame(0, -4, 0), steel, Enum.Material.Metal);
	proceduralPart(model, "Mount", new Vector3(10, 1, 10), new CFrame(0, -1.5, 0), steel, Enum.Material.Metal);
	for (const side of [-1, 1]) {
		proceduralPart(model, "LauncherFrame", new Vector3(2, 6, 10), new CFrame(side * 3.5, 1.2, 0), steel, Enum.Material.Metal);
		for (let column = 0; column < 2; column++) {
			proceduralPart(model, "LauncherTube", new Vector3(1.2, 6, 1.2), new CFrame(side * 3.5, 1.2, (column - 0.5) * 3), warn, Enum.Material.Metal);
		}
	}
	proceduralPart(model, "RadarMast", new Vector3(0.8, 4, 0.8), new CFrame(0, 4, 0), steel, Enum.Material.Metal);
	proceduralPart(model, "RadarPlate", new Vector3(6, 0.5, 1.5), new CFrame(0, 6, 0), concrete, Enum.Material.Metal);
	return model;
}

function create(kind: MissionAssetKind, name: string, procedural?: () => Model): Model {
	assert(
		RunService.IsServer() || (RunService.IsStudio() && !RunService.IsRunning()),
		"MissionAssets geometry must be generated on the server or while Studio is not running",
	);
	const data = readData(kind);
	const model = new Instance("Model");
	model.Name = name;
	model.SetAttribute("GeometryAsset", kind);
	model.SetAttribute("BlenderVertexCount", data.vertices.size());
	model.SetAttribute("BlenderTriangleCount", data.faces.size());
	const root = createRoot(data);
	root.Parent = model;
	model.PrimaryPart = root;
	const templates = getTemplates(kind, data);
	if (templates === undefined) {
		if (procedural !== undefined) {
			// Rebuild from procedural so we still get a visible target rather than a bare root.
			model.Destroy();
			return procedural();
		}
		model.SetAttribute("GeometrySource", "Fallback");
		return model;
	}
	for (const item of templates.GetChildren()) {
		assert(item.IsA("MeshPart"));
		item.Clone().Parent = model;
	}
	model.SetAttribute("GeometrySource", "Blender");
	return model;
}

export const MissionAssets = {
	CreateWarehouse(name: string): Model {
		return create("Warehouse", name);
	},
	CreateRadar(name: string): Model {
		return create("Radar", name);
	},
	CreateCorvette(name: string): Model {
		return create("Corvette", name, () => proceduralCorvette(name));
	},
	CreateSam(name: string): Model {
		return create("Sam", name, () => proceduralSam(name));
	},
};
