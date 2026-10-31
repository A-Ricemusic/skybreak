import { ReplicatedStorage, TweenService } from "@rbxts/services";

/**
 * Imperative pieces of the loading screen that React must not own: the jet
 * ViewportFrame with its camera sweep, the HUD scan line and the fade drivers.
 * Every motion is a TweenService tween (no per-frame Lua); Destroy() cancels and
 * removes everything the rig made.
 */

/** The server's approved Kestrel (v2 preferred) built for the cinematics; already replicated, never uploaded here. */
export const JET_TEMPLATE_FOLDER = "RelayStoryModels";
export const JET_TEMPLATE_NAME = "CinematicKestrel";

export function findJetTemplate(root: Instance = ReplicatedStorage): Model | undefined {
	const jet = root.FindFirstChild(JET_TEMPLATE_FOLDER)?.FindFirstChild(JET_TEMPLATE_NAME);
	return jet?.IsA("Model") ? jet : undefined;
}

/** Calls `found` once the template exists (now or when it replicates); returns a disconnect. */
export function whenJetTemplate(found: (template: Model) => void, root: Instance = ReplicatedStorage): () => void {
	const now = findJetTemplate(root);
	if (now) { found(now); return () => undefined; }
	let connection: RBXScriptConnection | undefined;
	let listening: Instance | undefined;
	const listen = (target: Instance) => {
		connection?.Disconnect();
		listening = target;
		connection = target.ChildAdded.Connect(() => {
			const template = findJetTemplate(root);
			if (template) {
				connection?.Disconnect(); connection = undefined;
				found(template);
				return;
			}
			// The folder may arrive after we started listening on the root.
			const folder = root.FindFirstChild(JET_TEMPLATE_FOLDER);
			if (folder && listening !== folder) listen(folder);
		});
	};
	listen(root.FindFirstChild(JET_TEMPLATE_FOLDER) ?? root);
	return () => { connection?.Disconnect(); connection = undefined; };
}

/** Camera poses for the slow sweep, looking at the jet's bounds centre (nose along -Z). */
export function jetCameraPoses(radius: number, fieldOfView: number): [CFrame, CFrame] {
	const distance = (radius / math.tan(math.rad(fieldOfView) / 2)) * 1.08;
	const pose = (yaw: number, pitch: number, roll: number) => {
		const position = new Vector3(math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)).mul(distance);
		return CFrame.lookAt(position, Vector3.zero).mul(CFrame.Angles(0, 0, roll));
	};
	// Front-quarter from the right, drifting toward the beam with a gentle bank.
	return [pose(0.85, 0.2, 0.06), pose(1.45, 0.06, -0.1)];
}

export interface JetRig {
	readonly viewport: ViewportFrame;
	/** The cloned jet, when a template was available. */
	readonly model?: Model;
	/** 0 hidden .. 1 fully shown. */
	SetAlpha(alpha: number): void;
	Destroy(): void;
}

const COSMETIC = ["Trail", "ParticleEmitter", "Light", "Sound", "LuaSourceContainer", "Beam", "Fire", "Smoke", "Sparkles"] as const;

