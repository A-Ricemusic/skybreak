import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { WorldAssets } from "../server/WorldAssets";
import { AssetSelection } from "../shared/AssetSelection";
import { JetFactory } from "../shared/JetFactory";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetName, UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";

const created: Instance[] = [];
function track<T extends Instance>(item: T): T {
	created.push(item);
	return item;
}

/** The pilot Kestrel import arrived 28x its authored size (Roblox reads FBX centimetres as studs). */
const PILOT_IMPORT_SCALE = 28;
/** Tests cannot author SurfaceAppearance maps (plugin-only setters), so fakes mark them with an attribute. */
const probe = (appearance: SurfaceAppearance) => appearance.GetAttribute("FakeColorMap") === true;

interface FakeOptions {
	scale?: number;
	/** "textured" (default), "bare" MeshParts, "unmapped" SurfaceAppearance, or plain "parts". */
	surface?: "textured" | "bare" | "unmapped" | "parts";
	omit?: string;
	/** Multiplies the X extent (a misshapen or wrong asset). */
	stretchX?: number;
}

/**
 * A stand-in for InsertService's container, shaped like the pilot import: a Model
 * inside the container holding one MeshPart per FBX object (Body plus the control
 * surfaces for aircraft, one mesh for world props), each with a SurfaceAppearance,
 * far from the origin at the import scale.
 */
function fakeUpload(name: UploadedAssetName, options: FakeOptions = {}): Model {
	const spec = UploadedAssetSpecs[name];
	const scale = options.scale ?? PILOT_IMPORT_SCALE;
	const container = new Instance("Model");
	const inner = new Instance("Model");
	inner.Parent = container;
	const offset = new Vector3(500, 80, -300);
	const size = spec.authoredSize.mul(scale).mul(new Vector3(options.stretchX ?? 1, 1, 1));
	const names = spec.kind === "aircraft" ? ["Body", ...AssetSelection.ControlSurfaceNames(spec.controlSurfaces)] : [spec.folder];
	for (const [index, partName] of pairs(names)) {
		if (partName === options.omit) continue;
		const part = new Instance(options.surface === "parts" ? "Part" : "MeshPart");
		part.Name = partName;
		// The body (or the single world mesh) spans the whole bounds; surfaces sit inside it.
		part.Size = index === 1 ? size : size.mul(0.1);
		part.CFrame = new CFrame(offset.add(index === 1 ? Vector3.zero : new Vector3((index % 2 === 0 ? -1 : 1) * size.X * 0.3, 0, size.Z * 0.3)));
		part.Anchored = false;
		part.CanCollide = true;
		if (options.surface !== "bare" && options.surface !== "parts") {
			const appearance = new Instance("SurfaceAppearance");
			appearance.SetAttribute("FakeColorMap", options.surface !== "unmapped");
			appearance.Parent = part;
		}
		part.Parent = inner;
	}
	const stray = new Instance("Script");
	stray.Parent = inner;
	return container;
}

function longest(size: Vector3): number {
	return math.max(size.X, size.Y, size.Z);
}

function close(a: number, b: number, tolerance = 0.05): void {
	expect(math.abs(a - b) <= tolerance).toBe(true);
}

afterEach(() => {
	for (const item of created) item.Destroy();
	created.clear();
	UploadedAssets.Configure();
});

