import { RearmPlan, rearmPose } from "../shared/EngineBatchC";
import type { CutInPlan } from "../shared/SortieCutaways";
import type { SpecialKind } from "../shared/SpecialWeapons";
import { EliteCutIn } from "./EliteCutIn";
import { canSkipLanding, LandingPlan, landingAccomplishedAt, landingDistance, landingPose } from "../shared/EngineBatchB";
import { LaunchStage, LaunchStageState } from "../shared/LaunchStage";
import type { FlightControlHandoff } from "../shared/Types";
import { ContextActionService, GuiService, Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { airspaceWarning } from "../shared/WorldAirspace";
import { MissionCatalog } from "../shared/MissionCatalog";
import { initialTelemetry } from "../shared/InitialTelemetry";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { FlightPrediction, Predictor } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { FlightInput, FlightInputPacket, HudState, MissionStarted, Remotes, Telemetry } from "../shared/Types";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { WeaponRules } from "../shared/WeaponRules";
import { EngineFx } from "../shared/EngineFx";
import { EngineRig, HOSTILE_MISSILE, JetFactory } from "../shared/JetFactory";
import { CameraShake } from "./CameraShake";
import { CombatEffects } from "./CombatEffects";
import { EnemySmoothing } from "./EnemySmoothing";
import { MissileTrails } from "./MissileTrails";
import { GameAudio } from "./GameAudio";
import { HUD, HUD_FONT_BOLD } from "./Theme";
import { evadeGauge } from "../shared/EvadeGauge";
import { sphereSweep } from "../shared/SphereSweep";
import { terrainProbeLength, terrainSeconds } from "../shared/FlightWarnings";
import type { RadarContact, RadarContactKind } from "../shared/RadarMath";
import { TARGET_BOX_SELECTED_MIN, TARGET_CAPTION_GAP, TARGET_CAPTION_HEIGHT, TARGET_CAPTION_WIDTH, TargetBoxes, type CaptionSpot, type SelectedStyle } from "../shared/TargetBoxes";
import type { HudLayout } from "../shared/UILayout";
import { viewportOrigin, viewportPosition } from "./ViewportGui";
import { TargetBoxOverlay } from "./TargetBoxOverlay";

let activeController: FlightController | undefined;
let controllerSerial = 0;
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
/** Edge arrows and drone glyphs stay this far in from the screen edge (pixel cap, viewport share). */
const SAFE_EDGE_X = 90;
const SAFE_EDGE_X_SHARE = 0.16;
const SAFE_EDGE_Y = 150;
const SAFE_EDGE_Y_SHARE = 0.24;
/** Off-screen drone markers sit slightly inside the selected target's arrow ring so the two never stack. */
const TARGET_ARROW_INSET = 1;
const MARKER_ARROW_INSET = 0.9;
function safeInsets(size: Vector2): [number, number] {
	return [math.min(SAFE_EDGE_X, size.X * SAFE_EDGE_X_SHARE), math.min(SAFE_EDGE_Y, size.Y * SAFE_EDGE_Y_SHARE)];
}
/** Viewport point and rotation (degrees) of an edge arrow pointing at `worldPosition`, on the safe ellipse scaled by `inset`. */
function edgePoint(camera: Camera, worldPosition: Vector3, halfX: number, halfY: number, inset: number): [number, number, number] {
	const size = camera.ViewportSize;
	const localPosition = camera.CFrame.PointToObjectSpace(worldPosition);
	let dx = localPosition.X, dy = -localPosition.Y;
	if (dx * dx + dy * dy < 0.0001) { dx = localPosition.Z > 0 ? 1 : 0; dy = localPosition.Z > 0 ? 0 : -1; }
	const length = math.sqrt(dx * dx + dy * dy);
	dx /= length; dy /= length;
	const extent = inset / math.max(math.abs(dx) / halfX, math.abs(dy) / halfY);
	return [size.X / 2 + dx * extent, size.Y / 2 + dy * extent, math.deg(math.atan2(dy, dx)) + 90];
}
/** Filled glyphs mark required contacts, hollow ones optional; diamonds are ground, triangles air. */
function contactGlyph(ground: boolean, required: boolean): string {
	return ground ? (required ? "◆" : "◇") : required ? "▲" : "△";
}
// Per-frame constants (no Vector3/Color3 construction inside the render loop).
/** Chase camera height above the jet and aim point above the nose, along the smoothed camera up. */
const CAMERA_LIFT_STUDS = 20;
const AIM_LIFT_STUDS = 4;
/** How fast (1/s) the chase camera's up vector follows the canopy: about 0.2 s of lag in a loop. */
const CAMERA_ROLL_RATE = 5;
/** Ease from the aft-facing launch view into chase instead of rotating both views in one frame. */
const CAMERA_HANDOFF_SECONDS = 0.8;
// Target box in the HUD palette: green for mission targets, dim green for optional ones, red once locked,
// grey for a selection the server will not let you damage right now (never red, never LOCKED).
// The selected box blinks unless it holds a damageable lock.
const COLOR_LOCKED = HUD.Red;
const COLOR_REQUIRED = HUD.Green;
const COLOR_OPTIONAL = HUD.Dim;
const COLOR_PROTECTED = Color3.fromRGB(150, 160, 156);
const CUE_COLOR: Record<SelectedStyle["tone"], Color3> = { locked: COLOR_LOCKED, required: COLOR_REQUIRED, optional: COLOR_OPTIONAL, protected: COLOR_PROTECTED };
/** Stroke transparency during the dark half of the selected box's blink. */
const BLINK_OFF = 0.85;
/** Seconds between client-only terrain probes and airspeed-trend samples (warnings only; no gameplay effect). */
const PROBE_INTERVAL = 0.1;
/** Fuselage-ish radius of the warning sweep, a little wider than the server's 4-stud crash sweep. */
const PROBE_RADIUS = 6;
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
/** Same transform the server applies: the attitude quaternion plus the cosmetic turn lean. */
function frameFor(state: FlightState): CFrame {
	const [qx, qy, qz, qw] = FlightMath.Visual(state);
	return new CFrame(state.x, state.y, state.z, qx, qy, qz, qw);
}
function launchCameraFor(state: FlightState): CFrame {
	const pose = LaunchStage.Camera(state);
	return CFrame.lookAt(
		new Vector3(pose.position.x, pose.position.y, pose.position.z),
		new Vector3(pose.target.x, pose.target.y, pose.target.z),
		new Vector3(pose.up.x, pose.up.y, pose.up.z),
	);
}
function stateFrom(frame: CFrame): FlightState {
	const state = FlightMath.NewState();
	state.x = frame.X; state.y = frame.Y; state.z = frame.Z;
	const [right, up, back] = [frame.RightVector, frame.UpVector, frame.LookVector.mul(-1)];
	return FlightMath.SetBasis(state, right.X, right.Y, right.Z, up.X, up.Y, up.Z, back.X, back.Y, back.Z);
}
export function createTargetCue(playerGui: Instance): [ScreenGui, Frame, UIStroke, TextLabel, TextLabel] {
	const gui = new Instance("ScreenGui");
	gui.Name = "SkybreakFlightTargeting";
	gui.IgnoreGuiInset = true;
	gui.ResetOnSpawn = false;
	gui.DisplayOrder = 8;
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
	// Full viewport; ViewportGui maps camera pixels to the measured GUI space.
	gui.ScreenInsets = Enum.ScreenInsets.None;
	gui.Parent = playerGui;
	const bracket = new Instance("Frame");
	bracket.Name = "TargetBracket";
	bracket.AnchorPoint = new Vector2(0.5, 0.5);
	bracket.Size = UDim2.fromOffset(60, 60);
	bracket.BackgroundTransparency = 1;
	bracket.Visible = false;
	bracket.Parent = gui;
	// Square box, thin line: the HUD's target designator.
	const stroke = new Instance("UIStroke");
	stroke.Thickness = 1.5;
	stroke.Color = COLOR_REQUIRED;
	stroke.Parent = bracket;
	const caption = new Instance("TextLabel");
	caption.Name = "TargetCaption";
	caption.BackgroundTransparency = 1;
	caption.Position = new UDim2(0.5, 0, 1, TARGET_CAPTION_GAP);
	caption.AnchorPoint = new Vector2(0.5, 0);
	// One short line under (or over) the bracket: "LOCK 60%" / "LOCKED · 820m". Its whole label is the
	// footprint TargetBoxes.PlaceCaption keeps on screen and off the touch controls, so the text never spills out.
	caption.Size = UDim2.fromOffset(TARGET_CAPTION_WIDTH, TARGET_CAPTION_HEIGHT);
	caption.TextTruncate = Enum.TextTruncate.AtEnd;
	caption.FontFace = HUD_FONT_BOLD;
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
/** Client-side flight trend for the HUD warnings: airspeed change and time to terrain along the flight path. */
export interface FlightTrend {
	acceleration: number;
	terrainSeconds?: number;
}
/** Same include list as the server's AircraftCollision.Parameters (Terrain + FlightSolid scenery), built locally. */
function scenerySurfaces(folder: Instance): RaycastParams {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	const surfaces: Instance[] = [Workspace.Terrain];
	for (const item of folder.GetDescendants()) if (item.IsA("BasePart") && item.GetAttribute("FlightSolid") === true) surfaces.push(item);
	params.FilterDescendantsInstances = surfaces;
	params.IgnoreWater = false;
	params.RespectCanCollide = false;
	return params;
}
// QA and phone UI use this same controller; all combat decisions stay on server.
// The player's own jet is predicted locally (FlightPrediction) and reconciled
// against the server's 20 Hz FlightState stream; everything else is server state.
/** Seconds before an unacknowledged Pause/Resume is sent again (same serial, idempotent on the server). */
const PAUSE_RESEND_SECONDS = 1;
export class FlightController {
	public active = false;
	public aircraft?: Model;
	private readonly remotes: Pick<Remotes, "FlightInput" | "CombatAction" | "MissionState" | "FlightState" | "Telemetry">;
	private telemetry: Telemetry = initialTelemetry(1);
	private telemetrySequence = -1;
	private readonly listeners = new Set<TelemetryListener>();
	private touchInput = Vector2.zero;
	private gamepadInput = Vector2.zero;
	private throttle = FlightMath.CruiseThrottle;
	private throttleStick = 0;
	private touchThrottleAxis = 0;
	private keys = new Set<Enum.KeyCode>();
	private connections: RBXScriptConnection[] = [];
	private hiddenParts = new Map<BasePart | Trail | ParticleEmitter | Light, number | boolean>();
	private readonly missiles = new MissileTrails();
	private readonly audio = new GameAudio();
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
	/** Set when the player's jet explodes: the camera holds on the blast until the debrief takes over. */
	private downAt?: Vector3;
	private stopExplosions?: () => void;
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
	private sentAssist?: boolean;
	/** Reused input table handed to FlightPrediction.Step every frame. */
	private readonly frameInput: FlightInput = { x: 0, y: 0, throttle: FlightMath.CruiseThrottle, assist: false };
	/** Smoothed camera up: follows the jet's canopy through loops and inverted flight without snapping. */
	private cameraUp = Vector3.yAxis;
	private predictor?: Predictor;
	/** Seconds left of the (locally predicted) evade barrel roll. */
	private evadeRoll = 0;
	/** os.clock() when the current/last roll began (local prediction or joined server roll). */
	private evadeStartedAt = -math.huge;
	// Last values written to the target cue, so text/colour only change when they differ.
	private cueColor?: Color3;
	private cueRange = -1;
	private cueLock = -1;
	private cueCaption?: SelectedStyle["caption"];
	private cueRequired?: boolean;
	private cueHealth = -1;
	private cueSize = -1;
	private cueBlink?: boolean;
	private cueAbove?: boolean;
	private cueDx = 0;
	private readonly captionSpot: CaptionSpot = { above: false, dx: 0 };
	private arrowText = "";
	/** Boxes on every other valid target in view. */
	private readonly boxes = new TargetBoxOverlay();
	/** HUD layout, UIScale and root the touch controls are drawn in; boxes keep clear of them. */
	private keepoutLayout?: HudLayout;
	private keepoutScale = 1;
	private keepoutAnchor?: GuiObject;
	private keepoutRoot?: Vector2;
	private keepoutOrigin?: Vector2;
	private keepoutViewport?: Vector2;
	private keepoutDirty = true;
	private readonly enemies = new EnemySmoothing();
	/** Pause overlay is up: the local jet, camera and actions hold until Resume. */
	private paused = false;
	private rearm?: {plan:RearmPlan;elapsed:number;cameraCut?:boolean;menu?:boolean;special?:SpecialKind};
	private cutIn?: EliteCutIn;
	/** Bumped by gamepad B while the rearm menu is open: the overlay steps back out of the weapon list. */
	private rearmMenuBack = 0;
	private landing?: {plan: LandingPlan; elapsed: number; cameraCut?: boolean};
	private launchIntro?: LaunchStageState;
	private launchCameraTime = CAMERA_HANDOFF_SECONDS;
	/** Serial of the latest local Pause/Resume, the action it carried, and when it was last sent; the server echoes `pauseAck`. */
	private pauseSerial = 0;
	private pauseAction: "Pause" | "Resume" | undefined;
	private pauseSentAt = 0;
	private invertY = false;
	/** Settings: opt-in level-out assist (a centred stick eases back to wings-level). Default off: attitude hold. */
	private levelAssist = false;
	private probeClock = 0;
	private probeParams?: RaycastParams;
	private probeDirty = true;
	private probeBuiltAt = -math.huge;
	private trendSpeed?: number;
	private readonly trend: FlightTrend = { acceleration: 0 };
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
			const message = data as Partial<Omit<HudState, "kind">> & { kind?: string };
			if(message.kind==="RearmStarted" && this.active) { this.rearm={plan:(data as {plan:RearmPlan}).plan,elapsed:0}; this.keys.clear(); for (const part of this.visual?.GetDescendants() ?? []) if (part.IsA("BasePart")) part.LocalTransparencyModifier=1; }
			else if(message.kind==="RearmSkipped" && this.rearm) this.rearm.elapsed=(data as {elapsed:number}).elapsed;
			else if((message.kind==="RearmMenu" || message.kind==="RearmTakeoff") && this.rearm) {
				const menu=data as {elapsed:number;special:unknown};
				this.rearm.elapsed=menu.elapsed; this.rearm.menu=message.kind==="RearmMenu";
				// The menu owns the gamepad: D-pad/stick/A navigate the GUI; flight resumes on takeoff.
				if (!this.paused) this.bindControls();
				if (SpecialWeapons.IsKind(menu.special)) { this.rearm.special=menu.special; this.telemetry.special=menu.special; this.notify(); }
			}
			else if(message.kind==="CutInStarted" && this.active) {
				const start=data as {plan:CutInPlan;subjects:Model[]};
				this.cutIn?.Stop(); this.cutIn=new EliteCutIn(start.plan,start.subjects.filter((m)=>typeIs(m,"Instance"))); this.keys.clear();
			}
			else if(message.kind==="CutInComplete" && this.cutIn) {
				const handoff=data as FlightControlHandoff; if(this.predictor) FlightPrediction.Handoff(this.predictor,handoff.state,handoff.sequence);
				this.cutIn.Stop(); this.cutIn=undefined; this.keys.clear();
			}
			else if(message.kind==="RearmComplete" && this.active) { const handoff=data as FlightControlHandoff; if(this.predictor) FlightPrediction.Handoff(this.predictor,handoff.state,handoff.sequence); this.rearm=undefined; this.keys.clear(); if (!this.paused) this.bindControls(); for (const part of this.visual?.GetDescendants() ?? []) if (part.IsA("BasePart")) part.LocalTransparencyModifier=0; }
			else if (message.kind === "LandingStarted" && this.active) {
				this.landing={plan:(data as {plan:LandingPlan}).plan,elapsed:0}; this.keys.clear();
				// The replicated aircraft is already hidden; hide the predicted clone for cockpit flight.
				for (const part of this.visual?.GetDescendants() ?? []) if (part.IsA("BasePart")) part.LocalTransparencyModifier = 1;
			}
			else if (message.kind === "LandingSkipped" && this.active && this.landing) {
				// Skip cuts straight to the runway hold on the server's clock.
				const elapsed = (data as { elapsed?: unknown }).elapsed;
				if (typeIs(elapsed, "number") && FlightMath.IsFinite(elapsed)) { this.landing.elapsed = math.max(this.landing.elapsed, elapsed); this.landing.cameraCut = false; }
			}
			else if (message.kind === "FlightControl" && this.active && this.launchIntro !== undefined) {
				const handoff = data as FlightControlHandoff;
				const predictor = this.predictor;
				if (!predictor) return;
				FlightPrediction.Handoff(predictor, handoff.state, handoff.sequence);
				// Ignore delayed pre-handoff packets while the reliable pose gap blends through normal prediction.
				this.launchIntro = undefined; this.launchCameraTime = 0; this.keys.clear(); this.touchInput = Vector2.zero; this.gamepadInput = Vector2.zero;
				this.throttle = FlightMath.CruiseThrottle; this.evadeRoll = 0;
				this.mouseSteer = false; this.throttleStick = 0; this.touchThrottleAxis = 0;
				this.notify();
			}
			else if (message.kind === "HudState") { if (this.active) this.applyHud(message as Partial<HudState>); }
			else if (message.kind === "Completed" || message.kind === "Failed") this.Stop();
			else if (message.kind === "Loading") this.Stop();
		}));
		this.streamConnections.push(this.remotes.Telemetry.OnClientEvent.Connect((packet: unknown) => {
			if (!this.active) return;
			// Decode into a scratch-free path: validate the sequence before touching state.
			if (!typeIs(packet, "table") || !FlightMath.IsFinite((packet as unknown[])[0]) || (packet as number[])[0] <= this.telemetrySequence) return;
			const sequence = TelemetryCodec.Decode(packet, this.telemetry);
			if (sequence === undefined) return;
			this.telemetrySequence = sequence;
			// The server owns the pause. Only once it has acknowledged our latest request does its state win:
			// then a not-paused packet means it resumed on its own (budget spent) or refused, so un-freeze locally.
			if ((this.telemetry.pauseAck ?? 0) >= this.pauseSerial) {
				this.pauseAction = undefined;
				if (this.paused && this.telemetry.paused === false) this.releaseLocalPause();
			}
			this.notify();
		}));
		this.streamConnections.push(this.remotes.FlightState.OnClientEvent.Connect((packet: unknown) => {
			const predictor = this.predictor;
			if (!this.active || !predictor || this.landing || this.rearm || this.launchIntro) return;
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
		this.audio.Telemetry(this.telemetry);
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
		t.radioPriority = message.radioPriority === true;
		t.fireDenied = WeaponRules.IsFireNotice(message.fireDenied) ? message.fireDenied : undefined;
		if (typeIs(message.fireDeniedSerial, "number")) t.fireDeniedSerial = message.fireDeniedSerial;
		if (SpecialWeapons.IsKind(message.special)) t.special = message.special;
		this.notify();
	}
	private handleBoundInput(state: Enum.UserInputState, keyCode: Enum.KeyCode, position: Vector3): Enum.ContextActionResult {
		if (!this.active) return Enum.ContextActionResult.Pass;
		if (UserInputService.GetFocusedTextBox() && state !== Enum.UserInputState.End && state !== Enum.UserInputState.Cancel) return Enum.ContextActionResult.Pass;
		if (this.landing || this.rearm || this.cutIn) {
			if (state === Enum.UserInputState.Begin && (keyCode === Enum.KeyCode.Space || keyCode === Enum.KeyCode.ButtonR2)) this.SkipLanding();
			return Enum.ContextActionResult.Sink;
		}
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
		return { selectedMph: FlightMath.ToMph(FlightMath.SpeedForThrottle(this.throttle)), actualMph: this.predictor ? FlightMath.ToMph(this.predictor.state.speed) : undefined, command: {...this.frameInput}, state: this.GetFlightState(), correction: this.predictor ? {...this.predictor.pending} : undefined, throttleStick: this.throttleStick, throttle: this.throttle, touchThrottleAxis: this.touchThrottleAxis, touchStick: this.touchInput, stick: this.gamepadInput, prediction: this.predictor?.last, rtt: this.predictor?.rtt };
	}
	public SetInput(x: number, y: number): void { this.touchInput = new Vector2(FlightMath.ClampInput(x), FlightMath.ClampInput(y)); }
	public SetTouchThrottleAxis(value: number): void { this.touchThrottleAxis = FlightMath.ClampInput(value); }
	/** QA/autopilot selects an absolute speed; held touch input is a separate API. */
	public SetThrottle(value: number): void {
		if (FlightMath.IsFinite(value)) this.throttle = math.clamp(value, 0, 1);
	}
	private action(action: string): void { if (this.active && !this.paused && !this.landing && !this.rearm && !this.cutIn && !this.launchIntro) this.remotes.CombatAction.FireServer({ action }); }
	public FireMissile(): void { this.action("FireMissile"); }
	public Evade(): void {
		if (!this.active) return;
		if (this.paused || this.landing || this.rearm || this.cutIn || this.launchIntro) return;
		// Predict the barrel roll when the HUD says a charge is ready; the server confirms or ignores.
		if (evadeGauge(this.telemetry).ready && this.evadeRoll <= 0) { this.evadeRoll = FlightPrediction.EvadeRollSeconds; this.evadeStartedAt = os.clock(); }
		this.action("Evade");
	}
	public CycleTarget(): void { this.action("CycleTarget"); }
	/** Touch positions are inset-relative; target boxes use WorldToViewportPoint pixels. */
	public TryTapTarget(position: Vector3): boolean {
		if (!this.active || this.paused || this.landing || this.rearm || this.launchIntro) return false;
		const [inset] = GuiService.GetGuiInset();
		const target = this.boxes.HitTest(position.X + inset.X, position.Y + inset.Y);
		if (!target) return false;
		this.remotes.CombatAction.FireServer({ action: "SelectTarget", target });
		return true;
	}
	public ConfirmAudio(): void { this.audio.Confirm(); }
	public ResultAudio(won: boolean): void { this.audio.Result(won); }
	/**
	 * Pause/Resume: tells the server (which stops stepping the sortie and shifts its
	 * clock) and freezes the local prediction so the jet does not fly on and snap back.
	 */
	public SetPaused(paused: boolean): void {
		if (!this.active || paused === this.paused) return;
		this.pauseSerial += 1;
		this.pauseAction = paused ? "Pause" : "Resume";
		this.sendPauseRequest();
		this.applyLocalPause(paused);
	}
	private sendPauseRequest(): void {
		if (!this.pauseAction) return;
		this.pauseSentAt = os.clock();
		this.remotes.CombatAction.FireServer({ action: this.pauseAction, serial: this.pauseSerial });
	}
	/** Resend an unacknowledged Pause/Resume (a dropped or rate-limited request must not leave client and server split). */
	private retryPauseRequest(now: number): void {
		if (this.pauseAction && now - this.pauseSentAt >= PAUSE_RESEND_SECONDS) this.sendPauseRequest();
	}
	/** Server resumed without a local Resume (pause budget spent) or refused the pause: follow it, sending nothing. */
	private releaseLocalPause(): void { if (this.paused) this.applyLocalPause(false); }
	private applyLocalPause(paused: boolean): void {
		this.paused = paused;
		this.audio.SetPaused(paused);
		this.keys.clear(); this.mouseSteer = false; this.touchInput = Vector2.zero; this.gamepadInput = Vector2.zero; this.throttleStick = 0; this.touchThrottleAxis = 0;
		this.sendTime = INPUT_KEEPALIVE;
		// Free the gamepad stick and buttons for the pause card's GUI navigation.
		if (paused) { ContextActionService.UnbindAction(this.actionName); ContextActionService.UnbindAction(`${this.actionName}_RearmMenu`); }
		else this.bindControls();
	}
	private bindControls(): void {
		const menuAction = `${this.actionName}_RearmMenu`;
		ContextActionService.UnbindAction(this.actionName);
		ContextActionService.UnbindAction(menuAction);
		if (this.rearm?.menu === true) {
			// TAKEOFF / CHANGE WEAPON menu: leave navigation (D-pad, thumbsticks, A) to GuiService selection. SPACE / RT
			// takes off as loaded; B steps back out of the weapon list.
			ContextActionService.BindActionAtPriority(menuAction, (_, state, input) => {
				if (state !== Enum.UserInputState.Begin) return Enum.ContextActionResult.Sink;
				if (input.KeyCode === Enum.KeyCode.ButtonB) { this.rearmMenuBack += 1; this.notify(); }
				else this.SkipLanding();
				return Enum.ContextActionResult.Sink;
			}, false, 3000, Enum.KeyCode.Space, Enum.KeyCode.ButtonR2, Enum.KeyCode.ButtonB);
			return;
		}
		ContextActionService.BindActionAtPriority(this.actionName, (_, state, input) => this.handleBoundInput(state, input.KeyCode, input.Position), false, 3000, ...FLIGHT_KEYS);
	}

	public IsPaused(): boolean { return this.paused; }
	/** Flight advice and warning tones stay silent while the scripted launch owns the jet. */
	/** HUD landing readouts from the local cinematic clock: DIST to touchdown and the runway MISSION ACCOMPLISHED hold. */
	public LandingStatus(): { distance: number; accomplished: boolean; skippable: boolean } | undefined {
		const landing = this.landing;
		if (!landing) return undefined;
		return { distance: landingDistance(landing.plan, landing.elapsed), accomplished: landing.elapsed >= landingAccomplishedAt(landing.plan),
			skippable: canSkipLanding(landing.elapsed) };
	}
	public SkipLanding(): void { if (this.paused) return; if ((this.landing && canSkipLanding(this.landing.elapsed)) || (this.rearm && canSkipLanding(this.rearm.elapsed)) || this.cutIn?.Skippable()) this.remotes.CombatAction.FireServer({action:"SkipLanding"}); }
	public FlightWarningsEnabled(): boolean { return this.launchIntro === undefined && this.landing === undefined && this.rearm === undefined && this.cutIn === undefined; }
	/** Rearm presentation for the HUD: plan, rearm seconds, and whether the TAKEOFF / CHANGE WEAPON menu is open. */
	public RearmStatus(): { plan: RearmPlan; elapsed: number; menu: boolean; special?: SpecialKind; skippable: boolean; back: number } | undefined {
		const r=this.rearm; return r ? { plan:r.plan, elapsed:r.elapsed, menu:r.menu === true, special:r.special, skippable:canSkipLanding(r.elapsed), back:this.rearmMenuBack } : undefined;
	}
	/** TAKEOFF (keep the loadout) or CHANGE WEAPON (a special kind); the server validates and answers. */
	public RearmTakeoff(special?: SpecialKind): void { if (!this.paused && this.rearm?.menu === true) this.remotes.CombatAction.FireServer({action:"RearmTakeoff",special}); }
	/** The surprise cut-in while it plays: the HUD hides and shows its caption. */
	public CutInStatus(): { caption?: string; skippable: boolean } | undefined { return this.cutIn ? { caption:this.cutIn.Caption(), skippable:this.cutIn.Skippable() } : undefined; }
	/** Settings: pushing up dives instead of climbing (every input source). */
	public SetInvertY(invert: boolean): void { this.invertY = invert; }
	/** Settings: a centred stick gently levels the jet (pitch to the horizon, rolls upright). */
	public SetLevelAssist(assist: boolean): void { this.levelAssist = assist; }
	/** Predicted nose heading (FlightMath yaw), or undefined outside a mission. */
	public GetHeading(): number | undefined {
		return this.active ? this.predictor?.state.yaw : undefined;
	}
	/** Copy of the predicted flight state (QA pilot and diagnostics), or undefined outside a mission. */
	public GetFlightState(): FlightState | undefined {
		const state = this.active ? this.predictor?.state : undefined;
		return state ? { ...state } : undefined;
	}
	/** Airspeed trend and time to terrain from the latest client probe (refreshed every PROBE_INTERVAL). */
	public GetFlightTrend(): FlightTrend { return this.trend; }
	/**
	 * Every contact the radar can show, from what the client already has: the
	 * replicated mission folder (enemies, protected actor, hostile missiles) and
	 * the telemetry navigation point. Air contacts use the smoothed visuals.
	 */
	public GetRadarContacts(): RadarContact[] {
		const contacts: RadarContact[] = [];
		if(this.telemetry.radarJammed && !this.telemetry.radarPartial) return contacts;
		const folder = this.aircraft?.Parent;
		if (!this.active || !folder) return contacts;
		const selected = this.telemetry.target;
		for (const child of folder.GetChildren()) {
			if (child.IsA("Model")) {
				if (child.GetAttribute("SkybreakFriendly") === true) {
					const position = this.enemies.GetFrame(child).Position;
					contacts.push({ kind: "friendly", x: position.X, z: position.Z });
				} else if (child.GetAttribute("SkybreakEnemy") === true) {
					const ground = child.GetAttribute("TargetKind") === "ground";
					const required = child.GetAttribute("RequiredTarget") === true;
					const kind: RadarContactKind = ground ? (required ? "ground" : "groundOptional") : required ? "required" : "optional";
					const position = ground ? child.GetPivot().Position : this.enemies.GetFrame(child).Position;
					contacts.push({ kind, x: position.X, z: position.Z, selected: child === selected });
				} else if (child.GetAttribute("ProtectedObjective") === true) {
					const position = child.GetPivot().Position;
					contacts.push({ kind: "protected", x: position.X, z: position.Z });
				}
			} else if (child.IsA("BasePart") && child.Name === HOSTILE_MISSILE) {
				contacts.push({ kind: "missile", x: child.Position.X, z: child.Position.Z });
			}
		}
		const navigation = this.telemetry.navigation;
		if (navigation) contacts.push({ kind: "objective", x: navigation.X, z: navigation.Z });
		const position=this.GetPosition();
		return this.telemetry.radarPartial && position ? contacts.filter(c=>math.sqrt((c.x-position.X)**2+(c.z-position.Z)**2)<=(this.GetAirspace()?.radarRange ?? 3800)/2) : contacts;
	}
	/** Forward sweep along the predicted flight path against scenery; warnings only, never gameplay. */
	private probe(state: FlightState, position: Vector3, now: number): void {
		const speed = state.speed;
		if (this.trendSpeed !== undefined) {
			const sample = (speed - this.trendSpeed) / PROBE_INTERVAL;
			this.trend.acceleration += (sample - this.trend.acceleration) * 0.5;
		}
		this.trendSpeed = speed;
		const folder = this.aircraft?.Parent;
		if (!folder) { this.trend.terrainSeconds = undefined; return; }
		if (!this.probeParams || (this.probeDirty && now - this.probeBuiltAt >= 1)) {
			this.probeParams = scenerySurfaces(folder);
			this.probeDirty = false;
			this.probeBuiltAt = now;
		}
		const [fx, fy, fz] = FlightMath.ForwardOf(state);
		// Same sink the server integrates while stalled.
		const velocity = new Vector3(fx * speed, fy * speed - FlightMath.StallSeverity(speed) * 65, fz * speed);
		const pathSpeed = velocity.Magnitude;
		if (!FlightMath.IsFinite(pathSpeed) || pathSpeed < 1) { this.trend.terrainSeconds = undefined; return; }
		const hit = sphereSweep(position, PROBE_RADIUS, velocity.Unit.mul(terrainProbeLength(pathSpeed)), this.probeParams);
		this.trend.terrainSeconds = terrainSeconds(hit?.distance, pathSpeed);
	}
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
		return airspaceWarning(state.x, state.z, this.predictor!.airspace, 100)
			|| state.y > FlightMath.MaxAltitude - 70;
	}
	public GetAirspace() { return this.predictor?.airspace; }
	public GetThrottle(): number { return this.throttle; }
	/**
	 * The HUD's touch layout (virtual px), its UIScale, the frame it is drawn in and that root's size (its
	 * safe area): target boxes and their text never cover those controls or leave that area.
	 */
	public SetTargetKeepouts(layout: HudLayout | undefined, scale: number, anchor: GuiObject | undefined, root?: Vector2): void {
		this.keepoutLayout = layout; this.keepoutScale = scale; this.keepoutAnchor = anchor; this.keepoutRoot = root; this.keepoutDirty = true;
	}
	/** Rebuilds the keep-outs and bounds when the layout, viewport or HUD root's on-screen origin moved (cheap compare per frame). */
	private updateKeepouts(viewport: Vector2): void {
		const gui = this.targetGui, anchor = this.keepoutAnchor, layout = this.keepoutLayout;
		if (!gui) return;
		if (!anchor || !layout || anchor.Parent === undefined) {
			if (!this.keepoutDirty && this.keepoutOrigin === undefined && viewport === this.keepoutViewport) return;
			this.keepoutDirty = false; this.keepoutOrigin = undefined; this.keepoutViewport = viewport;
			this.boxes.SetPlacement([], TargetBoxes.Bounds(viewport.X, viewport.Y));
			return;
		}
		// Keep-outs stay in viewport pixels, independently of the targeting GUI origin.
		const origin = viewportOrigin(anchor);
		if (!this.keepoutDirty && origin === this.keepoutOrigin && viewport === this.keepoutViewport) return;
		this.keepoutDirty = false; this.keepoutOrigin = origin; this.keepoutViewport = viewport;
		const root = this.keepoutRoot;
		const safe = root ? { x: origin.X, y: origin.Y, width: root.X, height: root.Y } : undefined;
		this.boxes.SetPlacement(TargetBoxes.Keepouts(layout, this.keepoutScale, origin.X, origin.Y), TargetBoxes.Bounds(viewport.X, viewport.Y, safe));
	}
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
		let throttleAxis = 0;
		if (!UserInputService.GetFocusedTextBox()) {
			throttleAxis = this.throttleStick + this.touchThrottleAxis;
			if (this.keys.has(Enum.KeyCode.A) || this.keys.has(Enum.KeyCode.Left)) x -= 1;
			if (this.keys.has(Enum.KeyCode.D) || this.keys.has(Enum.KeyCode.Right)) x += 1;
			if (this.keys.has(Enum.KeyCode.W) || this.keys.has(Enum.KeyCode.Up)) y += 1;
			if (this.keys.has(Enum.KeyCode.S) || this.keys.has(Enum.KeyCode.Down)) y -= 1;
			if (this.keys.has(Enum.KeyCode.Q) || this.keys.has(Enum.KeyCode.ButtonL1)) throttleAxis -= 1;
			if (this.keys.has(Enum.KeyCode.E) || this.keys.has(Enum.KeyCode.ButtonR1)) throttleAxis += 1;
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
		this.frameInput.y = math.clamp(this.invertY ? -y : y, -1, 1);
		if (!UserInputService.GetFocusedTextBox() && this.keys.has(Enum.KeyCode.LeftShift)) throttleAxis += 1;
		this.throttle = FlightMath.AdjustThrottle(this.throttle, throttleAxis, dt);
		this.frameInput.throttle = this.throttle;
		this.frameInput.assist = this.levelAssist;
	}
	/** Where the player sees a contact: the smoothed clone for jets, the pivot for ground targets. */
	private readonly boxPosition = (model: Model, ground: boolean): Vector3 => ground ? model.GetPivot().Position : this.enemies.GetFrame(model).Position;
	private updateTargetCue(camera: Camera): void {
		const target = this.telemetry.target;
		const bracket = this.bracket!;
		const arrow = this.arrow!;
		if (target === undefined || target.Parent === undefined) { bracket.Visible = false; arrow.Visible = false; return; }
		// Track the smoothed clone the player actually sees, not the hidden replicated model.
		const ground = this.telemetry.targetKind === "ground";
		const worldPosition = ground ? target.GetPivot().Position : this.enemies.GetFrame(target).Position;
		if(this.telemetry.jamVisualRange!==undefined && worldPosition.sub(camera.CFrame.Position).Magnitude>this.telemetry.jamVisualRange) { bracket.Visible=false; arrow.Visible=false; return; }
		const [screen, visible] = camera.WorldToViewportPoint(worldPosition);
		const size = camera.ViewportSize;
		const required = this.telemetry.targetRequired === true;
		const lockProgress = this.telemetry.lockProgress;
		// Protected (no damage now) wins over a completed lock: grey, blinking, TRACK, never red or LOCKED.
		const style = TargetBoxes.Selected(this.telemetry.targetDamageable, required, lockProgress);
		const locked = style.locked;
		const range = worldPosition.sub(this.visualFrame.Position).Magnitude;
		// Same size rule as every other box (a touch tighter once locked), kept readable when far.
		const boxSize = locked ? math.max(math.floor(TargetBoxes.Size(range, size.Y, true) * 0.85), TARGET_BOX_SELECTED_MIN) : TargetBoxes.Size(range, size.Y, true);
		// Drawn anywhere it fits in the safe area clear of the touch controls; otherwise the edge arrow points to it.
		const bounds = this.boxes.GetBounds(), keepouts = this.boxes.GetKeepouts();
		const inside = visible && bounds !== undefined && TargetBoxes.Fits(screen.X, screen.Y, boxSize, bounds, keepouts);
		bracket.Visible = inside;
		this.boxes.SetSelectedBox(target, screen.X, screen.Y, boxSize, inside);
		arrow.Visible = !inside;
		const color = CUE_COLOR[style.tone];
		if (color !== this.cueColor) {
			this.cueColor = color;
			this.bracketStroke!.Color = color;
			this.caption!.TextColor3 = color;
			arrow.TextColor3 = color;
		}
		// The selected box blinks (stroke only; the caption stays readable); a locked box holds steady red.
		const blink = locked || TargetBoxes.BlinkOn(os.clock());
		if (blink !== this.cueBlink) { this.cueBlink = blink; this.bracketStroke!.Transparency = blink ? 0 : BLINK_OFF; }
		if (inside) {
			bracket.Position = viewportPosition(this.targetGui!, screen.X, screen.Y);
			if (boxSize !== this.cueSize) { this.cueSize = boxSize; bracket.Size = UDim2.fromOffset(boxSize, boxSize); }
			// The caption goes under the box, over it, or slides in from an edge; where none of those clears the
			// safe area and the touch controls it is dropped (the box colour still tells the lock state).
			const caption = this.caption!;
			const spot = this.captionSpot;
			const placed = TargetBoxes.PlaceCaption(screen.X, screen.Y, boxSize, bounds!, keepouts, spot);
			if (caption.Visible !== placed) caption.Visible = placed;
			if (placed && (spot.above !== this.cueAbove || spot.dx !== this.cueDx)) {
				this.cueAbove = spot.above; this.cueDx = spot.dx;
				caption.AnchorPoint = spot.above ? new Vector2(0.5, 1) : new Vector2(0.5, 0);
				caption.Position = spot.above ? new UDim2(0.5, spot.dx, 0, -TARGET_CAPTION_GAP) : new UDim2(0.5, spot.dx, 1, TARGET_CAPTION_GAP);
			}
			const distance = math.floor(range);
			// Whole lock percent while locking (0 otherwise).
			const lock = style.caption === "locking" ? math.floor(lockProgress * 100) : 0;
			// Damaged targets (staged aces above all) show remaining health after the lock state.
			const health = this.telemetry.targetHealth;
			const healthPercent = health !== undefined && health < 0.995 ? math.floor(health * 100 + 0.5) : -1;
			// Rebuild the caption only when a visible value changed (not every frame).
			if (distance !== this.cueRange || lock !== this.cueLock || style.caption !== this.cueCaption || required !== this.cueRequired || healthPercent !== this.cueHealth) {
				this.cueRange = distance; this.cueLock = lock; this.cueCaption = style.caption; this.cueRequired = required; this.cueHealth = healthPercent;
				caption.Text = TargetBoxes.CaptionText(style, lockProgress, distance, required, healthPercent);
			}
		} else {
			const [safeX, safeY] = safeInsets(size);
			const [x, y, rotation] = edgePoint(camera, worldPosition, math.max(1, size.X / 2 - safeX), math.max(1, size.Y / 2 - safeY), TARGET_ARROW_INSET);
			arrow.Position = viewportPosition(this.targetGui!, x, y);
			arrow.Rotation = rotation;
			const text = contactGlyph(ground, required);
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
			const [safeX, safeY] = safeInsets(size);
			const halfX = math.max(1, size.X / 2 - safeX);
			const halfY = math.max(1, size.Y / 2 - safeY);
			for (const child of folder.GetChildren()) {
				if (used >= MARKER_LIMIT) break;
				if (!child.IsA("Model") || child === this.telemetry.target || child.GetAttribute("SkybreakEnemy") !== true) continue;
				const ground = child.GetAttribute("TargetKind") === "ground";
				const worldPosition = ground ? child.GetPivot().Position : this.enemies.GetFrame(child).Position;
				if(this.telemetry.jamVisualRange!==undefined && worldPosition.sub(camera.CFrame.Position).Magnitude>this.telemetry.jamVisualRange) continue;
		const [screen, visible] = camera.WorldToViewportPoint(worldPosition);
				// A boxed contact already reads as a target (only on-screen contacts are boxed); a glyph or arrow would only stack on it.
				if (this.boxes.IsBoxed(child)) continue;
				const inside = visible && screen.X >= safeX && screen.X <= size.X - safeX && screen.Y >= safeY && screen.Y <= size.Y - safeY;
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
				const required = child.GetAttribute("RequiredTarget") === true;
				const text = inside ? contactGlyph(ground, required) : (ground ? "◆" : "▲");
				if (inside) {
					label.Position = viewportPosition(gui, screen.X, screen.Y);
					label.Rotation = 0;
					label.TextSize = 16;
				} else {
					const [x, y, rotation] = edgePoint(camera, worldPosition, halfX, halfY, MARKER_ARROW_INSET);
					label.Position = viewportPosition(gui, x, y);
					label.Rotation = rotation;
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
		this.audio.Step(dt, this.frameInput.throttle, speed, this.visualFrame.Position, this.GetBoundaryWarning(), this.FlightWarningsEnabled());
	}
	private render(dt: number): void {
		const camera = Workspace.CurrentCamera;
		const predictor = this.predictor;
		if (!this.active || !camera || !predictor) return;
		const downAt = this.downAt;
		if (downAt) {
			const impact = CameraShake.Step(dt);
			this.cameraFrame = this.cameraFrame.Lerp(CFrame.lookAt(this.cameraFrame.Position, downAt), FlightMath.DampAlpha(6, dt));
			camera.CFrame = this.cameraFrame.mul(impact.offset);
			this.enemies.Step(dt);
			return;
		}
		this.retryPauseRequest(os.clock());
		if (this.paused) {
			// Hold the last frame: no prediction, no input, no camera follow.
			camera.CameraType = Enum.CameraType.Scriptable;
			camera.CFrame = this.cameraFrame;
			return;
		}
		if (this.cutIn) {
			// The server holds the sortie: no prediction or input; the camera films the local flypast.
			camera.CameraType = Enum.CameraType.Scriptable;
			camera.CFrame = this.cutIn.Step(dt);
			return;
		}
		const now = os.clock();
		const intro = this.launchIntro !== undefined;
		if (!intro && !this.landing && !this.rearm) this.input(dt);
		const input = this.frameInput;
		// Fly the local jet with zero input latency; the server reconciles it at 20 Hz.
		// The next fixed step (the first to use this frame's input) starts at the last step boundary.
		const stamp = FlightPrediction.InputStamp(predictor, now);
		if (this.landing && !this.paused) this.landing.elapsed+=dt;
		if(this.rearm && !this.paused && !this.rearm.menu) this.rearm.elapsed+=dt;
		const state = this.rearm ? rearmPose(this.rearm.plan,this.rearm.elapsed) : this.landing ? landingPose(this.landing.plan,this.landing.elapsed) : intro ? predictor.state : FlightPrediction.Step(predictor, input, dt, now);
		if (intro) LaunchStage.Advance(this.launchIntro!, state, dt);
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
		this.probeClock += dt;
		if (this.probeClock >= PROBE_INTERVAL) { this.probeClock = 0; this.probe(state, position, now); }
		// The chase camera ignores the evade roll and the turn lean so the horizon does not
		// spin with them, but rolls with the canopy (smoothed) so it rides through loops and
		// inverted flight instead of flipping at the vertical.
		const [fx, fy, fz] = FlightMath.ForwardOf(state);
		const forward = new Vector3(fx, fy, fz);
		const [ux, uy, uz] = FlightMath.UpOf(state);
		const up = this.cameraUp.Lerp(new Vector3(ux, uy, uz), FlightMath.DampAlpha(CAMERA_ROLL_RATE, dt));
		// Keep the smoothed up perpendicular to the nose (never parallel to the look direction).
		const square = up.sub(forward.mul(up.Dot(forward)));
		this.cameraUp = square.Magnitude > 0.05 ? square.Unit : new Vector3(ux, uy, uz);
		const speedFactor = math.clamp((state.speed - FlightMath.CruiseSpeed) / (FlightMath.MaxSpeed - FlightMath.CruiseSpeed), 0, 1);
		const desiredPosition = position.sub(forward.mul(68 + speedFactor * 13)).add(this.cameraUp.mul(CAMERA_LIFT_STUDS));
		const chase = CFrame.lookAt(desiredPosition, position.add(forward.mul(100)).add(this.cameraUp.mul(AIM_LIFT_STUDS)), this.cameraUp);
		const launch = launchCameraFor(state);
		this.launchCameraTime = intro ? 0 : math.min(CAMERA_HANDOFF_SECONDS, this.launchCameraTime + dt);
		const handoff = this.launchCameraTime / CAMERA_HANDOFF_SECONDS;
		const eased = handoff * handoff * (3 - 2 * handoff);
		const desired = (this.landing || this.rearm) ? CFrame.lookAt(position.add(new Vector3(0,5,0)),position.add(forward.mul(100))) : intro ? launch : launch.Lerp(chase, eased);
		// Impact feel (CameraShake) rides on top of the follow: shake is a camera-space
		// offset and the ace hit-stop slows the follow and punches the FOV. Visual only.
		const impact = CameraShake.Step(dt);
		const cinematic=this.landing ?? this.rearm;
		if (cinematic && !cinematic.cameraCut) {
			this.cameraFrame = desired;
			cinematic.cameraCut = true;
		} else this.cameraFrame = this.cameraFrame.Lerp(desired, FlightMath.DampAlpha(8 * impact.follow, dt));
		camera.CameraType = Enum.CameraType.Scriptable;
		camera.CFrame = this.cameraFrame.mul(impact.offset);
		camera.Focus = new CFrame(position.add(forward.mul(90)));
		const baseFov = camera.FieldOfView - this.fovKick;
		this.fovKick = impact.fov;
		camera.FieldOfView = baseFov + (72 + speedFactor * 9 - baseFov) * FlightMath.DampAlpha(3, dt) + impact.fov;
		this.enemies.Step(dt);
		this.updateKeepouts(camera.ViewportSize);
		const target = this.telemetry.target;
		this.boxes.Update(camera, position, target !== undefined && target.Parent !== undefined ? target : undefined, this.boxPosition, this.telemetry.jamVisualRange);
		this.updateTargetCue(camera);
		this.updateMarkers(camera);
		if (intro) return;
		this.sendTime += dt;
		// Unreliable input: up to 20 Hz while the controls move, 10 Hz keepalive otherwise
		// (well inside the server's 0.7 s silence timeout even with packet loss).
		const changed = math.abs(this.sentX - input.x) > 0.01 || math.abs(this.sentY - input.y) > 0.01 || math.abs(this.sentThrottle - input.throttle) > 0.0001 || this.sentAssist !== input.assist;
		if ((changed && this.sendTime >= INPUT_INTERVAL) || this.sendTime >= INPUT_KEEPALIVE) {
			this.sendTime = 0;
			this.sentX = input.x; this.sentY = input.y; this.sentThrottle = input.throttle; this.sentAssist = input.assist;
			const packet: FlightInputPacket = { x: input.x, y: input.y, throttle: input.throttle, t: stamp, assist: input.assist === true };
			this.remotes.FlightInput.FireServer(packet);
		}
	}
	public Start(missionData: MissionStarted): boolean {
		this.Stop();
		if (!typeIs(missionData, "table") || !isModel(missionData.aircraft)) { warn("SKYBREAK flight start is missing its replicated aircraft"); return false; }
		this.aircraft = missionData.aircraft;
		this.active = true;
		activeController = this;
		this.telemetry = initialTelemetry(missionData.missionId);
		this.telemetrySequence = -1;
		this.keys.clear();
		this.touchInput = Vector2.zero;
		this.gamepadInput = Vector2.zero; this.throttleStick = 0; this.touchThrottleAxis = 0;
		this.sendTime = INPUT_KEEPALIVE;
		this.sentThrottle = -1;
		this.mouseSteer = false;
		this.evadeRoll = 0;
		this.evadeStartedAt = -math.huge;
		this.paused = false;
		// Each sortie's server session counts pause serials from 0.
		this.pauseSerial = 0; this.pauseAction = undefined;
		this.probeClock = 0; this.probeParams = undefined; this.probeDirty = true; this.probeBuiltAt = -math.huge;
		this.trendSpeed = undefined; this.trend.acceleration = 0; this.trend.terrainSeconds = undefined;
		this.cueColor = undefined; this.cueRange = -1; this.cueLock = -1; this.cueCaption = undefined; this.cueRequired = undefined; this.cueHealth = -1; this.cueSize = -1; this.cueBlink = undefined; this.cueAbove = undefined; this.cueDx = 0; this.arrowText = "";
		this.visualFrame = this.aircraft.GetPivot();
		// The server holds the jet still until "Started", so its pivot is the exact initial state;
		// the first FlightState packet corrects speed and anything else within 50 ms.
		this.launchIntro = missionData.launchIntro === true ? { elapsed: 0 } : undefined;
		this.launchCameraTime = this.launchIntro === undefined ? CAMERA_HANDOFF_SECONDS : 0;
		this.predictor = FlightPrediction.New(missionData.initialState ?? stateFrom(this.visualFrame), missionData.airspace);
		const camera = Workspace.CurrentCamera;
		if (camera) {
			if (this.launchIntro !== undefined) this.visualFrame = frameFor(this.predictor.state);
			this.previousCamera = { type: camera.CameraType, subject: camera.CameraSubject, frame: camera.CFrame, fov: camera.FieldOfView };
			this.cameraUp = this.visualFrame.UpVector;
			this.cameraFrame = CFrame.lookAt(this.visualFrame.Position.sub(this.visualFrame.LookVector.mul(75)).add(this.cameraUp.mul(CAMERA_LIFT_STUDS)), this.visualFrame.Position.add(this.visualFrame.LookVector.mul(100)), this.cameraUp);
			if (this.launchIntro !== undefined) this.cameraFrame = launchCameraFor(this.predictor.state);
		} else this.cameraFrame = this.visualFrame;
		// The predicted local visual; the replicated server aircraft stays hidden.
		this.visual = this.aircraft.Clone();
		this.visual.Name = "SkybreakLocalFlightVisual";
		for (const descendant of this.visual.GetDescendants()) if (JetFactory.IsCosmetic(descendant)) JetFactory.ShowCosmetic(descendant);
		this.visual.Parent = Workspace;
		this.visualRoot = this.visual.PrimaryPart;
		this.engine = JetFactory.FindEngine(this.visual);
		this.throttle = FlightMath.CruiseThrottle;
		this.engineSpool = EngineFx.Intensity(this.throttle);
		const hidePart = (descendant: Instance) => {
			if (descendant.IsA("BasePart")) { this.hiddenParts.set(descendant, descendant.LocalTransparencyModifier); descendant.LocalTransparencyModifier = 1; }
			else if (JetFactory.IsCosmetic(descendant)) { this.hiddenParts.set(descendant, descendant.Enabled); descendant.Enabled = false; }
		};
		for (const descendant of this.aircraft.GetDescendants()) hidePart(descendant);
		this.connections.push(this.aircraft.DescendantAdded.Connect(hidePart));
		if (this.aircraft.Parent) {
			this.enemies.Start(this.aircraft.Parent); this.missiles.Start(this.aircraft.Parent);
			// Phase changes add ground targets and protected actors; rebuild the probe's include list (throttled).
			this.connections.push(this.aircraft.Parent.DescendantAdded.Connect((item) => { if (item.IsA("BasePart") && item.GetAttribute("FlightSolid") === true) this.probeDirty = true; }));
		}
		this.audio.Start(this.aircraft);
		[this.targetGui, this.bracket, this.bracketStroke, this.caption, this.arrow] = createTargetCue(Players.LocalPlayer.WaitForChild("PlayerGui"));
		if (this.aircraft.Parent) this.boxes.Start(this.aircraft.Parent, this.targetGui, Players.LocalPlayer.UserId);
		this.keepoutDirty = true; this.keepoutOrigin = undefined; this.keepoutViewport = undefined;
		this.bindControls();
		this.connections.push(UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || UserInputService.GetFocusedTextBox()) return;
			if (input.UserInputType === Enum.UserInputType.MouseButton1 && !this.paused) this.FireMissile();
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
		// Fireball diameter in studs -> shake scale (an air kill's 26-stud fireball is 1).
		this.stopExplosions = CombatEffects.OnExplosion((position, size, kind) => {
			if (!this.active) return;
			if (kind === "player") {
				this.downAt = position;
				this.visual?.Destroy(); this.visual = undefined; this.visualRoot = undefined; this.engine = undefined;
				CameraShake.Add(0.8);
			} else CameraShake.Explosion(position, size / 26);
		});
		return true;
	}
	public Stop(): void {
		this.audio.Stop();
		this.active = false;
		this.landing = undefined; this.rearm=undefined;
		this.cutIn?.Stop(); this.cutIn=undefined;
		this.launchIntro = undefined;
		this.launchCameraTime = CAMERA_HANDOFF_SECONDS;
		this.paused = false;
		// Each sortie's server session counts pause serials from 0.
		this.pauseSerial = 0; this.pauseAction = undefined;
		this.probeParams = undefined;
		this.trend.terrainSeconds = undefined;
		this.downAt = undefined;
		this.stopExplosions?.(); this.stopExplosions = undefined;
		RunService.UnbindFromRenderStep(this.renderName);
		ContextActionService.UnbindAction(this.actionName);
		ContextActionService.UnbindAction(`${this.actionName}_RearmMenu`);
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
		this.boxes.Stop();
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
		this.audio.Destroy();
		for (const connection of this.streamConnections) connection.Disconnect();
		this.streamConnections.clear();
		this.listeners.clear();
		if (activeController === this) activeController = undefined;
	}
}
