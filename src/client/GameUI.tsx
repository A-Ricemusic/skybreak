import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { GuiService, RunService, UserInputService, Workspace } from "@rbxts/services";

import type {
	CampaignResponse,
	MissionFinished,
	MissionMessage,
	MissionStarted,
	Persistence,
	Remotes,
	SaveSlot,
	Telemetry,
} from "../shared/Types";
import { FlightController } from "./FlightController";
import {
	getSlotListHeight,
	getEvadeHint,
	getFlightHints,
	getHudLayout,
	getMenuHintsLayout,
	getMenuLayout,
	getToastLayout,
	inputModeFromInputType,
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
const MENU_JET = new Vector3(155, 31, -100);
const MENU_EYE_OFFSET = new Vector3(-17, 9, 54);
const SLOT_NUMBERS = [1, 2, 3, 4];
const MENU_SCREEN_FRAMES = { title: "TitleScreen", slots: "CampaignScreen", briefing: "BriefingScreen", outcome: "OutcomeScreen" };

type Screen = "title" | "slots" | "briefing" | "mission" | "outcome";

interface ToastState {
	message: string;
	isError: boolean;
}

interface OutcomeState {
	won: boolean;
	missionId: number;
	kills: number;
	groundKills: number;
	elapsed: number;
	reason?: string;
	saveText: string;
	saveColor: Color3;
}

interface KillNotice {
	kills: number;
	total: number;
	until: number;
}

interface Callout {
	eyebrow: string;
	title: string;
}

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
			LayoutOrder={layoutOrder}
			Visible={visible}
			ZIndex={zIndex}
		/>
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
	};
}

function finite(value: unknown, fallback: number): number {
	return typeIs(value, "number") && value === value && math.abs(value) !== math.huge ? value : fallback;
}

function safeString(value: unknown, fallback: string): string {
	return typeIs(value, "string") && value.size() <= 80 ? value : fallback;
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
			kills: math.clamp(math.floor(finite(source.kills, 0)), 0, 9),
			bestTime,
			updatedAt: source.updatedAt,
			currentMission: source.currentMission === 2 ? 2 : 1,
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
	const missionId = payload.missionId === 2 ? 2 : payload.missionId === 1 ? 1 : previous.missionId;
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
		elapsed: math.max(0, finite(payload.elapsed, previous.elapsed)),
		targetDistance: math.max(0, finite(payload.targetDistance, previous.targetDistance ?? 0)),
		boundaryWarning: payload.boundaryWarning === undefined ? previous.boundaryWarning : payload.boundaryWarning === true,
		missionId,
		phase: safeString(payload.phase, previous.phase ?? ""),
		objective: safeString(payload.objective, previous.objective ?? "Complete the objective"),
		objectiveProgress: math.max(0, math.floor(finite(payload.objectiveProgress, previous.objectiveProgress ?? 0))),
		objectiveTotal: math.max(0, math.floor(finite(payload.objectiveTotal, previous.objectiveTotal ?? 0))),
		timeRemaining: math.clamp(finite(payload.timeRemaining, previous.timeRemaining ?? 600), 0, 600),
		tutorialStep,
		groundKills: math.max(0, math.floor(finite(payload.groundKills, previous.groundKills ?? 0))),
		targetKind,
		targetRequired: payload.targetRequired === undefined ? previous.targetRequired : payload.targetRequired === true,
	};
}

function resumeMission(slot?: SaveSlot): number {
	return slot?.mission1Completed === true ? 2 : 1;
}

function tutorialInstruction(step: string | undefined, mode: InputMode): string {
	if (step === "move") {
		if (mode === "touch") return "Use the flight stick to pitch and turn";
		if (mode === "gamepad") return "Use the left stick to pitch and turn";
		return "Use WASD to pitch and turn";
	}
	if (step === "target") return mode === "touch" ? "Tap TGT to cycle targets" : mode === "gamepad" ? "Press Y to cycle targets" : "Press Tab to cycle targets";
	if (step === "missile") return mode === "touch" ? "Lock the ground target, then tap FIRE" : mode === "gamepad" ? "Lock the ground target, then press R2" : "Lock the ground target, then press Space";
	return "";
}

function missileReady(telemetry: Telemetry): boolean {
	return telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
}

