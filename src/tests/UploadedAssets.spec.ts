import { adoptGroundTarget } from "../server/GroundTargetFactory";
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { WorldAssets } from "../server/WorldAssets";
import { AssetSelection, GLASS_TRANSPARENCY, SURFACE_MAPS, SurfaceMap } from "../shared/AssetSelection";
import { JetFactory } from "../shared/JetFactory";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssetOrientation } from "../shared/UploadedAssetOrientation";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetName, UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";

const created: Instance[] = [];
function track<T extends Instance>(item: T): T {
	created.push(item);
	return item;
}

/** The pilot Kestrel import arrived 28x its authored size (Roblox reads FBX centimetres as studs). */
const PILOT_IMPORT_SCALE = 28;
/** Tests cannot author SurfaceAppearance maps (plugin-only setters), so fakes mark each with a Fake<map> attribute. */
const probe = (appearance: SurfaceAppearance, map: SurfaceMap) => appearance.GetAttribute(`Fake${map}`) === true;

interface FakeOptions {
	scale?: number;
	/** "textured" (default), "bare" MeshParts, "unmapped" SurfaceAppearance, or plain "parts". */
	surface?: "textured" | "bare" | "unmapped" | "parts";
	omit?: string;
	/** Imports this part under another name (a renamed Canopy). */
	rename?: [string, string];
	/** Drops this map from `mapPart`'s SurfaceAppearance (every part when unset). */
	missingMap?: SurfaceMap;
	mapPart?: string;
	/** Multiplies the X extent (a misshapen or wrong asset). */
	stretchX?: number;
}

/**
 * A stand-in for InsertService's container, shaped like the pilot import: a Model
 * inside the container holding one MeshPart per FBX object (Body plus the control
 * surfaces and any glass part for aircraft, one mesh for world props), each with a
 * four-map SurfaceAppearance, far from the origin at the import scale.
 */
