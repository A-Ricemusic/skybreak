import { AssetService, HttpService, RunService, ServerStorage } from "@rbxts/services";

type MaterialName = "White" | "Navy" | "Cyan" | "Canopy" | "Gunmetal" | "Exhaust" | "Glow";
interface MeshMaterial {
	name: MaterialName;
	baseColorRGBA: number[];
}
interface MeshFace {
	indices: number[];
	normals: number[][];
	material: MaterialName;
}
interface MeshData {
	schema: string;
	vertices: number[][];
	faces: MeshFace[];
	materials: MeshMaterial[];
}

// This API is newer than the installed @rbxts/types. Keep the compatibility
// declaration limited to this one method, including its real multiple returns.
interface StaticContentService {
	CreateDataModelContentAsync(this: StaticContentService, content: Content): LuaTuple<[EnumItem, Content]>;
}
const staticContentService = AssetService as unknown as StaticContentService;
const materialNames: MaterialName[] = ["White", "Navy", "Cyan", "Canopy", "Gunmetal", "Exhaust", "Glow"];
let templates: Model | undefined;
let building = false;
let generationFailure: string | undefined;

function vector(values: number[]): Vector3 {
	return new Vector3(values[0], values[1], values[2]);
}

function validateVector(values: number[]): void {
	assert(typeIs(values, "table") && values.size() === 3, "KestrelGeometry: expected an XYZ vector");
	for (const value of values) {
		assert(typeIs(value, "number") && value === value && math.abs(value) < math.huge, "KestrelGeometry: invalid coordinate");
	}
}

function readData(): MeshData {
	const source = ServerStorage.FindFirstChild("KestrelGeometry");
	assert(source?.IsA("StringValue"), "KestrelGeometry: missing ServerStorage.KestrelGeometry StringValue; run the aircraft packager");
	const data = HttpService.JSONDecode(source.Value) as MeshData;
	assert(data.schema === "skybreak.triangulated-mesh.v1", "KestrelGeometry: unsupported mesh schema");
	// Leave room for Blender revisions while bounding the whole aircraft's mobile cost.
	assert(data.vertices.size() > 0 && data.vertices.size() <= 20000 && data.faces.size() > 0 && data.faces.size() <= 20000, "KestrelGeometry: empty mesh or exceeds the 20,000 vertex/triangle mobile budget");
	assert(data.materials.size() === 7, "KestrelGeometry: expected seven material groups");
	const seen = new Set<MaterialName>();
	for (const material of data.materials) {
		assert(materialNames.includes(material.name) && !seen.has(material.name), "KestrelGeometry: invalid material group");
		assert(material.baseColorRGBA.size() === 4, "KestrelGeometry: invalid material color");
		for (const channel of material.baseColorRGBA) {
			assert(typeIs(channel, "number") && channel >= 0 && channel <= 1, "KestrelGeometry: invalid material color channel");
		}
		seen.add(material.name);
	}
	for (const vertex of data.vertices) validateVector(vertex);
	const usedMaterials = new Set<MaterialName>();
	for (const face of data.faces) {
		assert(seen.has(face.material) && face.indices.size() === 3 && face.normals.size() === 3, "KestrelGeometry: invalid triangle");
		usedMaterials.add(face.material);
		for (const index of face.indices) {
			assert(typeIs(index, "number") && index % 1 === 0 && index >= 0 && index < data.vertices.size(), "KestrelGeometry: invalid vertex index");
		}
		for (const normal of face.normals) {
			validateVector(normal);
			assert(vector(normal).Magnitude > 0, "KestrelGeometry: zero corner normal");
		}
	}
	assert(usedMaterials.size() === 7, "KestrelGeometry: empty material group");
	return data;
}

function buildTemplates(data: MeshData): Model {
	const model = new Instance("Model");
	model.Name = "KestrelMeshTemplates";
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
					// Exported indices are zero based; rbxts translates this access to Lua's +1.
					const id = mesh.AddVertex(vector(data.vertices[index]));
					vertices.set(index, id);
					return id;
				});
				const triangle = mesh.AddTriangle(ids[0], ids[1], ids[2]);
				// Preserve each Blender corner normal, including hard edges and smooth seams.
				mesh.SetFaceNormals(triangle, face.normals.map((normal) => mesh.AddNormal(vector(normal))));
				triangles += 1;
			}
			assert(triangles > 0, `KestrelGeometry: empty ${material.name} group`);
			const center = mesh.GetCenter();
			const size = mesh.GetSize();
			const [status, content] = staticContentService.CreateDataModelContentAsync(Content.fromObject(mesh));
			assert(tostring(status) === "Enum.CreateContentResult.Success", `CreateDataModelContentAsync: ${tostring(status)}`);
			// Static opaque content survives the editable object and replicates to clients.
			mesh.Destroy();
			editable = undefined;
			const item = AssetService.CreateMeshPartAsync(content, {
				CollisionFidelity: Enum.CollisionFidelity.Box,
				RenderFidelity: Enum.RenderFidelity.Automatic,
			});
			item.Parent = model;
			item.Name = material.name === "White" ? "Fuselage" : material.name;
			item.SetAttribute("BlenderMaterial", material.name);
			item.SetAttribute("BlenderVertexCount", vertices.size());
			item.SetAttribute("BlenderTriangleCount", triangles);
			item.CFrame = new CFrame(center);
			item.Size = size;
			const color = material.baseColorRGBA;
			item.Color = new Color3(color[0], color[1], color[2]);
			item.Material = material.name === "Glow" ? Enum.Material.Neon : material.name === "Canopy" ? Enum.Material.Glass : Enum.Material.SmoothPlastic;
			item.Transparency = 1 - color[3];
			item.Anchored = true;
			item.CanCollide = false;
			item.CanTouch = false;
			item.CanQuery = false;
			item.CastShadow = true;
		}
	});
	// Also clean up a partially constructed mesh/model when an engine call throws.
	editable?.Destroy();
	if (!ok) {
		model.Destroy();
		error(result);
	}
	return model;
}

function getTemplates(): Model | undefined {
	// Engine generation yields. Other callers share that attempt, including its
	// failure, instead of issuing duplicate content-generation requests.
	while (building) task.wait();
	if (templates !== undefined) return templates;
	if (generationFailure !== undefined) return undefined;
	// Bad packaging is an explicit error, not a platform capability fallback.
	const data = readData();
	building = true;
	const [ok, result] = pcall(() => buildTemplates(data));
	if (ok) {
		templates = result;
	} else {
		generationFailure = tostring(result);
		warn(`Kestrel Blender geometry generation failed; using built-in aircraft geometry for this runtime: ${generationFailure}`);
	}
	building = false;
	return templates;
}

export const BlenderAircraft = {
	Populate(model: Model, enemy: boolean): boolean {
		assert(!RunService.IsClient(), "BlenderAircraft geometry must be generated on the server");
		const source = getTemplates();
		if (source === undefined) return false;
		for (const item of source.GetChildren()) {
			assert(item.IsA("MeshPart"));
			const clone = item.Clone();
			if (enemy) {
				const material = clone.GetAttribute("BlenderMaterial");
				if (material === "White") clone.Color = Color3.fromRGB(94, 76, 88);
				if (material === "Cyan" || material === "Glow") clone.Color = Color3.fromRGB(255, 95, 79);
			}
			clone.Parent = model;
		}
		model.SetAttribute("GeometrySource", "Blender");
		return true;
	},
};
