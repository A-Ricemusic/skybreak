import { Debris, Players, RunService, TweenService, Workspace } from "@rbxts/services";
import { FlightMath } from "../shared/FlightMath";
import { ExplosionFx, ExplosionKind } from "../shared/ExplosionFx";
import { CombatEffectPacket, Remotes } from "../shared/Types";
import { ClaimedVisual, EnemySmoothing } from "./EnemySmoothing";

// Client-only kill/impact visuals: fireball, smoke, sparks and a flash per
// explosion, falling burning wrecks for air kills and smoke over ground kills.
// The server sends one CombatEffect event per explosion; nothing here replicates.
const FIRE = "rbxasset://textures/particles/fire_main.dds";
const SMOKE = "rbxasset://textures/particles/smoke_main.dds";
const SPARK = "rbxasset://textures/particles/sparkles_main.dds";
type Listener = (position: Vector3, scale: number, kind: ExplosionKind) => void;
interface Wreck { visual: Model; root: BasePart; frame: CFrame; velocity: Vector3; spin: Vector3; age: number }
interface Timed { item: Instance; until: number }
const listeners = new Set<Listener>();
const wrecks: Wreck[] = [];
const explosions: Timed[] = [];
const scorches: Timed[] = [];
let folder: Folder | undefined;
let clearSerial = 0;

function root(): Folder {
	if (folder?.Parent) return folder;
	folder = new Instance("Folder");
	folder.Name = "SkybreakEffects";
	folder.Parent = Workspace;
	return folder;
}
function anchor(position: Vector3, name: string): Part {
	const item = new Instance("Part");
	item.Name = name; item.Size = Vector3.one; item.Position = position; item.Transparency = 1;
	item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = false; item.CastShadow = false;
	item.Parent = root();
	return item;
}
function sequence(start: number, finish: number): NumberSequence {
	return new NumberSequence(math.min(start, 100), math.min(finish, 100));
}
function emitter(parent: Instance, texture: string, props: Partial<WritableInstanceProperties<ParticleEmitter>>): ParticleEmitter {
	const item = new Instance("ParticleEmitter");
	item.Texture = texture; item.Rate = 0; item.Enabled = false;
	item.SpreadAngle = new Vector2(180, 180); item.Rotation = new NumberRange(0, 360); item.RotSpeed = new NumberRange(-60, 60);
	for (const [key, value] of pairs(props)) (item as unknown as Record<string, unknown>)[key] = value;
	item.Parent = parent;
	return item;
}
function fire(parent: Instance, size: number, props: Partial<WritableInstanceProperties<ParticleEmitter>> = {}): ParticleEmitter {
	return emitter(parent, FIRE, {
		Color: new ColorSequence([new ColorSequenceKeypoint(0, Color3.fromRGB(255, 244, 180)), new ColorSequenceKeypoint(0.35, Color3.fromRGB(255, 150, 50)), new ColorSequenceKeypoint(1, Color3.fromRGB(150, 40, 20))]),
		LightEmission: 1, LightInfluence: 0, ZOffset: 1, Drag: 5,
		Size: sequence(size * 0.35, size * 0.7), Lifetime: new NumberRange(0.35, 0.7), Speed: new NumberRange(size * 0.5, size * 1.3),
		Transparency: new NumberSequence([new NumberSequenceKeypoint(0, 0.05), new NumberSequenceKeypoint(0.7, 0.4), new NumberSequenceKeypoint(1, 1)]),
		...props,
	});
}
function smoke(parent: Instance, size: number, life: number, props: Partial<WritableInstanceProperties<ParticleEmitter>> = {}): ParticleEmitter {
	return emitter(parent, SMOKE, {
		Color: new ColorSequence(Color3.fromRGB(46, 40, 38), Color3.fromRGB(105, 102, 100)),
		LightInfluence: 1, Drag: 2, Acceleration: new Vector3(0, 6, 0), RotSpeed: new NumberRange(-20, 20),
		Size: sequence(size * 0.4, size * 1.1), Lifetime: new NumberRange(life * 0.6, life), Speed: new NumberRange(size * 0.15, size * 0.45),
		Transparency: new NumberSequence([new NumberSequenceKeypoint(0, 0.25), new NumberSequenceKeypoint(1, 1)]),
		...props,
	});
}
function track(list: Timed[], cap: number, item: Instance, seconds: number): void {
	for (let index = ExplosionFx.Overflow(list.size(), cap); index > 0; index--) list.shift()?.item.Destroy();
	list.push({ item, until: os.clock() + seconds });
	Debris.AddItem(item, seconds);
}
function prune(list: Timed[]): void {
	const now = os.clock();
	while (list.size() > 0 && (list[0].until <= now || list[0].item.Parent === undefined)) list.shift();
}

