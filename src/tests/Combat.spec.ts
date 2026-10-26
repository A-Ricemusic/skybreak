import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { HttpService, ServerStorage, Workspace } from "@rbxts/services";
import { JetFactory } from "../shared/JetFactory";
import { ThreatRules } from "../shared/ThreatRules";

interface ExportedAircraft {
	asset: string;
	vertices: number[][];
	faces: { indices: number[]; material: string }[];
	materials: { name: string; baseColorRGBA: number[] }[];
	attachments: { leftWingtip: number[]; rightWingtip: number[]; exhaust: number[] };
}

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
	function exportedAircraft(kind: "Kestrel" | "Vanta"): ExportedAircraft {
		const source = ServerStorage.FindFirstChild(`${kind}Geometry`);
		expect(source?.IsA("StringValue")).toBe(true);
		assert(source?.IsA("StringValue"), `Expected packaged ${kind} geometry`);
		return HttpService.JSONDecode(source.Value) as ExportedAircraft;
	}
	function trailCenters(aircraft: Model): Vector3[] {
		const centers: Vector3[] = [];
		for (const item of aircraft.GetDescendants()) {
			if (!item.IsA("Trail")) continue;
			const a = item.Attachment0;
			const b = item.Attachment1;
			assert(a !== undefined && b !== undefined, "Aircraft trail requires both attachments");
			expect(a.Parent).toBe(aircraft.PrimaryPart);
			expect(b.Parent).toBe(aircraft.PrimaryPart);
			centers.push(a.Position.add(b.Position).div(2));
		}
		expect(centers.size()).toBe(3);
		return centers;
	}
	it("creates pivotable safe aircraft with distinct enemy colors and complete trails", () => {
		const root = folder();
		const player = JetFactory.Create("Test Kestrel", false);
		const enemy = JetFactory.Create("Test Vanta", true);
		player.Parent = root; enemy.Parent = root;
		if (ServerStorage.FindFirstChild("KestrelGeometry") !== undefined) {
			// A packaged test asset must never silently pass using fallback geometry.
			expect(player.GetAttribute("GeometrySource")).toBe("Blender");
		}
		if (ServerStorage.FindFirstChild("VantaGeometry") !== undefined) {
			expect(enemy.GetAttribute("GeometrySource")).toBe("Blender");
		}
		expect(player.GetAttribute("GeometryAsset")).toBe("Kestrel");
		expect(enemy.GetAttribute("GeometryAsset")).toBe("Vanta");
		expect(player.PrimaryPart?.Name).toBe("Root");
		expect(enemy.PrimaryPart?.Name).toBe("Root");
		const destination = new CFrame(123, 400, -600).mul(CFrame.Angles(0, 0.6, 0.1));
		player.PivotTo(destination);
		expect(player.GetPivot().Position.sub(destination.Position).Magnitude).toBeCloseTo(0, 4);
		let trailCount = 0;
		for (const aircraft of [player, enemy]) {
			// One replicated part per aircraft: only the Root is anchored; every other
			// part is a massless passenger welded to it, so moving the Root moves the jet.
			const root = aircraft.PrimaryPart!;
			expect(root.Anchored).toBe(true);
			for (const item of aircraft.GetDescendants()) {
				if (!item.IsA("BasePart") || item === root) continue;
				expect(item.Anchored).toBe(false);
				expect(item.Massless).toBe(true);
				expect(item.CanCollide).toBe(false);
				const weld = item.FindFirstChildWhichIsA("WeldConstraint");
				expect(weld?.Part0).toBe(root);
				expect(weld?.Part1).toBe(item);
				expect(weld?.Active).toBe(true);
			}
		}
		const fuselage = player.FindFirstChild("Fuselage") as BasePart;
		const offset = player.PrimaryPart!.CFrame.ToObjectSpace(fuselage.CFrame);
		player.PrimaryPart!.CFrame = new CFrame(-50, 320, 75);
		closeVector(fuselage.Position, new CFrame(-50, 320, 75).mul(offset).Position);
		player.PivotTo(destination);
		for (const item of [...player.GetDescendants(), ...enemy.GetDescendants()]) {
			if (item.IsA("BasePart")) {
				expect(item.CanCollide).toBe(false);
				expect(item.CanTouch).toBe(false);
				expect(item.CanQuery).toBe(false);
			} else if (item.IsA("Trail")) {
				trailCount += 1;
				expect(item.Attachment0?.Parent).toBe(item.Parent);
				expect(item.Attachment1?.Parent).toBe(item.Parent);
			}
		}
		expect(trailCount).toBe(6);
		for (const aircraft of [player, enemy]) {
			// Afterburner flame, glow, light and two wingtip vapor emitters ride the Root.
			const rig = JetFactory.FindEngine(aircraft);
			assert(rig !== undefined, "Aircraft requires an engine rig");
			expect(rig.vapor.size()).toBe(2);
			expect(rig.trail?.Name).toBe("ExhaustTrail");
			expect(rig.flame.Texture.find("rbxasset://")[0]).toBe(1);
			for (const vapor of rig.vapor) expect(vapor.Rate).toBe(0);
			const cruise = rig.flame.Rate;
			JetFactory.SetEngine(rig, 1);
			expect(rig.flame.Rate > cruise).toBe(true);
			expect(rig.light.Range > 10).toBe(true);
			JetFactory.SetEngine(rig, 0);
			expect(rig.flame.Rate < cruise).toBe(true);
			JetFactory.SetVapor(rig, 30);
			for (const vapor of rig.vapor) expect(vapor.Rate).toBe(30);
			// SetTrails is the one switch for every cosmetic: server models stay dark.
			JetFactory.SetTrails(aircraft, false);
			let cosmetics = 0;
			for (const item of aircraft.GetDescendants()) {
				if (!JetFactory.IsCosmetic(item)) continue;
				cosmetics += 1;
				expect(item.Enabled).toBe(false);
			}
			expect(cosmetics).toBe(3 + 2 + 1 + 2);
			JetFactory.SetTrails(aircraft, true);
			for (const item of aircraft.GetDescendants()) if (JetFactory.IsCosmetic(item)) expect(item.Enabled).toBe(true);
		}
		const playerShell = player.FindFirstChild("Fuselage") as BasePart;
		const enemyShell = enemy.FindFirstChild("Fuselage") as BasePart;
		expect(playerShell.Color).never.toEqual(enemyShell.Color);
		enemy.PivotTo(destination);
		closeVector(enemy.GetPivot().Position, destination.Position);
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
		const centers = trailCenters(aircraft);
		for (const tip of [new Vector3(-11.35, -1.58, 2.2), new Vector3(11.35, -1.58, 2.2), new Vector3(0, -1.92, 11.7)]) {
			expect(centers.some((center) => center.sub(tip).Magnitude < 0.001)).toBe(true);
		}
		const target = new CFrame(-50, 150, 200).mul(CFrame.Angles(0.3, -0.7, 0.2));
		aircraft.PivotTo(target);
		for (const group of groups) {
			closeVector(mesh(aircraft, group.name).Position, target.PointToWorldSpace(group.center));
		}
	}, 60000);
	it("uses authored Vanta geometry, colors, -Z orientation, and trail attachments", () => {
		const root = folder();
		const data = exportedAircraft("Vanta");
		expect(data.asset).toBe("SKYBREAK Vanta");
		expect(data.vertices.size()).toBe(1970);
		expect(data.faces.size()).toBe(3840);
		const aircraft = JetFactory.Create("Blender Vanta", true);
		aircraft.Parent = root;
		expect(aircraft.GetAttribute("GeometrySource")).toBe("Blender");
		expect(aircraft.GetAttribute("GeometryAsset")).toBe("Vanta");
		expect(aircraft.GetChildren().filter((item) => item.IsA("MeshPart")).size()).toBe(7);
		// Independently recorded from the Blender export, before mesh centering.
		const groups = [
			{ name: "Fuselage", vertices: 400, triangles: 776, center: new Vector3(0, 0.7882315, 1.1465545), size: new Vector3(16.846856, 4.950247, 19.861109) },
			{ name: "Navy", vertices: 374, triangles: 736, center: new Vector3(0, -1.684892, 0), size: new Vector3(24.376172, 1.496, 26.4) },
			{ name: "Cyan", vertices: 248, triangles: 480, center: new Vector3(0, 0.4267015, -1.45846), size: new Vector3(23.091432, 4.227187, 23.363078) },
			{ name: "Canopy", vertices: 84, triangles: 164, center: new Vector3(0, -0.904392, -6.1499995), size: new Vector3(1.774368, 0.835, 5.899999) },
			{ name: "Gunmetal", vertices: 320, triangles: 620, center: new Vector3(0, -1.946892, 1.715), size: new Vector3(24.371604, 1.86, 21.03) },
			{ name: "Exhaust", vertices: 244, triangles: 480, center: new Vector3(0, -1.9468925, 12.19039), size: new Vector3(2.66, 2.632925, 0.69255) },
			{ name: "Glow", vertices: 300, triangles: 584, center: new Vector3(0, -1.776892, 6.6600005), size: new Vector3(1.44514, 1.8, 11.500001) },
		];
		let vertices = 0;
		let triangles = 0;
		for (const group of groups) {
			const item = mesh(aircraft, group.name);
			expect(item.GetAttribute("BlenderVertexCount")).toBe(group.vertices);
			expect(item.GetAttribute("BlenderTriangleCount")).toBe(group.triangles);
			vertices += item.GetAttribute("BlenderVertexCount") as number;
			triangles += item.GetAttribute("BlenderTriangleCount") as number;
			closeVector(item.Position, group.center);
			closeVector(item.Size, group.size);
			closeVector(item.MeshSize, group.size);
		}
		expect(vertices).toBe(1970);
		expect(triangles).toBe(3840);
		const [bounds, size] = aircraft.GetBoundingBox();
		closeVector(bounds.Position, Vector3.zero);
		closeVector(size, new Vector3(24.376172, 6.52671, 26.4));
		for (const material of data.materials) {
			const item = mesh(aircraft, material.name === "White" ? "Fuselage" : material.name);
			expect(item.GetAttribute("BlenderMaterial")).toBe(material.name);
			const color = material.baseColorRGBA;
			// BasePart colors are quantized to 8-bit channels by the engine.
			expect(math.abs(item.Color.R - color[0])).toBeLessThanOrEqual(1 / 255);
			expect(math.abs(item.Color.G - color[1])).toBeLessThanOrEqual(1 / 255);
			expect(math.abs(item.Color.B - color[2])).toBeLessThanOrEqual(1 / 255);
			expect(item.Transparency).toBeCloseTo(1 - color[3], 3);
			closeVector(item.CFrame.LookVector, new Vector3(0, 0, -1));
			closeVector(item.CFrame.UpVector, Vector3.yAxis);
			expect(item.RenderFidelity).toBe(Enum.RenderFidelity.Automatic);
			expect(item.MeshContent.Object).toBeUndefined();
			expect(item.MeshContent.SourceType).never.toBe(Enum.ContentSourceType.None);
		}
		expect(mesh(aircraft, "Canopy").Position.Z).toBeLessThan(0);
		expect(mesh(aircraft, "Exhaust").Position.Z).toBeGreaterThan(0);
		expect(mesh(aircraft, "Glow").Position.Z).toBeGreaterThan(0);
		expect(mesh(aircraft, "Glow").Material).toBe(Enum.Material.Neon);
		const centers = trailCenters(aircraft);
		const target = new CFrame(70, 240, -330).mul(CFrame.Angles(-0.2, 0.8, 0.3));
		aircraft.PivotTo(target);
		const authoredAttachments = {
			leftWingtip: new Vector3(-12.16, -1.826892, 3.15),
			rightWingtip: new Vector3(12.16, -1.826892, 3.15),
			exhaust: new Vector3(0, -1.946892, 12.55),
		};
		for (const name of ["leftWingtip", "rightWingtip", "exhaust"] as const) {
			const xyz = data.attachments[name];
			const expected = new Vector3(xyz[0], xyz[1], xyz[2]);
			closeVector(expected, authoredAttachments[name]);
			closeVector(aircraft.GetAttribute(name) as Vector3, expected);
			expect(centers.some((center) => center.sub(expected).Magnitude < 0.001)).toBe(true);
		}
		for (const group of groups) {
			closeVector(mesh(aircraft, group.name).Position, target.PointToWorldSpace(group.center));
		}
		for (const item of aircraft.GetDescendants()) {
			if (!item.IsA("Trail")) continue;
			const a = item.Attachment0!;
			const b = item.Attachment1!;
			closeVector(a.WorldPosition.add(b.WorldPosition).div(2), target.PointToWorldSpace(a.Position.add(b.Position).div(2)));
		}
	}, 60000);
	it("shares static content within each aircraft kind and isolates Vanta from Kestrel", () => {
		const root = folder();
		const cachedAircraft: Model[] = [];
		for (const enemy of [false, true]) {
			const first = JetFactory.Create("First cached aircraft", enemy);
			const second = JetFactory.Create("Second cached aircraft", enemy);
			first.Parent = root; second.Parent = root;
			cachedAircraft.push(second);
			expect(first.GetAttribute("GeometrySource")).toBe("Blender");
			expect(second.GetAttribute("GeometrySource")).toBe("Blender");
			const firstShell = mesh(first, "Fuselage");
			const secondShell = mesh(second, "Fuselage");
			const originalColor = firstShell.Color;
			const originalSize = firstShell.Size;
			const originalPosition = firstShell.Position;
			const originalContent = firstShell.MeshContent;
			for (const item of first.GetChildren()) {
				if (!item.IsA("MeshPart")) continue;
				const other = mesh(second, item.Name);
				expect(other).never.toBe(item);
				expect(other.MeshContent).toBe(item.MeshContent);
				expect(other.Color).toEqual(item.Color);
			}
			firstShell.Color = Color3.fromRGB(255, 0, 255);
			firstShell.Size = Vector3.one;
			first.PivotTo(new CFrame(300, 200, 100));
			expect(secondShell.Color).toEqual(originalColor);
			closeVector(secondShell.Size, originalSize);
			closeVector(secondShell.Position, originalPosition);
			closeVector(second.GetPivot().Position, Vector3.zero);
			first.Destroy();
			const third = JetFactory.Create("Pristine cached aircraft", enemy);
			third.Parent = root;
			expect(third.GetAttribute("GeometrySource")).toBe("Blender");
			const thirdShell = mesh(third, "Fuselage");
			expect(thirdShell.Color).toEqual(originalColor);
			expect(thirdShell.MeshContent).toBe(originalContent);
			closeVector(thirdShell.Size, originalSize);
			closeVector(thirdShell.Position, originalPosition);
			closeVector(third.GetPivot().Position, Vector3.zero);
		}
		for (const item of cachedAircraft[0].GetChildren()) {
			if (!item.IsA("MeshPart")) continue;
			expect(mesh(cachedAircraft[1], item.Name).MeshContent).never.toBe(item.MeshContent);
		}
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
		JetFactory.Flares(root, position, CFrame.lookAt(position, position.add(new Vector3(1, 0, 0))));
		const flare = root.FindFirstChild("Countermeasure") as Part;
		expect(flare.FindFirstChild("FlareSmoke")?.IsA("ParticleEmitter")).toBe(true);
		expect(flare.FindFirstChildWhichIsA("Trail")).toBeDefined();
		const flash = root.FindFirstChild("ImpactFlash") as Part;
		expect(flash.FindFirstChildWhichIsA("PointLight")).toBeDefined();
		expect(root.GetChildren().size()).toBe(7);
		task.wait(2.6);
		expect(root.GetChildren().size()).toBe(0);
	});
});
// Threat rules through the Vector3 adaptation CombatService uses (plain points in, plain points out).
describe("Enemy threat rules with engine vectors", () => {
	function point(vector: Vector3): { x: number; y: number; z: number } { return { x: vector.X, y: vector.Y, z: vector.Z }; }
	it("breaks a bandit perpendicular to its heading, toward its bracket side, and nose down", () => {
		const heading = new Vector3(0.6, 0, 0.8);
		const lateral = new Vector3(-heading.Z, 0, heading.X);
		for (const side of [1, -1]) {
			const pass = ThreatRules.BreakDirection(point(heading), point(lateral), side);
			const vector = new Vector3(pass.x, pass.y, pass.z);
			expect(vector.Magnitude).toBeCloseTo(1, 5);
			expect(vector.Dot(lateral) * side).toBeGreaterThan(0.7);
			expect(vector.Y).toBeLessThan(-0.3);
		}
	});
	it("spots an inbound missile from the live projectile list and ignores shots at other bandits", () => {
		const me = { position: new Vector3(0, 300, 0) };
		const other = { position: new Vector3(900, 300, 0) };
		const projectiles = [
			{ target: other, position: new Vector3(850, 300, 0) },
			{ target: me, position: new Vector3(0, 300, ThreatRules.InboundRange + 50) },
		];
		const targetOf = (missile: { target?: typeof me; position: Vector3 }) => missile.target;
		const distanceTo = (missile: { target?: typeof me; position: Vector3 }) => missile.position.sub(me.position).Magnitude;
		expect(ThreatRules.Inbound(me, projectiles, targetOf, distanceTo)).toBe(false);
		projectiles[1].position = new Vector3(0, 300, ThreatRules.InboundRange - 50);
		expect(ThreatRules.Inbound(me, projectiles, targetOf, distanceTo)).toBe(true);
	});
	it("fans an ace salvo so both missiles cannot be dodged by one notch", () => {
		const forward = new Vector3(0, 0, -1);
		const right = new Vector3(-forward.Z, 0, forward.X);
		const second = ThreatRules.SalvoDirection(point(forward), point(right), 1, 2);
		const vector = new Vector3(second.x, second.y, second.z);
		expect(vector.Magnitude).toBeCloseTo(1, 5);
		expect(math.deg(math.acos(vector.Dot(forward)))).toBeGreaterThan(5);
		expect(math.deg(math.acos(vector.Dot(forward)))).toBeLessThan(10);
	});
});