describe("Uploaded asset loader with procedural fallback", () => {
	it("ships every asset ID as a moderation-approved Roblox asset number (docs/qa/uploaded-assets.md)", () => {
		let count = 0;
		for (const [, id] of pairs(RobloxAssetIds)) {
			expect(typeIs(id, "number")).toBe(true);
			expect((id as number) > 0 && (id as number) % 1 === 0).toBe(true);
			count += 1;
		}
		expect(count).toBe(24);
	});

	it("uses an uploaded aircraft when its ID is set: validated, scaled to the procedural size, cached and welded", () => {
		const spec = UploadedAssetSpecs.Kestrel;
		let calls = 0;
		UploadedAssets.Configure({ ids: { Kestrel: 1111 }, probe, loader: (id) => { calls += 1; expect(id).toBe(1111); return fakeUpload("Kestrel"); } });
		const first = track(JetFactory.Create("Uploaded Kestrel", false));
		const second = track(JetFactory.Create("Uploaded Kestrel 2", false));
		expect(calls).toBe(1);
		expect(first.GetAttribute("GeometrySource")).toBe("Uploaded");
		expect(first.GetAttribute("UploadedAsset")).toBe("Kestrel");
		expect(first.FindFirstChildWhichIsA("Script", true)).toBeUndefined();
		const pieces = first.GetChildren().filter((item) => item.IsA("BasePart") && item.Name !== "Root") as BasePart[];
		expect(pieces.size()).toBe(7);
		for (const piece of pieces) {
			expect(piece.IsA("MeshPart")).toBe(true);
			expect(piece.Anchored).toBe(false);
			expect(piece.CanCollide).toBe(false);
			expect(piece.FindFirstChild("RootWeld") !== undefined).toBe(true);
			// The imported SurfaceAppearance (and its maps) travels with every clone.
			expect(piece.FindFirstChildWhichIsA("SurfaceAppearance")?.GetAttribute("FakeColorMap")).toBe(true);
		}
		const leftTip = first.GetAttribute("leftWingtip") as Vector3;
		close(leftTip.X, spec.attachments!.leftWingtip.X, 1e-3);
		// Fitted to the procedural Kestrel's length around the root, wherever and however large the import was.
		const model = new Instance("Model");
		for (const piece of pieces) piece.Clone().Parent = model;
		const [box, size] = model.GetBoundingBox();
		model.Destroy();
		close(size.X, spec.size.X);
		close(size.Y, spec.size.Y);
		close(size.Z, spec.size.Z);
		close(size.Z, 26);
		close(box.Position.Magnitude, 0);
		const template = UploadedAssets.Template(["Kestrel"])!.template;
		close(template.GetAttribute("ImportScale") as number, spec.size.Z / (spec.authoredSize.Z * PILOT_IMPORT_SCALE), 1e-6);
		expect(second.GetAttribute("GeometrySource")).toBe("Uploaded");
	}, 60000);

	it("accepts an import that already arrives at the authored size (0.01 m-per-stud FBX)", () => {
		const spec = UploadedAssetSpecs.Vanta;
		UploadedAssets.Configure({ ids: { Vanta: 2 }, probe, loader: () => fakeUpload("Vanta", { scale: 1 }) });
		const template = UploadedAssets.Template(["Vanta"])!.template;
		const [, size] = template.GetBoundingBox();
		close(longest(size), longest(spec.size));
		close(template.GetAttribute("ImportScale") as number, spec.gameScale, 1e-4);
	});

	it("falls back to the procedural aircraft when loading fails, and does not retry", () => {
		let calls = 0;
		UploadedAssets.Configure({ ids: { Vanta: 2222 }, probe, loader: () => { calls += 1; error("asset not owned by the place owner"); } });
		const first = track(JetFactory.Create("Failed Vanta", true));
		const second = track(JetFactory.Create("Failed Vanta 2", true));
		expect(calls).toBe(1);
		expect(first.GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
		expect(second.GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
		expect(UploadedAssets.Available("Vanta")).toBe(false);
	}, 60000);

	it("falls back when an import lost its textures, parts or shape", () => {
		const cases: [string, FakeOptions][] = [
			["bare MeshParts without SurfaceAppearance", { surface: "bare" }],
			["SurfaceAppearance without a ColorMap", { surface: "unmapped" }],
			["plain Parts instead of MeshParts", { surface: "parts" }],
			["a missing control surface", { omit: "Rudder_R" }],
			["wrong proportions", { stretchX: 3 }],
		];
		for (const [label, options] of cases) {
			let calls = 0;
			UploadedAssets.Configure({ ids: { Kestrel: 3333 }, probe, loader: () => { calls += 1; return fakeUpload("Kestrel", options); } });
			const jet = track(JetFactory.Create(`Rejected Kestrel (${label})`, false));
			expect(calls).toBe(1);
			expect(jet.GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
			expect(UploadedAssets.Template(["Kestrel"])).toBeUndefined();
			expect(calls).toBe(1);
		}
	}, 120000);

	it("uses the real colour-map probe by default: an unauthored SurfaceAppearance is not textured", () => {
		UploadedAssets.Configure({ ids: { RockA: 77 }, loader: () => fakeUpload("RockA") });
		expect(UploadedAssets.Template(["RockA"])).toBeUndefined();
	});

	it("gives aces their livery model, then the plain uploaded Vanta, then a procedural tint", () => {
		UploadedAssets.Configure({ ids: { Vanta: 2, VantaRusk: 3, VantaVulture: 4 }, probe, loader: (id) => {
			if (id === 4) return fakeUpload("VantaVulture", { surface: "bare" });
			return fakeUpload(id === 3 ? "VantaRusk" : "Vanta");
		} });
		const rusk = track(JetFactory.Create("AIR MARSHAL RUSK", true, AssetSelection.LiveryForAce("AIR MARSHAL RUSK")));
		expect(rusk.GetAttribute("UploadedAsset")).toBe("VantaRusk");
		expect(rusk.GetAttribute("Livery")).toBe("Rusk");
		// The Vulture upload is untextured, so the ace falls through to the plain Vanta.
		const vulture = track(JetFactory.Create("VULTURE LEAD", true, "Vulture"));
		expect(vulture.GetAttribute("UploadedAsset")).toBe("Vanta");
		UploadedAssets.Configure({ ids: {} });
		const procedural = track(JetFactory.Create("VULTURE TWO", true, "Vulture"));
		if (procedural.GetAttribute("GeometrySource") === "Blender") {
			const shell = procedural.GetChildren().find((item) => item.IsA("MeshPart") && item.GetAttribute("BlenderMaterial") === "White") as MeshPart;
			const tint = AssetSelection.ProceduralTint("Vulture").White;
			expect(shell.Color).toBe(Color3.fromRGB(tint[0], tint[1], tint[2]));
		}
	}, 60000);

	it("places world assets by their ground contact at authored size, or a simple shape, or nothing", () => {
		const parent = track(new Instance("Folder"));
		parent.Parent = Workspace;
		const at = new CFrame(100, 20, -50);
		UploadedAssets.Configure({ ids: {} });
		const frigate = WorldAssets.PlaceFrigate(parent, at);
		expect(frigate?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(frigate?.FindFirstChild("Hull")?.GetAttribute("FlightSolid")).toBe(true);
		expect(WorldAssets.PlaceGantryCrane(parent, at)).toBeUndefined();
		expect(WorldAssets.Has("Frigate")).toBe(false);

		const quay = UploadedAssetSpecs.HarbourQuay;
		UploadedAssets.Configure({ ids: { HarbourQuay: 4444 }, probe, loader: () => fakeUpload("HarbourQuay", { scale: 4 }) });
		expect(WorldAssets.Has("HarbourQuay")).toBe(true);
		const placed = WorldAssets.PlaceQuay(parent, at)!;
		expect(placed.GetAttribute("GeometrySource")).toBe("Uploaded");
		const [box, size] = placed.GetBoundingBox();
		// Authored real-world size (gameScale 1), with the waterline on the requested CFrame. (A 28x
		// quay would exceed the 2048-stud part limit in this fake, so it arrives 4x too large.)
		close(quay.gameScale, 1, 0);
		close(size.X, quay.authoredSize.X);
		close(size.Y, quay.authoredSize.Y);
		close(size.Z, quay.authoredSize.Z);
		close(box.Position.Y - size.Y / 2 + quay.groundOffset, at.Position.Y);
		close(box.Position.X, at.Position.X);
		close(box.Position.Z, at.Position.Z);
		for (const item of placed.GetDescendants()) {
			if (item.IsA("BasePart")) {
				expect(item.Anchored).toBe(true);
				expect(item.GetAttribute("FlightSolid")).toBe(true);
			}
		}
	});

	it("chooses the world fallback from the placement result when a first load fails", () => {
		const parent = track(new Instance("Folder"));
		parent.Parent = Workspace;
		const at = new CFrame(0, 0, 0);
		let calls = 0;
		UploadedAssets.Configure({ ids: { Barn: 5555, Pine: 6666 }, probe, loader: () => { calls += 1; return fakeUpload(calls === 1 ? "Barn" : "Pine", { surface: "bare" }); } });
		// The ID is set, so an uploaded barn would be tried, but its import is untextured.
		expect(UploadedAssets.Available("Barn")).toBe(true);
		const barn = WorldAssets.PlaceBarn(parent, at);
		expect(barn?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(WorldAssets.Has("Barn")).toBe(false);
		// Dressing without a fallback shape returns undefined so the caller keeps its own primitive.
		expect(WorldAssets.PlaceUploaded("Pine", parent, at)).toBeUndefined();
		expect(WorldAssets.PlaceTree(parent, at)).toBeUndefined();
		expect(calls).toBe(2);
	});
});
