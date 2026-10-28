import { Lighting, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { ENVIRONMENT_ATTRIBUTE } from "../shared/EnvironmentPresets";
import type { EnvironmentPreset } from "../shared/WorldTypes";
import { WEATHER_VOLUME, lightningGap, weatherPlan, type DriftSpec, type RainSpec, type WeatherPlan } from "../shared/WeatherRules";
import { MotionPreference } from "./MotionPreference";

// Client-only weather for the mission presets (shared/WeatherRules decides
// what and how much): rain and drifting dust or fog wisps spawn in a cube of
// air welded to the local jet visual, so they travel with it without any
// per-frame code; lightning is a timer that flashes the grade and draws a
// short-lived bolt; the aurora is a handful of static sky beams. Phones get
// the same effects at a lower particle share.

const VISUAL = "SkybreakLocalFlightVisual";
const SPARK = "rbxasset://textures/particles/sparkles_main.dds";
const SMOKE = "rbxasset://textures/particles/smoke_main.dds";
const rgb = (c: [number, number, number]) => Color3.fromRGB(c[0], c[1], c[2]);

function rainEmitter(parent: BasePart, spec: RainSpec): void {
	const e = new Instance("ParticleEmitter");
	e.Name = "Rain";
	e.Texture = SPARK;
	e.Color = new ColorSequence(Color3.fromRGB(200, 214, 228));
	e.LightEmission = 0.2;
	e.LightInfluence = 0.6;
	e.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(0.15, spec.transparency), new NumberSequenceKeypoint(1, spec.transparency + 0.2)]);
	e.Size = new NumberSequence(spec.size);
	// Tall, thin streaks aligned with their (world-space) fall.
	e.Squash = new NumberSequence(2.6);
	e.Orientation = Enum.ParticleOrientation.VelocityParallel;
	// The volume rolls with the jet, so the fall comes from world-space acceleration, not the emission direction.
	e.Speed = new NumberRange(0, 30);
	e.Acceleration = new Vector3(0, -spec.fall * 2.4, 0);
	e.Lifetime = new NumberRange(spec.lifetime * 0.8, spec.lifetime);
	e.Rate = spec.rate;
	e.Shape = Enum.ParticleEmitterShape.Box;
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume;
	e.LockedToPart = false;
	e.Parent = parent;
}

function driftEmitter(parent: BasePart, spec: DriftSpec): void {
	const e = new Instance("ParticleEmitter");
	e.Name = "Drift";
	e.Texture = SMOKE;
	e.Color = new ColorSequence(rgb(spec.color));
	e.LightInfluence = 1;
	e.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(0.3, spec.transparency), new NumberSequenceKeypoint(1, 1)]);
	e.Size = new NumberSequence(spec.size[0], spec.size[1]);
	e.Speed = new NumberRange(0, 8);
	e.Acceleration = new Vector3(spec.wind[0], spec.wind[1], spec.wind[2]);
	e.Lifetime = new NumberRange(spec.lifetime * 0.7, spec.lifetime);
	e.Rotation = new NumberRange(0, 360);
	e.RotSpeed = new NumberRange(-8, 8);
	e.Rate = spec.rate;
	e.Shape = Enum.ParticleEmitterShape.Box;
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume;
	e.LockedToPart = false;
	e.Parent = parent;
}

/** An invisible cube of air welded to the jet's root: emitters inside it move with the jet. */
function attachVolume(visual: Model, plan: WeatherPlan): BasePart | undefined {
	const root = visual.PrimaryPart;
	if (root === undefined || (plan.rain === undefined && plan.drift === undefined)) return undefined;
	const volume = new Instance("Part");
	volume.Name = "WeatherVolume";
	volume.Size = new Vector3(WEATHER_VOLUME, WEATHER_VOLUME * 0.7, WEATHER_VOLUME);
	// Centred ahead of and above the jet so streaks cross the chase camera's view.
	volume.CFrame = root.CFrame.mul(new CFrame(0, 60, -120));
	volume.Transparency = 1;
	volume.CanCollide = false;
	volume.CanQuery = false;
	volume.CanTouch = false;
	volume.CastShadow = false;
	volume.Massless = true;
	volume.Anchored = false;
	const weld = new Instance("WeldConstraint");
	weld.Part0 = root;
	weld.Part1 = volume;
	weld.Parent = volume;
	if (plan.rain) rainEmitter(volume, plan.rain);
	if (plan.drift) driftEmitter(volume, plan.drift);
	volume.Parent = visual;
	return volume;
}