/** Builds the viewport inside `holder` (React-owned, positioned by the layout). */
export function createJetRig(holder: GuiObject, template: Model | undefined, motion: boolean): JetRig {
	const tweens: Tween[] = [];
	const viewport = new Instance("ViewportFrame");
	viewport.Name = "JetViewport";
	viewport.BackgroundTransparency = 1;
	viewport.BorderSizePixel = 0;
	viewport.Size = UDim2.fromScale(1, 1);
	viewport.Ambient = Color3.fromRGB(78, 92, 112);
	viewport.LightColor = Color3.fromRGB(255, 238, 214);
	viewport.LightDirection = new Vector3(-0.6, -1, 0.45);
	viewport.ImageTransparency = 1;
	viewport.ZIndex = 2;
	const camera = new Instance("Camera");
	camera.FieldOfView = 26;
	camera.Parent = viewport;
	viewport.CurrentCamera = camera;

	let model: Model | undefined;
	if (template) {
		const [ok] = pcall(() => {
			const clone = template.Clone();
			for (const item of clone.GetDescendants()) {
				if (COSMETIC.some((kind) => item.IsA(kind))) item.Destroy();
			}
			// Centre the bounds on the origin, keeping the authored nose-forward (-Z) orientation.
			const [box, size] = clone.GetBoundingBox();
			clone.PivotTo(new CFrame(box.Position.mul(-1)).mul(clone.GetPivot()));
			const [a, b] = jetCameraPoses(size.Magnitude / 2, camera.FieldOfView);
			camera.CFrame = a;
			clone.Parent = viewport;
			model = clone;
			if (motion) {
				const sweep = TweenService.Create(camera, new TweenInfo(11, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { CFrame: b });
				tweens.push(sweep);
			}
		});
		if (!ok) model = undefined;
	}
	// A slow bob of the whole viewport reads as flight without moving the camera every frame twice.
	viewport.Position = UDim2.fromScale(0, 0.015);
	if (motion) tweens.push(TweenService.Create(viewport, new TweenInfo(3.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Position: UDim2.fromScale(0, -0.015) }));
	viewport.Parent = holder;

	// HUD scan line sweeping the frame top to bottom.
	const scan = new Instance("Frame");
	scan.Name = "ScanLine";
	scan.BorderSizePixel = 0;
	scan.BackgroundColor3 = Color3.fromRGB(64, 224, 206);
	scan.BackgroundTransparency = 1;
	scan.Size = new UDim2(1, 0, 0, 1);
	scan.Position = UDim2.fromScale(0, 0);
	scan.ZIndex = 3;
	scan.Parent = holder;
	if (motion) tweens.push(TweenService.Create(scan, new TweenInfo(4.5, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1, false, 0.8), { Position: UDim2.fromScale(0, 1) }));
	for (const tween of tweens) tween.Play();

	let destroyed = false;
	return {
		viewport,
		model,
		SetAlpha(alpha: number) {
			if (destroyed) return;
			const a = math.clamp(alpha, 0, 1);
			viewport.ImageTransparency = 1 - a;
			scan.BackgroundTransparency = 1 - a * 0.22;
		},
		Destroy() {
			if (destroyed) return;
			destroyed = true;
			for (const tween of tweens) { tween.Cancel(); tween.Destroy(); }
			tweens.clear();
			scan.Destroy();
			viewport.Destroy();
		},
	};
}

/**
 * Drives a 0..1 value with TweenService (a NumberValue), reporting it through
 * `changed`. To() returns immediately; `done` runs once if the tween completes
 * uninterrupted.
 */
export class Fader {
	private readonly value = new Instance("NumberValue");
	private tween?: Tween;
	private readonly connection: RBXScriptConnection;
	public constructor(initial: number, changed: (value: number) => void) {
		this.value.Value = initial;
		this.connection = this.value.Changed.Connect((value) => changed(value));
		changed(initial);
	}
	public Get(): number { return this.value.Value; }
	public Set(value: number): void {
		this.Stop();
		this.value.Value = value;
	}
	public To(target: number, seconds: number, done?: () => void): void {
		this.Stop();
		if (seconds <= 0 || this.value.Value === target) {
			this.value.Value = target;
			done?.();
			return;
		}
		const tween = TweenService.Create(this.value, new TweenInfo(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Value: target });
		this.tween = tween;
		tween.Completed.Once((state) => {
			if (this.tween !== tween) return;
			this.tween = undefined;
			tween.Destroy();
			if (state === Enum.PlaybackState.Completed) done?.();
		});
		tween.Play();
	}
	public Stop(): void {
		const tween = this.tween;
		this.tween = undefined;
		if (tween) { tween.Cancel(); tween.Destroy(); }
	}
	public Destroy(): void {
		this.Stop();
		this.connection.Disconnect();
		this.value.Destroy();
	}
}
