import { Debris, TweenService } from "@rbxts/services";
import { BlenderAircraft } from "./BlenderAircraft";

// Shared noninteractive parts for the root, effects, and platform fallback.
function part<T extends "Part" | "WedgePart">(parent: Instance, className: T, name: string, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material = Enum.Material.SmoothPlastic): CreatableInstances[T] {
	const item = new Instance(className);
	item.Name = name;
	item.Size = size;
	item.CFrame = cf;
	item.Color = color;
	item.Material = material;
	item.Anchored = true;
	item.CanCollide = false;
	item.CanTouch = false;
	item.CanQuery = false;
	item.CastShadow = true;
	item.Parent = parent;
	return item;
}
function trail(parent: BasePart, position: Vector3, color: Color3, width: number, lifetime: number): Trail {
	const a = new Instance("Attachment");
	a.Position = position.add(new Vector3(width / 2, 0, 0));
	a.Parent = parent;
	const b = new Instance("Attachment");
	b.Position = position.sub(new Vector3(width / 2, 0, 0));
	b.Parent = parent;
	const effect = new Instance("Trail");
	effect.Attachment0 = a;
	effect.Attachment1 = b;
	effect.Color = new ColorSequence(color);
	effect.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 0.18), new NumberSequenceKeypoint(1, 1)]);
	effect.Lifetime = lifetime;
	effect.LightEmission = 0.75;
	effect.FaceCamera = true;
	effect.MinLength = 0.1;
	effect.Parent = parent;
	return effect;
}
export const JetFactory = {
	Create(name: string, enemy: boolean): Model {
		const model = new Instance("Model");
		model.Name = name;
		const shell = enemy ? Color3.fromRGB(94, 76, 88) : Color3.fromRGB(218, 229, 236);
		const dark = Color3.fromRGB(25, 39, 53);
		const accent = enemy ? Color3.fromRGB(255, 95, 79) : Color3.fromRGB(44, 224, 240);
		const root = part(model, "Part", "Root", new Vector3(3, 3, 16), new CFrame(), dark);
		root.Transparency = 1;
		model.PrimaryPart = root;
		const blender = BlenderAircraft.Populate(model, enemy);
		if (!blender) {
			model.SetAttribute("GeometrySource", "Fallback");
			part(model, "Part", "Fuselage", new Vector3(3.4, 2.5, 16), new CFrame(), shell);
			part(model, "WedgePart", "Nose", new Vector3(3.4, 2.5, 8), new CFrame(0, 0, -11).mul(CFrame.Angles(0, math.pi, 0)), shell);
			const canopy = part(model, "Part", "Canopy", new Vector3(2.1, 1.45, 5.3), new CFrame(0, 1.5, -3.1), Color3.fromRGB(40, 117, 147), Enum.Material.Glass);
			canopy.Transparency = 0.18;
			for (const side of [-1, 1]) {
				part(model, "WedgePart", "SweptWing", new Vector3(10, 0.55, 9), new CFrame(side * 6.4, -0.25, 1.7).mul(CFrame.Angles(0, side < 0 ? math.pi : 0, 0)), shell);
				part(model, "Part", "WingMark", new Vector3(1.2, 0.62, 4), new CFrame(side * 9, -0.2, 3.8), accent);
				part(model, "WedgePart", "Tailplane", new Vector3(4.5, 0.45, 4), new CFrame(side * 3.5, 0.35, 7.3).mul(CFrame.Angles(0, side < 0 ? math.pi : 0, 0)), dark);
				part(model, "WedgePart", "TwinFin", new Vector3(0.5, 3.9, 4.8), new CFrame(side * 1.4, 2.1, 6.3), shell);
				part(model, "Part", "Engine", new Vector3(1.35, 1.35, 3.1), new CFrame(side * 0.95, -0.1, 7.6), dark);
				part(model, "Part", "Afterburner", new Vector3(1, 1, 0.6), new CFrame(side * 0.95, -0.1, 9.25), accent, Enum.Material.Neon);
			}
		}
		for (const side of [-1, 1]) {
			const tip = blender ? new Vector3(side * 11.35, -1.58, 2.2) : new Vector3(side * 10, -0.25, 4);
			trail(root, tip, Color3.fromRGB(224, 246, 255), 0.25, 1.1);
		}
		trail(root, blender ? new Vector3(0, -1.92, 11.7) : new Vector3(0, -0.1, 9.3), accent, 1.1, 0.35);
		return model;
	},
	CreateMissile(parent: Instance, position: Vector3, direction: Vector3, hostile: boolean): Part {
		const color = hostile ? Color3.fromRGB(255, 104, 72) : Color3.fromRGB(93, 247, 255);
		const missile = part(parent, "Part", hostile ? "HostileMissile" : "SkyLance", new Vector3(0.75, 0.75, 4.3), CFrame.lookAt(position, position.add(direction)), color, Enum.Material.Neon);
		missile.CastShadow = false;
		trail(missile, new Vector3(0, 0, 2), color, 0.8, 0.5);
		return missile;
	},
	Burst(parent: Instance, position: Vector3, color: Color3, scale: number): void {
		const flash = part(parent, "Part", "ImpactFlash", new Vector3(scale, scale, scale), new CFrame(position), color, Enum.Material.Neon);
		flash.Shape = Enum.PartType.Ball;
		flash.Transparency = 0.2;
		flash.CastShadow = false;
		const light = new Instance("PointLight");
		light.Color = color;
		light.Brightness = 3;
		light.Range = scale * 3;
		light.Parent = flash;
		TweenService.Create(flash, new TweenInfo(0.45), { Size: new Vector3(scale, scale, scale).mul(3), Transparency: 1 }).Play();
		Debris.AddItem(flash, 0.5);
	},
	Flares(parent: Instance, position: Vector3): void {
		for (let index = 1; index <= 6; index++) {
			const flare = part(parent, "Part", "Countermeasure", new Vector3(1.4, 1.4, 1.4), new CFrame(position), Color3.fromRGB(255, 218, 138), Enum.Material.Neon);
			flare.Shape = Enum.PartType.Ball;
			flare.CastShadow = false;
			trail(flare, Vector3.zero, Color3.fromRGB(255, 207, 111), 0.6, 0.5);
			const offset = new Vector3((index - 3.5) * 11, -10 - index * 2, 24 + index * 4);
			TweenService.Create(flare, new TweenInfo(1.2), { Position: position.add(offset), Transparency: 1 }).Play();
			Debris.AddItem(flare, 1.3);
		}
	},
};