function explode(kind: ExplosionKind, position: Vector3, scale = 1): void {
	const profile = ExplosionFx.Profile(kind, scale);
	const size = profile.size;
	const item = anchor(position, `Explosion_${kind}`);
	fire(item, size).Emit(profile.fire);
	smoke(item, size, profile.smokeLife).Emit(profile.smoke);
	emitter(item, SPARK, {
		Color: new ColorSequence(Color3.fromRGB(255, 226, 160)), LightEmission: 1, LightInfluence: 0, Drag: 1,
		Size: sequence(size * 0.04 + 0.4, 0), Lifetime: new NumberRange(0.5, 1.2), Speed: new NumberRange(size * 1.5, size * 3.5), Acceleration: new Vector3(0, -60, 0),
	}).Emit(profile.sparks);
	emitter(item, SPARK, {
		Color: new ColorSequence(Color3.fromRGB(30, 28, 26)), LightInfluence: 1, Drag: 0.5,
		Size: sequence(size * 0.05 + 0.5, size * 0.05 + 0.5), Lifetime: new NumberRange(1, 1.6), Speed: new NumberRange(size, size * 2), Acceleration: new Vector3(0, -90, 0),
	}).Emit(math.ceil(profile.sparks / 3));
	const light = new Instance("PointLight");
	light.Color = Color3.fromRGB(255, 170, 80); light.Brightness = 6; light.Range = math.min(60, profile.light); light.Shadows = false;
	light.Parent = item;
	TweenService.Create(light, new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Brightness: 0 }).Play();
	track(explosions, ExplosionFx.MaxExplosions, item, profile.smokeLife + 0.3);
	for (const listener of listeners) task.spawn(listener, position, size, kind);
}
function startWreck(claim: ClaimedVisual): void {
	for (let index = ExplosionFx.Overflow(wrecks.size(), ExplosionFx.MaxWrecks); index > 0; index--) endWreck(wrecks.shift()!);
	const visualRoot = claim.visual.PrimaryPart;
	if (!visualRoot) { claim.visual.Destroy(); return; }
	claim.visual.Name = "Wreck";
	claim.visual.Parent = root();
	for (const item of claim.visual.GetDescendants()) if (item.IsA("Trail")) item.Enabled = false;
	const attachment = new Instance("Attachment");
	attachment.Parent = visualRoot;
	for (const item of [
		fire(attachment, 7, { Rate: 26, Speed: new NumberRange(2, 6), SpreadAngle: new Vector2(25, 25), Lifetime: new NumberRange(0.25, 0.45) }),
		smoke(attachment, 10, 2.2, { Rate: 16, Speed: new NumberRange(1, 4), SpreadAngle: new Vector2(20, 20) }),
	]) item.Enabled = true;
	const side = math.random() < 0.5 ? -1 : 1;
	wrecks.push({
		visual: claim.visual, root: visualRoot, frame: claim.frame, age: 0,
		velocity: claim.velocity.Magnitude > 1 ? claim.velocity : claim.frame.LookVector.mul(250),
		spin: new Vector3(-(0.4 + math.random()), (math.random() - 0.5) * 0.6, side * (2.5 + math.random() * 2.5)),
	});
}
/** Final pop; the emitters stop and the smoke already in the air fades before the root is removed. */
function endWreck(wreck: Wreck): void {
	if (wreck.visual.Parent === undefined) return;
	explode("wreck", wreck.frame.Position);
	for (const item of wreck.visual.GetChildren()) if (item !== wreck.root) item.Destroy();
	for (const item of wreck.root.GetDescendants()) if (item.IsA("ParticleEmitter")) item.Enabled = false;
	Debris.AddItem(wreck.visual, 2.5);
}
const wreckParams = new RaycastParams();
wreckParams.FilterType = Enum.RaycastFilterType.Exclude;
function stepWrecks(dt: number): void {
	if (wrecks.size() === 0 || !FlightMath.IsFinite(dt) || dt <= 0) return;
	const params = wreckParams;
	const exclude: Instance[] = [root()];
	const character = Players.LocalPlayer?.Character;
	if (character) exclude.push(character);
	params.FilterDescendantsInstances = exclude;
	for (let index = wrecks.size() - 1; index >= 0; index--) {
		const wreck = wrecks[index];
		wreck.age += dt;
		// Expire before casting after a suspended frame. Live wrecks are <3.2 s
		// old, keeping speed-scaled rays far below the 15000-stud ray limit.
		if (wreck.age >= ExplosionFx.WreckSeconds) { wrecks.remove(index); endWreck(wreck); continue; }
		wreck.velocity = wreck.velocity.mul(1 - math.min(1, 0.35 * dt)).add(new Vector3(0, -ExplosionFx.WreckGravity * dt, 0));
		const from = wreck.frame.Position;
		const delta = wreck.velocity.mul(dt);
		const hit = Workspace.Raycast(from, delta, params);
		const spin = wreck.spin.mul(dt);
		wreck.frame = wreck.frame.Rotation.add(hit ? hit.Position : from.add(delta)).mul(CFrame.Angles(spin.X, spin.Y, spin.Z));
		if (wreck.visual.Parent === undefined) { wrecks.remove(index); continue; }
		wreck.root.CFrame = wreck.frame;
		if (hit || wreck.age >= ExplosionFx.WreckSeconds) { wrecks.remove(index); endWreck(wreck); }
	}
}
function scorch(position: Vector3, scale: number): void {
	const item = anchor(position, "Scorch");
	const size = 14 * math.clamp(scale, 0.5, 2.5);
	const plume = smoke(item, size, 4.5, { Rate: 5, Speed: new NumberRange(3, 8), SpreadAngle: new Vector2(25, 25), EmissionDirection: Enum.NormalId.Top, Acceleration: new Vector3(0, 8, 0) });
	const embers = fire(item, size * 0.5, { Rate: 6, Speed: new NumberRange(1, 4), SpreadAngle: new Vector2(40, 40), EmissionDirection: Enum.NormalId.Top, Lifetime: new NumberRange(0.4, 0.8) });
	plume.Enabled = true; embers.Enabled = true;
	task.delay(ExplosionFx.ScorchSeconds * 0.4, () => { embers.Enabled = false; });
	task.delay(ExplosionFx.ScorchSeconds, () => { plume.Enabled = false; });
	track(scorches, ExplosionFx.MaxScorches, item, ExplosionFx.ScorchSeconds + 4.5);
}
function receive(data: unknown): void {
	if (!typeIs(data, "table")) return;
	const packet = data as Partial<CombatEffectPacket>;
	if (!ExplosionFx.IsKind(packet.kind) || !typeIs(packet.position, "Vector3")) return;
	const scale = typeIs(packet.scale, "number") && packet.scale === packet.scale ? packet.scale : 1;
	const leaves = ExplosionFx.Leaves(packet.kind);
	// An air kill explodes where this client drew the jet, and its smoothed clone becomes the wreck.
	const model = typeIs(packet.model, "Instance") && packet.model.IsA("Model") ? packet.model : undefined;
	const claim = leaves === "wreck" ? EnemySmoothing.Claim(model, packet.position) : undefined;
	explode(packet.kind, claim?.frame.Position ?? packet.position, scale);
	if (leaves === "scorch") scorch(packet.position, scale);
	else if (claim) {
		if (typeIs(packet.velocity, "Vector3") && packet.velocity.Magnitude > 1) claim.velocity = packet.velocity;
		startWreck(claim);
	}
	prune(explosions); prune(scorches);
}

