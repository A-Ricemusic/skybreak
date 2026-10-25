import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { GuiService, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";

import type {
	CampaignResponse,
	MissionFinished,
	MissionLoading,
	MissionMessage,
	MissionStarted,
	Persistence,
	Remotes,
	SaveSlot,
	Telemetry,
} from "../shared/Types";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import { MENU_JET_POSITION } from "../shared/MenuWorldGeometry";
import { MissionScore, type MissionRank } from "../shared/MissionScore";
import { WeaponRules } from "../shared/WeaponRules";
import { SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";
import { LoadoutPicker } from "./LoadoutPicker";
import { NavigationCue } from "./NavigationCue";
import { RelayCinematic } from "./RelayCinematic";
import { FlightController } from "./FlightController";
import { LoadingScreen } from "./LoadingScreen";
import { preloadMission } from "./MissionPreload";
import {
	getSlotListHeight,
	getEvadeHint,
	getSpecialHint,
	getFlightHints,
	getHudLayout,
	getMenuHintsLayout,
	getMenuLayout,
	getToastLayout,
	getTutorialInstruction,
	inputModeFromInputType,
	MAX_FLIGHT_HINTS,
	MIN_TOUCH_TARGET,
	inputModeFromPreferred,
	shouldAcceptInputModeChange,
	type ControlHint,
	type InputMode,
	type MenuLayout,
	type Rectangle,
} from "../shared/UILayout";

const C = {
	Ink: Color3.fromRGB(6, 13, 22),
	Panel: Color3.fromRGB(14, 30, 44),
	PanelHot: Color3.fromRGB(26, 54, 72),
	Ivory: Color3.fromRGB(242, 238, 226),
	Muted: Color3.fromRGB(152, 168, 176),
	Faint: Color3.fromRGB(104, 122, 132),
	Accent: Color3.fromRGB(64, 224, 206),
	AccentHot: Color3.fromRGB(128, 242, 228),
	Orange: Color3.fromRGB(255, 150, 84),
	Danger: Color3.fromRGB(255, 84, 76),
};

// Frames the DisplayJet that WorldBuilder parks on the east apron.
const MENU_JET = MENU_JET_POSITION.add(new Vector3(0, 2, 0));
const MENU_EYE_OFFSET = new Vector3(-17, 9, 54);
const SLOT_NUMBERS = [1, 2, 3, 4];
const MENU_SCREEN_FRAMES = { title: "TitleScreen", slots: "CampaignScreen", briefing: "BriefingScreen", outcome: "OutcomeScreen", cinematic: "CinematicScreen" };

type Screen = "title" | "slots" | "briefing" | "loading" | "mission" | "outcome" | "cinematic";
// The loading overlay is opaque; the camera simply holds its last frame underneath it.
const NO_MENU_CAMERA: ReadonlySet<Screen> = new Set<Screen>(["mission", "cinematic", "loading"]);
// If "Started" never follows "Loading" (server holds for at most ~8 s), fall back to the briefing.
const LOADING_CLIENT_TIMEOUT = 20;

interface ToastState {
	message: string;
	isError: boolean;
}

interface OutcomeState {
	won: boolean;
	missionId: number;
	airKills: number;
	optionalKills: number;
	groundKills: number;
	elapsed: number;
	par: number;
	completedPhases: number;
	missilesFired: number;
	missileHits: number;
	damageTaken: number;
	lowestHealth: number;
	evades: number;
	score: number;
	rank: MissionRank;
	newBestScore: boolean;
	newBestRank: boolean;
	bestScore?: number;
	bestRank?: MissionRank;
	reason?: string;
	saveText: string;
	saveColor: Color3;
}

interface KillNotice {
	kills: number;
	total: number;
	until: number;
}

/** Temporarily replaces the one-line objective (radio lines, kills). */
interface Callout {
	text: string;
	color?: Color3;
}

interface RadioNotice {
	text: string;
	until: number;
}
/** Seconds a radio line stays up when the server does not specify. */
const RADIO_SECONDS = 4.5;
/** Seconds a refused FIRE reason stays up. */
const FIRE_DENIED_SECONDS = 1;
const FIRE_DENIED_TEXT: { [reason: string]: string } = {
	no_ammo: "NO MISSILES · RELOADING", cooldown: "LAUNCHER CYCLING", blind: "NO LOCK · FIRING BLIND",
	special_empty: "SPECIAL EXPENDED", special_cooldown: "SPECIAL CYCLING", special_active: "DRONE ALREADY UP", special_no_target: "SPECIAL · NO TARGET IN CONE",
};

interface GameUIProps {
	remotes: Remotes;
	controller: FlightController;
}

const InputModeContext = createContext<InputMode>("keyboard");

const SELECTION_NONE = new Instance("Frame");
SELECTION_NONE.BackgroundTransparency = 1;
SELECTION_NONE.BorderSizePixel = 0;

const glyphCache = new Map<string, string>();

function glyphFor(keyCodeName: string): string {
	const cached = glyphCache.get(keyCodeName);
	if (cached !== undefined) return cached;
	let image = "";
	const keyCode = Enum.KeyCode.GetEnumItems().find((item) => item.Name === keyCodeName);
	if (keyCode) {
		const [ok, result] = pcall(() => UserInputService.GetImageForKeyCode(keyCode));
		if (ok && typeIs(result, "string")) image = result;
	}
	glyphCache.set(keyCodeName, image);
	return image;
}

function readInputMode(): InputMode {
	const [ok, preferred] = pcall(() => UserInputService.PreferredInput);
	if (ok && typeIs(preferred, "EnumItem")) {
		const mode = inputModeFromPreferred(preferred.Name);
		if (mode) return mode;
	}
	const last = inputModeFromInputType(UserInputService.GetLastInputType().Name);
	if (last) return last;
	if (UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled) return "touch";
	if (UserInputService.GamepadEnabled && !UserInputService.KeyboardEnabled) return "gamepad";
	return "keyboard";
}

function useHighlight(enabled: boolean) {
	const mode = useContext(InputModeContext);
	const [hovered, setHovered] = useState(false);
	const [selected, setSelected] = useState(false);
	const events = useMemo(() => ({
		MouseEnter: () => setHovered(true),
		MouseLeave: () => setHovered(false),
		SelectionGained: () => setSelected(true),
		SelectionLost: () => setSelected(false),
	}), []);
	return {
		hot: enabled && ((mode === "keyboard" && hovered) || (mode === "gamepad" && selected)),
		events,
		clearHover: () => setHovered(false),
	};
}

const Corner = ({ radius = 6, scale }: { radius?: number; scale?: number }) => (
	<uicorner CornerRadius={scale !== undefined ? new UDim(scale, 0) : new UDim(0, radius)} />
);

const Stroke = ({
	color = C.Ivory,
	transparency = 0.85,
	thickness = 1,
}: {
	color?: Color3;
	transparency?: number;
	thickness?: number;
}) => <uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={color} Transparency={transparency} Thickness={thickness} />;

interface ActionButtonProps {
	name: string;
	text: string;
	primary?: boolean;
	enabled?: boolean;
	position?: UDim2;
	size?: UDim2;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	textSize?: number;
	onActivated: () => void;
}

function ActionButton({
	name,
	text,
	primary = false,
	enabled = true,
	position,
	size = UDim2.fromOffset(180, 48),
	anchorPoint,
	layoutOrder,
	textSize = 14,
	onActivated,
}: ActionButtonProps) {
	const { hot, events, clearHover } = useHighlight(enabled);
	const background = primary ? (hot ? C.AccentHot : C.Accent) : hot ? C.PanelHot : C.Panel;
	return (
		<textbutton
			key={name}
			Active={enabled}
			AutoButtonColor={false}
			AnchorPoint={anchorPoint}
			Position={position}
			Size={size}
			LayoutOrder={layoutOrder}
			BackgroundColor3={background}
			BackgroundTransparency={enabled ? (primary ? 0 : hot ? 0.05 : 0.22) : 0.6}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			Text={text}
			TextColor3={primary ? C.Ink : C.Ivory}
			TextTransparency={enabled ? 0 : 0.45}
			TextScaled={true}
			SelectionImageObject={SELECTION_NONE}
			Event={{
				...events,
				Activated: () => {
					clearHover();
					if (enabled) onActivated();
				},
			}}
		>
			<Corner />
			<Stroke color={hot ? C.Ivory : primary ? C.Accent : C.Ivory} transparency={hot ? 0.1 : primary ? 0.6 : 0.82} thickness={hot ? 2 : 1} />
			<uipadding PaddingLeft={new UDim(0, 14)} PaddingRight={new UDim(0, 14)} PaddingTop={new UDim(0, 12)} PaddingBottom={new UDim(0, 12)} />
			<uitextsizeconstraint MaxTextSize={textSize} MinTextSize={8} />
		</textbutton>
	);
}

function Label({
	name,
	text,
	position,
	size,
	color = C.Ivory,
	textSize = 14,
	font = Enum.Font.Gotham,
	textXAlignment = Enum.TextXAlignment.Left,
	textYAlignment = Enum.TextYAlignment.Center,
	textWrapped = false,
	richText = false,
	automaticSize,
	anchorPoint,
	layoutOrder,
	visible = true,
	stroke = false,
	zIndex,
	minTextSize,
}: {
	name: string;
	text: string;
	position?: UDim2;
	size: UDim2;
	color?: Color3;
	textSize?: number;
	font?: Enum.Font;
	textXAlignment?: Enum.TextXAlignment;
	textYAlignment?: Enum.TextYAlignment;
	textWrapped?: boolean;
	richText?: boolean;
	automaticSize?: Enum.AutomaticSize;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	visible?: boolean;
	stroke?: boolean;
	zIndex?: number;
	/** Shrinks text down to this size (never above textSize) when it would not fit. */
	minTextSize?: number;
}) {
	return (
		<textlabel
			key={name}
			AnchorPoint={anchorPoint}
			Position={position}
			Size={size}
			AutomaticSize={automaticSize}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			Font={font}
			Text={text}
			RichText={richText}
			TextColor3={color}
			TextSize={textSize}
			TextXAlignment={textXAlignment}
			TextYAlignment={textYAlignment}
			TextWrapped={textWrapped}
			TextStrokeColor3={C.Ink}
			TextStrokeTransparency={stroke ? 0.55 : 1}
			TextScaled={minTextSize !== undefined}
			LayoutOrder={layoutOrder}
			Visible={visible}
			ZIndex={zIndex}
		>
			{minTextSize !== undefined && <uitextsizeconstraint MaxTextSize={textSize} MinTextSize={minTextSize} />}
		</textlabel>
	);
}

function KeyCap({ hint }: { hint: ControlHint }) {
	const glyph = hint.keyCode !== undefined ? glyphFor(hint.keyCode) : "";
	if (glyph !== "") {
		return <imagelabel key="Glyph" BackgroundTransparency={1} Image={glyph} LayoutOrder={1} Size={UDim2.fromOffset(22, 22)} />;
	}
	return (
		<textlabel
			key="Key"
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundColor3={C.Ivory}
			BackgroundTransparency={0.08}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			LayoutOrder={1}
			Size={UDim2.fromOffset(20, 20)}
			Text={hint.label}
			TextColor3={C.Ink}
			TextSize={10}
		>
			<Corner radius={4} />
			<uipadding PaddingLeft={new UDim(0, 6)} PaddingRight={new UDim(0, 6)} />
		</textlabel>
	);
}

function HintChip({ hint, order, color = C.Ivory }: { hint: ControlHint; order: number; color?: Color3 }) {
	return (
		<frame key={`${hint.action}Hint`} AutomaticSize={Enum.AutomaticSize.X} BackgroundTransparency={1} LayoutOrder={order} Size={UDim2.fromOffset(0, 24)}>
			<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} VerticalAlignment={Enum.VerticalAlignment.Center} />
			<KeyCap hint={hint} />
			<Label name="Action" text={hint.action} color={color} textSize={11} font={Enum.Font.GothamBold} size={UDim2.fromOffset(0, 20)} automaticSize={Enum.AutomaticSize.X} layoutOrder={2} stroke={true} />
		</frame>
	);
}

function HintRow({
	name,
	hints,
	rectangle,
	alignment = Enum.HorizontalAlignment.Center,
	visible = true,
}: {
	name: string;
	hints: ControlHint[];
	rectangle: Rectangle;
	alignment?: Enum.HorizontalAlignment;
	visible?: boolean;
}) {
	return (
		<frame
			key={name}
			BackgroundTransparency={1}
			Position={UDim2.fromOffset(rectangle.x, rectangle.y)}
			Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
			Visible={visible && hints.size() > 0}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={alignment}
				Padding={new UDim(0, 14)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				VerticalAlignment={Enum.VerticalAlignment.Bottom}
				Wraps={true}
			/>
			{hints.map((hint, index) => <HintChip key={`${hint.action}Hint`} hint={hint} order={index + 1} />)}
		</frame>
	);
}

function defaultTelemetry(): Telemetry {
	return {
		kind: "Telemetry",
		health: 100,
		speed: 0,
		altitude: 250,
		kills: 0,
		total: 3,
		missiles: 8,
		missileCooldown: 0,
		evadeCooldown: 0,
		targetName: "",
		lockProgress: 0,
		incoming: false,
		elapsed: 0,
		targetDistance: 0,
		boundaryWarning: false,
		missionId: 1,
		phase: "tutorial_move",
		objective: "Learn the flight controls",
		objectiveProgress: 0,
		objectiveTotal: 1,
		timeRemaining: 600,
		tutorialStep: "move",
		groundKills: 0,
		targetKind: "air",
		targetRequired: false,
		special: SpecialWeapons.Default,
		specialCharges: 0,
		specialCooldown: 0,
		specialActive: 0,
	};
}

function finite(value: unknown, fallback: number): number {
	return typeIs(value, "number") && value === value && math.abs(value) !== math.huge ? value : fallback;
}

function safeString(value: unknown, fallback: string): string {
	return typeIs(value, "string") && value.size() <= 80 ? value : fallback;
}

function safeRadio(value: unknown, fallback: string | undefined): string | undefined {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= 140 ? value : fallback;
}

function formatTime(value: number): string {
	const seconds = math.max(0, math.floor(finite(value, 0)));
	return string.format("%02d:%02d", math.floor(seconds / 60), seconds % 60);
}

function normalizeSlots(response: CampaignResponse): SaveSlot[] | undefined {
	if (!response.slots || response.slots.size() !== 4) return undefined;
	const parsed = new Array<SaveSlot>();
	for (let offset = 0; offset < 4; offset++) {
		const source = response.slots[offset];
		if (!typeIs(source, "table")) return undefined;
		const bestTime = typeIs(source.bestTime, "number") ? finite(source.bestTime, 0) : undefined;
		parsed.push({
			index: offset + 1,
			occupied: source.occupied === true,
			completed: source.completed === true,
			kills: math.clamp(math.floor(finite(source.kills, 0)), 0, 99),
			bestTime,
			updatedAt: source.updatedAt,
			currentMission: math.clamp(math.floor(finite(source.currentMission, 1)), 1, MISSION_COUNT),
			missions: source.missions,
			introSeen: source.introSeen, cutscenesSeen: source.cutscenesSeen,
			special: SpecialWeapons.IsKind(source.special) ? source.special : undefined,
			mission1Completed: source.mission1Completed === true,
			mission2Completed: source.mission2Completed === true,
			mission1BestTime: typeIs(source.mission1BestTime, "number") ? math.max(0, finite(source.mission1BestTime, 0)) : undefined,
			mission2BestTime: typeIs(source.mission2BestTime, "number") ? math.max(0, finite(source.mission2BestTime, 0)) : undefined,
		});
	}
	return parsed;
}

function normalizePersistence(value: unknown): Persistence {
	return value === "cloud" || value === "session" ? value : "unavailable";
}

function sanitizeTelemetry(payload: Telemetry, previous: Telemetry): Telemetry {
	const missionId = MissionCatalog.IsValidId(payload.missionId) ? payload.missionId : previous.missionId;
	const targetKind = payload.targetKind === "ground" || payload.targetKind === "air" ? payload.targetKind : previous.targetKind;
	const tutorialStep = payload.tutorialStep === "move" || payload.tutorialStep === "target" || payload.tutorialStep === "missile" || payload.tutorialStep === ""
		? payload.tutorialStep
		: previous.tutorialStep;
	return {
		kind: "Telemetry",
		health: math.clamp(finite(payload.health, previous.health), 0, 100),
		speed: math.max(0, finite(payload.speed, previous.speed)),
		altitude: finite(payload.altitude, previous.altitude),
		kills: math.clamp(math.floor(finite(payload.kills, previous.kills)), 0, 99),
		total: math.clamp(math.floor(finite(payload.total, previous.total)), 1, 99),
		missiles: math.max(0, math.floor(finite(payload.missiles, previous.missiles))),
		missileCooldown: math.max(0, finite(payload.missileCooldown, previous.missileCooldown)),
		evadeCooldown: math.max(0, finite(payload.evadeCooldown, previous.evadeCooldown)),
		target: typeIs(payload.target, "Instance") && payload.target.IsA("Model") ? payload.target : undefined,
		targetName: safeString(payload.targetName, previous.targetName),
		lockProgress: math.clamp(finite(payload.lockProgress, previous.lockProgress), 0, 1),
		incoming: payload.incoming === true,
		lockWarning: payload.lockWarning === true,
		elapsed: math.max(0, finite(payload.elapsed, previous.elapsed)),
		targetDistance: math.max(0, finite(payload.targetDistance, previous.targetDistance ?? 0)),
		boundaryWarning: payload.boundaryWarning === undefined ? previous.boundaryWarning : payload.boundaryWarning === true,
		missionId,
		navigation: typeIs(payload.navigation, "Vector3") ? payload.navigation : undefined,
		navigationRadius: payload.navigationRadius, navigationCeiling: payload.navigationCeiling, protectedHealth: payload.protectedHealth,
		phase: safeString(payload.phase, previous.phase ?? ""),
		objective: safeString(payload.objective, previous.objective ?? "Complete the objective"),
		objectiveProgress: math.max(0, math.floor(finite(payload.objectiveProgress, previous.objectiveProgress ?? 0))),
		objectiveTotal: math.max(0, math.floor(finite(payload.objectiveTotal, previous.objectiveTotal ?? 0))),
		timeRemaining: math.clamp(finite(payload.timeRemaining, previous.timeRemaining ?? 600), 0, 600),
		tutorialStep,
		groundKills: math.max(0, math.floor(finite(payload.groundKills, previous.groundKills ?? 0))),
		targetKind,
		targetRequired: payload.targetRequired === undefined ? previous.targetRequired : payload.targetRequired === true,
		radio: safeRadio(payload.radio, previous.radio),
		radioSerial: typeIs(payload.radioSerial, "number") ? math.max(0, math.floor(finite(payload.radioSerial, previous.radioSerial ?? 0))) : previous.radioSerial,
		radioSeconds: typeIs(payload.radioSeconds, "number") ? math.clamp(finite(payload.radioSeconds, RADIO_SECONDS), 0.25, 10) : undefined,
		fireDenied: WeaponRules.IsFireNotice(payload.fireDenied) ? payload.fireDenied : undefined,
		special: SpecialWeapons.IsKind(payload.special) ? payload.special : previous.special,
		specialCharges: math.max(0, math.floor(finite(payload.specialCharges, previous.specialCharges ?? 0))),
		specialCooldown: math.max(0, finite(payload.specialCooldown, previous.specialCooldown ?? 0)),
		specialActive: math.max(0, finite(payload.specialActive, previous.specialActive ?? 0)),
		targetDamageable: payload.targetDamageable === undefined ? undefined : payload.targetDamageable === true,
		fireDeniedSerial: typeIs(payload.fireDeniedSerial, "number") ? math.max(0, math.floor(finite(payload.fireDeniedSerial, previous.fireDeniedSerial ?? 0))) : previous.fireDeniedSerial,
		targetHealth: typeIs(payload.targetHealth, "number") ? math.clamp(finite(payload.targetHealth, 1), 0, 1) : undefined,
	};
}

function resumeMission(slot?: SaveSlot): number {
	return slot?.currentMission ?? 1;
}

function missileReady(telemetry: Telemetry): boolean {
	return telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
}

let menuCameraViewport: Vector2 | undefined;
let menuCameraSheet = false;
function setMenuCamera() {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	const size = camera.ViewportSize;
	const clock = os.clock();
	const sway = new Vector3(math.sin(clock * 0.11) * 2, math.sin(clock * 0.07) * 0.8, 0);
	let eye = MENU_JET.add(MENU_EYE_OFFSET);
	let focus: Vector3;
	// The layout solver only re-runs when the viewport changes, not every menu frame.
	if (menuCameraViewport !== size) { menuCameraViewport = size; menuCameraSheet = getMenuLayout(size.X, size.Y).mode === "sheet"; }
	if (menuCameraSheet) {
		eye = MENU_JET.add(MENU_EYE_OFFSET.mul(1.8));
		focus = MENU_JET.sub(new Vector3(0, 20, 0));
	} else {
		const aspect = size.X / math.max(1, size.Y);
		const cameraLeft = MENU_EYE_OFFSET.Cross(Vector3.yAxis).Unit;
		focus = MENU_JET.add(cameraLeft.mul(10.5 * aspect));
	}
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = CFrame.lookAt(eye.add(sway), focus);
	camera.FieldOfView = 50;
}

function MenuBackdrop({ visible, mode }: { visible: boolean; mode: MenuLayout["mode"] }) {
	const side = mode === "side";
	return (
		<frame key="Backdrop" BackgroundColor3={C.Ink} BackgroundTransparency={0} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={visible} ZIndex={0}>
			<uigradient
				Rotation={side ? 0 : 90}
				Transparency={side
					? new NumberSequence([
						new NumberSequenceKeypoint(0, 0.08),
						new NumberSequenceKeypoint(0.3, 0.22),
						new NumberSequenceKeypoint(0.58, 0.82),
						new NumberSequenceKeypoint(0.75, 1),
						new NumberSequenceKeypoint(1, 1),
					])
					: new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(0.3, 1),
						new NumberSequenceKeypoint(0.5, 0.45),
						new NumberSequenceKeypoint(0.66, 0.12),
						new NumberSequenceKeypoint(1, 0.04),
					])}
			/>
		</frame>
	);
}

