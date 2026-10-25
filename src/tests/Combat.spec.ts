import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { ServerStorage, Workspace } from "@rbxts/services";
import { JetFactory } from "../shared/JetFactory";

// Engine integration: real instances, pivots, attachments and effects in Roblox.
// Mission combat is also exercised through the phone controller by the live driver.
describe("Roblox jet and missile integration", () => {
	let fixture: Folder | undefined;
	afterEach(() => { fixture?.Destroy(); fixture = undefined; });
	function folder(): Folder {
		fixture = new Instance("Folder");
		fixture.Name = "SkybreakJetIntegrationFixture";
		fixture.Parent = Workspace;
		return fixture;
	}
	function mesh(model: Model, name: string): MeshPart {
		const item = model.FindFirstChild(name);
		expect(item?.IsA("MeshPart")).toBe(true);
		assert(item?.IsA("MeshPart"), `Expected Blender MeshPart ${name}`);
		return item;
	}
	function closeVector(actual: Vector3, expected: Vector3): void {
		expect(actual.X).toBeCloseTo(expected.X, 3);
		expect(actual.Y).toBeCloseTo(expected.Y, 3);
		expect(actual.Z).toBeCloseTo(expected.Z, 3);
	}
	it("creates pivotable safe aircraft with distinct enemy colors and complete trails", () => {
		const root = folder();
		const player = JetFactory.Create("Test Kestrel", false);
		const enemy = JetFactory.Create("Test Vanta", true);
		player.Parent = root; enemy.Parent = root;
		if (ServerStorage.FindFirstChild("KestrelGeometry") !== undefined) {
			// A packaged test asset must never silently pass using fallback geometry.
			expect(player.GetAttribute("GeometrySource")).toBe("Blender");
			expect(enemy.GetAttribute("GeometrySource")).toBe("Blender");
		}
		expect(player.PrimaryPart?.Name).toBe("Root");
		const destination = new CFrame(123, 400, -600).mul(CFrame.Angles(0, 0.6, 0.1));
		player.PivotTo(destination);
		expect(player.GetPivot().Position.sub(destination.Position).Magnitude).toBeCloseTo(0, 4);
		let trailCount = 0;
		for (const item of player.GetDescendants()) {
			if (item.IsA("BasePart")) {
				expect(item.Anchored).toBe(true);
				expect(item.CanCollide).toBe(false);
				expect(item.CanTouch).toBe(false);
				expect(item.CanQuery).toBe(false);
			} else if (item.IsA("Trail")) {
				trailCount += 1;
				expect(item.Attachment0?.Parent).toBe(player.PrimaryPart);
				expect(item.Attachment1?.Parent).toBe(player.PrimaryPart);
			}
		}
		expect(trailCount).toBe(3);
		const playerShell = player.FindFirstChild("Fuselage") as BasePart;
		const enemyShell = enemy.FindFirstChild("Fuselage") as BasePart;
		expect(playerShell.Color).never.toEqual(enemyShell.Color);
	}, 60000);
	it("preserves all seven Blender material groups, their bounds, and -Z forward orientation", () => {
		const root = folder();
		expect(ServerStorage.FindFirstChild("KestrelGeometry")?.IsA("StringValue")).toBe(true);
		const aircraft = JetFactory.Create("Blender bounds", false);
		aircraft.Parent = root;
		expect(aircraft.GetAttribute("GeometrySource")).toBe("Blender");
		const meshes = aircraft.GetChildren().filter((item) => item.IsA("MeshPart"));
		expect(meshes.size()).toBe(7);
		// Independently recorded from the validated Blender export, in Roblox XYZ studs.
		const groups = [
			{ name: "Fuselage", material: "White", triangles: 892, center: new Vector3(0, 0.043326, 0), size: new Vector3(22.755948, 5.47284, 26) },
			{ name: "Navy", material: "Navy", triangles: 1144, center: new Vector3(0, -1.579746, 0.6), size: new Vector3(22.769654, 2.28, 21.8) },
			{ name: "Cyan", material: "Cyan", triangles: 628, center: new Vector3(0, 0.2176105, -1.7073285), size: new Vector3(16.285028, 4.074713, 22.445341) },
			{ name: "Canopy", material: "Canopy", triangles: 140, center: new Vector3(0, -0.41907, -4.1), size: new Vector3(1.931852, 1.026854, 6.5) },
			{ name: "Gunmetal", material: "Gunmetal", triangles: 440, center: new Vector3(0, -1.9797465, 1.957692), size: new Vector3(5.9, 1.600001, 0.224616) },
			{ name: "Exhaust", material: "Exhaust", triangles: 320, center: new Vector3(0, -1.919746, 11.5), size: new Vector3(5.72, 1.42, 0.247274) },
			{ name: "Glow", material: "Glow", triangles: 120, center: new Vector3(0, -1.919746, 11.61), size: new Vector3(5.16, 0.86, 0.18) },
		];
		let vertices = 0;
		let triangles = 0;
		for (const group of groups) {
			const item = mesh(aircraft, group.name);
			expect(item.GetAttribute("BlenderMaterial")).toBe(group.material);
			expect(item.GetAttribute("BlenderTriangleCount")).toBe(group.triangles);
			vertices += item.GetAttribute("BlenderVertexCount") as number;
			triangles += item.GetAttribute("BlenderTriangleCount") as number;
			closeVector(item.Position, group.center);
			closeVector(item.Size, group.size);
			closeVector(item.MeshSize, group.size);
			closeVector(item.CFrame.LookVector, new Vector3(0, 0, -1));
			closeVector(item.CFrame.UpVector, Vector3.yAxis);
			expect(item.RenderFidelity).toBe(Enum.RenderFidelity.Automatic);
			// Static content must not retain an EditableMesh object reference.
			expect(item.MeshContent.Object).toBeUndefined();
			expect(item.MeshContent.SourceType).never.toBe(Enum.ContentSourceType.None);
		}
		expect(vertices).toBe(1896);
		expect(triangles).toBe(3684);
		const [bounds, size] = aircraft.GetBoundingBox();
		closeVector(bounds.Position, Vector3.zero);
		closeVector(size, new Vector3(22.769654, 5.559493, 26));
		expect(mesh(aircraft, "Canopy").Position.Z).toBeLessThan(0);
		expect(mesh(aircraft, "Glow").Position.Z).toBeGreaterThan(0);
		expect(mesh(aircraft, "Glow").Material).toBe(Enum.Material.Neon);
		const target = new CFrame(-50, 150, 200).mul(CFrame.Angles(0.3, -0.7, 0.2));
		aircraft.PivotTo(target);
		for (const group of groups) {
			closeVector(mesh(aircraft, group.name).Position, target.PointToWorldSpace(group.center));
		}
	}, 60000);
	it("reuses static mesh content while keeping cached templates and aircraft clones independent", () => {
		const root = folder();
		const first = JetFactory.Create("First cached Kestrel", false);
		const enemy = JetFactory.Create("Cached enemy", true);
		first.Parent = root; enemy.Parent = root;
		expect(first.GetAttribute("GeometrySource")).toBe("Blender");
		expect(enemy.GetAttribute("GeometrySource")).toBe("Blender");
		const firstShell = mesh(first, "Fuselage");
		const enemyShell = mesh(enemy, "Fuselage");
		const originalColor = firstShell.Color;
		const originalSize = firstShell.Size;
		const originalContent = firstShell.MeshContent;
		for (const item of first.GetChildren()) {
			if (!item.IsA("MeshPart")) continue;
			const other = mesh(enemy, item.Name);
			expect(other).never.toBe(item);
			expect(other.MeshContent).toBe(item.MeshContent);
		}
		expect(enemyShell.Color).never.toEqual(originalColor);
		for (const name of ["Cyan", "Glow"]) {
			expect(mesh(enemy, name).Color).toEqual(Color3.fromRGB(255, 95, 79));
			expect(mesh(first, name).Color).never.toEqual(mesh(enemy, name).Color);
		}
		firstShell.Color = Color3.fromRGB(255, 0, 255);
		firstShell.Size = Vector3.one;
		first.PivotTo(new CFrame(300, 200, 100));
		closeVector(enemyShell.Size, originalSize);
		closeVector(enemy.GetPivot().Position, Vector3.zero);
		first.Destroy();
		const third = JetFactory.Create("Pristine cached Kestrel", false);
		third.Parent = root;
		expect(third.GetAttribute("GeometrySource")).toBe("Blender");
		const thirdShell = mesh(third, "Fuselage");
		expect(thirdShell.Color).toEqual(originalColor);
		expect(thirdShell.MeshContent).toBe(originalContent);
		closeVector(thirdShell.Size, originalSize);
		closeVector(thirdShell.Position, new Vector3(0, 0.043326, 0));
		closeVector(third.GetPivot().Position, Vector3.zero);
	}, 60000);
	it("creates correctly oriented friendly and hostile missiles", () => {
		const root = folder();
		const position = new Vector3(40, 300, -200);
		const direction = new Vector3(0.3, 0.2, -1).Unit;
		for (const hostile of [false, true]) {
			const missile = JetFactory.CreateMissile(root, position, direction, hostile);
			expect(missile.Name).toBe(hostile ? "HostileMissile" : "SkyLance");
			expect(missile.Position).toEqual(position);
			expect(missile.CFrame.LookVector.Dot(direction)).toBeCloseTo(1, 5);
			expect(missile.FindFirstChildWhichIsA("Trail")).toBeDefined();
			expect(missile.CanTouch).toBe(false);
		}
	});
	it("creates impact and countermeasure effects with engine cleanup", () => {
		const root = folder();
		const position = new Vector3(0, 300, 0);
		JetFactory.Burst(root, position, Color3.fromRGB(255, 179, 102), 8);
		JetFactory.Flares(root, position);
		const flash = root.FindFirstChild("ImpactFlash") as Part;
		expect(flash.FindFirstChildWhichIsA("PointLight")).toBeDefined();
		expect(root.GetChildren().size()).toBe(7);
		task.wait(1.6);
		expect(root.GetChildren().size()).toBe(0);
	});
});