export const CombatEffects = {
	/** Listens for server effects; clears everything when a mission loads or a few seconds after it ends. Returns a stop function. */
	Start(remotes: Pick<Remotes, "CombatEffect" | "MissionState">): () => void {
		const connections = [
			remotes.CombatEffect.OnClientEvent.Connect(receive),
			remotes.MissionState.OnClientEvent.Connect((data: unknown) => {
				const kind = typeIs(data, "table") ? (data as { kind?: unknown }).kind : undefined;
				if (kind === "Loading") CombatEffects.Clear();
				else if (kind === "Completed" || kind === "Failed") {
					const serial = clearSerial;
					task.delay(4, () => { if (serial === clearSerial) CombatEffects.Clear(); });
				}
			}),
			RunService.Heartbeat.Connect(stepWrecks),
		];
		return () => { for (const connection of connections) connection.Disconnect(); CombatEffects.Clear(); };
	},
	/** Draws an explosion locally (also notifies OnExplosion listeners). */
	Explode(kind: ExplosionKind, position: Vector3, scale = 1): void {
		explode(kind, position, scale);
	},
	/** Called with every explosion's position and fireball size in studs (e.g. for camera shake). Returns a disconnect function. */
	OnExplosion(callback: Listener): () => void {
		listeners.add(callback);
		return () => listeners.delete(callback);
	},
	Clear(): void {
		clearSerial += 1;
		wrecks.clear(); explosions.clear(); scorches.clear();
		folder?.Destroy(); folder = undefined;
	},
};