function panelPosition(menu: MenuLayout) {
	return { Position: UDim2.fromOffset(menu.panel.x, menu.panel.y), Size: UDim2.fromOffset(menu.panel.width, menu.panel.height) };
}

function TitleScreenImpl({ visible, menu, onCampaign }: { visible: boolean; menu: MenuLayout; onCampaign: () => void }) {
	const compact = menu.compact;
	return (
		<frame key="TitleScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="TitleContent" BackgroundTransparency={1} {...panelPosition(menu)}>
				<uilistlayout
					Padding={new UDim(0, compact ? 6 : 10)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={menu.mode === "sheet" ? Enum.VerticalAlignment.Bottom : Enum.VerticalAlignment.Center}
				/>
				<frame key="Accent" BackgroundColor3={C.Accent} BorderSizePixel={0} LayoutOrder={1} Size={UDim2.fromOffset(32, 2)} />
				<textlabel
					key="Title"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, menu.panel.height<220 ? 36 : compact ? 50 : 76)}
					Text="SKYBREAK"
					TextColor3={C.Ivory}
					TextScaled={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<uitextsizeconstraint MaxTextSize={compact ? 46 : 70} MinTextSize={28} />
				</textlabel>
				<Label name="Subtitle" text="BROKEN RELAY" color={C.Orange} textSize={compact ? 11 : 13} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 18)} layoutOrder={3} />
				<Label
					name="Blurb"
					visible={menu.panel.height>=220}
					text="Follow a missing mentor’s recordings through 27 sorties. Uncover the coup. Bring the coast home."
					color={C.Muted}
					textSize={compact ? 13 : 15}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
					layoutOrder={4}
				/>
				<frame key="Spacer" BackgroundTransparency={1} LayoutOrder={5} Size={UDim2.fromOffset(1, compact ? 4 : 14)} />
				<ActionButton name="CampaignButton" text="CAMPAIGN  ›" primary={true} layoutOrder={6} size={UDim2.fromOffset(math.min(260, menu.panel.width), compact ? 46 : 52)} textSize={15} onActivated={onCampaign} />
			</frame>
		</frame>
	);
}
const TitleScreen = React.memo(TitleScreenImpl);

