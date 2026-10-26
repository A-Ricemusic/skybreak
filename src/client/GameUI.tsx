import { stickVector, TouchSticks } from "../shared/TouchSticks";
import { FlightMath } from "../shared/FlightMath";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import { flightWarning, LOW_ALTITUDE } from "../shared/FlightWarnings";
import { evadeGauge } from "../shared/EvadeGauge";
import { RadioQueue } from "../shared/RadioQueue";
import { effectiveHudScale, type PlayerSettings, type SettingKey } from "../shared/PlayerSettings";
import { EvadeButton, PauseOverlay, Radar, SettingsSheet } from "./HudControls";
import { SettingsStore, useSettings } from "./SettingsStore";
import type { FlightTrend } from "./FlightController";
import {
	CAMPAIGN_HEADER_GAP,
	CAMPAIGN_HEADER_HEIGHT,
	getSaveSlotLayout,
	getSlotListCanvasHeight,
	getSlotListHeight,
	SAVE_SLOT_GAP,
	SAVE_SLOT_SCROLLBAR_LANE,
	type SaveSlotLayout,
} from "../shared/SaveSlotLayout";
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
import { ACT_NAMES, ACT_NUMERALS, ACTS, environmentName, MissionCatalog, MISSION_COUNT, REGION_NAMES } from "../shared/MissionCatalog";
import { MENU_JET_POSITION } from "../shared/MenuWorldGeometry";
import { MissionScore, type MissionRank } from "../shared/MissionScore";
import { WeaponRules } from "../shared/WeaponRules";
import { GameConfig } from "../shared/GameConfig";
import { SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";
import {
	ARCHIVE_GAP,
	ARCHIVE_HEADER_HEIGHT,
	ARCHIVE_TAB_HEIGHT,
	BRIEFING_GAP,
	BRIEFING_HEADER_SPACING,
	BRIEFING_LINE_HEIGHT,
	BRIEFING_STORY_LINE_HEIGHT,
	getArchiveCanvasHeight,
	getArchiveGrid,
	getBriefingLayout,
} from "../shared/BriefingLayout";
import { C, HEX, HUD, HUD_FONT_BOLD } from "./Theme";
import { HudLabel, InstrumentBox, Reticle, StatusPanel, WarningBox } from "./AceHud";
import { clockLines, instrumentValue, statusLine } from "../shared/HudInstruments";
import { LoadoutPicker } from "./LoadoutPicker";
import { DifficultyPicker } from "./DifficultyPicker";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { NavigationCue } from "./NavigationCue";
import { RelayCinematic } from "./RelayCinematic";
import { FlightController } from "./FlightController";
import { CameraShake } from "./CameraShake";
import { KillFlash, KillMarker } from "./KillMarker";
import { ImpactFeedback, KillSnapshot } from "../shared/ImpactFeedback";
import { LoadingScreen } from "./LoadingScreen";
import { preloadMission } from "./MissionPreload";
import {
	getEvadeHint,
	getSpecialHint,
	getFlightHints,
	getHudLayout,
	getKillMarkerLayout,
	getMenuHintsLayout,
	getMenuLayout,
	getMenuSceneOpening,
	getToastLayout,
	getTutorialInstruction,
	inputModeFromInputType,
	JOYSTICK_SIZE,
	MAX_FLIGHT_HINTS,
	type HudOptions,
	MIN_TOUCH_TARGET,
	inputModeFromPreferred,
	shouldAcceptInputModeChange,
	type ControlHint,
	type InputMode,
	type MenuLayout,
	type Rectangle,
} from "../shared/UILayout";


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
const MISSION_END_HOLD = 1.2;

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
	/** Level the sortie was flown on, when the server said. */
	difficulty?: DifficultyKind;
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
/** Rectangle in a scaled HUD frame -> root pixels. */
function scaleRectangle(rectangle: Rectangle, scale: number): Rectangle {
	return { x: rectangle.x * scale, y: rectangle.y * scale, width: rectangle.width * scale, height: rectangle.height * scale };
}
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
		timeRemaining: GameConfig.Campaign.MissionTimeLimit,
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
			difficulty: Difficulty.IsKind(source.difficulty) ? source.difficulty : undefined,
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
		evadeCharges: typeIs(payload.evadeCharges, "number") && finite(payload.evadeCharges, -1) >= 0 ? math.clamp(math.floor(payload.evadeCharges), 0, 9) : undefined,
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
		timeRemaining: math.clamp(finite(payload.timeRemaining, previous.timeRemaining ?? GameConfig.Campaign.MissionTimeLimit), 0, GameConfig.Campaign.MissionTimeLimit),
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
		aceKilled: payload.aceKilled === true,
		optionalKills: math.max(0, math.floor(finite(payload.optionalKills, previous.optionalKills ?? 0))),
		incomingDistance: typeIs(payload.incomingDistance, "number") ? math.max(0, finite(payload.incomingDistance, 0)) : undefined,
	};
}

function resumeMission(slot?: SaveSlot): number {
	return slot?.currentMission ?? 1;
}

function killSnapshot(telemetry: Telemetry): KillSnapshot {
	// `kills` is required destructions only; raiders still earn a SPLASH callout.
	return { kills: telemetry.kills + (telemetry.optionalKills ?? 0), groundKills: telemetry.groundKills ?? 0, aceKilled: telemetry.aceKilled === true };
}

/** Screen point (HUD-root pixels) of the target that just died, if it was the selected one and on screen. */
function killedTargetPoint(target: Model | undefined, root: Frame | undefined): Vector2 | undefined {
	const camera = Workspace.CurrentCamera;
	// The server destroys a killed target, so a still-parented selection was someone else.
	if (!target || target.Parent !== undefined || !camera || !root) return undefined;
	const [ok, pivot] = pcall(() => target.GetPivot());
	if (!ok) return undefined;
	const [screen, visible] = camera.WorldToViewportPoint(pivot.Position);
	if (!visible) return undefined;
	const point = new Vector2(screen.X, screen.Y).sub(root.AbsolutePosition);
	return point.X >= 0 && point.Y >= 0 && point.X <= root.AbsoluteSize.X && point.Y <= root.AbsoluteSize.Y ? point : undefined;
}

function missileReady(telemetry: Telemetry): boolean {
	return telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
}

const MENU_FOV = 50;
const MENU_TAN_HALF_FOV = math.tan(math.rad(MENU_FOV / 2));
let menuCameraViewport: Vector2 | undefined;
let menuCameraSheet = false;
let menuCameraOpening = 0.5;
function setMenuCamera() {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	const size = camera.ViewportSize;
	const clock = os.clock();
	const sway = new Vector3(math.sin(clock * 0.11) * 2, math.sin(clock * 0.07) * 0.8, 0);
	let eye = MENU_JET.add(MENU_EYE_OFFSET);
	let focus: Vector3;
	// The layout solver only re-runs when the viewport changes, not every menu frame.
	if (menuCameraViewport !== size) {
		menuCameraViewport = size;
		const layout = getMenuLayout(size.X, size.Y);
		menuCameraSheet = layout.mode === "sheet";
		menuCameraOpening = getMenuSceneOpening(size.X, layout);
	}
	if (menuCameraSheet) {
		eye = MENU_JET.add(MENU_EYE_OFFSET.mul(1.8));
		focus = MENU_JET.sub(new Vector3(0, 20, 0));
	} else {
		// Centre the jet in the open strip right of the panel. A narrow strip
		// (phones) pulls the camera back so the whole aircraft still fits in it.
		const aspect = size.X / math.max(1, size.Y);
		const open = 1 - menuCameraOpening;
		const distance = math.clamp(0.5 / open, 1, 1.45);
		eye = MENU_JET.add(MENU_EYE_OFFSET.mul(distance));
		const screenX = (menuCameraOpening + open * 0.5) * 2 - 1;
		const lateral = screenX * MENU_EYE_OFFSET.Magnitude * distance * MENU_TAN_HALF_FOV * aspect;
		const cameraLeft = MENU_EYE_OFFSET.Cross(Vector3.yAxis).Unit;
		focus = MENU_JET.add(cameraLeft.mul(lateral));
	}
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = CFrame.lookAt(eye.add(sway), focus);
	camera.FieldOfView = MENU_FOV;
}

function MenuBackdrop({ visible, menu, viewport }: { visible: boolean; menu: MenuLayout; viewport: Vector2 }) {
	const side = menu.mode === "side";
	// Ink sits solidly behind the copy and clears just past the panel edge. The
	// backdrop ignores the safe-area inset, hence the small allowance.
	const opening = getMenuSceneOpening(viewport.X, menu) + 0.03;
	const sheetTop = math.clamp(menu.panel.y / math.max(1, viewport.Y), 0.25, 0.8);
	return (
		<frame key="Backdrop" BackgroundColor3={C.Ink} BackgroundTransparency={0} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={visible} ZIndex={0}>
			<uigradient
				Rotation={side ? 0 : 90}
				Transparency={side
					? new NumberSequence([
						new NumberSequenceKeypoint(0, 0.06),
						new NumberSequenceKeypoint(opening * 0.6, 0.12),
						new NumberSequenceKeypoint(opening - 0.04, 0.24),
						new NumberSequenceKeypoint(opening + 0.08, 0.82),
						new NumberSequenceKeypoint(opening + 0.18, 1),
						new NumberSequenceKeypoint(1, 1),
					])
					: new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(sheetTop - 0.2, 1),
						new NumberSequenceKeypoint(sheetTop - 0.05, 0.45),
						new NumberSequenceKeypoint(sheetTop + 0.05, 0.12),
						new NumberSequenceKeypoint(1, 0.04),
					])}
			/>
		</frame>
	);
}

