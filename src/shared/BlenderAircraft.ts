import { AssetService, HttpService, RunService, ServerStorage } from "@rbxts/services";
import { AceLivery, AssetSelection } from "./AssetSelection";
import { UploadedAssets } from "./UploadedAssets";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";

type AircraftKind = "Kestrel" | "Vanta";
export interface AircraftAttachments {
	leftWingtip: Vector3;
	rightWingtip: Vector3;
	exhaust: Vector3;
}
interface MeshAttachments {
	leftWingtip: number[];
	rightWingtip: number[];
	exhaust: number[];
}
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
	attachments?: MeshAttachments;
}

// This API is newer than the installed @rbxts/types. Keep the compatibility
// declaration limited to this one method, including its real multiple returns.
interface StaticContentService {
	CreateDataModelContentAsync(this: StaticContentService, content: Content): LuaTuple<[EnumItem, Content]>;
}
const staticContentService = AssetService as unknown as StaticContentService;
const materialNames: MaterialName[] = ["White", "Navy", "Cyan", "Canopy", "Gunmetal", "Exhaust", "Glow"];
interface TemplateCache {
	templates?: Model;
	building: boolean;
	generationFailure?: string;
}
const caches = new Map<AircraftKind, TemplateCache>();
const attachmentNames = ["leftWingtip", "rightWingtip", "exhaust"] as const;
// The original Kestrel export predates authored attachment metadata.
const kestrelAttachments: MeshAttachments = {
	leftWingtip: [-11.35, -1.58, 2.2],
	rightWingtip: [11.35, -1.58, 2.2],
	exhaust: [0, -1.92, 11.7],
};

function vector(values: number[]): Vector3 {
	return new Vector3(values[0], values[1], values[2]);
}

function validateVector(values: number[], sourceName: string): void {
	assert(typeIs(values, "table") && values.size() === 3, `${sourceName}: expected an XYZ vector`);
	for (const value of values) {
		assert(typeIs(value, "number") && value === value && math.abs(value) < math.huge, `${sourceName}: invalid coordinate`);
	}
}

function readData(kind: AircraftKind): MeshData {
	const sourceName = `${kind}Geometry`;
	const source = ServerStorage.FindFirstChild(sourceName);
	assert(source?.IsA("StringValue"), `${sourceName}: missing ServerStorage.${sourceName} StringValue; run the aircraft packager`);
	const data = HttpService.JSONDecode(source.Value) as MeshData;
	assert(data.schema === "skybreak.triangulated-mesh.v1", `${sourceName}: unsupported mesh schema`);
	// Leave room for Blender revisions while bounding the whole aircraft's mobile cost.
	assert(data.vertices.size() > 0 && data.vertices.size() <= 20000 && data.faces.size() > 0 && data.faces.size() <= 20000, `${sourceName}: empty mesh or exceeds the 20,000 vertex/triangle mobile budget`);
	assert(data.materials.size() === 7, `${sourceName}: expected seven material groups`);
	const seen = new Set<MaterialName>();
	for (const material of data.materials) {
		assert(materialNames.includes(material.name) && !seen.has(material.name), `${sourceName}: invalid material group`);
		assert(material.baseColorRGBA.size() === 4, `${sourceName}: invalid material color`);
		for (const channel of material.baseColorRGBA) {
			assert(typeIs(channel, "number") && channel >= 0 && channel <= 1, `${sourceName}: invalid material color channel`);
		}
		seen.add(material.name);
	}
	for (const vertex of data.vertices) validateVector(vertex, sourceName);
	const usedMaterials = new Set<MaterialName>();
	for (const face of data.faces) {
		assert(seen.has(face.material) && face.indices.size() === 3 && face.normals.size() === 3, `${sourceName}: invalid triangle`);
		usedMaterials.add(face.material);
		for (const index of face.indices) {
			assert(typeIs(index, "number") && index % 1 === 0 && index >= 0 && index < data.vertices.size(), `${sourceName}: invalid vertex index`);
		}
		for (const normal of face.normals) {
			validateVector(normal, sourceName);
			assert(vector(normal).Magnitude > 0, `${sourceName}: zero corner normal`);
		}
	}
	assert(usedMaterials.size() === 7, `${sourceName}: empty material group`);
	assert(kind === "Kestrel" || typeIs(data.attachments, "table"), `${sourceName}: missing authored attachments`);
	if (data.attachments !== undefined) {
		for (const name of attachmentNames) validateVector(data.attachments[name], sourceName);
	}
	return data;
}