function SlotButton({
	number,
	slot,
	busy,
	compact,
	confirming,
	onSlot,
	onAskDelete,
	onConfirmDelete,
	onCancelDelete,
}: {
	number: number;
	slot?: SaveSlot;
	busy: boolean;
	compact: boolean;
	confirming: boolean;
	onSlot: (slot: number) => void;
	onAskDelete: (slot: number) => void;
	onConfirmDelete: (slot: number) => void;
	onCancelDelete: () => void;
}) {
	const enabled = !busy && slot !== undefined && !confirming;
	const deletable = !busy && slot?.occupied === true;
	const { hot, events, clearHover } = useHighlight(enabled);
	const status=busy ? "READING FILE..." : !slot ? "LINK UNAVAILABLE" : slot.completed ? "CAMPAIGN COMPLETE · REPLAY" : slot.occupied ? `CONTINUE MISSION ${string.format("%02d",slot.currentMission ?? 1)}` : "NEW CAMPAIGN";
	let completed=0;
	if(slot) for(let id=1;id<=MISSION_COUNT;id++) if(slot.missions?.[id]?.completed) completed++;
	const detail=busy ? "Please stand by" : !slot ? "Return and try again" : `${completed}/27 complete · ${MissionCatalog.Get(slot.currentMission ?? 1).title}`;
	const rowHeight = compact ? 44 : 58;
	const buttonHeight = compact ? 32 : 38;
	if (confirming) {
		return (
			<frame key={`Slot${number}Button`} BackgroundColor3={C.Panel} BackgroundTransparency={0.04} BorderSizePixel={0} LayoutOrder={number} Size={new UDim2(1, 0, 0, rowHeight)}>
				<Corner />
				<Stroke color={C.Danger} transparency={0.15} thickness={2} />
				<Label name="SlotNumber" text={string.format("%02d", number)} color={C.Danger} textSize={12} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(14, 0)} size={new UDim2(0, 26, 1, 0)} />
				<Label name="Status" text="DELETE THIS SAVE?" color={C.Danger} textSize={compact ? 13 : 15} font={Enum.Font.GothamBold} position={UDim2.fromOffset(48, compact ? 5 : 10)} size={new UDim2(1, -240, 0, compact ? 18 : 20)} />
				<Label name="Detail" text="All progress in this file is lost." color={C.Muted} textSize={compact ? 10 : 12} position={UDim2.fromOffset(48, compact ? 23 : 31)} size={new UDim2(1, -240, 0, compact ? 15 : 17)} />
				<ActionButton name="KeepButton" text="KEEP" anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -98, 0.5, 0)} size={UDim2.fromOffset(78, buttonHeight)} enabled={!busy} textSize={12} onActivated={onCancelDelete} />
				<ActionButton name="ConfirmDeleteButton" text="DELETE" primary={true} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -10, 0.5, 0)} size={UDim2.fromOffset(82, buttonHeight)} enabled={!busy} textSize={12} onActivated={() => onConfirmDelete(number)} />
			</frame>
		);
	}
	return (
		<textbutton
			key={`Slot${number}Button`}
			Active={enabled}
			AutoButtonColor={false}
			BackgroundColor3={hot ? C.PanelHot : C.Panel}
			BackgroundTransparency={hot ? 0.04 : 0.3}
			BorderSizePixel={0}
			LayoutOrder={number}
			SelectionImageObject={SELECTION_NONE}
			Size={new UDim2(1, 0, 0, rowHeight)}
			Text=""
			Event={{
				...events,
				Activated: () => {
					clearHover();
					if (enabled) onSlot(number);
				},
			}}
		>
			<Corner />
			<Stroke color={hot ? C.Accent : C.Ivory} transparency={hot ? 0.15 : 0.9} thickness={hot ? 2 : 1} />
			<frame key="FocusBar" BackgroundColor3={C.Accent} BorderSizePixel={0} Position={new UDim2(0, 0, 0.5, 0)} AnchorPoint={new Vector2(0, 0.5)} Size={new UDim2(0, 3, 1, -16)} Visible={hot} />
			<Label name="SlotNumber" text={string.format("%02d", number)} color={hot ? C.Accent : C.Faint} textSize={12} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(14, 0)} size={new UDim2(0, 26, 1, 0)} />
			<Label name="Status" text={status} color={slot?.completed ? C.Accent : C.Ivory} textSize={compact ? 13 : 15} font={Enum.Font.GothamBold} position={UDim2.fromOffset(48, compact ? 5 : 10)} size={new UDim2(1, deletable ? -170 : -80, 0, compact ? 18 : 20)} />
			<Label name="Detail" text={detail} color={C.Muted} textSize={compact ? 10 : 12} position={UDim2.fromOffset(48, compact ? 23 : 31)} size={new UDim2(1, deletable ? -170 : -80, 0, compact ? 15 : 17)} />
			{deletable && (
				<ActionButton name="DeleteButton" text="DELETE" anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -40, 0.5, 0)} size={UDim2.fromOffset(84, buttonHeight)} textSize={11} onActivated={() => onAskDelete(number)} />
			)}
			<Label name="Arrow" text="›" color={hot ? C.Accent : C.Faint} textSize={20} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -14, 0.5, 0)} size={UDim2.fromOffset(16, 28)} textXAlignment={Enum.TextXAlignment.Right} visible={enabled} />
		</textbutton>
	);
}

