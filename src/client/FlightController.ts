import { ContextActionService, GuiService, Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { FlightMath } from "../shared/FlightMath";
import { MissionStarted, Remotes, Telemetry } from "../shared/Types";

let activeController: FlightController | undefined;
let controllerSerial = 0;
const DEFAULTS: Telemetry = {
	kind: "Telemetry", health: 100, speed: 0, altitude: 250, kills: 0, total: 3, missiles: 8,
	missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false,
	elapsed: 0, targetDistance: 0, boundaryWarning: false,
};
const FLIGHT_KEYS: Enum.KeyCode[] = [
	Enum.KeyCode.W, Enum.KeyCode.S, Enum.KeyCode.A, Enum.KeyCode.D,
	Enum.KeyCode.Up, Enum.KeyCode.Down, Enum.KeyCode.Left, Enum.KeyCode.Right,
	Enum.KeyCode.Q, Enum.KeyCode.E, Enum.KeyCode.LeftShift, Enum.KeyCode.ButtonL1, Enum.KeyCode.ButtonR1,
	Enum.KeyCode.Space, Enum.KeyCode.F, Enum.KeyCode.Tab, Enum.KeyCode.R,
	Enum.KeyCode.ButtonR2, Enum.KeyCode.ButtonB, Enum.KeyCode.ButtonY, Enum.KeyCode.Thumbstick1,
];
function remote<K extends keyof Remotes>(remotes: Remotes | Instance, name: K): Remotes[K] {
	if (typeIs(remotes, "Instance")) return remotes.WaitForChild(name) as Remotes[K];
	assert(remotes[name], `Missing flight remote: ${name}`);
	return remotes[name];
}
function isModel(value: unknown): value is Model {
	return typeIs(value, "Instance") && value.IsA("Model") && value.Parent !== undefined;
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
	caption.Position = new UDim2(0.5, 0, 1, 6);
	caption.AnchorPoint = new Vector2(0.5, 0);
	caption.Size = UDim2.fromOffset(160, 18);
	caption.Font = Enum.Font.GothamBold;
	caption.TextSize = 11;
	caption.RichText = true;
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
// QA and phone UI use this same controller; all combat decisions stay on server.
export class FlightController {
	public active = false;
	public aircraft?: Model;
	private readonly remotes: Pick<Remotes, "FlightInput" | "CombatAction" | "MissionState">;
	private telemetry: Telemetry = { ...DEFAULTS };
	private touchInput = Vector2.zero;
	private gamepadInput = Vector2.zero;
	private throttle = 0.65;
	private keys = new Set<Enum.KeyCode>();
	private connections: RBXScriptConnection[] = [];
	private hiddenParts = new Map<BasePart | Trail, number | boolean>();
	private readonly actionName: string;
	private readonly renderName: string;
	private readonly telemetryConnection: RBXScriptConnection;
	private mouseSteer = false;
	private visualFrame = new CFrame();
	private cameraFrame = new CFrame();
	private visual?: Model;
	private previousCamera?: PreviousCamera;
	private targetGui?: ScreenGui;
	private bracket?: Frame;
	private bracketStroke?: UIStroke;
	private caption?: TextLabel;
	private arrow?: TextLabel;
	private sendTime = 0;
	public static GetActive(): FlightController | undefined { return activeController; }
	public constructor(remotes: Remotes | Instance) {
		controllerSerial += 1;
		this.remotes = { FlightInput: remote(remotes, "FlightInput"), CombatAction: remote(remotes, "CombatAction"), MissionState: remote(remotes, "MissionState") };
		this.actionName = `SkybreakFlight_${controllerSerial}`;
		this.renderName = `SkybreakCamera_${controllerSerial}`;
		this.telemetryConnection = this.remotes.MissionState.OnClientEvent.Connect((data: unknown) => {
			if (!typeIs(data, "table")) return;
			const message = data as Partial<Omit<Telemetry, "kind">> & { kind?: string };
			if (message.kind === "Telemetry" && this.active) {
				for (const [key, defaultValue] of pairs(DEFAULTS)) {
					if (typeOf(message[key]) === typeOf(defaultValue)) {
						// Defaults define the allowed primitive telemetry fields.
						(this.telemetry as unknown as Record<string, unknown>)[key] = message[key];
					}
				}
				this.telemetry.target = isModel(message.target) ? message.target : undefined;
			} else if (message.kind === "Completed" || message.kind === "Failed") this.Stop();
		});
		activeController = this;
	}
	private handleBoundInput(state: Enum.UserInputState, keyCode: Enum.KeyCode, position: Vector3): Enum.ContextActionResult {
		if (!this.active || UserInputService.GetFocusedTextBox()) return Enum.ContextActionResult.Pass;
		if (keyCode === Enum.KeyCode.Thumbstick1) {
			const value = new Vector2(position.X, position.Y);
			this.gamepadInput = state !== Enum.UserInputState.End && state !== Enum.UserInputState.Cancel && value.Magnitude >= 0.12 ? value : Vector2.zero;
		} else {
			if (state === Enum.UserInputState.Begin || state === Enum.UserInputState.Change) this.keys.add(keyCode);
			else this.keys.delete(keyCode);
			if (state === Enum.UserInputState.Begin) {
				if (keyCode === Enum.KeyCode.Space || keyCode === Enum.KeyCode.ButtonR2) this.FireMissile();
				if (keyCode === Enum.KeyCode.F || keyCode === Enum.KeyCode.ButtonB) this.Evade();
				if (keyCode === Enum.KeyCode.Tab || keyCode === Enum.KeyCode.R || keyCode === Enum.KeyCode.ButtonY) this.CycleTarget();
			}
		}
		return Enum.ContextActionResult.Sink;
	}
	/** Studio QA uses the same handler as ContextActionService, below engine/device routing. */
	public SimulateGamepadInput(keyCode: Enum.KeyCode, state: Enum.UserInputState, position = Vector3.zero): void {
		assert(RunService.IsStudio(), "Controller simulation is Studio-only");
		assert(FLIGHT_KEYS.includes(keyCode) && (keyCode.Name.sub(1, 6) === "Button" || keyCode === Enum.KeyCode.Thumbstick1), "Unsupported bound gamepad control");
		assert(FlightMath.IsFinite(position.X) && FlightMath.IsFinite(position.Y) && FlightMath.IsFinite(position.Z), "Input must be finite");
		this.handleBoundInput(state, keyCode, new Vector3(math.clamp(position.X, -1, 1), math.clamp(position.Y, -1, 1), math.clamp(position.Z, -1, 1)));
	}
	public GetControlStateForStudio() {
		assert(RunService.IsStudio(), "Controller diagnostics are Studio-only");
		return { throttle: this.throttle, stick: this.gamepadInput };
	}
	public SetInput(x: number, y: number): void { this.touchInput = new Vector2(FlightMath.ClampInput(x), FlightMath.ClampInput(y)); }
	public SetThrottle(value: number): void { if (FlightMath.IsFinite(value)) this.throttle = math.clamp(value, 0, 1); }
	private action(action: string): void { if (this.active) this.remotes.CombatAction.FireServer({ action }); }
	public FireMissile(): void { this.action("FireMissile"); }
	public Evade(): void { this.action("Evade"); }
	public CycleTarget(): void { this.action("CycleTarget"); }
	public GetTelemetry(): Telemetry {
		const result = { ...this.telemetry };
		if (isModel(this.aircraft)) {
			const position = this.aircraft.GetPivot().Position;
			result.boundaryWarning = math.max(math.abs(position.X), math.abs(position.Z)) > 2300 || position.Y < 165 || position.Y > 980;
			if (isModel(result.target)) result.targetDistance = result.target.GetPivot().Position.sub(position).Magnitude;
			else { result.target = undefined; result.targetDistance = 0; }
		}
		return result;
	}
	private input(dt: number): LuaTuple<[number, number, number]> {
		let x = this.touchInput.X + this.gamepadInput.X;
		let y = this.touchInput.Y + this.gamepadInput.Y;
		if (!UserInputService.GetFocusedTextBox()) {
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
		return $tuple(math.clamp(x, -1, 1), math.clamp(y, -1, 1), this.keys.has(Enum.KeyCode.LeftShift) ? 1 : this.throttle);
	}
	private updateTargetCue(camera: Camera): void {
		const target = this.telemetry.target;
		const bracket = this.bracket!;
		const arrow = this.arrow!;
		if (!isModel(target)) { bracket.Visible = false; arrow.Visible = false; return; }
		const worldPosition = target.GetPivot().Position;
		const [screen, visible] = camera.WorldToViewportPoint(worldPosition);
		const size = camera.ViewportSize;
		const safeX = math.min(90, size.X * 0.16);
		const safeY = math.min(150, size.Y * 0.24);
		const inside = visible && screen.X >= safeX && screen.X <= size.X - safeX && screen.Y >= safeY && screen.Y <= size.Y - safeY;
		bracket.Visible = inside;
		arrow.Visible = !inside;
		const locked = this.telemetry.lockProgress >= 0.99;
		const color = locked ? Color3.fromRGB(255, 193, 98) : Color3.fromRGB(103, 235, 248);
		this.bracketStroke!.Color = color;
		this.caption!.TextColor3 = color;
		if (inside) {
			bracket.Position = UDim2.fromOffset(screen.X, screen.Y);
			const distance = worldPosition.sub(this.visualFrame.Position).Magnitude;
			const range = string.format('<font transparency="0.35">%d m</font>', math.floor(distance));
			const lock = this.telemetry.lockProgress;
			this.caption!.Text = locked ? `LOCKED  ${range}` : lock > 0.01 ? string.format("LOCK %d%%  %s", math.floor(lock * 100), range) : range;
			const width = locked ? 52 : 64;
			bracket.Size = UDim2.fromOffset(width, width);
		} else {
			const localPosition = camera.CFrame.PointToObjectSpace(worldPosition);
			let direction = new Vector2(localPosition.X, -localPosition.Y);
			if (direction.Magnitude < 0.01) direction = new Vector2(localPosition.Z > 0 ? 1 : 0, localPosition.Z > 0 ? 0 : -1);
			direction = direction.Unit;
			const halfX = math.max(1, size.X / 2 - safeX);
			const halfY = math.max(1, size.Y / 2 - safeY);
			const extent = 1 / math.max(math.abs(direction.X) / halfX, math.abs(direction.Y) / halfY);
			const point = size.div(2).add(direction.mul(extent));
			arrow.Position = UDim2.fromOffset(point.X, point.Y);
			arrow.Rotation = math.deg(math.atan2(direction.Y, direction.X)) + 90;
			arrow.TextColor3 = color;
		}
	}
	private render(dt: number): void {
		const camera = Workspace.CurrentCamera;
		if (!this.active || !camera || !isModel(this.aircraft)) return;
		this.visualFrame = this.visualFrame.Lerp(this.aircraft.GetPivot(), FlightMath.DampAlpha(19, dt));
		if (this.visual?.Parent) this.visual.PivotTo(this.visualFrame);
		const position = this.visualFrame.Position;
		const forward = this.visualFrame.LookVector;
		const speedFactor = math.clamp((this.telemetry.speed - 165) / 155, 0, 1);
		const desiredPosition = position.sub(forward.mul(68 + speedFactor * 13)).add(new Vector3(0, 20, 0));
		const desired = CFrame.lookAt(desiredPosition, position.add(forward.mul(100)).add(new Vector3(0, 4, 0)), Vector3.yAxis);
		this.cameraFrame = this.cameraFrame.Lerp(desired, FlightMath.DampAlpha(8, dt));
		camera.CameraType = Enum.CameraType.Scriptable;
		camera.CFrame = this.cameraFrame;
		camera.Focus = new CFrame(position.add(forward.mul(90)));
		camera.FieldOfView += (72 + speedFactor * 9 - camera.FieldOfView) * FlightMath.DampAlpha(3, dt);
		this.updateTargetCue(camera);
		this.sendTime += dt;
		const [x, y, throttle] = this.input(dt);
		if (this.sendTime >= 1 / 15) { this.sendTime %= 1 / 15; this.remotes.FlightInput.FireServer({ x, y, throttle }); }
	}
	public Start(missionData: MissionStarted): boolean {
		this.Stop();
		if (!typeIs(missionData, "table") || !isModel(missionData.aircraft)) { warn("SKYBREAK flight start is missing its replicated aircraft"); return false; }
		this.aircraft = missionData.aircraft;
		this.active = true;
		activeController = this;
		this.telemetry = { ...DEFAULTS };
		this.keys.clear();
		this.touchInput = Vector2.zero;
		this.gamepadInput = Vector2.zero;
		this.throttle = 0.65;
		this.sendTime = 1 / 15;
		this.mouseSteer = false;
		this.visualFrame = this.aircraft.GetPivot();
		const camera = Workspace.CurrentCamera;
		if (camera) {
			this.previousCamera = { type: camera.CameraType, subject: camera.CameraSubject, frame: camera.CFrame, fov: camera.FieldOfView };
			this.cameraFrame = CFrame.lookAt(this.visualFrame.Position.sub(this.visualFrame.LookVector.mul(75)).add(new Vector3(0, 20, 0)), this.visualFrame.Position.add(this.visualFrame.LookVector.mul(100)));
		} else this.cameraFrame = this.visualFrame;
		// Smooth local visual follows anchored server aircraft.
		this.visual = this.aircraft.Clone();
		this.visual.Name = "SkybreakLocalFlightVisual";
		this.visual.Parent = Workspace;
		for (const descendant of this.visual.GetDescendants()) if (descendant.IsA("Trail")) descendant.Clear();
		const hidePart = (descendant: Instance) => {
			if (descendant.IsA("BasePart")) { this.hiddenParts.set(descendant, descendant.LocalTransparencyModifier); descendant.LocalTransparencyModifier = 1; }
			else if (descendant.IsA("Trail")) { this.hiddenParts.set(descendant, descendant.Enabled); descendant.Enabled = false; }
		};
		for (const descendant of this.aircraft.GetDescendants()) hidePart(descendant);
		this.connections.push(this.aircraft.DescendantAdded.Connect(hidePart));
		[this.targetGui, this.bracket, this.bracketStroke, this.caption, this.arrow] = createTargetCue(Players.LocalPlayer.WaitForChild("PlayerGui"));
		ContextActionService.BindActionAtPriority(this.actionName, (_, state, input) => this.handleBoundInput(state, input.KeyCode, input.Position), false, 3000, ...FLIGHT_KEYS);
		this.connections.push(UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || UserInputService.GetFocusedTextBox()) return;
			if (input.UserInputType === Enum.UserInputType.MouseButton1) this.FireMissile();
			if (input.UserInputType === Enum.UserInputType.MouseButton2) this.mouseSteer = true;
		}));
		this.connections.push(UserInputService.InputEnded.Connect((input) => { if (input.UserInputType === Enum.UserInputType.MouseButton2) this.mouseSteer = false; }));
		this.connections.push(UserInputService.WindowFocusReleased.Connect(() => {
			this.keys.clear(); this.mouseSteer = false; this.touchInput = Vector2.zero; this.gamepadInput = Vector2.zero;
		}));
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
			if (part.IsA("Trail")) part.Enabled = previous as boolean;
		}
		this.hiddenParts.clear();
		this.visual?.Destroy(); this.visual = undefined;
		this.targetGui?.Destroy(); this.targetGui = undefined;
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
		this.gamepadInput = Vector2.zero;
		this.keys.clear();
		this.mouseSteer = false;
	}
	public Destroy(): void {
		this.Stop();
		this.telemetryConnection.Disconnect();
		if (activeController === this) activeController = undefined;
	}
}