function panelPosition(menu: MenuLayout) {
	return { Position: UDim2.fromOffset(menu.panel.x, menu.panel.y), Size: UDim2.fromOffset(menu.panel.width, menu.panel.height) };
}

function missionNumber(id: number): string {
	return string.format("%02d", id);
}

function actLabel(act: number): string {
	return `ACT ${ACT_NUMERALS[act] ?? tostring(act)} · ${ACT_NAMES[act] ?? ""}`;
}

function completedCount(slot?: SaveSlot, act?: number): number {
	let count = 0;
	for (const blueprint of MissionCatalog.All()) {
		if ((act === undefined || blueprint.act === act) && slot?.missions?.[blueprint.id]?.completed === true) count++;
	}
	return count;
}

/** Missions unlock in order: the first not-yet-completed mission is the furthest playable one. */
function unlockedThrough(slot?: SaveSlot): number {
	let unlocked = 1;
	for (let id = 1; id < MISSION_COUNT; id++) {
		if (slot?.missions?.[id]?.completed) unlocked = id + 1;
		else break;
	}
	return unlocked;
}

/** A 44px header row: square back button, then a title over a one-line status. */
function ScreenHeader({ name, backName, enabled = true, title, subtitle, subtitleColor = C.Muted, compact, onBack }: {
	name: string;
	backName: string;
	enabled?: boolean;
	title: string;
	subtitle: string;
	subtitleColor?: Color3;
	compact: boolean;
	onBack: () => void;
}) {
	const textLeft = MIN_TOUCH_TARGET + 12;
	return (
		<frame key={name} BackgroundTransparency={1} Size={new UDim2(1, 0, 0, MIN_TOUCH_TARGET)}>
			<ActionButton name={backName} text="‹" size={UDim2.fromOffset(MIN_TOUCH_TARGET, MIN_TOUCH_TARGET)} enabled={enabled} textSize={22} onActivated={onBack} />
			<Label name={`${name}Title`} text={title} textSize={compact ? 18 : 22} minTextSize={12} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(textLeft, 1)} size={new UDim2(1, -textLeft, 0, compact ? 22 : 25)} />
			<Label name={`${name}Status`} text={subtitle} color={subtitleColor} textSize={10} minTextSize={8} font={Enum.Font.GothamBold} anchorPoint={new Vector2(0, 1)} position={new UDim2(0, textLeft, 1, -2)} size={new UDim2(1, -textLeft, 0, 13)} />
		</frame>
	);
}

function TitleScreenImpl({ visible, menu, onCampaign, onSettings }: { visible: boolean; menu: MenuLayout; onCampaign: () => void; onSettings: () => void }) {
	const compact = menu.compact;
	const tiny = menu.panel.height < 220;
	// The hero copy reads best as a short column, even when the panel is wide.
	const contentWidth = math.min(menu.panel.width, 420);
	return (
		<frame key="TitleScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="TitleContent" BackgroundTransparency={1} Position={UDim2.fromOffset(menu.panel.x, menu.panel.y)} Size={UDim2.fromOffset(contentWidth, menu.panel.height)}>
				<uilistlayout
					Padding={new UDim(0, tiny ? 4 : 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={menu.mode === "sheet" ? Enum.VerticalAlignment.Bottom : Enum.VerticalAlignment.Center}
				/>
				<frame key="Accent" BackgroundColor3={C.Accent} BorderSizePixel={0} LayoutOrder={1} Size={UDim2.fromOffset(32, 2)} />
				<textlabel
					key="Title"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, tiny ? 36 : compact ? 52 : 76)}
					Text="SKYBREAK"
					TextColor3={C.Ivory}
					TextScaled={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<uitextsizeconstraint MaxTextSize={compact ? 48 : 70} MinTextSize={28} />
				</textlabel>
				<Label name="Subtitle" text="BROKEN RELAY" color={C.Orange} textSize={compact ? 11 : 13} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 16)} layoutOrder={3} />
				<Label
					name="Blurb"
					visible={!tiny}
					text={`Follow a missing mentor’s recordings through ${MISSION_COUNT} sorties. Uncover the coup. Bring the coast home.`}
					color={C.Muted}
					textSize={compact ? 13 : 15}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
					layoutOrder={4}
				/>
				<Label name="TitleMeta" visible={!tiny} text={`3 ACTS  ·  ${MISSION_COUNT} SORTIES  ·  4 FLIGHT RECORDS`} color={C.Faint} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 14)} layoutOrder={5} />
				<frame key="Spacer" BackgroundTransparency={1} LayoutOrder={6} Size={UDim2.fromOffset(1, tiny ? 2 : compact ? 6 : 14)} />
				<ActionButton name="CampaignButton" text="CAMPAIGN  ›" primary={true} layoutOrder={7} size={UDim2.fromOffset(math.min(260, contentWidth), tiny ? 44 : compact ? 48 : 52)} textSize={15} onActivated={onCampaign} />
				<ActionButton name="SettingsButton" text="SETTINGS" layoutOrder={8} size={UDim2.fromOffset(math.min(260, contentWidth), 44)} textSize={12} onActivated={onSettings} />
			</frame>
		</frame>
	);
}
const TitleScreen = React.memo(TitleScreenImpl);

