import { Debris, TweenService } from "@rbxts/services";
import { BlenderAircraft } from "./BlenderAircraft";
import { EngineFx } from "./EngineFx";

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
// A trail's segment count grows with Lifetime x speed; at 300 studs/s a 1.1 s
// wingtip ribbon was ~330 studs of segments per tip. 0.7 s keeps the look.
const TRAIL_MAX_LIFETIME = 0.7;
/**
 * One replicated part per aircraft: the Root stays anchored and every other
 * part is unanchored, massless and welded to it. Moving the Root (CFrame or
 * PivotTo) moves the whole assembly, so the server replicates a single CFrame
 * per aircraft per update instead of one per MeshPart.
 */
function weldToRoot(model: Model, root: BasePart): void {
	for (const item of model.GetDescendants()) {
		if (!item.IsA("BasePart") || item === root) continue;
		item.Anchored = false;
		item.Massless = true;
		item.CanCollide = false;
		item.CanTouch = false;
		item.CanQuery = item.GetAttribute("FlightSolid") === true;
		const weld = new Instance("WeldConstraint");
		weld.Name = "RootWeld";
		weld.Part0 = root;
		weld.Part1 = item;
		weld.Parent = item;
	}
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
	effect.Lifetime = math.min(lifetime, TRAIL_MAX_LIFETIME);
	effect.LightEmission = 0.75;
	effect.FaceCamera = true;
	effect.MinLength = 0.1;
	effect.Parent = parent;
	return effect;
}
// Built-in engine textures: no uploaded assets.
const FIRE = "rbxasset://textures/particles/fire_main.dds";
const SMOKE = "rbxasset://textures/particles/smoke_main.dds";
const GLOW = "rbxasset://textures/particles/sparkles_main.dds";
const sequence = (a: number, b: number) => new NumberSequence([new NumberSequenceKeypoint(0, a), new NumberSequenceKeypoint(1, b)]);
const colors = (a: Color3, b: Color3) => new ColorSequence([new ColorSequenceKeypoint(0, a), new ColorSequenceKeypoint(1, b)]);
function emitter(parent: Instance, name: string, texture: string, color: ColorSequence, lifetime: number, rate: number): ParticleEmitter {
	const effect = new Instance("ParticleEmitter");
	effect.Name = name;
	effect.Texture = texture;
	effect.Color = color;
	effect.Lifetime = new NumberRange(lifetime * 0.7, lifetime);
	effect.Rate = rate;
	effect.Speed = new NumberRange(0);
	effect.Rotation = new NumberRange(0, 360);
	effect.Parent = parent;
	return effect;
}
function attachment(parent: BasePart, name: string, position: Vector3): Attachment {
	const item = new Instance("Attachment");
	item.Name = name;
	item.Position = position;
	item.Parent = parent;
	return item;
}
/** Live handles to one aircraft's engine and vapor effects (found once, then driven per frame). */
export interface EngineRig {
	flame: ParticleEmitter;
	glow: ParticleEmitter;
	light: PointLight;
	trail?: Trail;
	vapor: ParticleEmitter[];
	intensity: number;
	vaporRate: number;
}
function engineEffects(root: BasePart, exhaust: Vector3, wingtips: Vector3[], enemy: boolean): void {
	const nozzle = attachment(root, "ExhaustFx", exhaust.add(new Vector3(0, 0, 0.4)));
	const hot = Color3.fromRGB(255, 244, 214);
	const flame = emitter(nozzle, "AfterburnerFlame", FIRE, colors(hot, enemy ? Color3.fromRGB(255, 92, 48) : Color3.fromRGB(255, 150, 60)), 0.12, 0);
	flame.EmissionDirection = Enum.NormalId.Back;
	flame.LockedToPart = true;
	flame.LightEmission = 1;
	flame.LightInfluence = 0;
	flame.Brightness = 2.5;
	flame.SpreadAngle = new Vector2(4, 4);
	flame.Transparency = sequence(0.1, 1);
	flame.ZOffset = 0.5;
	const glow = emitter(nozzle, "AfterburnerGlow", GLOW, new ColorSequence(enemy ? Color3.fromRGB(255, 170, 120) : Color3.fromRGB(255, 214, 160)), 0.12, 24);
	glow.LockedToPart = true;
	glow.LightEmission = 1;
	glow.LightInfluence = 0;
	glow.Transparency = sequence(0.25, 1);
	glow.ZOffset = 1;
	const light = new Instance("PointLight");
	light.Name = "AfterburnerLight";
	light.Color = Color3.fromRGB(255, 160, 90);
	light.Shadows = false;
	light.Parent = nozzle;
	for (const tip of wingtips) {
		const vapor = emitter(attachment(root, "VaporFx", tip), "WingVapor", SMOKE, new ColorSequence(Color3.fromRGB(240, 248, 255)), 0.45, 0);
		vapor.Size = sequence(0.6, 2.4);
		vapor.Transparency = sequence(0.55, 1);
		vapor.Drag = 4;
	}
	const rig = JetFactory.FindEngine(root.Parent as Model);
	if (rig) JetFactory.SetEngine(rig, EngineFx.EnemyIntensity);
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
		const attachments = blender ? BlenderAircraft.GetAttachments(model) : {
			leftWingtip: new Vector3(-10, -0.25, 4),
			rightWingtip: new Vector3(10, -0.25, 4),
			exhaust: new Vector3(0, -0.1, 9.3),
		};
		for (const tip of [attachments.leftWingtip, attachments.rightWingtip]) {
			trail(root, tip, Color3.fromRGB(224, 246, 255), 0.25, TRAIL_MAX_LIFETIME);
		}
		trail(root, attachments.exhaust, accent, 1.1, 0.35).Name = "ExhaustTrail";
		engineEffects(root, attachments.exhaust, [attachments.leftWingtip, attachments.rightWingtip], enemy);
		weldToRoot(model, root);
		return model;
	},
	/** Welds a moving multi-part model (e.g. an escorted vehicle) to its PrimaryPart so only that part replicates. */
	WeldAssembly(model: Model): void {
		const root = model.PrimaryPart;
		if (root) weldToRoot(model, root);
	},
	/** Trails, particles and lights drawn only on local visual clones, never on replicated server models. */
	IsCosmetic(item: Instance): item is Trail | ParticleEmitter | Light {
		return item.IsA("Trail") || item.IsA("ParticleEmitter") || item.IsA("Light");
	},
	/** Shows a cosmetic on a local visual clone, dropping stale segments and particles. */
	ShowCosmetic(item: Trail | ParticleEmitter | Light): void {
		item.Enabled = true;
		if (item.IsA("Trail")) item.Clear();
		else if (item.IsA("ParticleEmitter")) item.Clear();
	},
	/** Turns every aircraft trail, emitter and light on or off (server models stay dark; local visual clones show them). */
	SetTrails(model: Model, enabled: boolean): void {
		const root = model.PrimaryPart;
		if (!root) return;
		for (const item of root.GetDescendants()) if (JetFactory.IsCosmetic(item)) item.Enabled = enabled;
	},
	FindEngine(model: Model): EngineRig | undefined {
		const root = model.PrimaryPart;
		const nozzle = root?.FindFirstChild("ExhaustFx");
		const flame = nozzle?.FindFirstChild("AfterburnerFlame");
		const glow = nozzle?.FindFirstChild("AfterburnerGlow");
		const light = nozzle?.FindFirstChild("AfterburnerLight");
		if (!root || !flame?.IsA("ParticleEmitter") || !glow?.IsA("ParticleEmitter") || !light?.IsA("PointLight")) return undefined;
		const trail = root.FindFirstChild("ExhaustTrail");
		const vapor: ParticleEmitter[] = [];
		for (const item of root.GetChildren()) {
			const emitter = item.Name === "VaporFx" ? item.FindFirstChild("WingVapor") : undefined;
			if (emitter?.IsA("ParticleEmitter")) vapor.push(emitter);
		}
		return { flame, glow, light, trail: trail?.IsA("Trail") ? trail : undefined, vapor, intensity: -1, vaporRate: -1 };
	},
	/** Afterburner look for intensity 0..1; only rewrites properties when the quantized value changes. */
	SetEngine(rig: EngineRig, intensity: number): void {
		const value = EngineFx.Quantize(intensity);
		if (value === rig.intensity) return;
		rig.intensity = value;
		const look = EngineFx.Look(value);
		rig.flame.Rate = look.flameRate;
		rig.flame.Speed = new NumberRange(look.flameSpeed * 0.75, look.flameSpeed);
		rig.flame.Size = sequence(look.flameSize, look.flameSize * 0.25);
		rig.glow.Size = sequence(look.glowSize, look.glowSize * 0.6);
		rig.light.Brightness = look.lightBrightness;
		rig.light.Range = look.lightRange;
		if (rig.trail) rig.trail.Lifetime = look.trailLifetime;
	},
	SetVapor(rig: EngineRig, rate: number): void {
		if (rate === rig.vaporRate) return;
		rig.vaporRate = rate;
		for (const vapor of rig.vapor) vapor.Rate = rate;
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
	/** Six magnesium flares kicked out and back from `facing` (the jet's frame), then falling in an arc on smoke trails. */
	Flares(parent: Instance, position: Vector3, facing?: CFrame): void {
		const frame = (facing ?? new CFrame()).Rotation.add(position);
		for (let index = 1; index <= 6; index++) {
			const flare = part(parent, "Part", "Countermeasure", new Vector3(1.1, 1.1, 1.1), new CFrame(position), Color3.fromRGB(255, 248, 228), Enum.Material.Neon);
			flare.Shape = Enum.PartType.Ball;
			flare.CastShadow = false;
			trail(flare, Vector3.zero, Color3.fromRGB(255, 226, 160), 0.7, 0.4);
			const smoke = emitter(flare, "FlareSmoke", SMOKE, colors(Color3.fromRGB(250, 250, 250), Color3.fromRGB(180, 184, 190)), 1, 22);
			smoke.Size = sequence(1, 4.5);
			smoke.Transparency = sequence(0.35, 1);
			smoke.Speed = new NumberRange(1, 3);
			smoke.SpreadAngle = new Vector2(180, 180);
			smoke.Drag = 2;
			smoke.Acceleration = new Vector3(0, 2, 0);
			const sparkle = emitter(flare, "FlareGlow", GLOW, new ColorSequence(Color3.fromRGB(255, 240, 200)), 0.1, 16);
			sparkle.LockedToPart = true;
			sparkle.LightEmission = 1;
			sparkle.Size = sequence(4.5, 2);
			if (index === 1) {
				const light = new Instance("PointLight");
				light.Color = Color3.fromRGB(255, 226, 170);
				light.Brightness = 3;
				light.Range = 24;
				light.Parent = flare;
			}
			// Kick out sideways and back, then drop: two eased legs read as a ballistic arc.
			const side = (index % 2 === 0 ? 1 : -1) * (14 + index * 3);
			const kick = frame.PointToWorldSpace(new Vector3(side, -4 - index, 18 + index * 3));
			const fall = frame.PointToWorldSpace(new Vector3(side * 1.6, 0, 34 + index * 5)).sub(new Vector3(0, 55 + index * 6, 0));
			const out = TweenService.Create(flare, new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position: kick });
			out.Completed.Connect(() => {
				if (!flare.Parent) return;
				// The glow burns out as the flare drops; smoke stops early so its puffs fade before the part goes.
				sparkle.Enabled = false;
				TweenService.Create(flare, new TweenInfo(1.05, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Position: fall, Transparency: 1, Size: new Vector3(0.5, 0.5, 0.5) }).Play();
				task.delay(0.6, () => { smoke.Enabled = false; });
			});
			out.Play();
			Debris.AddItem(flare, 2.4);
		}
	},
};
