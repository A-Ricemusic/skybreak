import { Lighting, Workspace } from "@rbxts/services";
import { MissionCatalog, GroundArchetype } from "../shared/MissionCatalog";
import { WorldLayouts } from "../shared/WorldLayouts";
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
	for (const name of ["SkybreakAtmosphere", "SkybreakColor", "MissionAtmosphere", "MissionGrade", "MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
	Workspace.Terrain.FindFirstChild("SkybreakClouds")?.Destroy();
	const env = MissionCatalog.Get(missionId).environmentId;
	const night = env.find("night")[0] !== undefined;
	const storm = env.find("storm")[0] !== undefined;
	Lighting.ClockTime = night ? 2 : env.find("dusk")[0] !== undefined ? 17.4 : env.find("dawn")[0] !== undefined ? 7 : 11;

	Lighting.Brightness = 2.3;
	Lighting.ExposureCompensation = 0.05;
	Lighting.Ambient = Color3.fromRGB(105, 119, 134);
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 151, 159);
	const sky = new Instance("Sky");
	sky.Name = "MissionSky";
	sky.StarCount = night ? 1200 : 0;
	sky.Parent = Lighting;
	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "MissionAtmosphere";
	atmosphere.Density = night ? 0.18 : storm ? 0.32 : 0.23;
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
	clouds.Cover = storm ? 0.85 : night ? 0.2 : 0.3;
	clouds.Density = 0.35;
	clouds.Color = Color3.fromRGB(238, 241, 244);
	clouds.Parent = Workspace.Terrain;
}