function SaveSlotRow({
	number,
	slot,
	busy,
	confirming,
	layout,
	onSlot,
	onAskDelete,
	onConfirmDelete,
	onCancelDelete,
}: {
	number: number;
	slot?: SaveSlot;
	busy: boolean;
	confirming: boolean;
	layout: SaveSlotLayout;
	onSlot: (slot: number) => void;
	onAskDelete: (slot: number) => void;
	onConfirmDelete: (slot: number) => void;
	onCancelDelete: () => void;
}) {
	const enabled = !busy && slot !== undefined && !confirming;
	const deletable = !busy && slot?.occupied === true;
	const { hot, events, clearHover } = useHighlight(enabled);
	const deleteHighlight = useHighlight(deletable && !confirming);
	const completed = completedCount(slot);
	const status = busy ? "READING FILE..." : !slot ? "LINK UNAVAILABLE" : slot.completed ? "COMPLETE · REPLAY" : slot.occupied ? `CONTINUE MISSION ${missionNumber(slot.currentMission ?? 1)}` : "NEW CAMPAIGN";
	const detail = busy ? "Please stand by" : !slot ? "Return and try again" : `${completed}/${MISSION_COUNT} complete · ${MissionCatalog.Get(slot.currentMission ?? 1).title}`;
	const statusColor = confirming ? C.Danger : slot?.completed ? C.Accent : slot && !slot.occupied && !busy ? C.Accent : C.Ivory;
	const accent = confirming ? C.Danger : hot ? C.Accent : C.Faint;
	// Label uses fixed-size text: the copy frame clips, and SaveSlotLayout sizes
	// its lanes from real font metrics (see SaveSlotLayout.spec).
	const copy = (
		<frame key="Copy" BackgroundTransparency={1} ClipsDescendants={true} Position={UDim2.fromOffset(layout.copyLeft, 0)} Size={UDim2.fromOffset(layout.copyWidth, layout.rowHeight)}>
			<Label name="Status" text={confirming ? `DELETE FILE ${missionNumber(number)}?` : status} color={statusColor} textSize={13} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, layout.statusTop)} size={new UDim2(1, 0, 0, layout.statusHeight)} textWrapped={true} />
			<Label name="Detail" text={confirming ? "All progress in this file is lost." : detail} color={C.Muted} textSize={12} position={UDim2.fromOffset(0, layout.detailTop)} size={new UDim2(1, 0, 0, layout.detailHeight)} textWrapped={true} />
			{slot?.occupied === true && !confirming && (
				<frame key="Progress" BackgroundColor3={C.Ivory} BackgroundTransparency={0.88} BorderSizePixel={0} Position={UDim2.fromOffset(0, layout.progressTop)} Size={new UDim2(1, 0, 0, 3)}>
					<Corner scale={1} />
					<frame key="Fill" BackgroundColor3={C.Accent} BorderSizePixel={0} Size={new UDim2(completed / MISSION_COUNT, 0, 1, 0)} Visible={completed > 0}>
						<Corner scale={1} />
					</frame>
				</frame>
			)}
		</frame>
	);
	const numberLabel = <Label name="SlotNumber" text={missionNumber(number)} color={accent} textSize={13} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(12, 0)} size={UDim2.fromOffset(28, layout.rowHeight)} />;
	const rightLane = MIN_TOUCH_TARGET + 16;
	return (
		<frame key={`Slot${number}Row`} BackgroundColor3={hot ? C.PanelHot : C.Panel} BackgroundTransparency={hot ? 0.04 : 0.28} BorderSizePixel={0} LayoutOrder={number} Size={new UDim2(1, -SAVE_SLOT_SCROLLBAR_LANE, 0, confirming ? layout.confirmHeight : layout.rowHeight)}>
			<Corner radius={8} />
			<Stroke color={confirming ? C.Danger : hot ? C.Accent : C.Ivory} transparency={confirming || hot ? 0.15 : 0.88} thickness={confirming || hot ? 2 : 1} />
			{confirming ? (
				<frame key="Confirmation" BackgroundTransparency={1} Size={new UDim2(1, 0, 0, layout.rowHeight)}>
					{numberLabel}
					{copy}
				</frame>
			) : (
				<textbutton key={`Slot${number}Button`} Active={enabled} Selectable={enabled} AutoButtonColor={false} BackgroundTransparency={1} BorderSizePixel={0} SelectionImageObject={SELECTION_NONE} Size={new UDim2(1, deletable ? -rightLane : 0, 0, layout.rowHeight)} Text="" Event={{...events, Activated: () => { clearHover(); if (enabled) onSlot(number); }}}>
					{numberLabel}
					{copy}
					{!deletable && <Label name="Arrow" text="›" color={hot ? C.Accent : C.Faint} textSize={22} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -20, 0, layout.rowHeight / 2)} size={UDim2.fromOffset(16, 28)} textXAlignment={Enum.TextXAlignment.Center} visible={enabled} />}
				</textbutton>
			)}
			{confirming ? (
				<frame key="DeleteActions" BackgroundTransparency={1} Position={UDim2.fromOffset(8, layout.rowHeight)} Size={new UDim2(1, -16, 0, MIN_TOUCH_TARGET)}>
					<ActionButton name="KeepButton" text="KEEP" size={new UDim2(0.5, -4, 1, 0)} enabled={!busy} textSize={12} onActivated={onCancelDelete} />
					<ActionButton name="ConfirmDeleteButton" text="DELETE" primary={true} position={new UDim2(0.5, 4, 0, 0)} size={new UDim2(0.5, -4, 1, 0)} enabled={!busy} textSize={12} onActivated={() => onConfirmDelete(number)} />
				</frame>
			) : deletable && (
				<textbutton
					key="DeleteButton"
					AnchorPoint={new Vector2(1, 0.5)}
					AutoButtonColor={false}
					BackgroundColor3={deleteHighlight.hot ? C.PanelHot : C.Ink}
					BackgroundTransparency={deleteHighlight.hot ? 0.05 : 0.5}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					Position={new UDim2(1, -8, 0, layout.rowHeight / 2)}
					SelectionImageObject={SELECTION_NONE}
					Size={UDim2.fromOffset(MIN_TOUCH_TARGET, MIN_TOUCH_TARGET)}
					Text="✕"
					TextColor3={deleteHighlight.hot ? C.Danger : C.Muted}
					TextSize={15}
					Event={{ ...deleteHighlight.events, Activated: () => { deleteHighlight.clearHover(); onAskDelete(number); } }}
				>
					<Corner />
					<Stroke color={deleteHighlight.hot ? C.Danger : C.Ivory} transparency={deleteHighlight.hot ? 0.2 : 0.88} thickness={deleteHighlight.hot ? 2 : 1} />
				</textbutton>
			)}
		</frame>
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
	// Narrow panels (under 400px) get short copy so the one-line status never clips.
	const short = menu.panel.width < 400;
	const persistenceText = busy
		? short ? "CONNECTING..." : "CONNECTING TO FLIGHT RECORDS..."
		: persistence === "cloud"
			? short ? "CLOUD SAVES ONLINE" : "CLOUD SAVES ONLINE · SELECT A FLIGHT RECORD"
			: persistence === "session"
				? short ? "SESSION-ONLY SAVES" : "SAVES KEPT FOR THIS SESSION ONLY"
				: short ? "OFFLINE · MAY NOT SAVE" : "SAVE SERVICE OFFLINE · PROGRESS MAY NOT PERSIST";
	const layout = getSaveSlotLayout(menu.panel.width);
	const canvasHeight = getSlotListCanvasHeight(layout, SLOT_NUMBERS.map((number) => confirmSlot === number));
	return (
		<frame key="CampaignScreen" BackgroundTransparency={1} Visible={visible} {...panelPosition(menu)}>
			<ScreenHeader
				name="CampaignHeader"
				backName="CampaignBackButton"
				enabled={!busy}
				title="CAMPAIGN FILES"
				subtitle={persistenceText}
				subtitleColor={persistence === "unavailable" && !busy ? C.Orange : persistence === "cloud" && !busy ? C.Accent : C.Muted}
				compact={menu.compact}
				onBack={onBack}
			/>
			<scrollingframe key="SlotGrid" BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={3} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.6} ScrollingDirection={Enum.ScrollingDirection.Y} CanvasSize={UDim2.fromOffset(0, canvasHeight)} Position={UDim2.fromOffset(0, CAMPAIGN_HEADER_HEIGHT + CAMPAIGN_HEADER_GAP)} Size={new UDim2(1, 0, 0, getSlotListHeight(menu.panel.height))}>
				<uilistlayout Padding={new UDim(0, SAVE_SLOT_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{SLOT_NUMBERS.map((number) => (
					<SaveSlotRow
						key={`Slot${number}Row`}
						number={number}
						slot={slots?.[number - 1]}
						busy={busy}
						confirming={confirmSlot === number}
						layout={layout}
						onSlot={onSlot}
						onAskDelete={onAskDelete}
						onConfirmDelete={onDeleteSlot}
						onCancelDelete={onCancelDelete}
					/>
				))}
			</scrollingframe>
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

/** Short mission rules, mentioning beacons and escorts only when this sortie has them. */
function missionRules(phases: { kind: string }[]): string {
	const lines = ["10-minute window · Retry any time"];
	if (phases.some((phase) => phase.kind === "route" || phase.kind === "recon" || phase.kind === "signal" || phase.kind === "defend")) {
		lines.push("Green beacon: fly inside its volume. Scans need the shown altitude.");
	}
	if (phases.some((phase) => phase.kind === "escort")) lines.push("Escort: stay near the vehicle; down raiders before they close.");
	return lines.join("\n");
}

function SectionHeading({ name, text, layoutOrder }: { name: string; text: string; layoutOrder: number }) {
	return <Label name={name} text={text} color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 12)} layoutOrder={layoutOrder} />;
}

type TileState = "complete" | "next" | "open" | "locked";

function MissionTile({ id, state, selected, enabled, width, height, onChoose }: {
	id: number;
	state: TileState;
	selected: boolean;
	enabled: boolean;
	width: number;
	height: number;
	onChoose: (id: number) => void;
}) {
	const { hot, events, clearHover } = useHighlight(enabled);
	const blueprint = MissionCatalog.Get(id);
	const locked = state === "locked";
	const lit = selected || hot;
	const name = `Mission${missionNumber(id)}SelectButton`;
	const stateText = state === "complete" ? "✓ CLEAR" : state === "next" ? "NEXT" : state === "locked" ? "LOCKED" : "";
	const stateColor = state === "complete" ? C.Accent : state === "next" ? C.Orange : C.Faint;
	return (
		<textbutton
			key={name}
			Active={enabled}
			Selectable={enabled}
			AutoButtonColor={false}
			BackgroundColor3={lit ? C.PanelHot : C.Panel}
			BackgroundTransparency={locked ? 0.7 : hot ? 0.04 : selected ? 0.1 : 0.28}
			BorderSizePixel={0}
			LayoutOrder={id}
			SelectionImageObject={SELECTION_NONE}
			Size={UDim2.fromOffset(width, height)}
			Text=""
			Event={{ ...events, Activated: () => { clearHover(); if (enabled) onChoose(id); } }}
		>
			<Corner radius={8} />
			<Stroke color={hot ? C.Ivory : selected ? C.Accent : C.Ivory} transparency={lit ? 0.1 : 0.88} thickness={lit ? 2 : 1} />
			<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} PaddingTop={new UDim(0, 7)} PaddingBottom={new UDim(0, 7)} />
			<Label name="Number" text={missionNumber(id)} color={selected ? C.Accent : C.Faint} textSize={12} font={Enum.Font.RobotoMono} size={new UDim2(0.4, 0, 0, 14)} />
			<Label name="State" text={stateText} color={stateColor} textSize={9} minTextSize={7} font={Enum.Font.GothamBold} anchorPoint={new Vector2(1, 0)} position={UDim2.fromScale(1, 0)} size={new UDim2(0.6, 0, 0, 14)} textXAlignment={Enum.TextXAlignment.Right} />
			<textlabel key="MissionTitle" BackgroundTransparency={1} Font={Enum.Font.GothamBold} Position={UDim2.fromOffset(0, 17)} Size={new UDim2(1, 0, 0, 16)} Text={blueprint.title} TextColor3={locked ? C.Faint : C.Ivory} TextScaled={true} TextXAlignment={Enum.TextXAlignment.Left}>
				{/* Long titles shrink to 10pt rather than truncating on phone-width tiles. */}
				<uitextsizeconstraint MaxTextSize={12} MinTextSize={10} />
			</textlabel>
			<textlabel key="MissionMeta" BackgroundTransparency={1} Font={Enum.Font.GothamMedium} Position={UDim2.fromOffset(0, 34)} Size={new UDim2(1, 0, 0, 12)} Text={REGION_NAMES[blueprint.region] ?? ""} TextColor3={C.Faint} TextSize={10} TextTransparency={locked ? 0.4 : 0} TextTruncate={Enum.TextTruncate.AtEnd} TextXAlignment={Enum.TextXAlignment.Left} />
		</textbutton>
	);
}

