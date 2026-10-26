import { Debris, Workspace } from "@rbxts/services";

// Missiles are plain replicated server Parts; their smoke and motor flame are
// built here, locally, so nothing extra replicates. The smoke hangs off a
// Terrain-parented carrier that follows each missile's tail, so the plume keeps
// drifting and fades out after the missile itself is destroyed. Hostile flames
// burn orange-red so threats stay readable.
const SMOKE_LIFETIME = 1.6;
const TAIL = 2.3;
const SMOKE = "rbxasset://textures/particles/smoke_main.dds";
const FIRE = "rbxasset://textures/particles/fire_main.dds";
const sequence = (keys: [number, number][]) => new NumberSequence(keys.map(([time, value]) => new NumberSequenceKeypoint(time, value)));
interface Plume { part: BasePart; a: Attachment; b: Attachment; c: Attachment; puffs: ParticleEmitter }
export class MissileTrails {
	private readonly plumes = new Map<BasePart, Plume>();
	private readonly connections: RBXScriptConnection[] = [];
	public Start(folder: Instance): void {
		this.Stop();
		for (const child of folder.GetChildren()) this.track(child);
		this.connections.push(folder.ChildAdded.Connect((child) => this.track(child)));
	}
	public Stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, plume] of this.plumes) { plume.a.Destroy(); plume.b.Destroy(); plume.c.Destroy(); }
		this.plumes.clear();
	}
	/** Called from the flight RenderStep: moves carriers to their missiles' tails, retires the destroyed. */
	public Step(): void {
		for (const [part, plume] of this.plumes) {
			if (part.Parent === undefined) { this.retire(plume); continue; }
			this.place(plume);
		}
	}
	private place(plume: Plume): void {
		const frame = plume.part.CFrame;
		const tail = frame.PointToWorldSpace(new Vector3(0, 0, TAIL));
		const side = frame.RightVector.mul(0.6);
		plume.a.WorldPosition = tail.add(side);
		plume.b.WorldPosition = tail.sub(side);
		plume.c.WorldPosition = tail;
	}
	private retire(plume: Plume): void {
		this.plumes.delete(plume.part);
		plume.puffs.Enabled = false;
		for (const item of [plume.a, plume.b, plume.c]) Debris.AddItem(item, SMOKE_LIFETIME + 0.2);
	}
	private track(child: Instance): void {
		if (!child.IsA("BasePart") || this.plumes.has(child)) return;
		const hostile = child.Name === "HostileMissile";
		if (!hostile && child.Name !== "SkyLance") return;
		const terrain = Workspace.Terrain;
		const [a, b, c] = [new Instance("Attachment"), new Instance("Attachment"), new Instance("Attachment")];
		const puffs = new Instance("ParticleEmitter");
		const plume: Plume = { part: child, a, b, c, puffs };
		this.place(plume);
		for (const item of [a, b, c]) { item.Name = "MissileSmoke"; item.Parent = terrain; }
		const smoke = new Instance("Trail");
		smoke.Attachment0 = a;
		smoke.Attachment1 = b;
		smoke.Color = new ColorSequence([new ColorSequenceKeypoint(0, Color3.fromRGB(248, 248, 248)), new ColorSequenceKeypoint(1, Color3.fromRGB(176, 180, 186))]);
		smoke.Transparency = sequence([[0, 0.2], [0.6, 0.6], [1, 1]]);
		smoke.WidthScale = sequence([[0, 0.7], [1, 4]]);
		smoke.Lifetime = SMOKE_LIFETIME;
		smoke.MinLength = 0.5;
		smoke.FaceCamera = true;
		smoke.Parent = a;
		// Sparse billowing puffs that drift and swell give the ribbon volume.
		puffs.Texture = SMOKE;
		puffs.Color = new ColorSequence(Color3.fromRGB(226, 228, 232));
		puffs.Lifetime = new NumberRange(1, SMOKE_LIFETIME);
		puffs.Rate = 16;
		puffs.Size = sequence([[0, 1.4], [1, 6]]);
		puffs.Transparency = sequence([[0, 0.55], [1, 1]]);
		puffs.Speed = new NumberRange(1, 3);
		puffs.SpreadAngle = new Vector2(180, 180);
		puffs.Drag = 1.5;
		puffs.Acceleration = new Vector3(0, 2.5, 0);
		puffs.Rotation = new NumberRange(0, 360);
		puffs.RotSpeed = new NumberRange(-30, 30);
		puffs.Parent = c;
		// The motor flame rides the missile Part itself and dies with it.
		const nozzle = new Instance("Attachment");
		nozzle.Name = "MotorFx";
		nozzle.Position = new Vector3(0, 0, TAIL);
		const flame = new Instance("ParticleEmitter");
		flame.Texture = FIRE;
		flame.Color = new ColorSequence([new ColorSequenceKeypoint(0, Color3.fromRGB(255, 250, 235)), new ColorSequenceKeypoint(1, hostile ? Color3.fromRGB(255, 84, 40) : Color3.fromRGB(255, 196, 110))]);
		flame.Lifetime = new NumberRange(0.06, 0.11);
		flame.Rate = 45;
		flame.Size = sequence([[0, hostile ? 1.8 : 1.4], [1, 0.2]]);
		flame.Transparency = sequence([[0, 0], [1, 1]]);
		flame.Speed = new NumberRange(18, 26);
		flame.EmissionDirection = Enum.NormalId.Back;
		flame.LockedToPart = true;
		flame.LightEmission = 1;
		flame.LightInfluence = 0;
		flame.Brightness = 3;
		flame.ZOffset = 1;
		flame.Parent = nozzle;
		const light = new Instance("PointLight");
		light.Color = hostile ? Color3.fromRGB(255, 110, 60) : Color3.fromRGB(255, 210, 150);
		light.Brightness = 2;
		light.Range = hostile ? 14 : 10;
		light.Shadows = false;
		light.Parent = nozzle;
		nozzle.Parent = child;
		this.plumes.set(child, plume);
	}
}