function setMenuCamera() {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	const size = camera.ViewportSize;
	const clock = os.clock();
	const sway = new Vector3(math.sin(clock * 0.11) * 2, math.sin(clock * 0.07) * 0.8, 0);
	let eye = MENU_JET.add(MENU_EYE_OFFSET);
	let focus: Vector3;
	if (getMenuLayout(size.X, size.Y).mode === "sheet") {
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

function TitleScreen({ visible, menu, onCampaign }: { visible: boolean; menu: MenuLayout; onCampaign: () => void }) {
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
					Size={new UDim2(1, 0, 0, compact ? 50 : 76)}
					Text="SKYBREAK"
					TextColor3={C.Ivory}
					TextScaled={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<uitextsizeconstraint MaxTextSize={compact ? 46 : 70} MinTextSize={28} />
				</textlabel>
				<Label name="Subtitle" text="OPERATION GLASS HORIZON" color={C.Orange} textSize={compact ? 11 : 13} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 18)} layoutOrder={3} />
				<Label
					name="Blurb"
					text="Earn your wings, then break the Iron Coast strike force in a two-mission campaign."
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

function SlotButton({
	number,
	slot,
	busy,
	compact,
	onSlot,
}: {
	number: number;
	slot?: SaveSlot;
	busy: boolean;
	compact: boolean;
	onSlot: (slot: number) => void;
}) {
	const enabled = !busy && slot !== undefined;
	const { hot, events, clearHover } = useHighlight(enabled);
	const status = busy
		? "READING FILE..."
		: !slot
			? "LINK UNAVAILABLE"
			: slot.completed
				? "CAMPAIGN COMPLETE  ·  REPLAY"
				: slot.mission1Completed
					? "MISSION 02 UNLOCKED  ·  CONTINUE"
					: slot.occupied ? "CONTINUE MISSION 01" : "NEW CAMPAIGN";
	const detail = busy
		? "Please stand by"
		: !slot
			? "Return and try again"
			: slot.completed
				? `01 ${slot.mission1BestTime !== undefined ? formatTime(slot.mission1BestTime) : "--:--"}   ·   02 ${slot.mission2BestTime !== undefined ? formatTime(slot.mission2BestTime) : "--:--"}`
				: slot.mission1Completed
					? `FIRST FLIGHT ${slot.mission1BestTime !== undefined ? formatTime(slot.mission1BestTime) : "COMPLETE"}`
					: slot.occupied ? `FIRST FLIGHT  ·  ${slot.kills} air targets` : "Begin with 01 FIRST FLIGHT";
	const rowHeight = compact ? 44 : 58;
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
			<Label name="Status" text={status} color={slot?.completed ? C.Accent : C.Ivory} textSize={compact ? 13 : 15} font={Enum.Font.GothamBold} position={UDim2.fromOffset(48, compact ? 5 : 10)} size={new UDim2(1, -80, 0, compact ? 18 : 20)} />
			<Label name="Detail" text={detail} color={C.Muted} textSize={compact ? 10 : 12} position={UDim2.fromOffset(48, compact ? 23 : 31)} size={new UDim2(1, -80, 0, compact ? 15 : 17)} />
			<Label name="Arrow" text="›" color={hot ? C.Accent : C.Faint} textSize={20} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -14, 0.5, 0)} size={UDim2.fromOffset(16, 28)} textXAlignment={Enum.TextXAlignment.Right} visible={enabled} />
		</textbutton>
	);
}