function ActTab({ act, active, done, total, showName, onSelect }: { act: number; active: boolean; done: number; total: number; showName: boolean; onSelect: (act: number) => void }) {
	const { hot, events, clearHover } = useHighlight(true);
	return (
		<textbutton
			key={`Act${act}`}
			AutoButtonColor={false}
			BackgroundColor3={active ? C.Accent : hot ? C.PanelHot : C.Panel}
			BackgroundTransparency={active ? 0 : hot ? 0.05 : 0.28}
			BorderSizePixel={0}
			LayoutOrder={act}
			SelectionImageObject={SELECTION_NONE}
			Size={new UDim2(1 / 3, -4, 1, 0)}
			Text=""
			Event={{ ...events, Activated: () => { clearHover(); onSelect(act); } }}
		>
			<Corner />
			<Stroke color={hot ? C.Ivory : active ? C.Accent : C.Ivory} transparency={hot ? 0.1 : active ? 0.4 : 0.88} thickness={hot ? 2 : 1} />
			<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} PaddingTop={new UDim(0, 6)} PaddingBottom={new UDim(0, 6)} />
			<Label name="ActNumber" text={`ACT ${ACT_NUMERALS[act]}`} color={active ? C.Ink : C.Ivory} textSize={12} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, showName ? 0 : 8)} size={new UDim2(0.6, 0, 0, 16)} />
			<Label name="ActCount" text={`${done}/${total}`} color={active ? C.Ink : done === total ? C.Accent : C.Muted} textSize={10} font={Enum.Font.RobotoMono} anchorPoint={new Vector2(1, 0)} position={new UDim2(1, 0, 0, showName ? 0 : 8)} size={new UDim2(0.4, 0, 0, 16)} textXAlignment={Enum.TextXAlignment.Right} />
			<Label name="ActName" visible={showName} text={ACT_NAMES[act] ?? ""} color={active ? C.Ink : C.Faint} textSize={9} minTextSize={8} font={Enum.Font.GothamBold} anchorPoint={new Vector2(0, 1)} position={UDim2.fromScale(0, 1)} size={new UDim2(1, 0, 0, 12)} />
		</textbutton>
	);
}

