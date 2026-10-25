import { Lighting, Workspace } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";
import { WorldBuilder } from "./WorldBuilder";

// A single-player place has one mission world. Terrain and lighting are owned
// by this lifecycle; combat owns the parent folder and destroys it on exit.
function part(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3, material: Enum.Material = Enum.Material.Concrete): Part {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.Position = position;
	p.Color = color;
	p.Material = material;
	p.Anchored = true;
	p.CanCollide = false;
	p.CanTouch = false;
	p.CanQuery = false;
	p.Parent = parent;
	return p;
}

function environment(missionId: number): void {
	for (const name of ["SkybreakAtmosphere", "MissionAtmosphere", "MissionGrade", "MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
	Lighting.ClockTime = missionId === 1 ? 10.5 : 17.1;
	Lighting.Brightness = 2.3;
	Lighting.ExposureCompensation = 0.05;
	Lighting.Ambient = Color3.fromRGB(105, 119, 134);
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 151, 159);
	const sky = new Instance("Sky");
	sky.Name = "MissionSky";
	sky.StarCount = 0;
	sky.Parent = Lighting;
	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "MissionAtmosphere";
	atmosphere.Density = 0.23;
	atmosphere.Offset = 0.1;
	atmosphere.Color = missionId === 1 ? Color3.fromRGB(183, 220, 235) : Color3.fromRGB(227, 201, 171);
	atmosphere.Decay = Color3.fromRGB(110, 142, 164);
	atmosphere.Haze = 1.2;
	atmosphere.Glare = 0.12;
	atmosphere.Parent = Lighting;
	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "MissionGrade";
	grade.Saturation = 0.08;
	grade.Contrast = 0.08;
	grade.Parent = Lighting;
	const clouds = new Instance("Clouds");
	clouds.Name = "MissionClouds";
	clouds.Cover = missionId === 1 ? 0.22 : 0.38;
	clouds.Density = 0.35;
	clouds.Color = Color3.fromRGB(238, 241, 244);
	clouds.Parent = Workspace.Terrain;
}

function island(x: number, z: number, radius: number, height: number): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, height - radius - 12, z), radius + 28, Enum.Material.Sand);
	terrain.FillBall(new Vector3(x, height - radius, z), radius, Enum.Material.Rock);
	terrain.FillBall(new Vector3(x, height - radius + 1, z), radius - 8, Enum.Material.Grass);
}

function apron(parent: Instance, x: number, z: number, width: number, depth: number): void {
	Workspace.Terrain.FillBlock(new CFrame(x, 300, z), new Vector3(width + 100, 512, depth + 100), Enum.Material.Air);
	Workspace.Terrain.FillBlock(new CFrame(x, 14, z), new Vector3(width + 80, 60, depth + 80), Enum.Material.Rock);
	part(parent, "Apron", new Vector3(width, 4, depth), new Vector3(x, 46, z), Color3.fromRGB(103, 111, 117));
	for (const side of [-1, 1]) {
		part(parent, "SafetyLine", new Vector3(3, 0.3, depth - 10), new Vector3(x + side * (width / 2 - 7), 48.2, z), Color3.fromRGB(235, 185, 68), Enum.Material.SmoothPlastic);
	}
}

function grounded(model: Model, x: number, z: number, yaw = 0): Model {
	const [bounds, size] = model.GetBoundingBox();
	const bottom = bounds.Position.Y - size.Y / 2;
	model.PivotTo(new CFrame(x, 49 - bottom, z).mul(CFrame.Angles(0, yaw, 0)));
	return model;
}