function CampaignScreen({
	visible,
	menu,
	slots,
	busy,
	persistence,
	onBack,
	onSlot,
}: {
	visible: boolean;
	menu: MenuLayout;
	slots?: SaveSlot[];
	busy: boolean;
	persistence: Persistence;
	onBack: () => void;
	onSlot: (slot: number) => void;
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
					<SlotButton key={`Slot${number}Button`} number={number} slot={slots?.[number - 1]} busy={busy} compact={compact} onSlot={onSlot} />
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

function BriefingScreen({
	visible,
	menu,
	selectedSlot,
	selectedMission,
	slot,
	busy,
	onBack,
	onLaunch,
	onMission,
}: {
	visible: boolean;
	menu: MenuLayout;
	selectedSlot: number;
	selectedMission: number;
	slot?: SaveSlot;
	busy: boolean;
	onBack: () => void;
	onLaunch: () => void;
	onMission: (missionId: number) => void;
}) {
	const compact = menu.compact;
	const mission2 = selectedMission === 2;
	const mission2Unlocked = slot?.mission1Completed === true;
	const missionCompleted = mission2 ? slot?.mission2Completed === true : slot?.mission1Completed === true;
	const mode = missionCompleted ? "COMPLETED  ·  REPLAY" : slot?.occupied ? "CONTINUE SORTIE" : "NEW SORTIE";
	const title = mission2 ? "IRON COAST" : "FIRST FLIGHT";
	const objective = mission2
		? "Break the coastal strike force"
		: "Complete flight training and repel the attack";
	const story = mission2
		? "Intercept three required bandits, destroy five coastal warehouses while attackers pursue, then defeat the faster armored ace. Optional attackers may remain in the fight."
		: "Learn to pitch and turn, cycle to the marked ground target, fire a missile, then destroy the three bandits pursuing the airbase.";
	return (
		<frame key="BriefingScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="BriefingPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
				<Label name="BriefingEyebrow" text={`MISSION 0${selectedMission}`} color={C.Orange} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, compact ? 14 : 16)} />
				<Label name="BriefingTitle" text={title} textSize={compact ? 22 : 32} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, compact ? 16 : 22)} size={new UDim2(1, 0, 0, compact ? 28 : 40)} />
				<Label name="ObjectiveTag" text="PRIMARY OBJECTIVE" color={C.Accent} textSize={10} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, compact ? 54 : 82)} size={new UDim2(1, 0, 0, 14)} />
				<Label name="Objective" text={objective} textSize={compact ? 15 : 18} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, compact ? 68 : 100)} size={new UDim2(1, 0, 0, compact ? 20 : 26)} />
				<Label
					name="Story"
					text={story}
					color={C.Muted}
					textSize={compact ? 12 : 14}
					position={UDim2.fromOffset(0, compact ? 96 : 140)}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
					textYAlignment={Enum.TextYAlignment.Top}
				/>
				<Label
					name="BriefingSlot"
					text={string.format("FILE %02d  ·  %s", selectedSlot, mode)}
					color={C.Faint}
					textSize={10}
					font={Enum.Font.GothamBold}
					anchorPoint={new Vector2(0, 1)}
					position={new UDim2(0, 0, 1, compact ? -92 : -98)}
					size={new UDim2(1, 0, 0, 16)}
				/>
				<ActionButton
					name="Mission01SelectButton"
					text="01  FIRST FLIGHT"
					primary={selectedMission === 1}
					anchorPoint={new Vector2(0, 1)}
					position={new UDim2(0, 0, 1, compact ? -50 : -54)}
					size={new UDim2(0.49, 0, 0, compact ? 34 : 38)}
					textSize={compact ? 10 : 11}
					enabled={!busy}
					onActivated={() => onMission(1)}
				/>
				<ActionButton
					name="Mission02SelectButton"
					text={mission2Unlocked ? "02  IRON COAST" : "02  LOCKED"}
					primary={selectedMission === 2}
					anchorPoint={new Vector2(1, 1)}
					position={new UDim2(1, 0, 1, compact ? -50 : -54)}
					size={new UDim2(0.49, 0, 0, compact ? 34 : 38)}
					textSize={compact ? 10 : 11}
					enabled={!busy && mission2Unlocked}
					onActivated={() => onMission(2)}
				/>
				<FooterButtons
					compact={compact}
					primaryName="LaunchButton"
					primaryText={busy ? "REQUESTING CLEARANCE..." : "LAUNCH  ›"}
					secondaryName="BriefingBackButton"
					secondaryText="‹  FILES"
					busy={busy}
					onPrimary={onLaunch}
					onSecondary={onBack}
				/>
			</frame>
		</frame>
	);
}

