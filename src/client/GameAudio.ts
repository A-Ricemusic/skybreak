import { ContentProvider, Debris, Players, SoundService, TweenService, Workspace } from "@rbxts/services";
import { AudioRules, AudioWarning } from "../shared/AudioRules";
import { HOSTILE_MISSILE, PLAYER_MISSILE } from "../shared/JetFactory";
import { SoundBank } from "../shared/SoundBank";
import { ExplosionKind } from "../shared/ExplosionFx";
import type { Telemetry } from "../shared/Types";
import { CombatEffects } from "./CombatEffects";
import { duckGain } from "../shared/VoiceLines";
import { VoicePlayer } from "./VoicePlayer";

interface MovingSound { sound: Sound; last: Vector3; passed: boolean }
interface TrackedEngine { model: Model; root: BasePart; sound: Sound }
/** Client audio only. Never embeds provider credentials or calls generation APIs. */
export class GameAudio {
	private readonly group = new Instance("SoundGroup");
	private readonly world = new Instance("Folder");
	private readonly oneShots: Sound[] = [];
	private readonly motors = new Map<BasePart, MovingSound>();
	private readonly engines = new Map<Model, TrackedEngine>();
	private readonly connections: RBXScriptConnection[] = [];
	private stopExplosions?: () => void;
	private folder?: Instance;
	private aircraft?: Model;
	private cruise?: Sound;
	private burn?: Sound;
	private wind?: Sound;
	private warning?: Sound;
	private warningKind?: AudioWarning;
	private locked = false;
	private target?: Model;
	private deniedSerial = 0;
	private specialCharges?: number;
	private evadeCooldown = 0;
	private alive = true;
	private dead = false;
	private nextLaunch = 0;
	private nextHit = 0;
	private nextFlare = 0;
	private nextUi = 0;
	private observed?: Telemetry;
	private scanTime = 0;
	private tailUntil = 0;
	private paused = false;
	private settingsConnection?: RBXScriptConnection;
	private sfxScale = 1;
	private volumeTween?: Tween;
	private readonly preloadProbes: Sound[] = [];
	/** Effects and engine sit 6 dB under any speaking voice. */
	private duck = 1;
	private stopDucking?: () => void;
	public constructor() {
		this.group.Name = "SkybreakSFX";
		this.group.Volume = 0.8;
		this.group.Parent = SoundService;
		const gui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
		if (gui) {
			const readVolume = () => {
				const value = gui.GetAttribute("SfxVolume");
				this.sfxScale = typeIs(value, "number") && value === value ? math.clamp(value, 0, 1) : 1;
				this.applyVolume(0);
			};
			readVolume();
			this.settingsConnection = gui.GetAttributeChangedSignal("SfxVolume").Connect(readVolume);
		}
		this.stopDucking = VoicePlayer.OnSpeaking((speaking) => {
			this.duck = duckGain(speaking);
			this.applyVolume(speaking ? 0.12 : 0.5);
		});
		const compressor = new Instance("CompressorSoundEffect");
		compressor.Threshold = -12; compressor.Ratio = 4; compressor.Attack = 0.01; compressor.Release = 0.15;
		compressor.Parent = this.group;
		this.world.Name = "SkybreakAudio";
		this.world.Parent = Workspace;
		this.stopExplosions = CombatEffects.OnExplosion((position, _, kind) => this.explosion(position, kind));
		// Preload in the background; moderation or a network delay must never block flight.
		task.spawn(() => {
			if (!this.alive) return;
			const probes = this.preloadProbes;
			const seen = new Set<string>();
			for (const [, entry] of pairs(SoundBank)) if (entry.assetId !== "" && !seen.has(entry.assetId)) {
				const probe = new Instance("Sound"); probe.SoundId = entry.assetId; probes.push(probe); seen.add(entry.assetId);
			}
			if (probes.size() === 0 || !this.alive) { for (const probe of probes) probe.Destroy(); return; }
			// Sound instances give the content loader the asset's type. Bare strings
			// can be requested as images and fail with an asset-type mismatch.
			pcall(() => ContentProvider.PreloadAsync(probes, (id, status) => {
				if (status === Enum.AssetFetchStatus.Failure && this.alive) warn(`SKYBREAK audio could not load ${id}; check experience permissions/moderation`);
			}));
			for (const probe of probes) probe.Destroy();
			probes.clear();
		});
	}
	private applyVolume(fade: number): void {
		if (!this.alive) return;
		this.volumeTween?.Cancel();
		this.volumeTween?.Destroy();
		this.volumeTween = undefined;
		const target = 0.8 * this.sfxScale * this.duck;
		if (fade <= 0) this.group.Volume = target;
		else {
			this.volumeTween = TweenService.Create(this.group, new TweenInfo(fade), { Volume: target });
			this.volumeTween.Play();
		}
	}
	private create(id: string, parent: Instance, volume: number, pitch = 1): Sound | undefined {
		const entry = SoundBank[id];
		if (!entry || entry.assetId === "" || !this.alive) return undefined;
		const sound = new Instance("Sound");
		sound.Name = `SFX_${id}`; sound.SoundId = entry.assetId;
		sound.Looped = entry.loop; sound.Volume = volume; sound.PlaybackSpeed = pitch;
		sound.PlaybackRegionsEnabled = true;
		sound.PlaybackRegion = new NumberRange(entry.start, entry.finish);
		sound.LoopRegion = new NumberRange(entry.start, entry.finish);
		sound.TimePosition = entry.start;
		sound.RollOffMode = Enum.RollOffMode.InverseTapered;
		sound.RollOffMinDistance = 65; sound.RollOffMaxDistance = 2200;
		sound.SoundGroup = this.group; sound.Parent = parent;
		sound.Play();
		if (this.paused && entry.loop) sound.Pause();
		return sound;
	}
	/** Bounded transient voices; world anchors survive missile/aircraft destruction. */
	private shot(id: string, volume: number, position?: Vector3, pitch = 1): void {
		if (!this.alive || !SoundBank[id] || SoundBank[id].assetId === "") return;
		for (let i = this.oneShots.size() - 1; i >= 0; i--) if (!this.oneShots[i].Parent) this.oneShots.remove(i);
		while (this.oneShots.size() >= AudioRules.MaxOneShots) {
			const old = this.oneShots.shift()!;
			if (old.Parent?.IsA("BasePart")) old.Parent.Destroy(); else old.Destroy();
		}
		let anchor: Part | undefined;
		if (position) {
			anchor = new Instance("Part"); anchor.Name = "AudioEmitter";
			anchor.Anchored = true; anchor.Transparency = 1; anchor.Size = Vector3.one;
			anchor.CanCollide = false; anchor.CanTouch = false; anchor.CanQuery = false;
			anchor.Position = position; anchor.Parent = this.world;
		}
		const sound = this.create(id, anchor ?? this.group, volume, pitch);
		if (!sound) { anchor?.Destroy(); return; }
		this.oneShots.push(sound);
		const owner = anchor ?? sound;
		sound.Ended.Once(() => owner.Destroy());
		Debris.AddItem(owner, SoundBank[id].seconds / math.max(0.5, pitch) + 4);
	}
	public Confirm(): void {
		const now = os.clock();
		if (now < this.nextUi) return;
		this.nextUi = now + 0.09;
		this.shot("uiConfirm", 0.24);
	}
	public Result(won: boolean): void { this.shot(won ? "missionSuccess" : "missionFailure", 0.5); }
	public SetPaused(paused: boolean): void {
		if (paused === this.paused) return;
		this.paused = paused;
		const loops: Sound[] = [];
		for (const sound of [this.cruise, this.burn, this.wind, this.warning]) if (sound) loops.push(sound);
		for (const [, entry] of this.motors) loops.push(entry.sound);
		for (const [, entry] of this.engines) loops.push(entry.sound);
		for (const sound of loops) { if (paused) sound.Pause(); else if (!this.dead) sound.Resume(); }
	}
	public Start(aircraft: Model): void {
		if (!this.alive) return;
		this.Stop();
		this.clearShots();
		this.nextLaunch = 0; this.nextHit = 0; this.nextFlare = 0;
		this.aircraft = aircraft; this.folder = aircraft.Parent; this.dead = false;
		this.cruise = this.create("engineCruise", this.group, 0);
		this.burn = this.create("engineBurn", this.group, 0);
		this.wind = this.create("wind", this.group, 0);
		if (this.folder) {
			for (const child of this.folder.GetChildren()) this.track(child, false);
			this.connections.push(this.folder.ChildAdded.Connect((child) => this.track(child, true)));
		}
	}
	private explosion(position: Vector3, kind: ExplosionKind): void {
		if (!this.alive || (!this.aircraft && os.clock() > this.tailUntil)) return;
		if (kind === "player") {
			const paused = this.paused;
			this.Stop();
			this.paused = paused;
			this.dead = true;
		}
		if (this.paused) return;
		if (kind === "hit") {
			if (os.clock() < this.nextHit) return;
			this.nextHit = os.clock() + 0.08;
		}
		const id = kind === "hit" ? (math.random() < 0.5 ? "hitMetalA" : "hitMetalB")
			: kind === "ground" || kind === "wreck" ? "groundExplosion"
			: kind === "ace" || kind === "player" ? "heavyExplosion" : "airExplosion";
		this.shot(id, kind === "hit" ? 0.5 : kind === "missile" ? 0.4 : 0.85, position, 0.96 + math.random() * 0.08);
	}
	private track(child: Instance, fresh: boolean): void {
		if (!this.alive || !this.aircraft || this.dead || this.paused) return;
		if (fresh && child.IsA("BasePart") && child.Name === "Countermeasure" && os.clock() >= this.nextFlare) {
			this.nextFlare = os.clock() + 0.2;
			this.shot("flareBurst", 0.4, child.Position);
			return;
		}
		if (!child.IsA("BasePart") || (child.Name !== PLAYER_MISSILE && child.Name !== HOSTILE_MISSILE) || this.motors.has(child)) return;
		if (fresh && os.clock() >= this.nextLaunch) {
			this.nextLaunch = os.clock() + 0.07; // A four-missile salvo stays punchy without four stacked blasts.
			this.shot(math.random() < 0.5 ? "missileLaunchA" : "missileLaunchB", 0.6, child.Position, 0.96 + math.random() * 0.08);
		}
		if (this.motors.size() >= AudioRules.MaxMotors) return;
		const sound = this.create("missileMotor", child, 0.22);
		if (sound) {
			sound.RollOffMinDistance = 25; sound.RollOffMaxDistance = 1000;
			this.motors.set(child, { sound, last: child.Position, passed: false });
		}
	}
	public Telemetry(t: Telemetry): void {
		if (!this.aircraft || this.dead || this.paused) return;
		this.observed = t;
		const changed = this.target !== t.target;
		if (changed) { this.locked = false; this.target = t.target; }
		// No lock tone on a contact the server will not damage now (grey box, TRACK): it is not a shot.
		const locked = t.lockProgress >= 0.99 && t.targetDamageable !== false;
		if (locked && !this.locked && t.target !== undefined) this.shot("lockAcquired", 0.3);
		this.locked = locked;
		if ((t.fireDeniedSerial ?? 0) > this.deniedSerial) {
			this.deniedSerial = t.fireDeniedSerial ?? 0;
			if (t.fireDenied !== "blind") this.shot("uiDenied", 0.28);
		}
		if (this.specialCharges !== undefined && (t.specialCharges ?? this.specialCharges) < this.specialCharges && t.special === "uav") this.shot("droneDeploy", 0.45);
		this.specialCharges = t.specialCharges;
		if (t.evadeCooldown > this.evadeCooldown + 1) this.shot("evadeWhoosh", 0.3);
		this.evadeCooldown = t.evadeCooldown;
	}
	/** 10 Hz warnings and enemy scans; positional missile sounds follow their Parts. */
	public Step(dt: number, throttle: number, speed: number, position: Vector3, boundary: boolean): void {
		if (!this.aircraft || this.dead || this.paused) return;
		const mix = AudioRules.EngineMix(throttle, speed, dt);
		// Keep the per-frame mix free of temporary arrays of sound/volume pairs.
		this.mixLoop(this.cruise, mix.cruise, mix.pitch, mix.alpha);
		this.mixLoop(this.burn, mix.burn, mix.pitch, mix.alpha);
		this.mixLoop(this.wind, mix.wind, mix.pitch, mix.alpha);
		this.scanTime += dt;
		if (this.scanTime < 0.1) return;
		this.scanTime = 0;
		const t = this.observed;
		const warning = t && AudioRules.Warning(t.incoming, t.health, boundary, t.lockProgress, t.target !== undefined && t.targetDamageable !== false);
		if (warning !== this.warningKind) {
			this.warning?.Destroy(); this.warning = undefined; this.warningKind = warning;
			if (warning) this.warning = this.create(warning, this.group, warning === "lockSearch" ? 0.14 : 0.3);
		}
		for (const [part, entry] of this.motors) {
			if (part.Parent !== this.folder) { entry.sound.Destroy(); this.motors.delete(part); continue; }
			const delta = part.Position.sub(entry.last);
			const square = delta.Dot(delta);
			const closest = entry.last.add(delta.mul(square > 0 ? math.clamp(position.sub(entry.last).Dot(delta) / square, 0, 1) : 0));
			if (!entry.passed && closest.sub(position).Magnitude < 110 && part.Name === HOSTILE_MISSILE) {
				entry.passed = true; this.shot("missileFlyby", 0.45, closest);
			}
			entry.last = part.Position;
		}
		for (const [model, entry] of this.engines) {
			if (!entry.root.Parent || model.PrimaryPart !== entry.root || model.Parent !== this.folder || model.GetAttribute("SkybreakEnemy") !== true || entry.root.Position.sub(position).Magnitude > 2400) {
				entry.sound.Destroy(); this.engines.delete(model);
			}
		}
		// Reconcile missiles skipped during pause or while the voice budget was full.
		// One folder pass serves both budgets; a full engine budget must not stop missile tracking.
		if (this.folder && (this.motors.size() < AudioRules.MaxMotors || this.engines.size() < AudioRules.MaxEngines)) for (const child of this.folder.GetChildren()) {
			if (this.motors.size() < AudioRules.MaxMotors) this.track(child, false);
			if (this.engines.size() >= AudioRules.MaxEngines) continue;
			if (!child.IsA("Model") || child === this.aircraft || this.engines.has(child) || child.GetAttribute("SkybreakEnemy") !== true || child.GetAttribute("TargetKind") !== "air") continue;
			const root = child.PrimaryPart;
			if (!root || root.Position.sub(position).Magnitude > 2200) continue;
			const sound = this.create("enemyEngine", root, 0.24, 0.95 + math.random() * 0.1);
			if (sound) this.engines.set(child, { model: child, root, sound });
		}
	}
	private mixLoop(sound: Sound | undefined, volume: number, pitch: number, alpha: number): void {
		if (!sound) return;
		sound.Volume += (volume - sound.Volume) * alpha;
		sound.PlaybackSpeed += (pitch - sound.PlaybackSpeed) * alpha;
	}
	public Stop(): void {
		if (this.aircraft) this.tailUntil = os.clock() + 4;
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, entry] of this.motors) entry.sound.Destroy();
		for (const [, entry] of this.engines) entry.sound.Destroy();
		this.motors.clear(); this.engines.clear();
		for (const sound of [this.cruise, this.burn, this.wind, this.warning]) sound?.Destroy();
		this.cruise = undefined; this.burn = undefined; this.wind = undefined; this.warning = undefined;
		this.warningKind = undefined; this.observed = undefined; this.target = undefined; this.locked = false;
		this.specialCharges = undefined; this.evadeCooldown = 0; this.deniedSerial = 0;
		this.folder = undefined; this.aircraft = undefined; this.scanTime = 0;
		this.paused = false;
	}
	private clearShots(): void {
		for (const shot of this.oneShots) { if (shot.Parent?.IsA("BasePart")) shot.Parent.Destroy(); else shot.Destroy(); }
		this.oneShots.clear();
	}
	public Destroy(): void {
		if (!this.alive) return;
		this.alive = false;
		this.volumeTween?.Cancel(); this.volumeTween?.Destroy(); this.volumeTween = undefined;
		for (const probe of this.preloadProbes) probe.Destroy();
		this.preloadProbes.clear();
		this.Stop(); this.clearShots(); this.stopExplosions?.(); this.stopDucking?.(); this.settingsConnection?.Disconnect(); this.world.Destroy(); this.group.Destroy();
	}
}