function aurora(plan: WeatherPlan): Folder | undefined {
	const spec = plan.aurora;
	if (spec === undefined) return undefined;
	const folder = new Instance("Folder");
	folder.Name = "AuroraSky";
	const random = new Random(97);
	for (let i = 0; i < spec.bands; i++) {
		const anchors: Attachment[] = [];
		for (const side of [-1, 1]) {
			const pin = new Instance("Part");
			pin.Name = "AuroraAnchor";
			pin.Anchored = true;
			pin.CanCollide = false;
			pin.CanQuery = false;
			pin.CanTouch = false;
			pin.Transparency = 1;
			pin.Size = Vector3.one;
			// High over the northern horizon, each band a little further and higher than the last.
			pin.CFrame = new CFrame(side * random.NextNumber(2600, 3600), 1900 + i * 260 + random.NextNumber(-80, 80), -3400 - i * 380);
			pin.Parent = folder;
			const a = new Instance("Attachment");
			a.Parent = pin;
			anchors.push(a);
		}
		const beam = new Instance("Beam");
		beam.Attachment0 = anchors[0];
		beam.Attachment1 = anchors[1];
		const c0 = rgb(spec.colors[i % spec.colors.size()] as [number, number, number]), c1 = rgb(spec.colors[(i + 1) % spec.colors.size()] as [number, number, number]);
		beam.Color = new ColorSequence([new ColorSequenceKeypoint(0, c0), new ColorSequenceKeypoint(0.5, c1), new ColorSequenceKeypoint(1, c0)]);
		beam.Transparency = new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(0.2, 0.55), new NumberSequenceKeypoint(0.5, 0.35), new NumberSequenceKeypoint(0.8, 0.6), new NumberSequenceKeypoint(1, 1)]);
		beam.Width0 = random.NextNumber(500, 800);
		beam.Width1 = random.NextNumber(400, 700);
		beam.CurveSize0 = random.NextNumber(600, 1400) * (i % 2 === 0 ? 1 : -1);
		beam.CurveSize1 = random.NextNumber(400, 1200) * (i % 2 === 0 ? -1 : 1);
		beam.Segments = spec.segments;
		beam.LightEmission = 1;
		beam.LightInfluence = 0;
		beam.FaceCamera = true;
		beam.Parent = anchors[0].Parent;
	}
	folder.Parent = Workspace;
	return folder;
}

export const Weather = {
	/** Starts the weather for whatever preset the server publishes; returns a stop function. */
	Start(): () => void {
		const phone = UserInputService.TouchEnabled;
		let plan: WeatherPlan = {};
		let volume: BasePart | undefined;
		let sky: Folder | undefined;
		let generation = 0;
		const flash = new Instance("ColorCorrectionEffect");
		flash.Name = "WeatherFlash";
		flash.Parent = Lighting;

		const attachTo = (item: Instance) => {
			if (item.Name !== VISUAL || !item.IsA("Model")) return;
			volume?.Destroy();
			volume = attachVolume(item, plan);
		};
		const strike = () => {
			const spec = plan.lightning;
			const camera = Workspace.CurrentCamera;
			if (spec === undefined || camera === undefined) return;
			// A brief grade flash (one or two flickers), then the bolt somewhere ahead in the murk.
			for (let k = 0; k < spec.flickers; k++) task.delay(k * 0.11, () => {
				flash.Brightness = spec.flash;
				TweenService.Create(flash, new TweenInfo(0.09, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Brightness: 0 }).Play();
			});
			if (!spec.bolt) return;
			const random = new Random();
			const look = camera.CFrame.LookVector, level = new Vector3(look.X, 0, look.Z);
			const flat = level.Magnitude > 0.01 ? level.Unit : new Vector3(0, 0, -1);
			const angle = random.NextNumber(-0.9, 0.9), distance = random.NextNumber(1400, 2600);
			const dir = CFrame.Angles(0, angle, 0).VectorToWorldSpace(flat);
			let point = camera.CFrame.Position.mul(new Vector3(1, 0, 1)).add(dir.mul(distance)).add(new Vector3(0, 900, 0));
			const bolt = new Instance("Folder");
			bolt.Name = "LightningBolt";
			for (let s = 0; s < 6; s++) {
				const tip = point.add(new Vector3(random.NextNumber(-70, 70), -150, random.NextNumber(-70, 70)));
				const seg = new Instance("Part");
				seg.Anchored = true; seg.CanCollide = false; seg.CanQuery = false; seg.CanTouch = false; seg.CastShadow = false;
				seg.Material = Enum.Material.Neon;
				seg.Color = Color3.fromRGB(220, 230, 255);
				seg.Size = new Vector3(3, 3, tip.sub(point).Magnitude);
				seg.CFrame = CFrame.lookAt(point.add(tip).div(2), tip);
				seg.Parent = bolt;
				point = tip;
			}
			bolt.Parent = Workspace;
			task.delay(0.16, () => bolt.Destroy());
		};
		const schedule = (mine: number) => {
			const spec = plan.lightning;
			if (spec === undefined) return;
			task.delay(lightningGap(spec, math.random()), () => {
				if (mine !== generation) return;
				strike();
				schedule(mine);
			});
		};
		const apply = () => {
			generation += 1;
			plan = weatherPlan(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE) as EnvironmentPreset | undefined, phone, MotionPreference.reduced);
			volume?.Destroy(); volume = undefined;
			sky?.Destroy(); sky = aurora(plan);
			flash.Brightness = 0;
			const visual = Workspace.FindFirstChild(VISUAL);
			if (visual) attachTo(visual);
			schedule(generation);
		};
		const connections = [
			Lighting.GetAttributeChangedSignal(ENVIRONMENT_ATTRIBUTE).Connect(apply),
			Workspace.ChildAdded.Connect(attachTo),
		];
		apply();
		return () => {
			generation += 1;
			for (const c of connections) c.Disconnect();
			volume?.Destroy();
			sky?.Destroy();
			flash.Destroy();
		};
	},
};