function OutcomeScreen({
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
	const retryText = busy ? "RESETTING SORTIE..." : outcome.won ? `REPLAY MISSION 0${outcome.missionId}` : "RETRY SORTIE";
	const timedOut = outcome.reason === "timeout";
	const campaignComplete = outcome.won && outcome.missionId === 2;
	const summary = outcome.won
		? campaignComplete
			? "The warehouses are destroyed and the ace is down. The coast is secure."
			: "Training complete and the pursuing bandits are down. Iron Coast is now unlocked."
		: timedOut
			? "The ten-minute operation window closed before the objective was complete."
			: "The sortie ended before the required objective was complete.";
	return (
		<frame key="OutcomeScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="VictoryPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
				<frame key="Accent" BackgroundColor3={outcome.won ? C.Accent : C.Danger} BorderSizePixel={0} Size={UDim2.fromOffset(32, 2)} />
				<Label name="OutcomeEyebrow" text={`MISSION 0${outcome.missionId}  ·  ${outcome.missionId === 2 ? "IRON COAST" : "FIRST FLIGHT"}`} color={C.Orange} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, 10)} size={new UDim2(1, 0, 0, 16)} />
				<Label name="OutcomeTitle" text={outcome.won ? "MISSION COMPLETE" : timedOut ? "TIME EXPIRED" : "SORTIE LOST"} color={outcome.won ? C.Ivory : C.Danger} textSize={compact ? 24 : 34} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, compact ? 28 : 32)} size={new UDim2(1, 0, 0, compact ? 30 : 44)} />
				<Label
					name="OutcomeSummary"
					text={summary}
					color={C.Muted}
					textSize={compact ? 12 : 15}
					position={UDim2.fromOffset(0, compact ? 64 : 86)}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
					textYAlignment={Enum.TextYAlignment.Top}
				/>
				<Label name="OutcomeStats" text={`AIR  ${outcome.kills}   GROUND  ${outcome.groundKills}   TIME  ${formatTime(outcome.elapsed)}`} color={C.Accent} textSize={compact ? 12 : 14} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(0, compact ? 112 : 150)} size={new UDim2(1, 0, 0, 20)} />
				<Label
					name="SaveStatus"
					text={outcome.saveText}
					color={outcome.saveColor}
					textSize={compact ? 10 : 11}
					font={Enum.Font.GothamBold}
					position={UDim2.fromOffset(0, compact ? 136 : 180)}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
				/>
				{outcome.won ? outcome.missionId === 1 ? (
					<FooterButtons compact={compact} primaryName="Mission1NextMissionButton" primaryText="NEXT: MISSION 02" secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onNext} onSecondary={onReturn} />
				) : (
					<FooterButtons compact={compact} primaryName="ReturnToMenuButton" primaryText="RETURN TO MENU" secondaryName="RetryButton" secondaryText={retryText} busy={busy} onPrimary={onReturn} onSecondary={onRetry} />
				) : (
					<FooterButtons compact={compact} primaryName="RetryButton" primaryText={retryText} secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onRetry} onSecondary={onReturn} />
				)}
			</frame>
		</frame>
	);
}