function CampaignScreenImpl({
	visible,
	menu,
	slots,
	busy,
	persistence,
	onBack,
	onSlot,
	confirmSlot,
	onAskDelete,
	onCancelDelete,
	onDeleteSlot,
}: {
	visible: boolean;
	menu: MenuLayout;
	slots?: SaveSlot[];
	busy: boolean;
	persistence: Persistence;
	onBack: () => void;
	onSlot: (slot: number) => void;
	confirmSlot?: number;
	onAskDelete: (slot: number) => void;
	onCancelDelete: () => void;
	onDeleteSlot: (slot: number) => void;
}) {
	const compact = menu.compact;
	const persistenceText = busy
		? "Connecting to flight records..."
		: persistence === "cloud"
			? "Cloud saves online"
			: persistence === "session"
				? "Saves kept for this session only"
				: "Save service offline. Progress may not persist.";
	const rowHeight = compact ? 44 : 58;
	const gap = compact ? 6 : 8;
	const footerHeight = 44;
	return (
		<frame key="CampaignScreen" BackgroundTransparency={1} Visible={visible} {...panelPosition(menu)}>
			<Label name="CampaignHeader" text="CAMPAIGN FILES" textSize={compact ? 19 : 26} font={Enum.Font.GothamBlack} size={new UDim2(1, 0, 0, compact ? 26 : 34)} />
			<Label
				name="CampaignSubheader"
				text="SELECT A FLIGHT RECORD"
				color={C.Accent}
				textSize={10}
				font={Enum.Font.GothamBold}
				position={UDim2.fromOffset(0, 38)}
				size={new UDim2(1, 0, 0, 16)}
				visible={!compact}
			/>
			<scrollingframe key="SlotGrid" BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={3} ScrollingDirection={Enum.ScrollingDirection.Y} CanvasSize={UDim2.fromOffset(0, rowHeight * 4 + gap * 3)} Position={UDim2.fromOffset(0, compact ? 34 : 66)} Size={new UDim2(1, 0, 0, getSlotListHeight(menu.panel.height, compact))}>
				<uilistlayout Padding={new UDim(0, gap)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{SLOT_NUMBERS.map((number) => (
					<SlotButton
						key={`Slot${number}Button`}
						number={number}
						slot={slots?.[number - 1]}
						busy={busy}
						compact={compact}
						confirming={confirmSlot === number}
						onSlot={onSlot}
						onAskDelete={onAskDelete}
						onConfirmDelete={onDeleteSlot}
						onCancelDelete={onCancelDelete}
					/>
				))}
			</scrollingframe>
			<ActionButton name="CampaignBackButton" text="‹  BACK" anchorPoint={new Vector2(0, 1)} position={new UDim2(0, 0, 1, 0)} size={UDim2.fromOffset(108, footerHeight)} enabled={!busy} textSize={13} onActivated={onBack} />
			<Label
				name="PersistenceStatus"
				text={persistenceText}
				color={persistence === "unavailable" && !busy ? C.Orange : C.Muted}
				textSize={compact ? 10 : 11}
				anchorPoint={new Vector2(1, 1)}
				position={new UDim2(1, 0, 1, 0)}
				size={new UDim2(1, -120, 0, footerHeight)}
				textXAlignment={Enum.TextXAlignment.Right}
				textWrapped={true}
			/>
		</frame>
	);
}
const CampaignScreen = React.memo(CampaignScreenImpl);

function FooterButtons({
	compact,
	primaryName,
	primaryText,
	secondaryName,
	secondaryText,
	primaryFirst = true,
	busy,
	onPrimary,
	onSecondary,
}: {
	compact: boolean;
	primaryName: string;
	primaryText: string;
	secondaryName: string;
	secondaryText: string;
	primaryFirst?: boolean;
	busy: boolean;
	onPrimary: () => void;
	onSecondary: () => void;
}) {
	const height = compact ? 44 : 48;
	const leftSize = new UDim2(0.58, -4, 0, height);
	const rightSize = new UDim2(0.42, -4, 0, height);
	return (
		<>
			<ActionButton
				name={primaryName}
				text={primaryText}
				primary={true}
				anchorPoint={primaryFirst ? new Vector2(0, 1) : new Vector2(1, 1)}
				position={primaryFirst ? new UDim2(0, 0, 1, 0) : new UDim2(1, 0, 1, 0)}
				size={primaryFirst ? leftSize : rightSize}
				enabled={!busy}
				onActivated={onPrimary}
			/>
			<ActionButton
				name={secondaryName}
				text={secondaryText}
				anchorPoint={primaryFirst ? new Vector2(1, 1) : new Vector2(0, 1)}
				position={primaryFirst ? new UDim2(1, 0, 1, 0) : new UDim2(0, 0, 1, 0)}
				size={primaryFirst ? rightSize : leftSize}
				enabled={!busy}
				textSize={13}
				onActivated={onSecondary}
			/>
		</>
	);
}

function BriefingScreenImpl({visible,menu,selectedSlot,selectedMission,slot,busy,special,onBack,onLaunch,onMission,onSpecial}: {
	visible:boolean;menu:MenuLayout;selectedSlot:number;selectedMission:number;slot?:SaveSlot;busy:boolean;special:SpecialKind;
	onBack:()=>void;onLaunch:()=>void;onMission:(id:number)=>void;onSpecial:(kind:SpecialKind)=>void;
}) {
	const [browse,setBrowse]=useState(false),[act,setAct]=useState(1);
	const panelRef=useRef<Frame>();const inputMode=useContext(InputModeContext);
	useEffect(()=>{if(!visible || inputMode!=="gamepad")return;task.defer(()=>{
		const panel=panelRef.current;if(!panel)return;
		const selected=panel.FindFirstChild(browse ? "ArchiveBackButton" : "LaunchButton",true);
		if(selected?.IsA("GuiObject"))GuiService.SelectedObject=selected;
	});},[browse,act,inputMode,visible]);
	const mission=MissionCatalog.Get(selectedMission);
	let unlocked=1;
	for(let id=1;id<MISSION_COUNT;id++) {if(slot?.missions?.[id]?.completed)unlocked=id+1;else break;}
	const completed=slot?.missions?.[selectedMission]?.completed===true;
	const best=slot?.missions?.[selectedMission]?.bestTime;
	const small=menu.panel.height<300,ultra=menu.panel.height<220;
	const detailsTop=ultra ? 42 : small ? 57 : 66;
	const choose=(id:number)=>{onMission(id);setBrowse(false);};
	return <frame key="BriefingScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1,1)} Visible={visible}>
		<frame ref={panelRef} key="BriefingPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
			{browse ? <>
				<Label name="SelectMissionTitle" text="MISSION ARCHIVE" textSize={21} font={Enum.Font.GothamBlack} size={new UDim2(1,0,0,ultra ? 22 : 28)}/>
				{[1,2,3].map((id)=><ActionButton key={`Act${id}`} name={`Act${id}`} text={`ACT ${id}`} primary={act===id} position={new UDim2((id-1)/3,0,0,ultra ? 26 : 32)} size={new UDim2(1/3,-4,0,44)} onActivated={()=>setAct(id)}/>)}
				<scrollingframe key="MissionArchive" Position={UDim2.fromOffset(0,ultra ? 74 : 82)} Size={new UDim2(1,0,1,ultra ? -122 : -132)} CanvasSize={UDim2.fromOffset(0,9*50)} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={4}>
					<uilistlayout Padding={new UDim(0,6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					{MissionCatalog.All().filter((bp)=>bp.act===act).map((bp)=><ActionButton key={`Mission${bp.id}`} name={`Mission${string.format("%02d",bp.id)}SelectButton`} text={`${string.format("%02d",bp.id)}  ${bp.title}${bp.id>unlocked ? " · LOCKED" : slot?.missions?.[bp.id]?.completed ? " · COMPLETE" : ""}`} primary={selectedMission===bp.id} enabled={!busy && bp.id<=unlocked} layoutOrder={bp.id} size={new UDim2(1,-8,0,44)} textSize={12} onActivated={()=>choose(bp.id)}/>)}
				</scrollingframe>
				<ActionButton name="ArchiveBackButton" text="‹ BRIEFING" anchorPoint={new Vector2(0,1)} position={new UDim2(0,0,1,0)} size={new UDim2(1,0,0,44)} onActivated={()=>setBrowse(false)}/>
			</> : <>
				<Label name="BriefingEyebrow" text={`FILE ${selectedSlot} · ACT ${mission.act} · MISSION ${string.format("%02d",selectedMission)}/27`} color={C.Accent} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,16)}/>
				<Label name="BriefingTitle" text={mission.title} textSize={small ? 21 : 29} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0,ultra ? 14 : 20)} size={new UDim2(1,0,0,ultra ? 24 : 36)}/>
				<scrollingframe key="BriefingDetails" Position={UDim2.fromOffset(0,detailsTop)} Size={new UDim2(1,0,1,-detailsTop-100)} CanvasSize={UDim2.fromOffset(0,0)} AutomaticCanvasSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={4}>
					<uilistlayout Padding={new UDim(0,12)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					<Label name="Story" text={mission.briefing} color={C.Ivory} textSize={14} size={new UDim2(1,-12,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={1}/>
					<LoadoutPicker kind={special} enabled={!busy} layoutOrder={2} compact={small} onChange={onSpecial}/>
					<Label name="PhasePlan" text={mission.phases.map((phase,index)=>`${index+1}. ${phase.label}`).join("\n")} color={C.Muted} textSize={12} size={new UDim2(1,-12,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={3}/>
					<Label name="MissionRules" text={`600-second deadline · Retry available\nGreen beacon: fly inside its volume. Scans require the shown altitude.\nEscorts: stay near the vehicle; destroy raiders before they close.\n${completed ? `COMPLETED · BEST ${best !== undefined ? formatTime(best) : "--:--"}` : "Complete this sortie to unlock the next."}`} color={C.Accent} textSize={12} size={new UDim2(1,-12,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={4}/>
				</scrollingframe>
				<ActionButton name="BrowseMissionsButton" text={`ALL 27 MISSIONS · ${completed ? "REPLAY" : "SELECT"}`} anchorPoint={new Vector2(0,1)} position={new UDim2(0,0,1,-52)} size={new UDim2(1,0,0,44)} onActivated={()=>{setAct(mission.act);setBrowse(true);}} enabled={!busy}/>
				<FooterButtons compact={true} primaryName="LaunchButton" primaryText={busy ? "PREPARING..." : "LAUNCH ›"} secondaryName="BriefingBackButton" secondaryText="‹ FILES" busy={busy} onPrimary={onLaunch} onSecondary={onBack}/>
			</>}
		</frame>
	</frame>;
}
const BriefingScreen = React.memo(BriefingScreenImpl);

const RANK_COLORS: { [rank: string]: Color3 } = { S: C.AccentHot, A: C.Accent, B: C.Ivory, C: C.Muted, D: C.Danger };
/** Seconds between debrief rows appearing. */
const DEBRIEF_ROW_STEP = 0.07;

/** Readable failure cause for the debrief. */
function failureCause(reason?: string): string {
	if (reason === "timeout") return "The ten-minute operation window closed.";
	if (reason === "protected_lost") return "The protected vehicle or site was lost.";
	if (reason === "destroyed") return "Your aircraft was shot down.";
	if (reason === "not_recorded") return "The server could not record this sortie. Fly it again from the campaign menu.";
	return "The sortie ended before the objective was complete.";
}

function formatScore(value: number): string {
	const digits = tostring(math.max(0, math.floor(value)));
	let result = "";
	for (let index = digits.size(); index >= 1; index -= 3) {
		const chunk = digits.sub(math.max(1, index - 2), index);
		result = result === "" ? chunk : `${chunk},${result}`;
	}
	return result;
}

interface DebriefLine {
	key: string;
	label: string;
	value?: string;
	color?: Color3;
	valueColor?: Color3;
}

/** One debrief row: a mono label with an optional right-aligned value, hidden until its reveal step. */
function DebriefRow({ line, order, shown, compact }: { line: DebriefLine; order: number; shown: boolean; compact: boolean }) {
	const height = compact ? 18 : 22;
	const textSize = compact ? 11 : 13;
	const transparency = shown ? 0 : 1;
	return (
		<frame key={line.key} BackgroundTransparency={1} LayoutOrder={order} Size={new UDim2(1, -8, 0, height)}>
			<textlabel
				key="Label" BackgroundTransparency={1} Size={new UDim2(line.value !== undefined ? 0.62 : 1, 0, 1, 0)}
				Font={Enum.Font.GothamMedium} Text={line.label} TextColor3={line.color ?? C.Muted} TextSize={textSize}
				TextTransparency={transparency} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd}
			/>
			{line.value !== undefined && (
				<textlabel
					key="Value" BackgroundTransparency={1} AnchorPoint={new Vector2(1, 0)} Position={UDim2.fromScale(1, 0)} Size={new UDim2(0.38, 0, 1, 0)}
					Font={Enum.Font.RobotoMono} Text={line.value} TextColor3={line.valueColor ?? C.Ivory} TextSize={textSize}
					TextTransparency={transparency} TextXAlignment={Enum.TextXAlignment.Right}
				/>
			)}
		</frame>
	);
}

function OutcomeScreenImpl({
	visible,
	menu,
	outcome,
	busy,
	onRetry,
	onReturn,
	onNext,
}: {
	visible: boolean;
	menu: MenuLayout;
	outcome: OutcomeState;
	busy: boolean;
	onRetry: () => void;
	onReturn: () => void;
	onNext: () => void;
}) {
	const compact = menu.compact;
	const ultra = menu.panel.height < 260;
	const mission = MissionCatalog.Get(outcome.missionId);
	const retryText = busy ? "RESETTING SORTIE..." : outcome.won ? `REPLAY MISSION ${string.format("%02d",outcome.missionId)}` : "RETRY SORTIE";
	const campaignComplete = outcome.won && outcome.missionId === MISSION_COUNT;
	const rankColor = RANK_COLORS[outcome.rank] ?? C.Ivory;
	const newBest = outcome.newBestScore || outcome.newBestRank;
	const bestText = outcome.bestScore !== undefined ? `BEST ${outcome.bestRank ?? "-"} · ${formatScore(outcome.bestScore)}` : "";

	// Objective breakdown: phases before `completedPhases` are done; on a failure the next one is where it ended.
	const objectives: DebriefLine[] = mission.phases.map((phase, index) => {
		const done = outcome.won || index < outcome.completedPhases;
		const failedHere = !done && index === outcome.completedPhases;
		return {
			key: `Objective${index + 1}`,
			label: `${done ? "✓" : "✕"}  ${phase.label}`,
			color: done ? C.Accent : failedHere ? C.Danger : C.Faint,
		};
	});
	const accuracy = outcome.missilesFired > 0 ? math.floor((outcome.missileHits / outcome.missilesFired) * 100 + 0.5) : undefined;
	const stats: DebriefLine[] = [
		{ key: "StatAir", label: "AIR KILLS", value: outcome.optionalKills > 0 ? `${outcome.airKills}  (+${outcome.optionalKills} RAIDERS)` : `${outcome.airKills}` },
		{ key: "StatGround", label: "GROUND KILLS", value: `${outcome.groundKills}` },
		{ key: "StatTime", label: `TIME  ·  PAR ${formatTime(outcome.par)}`, value: formatTime(outcome.elapsed), valueColor: outcome.won && outcome.elapsed <= outcome.par ? C.Accent : C.Ivory },
		{ key: "StatMissiles", label: "MISSILES FIRED", value: `${outcome.missilesFired}` },
		{ key: "StatAccuracy", label: "HIT ACCURACY", value: accuracy !== undefined ? `${accuracy}%` : "--" },
		{ key: "StatHull", label: `LOWEST HULL  ·  DAMAGE ${math.floor(outcome.damageTaken)}`, value: `${math.floor(outcome.lowestHealth)}%`, valueColor: outcome.lowestHealth < 35 ? C.Orange : C.Ivory },
		{ key: "StatEvades", label: "EVADES USED", value: `${outcome.evades}` },
	];
	const rows = [...objectives, ...stats];

	// Short staggered reveal each time a result is shown.
	const [shown, setShown] = useState(0);
	const revealRef = useRef(0);
	useEffect(() => {
		const serial = ++revealRef.current;
		setShown(0);
		if (!visible) return;
		task.spawn(() => {
			for (let count = 1; count <= rows.size(); count++) {
				task.wait(DEBRIEF_ROW_STEP);
				if (revealRef.current !== serial) return;
				setShown(count);
			}
		});
		return () => { revealRef.current++; };
	}, [visible, outcome]);

	const story = outcome.won ? mission.debrief : `${failureCause(outcome.reason)} ${mission.failure}`;
	const headerSize = ultra ? 22 : compact ? 26 : 34;
	const rankSize = ultra ? 40 : compact ? 48 : 62;
	// Score sits between the 12px caption and the 14px best line, without overlapping either.
	const scoreHeight = math.min(rankSize * 0.48, rankSize - 26);
	return (
		<frame key="OutcomeScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="VictoryPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
				<scrollingframe key="OutcomeDetails" BackgroundTransparency={1} BorderSizePixel={0} Size={new UDim2(1,0,1,compact ? -50 : -56)} CanvasSize={UDim2.fromOffset(0,0)} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={3} ScrollingDirection={Enum.ScrollingDirection.Y}>
					<uilistlayout Padding={new UDim(0,compact ? 4 : 6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					<frame key="Accent" LayoutOrder={1} BackgroundColor3={outcome.won ? C.Accent : C.Danger} BorderSizePixel={0} Size={UDim2.fromOffset(32, 2)} />
					<Label name="OutcomeEyebrow" layoutOrder={2} text={`MISSION ${string.format("%02d",outcome.missionId)}/${MISSION_COUNT} · ${mission.title}`} color={C.Orange} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					<Label name="OutcomeTitle" layoutOrder={3} text={outcome.won ? "MISSION ACCOMPLISHED" : "MISSION FAILED"} color={outcome.won ? C.Ivory : C.Danger} textSize={headerSize} minTextSize={14} font={Enum.Font.GothamBlack} size={new UDim2(1, -8, 0, headerSize + 4)} />
					<frame key="RankBlock" LayoutOrder={4} BackgroundTransparency={1} Size={new UDim2(1, -8, 0, rankSize)}>
						<textlabel key="RankLetter" BackgroundTransparency={1} Size={UDim2.fromOffset(rankSize, rankSize)} Font={Enum.Font.GothamBlack} Text={outcome.rank} TextColor3={rankColor} TextSize={rankSize} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="RankCaption" BackgroundTransparency={1} Position={UDim2.fromOffset(rankSize + 6, 0)} Size={new UDim2(1, -rankSize - 6, 0, 12)} Font={Enum.Font.GothamBold} Text="RANK  ·  SCORE" TextColor3={C.Faint} TextSize={10} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="ScoreValue" BackgroundTransparency={1} Position={UDim2.fromOffset(rankSize + 6, 12)} Size={new UDim2(1, -rankSize - 6, 0, scoreHeight)} Font={Enum.Font.GothamBlack} Text={formatScore(outcome.score)} TextColor3={C.Ivory} TextSize={math.floor(scoreHeight * 0.96)} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="BestLine" BackgroundTransparency={1} AnchorPoint={new Vector2(0, 1)} Position={new UDim2(0, rankSize + 6, 1, 0)} Size={new UDim2(1, -rankSize - 6, 0, 14)} Font={Enum.Font.GothamBold} Text={newBest ? (outcome.newBestRank ? "NEW BEST RANK" : "NEW BEST SCORE") : bestText} TextColor3={newBest ? C.Orange : C.Muted} TextSize={compact ? 10 : 11} TextXAlignment={Enum.TextXAlignment.Left} />
					</frame>
					<Label name="OutcomeGoal" layoutOrder={5} text={`OBJECTIVE · ${string.upper(mission.primary)}`} color={C.Faint} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} />
					<Label name="OutcomeSummary" layoutOrder={6} text={story} color={outcome.won ? C.Ivory : C.Muted} textSize={compact ? 12 : 14} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} textYAlignment={Enum.TextYAlignment.Top} />
					<Label name="ObjectivesHeading" layoutOrder={7} text="OBJECTIVES" color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					{objectives.map((line, index) => <DebriefRow key={line.key} line={line} order={10 + index} shown={index < shown} compact={compact} />)}
					<Label name="StatsHeading" layoutOrder={40} text="FLIGHT RECORD" color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					{stats.map((line, index) => <DebriefRow key={line.key} line={line} order={41 + index} shown={objectives.size() + index < shown} compact={compact} />)}
					<Label name="SaveStatus" layoutOrder={60} text={outcome.saveText} visible={outcome.saveText !== ""} color={outcome.saveColor} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} />
				</scrollingframe>
				{outcome.won ? !campaignComplete ? (
					<FooterButtons compact={compact} primaryName="Mission1NextMissionButton" primaryText={`NEXT: MISSION ${string.format("%02d",outcome.missionId+1)}`} secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onNext} onSecondary={onReturn} />
				) : (
					<FooterButtons compact={compact} primaryName="ReturnToMenuButton" primaryText="RETURN TO MENU" secondaryName="RetryButton" secondaryText={retryText} busy={busy} onPrimary={onReturn} onSecondary={onRetry} />
				) : (
					<FooterButtons compact={compact} primaryName="RetryButton" primaryText={retryText} secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onRetry} onSecondary={onReturn} />
				)}
			</frame>
		</frame>
	);
}
const OutcomeScreen = React.memo(OutcomeScreenImpl);

function RoundButton({
	name,
	text,
	rectangle,
	filled,
	enabled,
	dimmed = false,
	textSize,
	onActivated,
}: {
	name: string;
	text: string;
	rectangle: Rectangle;
	filled: boolean;
	enabled: boolean;
	/** Label shown faded while still usable (lock building). */
	dimmed?: boolean;
	textSize: number;
	onActivated: () => void;
}) {
	return (
		<textbutton
			key={name}
			Active={enabled}
			AutoButtonColor={false}
			BackgroundColor3={filled ? C.Accent : C.Ink}
			BackgroundTransparency={filled ? 0.6 : enabled ? 0.7 : 0.8}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			Position={UDim2.fromOffset(rectangle.x, rectangle.y)}
			Selectable={false}
			Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
			Text={text}
			TextColor3={C.Ivory}
			TextSize={textSize}
			TextStrokeColor3={C.Ink}
			TextStrokeTransparency={0.5}
			TextTransparency={!enabled ? 0.5 : dimmed ? 0.35 : 0}
			Event={{ Activated: () => enabled && onActivated() }}
		>
			<Corner scale={0.5} />
			<Stroke color={filled ? C.AccentHot : C.Accent} transparency={filled ? 0.1 : enabled ? 0.45 : 0.8} thickness={1.5} />
		</textbutton>
	);
}

/** Keyboard/gamepad hint as plain text: key name (or gamepad glyph) in accent, action in ivory. */
function FlightHint({ hint, order }: { hint: ControlHint; order: number }) {
	const glyph = hint.keyCode !== undefined ? glyphFor(hint.keyCode) : "";
	return (
		<frame key={`${hint.action}Hint`} AutomaticSize={Enum.AutomaticSize.X} BackgroundTransparency={1} LayoutOrder={order} Size={UDim2.fromOffset(0, 16)}>
			<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} VerticalAlignment={Enum.VerticalAlignment.Center} />
			{glyph !== ""
				? <imagelabel key="Glyph" BackgroundTransparency={1} Image={glyph} LayoutOrder={1} Size={UDim2.fromOffset(16, 16)} />
				: <Label name="Key" text={hint.label} color={C.Accent} textSize={10} font={Enum.Font.GothamBold} size={UDim2.fromOffset(0, 14)} automaticSize={Enum.AutomaticSize.X} layoutOrder={1} stroke={true} />}
			<Label name="Action" text={hint.action} color={C.Ivory} textSize={10} font={Enum.Font.GothamBold} size={UDim2.fromOffset(0, 14)} automaticSize={Enum.AutomaticSize.X} layoutOrder={2} stroke={true} />
		</frame>
	);
}

/** HUD text: no background, dark stroke for legibility over sky and sea. */
function HudText({
	name,
	text,
	rectangle,
	color = C.Ivory,
	textSize,
	font = Enum.Font.GothamBold,
	alignment = Enum.TextXAlignment.Left,
	minTextSize,
	visible = true,
	textRef,
	wrap = false,
}: {
	name: string;
	text: string;
	rectangle: Rectangle;
	color?: Color3;
	textSize: number;
	font?: Enum.Font;
	alignment?: Enum.TextXAlignment;
	/** Shrinks long lines down to this size instead of wrapping. */
	minTextSize?: number;
	visible?: boolean;
	textRef?: React.RefObject<TextLabel>;
	/** Wrap onto the rectangle's extra lines instead of truncating. */
	wrap?: boolean;
}) {
	return (
		<textlabel
			ref={textRef}
			key={name}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			Position={UDim2.fromOffset(rectangle.x, rectangle.y)}
			Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
			Font={font}
			Text={text}
			TextColor3={color}
			TextSize={textSize}
			TextScaled={minTextSize !== undefined}
			TextTruncate={Enum.TextTruncate.AtEnd}
			TextWrapped={wrap}
			TextYAlignment={Enum.TextYAlignment.Top}
			TextXAlignment={alignment}
			TextStrokeColor3={C.Ink}
			TextStrokeTransparency={0.35}
			Visible={visible}
		>
			{minTextSize !== undefined && <uitextsizeconstraint MaxTextSize={textSize} MinTextSize={minTextSize} />}
		</textlabel>
	);
}

function MissionHud({
	visible,
	viewport,
	inputMode,
	telemetry,
	throttle,
	callout,
	introduction,
	damageFlash,
	joystickRef,
	knobRef,
	onJoystickBegan,
	onThrottle,
	onMissile,
	onTarget,
	onSpecial,
}: {
	visible: boolean;
	viewport: Vector2;
	inputMode: InputMode;
	telemetry: Telemetry;
	throttle: number;
	callout?: Callout;
	introduction: boolean;
	damageFlash: boolean;
	joystickRef: React.RefObject<Frame>;
	knobRef: React.RefObject<Frame>;
	onJoystickBegan: (input: InputObject) => void;
	onThrottle: (value: number) => void;
	onMissile: () => void;
	onTarget: () => void;
	onSpecial: () => void;
}) {
	const layout = getHudLayout(viewport.X, viewport.Y, inputMode);
	const touch = layout.touch;
	const ready = missileReady(telemetry);
	const locked = telemetry.target !== undefined && telemetry.lockProgress >= 0.99;
	const alertText = telemetry.incoming ? "MISSILE INBOUND" : telemetry.lockWarning ? "MISSILE LOCK" : telemetry.boundaryWarning ? "AIRSPACE LIMIT" : "";
	const alertColor = telemetry.incoming ? C.Danger : C.Orange;
	const evadeHint = telemetry.incoming && telemetry.evadeCooldown <= 0 ? getEvadeHint(inputMode) : undefined;
	const flightHints = getFlightHints(inputMode, { introduction, locked, missileReady: ready });
	// Second weapon slot: label, button state and a hint when it is both ready and relevant now
	// (flares with a missile inbound, missiles with a lock, the drone during the opening legend).
	const specialKind: SpecialKind = SpecialWeapons.IsKind(telemetry.special) ? telemetry.special : SpecialWeapons.Default;
	const specialDefinition = SpecialWeapons.Get(specialKind);
	const specialButton = SpecialWeapons.Button(specialKind, telemetry.specialCharges ?? 0, telemetry.specialCooldown ?? 0, telemetry.specialActive ?? 0);
	const specialReady = (telemetry.specialCharges ?? 0) > 0 && (telemetry.specialCooldown ?? 0) <= 0 && (telemetry.specialActive ?? 0) <= 0;
	const specialRelevant = specialKind === "flares" ? telemetry.incoming : specialKind === "uav" ? telemetry.target !== undefined && !locked : locked;
	const specialHint = specialReady && specialRelevant ? getSpecialHint(inputMode, specialDefinition.short) : undefined;
	// EVADE leads while a missile is inbound; never more than two hints at once.
	const hints = [...(evadeHint ? [evadeHint] : []), ...flightHints.filter((hint) => hint.action !== evadeHint?.action), ...(specialHint ? [specialHint] : [])].filter(
		(_hint, index) => index < MAX_FLIGHT_HINTS,
	);
	const alertActive = visible && alertText !== "";
	const warningText = useRef<TextLabel>();
	useEffect(() => {
		const label = warningText.current;
		if (!alertActive || !label) return;
		// Gentle pulse on the text itself; nothing grows or covers more of the view.
		label.TextTransparency = 0;
		const pulse = TweenService.Create(label, new TweenInfo(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { TextTransparency: 0.45 });
		pulse.Play();
		return () => {
			pulse.Cancel();
			label.TextTransparency = 0;
		};
	}, [alertActive]);
	const hull = math.floor(telemetry.health + 0.5);
	const cooldownText = telemetry.missileCooldown > 0 && !touch ? string.format(" · %.1fs", telemetry.missileCooldown) : "";
	// The status line names the special even while it cycles ("FLR 1.2s"), where the button alone would just count down.
	const specialStatus = specialButton.dimmed && (telemetry.specialCharges ?? 0) > 0 ? `${specialDefinition.short} ${string.format("%.1fs", telemetry.specialCooldown ?? 0)}` : specialButton.text;
	const statusText = `${hull < 100 ? `HULL ${hull} · ` : ""}MSL ${telemetry.missiles}${cooldownText} · ${specialStatus}`;
	const statusColor = telemetry.missiles <= 0 || hull <= 30 ? C.Danger : hull <= 60 ? C.Orange : C.Ivory;
	const fireButton = WeaponRules.FireButton(telemetry.missiles, telemetry.missileCooldown, telemetry.target !== undefined && telemetry.targetDamageable !== false, telemetry.lockProgress);
	const timeRemaining = telemetry.timeRemaining ?? 600;
	const tutorial = getTutorialInstruction(telemetry.tutorialStep, inputMode);
	const progress = telemetry.objectiveTotal !== undefined && telemetry.objectiveTotal > 0
		? `  ${telemetry.objectiveProgress ?? 0}/${telemetry.objectiveTotal}`
		: "";
	// Kill and radio callouts replace the objective line while they last.
	const objectiveLine = callout?.text ?? `${tutorial !== "" ? tutorial : telemetry.objective ?? "Complete the objective"}${progress}`;
	const objectiveColor = callout?.color ?? (tutorial !== "" ? C.Orange : C.Ivory);
	return (
		<frame key="MissionHUD" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<NavigationCue telemetry={telemetry} visible={visible} inputMode={inputMode}/>
			<frame key="DamageFlash" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={damageFlash}>
				<Stroke color={C.Danger} transparency={0.35} thickness={5} />
			</frame>

			<HudText name="ObjectiveText" text={objectiveLine} rectangle={layout.callout} color={objectiveColor} textSize={11} wrap={true} />
			<HudText
				name="MissionTimer"
				text={formatTime(timeRemaining)}
				rectangle={layout.timer}
				color={timeRemaining <= 60 ? C.Danger : C.Ivory}
				textSize={11}
				font={Enum.Font.RobotoMono}
				alignment={Enum.TextXAlignment.Right}
			/>
			<HudText name="WeaponStatus" text={statusText} rectangle={layout.status} color={statusColor} textSize={10} alignment={Enum.TextXAlignment.Right} />
			<HudText
				name="WarningText"
				textRef={warningText}
				text={alertText}
				rectangle={layout.alert}
				color={alertColor}
				textSize={12}
				font={Enum.Font.GothamBlack}
				alignment={Enum.TextXAlignment.Center}
				visible={alertText !== ""}
			/>

			<frame
				ref={joystickRef}
				key="TouchJoystick"
				Active={true}
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.75}
				BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.joystick.x, touch.joystick.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.joystick.width, touch.joystick.height) : UDim2.fromOffset(96, 96)}
				Visible={touch !== undefined}
				Event={{ InputBegan: (_rbx, input) => onJoystickBegan(input) }}
			>
				<Corner scale={0.5} />
				<Stroke color={C.Ivory} transparency={0.75} thickness={1} />
				<frame
					ref={knobRef}
					key="JoystickKnob"
					AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={C.Accent}
					BackgroundTransparency={0.6}
					BorderSizePixel={0}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(36, 36)}
				>
					<Corner scale={0.5} />
				</frame>
			</frame>

			<frame
				key="ThrottleControls"
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.7}
				BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.throttlePill.x, touch.throttlePill.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.throttlePill.width, touch.throttlePill.height) : UDim2.fromOffset(112, 32)}
				Visible={touch !== undefined}
			>
				<Corner scale={0.5} />
				<Stroke transparency={0.8} />
				{/* 44x44 hit areas on the pill's ends overhang the 32px visual. */}
				<textbutton
					key="ThrottleDownButton"
					AnchorPoint={new Vector2(0, 0.5)}
					AutoButtonColor={false}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={UDim2.fromScale(0, 0.5)}
					Selectable={false}
					Size={UDim2.fromOffset(MIN_TOUCH_TARGET, MIN_TOUCH_TARGET)}
					Text="–"
					TextColor3={C.Ivory}
					TextSize={16}
					TextStrokeColor3={C.Ink}
					TextStrokeTransparency={0.5}
					Event={{ Activated: () => onThrottle(throttle - 0.1) }}
				/>
				<Label
					name="ThrottleText"
					text={`${math.floor(throttle * 100 + 0.5)}%`}
					color={C.Ivory}
					textSize={11}
					font={Enum.Font.RobotoMono}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={UDim2.fromScale(0.5, 0.5)}
					size={UDim2.fromOffset(32, 16)}
					textXAlignment={Enum.TextXAlignment.Center}
					stroke={true}
				/>
				<textbutton
					key="ThrottleUpButton"
					AnchorPoint={new Vector2(1, 0.5)}
					AutoButtonColor={false}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={UDim2.fromScale(1, 0.5)}
					Selectable={false}
					Size={UDim2.fromOffset(MIN_TOUCH_TARGET, MIN_TOUCH_TARGET)}
					Text="+"
					TextColor3={C.Ivory}
					TextSize={16}
					TextStrokeColor3={C.Ink}
					TextStrokeTransparency={0.5}
					Event={{ Activated: () => onThrottle(throttle + 0.1) }}
				/>
			</frame>

			<frame key="CombatControls" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
				{touch && (
					<RoundButton
						name="MissileButton"
						text={fireButton.text}
						rectangle={touch.missile}
						filled={fireButton.filled}
						enabled={fireButton.enabled}
						dimmed={fireButton.dimmed}
						textSize={12}
						onActivated={onMissile}
					/>
				)}
				{touch && <RoundButton name="TargetButton" text="TGT" rectangle={touch.target} filled={false} enabled={true} textSize={11} onActivated={onTarget} />}
				{touch && (
					<RoundButton
						name="SpecialButton"
						text={specialButton.text}
						rectangle={touch.special}
						filled={specialButton.filled}
						enabled={specialButton.enabled}
						dimmed={specialButton.dimmed}
						textSize={10}
						onActivated={onSpecial}
					/>
				)}
			</frame>

			{layout.hints && (
				<frame
					key="ControlHints"
					BackgroundTransparency={1}
					Position={UDim2.fromOffset(layout.hints.x, layout.hints.y)}
					Size={UDim2.fromOffset(layout.hints.width, layout.hints.height)}
					Visible={hints.size() > 0}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 14)}
						SortOrder={Enum.SortOrder.LayoutOrder}
						VerticalAlignment={Enum.VerticalAlignment.Center}
					/>
					{hints.map((hint, index) => <FlightHint key={`${hint.action}Hint`} hint={hint} order={index + 1} />)}
				</frame>
			)}
		</frame>
	);
}