function BriefingScreenImpl({visible,menu,selectedSlot,selectedMission,slot,busy,special,difficulty,onBack,onLaunch,onMission,onSpecial,onDifficulty}: {
	visible:boolean;menu:MenuLayout;selectedSlot:number;selectedMission:number;slot?:SaveSlot;busy:boolean;special:SpecialKind;difficulty:DifficultyKind;
	onBack:()=>void;onLaunch:()=>void;onMission:(id:number)=>void;onSpecial:(kind:SpecialKind)=>void;onDifficulty:(kind:DifficultyKind)=>void;
}) {
	const [browse,setBrowse]=useState(false),[act,setAct]=useState(1);
	const [detailsCanvasHeight,setDetailsCanvasHeight]=useState(0);
	const [scrolledToEnd,setScrolledToEnd]=useState(false);
	const panelRef=useRef<Frame>();const inputMode=useContext(InputModeContext);
	// Whether the reading column is scrolled to its end, from the live canvas
	// position and the latest content height (the canvas may grow or remount).
	const detailsCanvasRef=useRef(0);
	const updateScrolledToEnd=(frame:ScrollingFrame)=>setScrolledToEnd(frame.CanvasPosition.Y>=detailsCanvasRef.current-frame.AbsoluteWindowSize.Y-4);
	useEffect(()=>setScrolledToEnd(false),[selectedMission,browse]);
	useEffect(()=>{if(!visible || inputMode!=="gamepad")return;task.defer(()=>{
		const panel=panelRef.current;if(!panel)return;
		let selected:Instance|undefined;
		if(browse) {
			// The archive opens on the selected mission's tile, else the act's first playable tile.
			const tile=panel.FindFirstChild(`Mission${missionNumber(selectedMission)}SelectButton`,true);
			if(tile?.IsA("GuiObject") && tile.Selectable) selected=tile;
			const archive=panel.FindFirstChild("MissionArchive",true);
			if(!selected && archive) {
				let first:GuiObject|undefined;
				for(const child of archive.GetChildren()) {
					if(child.IsA("GuiObject") && child.Selectable && (first===undefined || child.LayoutOrder<first.LayoutOrder)) first=child;
				}
				selected=first;
			}
		}
		if(!selected) selected=panel.FindFirstChild(browse ? "ArchiveBackButton" : "LaunchButton",true);
		if(selected?.IsA("GuiObject"))GuiService.SelectedObject=selected;
	});},[browse,act,inputMode,visible,selectedMission]);
	const mission=MissionCatalog.Get(selectedMission);
	const unlocked=unlockedThrough(slot);
	const record=slot?.missions?.[selectedMission];
	const completed=record?.completed===true;
	const layout=getBriefingLayout(menu.panel.width,menu.panel.height);
	const grid=getArchiveGrid(menu.panel.width,menu.panel.height);
	const choose=(id:number)=>{onMission(id);setBrowse(false);};
	const status=completed
		? `  <font color="${HEX.Accent}">✓ CLEARED${record?.bestRank!==undefined ? ` · RANK ${record.bestRank}` : ""}${record?.bestTime!==undefined ? ` · ${formatTime(record.bestTime)}` : ""}</font>`
		: selectedMission===unlocked ? `  <font color="${HEX.Orange}">NEW SORTIE</font>` : "";
	const overflow=detailsCanvasHeight-layout.detailsHeight;
	const actMissions=MissionCatalog.All().filter((bp)=>bp.act===act);
	return <frame key="BriefingScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1,1)} Visible={visible}>
		<frame ref={panelRef} key="BriefingPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
			{browse ? <>
				<ScreenHeader name="ArchiveHeader" backName="ArchiveBackButton" title="MISSION ARCHIVE" subtitle={`FILE ${selectedSlot} · ${completedCount(slot)}/${MISSION_COUNT} COMPLETE`} compact={menu.compact} onBack={()=>setBrowse(false)}/>
				<frame key="ActTabs" BackgroundTransparency={1} Position={UDim2.fromOffset(0,ARCHIVE_HEADER_HEIGHT+ARCHIVE_GAP)} Size={new UDim2(1,4,0,ARCHIVE_TAB_HEIGHT)}>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					{ACTS.map((id)=><ActTab key={`Act${id}`} act={id} active={act===id} done={completedCount(slot,id)} total={MissionCatalog.ByAct(id).size()} showName={menu.panel.width>=400} onSelect={setAct}/>)}
				</frame>
				<scrollingframe key="MissionArchive" Position={UDim2.fromOffset(0,grid.top)} Size={new UDim2(1,0,0,grid.height)} CanvasSize={UDim2.fromOffset(0,getArchiveCanvasHeight(grid,actMissions.size()))} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={3} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.6} ScrollingDirection={Enum.ScrollingDirection.Y}>
					<uigridlayout CellPadding={UDim2.fromOffset(grid.gap,grid.gap)} CellSize={UDim2.fromOffset(grid.tileWidth,grid.tileHeight)} FillDirectionMaxCells={grid.columns} SortOrder={Enum.SortOrder.LayoutOrder}/>
					{actMissions.map((bp)=>{
						const state:TileState=slot?.missions?.[bp.id]?.completed ? "complete" : bp.id===unlocked ? "next" : bp.id<unlocked ? "open" : "locked";
						return <MissionTile key={`Mission${missionNumber(bp.id)}SelectButton`} id={bp.id} state={state} selected={selectedMission===bp.id} enabled={!busy && bp.id<=unlocked} width={grid.tileWidth} height={grid.tileHeight} onChoose={choose}/>;
					})}
				</scrollingframe>
			</> : <>
				{/* The heading scrolls with the copy: short landscape roots spend the
				    entire height above the single action dock on reading. */}
				<scrollingframe key="BriefingDetails" Size={new UDim2(1,0,0,layout.detailsHeight)} CanvasSize={UDim2.fromOffset(0,detailsCanvasHeight)} Active={true} Selectable={true} ClipsDescendants={true} ScrollingDirection={Enum.ScrollingDirection.Y} VerticalScrollBarInset={Enum.ScrollBarInset.Always} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={4} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.55} Change={{CanvasPosition:updateScrolledToEnd}}>
					<uilistlayout Padding={new UDim(0,BRIEFING_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} Change={{AbsoluteContentSize:(list)=>{
						detailsCanvasRef.current=list.AbsoluteContentSize.Y + 4;
						setDetailsCanvasHeight(detailsCanvasRef.current);
						const frame=list.Parent;
						if(frame?.IsA("ScrollingFrame"))updateScrolledToEnd(frame);
					}}}/>
					<frame key="BriefingHeader" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} LayoutOrder={1} Size={new UDim2(1,-12,0,0)}>
						<uilistlayout Padding={new UDim(0,BRIEFING_HEADER_SPACING)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<Label name="BriefingEyebrow" text={`${actLabel(mission.act)}  ·  MISSION ${missionNumber(selectedMission)}/${MISSION_COUNT}`} color={C.Accent} textSize={11} minTextSize={8} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={1}/>
						<Label name="BriefingTitle" text={mission.title} textSize={layout.titleSize} font={Enum.Font.GothamBlack} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={2}/>
						<Label name="BriefingMeta" text={`${REGION_NAMES[mission.region] ?? ""} · ${environmentName(mission.environment)}${status}`} richText={true} color={C.Muted} textSize={10} minTextSize={7} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={3}/>
					</frame>
					<textlabel key="Story" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} Font={Enum.Font.Gotham} LayoutOrder={2} LineHeight={BRIEFING_STORY_LINE_HEIGHT} Size={new UDim2(1,-12,0,0)} Text={mission.briefing} TextColor3={C.Ivory} TextSize={layout.bodySize} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top}/>
					<frame key="ObjectiveCard" AutomaticSize={Enum.AutomaticSize.Y} BackgroundColor3={C.Panel} BackgroundTransparency={0.4} BorderSizePixel={0} LayoutOrder={3} Size={new UDim2(1,-12,0,0)}>
						<Corner radius={8}/>
						<Stroke transparency={0.9}/>
						<uipadding PaddingLeft={new UDim(0,12)} PaddingRight={new UDim(0,12)} PaddingTop={new UDim(0,10)} PaddingBottom={new UDim(0,10)}/>
						<uilistlayout Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<SectionHeading name="ObjectiveHeading" text="OBJECTIVE" layoutOrder={1}/>
						<Label name="Primary" text={mission.primary} textSize={13} font={Enum.Font.GothamMedium} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={2}/>
						<Label name="PhasePlan" text={mission.phases.map((phase,index)=>`<font color="${HEX.Accent}">${missionNumber(index+1)}</font>   ${phase.label}`).join("\n")} richText={true} color={C.Muted} textSize={12} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={3}/>
						{/* Par is the time the debrief judges; show it before launch, with the slot's best when there is one. */}
						<Label name="ParTime" text={`PAR ${formatTime(MissionScore.ParSeconds(mission))}${record?.bestTime!==undefined ? `  ·  YOUR BEST ${formatTime(record.bestTime)}` : ""}`} color={C.Accent} textSize={11} minTextSize={8} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={4}/>
						<Label name="MissionRules" text={missionRules(mission.phases)} color={C.Faint} textSize={11} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={5}/>
					</frame>
					<LoadoutPicker kind={special} enabled={!busy} layoutOrder={4} onChange={onSpecial}/>
					<DifficultyPicker kind={difficulty} enabled={!busy} layoutOrder={5} onChange={onDifficulty}/>
				</scrollingframe>
				{/* Fades the last visible line while more copy waits below. */}
				<frame key="MoreFade" Active={false} BackgroundColor3={C.Ink} BorderSizePixel={0} Position={UDim2.fromOffset(0,layout.detailsHeight-22)} Size={new UDim2(1,-6,0,22)} Visible={overflow>2 && !scrolledToEnd} ZIndex={2}>
					<uigradient Rotation={90} Transparency={new NumberSequence(1,0.15)}/>
				</frame>
				<frame key="BriefingDock" BackgroundTransparency={1} Position={UDim2.fromOffset(0,layout.dockTop)} Size={new UDim2(1,0,0,layout.dockHeight)}>
					<ActionButton name="BriefingBackButton" text={layout.dock.back<80 ? "‹" : "‹ FILES"} size={UDim2.fromOffset(layout.dock.back,layout.dockHeight)} enabled={!busy} textSize={13} onActivated={onBack}/>
					<ActionButton name="BrowseMissionsButton" text="MISSIONS" position={UDim2.fromOffset(layout.dock.back+layout.dock.gap,0)} size={UDim2.fromOffset(layout.dock.archive,layout.dockHeight)} enabled={!busy} textSize={13} onActivated={()=>{setAct(mission.act);setBrowse(true);}}/>
					<ActionButton name="LaunchButton" text={busy ? "PREPARING..." : completed ? "REPLAY  ›" : "LAUNCH  ›"} primary={true} position={UDim2.fromOffset(layout.dock.back+layout.dock.archive+layout.dock.gap*2,0)} size={UDim2.fromOffset(layout.dock.launch,layout.dockHeight)} enabled={!busy} textSize={15} onActivated={onLaunch}/>
				</frame>
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
	if (reason === "crash_water") return "Your aircraft crashed into the water.";
	if (reason === "crash_terrain") return "Your aircraft crashed into terrain or scenery.";
	if (reason === "timeout") return `The ${math.floor(GameConfig.Campaign.MissionTimeLimit / 60)}-minute operation window closed.`;
	if (reason === "escaped") return "The courier got away.";
	if (reason === "internal_error") return "The sortie was stopped by a server error. Fly it again from the campaign menu.";
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
	const objectives: DebriefLine[] = MissionCatalog.ExpandedPhases(mission).map((phase, index) => {
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
		...(outcome.difficulty !== undefined ? [{ key: "StatDifficulty", label: "DIFFICULTY", value: Difficulty.Get(outcome.difficulty).name, valueColor: outcome.difficulty === "ace" ? C.Orange : C.Ivory }] : []),
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
	primary = false,
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
	/** FIRE: same size as the others, set apart by a green tint and a heavier ring even before a lock. */
	primary?: boolean;
	textSize: number;
	onActivated: () => void;
}) {
	return (
		<textbutton
			key={name}
			Active={enabled}
			AutoButtonColor={false}
			BackgroundColor3={filled || primary ? HUD.Green : HUD.Shadow}
			BackgroundTransparency={filled ? 0.55 : primary ? 0.8 : enabled ? 0.65 : 0.8}
			BorderSizePixel={0}
			FontFace={HUD_FONT_BOLD}
			Position={UDim2.fromOffset(rectangle.x, rectangle.y)}
			Selectable={false}
			Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
			Text={text}
			TextColor3={filled ? HUD.White : HUD.Green}
			TextSize={textSize}
			TextStrokeColor3={HUD.Shadow}
			TextStrokeTransparency={0.5}
			TextTransparency={!enabled ? 0.5 : dimmed ? 0.35 : 0}
			Event={{ Activated: () => enabled && onActivated() }}
		>
			<Corner scale={0.5} />
			<Stroke color={HUD.Green} transparency={filled || primary ? 0 : enabled ? 0.3 : 0.75} thickness={primary ? 2.5 : 1.5} />
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

function MissionHud({
	visible,
	viewport,
	inputMode,
	telemetry,
	throttle,
	callout,
	introduction,
	damageFlash,
	killFlash,
	scale,
	options,
	trend,
	fireNotice,
	radio,
	breakCue,
	controller,
	joystickRef,
	knobRef,
	onJoystickBegan,
	throttleJoystickRef,
	throttleKnobRef,
	onThrottleBegan,
	onMissile,
	onTarget,
	onSpecial,
	onEvade,
	onPause,
}: {
	visible: boolean;
	viewport: Vector2;
	inputMode: InputMode;
	telemetry: Telemetry;
	throttle: number;
	callout?: Callout;
	introduction: boolean;
	damageFlash: boolean;
	killFlash?: KillFlash;
	/** Effective HUD scale: the HUD is laid out for viewport / scale and drawn through a UIScale. */
	scale: number;
	options: HudOptions;
	trend: FlightTrend;
	/** Latest FIRE / SPECIAL refusal while it lasts (shown above FIRE, or in the alert lane). */
	fireNotice?: string;
	/** Current radio line: the subtitle row, or the objective line on roots without one. */
	radio?: string;
	/** Missile time-to-impact / BREAK cue text for the reserved row under the warning (nothing drives it yet). */
	breakCue?: string;
	controller: FlightController;
	joystickRef: React.RefObject<Frame>;
	knobRef: React.RefObject<Frame>;
	onJoystickBegan: (input: InputObject) => void;
	throttleJoystickRef: React.RefObject<Frame>;
	throttleKnobRef: React.RefObject<Frame>;
	onThrottleBegan: (input: InputObject) => void;
	onMissile: () => void;
	onTarget: () => void;
	onSpecial: () => void;
	onEvade: () => void;
	onPause: () => void;
}) {
	const virtualWidth = math.floor(viewport.X / scale);
	const virtualHeight = math.floor(viewport.Y / scale);
	// Layout math is pure but not free: recompute only when the root, input mode or stick size changes.
	const layout = useMemo(() => getHudLayout(virtualWidth, virtualHeight, inputMode, options), [virtualWidth, virtualHeight, inputMode, options]);
	const killRectangle = useMemo(() => getKillMarkerLayout(virtualWidth, virtualHeight, inputMode, options), [virtualWidth, virtualHeight, inputMode, options]);
	const metrics = layout.metrics;
	const touch = layout.touch;
	const ready = missileReady(telemetry);
	const locked = telemetry.target !== undefined && telemetry.lockProgress >= 0.99;
	const narrow = layout.alert.width < 200;
	const warning = flightWarning({ ...telemetry, acceleration: trend.acceleration, terrainSeconds: trend.terrainSeconds }, narrow);
	// Refusals ride above FIRE on the touch row; elsewhere they borrow the alert lane while no warning is up.
	const noticeInAlert = fireNotice !== undefined && layout.fireCaption === undefined && warning === "";
	const alertText = noticeInAlert ? fireNotice! : warning;
	const alertColor = noticeInAlert ? HUD.Amber : telemetry.incoming || telemetry.lockWarning ? HUD.Red : HUD.Amber;
	// Compact roots share the warning with the objective line: the warning shows in its place while it lasts.
	const alertSharesObjective = layout.alert === layout.callout;
	const evade = evadeGauge(telemetry);
	const evadeHint = telemetry.incoming && evade.ready ? getEvadeHint(inputMode) : undefined;
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
	}, [alertActive, alertSharesObjective]);
	const ammo = statusLine({
		missiles: telemetry.missiles,
		missileCooldown: telemetry.missileCooldown,
		special: specialDefinition.short,
		specialCharges: telemetry.specialCharges ?? 0,
		specialCooldown: telemetry.specialCooldown ?? 0,
		specialActive: telemetry.specialActive ?? 0,
		evadeCharges: evade.charges,
	});
	const fireButton = WeaponRules.FireButton(telemetry.missiles, telemetry.missileCooldown, telemetry.target !== undefined && telemetry.targetDamageable !== false, telemetry.lockProgress);
	const timeRemaining = telemetry.timeRemaining ?? GameConfig.Campaign.MissionTimeLimit;
	const [timeLine, progressLine] = clockLines(timeRemaining, telemetry.objectiveProgress, telemetry.objectiveTotal, telemetry.kills, telemetry.total);
	const tutorial = getTutorialInstruction(telemetry.tutorialStep, inputMode);
	// Radio rides the subtitle row; roots without one show it in the objective line (ahead of kill callouts), as before.
	const objectiveCallout = radio !== undefined && !layout.subtitle ? { text: radio, color: HUD.White } : callout;
	const objectiveLine = alertSharesObjective && alertText !== "" ? alertText : objectiveCallout?.text ?? (tutorial !== "" ? tutorial : telemetry.objective ?? "Complete the objective");
	const objectiveColor = alertSharesObjective && alertText !== "" ? alertColor : objectiveCallout?.color ?? (tutorial !== "" ? HUD.Amber : HUD.Green);
	const stalling = telemetry.speed < FlightMath.WarningSpeed;
	const knob = math.floor((touch?.joystick.width ?? JOYSTICK_SIZE) * 0.375 + 0.5);
	return (
		<frame key="MissionHUD" BackgroundTransparency={1} Size={UDim2.fromScale(1 / scale, 1 / scale)} Visible={visible}>
			<uiscale Scale={scale} />
			<NavigationCue telemetry={telemetry} visible={visible} inputMode={inputMode} scale={scale} options={options}/>
			<frame key="DamageFlash" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={damageFlash}>
				<Stroke color={C.Danger} transparency={0.35} thickness={5} />
			</frame>

			<KillMarker flash={killFlash} rectangle={killRectangle} visible={visible} />

			{layout.pause && (
				<textbutton
					key="PauseButton"
					Active={true}
					AutoButtonColor={false}
					Selectable={false}
					BackgroundColor3={HUD.Shadow}
					BackgroundTransparency={0.6}
					BorderSizePixel={0}
					FontFace={HUD_FONT_BOLD}
					Position={UDim2.fromOffset(layout.pause.x, layout.pause.y)}
					Size={UDim2.fromOffset(layout.pause.width, layout.pause.height)}
					Text="II"
					TextColor3={HUD.Green}
					TextSize={layout.pause.width >= 44 ? 15 : 12}
					Event={{ Activated: onPause }}
				>
					<Stroke color={HUD.Green} transparency={0.35} thickness={1} />
				</textbutton>
			)}
			{layout.radar && <Radar rectangle={layout.radar} controller={controller} visible={visible} textSize={metrics.label} />}

			<HudLabel name="MissionTimer" text={timeLine} rectangle={{ ...layout.clock, height: metrics.row }} textSize={metrics.text} color={timeRemaining <= 60 ? HUD.Red : HUD.Green} />
			<HudLabel name="ObjectiveProgress" text={progressLine} rectangle={{ ...layout.clock, y: layout.clock.y + metrics.row + 2, height: metrics.row }} textSize={metrics.text} />
			<HudLabel name="ObjectiveText" text={objectiveLine} rectangle={layout.callout} color={objectiveColor} textSize={metrics.scale === "large" ? 16 : metrics.scale === "compact" ? 10 : 11} wrap={true} verticalAlignment={Enum.TextYAlignment.Top} />

			{layout.reticle && <Reticle rectangle={layout.reticle} />}
			<InstrumentBox name="SpeedBox" caption="SPEED" value={instrumentValue(telemetry.speed)} rectangle={layout.speed} metrics={metrics} pointsRight={true} color={stalling ? HUD.Amber : HUD.Green} />
			<InstrumentBox name="AltitudeBox" caption="ALT" value={instrumentValue(telemetry.altitude)} rectangle={layout.altitude} metrics={metrics} pointsRight={false} color={telemetry.altitude < LOW_ALTITUDE ? HUD.Amber : HUD.Green} />
			{!alertSharesObjective && <WarningBox rectangle={layout.alert} text={alertText} color={alertColor} metrics={metrics} textRef={warningText} />}
			{/* Reserved for a missile time-to-impact / BREAK cue; empty and hidden until something drives it. */}
			<HudLabel name="BreakCue" text={breakCue ?? ""} rectangle={layout.breakCue} textSize={metrics.text} bold={true} color={HUD.Red} alignment={Enum.TextXAlignment.Center} visible={breakCue !== undefined && breakCue !== ""} />

			<StatusPanel layout={layout.status} health={telemetry.health} cells={ammo} />

			{layout.subtitle && (
				<HudLabel
					name="RadioSubtitle"
					text={radio ?? ""}
					rectangle={layout.subtitle}
					textSize={metrics.scale === "large" ? metrics.text : 12}
					color={HUD.White}
					alignment={Enum.TextXAlignment.Center}
					verticalAlignment={Enum.TextYAlignment.Bottom}
					wrap={true}
					visible={radio !== undefined}
				/>
			)}
			{layout.fireCaption && (
				<HudLabel
					name="FireCaption"
					text={fireNotice ?? ""}
					rectangle={layout.fireCaption}
					color={HUD.Amber}
					textSize={10}
					alignment={Enum.TextXAlignment.Center}
					visible={visible && fireNotice !== undefined}
				/>
			)}

			<frame
				ref={joystickRef}
				key="TouchJoystick"
				Active={true}
				BackgroundColor3={HUD.Shadow}
				BackgroundTransparency={0.75}
				BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.joystick.x, touch.joystick.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.joystick.width, touch.joystick.height) : UDim2.fromOffset(96, 96)}
				Visible={touch !== undefined}
				Event={{ InputBegan: (_rbx, input) => onJoystickBegan(input) }}
			>
				<Corner scale={0.5} />
				<Stroke color={HUD.Green} transparency={0.6} thickness={1} />
				<frame
					ref={knobRef}
					key="JoystickKnob"
					AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={HUD.Green}
					BackgroundTransparency={0.7}
					BorderSizePixel={0}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(knob, knob)}
				>
					<Corner scale={0.5} />
					<Stroke color={HUD.Green} transparency={0.3} thickness={1} />
				</frame>
			</frame>

			<frame ref={throttleJoystickRef} key="ThrottleJoystick" Active={true}
				BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.75} BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.throttle.x, touch.throttle.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.throttle.width, touch.throttle.height) : UDim2.fromOffset(96, 96)} Visible={touch !== undefined}
				Event={{ InputBegan: (_rbx, input) => onThrottleBegan(input) }}>
				<Corner scale={0.5} /><Stroke color={HUD.Green} transparency={0.6} thickness={1} />
				<frame ref={throttleKnobRef} key="ThrottleKnob" AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={HUD.Green} BackgroundTransparency={0.7} BorderSizePixel={0}
					Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromOffset(knob, knob)}>
					<Corner scale={0.5} /><Stroke color={HUD.Green} transparency={0.3} thickness={1} />
				</frame>
			</frame>
			{touch?.throttleUpLabel && (
				<HudLabel name="ThrottleUp" text="SPEED UP" rectangle={touch.throttleUpLabel} textSize={10} alignment={Enum.TextXAlignment.Center} />
			)}
			{touch?.throttleDownLabel && (
				<HudLabel name="ThrottleDown" text="SLOW DOWN" rectangle={touch.throttleDownLabel} textSize={10} alignment={Enum.TextXAlignment.Center} />
			)}

			<frame key="CombatControls" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
				{touch && (
					<RoundButton
						name="MissileButton"
						text={fireButton.text}
						rectangle={touch.missile}
						filled={fireButton.filled}
						enabled={fireButton.enabled}
						dimmed={fireButton.dimmed}
						primary={true}
						textSize={fireButton.text.size() > 5 ? 10 : 12}
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
				{touch && <EvadeButton rectangle={touch.evade} telemetry={telemetry} onEvade={onEvade} />}
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
	const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyKind>(Difficulty.Default);
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
	// Radio lines queue (2.5 s minimum each, 3 waiting) instead of overwriting each other.
	const radioQueue = useMemo(() => new RadioQueue(), []);
	const [, setRadioSerial] = useState(0);
	const [fireNotice, setFireNotice] = useState<RadioNotice | undefined>();
	const settings = useSettings();
	const [paused, setPausedState] = useState(false);
	const pausedRef = useRef(false);
	const [settingsOpen, setSettingsOpenState] = useState(false);
	const settingsOpenRef = useRef(false);
	/** The app lost focus (and has not regained it) — remembered across loading/cutscene so a sortie that starts behind it pauses. */
	const focusLostRef = useRef(false);
	const pauseSortieRef = useRef<() => void>(() => undefined);
	// Client flight trend (airspeed bleed, time to terrain); only re-renders when the warning it implies changes.
	const [trend, setTrend] = useState<FlightTrend>({ acceleration: 0 });
	const trendRef = useRef<FlightTrend>({ acceleration: 0 });
	const hudScaleRef = useRef(1);
	const hudOptions = useMemo<HudOptions>(() => ({ stickSize: JOYSTICK_SIZE * settings.stickScale }), [settings.stickScale]);
	const [damageUntil, setDamageUntil] = useState(0);
	const [killFlash, setKillFlash] = useState<KillFlash | undefined>();
	const killSerialRef = useRef(0);
	/** The selection before the latest target change: a kill's HudState can retarget before its telemetry lands. */
	const priorTargetRef = useRef<Model>();
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
	const selectedDifficultyRef = useRef<DifficultyKind>(Difficulty.Default);
	const persistenceRef = useRef<Persistence>("unavailable");
	const telemetryRef = useRef(defaultTelemetry());
	const inputModeRef = useRef<InputMode>(inputMode);
	const outcomeWonRef = useRef(true);
	const outcomeMissionRef = useRef(1);
	const rootFrameRef = useRef<Frame>();
	const joystickRef = useRef<Frame>();
	const knobRef = useRef<Frame>();
	const touches = useMemo(() => new TouchSticks<InputObject>(), []);
	const touchEndConnections = useMemo(() => new Map<InputObject, RBXScriptConnection>(), []);
	const throttleJoystickRef = useRef<Frame>();
	const throttleKnobRef = useRef<Frame>();
	const loadingSerialRef = useRef(0);
	const slotsRef = useRef<SaveSlot[] | undefined>();

	const changeScreen = useCallback((destination: Screen) => {
		screenRef.current = destination;
		inMissionRef.current = destination === "mission";
		if (destination !== "mission" && pausedRef.current) { pausedRef.current = false; setPausedState(false); }
		setScreen(destination);
	}, []);

	const releaseJoystick = useCallback(() => {
		for (const [, connection] of touchEndConnections) connection.Disconnect();
		touchEndConnections.clear();
		touches.Clear();
		controller.SetTouchThrottleAxis(0);
		if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		controller.SetInput(0, 0);
	}, [controller]);

	const applyInputMode = useCallback((nextMode: InputMode) => {
		const current = inputModeRef.current;
		if (!shouldAcceptInputModeChange(current, nextMode, touches.Held())) return;
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
		// Overlays (pause card, settings sheet) take gamepad focus over whatever screen is under them.
		if (inputModeRef.current === "gamepad" && (settingsOpenRef.current || (current === "mission" && pausedRef.current))) {
			const overlay = root.FindFirstChild(settingsOpenRef.current ? "SettingsSheet" : "PauseOverlay", true);
			if (!overlay) return;
			if (selected && selected.IsDescendantOf(overlay)) return;
			const first = overlay.FindFirstChild(settingsOpenRef.current ? "SettinginvertYToggle" : "PauseResumeButton", true);
			if (first?.IsA("GuiObject")) GuiService.SelectedObject = first;
			return;
		}
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
		if (settingsOpenRef.current) { settingsOpenRef.current = false; setSettingsOpenState(false); task.defer(() => selectDefaultRef.current()); return; }
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

	const launchMission = useCallback(() => {
		beginRequest((requestId) => {
			const [response, problem] = invoke("StartMission", { slot: selectedSlot, missionId: selectedMission, special: selectedSpecialRef.current, difficulty: selectedDifficultyRef.current });
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
		const rememberedDifficulty = current[slot - 1].difficulty;
		const difficulty: DifficultyKind = Difficulty.IsKind(rememberedDifficulty) ? rememberedDifficulty : Difficulty.Default;
		selectedDifficultyRef.current = difficulty; setSelectedDifficulty(difficulty);
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
	const chooseDifficulty = useCallback((kind: DifficultyKind) => { selectedDifficultyRef.current = kind; setSelectedDifficulty(kind); }, []);
	// Always send: the server either launches (guided or blind) or answers with `fireDenied`, so a press is never silent.
	const fireMissile = useCallback(() => controller.FireMissile(), [controller]);
	const cycleTarget = useCallback(() => controller.CycleTarget(), [controller]);
	const fireSpecial = useCallback(() => controller.Special(), [controller]);
	const evadeNow = useCallback(() => controller.Evade(), [controller]);
	const setSettingsOpen = useCallback((open: boolean) => {
		settingsOpenRef.current = open;
		setSettingsOpenState(open);
		task.defer(() => selectDefaultRef.current());
	}, []);
	/** Pause: the server stops stepping and holds the clock; resuming always takes an explicit press. */
	const pauseSortie = useCallback(() => {
		if (pausedRef.current || screenRef.current !== "mission" || !controller.active) return;
		pausedRef.current = true;
		setPausedState(true);
		releaseJoystick();
		controller.SetPaused(true);
		task.defer(() => selectDefaultRef.current());
	}, [controller, releaseJoystick]);
	pauseSortieRef.current = pauseSortie;
	const resumeSortie = useCallback(() => {
		if (!pausedRef.current) return;
		pausedRef.current = false;
		setPausedState(false);
		setSettingsOpen(false);
		controller.SetPaused(false);
	}, [controller, setSettingsOpen]);
	const changeSetting = useCallback(<K extends SettingKey>(key: K, value: PlayerSettings[K]) => SettingsStore.Set(key, value), []);
	const openSettings = useCallback(() => { if (!busyRef.current) setSettingsOpen(true); }, [setSettingsOpen]);

	// Settings that live outside React: pitch inversion in the controller (shake is read by CameraShake).
	useEffect(() => controller.SetInvertY(settings.invertY), [controller, settings.invertY]);

	// Auto-pause when the Roblox menu opens (Esc, the menu button, the gamepad Start menu) or the app loses focus.
	useEffect(() => {
		const menuOpened = GuiService.MenuOpened.Connect(pauseSortie);
		// Studio playtests (scripted pilots) lose window focus constantly; there, focus-loss pausing
		// is opt-in with Workspace attribute SkybreakAutoPause = true. Live clients always pause.
		const focusLost = UserInputService.WindowFocusReleased.Connect(() => {
			if (!RunService.IsStudio() || Workspace.GetAttribute("SkybreakAutoPause") === true) { focusLostRef.current = true; pauseSortie(); }
		});
		const focusGained = UserInputService.WindowFocused.Connect(() => { focusLostRef.current = false; });
		// P pauses and resumes on a keyboard (a deliberate press, like the RESUME button).
		const key = UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || input.KeyCode !== Enum.KeyCode.P || screenRef.current !== "mission" || UserInputService.GetFocusedTextBox()) return;
			if (pausedRef.current) { if (!settingsOpenRef.current) resumeSortie(); } else pauseSortie();
		});
		return () => { menuOpened.Disconnect(); focusLost.Disconnect(); focusGained.Disconnect(); key.Disconnect(); };
	}, [pauseSortie, resumeSortie]);

	const moveJoystick = useCallback((input: InputObject) => {
		const joystick = joystickRef.current;
		const knob = knobRef.current;
		if (!joystick || !knob || !inMissionRef.current) return;
		const stick = stickVector(input.Position.X, input.Position.Y, joystick.AbsolutePosition.X, joystick.AbsolutePosition.Y, joystick.AbsoluteSize.X);
		// The knob sits inside the (possibly HUD-scaled) frame: convert screen pixels back to its units.
		const unit = joystick.AbsoluteSize.X / math.max(1, joystick.Size.X.Offset);
		knob.Position = new UDim2(0.5, stick.offsetX / unit, 0.5, stick.offsetY / unit);
		controller.SetInput(stick.x, stick.y);
	}, [controller]);

	const releaseTouch = useCallback((input: InputObject) => {
		if (touches.steering === input) {
			controller.SetInput(0, 0);
			if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		}
		if (touches.throttle === input) {
			controller.SetTouchThrottleAxis(0);
			if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		}
		touchEndConnections.get(input)?.Disconnect();
		touchEndConnections.delete(input);
		touches.End(input);
		applyInputMode(readInputMode());
	}, [controller, touches, applyInputMode]);

	const trackTouchEnd = useCallback((input: InputObject) => {
		touchEndConnections.set(input, input.GetPropertyChangedSignal("UserInputState").Connect(() => {
			if (input.UserInputState === Enum.UserInputState.End || input.UserInputState === Enum.UserInputState.Cancel) releaseTouch(input);
		}));
	}, [releaseTouch, touchEndConnections]);
	const joystickBegan = useCallback((input: InputObject) => {
		if (!inMissionRef.current || GuiService.MenuIsOpen || UserInputService.GetFocusedTextBox() || inputModeRef.current !== "touch" || input.UserInputType !== Enum.UserInputType.Touch) return;
		if (!touches.Begin("steering", input)) return;
		trackTouchEnd(input);
		moveJoystick(input);
	}, [moveJoystick, trackTouchEnd]);

	const moveThrottle = useCallback((input: InputObject) => {
		const stick = throttleJoystickRef.current;
		const knob = throttleKnobRef.current;
		if (!stick || !knob || !inMissionRef.current) return;
		const radius = math.max(1, stick.AbsoluteSize.Y * 0.34);
		const offset = math.clamp(input.Position.Y - stick.AbsolutePosition.Y - stick.AbsoluteSize.Y / 2, -radius, radius);
		const unit = stick.AbsoluteSize.Y / math.max(1, stick.Size.Y.Offset);
		knob.Position = new UDim2(0.5, 0, 0.5, offset / unit);
		controller.SetTouchThrottleAxis(-offset / radius);
	}, [controller]);
	const throttleBegan = useCallback((input: InputObject) => {
		if (!inMissionRef.current || GuiService.MenuIsOpen || UserInputService.GetFocusedTextBox() || inputModeRef.current !== "touch" || input.UserInputType !== Enum.UserInputType.Touch) return;
		if (!touches.Begin("throttle", input)) return;
		trackTouchEnd(input);
		moveThrottle(input);
	}, [moveThrottle, trackTouchEnd]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			requestRef.current++;
			toastRef.current++;
			for (const [, connection] of touchEndConnections) connection.Disconnect();
			touchEndConnections.clear();
			touches.Clear();
			controller.SetTouchThrottleAxis(0);
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
			const active = touches.steering;
			if (input.UserInputState === Enum.UserInputState.Cancel || input.UserInputState === Enum.UserInputState.End) { releaseTouch(input); return; }
			if (active && input === active) moveJoystick(input);
			if (input === touches.throttle) moveThrottle(input);
		});
		const ended = UserInputService.InputEnded.Connect(releaseTouch);
		const focus = UserInputService.WindowFocusReleased.Connect(endJoystickTouch);
		const menu = GuiService.MenuOpened.Connect(endJoystickTouch);
		const textFocus = UserInputService.TextBoxFocused.Connect(endJoystickTouch);
		return () => {
			changed.Disconnect();
			ended.Disconnect();
			focus.Disconnect(); menu.Disconnect(); textFocus.Disconnect();
		};
	}, [endJoystickTouch, moveJoystick, moveThrottle, releaseTouch]);

	useEffect(() => {
		if (screen !== "mission") releaseJoystick();
	}, [releaseJoystick, screen]);

	useEffect(() => releaseJoystick(), [releaseJoystick, viewport, hudOptions, settings.hudScale]);

	useEffect(() => {
		task.defer(selectDefault);
	}, [busy, inputMode, screen, paused, settingsOpen, selectDefault]);

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
		const onMissionState = (raw: unknown, held = false): void => {
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
				setKillFlash(undefined);
				radioQueue.Clear();
				setFireNotice(undefined);
				priorTargetRef.current = undefined;
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
				throttleRef.current = controller.GetThrottle();
				setThrottleState(throttleRef.current);
				changeScreen("mission");
				// A menu opened or focus lost during loading/cutscene fires no new event once flight starts: pause now.
				task.defer(() => { if (GuiService.MenuIsOpen || focusLostRef.current) pauseSortieRef.current(); });
				const [ok, initial] = pcall(() => controller.GetTelemetry());
				if (ok && typeIs(initial, "table")) {
					const sanitized = sanitizeTelemetry(initial as Telemetry, telemetryRef.current);
					telemetryRef.current = sanitized;
					setTelemetry(sanitized);
				}
			} else if (payload.kind === "Completed" || payload.kind === "Failed") {
				if (!inMissionRef.current) return;
				if (!held) {
					// Hold the flight view so the last kill callout, the ace hit-stop or the player's own explosion plays out first.
					const serial = loadingSerialRef.current;
					task.delay(MISSION_END_HOLD, () => { if (loadingSerialRef.current === serial) onMissionState(raw, true); });
					return;
				}
				const finished = payload as MissionFinished;
				releaseJoystick();
				controller.Stop();
				setMenuCamera();
				const current = telemetryRef.current;
				const won = finished.kind === "Completed";
				controller.ResultAudio(won);
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
				const fallback = MissionScore.Compute({ won, airKills: kills - groundKills, groundKills, elapsed, par, missilesFired, missileHits, damageTaken, difficulty: finished.difficulty });
				setOutcome({
					won,
					missionId,
					airKills: kills - groundKills,
					optionalKills: count(finished.optionalKills),
					groundKills,
					elapsed,
					par,
					completedPhases: count(finished.completedPhases, won ? MissionCatalog.TotalPhases(MissionCatalog.Get(missionId)) : 0),
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
					difficulty: Difficulty.IsKind(finished.difficulty) ? finished.difficulty : undefined,
					saveText,
					saveColor: won && finished.saved === true && resultPersistence === "cloud" ? C.Accent : resultPersistence === "cloud" ? C.Muted : C.Orange,
				});
			}
		};
		const connection = remotes.MissionState.OnClientEvent.Connect((raw: unknown) => onMissionState(raw));
		// HUD numbers (10 Hz, unreliable) and text/target changes (reliable HudState) are
		// merged by the controller, which already folds in its locally predicted
		// boundary warning; the HUD re-renders once per merged update.
		const unsubscribe = controller.OnTelemetry((merged) => {
			if (!mountedRef.current || !inMissionRef.current) return;
			// The server owns the pause (5-minute budget, refused pauses): when the controller un-freezes, drop the PAUSED card too.
			if (pausedRef.current && !controller.IsPaused()) {
				pausedRef.current = false;
				setPausedState(false);
				settingsOpenRef.current = false;
				setSettingsOpenState(false);
			}
			const previous = telemetryRef.current;
			const sanitized = sanitizeTelemetry(merged, previous);
			if (sanitized.kills > previous.kills) setKillNotice({ kills: sanitized.kills, total: sanitized.total, until: os.clock() + 3 });
			if (sanitized.radio !== undefined && sanitized.radioSerial !== undefined && sanitized.radioSerial !== previous.radioSerial) {
				radioQueue.Push(sanitized.radio, sanitized.radioSeconds ?? RADIO_SECONDS, os.clock());
				setRadioSerial(sanitized.radioSerial);
			}
			if (sanitized.fireDenied !== undefined && sanitized.fireDeniedSerial !== undefined && sanitized.fireDeniedSerial !== previous.fireDeniedSerial) setFireNotice({ text: FIRE_DENIED_TEXT[sanitized.fireDenied], until: os.clock() + FIRE_DENIED_SECONDS });
			if (sanitized.health < previous.health) {
				setDamageUntil(os.clock() + 0.45);
				CameraShake.Damage(previous.health - sanitized.health);
			}
			const kill = ImpactFeedback.DetectKill(killSnapshot(previous), killSnapshot(sanitized));
			if (kill) {
				killSerialRef.current += 1;
				const killed = previous.target && previous.target.Parent === undefined ? previous.target : priorTargetRef.current;
				priorTargetRef.current = undefined;
				const point = killedTargetPoint(killed, rootFrameRef.current);
				// The kill marker lives in the HUD-scaled frame.
				setKillFlash({ serial: killSerialRef.current, kind: kill.kind, text: kill.text, bracket: point ? point.div(hudScaleRef.current) : undefined });
				if (kill.kind === "ace") CameraShake.HitStop();
			}
			if (previous.target !== sanitized.target && previous.target !== undefined) priorTargetRef.current = previous.target;
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
					const actualThrottle = controller.GetThrottle();
					if (math.abs(actualThrottle - throttleRef.current) > 0.005) { throttleRef.current = actualThrottle; setThrottleState(actualThrottle); }
					const warning = controller.GetBoundaryWarning();
					const current = telemetryRef.current;
					if (warning !== (current.boundaryWarning === true)) {
						const sampled = { ...current, boundaryWarning: warning };
						telemetryRef.current = sampled;
						setTelemetry(sampled);
					}
					// Stall trend and terrain probe: re-render only when the fresh trend changes the warning the HUD shows.
					const flight = controller.GetFlightTrend();
					const shown = flightWarning({ ...telemetryRef.current, acceleration: trendRef.current.acceleration, terrainSeconds: trendRef.current.terrainSeconds });
					const implied = flightWarning({ ...telemetryRef.current, acceleration: flight.acceleration, terrainSeconds: flight.terrainSeconds });
					if (implied !== shown) {
						trendRef.current = { acceleration: flight.acceleration, terrainSeconds: flight.terrainSeconds };
						setTrend(trendRef.current);
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
	const radioLine = screen === "mission" ? radioQueue.Current(now) : undefined;
	if (killNotice && now < killNotice.until) {
		// Progress is the phase objective's own count; raw kills include optional fighters and ground.
		const total = telemetry.objectiveTotal ?? 0;
		callout = { text: total > 0 ? `Hostile down  ${telemetry.objectiveProgress ?? 0}/${total}` : "Hostile down", color: HUD.White };
	}
	const hudScale = effectiveHudScale(settings.hudScale, inputMode === "touch", viewport.X, viewport.Y);
	hudScaleRef.current = hudScale;
	// In a mission the toast follows the HUD's own (scaled) layout for this input mode.
	const inMission = screen === "mission";
	const toastRectangle = useMemo(() => inMission
		? scaleRectangle(getToastLayout(math.floor(viewport.X / hudScale), math.floor(viewport.Y / hudScale), undefined, inputMode, hudOptions), hudScale)
		: getToastLayout(viewport.X, viewport.Y, menu), [inMission, viewport, hudScale, inputMode, hudOptions, menu]);
	const activeFireNotice = fireNotice && now < fireNotice.until ? fireNotice.text : undefined;
	const menuHints: ControlHint[] = [{ keyCode: "ButtonA", label: "A", action: "SELECT" }];
	if (screen === "slots" || screen === "briefing") menuHints.push({ keyCode: "ButtonB", label: "B", action: "BACK" });
	const menuHintsRectangle = getMenuHintsLayout(viewport.X, viewport.Y, menu);

	return (
		<InputModeContext.Provider value={inputMode}>
			<screengui key="SkybreakBackdrop" DisplayOrder={19} IgnoreGuiInset={true} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.None}>
				<MenuBackdrop visible={!NO_MENU_CAMERA.has(screen)} menu={menu} viewport={viewport} />
			</screengui>
			<screengui key="SkybreakUI" DisplayOrder={20} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame ref={rootFrameRef} key="Root" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Change={rootChange}>
					{screen === "cinematic" && <RelayCinematic id={cinematicId} viewport={viewport} onFinish={()=>{const continueStory=cinematicNext.current;changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing");continueStory();}} onCancel={()=>changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing")}/>}
					<TitleScreen visible={screen === "title"} menu={menu} onCampaign={openCampaign} onSettings={openSettings} />
					<CampaignScreen visible={screen === "slots"} menu={menu} slots={slots} busy={busy} persistence={persistence} onBack={goBack} onSlot={chooseSlot} confirmSlot={confirmSlot} onAskDelete={askDelete} onCancelDelete={cancelDelete} onDeleteSlot={deleteSlot} />
					<BriefingScreen visible={screen === "briefing"} menu={menu} selectedSlot={selectedSlot} selectedMission={selectedMission} slot={selectedSave} busy={busy} special={selectedSpecial} difficulty={selectedDifficulty} onBack={goBack} onLaunch={startMission} onMission={chooseMission} onSpecial={chooseSpecial} onDifficulty={chooseDifficulty} />
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
						killFlash={killFlash}
						scale={hudScale}
						options={hudOptions}
						trend={trend}
						fireNotice={activeFireNotice}
						radio={radioLine?.text}
						controller={controller}
						joystickRef={joystickRef}
						knobRef={knobRef}
						onJoystickBegan={joystickBegan}
						throttleJoystickRef={throttleJoystickRef}
						throttleKnobRef={throttleKnobRef}
						onThrottleBegan={throttleBegan}
						onMissile={fireMissile}
						onTarget={cycleTarget}
						onSpecial={fireSpecial}
						onEvade={evadeNow}
						onPause={pauseSortie}
					/>
					{screen === "mission" && paused && !settingsOpen && (
						<PauseOverlay viewport={viewport} onResume={resumeSortie} onSettings={() => setSettingsOpen(true)} onMenu={returnToMenu} />
					)}
					{settingsOpen && <SettingsSheet viewport={viewport} settings={settings} onChange={changeSetting} onClose={() => setSettingsOpen(false)} />}
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
