import { ContextActionService, GuiService, Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { FlightPrediction, Predictor } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { FlightInputPacket, HudState, MissionStarted, Remotes, Telemetry } from "../shared/Types";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { WeaponRules } from "../shared/WeaponRules";
import { EngineFx } from "../shared/EngineFx";
import { EngineRig, JetFactory } from "../shared/JetFactory";
import { CameraShake } from "./CameraShake";
import { EnemySmoothing } from "./EnemySmoothing";
import { MissileTrails } from "./MissileTrails";

let activeController: FlightController | undefined;
let controllerSerial = 0;
const DEFAULTS: Telemetry = {
	kind: "Telemetry", health: 100, speed: 0, altitude: 250, kills: 0, total: 3, missiles: 8,
	missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false,
	elapsed: 0, targetDistance: 0, boundaryWarning: false,
	special: SpecialWeapons.Default, specialCharges: 0, specialCooldown: 0, specialActive: 0,
	missionId: 1, phase: "tutorial_move", objective: "Learn the flight controls", objectiveProgress: 0,
	objectiveTotal: 1, timeRemaining: 600, tutorialStep: "move", groundKills: 0, targetKind: "air", targetRequired: false,
};
const FLIGHT_KEYS: Enum.KeyCode[] = [
	Enum.KeyCode.W, Enum.KeyCode.S, Enum.KeyCode.A, Enum.KeyCode.D,
	Enum.KeyCode.Up, Enum.KeyCode.Down, Enum.KeyCode.Left, Enum.KeyCode.Right,
	Enum.KeyCode.Q, Enum.KeyCode.E, Enum.KeyCode.LeftShift, Enum.KeyCode.ButtonL1, Enum.KeyCode.ButtonR1,
	Enum.KeyCode.Space, Enum.KeyCode.F, Enum.KeyCode.Tab, Enum.KeyCode.R, Enum.KeyCode.C,
	Enum.KeyCode.ButtonR2, Enum.KeyCode.ButtonB, Enum.KeyCode.ButtonY, Enum.KeyCode.ButtonX, Enum.KeyCode.Thumbstick1, Enum.KeyCode.Thumbstick2,
];
/** Drone-marked contacts: one glyph per hostile, dimmer than the selected target's cue. */
const COLOR_MARKED = Color3.fromRGB(255, 193, 98);
const MARKER_LIMIT = 16;
// Per-frame constants (no Vector3/Color3 construction inside the render loop).
const CAMERA_LIFT = new Vector3(0, 20, 0);
const AIM_LIFT = new Vector3(0, 4, 0);
const COLOR_LOCKED = Color3.fromRGB(255, 193, 98);
const COLOR_REQUIRED = Color3.fromRGB(103, 235, 248);
const COLOR_OPTIONAL = Color3.fromRGB(177, 190, 196);
/** Input goes out at most this often while the stick moves, and as a keepalive otherwise. */
const INPUT_INTERVAL = 1 / 20;
const INPUT_KEEPALIVE = 0.1;
function remote<K extends keyof Remotes>(remotes: Remotes | Instance, name: K): Remotes[K] {
	if (typeIs(remotes, "Instance")) return remotes.WaitForChild(name) as Remotes[K];
	assert(remotes[name], `Missing flight remote: ${name}`);
	return remotes[name];
}
function isModel(value: unknown): value is Model {
	return typeIs(value, "Instance") && value.IsA("Model") && value.Parent !== undefined;
}
/** Same transform the server applies: yaw about world Y, then pitch and roll (YXZ). */
function frameFor(state: FlightState): CFrame {
	return new CFrame(state.x, state.y, state.z).mul(CFrame.fromEulerAnglesYXZ(state.pitch, state.yaw, state.roll));
}
function stateFrom(frame: CFrame): FlightState {
	const [pitch, yaw, roll] = frame.ToEulerAnglesYXZ();
	const state = FlightMath.NewState();
	state.x = frame.X; state.y = frame.Y; state.z = frame.Z;
	state.yaw = yaw; state.pitch = pitch; state.roll = roll;
	return state;
}
function createTargetCue(playerGui: Instance): [ScreenGui, Frame, UIStroke, TextLabel, TextLabel] {
	const gui = new Instance("ScreenGui");
	gui.Name = "SkybreakFlightTargeting";
	gui.IgnoreGuiInset = true;
	gui.ResetOnSpawn = false;
	gui.DisplayOrder = 8;
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
	gui.Parent = playerGui;
	const bracket = new Instance("Frame");
	bracket.Name = "TargetBracket";
	bracket.AnchorPoint = new Vector2(0.5, 0.5);
	bracket.Size = UDim2.fromOffset(60, 60);
	bracket.BackgroundTransparency = 1;
	bracket.Visible = false;
	bracket.Parent = gui;
	const stroke = new Instance("UIStroke");
	stroke.Thickness = 1.5;
	stroke.Color = Color3.fromRGB(102, 237, 250);
	stroke.Parent = bracket;
	const corners = new Instance("UICorner");
	corners.CornerRadius = new UDim(0, 7);
	corners.Parent = bracket;
	const caption = new Instance("TextLabel");
	caption.Name = "TargetCaption";
	caption.BackgroundTransparency = 1;
	caption.Position = new UDim2(0.5, 0, 1, 4);
	caption.AnchorPoint = new Vector2(0.5, 0);
	// One short line under the bracket: "LOCK 60%" / "LOCKED · 820m".
	caption.Size = UDim2.fromOffset(120, 13);
	caption.Font = Enum.Font.GothamBold;
	caption.TextSize = 10;
	caption.TextStrokeColor3 = Color3.fromRGB(6, 13, 22);
	caption.TextStrokeTransparency = 0.45;
	caption.TextColor3 = stroke.Color;
	caption.Parent = bracket;
	const arrow = new Instance("TextLabel");
	arrow.Name = "OffscreenDirection";
	arrow.AnchorPoint = new Vector2(0.5, 0.5);
	arrow.Size = UDim2.fromOffset(50, 50);
	arrow.BackgroundTransparency = 1;
	arrow.Font = Enum.Font.GothamBold;
	arrow.Text = "▲";
	arrow.TextSize = 30;
	arrow.TextColor3 = stroke.Color;
	arrow.TextStrokeTransparency = 0.25;
	arrow.Visible = false;
	arrow.Parent = gui;
	return [gui, bracket, stroke, caption, arrow];
}
interface PreviousCamera {
	type: Enum.CameraType; subject?: BasePart | Humanoid; frame: CFrame; fov: number;
}
export type TelemetryListener = (telemetry: Telemetry) => void;
// QA and phone UI use this same controller; all combat decisions stay on server.
// The player's own jet is predicted locally (FlightPrediction) and reconciled
// against the server's 20 Hz FlightState stream; everything else is server state.
export class FlightController {
	public active = false;
	public aircraft?: Model;
	private readonly remotes: Pick<Remotes, "FlightInput" | "CombatAction" | "MissionState" | "FlightState" | "Telemetry">;
	private telemetry: Telemetry = { ...DEFAULTS };
	private telemetrySequence = -1;
	private readonly listeners = new Set<TelemetryListener>();
	private touchInput = Vector2.zero;
	private gamepadInput = Vector2.zero;
	private throttle = 0.65;
	private throttleStick = 0;
	private touchThrottleAxis = 0;
	private keys = new Set<Enum.KeyCode>();
	private connections: RBXScriptConnection[] = [];
	private hiddenParts = new Map<BasePart | Trail | ParticleEmitter | Light, number | boolean>();
	private readonly missiles = new MissileTrails();
	private engine?: EngineRig;
	private engineSpool = 0;
	private readonly actionName: string;
	private readonly renderName: string;
	private readonly streamConnections: RBXScriptConnection[] = [];
	private mouseSteer = false;
	private visualFrame = new CFrame();
	private cameraFrame = new CFrame();
	/** Hit-stop FOV punch included in the camera's current FieldOfView. */
	private fovKick = 0;
	private visual?: Model;
	private visualRoot?: BasePart;
	private previousCamera?: PreviousCamera;
	private targetGui?: ScreenGui;
	private bracket?: Frame;
	private bracketStroke?: UIStroke;
	private caption?: TextLabel;
	private arrow?: TextLabel;
	/** Pooled glyphs for every hostile while the recon drone is up. */
	private markers: TextLabel[] = [];
	private sendTime = 0;
	private sentX = 0;
	private sentY = 0;
	private sentThrottle = -1;
	/** Reused input table handed to FlightPrediction.Step every frame. */
	private readonly frameInput = { x: 0, y: 0, throttle: 0.65 };
	private predictor?: Predictor;
	/** Seconds left of the (locally predicted) evade barrel roll. */
	private evadeRoll = 0;
	/** os.clock() when the current/last roll began (local prediction or joined server roll). */
	private evadeStartedAt = -math.huge;
	// Last values written to the target cue, so text/colour only change when they differ.
	private cueColor?: Color3;
	private cueRange = -1;
	private cueLock = -1;
	private cueMarker = "";
	private cueHealth = -1;
	private arrowText = "";
	private readonly enemies = new EnemySmoothing();
	public static GetActive(): FlightController | undefined { return activeController; }
	public constructor(remotes: Remotes | Instance) {
		controllerSerial += 1;
		this.remotes = {
			FlightInput: remote(remotes, "FlightInput"), CombatAction: remote(remotes, "CombatAction"), MissionState: remote(remotes, "MissionState"),
			FlightState: remote(remotes, "FlightState"), Telemetry: remote(remotes, "Telemetry"),
		};
		this.actionName = `SkybreakFlight_${controllerSerial}`;
		this.renderName = `SkybreakCamera_${controllerSerial}`;
		this.streamConnections.push(this.remotes.MissionState.OnClientEvent.Connect((data: unknown) => {
			if (!typeIs(data, "table")) return;
			const message = data as Partial<HudState> & { kind?: string };
			if (message.kind === "HudState") { if (this.active) this.applyHud(message); }
			else if (message.kind === "Completed" || message.kind === "Failed") this.Stop();
		}));
		this.streamConnections.push(this.remotes.Telemetry.OnClientEvent.Connect((packet: unknown) => {
			if (!this.active) return;
			// Decode into a scratch-free path: validate the sequence before touching state.
			if (!typeIs(packet, "table") || !FlightMath.IsFinite((packet as unknown[])[0]) || (packet as number[])[0] <= this.telemetrySequence) return;
			const sequence = TelemetryCodec.Decode(packet, this.telemetry);
			if (sequence === undefined) return;
			this.telemetrySequence = sequence;
			this.notify();
		}));
		this.streamConnections.push(this.remotes.FlightState.OnClientEvent.Connect((packet: unknown) => {
			const predictor = this.predictor;
			if (!this.active || !predictor) return;
			const decoded = FlightPrediction.Decode(packet);
			if (!decoded) return;
			const now = os.clock();
			FlightPrediction.ObserveRoundTrip(predictor, now, decoded.echoedClientTime, decoded.hold);
			// The packet names the exact predicted time it corresponds to: echoed stamp + hold.
			const matchTime = decoded.echoedClientTime > 0 ? decoded.echoedClientTime + decoded.hold : undefined;
			if (FlightPrediction.Reconcile(predictor, decoded.state, now, decoded.sequence, matchTime) === "none") return;
			// Join a server-side roll only when none was predicted locally. A locally
			// predicted roll's server echo keeps arriving for up to a round trip after the
			// local one ends; ignore it until then so the roll never replays.
			const rtt = predictor.rtt ?? FlightPrediction.DefaultRtt;
			if (decoded.evadeRemaining > 0.2 && this.evadeRoll <= 0 && now > this.evadeStartedAt + FlightPrediction.EvadeRollSeconds + rtt + 0.25) {
				this.evadeRoll = math.max(0, decoded.evadeRemaining - rtt / 2);
				this.evadeStartedAt = now - (FlightPrediction.EvadeRollSeconds - this.evadeRoll);
			}
		}));
		activeController = this;
	}
	/** Subscribe to merged telemetry (10 Hz numbers + HUD text changes). Returns an unsubscribe function. */
	public OnTelemetry(listener: TelemetryListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private notify(): void {
		this.telemetry.boundaryWarning = this.GetBoundaryWarning();
		for (const listener of this.listeners) {
			const [ok, message] = pcall(listener, this.telemetry);
			if (!ok) warn(`SKYBREAK telemetry listener: ${tostring(message)}`);
		}
	}
	private applyHud(message: Partial<HudState>): void {
		const t = this.telemetry;
		if (MissionCatalog.IsValidId(message.missionId)) t.missionId = message.missionId;
		if (typeIs(message.phase, "string")) t.phase = message.phase;
		if (typeIs(message.objective, "string")) t.objective = message.objective;
		if (typeIs(message.tutorialStep, "string")) t.tutorialStep = message.tutorialStep;
		t.targetName = typeIs(message.targetName, "string") ? message.targetName : "";
		if (typeIs(message.targetKind, "string")) t.targetKind = message.targetKind;
		t.targetRequired = message.targetRequired === true;
		t.target = isModel(message.target) ? message.target : undefined;
		t.navigation = typeIs(message.navigation, "Vector3") ? message.navigation : undefined;
		t.navigationRadius = typeIs(message.navigationRadius, "number") ? message.navigationRadius : undefined;
		t.navigationCeiling = typeIs(message.navigationCeiling, "number") ? message.navigationCeiling : undefined;
		if (typeIs(message.radio, "string")) t.radio = message.radio;
		if (typeIs(message.radioSerial, "number")) t.radioSerial = message.radioSerial;
		t.radioSeconds = typeIs(message.radioSeconds, "number") ? message.radioSeconds : undefined;
		t.fireDenied = WeaponRules.IsFireNotice(message.fireDenied) ? message.fireDenied : undefined;
		if (typeIs(message.fireDeniedSerial, "number")) t.fireDeniedSerial = message.fireDeniedSerial;
		if (SpecialWeapons.IsKind(message.special)) t.special = message.special;
		this.notify();
	}
	private handleBoundInput(state: Enum.UserInputState, keyCode: Enum.KeyCode, position: Vector3): Enum.ContextActionResult {
		if (!this.active) return Enum.ContextActionResult.Pass;
		if (UserInputService.GetFocusedTextBox() && state !== Enum.UserInputState.End && state !== Enum.UserInputState.Cancel) return Enum.ContextActionResult.Pass;
		if (keyCode === Enum.KeyCode.Thumbstick2) {
			this.throttleStick = state === Enum.UserInputState.End || state === Enum.UserInputState.Cancel ? 0 : position.Y;
		} else if (keyCode === Enum.KeyCode.Thumbstick1) {
			const value = new Vector2(position.X, position.Y);
			this.gamepadInput = state !== Enum.UserInputState.End && state !== Enum.UserInputState.Cancel && value.Magnitude >= 0.12 ? value : Vector2.zero;
		} else {
			if (state === Enum.UserInputState.Begin || state === Enum.UserInputState.Change) this.keys.add(keyCode);
			else this.keys.delete(keyCode);
			if (state === Enum.UserInputState.Begin) {
				if (keyCode === Enum.KeyCode.Space || keyCode === Enum.KeyCode.ButtonR2) this.FireMissile();
				if (keyCode === Enum.KeyCode.F || keyCode === Enum.KeyCode.ButtonB) this.Evade();
				if (keyCode === Enum.KeyCode.Tab || keyCode === Enum.KeyCode.R || keyCode === Enum.KeyCode.ButtonY) this.CycleTarget();
				if (keyCode === Enum.KeyCode.C || keyCode === Enum.KeyCode.ButtonX) this.Special();
			}
		}
		return Enum.ContextActionResult.Sink;
	}
	/** Studio QA uses the same handler as ContextActionService, below engine/device routing. */
	public SimulateGamepadInput(keyCode: Enum.KeyCode, state: Enum.UserInputState, position = Vector3.zero): Enum.ContextActionResult {
		assert(RunService.IsStudio(), "Controller simulation is Studio-only");
		assert(FLIGHT_KEYS.includes(keyCode) && (keyCode.Name.sub(1, 6) === "Button" || keyCode === Enum.KeyCode.Thumbstick1 || keyCode === Enum.KeyCode.Thumbstick2), "Unsupported bound gamepad control");
		assert(FlightMath.IsFinite(position.X) && FlightMath.IsFinite(position.Y) && FlightMath.IsFinite(position.Z), "Input must be finite");
		return this.handleBoundInput(state, keyCode, new Vector3(math.clamp(position.X, -1, 1), math.clamp(position.Y, -1, 1), math.clamp(position.Z, -1, 1)));
	}
	public GetControlStateForStudio() {
		assert(RunService.IsStudio(), "Controller diagnostics are Studio-only");
		return { throttle: this.throttle, touchThrottleAxis: this.touchThrottleAxis, touchStick: this.touchInput, stick: this.gamepadInput, prediction: this.predictor?.last, rtt: this.predictor?.rtt };
	}
	public SetInput(x: number, y: number): void { this.touchInput = new Vector2(FlightMath.ClampInput(x), FlightMath.ClampInput(y)); }
	public SetTouchThrottleAxis(value: number): void { this.touchThrottleAxis = FlightMath.ClampInput(value); }
	public SetThrottle(value: number): void { if (FlightMath.IsFinite(value)) this.throttle = math.clamp(value, 0, 1); }
	private action(action: string): void { if (this.active) this.remotes.CombatAction.FireServer({ action }); }
	public FireMissile(): void { this.action("FireMissile"); }
	public Evade(): void {
		if (!this.active) return;
		// Predict the barrel roll when the HUD says evade is ready; the server confirms or ignores.
		if (this.telemetry.evadeCooldown <= 0 && this.evadeRoll <= 0) { this.evadeRoll = FlightPrediction.EvadeRollSeconds; this.evadeStartedAt = os.clock(); }
		this.action("Evade");
	}
	public CycleTarget(): void { this.action("CycleTarget"); }
	/** Second weapon slot; the server validates charges, cooldown and targets. */
	public Special(): void { this.action("Special"); }
	/** Predicted (rendered) position of the player's jet, or undefined outside a mission. */
	public GetPosition(): Vector3 | undefined {
		return this.active && this.predictor ? this.visualFrame.Position : undefined;
	}
	/** Same limits the server clamps against, warned a little early so the pilot can turn or level off in time. */
	public GetBoundaryWarning(): boolean {
		const state = this.predictor?.state;
		if (!this.active || !state) return false;
		return math.max(math.abs(state.x), math.abs(state.z)) > FlightMath.SoftBoundary - 100
			|| state.y > FlightMath.MaxAltitude - 70;
	}
	public GetThrottle(): number { return this.throttle; }
	public GetTelemetry(): Telemetry {
		const result = { ...this.telemetry };
		const position = this.GetPosition();
		if (position) {
			result.boundaryWarning = this.GetBoundaryWarning();
			if (isModel(result.target)) result.targetDistance = this.enemies.GetFrame(result.target).Position.sub(position).Magnitude;
			else { result.target = undefined; result.targetDistance = 0; }
		}
		return result;
	}
	/** Writes this frame's stick and throttle into `frameInput` (no allocation). */
	private input(dt: number): void {
		let x = this.touchInput.X + this.gamepadInput.X;
		let y = this.touchInput.Y + this.gamepadInput.Y;
		if (!UserInputService.GetFocusedTextBox()) {
			this.throttle = FlightMath.AdjustThrottle(this.throttle, math.clamp(this.throttleStick + this.touchThrottleAxis, -1, 1), dt);
			if (this.keys.has(Enum.KeyCode.A) || this.keys.has(Enum.KeyCode.Left)) x -= 1;
			if (this.keys.has(Enum.KeyCode.D) || this.keys.has(Enum.KeyCode.Right)) x += 1;
			if (this.keys.has(Enum.KeyCode.W) || this.keys.has(Enum.KeyCode.Up)) y += 1;
			if (this.keys.has(Enum.KeyCode.S) || this.keys.has(Enum.KeyCode.Down)) y -= 1;
			if (this.keys.has(Enum.KeyCode.Q) || this.keys.has(Enum.KeyCode.ButtonL1)) this.SetThrottle(this.throttle - dt * 0.4);
			if (this.keys.has(Enum.KeyCode.E) || this.keys.has(Enum.KeyCode.ButtonR1)) this.SetThrottle(this.throttle + dt * 0.4);
			if (this.mouseSteer) {
				const camera = Workspace.CurrentCamera;
				if (camera) {
					const [inset] = GuiService.GetGuiInset();
					const cursor = UserInputService.GetMouseLocation().sub(inset);
					const size = camera.ViewportSize;
					x += (cursor.X - size.X / 2) / math.max(size.X * 0.27, 1);
					y += (size.Y / 2 - cursor.Y) / math.max(size.Y * 0.27, 1);
				}
			}
		}
		this.frameInput.x = math.clamp(x, -1, 1);
		this.frameInput.y = math.clamp(y, -1, 1);
		this.frameInput.throttle = this.keys.has(Enum.KeyCode.LeftShift) ? 1 : this.throttle;
	}
	private updateTargetCue(camera: Camera): void {
		const target = this.telemetry.target;
		const bracket = this.bracket!;
		const arrow = this.arrow!;
		if (target === undefined || target.Parent === undefined) { bracket.Visible = false; arrow.Visible = false; return; }
		// Track the smoothed clone the player actually sees, not the hidden replicated model.
		const worldPosition = this.enemies.GetFrame(target).Position;
		const [screen, visible] = camera.WorldToViewportPoint(worldPosition);
		const size = camera.ViewportSize;
		const safeX = math.min(90, size.X * 0.16);
		const safeY = math.min(150, size.Y * 0.24);
		const inside = visible && screen.X >= safeX && screen.X <= size.X - safeX && screen.Y >= safeY && screen.Y <= size.Y - safeY;
		bracket.Visible = inside;
		arrow.Visible = !inside;
		const locked = this.telemetry.lockProgress >= 0.99;
		const required = this.telemetry.targetRequired === true;
		const ground = this.telemetry.targetKind === "ground";
		const color = locked ? COLOR_LOCKED : required ? COLOR_REQUIRED : COLOR_OPTIONAL;
		if (color !== this.cueColor) {
			this.cueColor = color;
			this.bracketStroke!.Color = color;
			this.caption!.TextColor3 = color;
			arrow.TextColor3 = color;
		}
		if (inside) {
			bracket.Position = UDim2.fromOffset(screen.X, screen.Y);
			const distance = math.floor(worldPosition.sub(this.visualFrame.Position).Magnitude);
			// -1 = locked; otherwise whole lock percent (0 = not locking).
			const lock = locked ? -1 : this.telemetry.lockProgress > 0.01 ? math.floor(this.telemetry.lockProgress * 100) : 0;
			// Damaged targets (staged aces above all) show remaining health after the lock state.
			const health = this.telemetry.targetHealth;
			const healthPercent = health !== undefined && health < 0.995 ? math.floor(health * 100 + 0.5) : -1;
			const marker = required ? "TGT · " : "";
			// Rebuild the caption only when a visible value changed (not every frame).
			if (distance !== this.cueRange || lock !== this.cueLock || marker !== this.cueMarker || healthPercent !== this.cueHealth) {
				this.cueRange = distance; this.cueLock = lock; this.cueMarker = marker; this.cueHealth = healthPercent;
				const healthText = healthPercent >= 0 ? ` · ${healthPercent}%` : "";
				this.caption!.Text = (lock < 0 ? `LOCKED · ${distance}m` : lock > 0 ? `LOCK ${lock}%` : `${marker}${distance}m`) + healthText;
				const width = locked ? 52 : 64;
				bracket.Size = UDim2.fromOffset(width, width);
			}
		} else {
			const localPosition = camera.CFrame.PointToObjectSpace(worldPosition);
			let dx = localPosition.X, dy = -localPosition.Y;
			if (dx * dx + dy * dy < 0.0001) { dx = localPosition.Z > 0 ? 1 : 0; dy = localPosition.Z > 0 ? 0 : -1; }
			const length = math.sqrt(dx * dx + dy * dy);
			dx /= length; dy /= length;
			const halfX = math.max(1, size.X / 2 - safeX);
			const halfY = math.max(1, size.Y / 2 - safeY);
			const extent = 1 / math.max(math.abs(dx) / halfX, math.abs(dy) / halfY);
			arrow.Position = UDim2.fromOffset(size.X / 2 + dx * extent, size.Y / 2 + dy * extent);
			arrow.Rotation = math.deg(math.atan2(dy, dx)) + 90;
			const text = ground ? (required ? "◆" : "◇") : required ? "▲" : "△";
			if (text !== this.arrowText) { this.arrowText = text; arrow.Text = text; }
		}
	}
	/** While the recon drone is up, every live hostile gets a glyph (on screen) or an edge arrow (off screen). */
	private updateMarkers(camera: Camera): void {
		const folder = this.aircraft?.Parent;
		const gui = this.targetGui;
		let used = 0;
		if (folder && gui && this.telemetry.special === "uav" && (this.telemetry.specialActive ?? 0) > 0) {
			const size = camera.ViewportSize;
			const safeX = math.min(90, size.X * 0.16);
			const safeY = math.min(150, size.Y * 0.24);
			const halfX = math.max(1, size.X / 2 - safeX);
			const halfY = math.max(1, size.Y / 2 - safeY);
			for (const child of folder.GetChildren()) {
				if (used >= MARKER_LIMIT) break;
				if (!child.IsA("Model") || child === this.telemetry.target || child.GetAttribute("SkybreakEnemy") !== true) continue;
				const ground = child.GetAttribute("TargetKind") === "ground";
				const worldPosition = ground ? child.GetPivot().Position : this.enemies.GetFrame(child).Position;
				const [screen, visible] = camera.WorldToViewportPoint(worldPosition);
				let label = this.markers[used];
				if (label === undefined) {
					label = new Instance("TextLabel");
					label.Name = "DroneMark";
					label.AnchorPoint = new Vector2(0.5, 0.5);
					label.Size = UDim2.fromOffset(40, 40);
					label.BackgroundTransparency = 1;
					label.Font = Enum.Font.GothamBold;
					label.TextColor3 = COLOR_MARKED;
					label.TextStrokeTransparency = 0.35;
					label.TextTransparency = 0.15;
					label.Parent = gui;
					this.markers[used] = label;
				}
				used += 1;
				const inside = visible && screen.X >= safeX && screen.X <= size.X - safeX && screen.Y >= safeY && screen.Y <= size.Y - safeY;
				const required = child.GetAttribute("RequiredTarget") === true;
				const text = inside ? (ground ? (required ? "◆" : "◇") : required ? "▲" : "△") : (ground ? "◆" : "▲");
				if (inside) {
					label.Position = UDim2.fromOffset(screen.X, screen.Y);
					label.Rotation = 0;
					label.TextSize = 16;
				} else {
					const localPosition = camera.CFrame.PointToObjectSpace(worldPosition);
					let dx = localPosition.X, dy = -localPosition.Y;
					if (dx * dx + dy * dy < 0.0001) { dx = localPosition.Z > 0 ? 1 : 0; dy = localPosition.Z > 0 ? 0 : -1; }
					const length = math.sqrt(dx * dx + dy * dy);
					dx /= length; dy /= length;
					// Slightly inside the selected target's arrow ring so the two never stack.
					const extent = 0.9 / math.max(math.abs(dx) / halfX, math.abs(dy) / halfY);
					label.Position = UDim2.fromOffset(size.X / 2 + dx * extent, size.Y / 2 + dy * extent);
					label.Rotation = math.deg(math.atan2(dy, dx)) + 90;
					label.TextSize = 18;
				}
				if (label.Text !== text) label.Text = text;
				if (!label.Visible) label.Visible = true;
			}
		}
		for (let index = used; index < this.markers.size(); index++) if (this.markers[index].Visible) this.markers[index].Visible = false;
	}
	/** Afterburner from the local predicted throttle, wingtip vapor in hard pulls, missile smoke. */
	private updateEffects(dt: number, speed: number): void {
		const engine = this.engine;
		if (engine) {
			const input = this.frameInput;
			this.engineSpool = EngineFx.Spool(this.engineSpool, EngineFx.Intensity(input.throttle), dt);
			JetFactory.SetEngine(engine, this.engineSpool);
			JetFactory.SetVapor(engine, EngineFx.VaporRate(math.max(math.abs(input.x), math.abs(input.y)), speed));
		}
		this.missiles.Step();
	}
	private render(dt: number): void {
		const camera = Workspace.CurrentCamera;
		const predictor = this.predictor;
		if (!this.active || !camera || !predictor) return;
		const now = os.clock();
		this.input(dt);
		const input = this.frameInput;
		// Fly the local jet with zero input latency; the server reconciles it at 20 Hz.
		// The next fixed step (the first to use this frame's input) starts at the last step boundary.
		const stamp = FlightPrediction.InputStamp(predictor, now);
		const state = FlightPrediction.Step(predictor, input, dt, now);
		let frame = frameFor(state);
		if (this.evadeRoll > 0) {
			this.evadeRoll = math.max(0, this.evadeRoll - dt);
			frame = frame.mul(CFrame.Angles(0, 0, (1 - this.evadeRoll / FlightPrediction.EvadeRollSeconds) * math.pi * 2));
		}
		this.visualFrame = frame;
		const root = this.visualRoot;
		if (root && root.Parent) root.CFrame = frame; // welded clone: one CFrame write moves the whole jet
		this.updateEffects(dt, state.speed);
		const position = frame.Position;
		// The chase camera ignores the evade roll so the horizon does not spin with it.
		const [fx, fy, fz] = FlightMath.Forward(state.yaw, state.pitch);
		const forward = new Vector3(fx, fy, fz);
		const speedFactor = math.clamp((state.speed - 165) / 155, 0, 1);
		const desiredPosition = position.sub(forward.mul(68 + speedFactor * 13)).add(CAMERA_LIFT);
		const desired = CFrame.lookAt(desiredPosition, position.add(forward.mul(100)).add(AIM_LIFT), Vector3.yAxis);
		// Impact feel (CameraShake) rides on top of the follow: shake is a camera-space
		// offset and the ace hit-stop slows the follow and punches the FOV. Visual only.
		const impact = CameraShake.Step(dt);
		this.cameraFrame = this.cameraFrame.Lerp(desired, FlightMath.DampAlpha(8 * impact.follow, dt));
		camera.CameraType = Enum.CameraType.Scriptable;
		camera.CFrame = this.cameraFrame.mul(impact.offset);
		camera.Focus = new CFrame(position.add(forward.mul(90)));
		const baseFov = camera.FieldOfView - this.fovKick;
		this.fovKick = impact.fov;
		camera.FieldOfView = baseFov + (72 + speedFactor * 9 - baseFov) * FlightMath.DampAlpha(3, dt) + impact.fov;
		this.enemies.Step(dt);
		this.updateTargetCue(camera);
		this.updateMarkers(camera);
		this.sendTime += dt;
		// Unreliable input: up to 20 Hz while the controls move, 10 Hz keepalive otherwise
		// (well inside the server's 0.7 s silence timeout even with packet loss).
		const changed = math.abs(this.sentX - input.x) > 0.01 || math.abs(this.sentY - input.y) > 0.01 || math.abs(this.sentThrottle - input.throttle) > 0.01;
		if ((changed && this.sendTime >= INPUT_INTERVAL) || this.sendTime >= INPUT_KEEPALIVE) {
			this.sendTime = 0;
			this.sentX = input.x; this.sentY = input.y; this.sentThrottle = input.throttle;
			const packet: FlightInputPacket = { x: input.x, y: input.y, throttle: input.throttle, t: stamp };
			this.remotes.FlightInput.FireServer(packet);
		}
	}
	public Start(missionData: MissionStarted): boolean {
		this.Stop();
		if (!typeIs(missionData, "table") || !isModel(missionData.aircraft)) { warn("SKYBREAK flight start is missing its replicated aircraft"); return false; }
		this.aircraft = missionData.aircraft;
		this.active = true;
		activeController = this;
		this.telemetry = { ...DEFAULTS };
		this.telemetrySequence = -1;
		this.telemetry.missionId = MissionCatalog.IsValidId(missionData.missionId) ? missionData.missionId : 1;
		if (this.telemetry.missionId === 2) {
			this.telemetry.phase = "intercept";
			this.telemetry.objective = "Intercept the required bandits";
			this.telemetry.objectiveTotal = 3;
			this.telemetry.tutorialStep = "";
		}
		this.keys.clear();
		this.touchInput = Vector2.zero;
		this.gamepadInput = Vector2.zero; this.throttleStick = 0; this.touchThrottleAxis = 0;
		this.throttle = 0.65;
		this.sendTime = INPUT_KEEPALIVE;
		this.sentThrottle = -1;
		this.mouseSteer = false;
		this.evadeRoll = 0;
		this.evadeStartedAt = -math.huge;
		this.cueColor = undefined; this.cueRange = -1; this.cueLock = -1; this.cueMarker = ""; this.cueHealth = -1; this.arrowText = "";
		this.visualFrame = this.aircraft.GetPivot();
		// The server holds the jet still until "Started", so its pivot is the exact initial state;
		// the first FlightState packet corrects speed and anything else within 50 ms.
		this.predictor = FlightPrediction.New(stateFrom(this.visualFrame));
		const camera = Workspace.CurrentCamera;
		if (camera) {
			this.previousCamera = { type: camera.CameraType, subject: camera.CameraSubject, frame: camera.CFrame, fov: camera.FieldOfView };
			this.cameraFrame = CFrame.lookAt(this.visualFrame.Position.sub(this.visualFrame.LookVector.mul(75)).add(CAMERA_LIFT), this.visualFrame.Position.add(this.visualFrame.LookVector.mul(100)));
		} else this.cameraFrame = this.visualFrame;
		// The predicted local visual; the replicated server aircraft stays hidden.
		this.visual = this.aircraft.Clone();
		this.visual.Name = "SkybreakLocalFlightVisual";
		for (const descendant of this.visual.GetDescendants()) if (JetFactory.IsCosmetic(descendant)) JetFactory.ShowCosmetic(descendant);
		this.visual.Parent = Workspace;
		this.visualRoot = this.visual.PrimaryPart;
		this.engine = JetFactory.FindEngine(this.visual);
		this.engineSpool = EngineFx.Intensity(this.throttle);
		const hidePart = (descendant: Instance) => {
			if (descendant.IsA("BasePart")) { this.hiddenParts.set(descendant, descendant.LocalTransparencyModifier); descendant.LocalTransparencyModifier = 1; }
			else if (JetFactory.IsCosmetic(descendant)) { this.hiddenParts.set(descendant, descendant.Enabled); descendant.Enabled = false; }
		};
		for (const descendant of this.aircraft.GetDescendants()) hidePart(descendant);
		this.connections.push(this.aircraft.DescendantAdded.Connect(hidePart));
		if (this.aircraft.Parent) { this.enemies.Start(this.aircraft.Parent); this.missiles.Start(this.aircraft.Parent); }
		[this.targetGui, this.bracket, this.bracketStroke, this.caption, this.arrow] = createTargetCue(Players.LocalPlayer.WaitForChild("PlayerGui"));
		ContextActionService.BindActionAtPriority(this.actionName, (_, state, input) => this.handleBoundInput(state, input.KeyCode, input.Position), false, 3000, ...FLIGHT_KEYS);
		this.connections.push(UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || UserInputService.GetFocusedTextBox()) return;
			if (input.UserInputType === Enum.UserInputType.MouseButton1) this.FireMissile();
			if (input.UserInputType === Enum.UserInputType.MouseButton2) this.mouseSteer = true;
		}));
		this.connections.push(UserInputService.InputEnded.Connect((input) => { if (input.UserInputType === Enum.UserInputType.MouseButton2) this.mouseSteer = false; }));
		const clearInput = () => {
			this.keys.clear(); this.mouseSteer = false; this.touchInput = Vector2.zero; this.gamepadInput = Vector2.zero; this.throttleStick = 0; this.touchThrottleAxis = 0;
		};
		this.connections.push(UserInputService.TextBoxFocused.Connect(clearInput));
		this.connections.push(UserInputService.GamepadDisconnected.Connect(clearInput));
		this.connections.push(UserInputService.WindowFocusReleased.Connect(clearInput));
		RunService.BindToRenderStep(this.renderName, Enum.RenderPriority.Camera.Value + 1, (dt) => this.render(dt));
		return true;
	}
	public Stop(): void {
		this.active = false;
		RunService.UnbindFromRenderStep(this.renderName);
		ContextActionService.UnbindAction(this.actionName);
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [part, previous] of this.hiddenParts) {
			if (!part.Parent) continue;
			if (part.IsA("BasePart")) part.LocalTransparencyModifier = previous as number;
			else part.Enabled = previous as boolean;
		}
		this.hiddenParts.clear();
		this.enemies.Stop();
		this.missiles.Stop();
		this.visual?.Destroy(); this.visual = undefined; this.visualRoot = undefined; this.engine = undefined;
		this.predictor = undefined;
		this.targetGui?.Destroy(); this.targetGui = undefined;
		this.markers.clear();
		CameraShake.Reset(); this.fovKick = 0;
		const camera = Workspace.CurrentCamera;
		if (camera && this.previousCamera) {
			camera.CameraType = this.previousCamera.type;
			camera.CameraSubject = this.previousCamera.subject;
			camera.CFrame = this.previousCamera.frame;
			camera.FieldOfView = this.previousCamera.fov;
		}
		this.previousCamera = undefined;
		this.aircraft = undefined;
		this.touchInput = Vector2.zero;
		this.gamepadInput = Vector2.zero; this.throttleStick = 0; this.touchThrottleAxis = 0;
		this.keys.clear();
		this.mouseSteer = false;
	}
	public Destroy(): void {
		this.Stop();
		for (const connection of this.streamConnections) connection.Disconnect();
		this.streamConnections.clear();
		this.listeners.clear();
		if (activeController === this) activeController = undefined;
	}
}