function fakeUpload(name: UploadedAssetName, options: FakeOptions = {}): Model {
	const spec = UploadedAssetSpecs[name];
	// Large world meshes cannot use the pilot aircraft's 28x import scale:
	// Roblox clamps each BasePart.Size axis to 2048, corrupting their proportions.
	const scale = options.scale ?? (spec.kind === "world" ? 1 : PILOT_IMPORT_SCALE);
	const container = new Instance("Model");
	const inner = new Instance("Model");
	inner.Parent = container;
	const offset = new Vector3(500, 80, -300);
	const size = spec.authoredSize.mul(scale).mul(new Vector3(options.stretchX ?? 1, 1, 1));
	const names = spec.kind === "aircraft" ? AssetSelection.RequiredAircraftParts(spec.controlSurfaces, spec.glassParts, spec.rotors) : [spec.folder];
	for (const [index, partName] of pairs(names)) {
		if (partName === options.omit) continue;
		const part = new Instance(options.surface === "parts" ? "Part" : "MeshPart");
		part.Name = options.rename !== undefined && options.rename[0] === partName ? options.rename[1] : partName;
		// The body (or the single world mesh) spans the whole bounds; surfaces sit inside it.
		const partSize = index === 1 ? size : size.mul(0.1);
		assert(math.max(partSize.X, partSize.Y, partSize.Z) <= 2048, `fakeUpload ${name} exceeds Roblox's part size limit`);
		part.Size = partSize;
		part.CFrame = new CFrame(offset.add(index === 1 ? Vector3.zero : new Vector3((index % 2 === 0 ? -1 : 1) * size.X * 0.3, 0, size.Z * 0.3)));
		part.Anchored = false;
		part.CanCollide = true;
		if (options.surface !== "bare" && options.surface !== "parts") {
			const appearance = new Instance("SurfaceAppearance");
			for (const map of SURFACE_MAPS) {
				const dropped = map === options.missingMap && (options.mapPart === undefined || options.mapPart === partName);
				appearance.SetAttribute(`Fake${map}`, options.surface !== "unmapped" && !dropped);
			}
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
	WorldAssets.SetPreloadTimeout();
});

describe("Uploaded asset loader with procedural fallback", () => {
	it("ships every asset ID as a moderation-approved Roblox asset number (docs/qa/uploaded-assets.md)", () => {
		let count = 0;
		for (const [, id] of pairs(RobloxAssetIds)) {
			expect(typeIs(id, "number")).toBe(true);
			expect((id as number) > 0 && (id as number) % 1 === 0).toBe(true);
			count += 1;
		}
		expect(count).toBe(49);
		expect(AssetSelection.BomberCandidates(UploadedAssetSpecs)).toEqual(["HeavyBomber"]);
		expect(AssetSelection.CarrierCandidates(UploadedAssetSpecs)).toEqual(["Carrier"]);
	});

	it("accepts the helicopter rotor meshes and the tanker hull without fighter parts", () => {
		for (const name of ["AttackHelicopter", "FuelTanker"] as const) {
			UploadedAssets.Configure({ probe, loader: () => fakeUpload(name) });
			const loaded = UploadedAssets.Template([name]);
			expect(loaded?.name).toBe(name);
			if (name === "AttackHelicopter") {
				expect(loaded?.template.FindFirstChild("MainRotor")?.IsA("MeshPart")).toBe(true);
				expect(loaded?.template.FindFirstChild("TailRotor")?.IsA("MeshPart")).toBe(true);
			}
		}
	});

	it("corrects a swapped import heading before fitting bounds using orientation data", () => {
		const offsets = UploadedAssetOrientation.FuelTanker!;
		const prior = offsets.yaw;
		offsets.yaw = -90;
		try {
			UploadedAssets.Configure({ probe, loader: () => {
				const container = fakeUpload("FuelTanker");
				for (const part of container.GetDescendants()) if (part.IsA("BasePart")) part.CFrame = CFrame.Angles(0, math.rad(90), 0).mul(part.CFrame);
				return container;
			} });
			const loaded = UploadedAssets.Template(["FuelTanker"]);
			expect(loaded?.name).toBe("FuelTanker");
			close(loaded!.template.GetExtentsSize().Z, UploadedAssetSpecs.FuelTanker.size.Z);
		} finally {
			offsets.yaw = prior;
		}
	});

	it("places the tanker at its waterline through the cached world loader", () => {
		const parent = track(new Instance("Folder"));
		parent.Parent = Workspace;
		UploadedAssets.Configure({ ids: { FuelTanker: 1 }, probe, loader: () => fakeUpload("FuelTanker") });
		expect(WorldAssets.Preload(["FuelTanker"])).toEqual([]);
		const placed = WorldAssets.PlaceUploaded("FuelTanker", parent, new CFrame(100, 0, -50))!;
		expect(placed.GetAttribute("GeometrySource")).toBe("Uploaded");
		const [box, size] = placed.GetBoundingBox();
		const spec = UploadedAssetSpecs.FuelTanker;
		close(size.X, spec.size.X);
		close(size.Y, spec.size.Y);
		close(size.Z, spec.size.Z);
		close(box.Position.Y - size.Y / 2, -spec.groundOffset);
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
			for (const map of SURFACE_MAPS) expect(piece.FindFirstChildWhichIsA("SurfaceAppearance")?.GetAttribute(`Fake${map}`)).toBe(true);
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

	it("flattens nested imported parts once and anchors every retained part", () => {
		UploadedAssets.Configure({ ids: { Kestrel: 1 }, probe, loader: () => {
			const container = fakeUpload("Kestrel");
			const body = container.FindFirstChild("Body", true)!;
			const elevator = container.FindFirstChild("Elevator_L", true)!;
			const rudder = container.FindFirstChild("Rudder_L", true)!;
			elevator.Parent = body;
			rudder.Parent = elevator;
			return container;
		} });
		const template = UploadedAssets.Template(["Kestrel"])!.template;
		const parts = template.GetDescendants().filter((item) => item.IsA("BasePart")) as BasePart[];
		expect(parts.size()).toBe(7);
		for (const part of parts) {
			expect(part.Parent).toBe(template);
			expect(part.Anchored).toBe(true);
			expect(part.CanCollide).toBe(false);
			expect(part.CanTouch).toBe(false);
			expect(part.CanQuery).toBe(false);
			for (const map of SURFACE_MAPS) expect(part.FindFirstChildWhichIsA("SurfaceAppearance")?.GetAttribute(`Fake${map}`)).toBe(true);
		}
		expect(parts.filter((part) => part.Name === "Elevator_L").size()).toBe(1);
		expect(parts.filter((part) => part.Name === "Rudder_L").size()).toBe(1);
		const [, size] = template.GetBoundingBox();
		close(size.X, UploadedAssetSpecs.Kestrel.size.X);
		close(size.Y, UploadedAssetSpecs.Kestrel.size.Y);
		close(size.Z, UploadedAssetSpecs.Kestrel.size.Z);
	});

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
			["SurfaceAppearance without any map", { surface: "unmapped" }],
			["no ColorMap", { missingMap: "ColorMap" }],
			["no NormalMap", { missingMap: "NormalMap" }],
			["no RoughnessMap on one aileron", { missingMap: "RoughnessMap", mapPart: "Aileron_L" }],
			["no MetalnessMap on one rudder", { missingMap: "MetalnessMap", mapPart: "Rudder_R" }],
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

	it("prefers the v2 Kestrel, renders its canopy see-through and falls back to v1 when v2 fails", () => {
		const loaded: number[] = [];
		UploadedAssets.Configure({ ids: { Kestrel: 1, KestrelV2: 2 }, probe, loader: (id) => {
			loaded.push(id);
			return fakeUpload(id === 2 ? "KestrelV2" : "Kestrel", { scale: 1 });
		} });
		const jet = track(JetFactory.Create("Kestrel v2", false));
		expect(jet.GetAttribute("GeometrySource")).toBe("Uploaded");
		expect(jet.GetAttribute("UploadedAsset")).toBe("KestrelV2");
		const canopy = jet.FindFirstChild("Canopy") as MeshPart | undefined;
		expect(canopy !== undefined).toBe(true);
		expect(canopy!.Transparency).toBeCloseTo(GLASS_TRANSPARENCY, 4);
		expect((jet.FindFirstChild("Body") as MeshPart).Transparency).toBe(0);
		close(longest(UploadedAssets.Template(["KestrelV2"])!.template.GetExtentsSize()), longest(UploadedAssetSpecs.KestrelV2.size));
		expect(loaded.size()).toBe(1);
		// A v2 upload that fails validation (untextured) falls back to the v1 model.
		UploadedAssets.Configure({ ids: { Kestrel: 1, KestrelV2: 2 }, probe, loader: (id) => fakeUpload(id === 2 ? "KestrelV2" : "Kestrel", { surface: id === 2 ? "bare" : "textured" }) });
		const fallback = track(JetFactory.Create("Kestrel v1", false));
		expect(fallback.GetAttribute("UploadedAsset")).toBe("Kestrel");
	}, 60000);

	it("rejects a v2 aircraft without its exact Canopy and falls back to v1", () => {
		const cases: [string, FakeOptions][] = [
			["no Canopy", { omit: "Canopy" }],
			["a renamed Canopy", { rename: ["Canopy", "Canopy.001"] }],
		];
		for (const [label, options] of cases) {
			const loaded: number[] = [];
			UploadedAssets.Configure({ ids: { Kestrel: 1, KestrelV2: 2 }, probe, loader: (id) => {
				loaded.push(id);
				return id === 2 ? fakeUpload("KestrelV2", { ...options, scale: 1 }) : fakeUpload("Kestrel");
			} });
			const jet = track(JetFactory.Create(`Kestrel v2 (${label})`, false));
			expect(jet.GetAttribute("UploadedAsset")).toBe("Kestrel");
			expect(UploadedAssets.Available("KestrelV2")).toBe(false);
			expect(loaded.size()).toBe(2);
			expect(loaded[0]).toBe(2);
			expect(loaded[1]).toBe(1);
		}
		// The same loss on the ace Vanta skips both its v2 livery and plain v2 to the v1 livery.
		UploadedAssets.Configure({ ids: { VantaV2Rusk: 31, VantaRusk: 30, VantaV2: 21, Vanta: 20 }, probe, loader: (id) => {
			if (id === 31) return fakeUpload("VantaV2Rusk", { omit: "Canopy", scale: 1 });
			return fakeUpload(id === 30 ? "VantaRusk" : id === 21 ? "VantaV2" : "Vanta");
		} });
		expect(track(JetFactory.Create("AIR MARSHAL RUSK", true, "Rusk")).GetAttribute("UploadedAsset")).toBe("VantaRusk");
	}, 120000);

	it("rejects a v2 aircraft missing any of the four maps, on the body, a control surface or the canopy", () => {
		for (const map of SURFACE_MAPS) {
			for (const mapPart of ["Body", "Elevator_R", "Canopy"]) {
				UploadedAssets.Configure({ ids: { VantaV2: 21, Vanta: 20 }, probe, loader: (id) => {
					return id === 21 ? fakeUpload("VantaV2", { missingMap: map, mapPart, scale: 1 }) : fakeUpload("Vanta");
				} });
				expect(UploadedAssets.Template(["VantaV2", "Vanta"])?.name).toBe("Vanta");
				expect(UploadedAssets.Available("VantaV2")).toBe(false);
			}
		}
		// With neither upload usable the enemy keeps procedural geometry.
		UploadedAssets.Configure({ ids: { VantaV2: 21, Vanta: 20 }, probe, loader: (id) => {
			return fakeUpload(id === 21 ? "VantaV2" : "Vanta", { missingMap: "NormalMap", scale: id === 21 ? 1 : PILOT_IMPORT_SCALE });
		} });
		expect(track(JetFactory.Create("Unmapped Vanta", true)).GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
	}, 120000);

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
		const frigate = WorldAssets.Place("Frigate", parent, at);
		expect(frigate?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(frigate?.FindFirstChild("Hull")?.GetAttribute("FlightSolid")).toBe(true);
		expect(WorldAssets.Place("GantryCrane", parent, at)).toBeUndefined();
		expect(WorldAssets.Has("Frigate")).toBe(false);

		const quay = UploadedAssetSpecs.HarbourQuay;
		UploadedAssets.Configure({ ids: { HarbourQuay: 4444 }, probe, loader: () => fakeUpload("HarbourQuay", { scale: 4 }) });
		// Placement never loads: before the world's preload the quay is not there yet.
		expect(WorldAssets.Has("HarbourQuay")).toBe(false);
		expect(WorldAssets.Preload(["HarbourQuay"]).size()).toBe(0);
		expect(WorldAssets.Has("HarbourQuay")).toBe(true);
		const placed = WorldAssets.Place("HarbourQuay", parent, at)!;
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
		expect(WorldAssets.Preload(["Barn", "Pine"]).size()).toBe(0);
		const barn = WorldAssets.Place("Barn", parent, at);
		expect(barn?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(WorldAssets.Has("Barn")).toBe(false);
		// Dressing without a fallback shape returns undefined so the caller keeps its own primitive.
		expect(WorldAssets.PlaceUploaded("Pine", parent, at)).toBeUndefined();
		expect(WorldAssets.Place("Pine", parent, at)).toBeUndefined();
		expect(calls).toBe(2);
	});

	it("never waits on a load still running past the preload deadline, and keeps the late template for later", () => {
		const parent = track(new Instance("Folder"));
		parent.Parent = Workspace;
		let calls = 0, finished = false;
		// A cold InsertService request: answers 1.5 s after the world gave up at 0.2 s.
		UploadedAssets.Configure({ ids: { Farmhouse: 7777 }, probe, loader: () => { calls += 1; task.wait(1.5); finished = true; return fakeUpload("Farmhouse"); } });
		WorldAssets.SetPreloadTimeout(0.2);
		const started = os.clock();
		const late = WorldAssets.Preload(["Farmhouse"]);
		expect(os.clock() - started < 1).toBe(true);
		expect(late).toEqual(["Farmhouse"]);
		// Placement does not join the pending load: it returns at once with the fallback block.
		const placedAt = os.clock();
		const house = WorldAssets.Place("Farmhouse", parent, new CFrame());
		expect(os.clock() - placedAt < 0.05).toBe(true);
		expect(house?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(WorldAssets.PlaceUploaded("Farmhouse", parent, new CFrame())).toBeUndefined();
		// A second preload while the first request is still out does not start another one.
		expect(WorldAssets.Preload(["Farmhouse"])).toEqual(["Farmhouse"]);
		expect(calls).toBe(1);
		while (!finished) task.wait();
		task.wait();
		// The late load landed in the cache: the next world places the uploaded model.
		expect(WorldAssets.Has("Farmhouse")).toBe(true);
		expect(WorldAssets.Place("Farmhouse", parent, new CFrame())?.GetAttribute("GeometrySource")).toBe("Uploaded");
	});
});


describe("dormant military ground-kit decoration", () => {
 it("keeps the old aim, query proxies and footprint when a textured mesh replaces the drawing", () => {
  UploadedAssets.Configure({ ids: { MilitaryTank: 1 }, probe, loader: () => fakeUpload("MilitaryTank") });
  WorldAssets.Preload(["MilitaryTank"]);
  const model = track(new Instance("Model"));
  const proxy = new Instance("Part"); proxy.Size = new Vector3(40,24,56);
  proxy.CFrame = new CFrame(300,72,-900); proxy.Anchored=true; proxy.CanQuery=true; proxy.Parent=model;
  const frame=proxy.CFrame, size=proxy.Size;
  adoptGroundTarget(model,"stable_tank","tank");
  expect(model.PrimaryPart!.Position.sub(frame.Position).Magnitude).toBeLessThan(1e-3);
  expect(proxy.Size).toEqual(size); expect(proxy.CFrame).toEqual(frame);
  expect(proxy.Transparency).toBe(1); expect(proxy.CanQuery).toBe(true);
  expect(proxy.GetAttribute("GroundKitQuery")).toBe(true);
  const visual=model.FindFirstChild("MilitaryTank") as Model;
  expect(visual).toBeDefined();
  const [bounds, extent]=visual.GetBoundingBox();
  expect(extent.X<=size.X+.01 && extent.Y<=size.Y+.01 && extent.Z<=size.Z+.01).toBe(true);
  expect(bounds.Position.Y-extent.Y/2).toBeCloseTo(frame.Position.Y-size.Y/2,3);
  for (const p of visual.GetDescendants()) if(p.IsA("BasePart")) {
   expect(p.CanQuery).toBe(false); expect(p.GetAttribute("GroundKitQuery")).toBe(false);
  }
 });
 it("leaves the stand-in visible and aim unchanged after a load failure", () => {
  UploadedAssets.Configure({ids:{MilitaryTank:1},loader:()=>error("unavailable")});
  WorldAssets.Preload(["MilitaryTank"]);
  const model=track(new Instance("Model")), proxy=new Instance("Part");
  proxy.Size=new Vector3(40,24,56); proxy.Position=new Vector3(20,30,40); proxy.Parent=model;
  adoptGroundTarget(model,"stable_tank","tank");
  expect(proxy.Transparency).toBe(0); expect(model.GetAttribute("UploadedAsset")).toBeUndefined();
  expect(model.PrimaryPart!.Position).toEqual(proxy.Position);
 });
});

describe("naval visual proxy contract", () => {
 it("decorates a naval mount at its old aim without introducing a query target", () => {
  UploadedAssets.Configure({ ids: { NavalGun: 1 }, probe, loader: () => fakeUpload("NavalGun") });
  WorldAssets.Preload(["NavalGun"]);
  const model=track(new Instance("Model")), proxy=new Instance("Part");
  proxy.Size=new Vector3(40,24,56); proxy.Position=new Vector3(300,80,-2460); proxy.CanQuery=true; proxy.Parent=model;
  model.SetAttribute("LayoutGroup","naval_mount");
  const frame=proxy.CFrame, size=proxy.Size;
  adoptGroundTarget(model,"stable_mount","gun_mount");
  expect(model.PrimaryPart!.Position).toEqual(frame.Position);
  expect(proxy.CFrame).toEqual(frame);expect(proxy.Size).toEqual(size);expect(proxy.Transparency).toBe(1);
  const visual=model.FindFirstChild("NavalGun") as Model;
  expect(visual.GetAttribute("GroundKitBudgeted")).toBe(true);
  for(const p of visual.GetDescendants()) if(p.IsA("BasePart")) {
   expect(p.CanQuery).toBe(false);expect(p.CanCollide).toBe(false);expect(p.GetAttribute("FlightSolid")).toBe(false);
  }
 });
 it("retains the prior military mount appearance when naval IDs are unavailable", () => {
  UploadedAssets.Configure({ids:{MilitaryAa:1},probe,loader:()=>fakeUpload("MilitaryAa")});
  WorldAssets.Preload(["MilitaryAa","NavalGun"]);
  const model=track(new Instance("Model")), proxy=new Instance("Part");
  proxy.Size=new Vector3(40,24,56);proxy.Parent=model;model.SetAttribute("LayoutGroup","naval_mount");
  adoptGroundTarget(model,"stable_mount","gun_mount");
  expect(model.FindFirstChild("NavalGun")).toBeUndefined();
  expect(model.FindFirstChild("MilitaryAa")).toBeDefined();
 });
});