export function GameUI({ remotes, controller }: GameUIProps) {
	const [cinematicId,setCinematicId]=useState(0);
	const cinematicNext=useRef<()=>void>(()=>undefined);
	const [screen, setScreen] = useState<Screen>("title");
	const [viewport, setViewport] = useState(new Vector2(568, 320));
	const [slots, setSlots] = useState<SaveSlot[] | undefined>();
	const [persistence, setPersistence] = useState<Persistence>("unavailable");
	const [selectedSlot, setSelectedSlot] = useState(1);
	const [selectedMission, setSelectedMission] = useState(1);
	const [selectedSpecial, setSelectedSpecial] = useState<SpecialKind>(SpecialWeapons.Default);
	const [busy, setBusy] = useState(false);
	const [toast, setToast] = useState<ToastState | undefined>();
	const [telemetry, setTelemetry] = useState(defaultTelemetry);
	const [throttle, setThrottleState] = useState(0.65);
	const [outcome, setOutcome] = useState<OutcomeState>(() => ({
		won: true, missionId: 1, airKills: 0, optionalKills: 0, groundKills: 0, elapsed: 0, par: MissionScore.ParSeconds(MissionCatalog.Get(1)),
		completedPhases: 0, missilesFired: 0, missileHits: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
		score: 0, rank: "D", newBestScore: false, newBestRank: false, saveText: "", saveColor: C.Muted,
	}));
	const [inputMode, setInputMode] = useState<InputMode>(readInputMode);
	const [hintUntil, setHintUntil] = useState(0);
	const [killNotice, setKillNotice] = useState<KillNotice | undefined>();
	const [radioNotice, setRadioNotice] = useState<RadioNotice | undefined>();
	const [fireNotice, setFireNotice] = useState<RadioNotice | undefined>();
	const [damageUntil, setDamageUntil] = useState(0);
	const [loadingProgress, setLoadingProgress] = useState(0);

	const mountedRef = useRef(true);
	const screenRef = useRef<Screen>("title");
	const inMissionRef = useRef(false);
	const requestRef = useRef(0);
	const busyRef = useRef(false);
	const toastRef = useRef(0);
	const throttleRef = useRef(0.65);
	const selectedSlotRef = useRef(1);
	const [confirmSlot, setConfirmSlot] = useState<number>();
	const confirmSlotRef = useRef<number>();
	const slotFocusRef = useRef<number>();
	const selectDefaultRef = useRef<() => void>(() => undefined);
	const selectedMissionRef = useRef(1);
	const selectedSpecialRef = useRef<SpecialKind>(SpecialWeapons.Default);
	const persistenceRef = useRef<Persistence>("unavailable");
	const telemetryRef = useRef(defaultTelemetry());
	const inputModeRef = useRef<InputMode>(inputMode);
	const outcomeWonRef = useRef(true);
	const outcomeMissionRef = useRef(1);
	const rootFrameRef = useRef<Frame>();
	const joystickRef = useRef<Frame>();
	const knobRef = useRef<Frame>();
	const activeJoystickInput = useRef<InputObject>();
	const loadingSerialRef = useRef(0);
	const slotsRef = useRef<SaveSlot[] | undefined>();

	const changeScreen = useCallback((destination: Screen) => {
		screenRef.current = destination;
		inMissionRef.current = destination === "mission";
		setScreen(destination);
	}, []);

	const releaseJoystick = useCallback(() => {
		activeJoystickInput.current = undefined;
		if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		controller.SetInput(0, 0);
	}, [controller]);

	const applyInputMode = useCallback((nextMode: InputMode) => {
		const current = inputModeRef.current;
		if (!shouldAcceptInputModeChange(current, nextMode, activeJoystickInput.current !== undefined)) return;
		if (current === "touch") releaseJoystick();
		inputModeRef.current = nextMode;
		glyphCache.clear();
		if (!mountedRef.current) return;
		setInputMode(nextMode);
		setHintUntil(os.clock() + 6);
	}, [releaseJoystick]);

	const endJoystickTouch = useCallback(() => {
		releaseJoystick();
		applyInputMode(readInputMode());
	}, [applyInputMode, releaseJoystick]);

	// Gamepad focus follows the delete confirmation: KEEP while it is open, then back to that slot's row.
	const setDeleteConfirm = useCallback((slot: number | undefined) => {
		if (slot !== undefined) slotFocusRef.current = slot;
		confirmSlotRef.current = slot;
		setConfirmSlot(slot);
		task.defer(() => selectDefaultRef.current());
	}, []);
	const askDelete = useCallback((slot: number) => setDeleteConfirm(slot), [setDeleteConfirm]);
	const cancelDelete = useCallback(() => setDeleteConfirm(undefined), [setDeleteConfirm]);

	const selectDefault = useCallback(() => {
		const root = rootFrameRef.current;
		if (!root || !mountedRef.current) return;
		const current = screenRef.current;
		const selected = GuiService.SelectedObject;
		if (current === "mission" || current === "loading" || inputModeRef.current !== "gamepad") {
			if (selected && selected.IsDescendantOf(root)) GuiService.SelectedObject = undefined;
			return;
		}
		const screenFrame = root.FindFirstChild(MENU_SCREEN_FRAMES[current]);
		if (!screenFrame) return;
		if (selected && selected.IsDescendantOf(screenFrame)) return;
		const defaultName = current === "cinematic" ? "CinematicSkipButton" : current === "title"
			? "CampaignButton"
			: current === "slots"
				? confirmSlotRef.current !== undefined ? "KeepButton" : `Slot${slotFocusRef.current ?? selectedSlotRef.current}Button`
				: current === "briefing"
					? "LaunchButton"
					: outcomeWonRef.current && outcomeMissionRef.current < MISSION_COUNT ? "Mission1NextMissionButton" : outcomeWonRef.current ? "ReturnToMenuButton" : "RetryButton";
		const target = screenFrame.FindFirstChild(defaultName, true);
		if (target && target.IsA("GuiObject")) GuiService.SelectedObject = target;
	}, []);
	selectDefaultRef.current = selectDefault;

	const goBack = useCallback(() => {
		if (busyRef.current) return;
		if (screenRef.current === "slots" && confirmSlotRef.current !== undefined) setDeleteConfirm(undefined);
		else if (screenRef.current === "slots") changeScreen("title");
		else if (screenRef.current === "briefing") changeScreen("slots");
	}, [changeScreen]);

	const showToast = useCallback((message: string, isError: boolean) => {
		if (!mountedRef.current) return;
		const serial = ++toastRef.current;
		setToast({ message, isError });
		task.delay(4, () => {
			if (mountedRef.current && toastRef.current === serial) setToast(undefined);
		});
	}, []);

	const applyResponseSlots = useCallback((response: CampaignResponse): boolean => {
		const parsed = normalizeSlots(response);
		if (!parsed) return false;
		slotsRef.current = parsed;
		setSlots(parsed);
		const responsePersistence = normalizePersistence(response.persistence);
		persistenceRef.current = responsePersistence;
		setPersistence(responsePersistence);
		return true;
	}, []);

	const invoke = useCallback((action: string, payload?: unknown): LuaTuple<[CampaignResponse | undefined, string | undefined]> => {
		const [ok, raw] = pcall(() => remotes.CampaignRequest.InvokeServer(action, payload));
		if (!ok) return $tuple(undefined, "Command link interrupted. Try again.");
		if (!typeIs(raw, "table")) return $tuple(undefined, "Command rejected the request.");
		const response = raw as CampaignResponse;
		if (response.ok !== true) return $tuple(undefined, safeString(response.error, "Command rejected the request."));
		return $tuple(response, undefined);
	}, [remotes]);

	const beginRequest = useCallback((work: (requestId: number) => void) => {
		if (busyRef.current || !mountedRef.current) return;
		busyRef.current = true;
		setBusy(true);
		const requestId = ++requestRef.current;
		task.spawn(() => {
			const [ok, problem] = pcall(() => work(requestId));
			if (!ok && mountedRef.current && requestRef.current === requestId) {
				warn("SKYBREAK UI request failed:", problem);
				showToast("Command link error. Try again.", true);
			}
			if (mountedRef.current && requestRef.current === requestId) {
				busyRef.current = false;
				setBusy(false);
			}
		});
	}, [showToast]);

	const cancelRequests = useCallback(() => {
		requestRef.current++;
		busyRef.current = false;
		if (mountedRef.current) setBusy(false);
	}, []);

	const loadSlots = useCallback(() => {
		slotsRef.current = undefined;
		setSlots(undefined);
		beginRequest((requestId) => {
			const [response, problem] = invoke("ListSlots");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) {
				persistenceRef.current = "unavailable";
				setPersistence("unavailable");
				showToast(problem ?? "Command link interrupted. Try again.", true);
			} else if (!applyResponseSlots(response)) {
				showToast("Flight records returned an invalid response.", true);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, showToast]);

	const setThrottle = useCallback((value: number) => {
		const adjusted = math.clamp(value, 0, 1);
		throttleRef.current = adjusted;
		setThrottleState(adjusted);
		if (inMissionRef.current) controller.SetThrottle(adjusted);
	}, [controller]);

	const launchMission = useCallback(() => {
		beginRequest((requestId) => {
			const [response, problem] = invoke("StartMission", { slot: selectedSlot, missionId: selectedMission, special: selectedSpecialRef.current });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else {
				if (response.slots) applyResponseSlots(response);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedMission, selectedSlot, showToast]);

	const startMission=useCallback(()=>{
		if(busyRef.current)return;
		const chapter=selectedMissionRef.current-1;
		// A chapter already seen on this slot (retry or replay) goes straight to launch.
		const seen=slots?.[selectedSlotRef.current-1]?.cutscenesSeen;
		if(seen && seen.includes(chapter)){launchMission();return;}
		cinematicNext.current=launchMission;
		setCinematicId(chapter);
		changeScreen("cinematic");
	},[launchMission,changeScreen,slots]);

	const returnToMenu = useCallback(() => {
		cancelRequests();
		releaseJoystick();
		controller.Stop();
		changeScreen("title");
		setMenuCamera();
		beginRequest((requestId) => {
			const [response, problem] = invoke("ReturnToMenu");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command link interrupted. Try again.", true);
			else if (response.slots) applyResponseSlots(response);
		});
	}, [applyResponseSlots, beginRequest, cancelRequests, changeScreen, controller, invoke, releaseJoystick, showToast]);

	const restartMission = useCallback((missionId: number) => {
		beginRequest((requestId) => {
			const [returned, returnError] = invoke("ReturnToMenu");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!returned) {
				showToast(returnError ?? "Command link interrupted. Try again.", true);
				return;
			}
			if (returned.slots) applyResponseSlots(returned);
			task.wait(0.16);
			if (!mountedRef.current || requestRef.current !== requestId) return;
			selectedMissionRef.current = missionId;
			setSelectedMission(missionId);
			changeScreen("briefing");
		});
	}, [applyResponseSlots, beginRequest, changeScreen, invoke, selectedSlot, showToast]);

	const retryMission = useCallback(() => restartMission(selectedMissionRef.current), [restartMission]);
	const nextMission = useCallback(() => restartMission(math.min(MISSION_COUNT,selectedMissionRef.current+1)), [restartMission]);
	// Stable handlers so the memoised menu screens bail out of mission-time re-renders.
	const openCampaign = useCallback(() => { if (!busyRef.current) { changeScreen("slots"); loadSlots(); } }, [changeScreen, loadSlots]);
	const chooseSlot = useCallback((slot: number) => {
		const current = slotsRef.current;
		if (busyRef.current || !current?.[slot - 1]) return;
		const missionId = resumeMission(current[slot - 1]);
		selectedSlotRef.current = slot; selectedMissionRef.current = missionId;
		setSelectedSlot(slot); setSelectedMission(missionId);
		// The slot remembers its last loadout; a fresh slot starts on the default special.
		const remembered = current[slot - 1].special;
		const special: SpecialKind = SpecialWeapons.IsKind(remembered) ? remembered : SpecialWeapons.Default;
		selectedSpecialRef.current = special; setSelectedSpecial(special);
		changeScreen("briefing");
	}, [changeScreen]);
	const deleteSlot = useCallback((slot: number) => {
		setDeleteConfirm(undefined);
		beginRequest((requestId) => {
			const [response, problem] = invoke("DeleteSlot", { slot });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else if (!applyResponseSlots(response)) showToast("Flight records returned an invalid response.", true);
			else if (response.persistence === "unavailable") showToast(`Save ${string.format("%02d", slot)} deleted here, but the cloud save has not confirmed yet.`, true);
			else showToast(`Save ${string.format("%02d", slot)} deleted.`, false);
		});
	}, [applyResponseSlots, beginRequest, invoke, setDeleteConfirm, showToast]);
	const chooseMission = useCallback((missionId: number) => { selectedMissionRef.current = missionId; setSelectedMission(missionId); }, []);
	const chooseSpecial = useCallback((kind: SpecialKind) => { selectedSpecialRef.current = kind; setSelectedSpecial(kind); }, []);
	// Always send: the server either launches (guided or blind) or answers with `fireDenied`, so a press is never silent.
	const fireMissile = useCallback(() => controller.FireMissile(), [controller]);
	const cycleTarget = useCallback(() => controller.CycleTarget(), [controller]);
	const fireSpecial = useCallback(() => controller.Special(), [controller]);

	const moveJoystick = useCallback((input: InputObject) => {
		const joystick = joystickRef.current;
		const knob = knobRef.current;
		if (!joystick || !knob || !inMissionRef.current) return;
		const center = joystick.AbsolutePosition.add(joystick.AbsoluteSize.div(2));
		let offset = new Vector2(input.Position.X, input.Position.Y).sub(center);
		const radius = math.max(1, joystick.AbsoluteSize.X * 0.34);
		if (offset.Magnitude > radius) offset = offset.Unit.mul(radius);
		let vector = new Vector2(offset.X / radius, -offset.Y / radius);
		if (vector.Magnitude < 0.08) vector = Vector2.zero;
		knob.Position = new UDim2(0.5, offset.X, 0.5, offset.Y);
		controller.SetInput(vector.X, vector.Y);
	}, [controller]);

	const joystickBegan = useCallback((input: InputObject) => {
		if (!inMissionRef.current || inputModeRef.current !== "touch" || input.UserInputType !== Enum.UserInputType.Touch) return;
		if (activeJoystickInput.current !== undefined) return;
		activeJoystickInput.current = input;
		moveJoystick(input);
	}, [moveJoystick]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			requestRef.current++;
			toastRef.current++;
			activeJoystickInput.current = undefined;
			controller.SetInput(0, 0);
			controller.Stop();
		};
	}, [controller]);

	useEffect(() => {
		const refresh = () => applyInputMode(readInputMode());
		const connections = [UserInputService.LastInputTypeChanged.Connect(refresh)];
		const [hasPreferred, signal] = pcall(() => UserInputService.GetPropertyChangedSignal("PreferredInput"));
		if (hasPreferred) connections.push(signal.Connect(refresh));
		refresh();
		return () => {
			for (const connection of connections) connection.Disconnect();
		};
	}, [applyInputMode]);

	useEffect(() => {
		const changed = UserInputService.InputChanged.Connect((input) => {
			const active = activeJoystickInput.current;
			if (active && input === active) moveJoystick(input);
		});
		const ended = UserInputService.InputEnded.Connect((input) => {
			const active = activeJoystickInput.current;
			if (active && input === active) endJoystickTouch();
		});
		const focus = UserInputService.WindowFocusReleased.Connect(endJoystickTouch);
		return () => {
			changed.Disconnect();
			ended.Disconnect();
			focus.Disconnect();
		};
	}, [endJoystickTouch, moveJoystick]);

	useEffect(() => {
		if (screen !== "mission") releaseJoystick();
	}, [releaseJoystick, screen]);

	useEffect(() => {
		task.defer(selectDefault);
	}, [busy, inputMode, screen, selectDefault]);

	// Leaving the slot list drops any half-finished delete confirmation.
	useEffect(() => {
		slotFocusRef.current = undefined;
		if (screen !== "slots" && confirmSlotRef.current !== undefined) setDeleteConfirm(undefined);
	}, [screen, setDeleteConfirm]);

	useEffect(() => {
		const began = UserInputService.InputBegan.Connect((input) => {
			if (screenRef.current === "mission" || GuiService.MenuIsOpen) return;
			if (inputModeFromInputType(input.UserInputType.Name) !== "gamepad") return;
			if (input.KeyCode === Enum.KeyCode.ButtonB) goBack();
			task.defer(selectDefault);
		});
		const changed = UserInputService.InputChanged.Connect((input) => {
			if (screenRef.current === "mission" || input.KeyCode !== Enum.KeyCode.Thumbstick1) return;
			if (GuiService.SelectedObject === undefined && input.Position.Magnitude > 0.5) task.defer(selectDefault);
		});
		return () => {
			began.Disconnect();
			changed.Disconnect();
		};
	}, [goBack, selectDefault]);

	useEffect(() => {
		const connection = remotes.MissionState.OnClientEvent.Connect((raw: unknown) => {
			if (!mountedRef.current || !typeIs(raw, "table")) return;
			const payload = raw as MissionMessage;
			if (payload.kind === "Loading") {
				const loading = payload as MissionLoading;
				const slot = math.clamp(math.floor(finite(loading.slot, selectedSlotRef.current)), 1, 4);
				const missionId = MissionCatalog.IsValidId(loading.missionId) ? loading.missionId : 1;
				selectedSlotRef.current = slot; setSelectedSlot(slot);
				selectedMissionRef.current = missionId; setSelectedMission(missionId);
				toastRef.current++; setToast(undefined);
				setLoadingProgress(0);
				changeScreen("loading");
				const serial = ++loadingSerialRef.current;
				const alive = () => mountedRef.current && loadingSerialRef.current === serial && screenRef.current === "loading";
				task.spawn(() => {
					const expected = finite(loading.expectedParts, 0) > 0 ? loading.expectedParts : undefined;
					const ready = preloadMission(loading.aircraft, expected, alive, (fraction) => { if (alive()) setLoadingProgress(fraction); });
					if (ready) remotes.CombatAction.FireServer({ action: "Ready" });
				});
				task.delay(LOADING_CLIENT_TIMEOUT, () => {
					if (!alive()) return;
					loadingSerialRef.current++;
					changeScreen("briefing");
					showToast("The aircraft never reported ready. Request another launch.", true);
					beginRequest((requestId) => {
						const [response] = invoke("ReturnToMenu");
						if (!mountedRef.current || requestRef.current !== requestId) return;
						if (response?.slots) applyResponseSlots(response);
					});
				});
			} else if (payload.kind === "Started") {
				loadingSerialRef.current++;
				const started = payload as MissionStarted;
				const slot = math.clamp(math.floor(finite(started.slot, selectedSlotRef.current)), 1, 4);
				const missionId = MissionCatalog.IsValidId(started.missionId) ? started.missionId : 1;
				selectedSlotRef.current = slot;
				setSelectedSlot(slot);
				selectedMissionRef.current = missionId;
				setSelectedMission(missionId);
				toastRef.current++;
				setToast(undefined);
				setKillNotice(undefined);
				setDamageUntil(0);
				const resetTelemetry = defaultTelemetry();
				resetTelemetry.missionId = missionId;
				if (missionId >= 2) {
					resetTelemetry.phase = "intercept";
					resetTelemetry.objective = MissionCatalog.Get(missionId).phases[0].label;
					resetTelemetry.objectiveTotal = 3;
					resetTelemetry.tutorialStep = "";
				}
				telemetryRef.current = resetTelemetry;
				setTelemetry(resetTelemetry);
				if (!controller.Start(started)) {
					cancelRequests();
					changeScreen("briefing");
					showToast("Aircraft link failed. Request another launch.", true);
					beginRequest((requestId) => {
						const [response] = invoke("ReturnToMenu");
						if (!mountedRef.current || requestRef.current !== requestId) return;
						if (response?.slots) applyResponseSlots(response);
					});
					return;
				}
				controller.SetThrottle(throttleRef.current);
				changeScreen("mission");
				const [ok, initial] = pcall(() => controller.GetTelemetry());
				if (ok && typeIs(initial, "table")) {
					const sanitized = sanitizeTelemetry(initial as Telemetry, telemetryRef.current);
					telemetryRef.current = sanitized;
					setTelemetry(sanitized);
				}
			} else if (payload.kind === "Completed" || payload.kind === "Failed") {
				if (!inMissionRef.current) return;
				const finished = payload as MissionFinished;
				releaseJoystick();
				controller.Stop();
				setMenuCamera();
				const current = telemetryRef.current;
				const won = finished.kind === "Completed";
				const missionId = MissionCatalog.IsValidId(finished.missionId) ? finished.missionId : current.missionId ?? 1;
				selectedMissionRef.current = missionId;
				setSelectedMission(missionId);
				outcomeWonRef.current = won;
				outcomeMissionRef.current = missionId;
				if(won && missionId===MISSION_COUNT) {
					setCinematicId(MISSION_COUNT);cinematicNext.current=()=>changeScreen("outcome");changeScreen("cinematic");
				} else changeScreen("outcome");
				const resultPersistence = normalizePersistence(finished.persistence ?? persistenceRef.current);
				const saveText = won && finished.saved === true && resultPersistence === "cloud"
					? "FLIGHT RECORD SAVED TO CLOUD"
					: resultPersistence === "session"
						? "RESULT HELD FOR THIS SESSION ONLY"
						: resultPersistence === "unavailable"
							? "SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST"
							: won ? "RESULT RECEIVED — SAVE NOT CONFIRMED" : "";
				const count = (value: unknown, fallback = 0) => math.max(0, math.floor(finite(value, fallback)));
				const kills = count(finished.kills, current.kills);
				const groundKills = math.min(kills, count(finished.groundKills, current.groundKills ?? 0));
				const elapsed = math.max(0, finite(finished.elapsed, current.elapsed));
				const par = finite(finished.par, 0) > 0 ? finished.par! : MissionScore.ParSeconds(MissionCatalog.Get(missionId));
				const missilesFired = count(finished.missilesFired);
				const missileHits = math.min(missilesFired, count(finished.missileHits));
				const damageTaken = math.clamp(finite(finished.damageTaken, 100 - current.health), 0, 100);
				// The server scores the run; an older or fallback message is scored here for display only.
				const fallback = MissionScore.Compute({ won, airKills: kills - groundKills, groundKills, elapsed, par, missilesFired, missileHits, damageTaken });
				setOutcome({
					won,
					missionId,
					airKills: kills - groundKills,
					optionalKills: count(finished.optionalKills),
					groundKills,
					elapsed,
					par,
					completedPhases: count(finished.completedPhases, won ? MissionCatalog.Get(missionId).phases.size() : 0),
					missilesFired,
					missileHits,
					damageTaken,
					lowestHealth: math.clamp(finite(finished.lowestHealth, current.health), 0, 100),
					evades: count(finished.evades),
					score: finite(finished.score, -1) >= 0 ? math.floor(finished.score!) : fallback.score,
					rank: MissionScore.IsRank(finished.rank) ? finished.rank : fallback.rank,
					newBestScore: finished.newBestScore === true,
					newBestRank: finished.newBestRank === true,
					bestScore: finite(finished.bestScore, -1) >= 0 ? math.floor(finished.bestScore!) : undefined,
					bestRank: MissionScore.IsRank(finished.bestRank) ? finished.bestRank : undefined,
					reason: safeString(finished.reason, ""),
					saveText,
					saveColor: won && finished.saved === true && resultPersistence === "cloud" ? C.Accent : resultPersistence === "cloud" ? C.Muted : C.Orange,
				});
			}
		});
		// HUD numbers (10 Hz, unreliable) and text/target changes (reliable HudState) are
		// merged by the controller, which already folds in its locally predicted
		// boundary warning; the HUD re-renders once per merged update.
		const unsubscribe = controller.OnTelemetry((merged) => {
			if (!mountedRef.current || !inMissionRef.current) return;
			const previous = telemetryRef.current;
			const sanitized = sanitizeTelemetry(merged, previous);
			if (sanitized.kills > previous.kills) setKillNotice({ kills: sanitized.kills, total: sanitized.total, until: os.clock() + 3 });
			if (sanitized.radio !== undefined && sanitized.radioSerial !== undefined && sanitized.radioSerial !== previous.radioSerial) setRadioNotice({ text: sanitized.radio, until: os.clock() + (sanitized.radioSeconds ?? RADIO_SECONDS) });
			if (sanitized.fireDenied !== undefined && sanitized.fireDeniedSerial !== undefined && sanitized.fireDeniedSerial !== previous.fireDeniedSerial) setFireNotice({ text: FIRE_DENIED_TEXT[sanitized.fireDenied], until: os.clock() + FIRE_DENIED_SECONDS });
			if (sanitized.health < previous.health) setDamageUntil(os.clock() + 0.45);
			telemetryRef.current = sanitized;
			setTelemetry(sanitized);
		});
		return () => { connection.Disconnect(); unsubscribe(); };
	}, [applyResponseSlots, beginRequest, cancelRequests, changeScreen, controller, invoke, releaseJoystick, remotes, showToast]);

	useEffect(() => {
		let sampleClock = 0;
		const connection = RunService.RenderStepped.Connect((deltaTime) => {
			if (!mountedRef.current) return;
			if (!NO_MENU_CAMERA.has(screenRef.current)) setMenuCamera();
			else if (screenRef.current === "mission") {
				// Server telemetry already refreshes the HUD at 10 Hz. This resample only
				// exists so the airspace warning reacts between packets, so it re-renders
				// solely when that flag flips rather than on every sample.
				sampleClock += deltaTime;
				if (sampleClock >= 0.1) {
					sampleClock = 0;
					// A plain boolean read on the predicted state: no table copy, no pcall closure.
					const warning = controller.GetBoundaryWarning();
					const current = telemetryRef.current;
					if (warning !== (current.boundaryWarning === true)) {
						const sampled = { ...current, boundaryWarning: warning };
						telemetryRef.current = sampled;
						setTelemetry(sampled);
					}
				}
			}
		});
		return () => connection.Disconnect();
	}, [controller]);

	useEffect(() => {
		task.defer(() => {
			const root = rootFrameRef.current;
			if (mountedRef.current && root) setViewport(root.AbsoluteSize);
		});
	}, []);

	const menu = useMemo(() => getMenuLayout(viewport.X, viewport.Y), [viewport]);
	const selectedSave = slots?.[selectedSlot - 1];
	const rootChange = useMemo(() => ({ AbsoluteSize: (root: Frame) => mountedRef.current && setViewport(root.AbsoluteSize) }), []);
	const now = os.clock();
	let callout: Callout | undefined;
	if (fireNotice && now < fireNotice.until) {
		callout = { text: fireNotice.text, color: C.Orange };
	} else if (radioNotice && now < radioNotice.until) {
		callout = { text: radioNotice.text, color: C.Accent };
	} else if (killNotice && now < killNotice.until) {
		// Progress is the phase objective's own count; raw kills include optional fighters and ground.
		const total = telemetry.objectiveTotal ?? 0;
		callout = { text: total > 0 ? `Hostile down  ${telemetry.objectiveProgress ?? 0}/${total}` : "Hostile down", color: C.AccentHot };
	}
	const toastRectangle = getToastLayout(viewport.X, viewport.Y, screen === "mission" ? undefined : menu);
	const menuHints: ControlHint[] = [{ keyCode: "ButtonA", label: "A", action: "SELECT" }];
	if (screen === "slots" || screen === "briefing") menuHints.push({ keyCode: "ButtonB", label: "B", action: "BACK" });
	const menuHintsRectangle = getMenuHintsLayout(viewport.X, viewport.Y, menu);

	return (
		<InputModeContext.Provider value={inputMode}>
			<screengui key="SkybreakBackdrop" DisplayOrder={19} IgnoreGuiInset={true} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.None}>
				<MenuBackdrop visible={!NO_MENU_CAMERA.has(screen)} mode={menu.mode} />
			</screengui>
			<screengui key="SkybreakUI" DisplayOrder={20} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame ref={rootFrameRef} key="Root" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Change={rootChange}>
					{screen === "cinematic" && <RelayCinematic id={cinematicId} viewport={viewport} onFinish={()=>{const continueStory=cinematicNext.current;changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing");continueStory();}} onCancel={()=>changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing")}/>}
					<TitleScreen visible={screen === "title"} menu={menu} onCampaign={openCampaign} />
					<CampaignScreen visible={screen === "slots"} menu={menu} slots={slots} busy={busy} persistence={persistence} onBack={goBack} onSlot={chooseSlot} confirmSlot={confirmSlot} onAskDelete={askDelete} onCancelDelete={cancelDelete} onDeleteSlot={deleteSlot} />
					<BriefingScreen visible={screen === "briefing"} menu={menu} selectedSlot={selectedSlot} selectedMission={selectedMission} slot={selectedSave} busy={busy} special={selectedSpecial} onBack={goBack} onLaunch={startMission} onMission={chooseMission} onSpecial={chooseSpecial} />
					<LoadingScreen visible={screen === "loading"} missionId={selectedMission} progress={loadingProgress} viewport={viewport} />
					<MissionHud
						visible={screen === "mission"}
						viewport={viewport}
						inputMode={inputMode}
						telemetry={telemetry}
						throttle={throttle}
						callout={callout}
						introduction={telemetry.elapsed < 10 || now < hintUntil}
						damageFlash={now < damageUntil}
						joystickRef={joystickRef}
						knobRef={knobRef}
						onJoystickBegan={joystickBegan}
						onThrottle={setThrottle}
						onMissile={fireMissile}
						onTarget={cycleTarget}
						onSpecial={fireSpecial}
					/>
					<OutcomeScreen visible={screen === "outcome"} menu={menu} outcome={outcome} busy={busy} onRetry={retryMission} onReturn={returnToMenu} onNext={nextMission} />
					<HintRow
						name="MenuHints"
						hints={menuHints}
						rectangle={menuHintsRectangle}
						alignment={menu.mode === "side" ? Enum.HorizontalAlignment.Right : Enum.HorizontalAlignment.Left}
						visible={inputMode === "gamepad" && !NO_MENU_CAMERA.has(screen)}
					/>
					{toast !== undefined && (
						<textlabel
							key="StatusToast"
							Position={UDim2.fromOffset(toastRectangle.x, toastRectangle.y)}
							Size={UDim2.fromOffset(toastRectangle.width, toastRectangle.height)}
							BackgroundColor3={C.Ink}
							BackgroundTransparency={0.15}
							BorderSizePixel={0}
							Font={Enum.Font.GothamMedium}
							Text={toast.message}
							TextColor3={toast.isError ? C.Danger : C.Ivory}
							TextSize={12}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Center}
							ZIndex={20}
						>
							<Corner />
							<Stroke color={toast.isError ? C.Danger : C.Accent} transparency={0.45} />
							<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
						</textlabel>
					)}
				</frame>
			</screengui>
		</InputModeContext.Provider>
	);
}

export interface GameUIMount {
	unmount: () => void;
}

export function mountGameUI(parent: Instance, remotes: Remotes, controller: FlightController): GameUIMount {
	const root = ReactRoblox.createRoot(parent);
	root.render(<GameUI remotes={remotes} controller={controller} />);
	return {
		unmount: () => root.unmount(),
	};
}