function buildTemplates(data: MeshData, kind: AircraftKind): Model {
	const model = new Instance("Model");
	model.Name = `${kind}MeshTemplates`;
	const attachments = data.attachments ?? kestrelAttachments;
	for (const name of attachmentNames) model.SetAttribute(name, vector(attachments[name]));
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
			assert(triangles > 0, `${kind}Geometry: empty ${material.name} group`);
			const center = mesh.GetCenter();
			const size = mesh.GetSize();
			// Opaque content preserves its vertex-space origin. Center the mesh
			// before placing its MeshPart, or the original offset is applied twice.
			for (const id of mesh.GetVertices()) {
				mesh.SetPosition(id, mesh.GetPosition(id).sub(center));
			}
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

function getTemplates(kind: AircraftKind): Model | undefined {
	let cache = caches.get(kind);
	if (cache === undefined) {
		cache = { building: false };
		caches.set(kind, cache);
	}
	// Engine generation yields. Callers of the same aircraft kind share that
	// attempt and its failure; a different aircraft has its own content cache.
	while (cache.building) task.wait();
	if (cache.templates !== undefined) return cache.templates;
	if (cache.generationFailure !== undefined) return undefined;
	// Bad packaging is an explicit error, not a platform capability fallback.
	const data = readData(kind);
	cache.building = true;
	const [ok, result] = pcall(() => buildTemplates(data, kind));
	if (ok) {
		cache.templates = result;
	} else {
		cache.generationFailure = tostring(result);
		warn(`${kind} Blender geometry generation failed; using built-in aircraft geometry for this runtime: ${cache.generationFailure}`);
	}
	cache.building = false;
	return cache.templates;
}

/** Clone an uploaded aircraft's parts into the model; false when no uploaded asset is usable. */
function populateUploaded(model: Model, enemy: boolean, livery?: AceLivery): boolean {
	const uploaded = UploadedAssets.Template(AssetSelection.AircraftCandidates(enemy, livery));
	if (uploaded === undefined) return false;
	const attachments = UploadedAssetSpecs[uploaded.name].attachments;
	assert(attachments !== undefined, `${uploaded.name}: missing authored attachments`);
	for (const item of uploaded.template.GetChildren()) {
		if (!item.IsA("BasePart")) continue;
		const clone = item.Clone();
		clone.CastShadow = true;
		clone.Parent = model;
	}
	for (const name of attachmentNames) model.SetAttribute(name, attachments[name]);
	model.SetAttribute("GeometrySource", "Uploaded");
	model.SetAttribute("UploadedAsset", uploaded.name);
	return true;
}

/** Recolour the procedural Vanta's paint roles for an ace whose livery has no uploaded model. */
function tintProcedural(model: Model, livery: AceLivery): void {
	const tint = AssetSelection.ProceduralTint(livery);
	for (const item of model.GetChildren()) {
		if (!item.IsA("MeshPart")) continue;
		const role = item.GetAttribute("BlenderMaterial");
		const rgb = role === "White" ? tint.White : role === "Navy" ? tint.Navy : role === "Cyan" ? tint.Cyan : undefined;
		if (rgb !== undefined) item.Color = Color3.fromRGB(rgb[0], rgb[1], rgb[2]);
	}
}

export const BlenderAircraft = {
	/**
	 * Fill an aircraft model with geometry: the uploaded Roblox model when its ID
	 * is set in RobloxAssetIds and loads, otherwise the generated Blender meshes.
	 * Returns false only when neither is available (JetFactory then builds parts).
	 */
	Populate(model: Model, enemy: boolean, livery?: AceLivery): boolean {
		assert(RunService.IsServer() || (RunService.IsStudio() && !RunService.IsRunning()), "BlenderAircraft geometry must be generated on the server or in Studio edit mode");
		const kind = enemy ? "Vanta" : "Kestrel";
		model.SetAttribute("GeometryAsset", kind);
		if (livery !== undefined) model.SetAttribute("Livery", livery);
		if (populateUploaded(model, enemy, livery)) return true;
		const source = getTemplates(kind);
		if (source === undefined) return false;
		for (const item of source.GetChildren()) {
			assert(item.IsA("MeshPart"));
			const clone = item.Clone();
			clone.Parent = model;
		}
		for (const name of attachmentNames) model.SetAttribute(name, source.GetAttribute(name));
		if (enemy && livery !== undefined) tintProcedural(model, livery);
		model.SetAttribute("GeometrySource", "Blender");
		return true;
	},
	GetAttachments(model: Model): AircraftAttachments {
		const leftWingtip = model.GetAttribute("leftWingtip");
		const rightWingtip = model.GetAttribute("rightWingtip");
		const exhaust = model.GetAttribute("exhaust");
		assert(typeIs(leftWingtip, "Vector3") && typeIs(rightWingtip, "Vector3") && typeIs(exhaust, "Vector3"), "BlenderAircraft: missing generated attachment positions");
		return { leftWingtip, rightWingtip, exhaust };
	},
};