function RoundButton({
	name,
	text,
	rectangle,
	filled,
	enabled,
	textSize,
	onActivated,
}: {
	name: string;
	text: string;
	rectangle: Rectangle;
	filled: boolean;
	enabled: boolean;
	textSize: number;
	onActivated: () => void;
}) {
	return (
		<textbutton
			key={name}
			Active={enabled}
			AutoButtonColor={false}
			BackgroundColor3={filled ? C.Accent : C.Ink}
			BackgroundTransparency={filled ? 0.05 : enabled ? 0.45 : 0.7}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			Position={UDim2.fromOffset(rectangle.x, rectangle.y)}
			Selectable={false}
			Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
			Text={text}
			TextColor3={filled ? C.Ink : C.Ivory}
			TextSize={textSize}
			TextTransparency={enabled ? 0 : 0.5}
			Event={{ Activated: () => enabled && onActivated() }}
		>
			<Corner scale={0.5} />
			<Stroke color={filled ? C.AccentHot : C.Accent} transparency={enabled ? 0.35 : 0.8} thickness={1.5} />
		</textbutton>
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
}) {
	const layout = getHudLayout(viewport.X, viewport.Y, inputMode);
	const touch = layout.touch;
	const ready = missileReady(telemetry);
	const locked = telemetry.target !== undefined && telemetry.lockProgress >= 0.99;
	const alertText = telemetry.incoming ? "MISSILE INBOUND" : telemetry.boundaryWarning ? "AIRSPACE LIMIT  ·  TURN BACK" : "";
	const alertColor = telemetry.incoming ? C.Danger : C.Orange;
	const evadeHint = telemetry.incoming && telemetry.evadeCooldown <= 0 ? getEvadeHint(inputMode) : undefined;
	const hints = getFlightHints(inputMode, { introduction, locked, missileReady: ready });
	const hull = math.floor(telemetry.health + 0.5);
	const missileText = string.format(
		'<font size="10" color="#98A8B0">MSL</font>  %d%s',
		telemetry.missiles,
		telemetry.missileCooldown > 0 ? string.format('  <font size="10" color="#98A8B0">%.1fs</font>', telemetry.missileCooldown) : "",
	);
	const missileButtonText = telemetry.missileCooldown > 0 ? string.format("%.1f", telemetry.missileCooldown) : telemetry.missiles <= 0 ? "EMPTY" : "FIRE";
	const throttleVertical = touch?.throttleVertical ?? true;
	const throttleButtonSize = UDim2.fromOffset(44, 44);
	const tutorial = tutorialInstruction(telemetry.tutorialStep, inputMode);
	const progress = telemetry.objectiveTotal !== undefined && telemetry.objectiveTotal > 0
		? `  ${telemetry.objectiveProgress ?? 0}/${telemetry.objectiveTotal}`
		: "";
	const objectiveText = tutorial !== "" ? tutorial : callout?.title ?? (telemetry.objective ?? "Complete the objective");
	const objectiveEyebrow = tutorial !== "" ? "FLIGHT TRAINING" : callout?.eyebrow ?? "CURRENT OBJECTIVE";
	return (
		<frame key="MissionHUD" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="DamageFlash" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={damageFlash}>
				<Stroke color={C.Danger} transparency={0.35} thickness={5} />
			</frame>

			<frame
				key="ObjectivePanel"
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
				Position={UDim2.fromOffset(layout.callout.x, layout.callout.y)}
				Size={UDim2.fromOffset(layout.callout.width, layout.callout.height)}
			>
				<Corner radius={6} />
				<Stroke color={tutorial !== "" ? C.Orange : C.Accent} transparency={0.65} />
				<Label name="ObjectiveEyebrow" text={objectiveEyebrow} color={tutorial !== "" ? C.Orange : C.Accent} textSize={9} font={Enum.Font.GothamBold} position={UDim2.fromOffset(10, 4)} size={new UDim2(1, -76, 0, 13)} stroke={true} />
				<Label name="ObjectiveText" text={`${objectiveText}${progress}`} color={C.Ivory} textSize={11} font={Enum.Font.GothamBold} position={UDim2.fromOffset(10, 17)} size={new UDim2(1, -76, 0, 28)} textWrapped={true} stroke={true} />
				<Label name="MissionTimer" text={formatTime(telemetry.timeRemaining ?? 600)} color={(telemetry.timeRemaining ?? 600) <= 60 ? C.Danger : C.Ivory} textSize={13} font={Enum.Font.RobotoMono} anchorPoint={new Vector2(1, 0)} position={new UDim2(1, -10, 0, 7)} size={UDim2.fromOffset(58, 20)} textXAlignment={Enum.TextXAlignment.Right} stroke={true} />
			</frame>

			<frame
				key="Warning"
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
				Position={UDim2.fromOffset(layout.alert.x, layout.alert.y)}
				Size={UDim2.fromOffset(layout.alert.width, layout.alert.height)}
				Visible={alertText !== ""}
			>
				<Corner radius={16} />
				<Stroke color={alertColor} transparency={0.25} thickness={1.5} />
				<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Center} Padding={new UDim(0, 14)} SortOrder={Enum.SortOrder.LayoutOrder} VerticalAlignment={Enum.VerticalAlignment.Center} />
				<Label name="WarningText" text={alertText} color={alertColor} textSize={13} font={Enum.Font.GothamBlack} size={UDim2.fromOffset(0, 20)} automaticSize={Enum.AutomaticSize.X} layoutOrder={1} />
				{evadeHint && <HintChip hint={evadeHint} order={2} />}
			</frame>

			<frame
				ref={joystickRef}
				key="TouchJoystick"
				Active={true}
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.6}
				BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.joystick.x, touch.joystick.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.joystick.width, touch.joystick.height) : UDim2.fromOffset(120, 120)}
				Visible={touch !== undefined}
				Event={{ InputBegan: (_rbx, input) => onJoystickBegan(input) }}
			>
				<Corner scale={0.5} />
				<Stroke color={C.Ivory} transparency={0.7} thickness={1.5} />
				<frame
					ref={knobRef}
					key="JoystickKnob"
					AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={C.Accent}
					BackgroundTransparency={0.2}
					BorderSizePixel={0}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromOffset(46, 46)}
				>
					<Corner scale={0.5} />
				</frame>
			</frame>

			<frame
				key="ThrottleControls"
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.5}
				BorderSizePixel={0}
				Position={touch ? UDim2.fromOffset(touch.throttle.x, touch.throttle.y) : undefined}
				Size={touch ? UDim2.fromOffset(touch.throttle.width, touch.throttle.height) : UDim2.fromOffset(44, 124)}
				Visible={touch !== undefined}
			>
				<Corner radius={22} />
				<Stroke transparency={0.8} />
				<textbutton
					key="ThrottleUpButton"
					AnchorPoint={throttleVertical ? new Vector2(0.5, 0) : new Vector2(1, 0.5)}
					AutoButtonColor={false}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={throttleVertical ? new UDim2(0.5, 0, 0, 0) : new UDim2(1, 0, 0.5, 0)}
					Selectable={false}
					Size={throttleButtonSize}
					Text="+"
					TextColor3={C.Ivory}
					TextSize={20}
					Event={{ Activated: () => onThrottle(throttle + 0.1) }}
				/>
				<Label
					name="ThrottleText"
					text={`${math.floor(throttle * 100 + 0.5)}%`}
					color={C.Muted}
					textSize={11}
					font={Enum.Font.RobotoMono}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={UDim2.fromScale(0.5, 0.5)}
					size={UDim2.fromOffset(36, 20)}
					textXAlignment={Enum.TextXAlignment.Center}
				/>
				<textbutton
					key="ThrottleDownButton"
					AnchorPoint={throttleVertical ? new Vector2(0.5, 1) : new Vector2(0, 0.5)}
					AutoButtonColor={false}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={throttleVertical ? new UDim2(0.5, 0, 1, 0) : new UDim2(0, 0, 0.5, 0)}
					Selectable={false}
					Size={throttleButtonSize}
					Text="−"
					TextColor3={C.Ivory}
					TextSize={20}
					Event={{ Activated: () => onThrottle(throttle - 0.1) }}
				/>
			</frame>

			<frame key="CombatControls" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
				{touch && (
					<RoundButton
						name="MissileButton"
						text={missileButtonText}
						rectangle={touch.missile}
						filled={ready && locked}
						enabled={ready}
						textSize={touch.missile.width >= 80 ? 15 : 13}
						onActivated={onMissile}
					/>
				)}
				{touch && <RoundButton name="TargetButton" text="TGT" rectangle={touch.target} filled={false} enabled={true} textSize={12} onActivated={onTarget} />}
				<frame
					key="WeaponStatus"
					BackgroundTransparency={1}
					Position={UDim2.fromOffset(layout.status.x, layout.status.y)}
					Size={UDim2.fromOffset(layout.status.width, layout.status.height)}
				>
					<Label
						name="WeaponText"
						text={missileText}
						richText={true}
						color={telemetry.missiles <= 0 ? C.Danger : C.Ivory}
						textSize={15}
						font={Enum.Font.RobotoMono}
						size={new UDim2(1, 0, 0, 20)}
						textXAlignment={Enum.TextXAlignment.Right}
						stroke={true}
					/>
					<Label
						name="HullText"
						text={`HULL ${hull}%`}
						color={hull <= 30 ? C.Danger : hull <= 60 ? C.Orange : C.Muted}
						textSize={11}
						font={Enum.Font.GothamBold}
						position={UDim2.fromOffset(0, 21)}
						size={new UDim2(1, 0, 0, 16)}
						textXAlignment={Enum.TextXAlignment.Right}
						visible={hull < 100}
						stroke={true}
					/>
				</frame>
			</frame>

			{layout.hints && <HintRow name="ControlHints" hints={hints} rectangle={layout.hints} />}
		</frame>
	);
}