export const MissionWorld = {
	Build(missionId: number, parent: Instance): { groundTargets: Model[] } {
		Workspace.FindFirstChild("World")?.Destroy();
		Workspace.Terrain.Clear();
		environment(missionId);
		const scenery = new Instance("Folder");
		scenery.Name = missionId === 1 ? "FirstFlightWorld" : "IronCoastWorld";
		scenery.Parent = parent;
		for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
			const ocean = part(scenery, "Ocean", new Vector3(2000, 4, 2000), new Vector3(x * 2000, -18, z * 2000), missionId === 1 ? Color3.fromRGB(35, 115, 145) : Color3.fromRGB(42, 85, 111), Enum.Material.SmoothPlastic);
			ocean.Reflectance = 0.14;
		}
		const groundTargets: Model[] = [];
		if (missionId === 1) {
			island(0, -850, 440, 70);
			island(-1000, -1450, 460, 125);
			island(1200, -1350, 510, 135);
			island(-1450, 650, 350, 95);
			island(1600, 350, 400, 110);
			apron(scenery, 0, -850, 210, 240);
			const radar = grounded(MissionAssets.CreateRadar("TRAINING RADAR"), 0, -850);
			radar.Parent = parent;
			groundTargets.push(radar);
			// A runway on a separate small island provides a clear visual origin.
			island(-650, 450, 510, 48);
			Workspace.Terrain.FillBlock(new CFrame(-650, 308, 450), new Vector3(140, 512, 760), Enum.Material.Air);
			part(scenery, "TrainingRunway", new Vector3(100, 4, 720), new Vector3(-650, 50, 450), Color3.fromRGB(39, 48, 57), Enum.Material.Asphalt);
			for (let i = -3; i <= 3; i++) part(scenery, "RunwayStripe", new Vector3(4, 0.2, 48), new Vector3(-650, 52.2, 450 + i * 90), Color3.fromRGB(236, 235, 211), Enum.Material.SmoothPlastic);
		} else {
			// Five separated industrial compounds, not one overlapping target pile.
			const positions = [new Vector3(-550, 0, -900), new Vector3(0, 0, -1100), new Vector3(550, 0, -900), new Vector3(-350, 0, -1550), new Vector3(350, 0, -1550)];
			for (const p of positions) island(p.X, p.Z, 390, 62);
			for (let i = 0; i < positions.size(); i++) {
				const p = positions[i];
				apron(scenery, p.X, p.Z, 190, 210);
				const warehouse = grounded(MissionAssets.CreateWarehouse(`WAREHOUSE ${i + 1}`), p.X, p.Z, (i % 2) * math.pi / 2);
				warehouse.Parent = parent;
				groundTargets.push(warehouse);
				part(scenery, "AccessRoad", new Vector3(24, 2, 220), new Vector3(p.X, 44, p.Z + 180), Color3.fromRGB(57, 64, 70), Enum.Material.Asphalt);
				for (let j = 0; j < 3; j++) part(scenery, "ShippingContainer", new Vector3(14, 12, 35), new Vector3(p.X + 115, 50, p.Z - 50 + j * 43), j % 2 === 0 ? Color3.fromRGB(145, 83, 52) : Color3.fromRGB(50, 91, 112), Enum.Material.CorrodedMetal);
			}
			island(-1500, -1500, 570, 180);
			island(1450, -1600, 600, 185);
			island(1600, 500, 450, 125);
			island(-1450, 500, 490, 135);
			// Low breakwater and cranes frame a harbor without blocking flight lanes.
			part(scenery, "Breakwater", new Vector3(1500, 30, 45), new Vector3(0, 8, -2050), Color3.fromRGB(80, 86, 89), Enum.Material.Rock);
			for (const x of [-750, 750]) {
				part(scenery, "CraneTower", new Vector3(9, 110, 9), new Vector3(x, 64, -1850), Color3.fromRGB(211, 157, 63), Enum.Material.Metal);
				part(scenery, "CraneBoom", new Vector3(150, 9, 9), new Vector3(x + 45, 115, -1850), Color3.fromRGB(211, 157, 63), Enum.Material.Metal);
			}
		}
		return { groundTargets };
	},
	RestoreMenu(): void {
		Workspace.Terrain.Clear();
		Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
		for (const name of ["MissionAtmosphere", "MissionGrade", "MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
		WorldBuilder.Build();
	},
};