function island(x: number, z: number, radius: number, height: number): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, height - radius - 36, z), radius + 28, Enum.Material.Sand);
	terrain.FillBall(new Vector3(x, height - radius, z), radius, Enum.Material.Rock);
	terrain.FillBall(new Vector3(x, height - radius + 10, z), radius - 8, Enum.Material.Grass);
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
		const definition = MissionCatalog.Get(missionId);
		const layout = WorldLayouts.Get(missionId);
		scenery.Name = `Level_${missionId}_${definition.environmentId}`;
		const desert = definition.environmentId.find("desert")[0] !== undefined;
		const mountain = definition.environmentId.find("mountain")[0] !== undefined;
		for (const peak of layout.peaks) island(peak[0], peak[1], peak[2], peak[3]);
		if (desert) Workspace.Terrain.FillBlock(new CFrame(0, -35, -500), new Vector3(4400, 120, 3800), Enum.Material.Sand);
		const groundTargets: Model[] = [];
		let siteIndex = 0;
		const place = (kind: GroundArchetype, name: string, phase: number, required: boolean): Model => {
			const site = layout.sites[siteIndex % layout.sites.size()];
			const offset = math.floor(siteIndex / layout.sites.size()) * 190;
			const x = site[0], z = site[1] + offset;
			siteIndex++;
			const sea = kind === "carrier";
			const height = sea ? -14 : mountain ? 340 + (siteIndex % 3) * 105 : desert ? 27 : 49;
			if (!sea) {
				island(x, z, mountain ? 350 : 260, height + 8);
				Workspace.Terrain.FillBlock(new CFrame(x,height+252,z),new Vector3(190,512,190),Enum.Material.Air);
				Workspace.Terrain.FillBlock(new CFrame(x,height-16,z),new Vector3(170,32,170),Enum.Material.Rock);
				part(scenery, "TargetApron", new Vector3(170, 6, 170), new Vector3(x, height - 3, z), Color3.fromRGB(100, 111, 116));
			}
			const model = kind === "radar" ? MissionAssets.CreateRadar(name) : kind === "relay" ? MissionAssets.CreateRelay(name)
				: kind === "sam" ? MissionAssets.CreateSAM(name) : kind === "carrier" ? MissionAssets.CreateCarrier(name) : MissionAssets.CreateWarehouse(name);
			const [cf, size] = model.GetBoundingBox();
			model.PivotTo(new CFrame(x, height - cf.Position.Y + size.Y / 2, z).mul(CFrame.Angles(0, siteIndex % 2 === 0 ? 0.35 : -0.25, 0)));
			model.SetAttribute("PhaseIndex", phase); model.SetAttribute("GroundArchetype", kind); model.SetAttribute("RequiredTarget", required);
			model.Parent = parent; groundTargets.push(model);
			return model;
		};
		for (let phaseIndex = 0; phaseIndex < definition.phases.size(); phaseIndex++) {
			const phase = definition.phases[phaseIndex];
			if (phase.groundKind === undefined) continue;
			for (let i = 0; i < (phase.count ?? 1); i++) place(phase.groundKind, missionId === 1 ? "TRAINING RADAR" : `${string.upper(phase.groundKind)} ${i + 1}`, phaseIndex, true);
		}
		// Explicit tactical choice: one extra missile removes armor from the
		// whole strike package; SAMs are optional but continue firing until hit.
		if (missionId >= 3 && groundTargets.size() > 0) {
			place("relay", "SHIELD RELAY · OPTIONAL: remove target armor", -1, false);
			if (missionId >= 8) place("sam", "AIR DEFENSE · OPTIONAL: silence missiles", -1, false);
		}
		if (layout.landmark === "runway") {
			island(-650, 450, 510, 48);
			part(scenery, "TrainingRunway", new Vector3(100, 4, 720), new Vector3(-650, 50, 450), Color3.fromRGB(39, 48, 57), Enum.Material.Asphalt);
			for (let i = -3; i <= 3; i++) part(scenery, "RunwayStripe", new Vector3(4, 0.2, 48), new Vector3(-650, 52.2, 450 + i * 90), Color3.fromRGB(236,235,211));
		} else if (layout.landmark === "fleet") {
			for (let i = 0; i < 3; i++) {
				const ship = MissionAssets.CreateCarrier(`Fleet silhouette ${i}`); ship.PivotTo(new CFrame(-1550 + i * 1450, 7, 900 + (i % 2) * 420)); ship.Parent = scenery;
			}
		} else if (layout.landmark === "harbor") {
			part(scenery, "Breakwater", new Vector3(3300, 30, 45), new Vector3(0, 8, -2100), Color3.fromRGB(80,86,89), Enum.Material.Rock);
			for (const x of [-1400, 0, 1400]) {
				part(scenery, "Crane", new Vector3(12,120,12), new Vector3(x,60,-1980), Color3.fromRGB(211,157,63), Enum.Material.Metal);
				part(scenery, "Boom", new Vector3(180,10,10), new Vector3(x+50,120,-1980), Color3.fromRGB(211,157,63), Enum.Material.Metal);
			}
		} else {
			for (let i = 0; i < 12; i++) {
				const x = -1850 + (i % 6) * 740, z = 200 + math.floor(i / 6) * 850;
				if (layout.landmark === "solar") {
					const panel = part(scenery, "SolarArray", new Vector3(90,4,60), new Vector3(x,40,z), Color3.fromRGB(29,65,92), Enum.Material.Metal);
					panel.Orientation = new Vector3(15, 0, 0);
				} else if (layout.landmark === "refinery") {
				part(scenery, "RefineryStack", new Vector3(30,180,30), new Vector3(x,90,z), Color3.fromRGB(110,116,119), Enum.Material.Metal);
				} else if (layout.landmark === "arches") {
				part(scenery, "SeaArch", new Vector3(260,30,80), new Vector3(x,160,z), Color3.fromRGB(166,149,114), Enum.Material.Sandstone);
				for (const side of [-1,1]) part(scenery, "ArchPillar", new Vector3(45,170,80), new Vector3(x + side * 108,60,z), Color3.fromRGB(166,149,114), Enum.Material.Sandstone);
			} else part(scenery, "RidgeBeacon", new Vector3(12,250,12), new Vector3(x,400,z), Color3.fromRGB(180,196,200), Enum.Material.Metal);
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