export function GameUI({ remotes, controller }: GameUIProps) {
	const [screen, setScreen] = useState<Screen>("title");
	const [viewport, setViewport] = useState(new Vector2(568, 320));
	const [slots, setSlots] = useState<SaveSlot[] | undefined>();
	const [persistence, setPersistence] = useState<Persistence>("unavailable");
	const [selectedSlot, setSelectedSlot] = useState(1);
	const [selectedMission, setSelectedMission] = useState(1);
	const [busy, setBusy] = useState(false);
	const [toast, setToast] = useState<ToastState | undefined>();
	const [telemetry, setTelemetry] = useState(defaultTelemetry);
	const [throttle, setThrottleState] = useState(0.65);
	const [outcome, setOutcome] = useState<OutcomeState>({ won: true, missionId: 1, kills: 3, groundKills: 1, elapsed: 0, saveText: "", saveColor: C.Muted });
	const [inputMode, setInputMode] = useState<InputMode>(readInputMode);
	const [hintUntil, setHintUntil] = useState(0);
	const [killNotice, setKillNotice] = useState<KillNotice | undefined>();
	const [damageUntil, setDamageUntil] = useState(0);

	const mountedRef = useRef(true);
	const screenRef = useRef<Screen>("title");
	const inMissionRef = useRef(false);
	const requestRef = useRef(0);
	const busyRef = useRef(false);
	const toastRef = useRef(0);
	const throttleRef = useRef(0.65);
	const selectedSlotRef = useRef(1);
	const selectedMissionRef = useRef(1);
	const persistenceRef = useRef<Persistence>("unavailable");
	const telemetryRef = useRef(defaultTelemetry());
	const inputModeRef = useRef<InputMode>(inputMode);
	const outcomeWonRef = useRef(true);
	const outcomeMissionRef = useRef(1);
	const rootFrameRef = useRef<Frame>();
	const joystickRef = useRef<Frame>();
	const knobRef = useRef<Frame>();
	const activeJoystickInput = useRef<InputObject>();

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

	const selectDefault = useCallback(() => {
		const root = rootFrameRef.current;
		if (!root || !mountedRef.current) return;
		const current = screenRef.current;
		const selected = GuiService.SelectedObject;
		if (current === "mission" || inputModeRef.current !== "gamepad") {
			if (selected && selected.IsDescendantOf(root)) GuiService.SelectedObject = undefined;
			return;
		}
		const screenFrame = root.FindFirstChild(MENU_SCREEN_FRAMES[current]);
		if (!screenFrame) return;
		if (selected && selected.IsDescendantOf(screenFrame)) return;
		const defaultName = current === "title"
			? "CampaignButton"
			: current === "slots"
				? `Slot${selectedSlotRef.current}Button`
				: current === "briefing"
					? "LaunchButton"
					: outcomeWonRef.current && outcomeMissionRef.current === 1 ? "Mission1NextMissionButton" : outcomeWonRef.current ? "ReturnToMenuButton" : "RetryButton";
		const target = screenFrame.FindFirstChild(defaultName, true);
		if (target && target.IsA("GuiObject")) GuiService.SelectedObject = target;
	}, []);

	const goBack = useCallback(() => {
		if (busyRef.current) return;
		if (screenRef.current === "slots") changeScreen("title");
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

	const startMission = useCallback(() => {
		beginRequest((requestId) => {
			const [response, problem] = invoke("StartMission", { slot: selectedSlot, missionId: selectedMission });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else {
				if (response.slots) applyResponseSlots(response);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedMission, selectedSlot, showToast]);

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
			const [started, startError] = invoke("StartMission", { slot: selectedSlot, missionId });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!started) showToast(startError ?? "Command rejected the request.", true);
			else {
				if (started.slots) applyResponseSlots(started);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedSlot, showToast]);

	const retryMission = useCallback(() => restartMission(selectedMissionRef.current), [restartMission]);
	const nextMission = useCallback(() => restartMission(2), [restartMission]);

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
			if (payload.kind === "Started") {
				const started = payload as MissionStarted;
				const slot = math.clamp(math.floor(finite(started.slot, selectedSlotRef.current)), 1, 4);
				const missionId = started.missionId === 2 ? 2 : 1;
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
				if (missionId === 2) {
					resetTelemetry.phase = "intercept";
					resetTelemetry.objective = "Intercept the required bandits";
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
			} else if (payload.kind === "Telemetry") {
				if (inMissionRef.current) {
					const previous = telemetryRef.current;
					const sanitized = sanitizeTelemetry(payload, previous);
					if (sanitized.kills > previous.kills) setKillNotice({ kills: sanitized.kills, total: sanitized.total, until: os.clock() + 3 });
					if (sanitized.health < previous.health) setDamageUntil(os.clock() + 0.45);
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
				const missionId = finished.missionId === 2 ? 2 : current.missionId === 2 ? 2 : 1;
				selectedMissionRef.current = missionId;
				setSelectedMission(missionId);
				outcomeWonRef.current = won;
				outcomeMissionRef.current = missionId;
				changeScreen("outcome");
				const resultPersistence = normalizePersistence(finished.persistence ?? persistenceRef.current);
				const saveText = won && finished.saved === true && resultPersistence === "cloud"
					? "FLIGHT RECORD SAVED TO CLOUD"
					: resultPersistence === "session"
						? "RESULT HELD FOR THIS SESSION ONLY"
						: resultPersistence === "unavailable"
							? "SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST"
							: won ? "RESULT RECEIVED — SAVE NOT CONFIRMED" : "";
				setOutcome({
					won,
					missionId,
					kills: math.max(0, math.floor(finite(finished.kills, current.kills))),
					groundKills: math.max(0, math.floor(finite(finished.groundKills, current.groundKills ?? 0))),
					elapsed: math.max(0, finite(finished.elapsed, current.elapsed)),
					reason: safeString(finished.reason, ""),
					saveText,
					saveColor: won && finished.saved === true && resultPersistence === "cloud" ? C.Accent : resultPersistence === "cloud" ? C.Muted : C.Orange,
				});
			}
		});
		return () => connection.Disconnect();
	}, [applyResponseSlots, beginRequest, cancelRequests, changeScreen, controller, invoke, releaseJoystick, remotes, showToast]);

	useEffect(() => {
		let sampleClock = 0;
		const connection = RunService.RenderStepped.Connect((deltaTime) => {
			if (!mountedRef.current) return;
			if (screenRef.current !== "mission") setMenuCamera();
			else {
				sampleClock += deltaTime;
				if (sampleClock >= 0.1) {
					sampleClock = 0;
					const [ok, snapshot] = pcall(() => controller.GetTelemetry());
					if (ok && typeIs(snapshot, "table")) {
						const current = telemetryRef.current;
						const sampled = {
							...current,
							targetDistance: math.max(0, finite((snapshot as Telemetry).targetDistance, current.targetDistance ?? 0)),
							boundaryWarning: (snapshot as Telemetry).boundaryWarning === true,
						};
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

	const menu = getMenuLayout(viewport.X, viewport.Y);
	const selectedSave = slots?.[selectedSlot - 1];
	const rootChange = useMemo(() => ({ AbsoluteSize: (root: Frame) => mountedRef.current && setViewport(root.AbsoluteSize) }), []);
	const now = os.clock();
	let callout: Callout | undefined;
	if (killNotice && now < killNotice.until) {
		callout = { eyebrow: "HOSTILE DOWN", title: telemetry.objective ?? "CONTINUE THE OBJECTIVE" };
	} else if (telemetry.elapsed < 4.5) {
		callout = { eyebrow: "OBJECTIVE", title: telemetry.objective ?? "COMPLETE THE MISSION" };
	}
	const toastRectangle = getToastLayout(viewport.X, viewport.Y, screen === "mission" ? undefined : menu);
	const menuHints: ControlHint[] = [{ keyCode: "ButtonA", label: "A", action: "SELECT" }];
	if (screen === "slots" || screen === "briefing") menuHints.push({ keyCode: "ButtonB", label: "B", action: "BACK" });
	const menuHintsRectangle = getMenuHintsLayout(viewport.X, viewport.Y, menu);

	return (
		<InputModeContext.Provider value={inputMode}>
			<screengui key="SkybreakBackdrop" DisplayOrder={19} IgnoreGuiInset={true} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.None}>
				<MenuBackdrop visible={screen !== "mission"} mode={menu.mode} />
			</screengui>
			<screengui key="SkybreakUI" DisplayOrder={20} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame ref={rootFrameRef} key="Root" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Change={rootChange}>
					<TitleScreen visible={screen === "title"} menu={menu} onCampaign={() => { if (!busyRef.current) { changeScreen("slots"); loadSlots(); } }} />
					<CampaignScreen visible={screen === "slots"} menu={menu} slots={slots} busy={busy} persistence={persistence} onBack={goBack} onSlot={(slot) => { if (!busyRef.current && slots?.[slot - 1]) { const missionId = resumeMission(slots[slot - 1]); selectedSlotRef.current = slot; selectedMissionRef.current = missionId; setSelectedSlot(slot); setSelectedMission(missionId); changeScreen("briefing"); } }} />
					<BriefingScreen visible={screen === "briefing"} menu={menu} selectedSlot={selectedSlot} selectedMission={selectedMission} slot={selectedSave} busy={busy} onBack={goBack} onLaunch={startMission} onMission={(missionId) => { selectedMissionRef.current = missionId; setSelectedMission(missionId); }} />
					<MissionHud
						visible={screen === "mission"}
						viewport={viewport}
						inputMode={inputMode}
						telemetry={telemetry}
						throttle={throttle}
						callout={callout}
						introduction={telemetry.elapsed < 8 || now < hintUntil}
						damageFlash={now < damageUntil}
						joystickRef={joystickRef}
						knobRef={knobRef}
						onJoystickBegan={joystickBegan}
						onThrottle={setThrottle}
						onMissile={() => missileReady(telemetry) && controller.FireMissile()}
						onTarget={() => controller.CycleTarget()}
					/>
					<OutcomeScreen visible={screen === "outcome"} menu={menu} outcome={outcome} busy={busy} onRetry={retryMission} onReturn={returnToMenu} onNext={nextMission} />
					<HintRow
						name="MenuHints"
						hints={menuHints}
						rectangle={menuHintsRectangle}
						alignment={menu.mode === "side" ? Enum.HorizontalAlignment.Right : Enum.HorizontalAlignment.Left}
						visible={inputMode === "gamepad" && screen !== "mission"}
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
