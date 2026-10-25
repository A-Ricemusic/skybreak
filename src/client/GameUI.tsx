import React, { useCallback, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { RunService, UserInputService, Workspace } from "@rbxts/services";

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
import { getHudLayout } from "../shared/UILayout";

const C = {
	Ink: Color3.fromRGB(5, 14, 25),
	Panel: Color3.fromRGB(13, 35, 53),
	PanelLight: Color3.fromRGB(18, 47, 67),
	Ivory: Color3.fromRGB(239, 235, 218),
	Muted: Color3.fromRGB(146, 164, 170),
	Teal: Color3.fromRGB(52, 218, 200),
	TealDim: Color3.fromRGB(25, 111, 111),
	Orange: Color3.fromRGB(255, 143, 72),
	Danger: Color3.fromRGB(255, 75, 71),
};

const MENU_CAMERA = CFrame.lookAt(new Vector3(180, 95, 170), new Vector3(0, 24, 0));
const SLOT_NUMBERS = [1, 2, 3, 4];

type Screen = "title" | "slots" | "briefing" | "mission" | "outcome";

interface ToastState {
	message: string;
	isError: boolean;
}

interface OutcomeState {
	won: boolean;
	kills: number;
	elapsed: number;
	saveText: string;
	saveColor: Color3;
}

interface GameUIProps {
	remotes: Remotes;
	controller: FlightController;
}

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
	textXAlignment?: Enum.TextXAlignment;
	onActivated: () => void;
}

const Corner = ({ radius = 4 }: { radius?: number }) => <uicorner CornerRadius={new UDim(0, radius)} />;

const Stroke = ({
	color = C.TealDim,
	transparency = 0.35,
	thickness = 1,
}: {
	color?: Color3;
	transparency?: number;
	thickness?: number;
}) => <uistroke Color={color} Transparency={transparency} Thickness={thickness} />;

function ActionButton({
	name,
	text,
	primary = false,
	enabled = true,
	position,
	size = UDim2.fromOffset(180, 52),
	anchorPoint,
	layoutOrder,
	textSize = 15,
	textXAlignment = Enum.TextXAlignment.Center,
	onActivated,
}: ActionButtonProps) {
	return (
		<textbutton
			key={name}
			Active={enabled}
			AutoButtonColor={false}
			AnchorPoint={anchorPoint}
			Position={position}
			Size={size}
			LayoutOrder={layoutOrder}
			BackgroundColor3={primary ? C.Teal : C.PanelLight}
			BackgroundTransparency={enabled ? 0 : 0.55}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			Text={text}
			TextColor3={primary ? C.Ink : C.Ivory}
			TextTransparency={enabled ? 0 : 0.42}
			TextSize={textSize}
			TextXAlignment={textXAlignment}
			Event={{ Activated: () => enabled && onActivated() }}
		>
			<Corner />
			<Stroke color={primary ? C.Teal : C.TealDim} transparency={enabled ? 0.35 : 0.82} />
			{textXAlignment === Enum.TextXAlignment.Left && (
				<uipadding PaddingLeft={new UDim(0, 20)} PaddingRight={new UDim(0, 16)} />
			)}
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
	textScaled = false,
	anchorPoint,
	layoutOrder,
	visible = true,
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
	textScaled?: boolean;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	visible?: boolean;
	zIndex?: number;
}) {
	return (
		<textlabel
			key={name}
			AnchorPoint={anchorPoint}
			Position={position}
			Size={size}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			Font={font}
			Text={text}
			TextColor3={color}
			TextSize={textSize}
			TextXAlignment={textXAlignment}
			TextYAlignment={textYAlignment}
			TextWrapped={textWrapped}
			TextScaled={textScaled}
			LayoutOrder={layoutOrder}
			Visible={visible}
			ZIndex={zIndex}
		/>
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
			kills: math.clamp(math.floor(finite(source.kills, 0)), 0, 3),
			bestTime,
			updatedAt: source.updatedAt,
		});
	}
	return parsed;
}

function normalizePersistence(value: unknown): Persistence {
	return value === "cloud" || value === "session" ? value : "unavailable";
}

function sanitizeTelemetry(payload: Telemetry, previous: Telemetry): Telemetry {
	return {
		kind: "Telemetry",
		health: math.clamp(finite(payload.health, previous.health), 0, 100),
		speed: math.max(0, finite(payload.speed, previous.speed)),
		altitude: finite(payload.altitude, previous.altitude),
		kills: math.clamp(math.floor(finite(payload.kills, previous.kills)), 0, 3),
		total: math.clamp(math.floor(finite(payload.total, 3)), 1, 3),
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
	};
}

function setMenuCamera() {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = MENU_CAMERA;
	camera.FieldOfView = 54;
}

function MenuBackdrop({ visible }: { visible: boolean }) {
	return (
		<>
			<frame
				key="Backdrop"
				BackgroundColor3={C.Ink}
				BackgroundTransparency={0.17}
				BorderSizePixel={0}
				Size={UDim2.fromScale(1, 1)}
				Visible={visible}
				ZIndex={0}
			>
				<uigradient
					Color={new ColorSequence([
						new ColorSequenceKeypoint(0, Color3.fromRGB(3, 13, 24)),
						new ColorSequenceKeypoint(0.58, Color3.fromRGB(8, 31, 48)),
						new ColorSequenceKeypoint(1, Color3.fromRGB(17, 54, 66)),
					])}
					Rotation={24}
				/>
			</frame>
			<frame
				key="TopAccent"
				BackgroundColor3={C.Teal}
				BackgroundTransparency={0.2}
				BorderSizePixel={0}
				Position={UDim2.fromOffset(24, 20)}
				Size={UDim2.fromOffset(70, 2)}
				Visible={visible}
				ZIndex={1}
			/>
		</>
	);
}

function TitleScreen({ visible, portrait, onCampaign }: { visible: boolean; portrait: boolean; onCampaign: () => void }) {
	return (
		<frame key="TitleScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame
				key="TitleContent"
				AnchorPoint={new Vector2(0, 0.5)}
				BackgroundTransparency={1}
				Position={portrait ? new UDim2(0.06, 0, 0.42, 0) : new UDim2(0.075, 0, 0.5, 0)}
				Size={portrait ? new UDim2(0.88, 0, 0, 330) : new UDim2(0.62, 0, 0, 330)}
			>
				<Label name="Eyebrow" text="STRIKE COMMAND // THEATER 07" color={C.Teal} textSize={12} font={Enum.Font.GothamBold} position={UDim2.fromOffset(2, 0)} size={new UDim2(1, 0, 0, 24)} />
				<textlabel key="Title" BackgroundTransparency={1} Position={UDim2.fromOffset(0, 28)} Size={new UDim2(1, 0, 0, 72)} Font={Enum.Font.GothamBlack} Text="SKYBREAK" TextColor3={C.Ivory} TextScaled={true} TextXAlignment={Enum.TextXAlignment.Left}>
					<uitextsizeconstraint MinTextSize={30} MaxTextSize={58} />
				</textlabel>
				<Label name="Subtitle" text="O P E R A T I O N   G L A S S   H O R I Z O N" color={C.Orange} textSize={14} font={Enum.Font.GothamBold} position={UDim2.fromOffset(2, 103)} size={new UDim2(1, 0, 0, 28)} />
				<frame key="Divider" BackgroundColor3={C.Ivory} BackgroundTransparency={0.72} BorderSizePixel={0} Position={UDim2.fromOffset(2, 148)} Size={new UDim2(0.68, 0, 0, 1)} />
				<Label name="Blurb" text={"Three hostile aircraft have crossed the island defense line.\nLaunch before the horizon closes."} color={C.Muted} textSize={15} position={UDim2.fromOffset(2, 166)} size={new UDim2(0.84, 0, 0, 54)} textWrapped={true} textYAlignment={Enum.TextYAlignment.Top} />
				<ActionButton name="CampaignButton" text="CAMPAIGN   ›" primary={true} position={UDim2.fromOffset(2, 245)} size={UDim2.fromOffset(250, 58)} textXAlignment={Enum.TextXAlignment.Left} onActivated={onCampaign} />
			</frame>
			<Label name="Footer" text="ORIGINAL ARCADE FLIGHT COMBAT" color={C.Muted} textSize={10} font={Enum.Font.GothamBold} anchorPoint={new Vector2(1, 1)} position={new UDim2(1, -24, 1, -18)} size={UDim2.fromOffset(280, 20)} textXAlignment={Enum.TextXAlignment.Right} />
		</frame>
	);
}

function CampaignScreen({
	visible,
	portrait,
	compactHeight,
	slots,
	busy,
	persistence,
	onBack,
	onSlot,
}: {
	visible: boolean;
	portrait: boolean;
	compactHeight: boolean;
	slots?: SaveSlot[];
	busy: boolean;
	persistence: Persistence;
	onBack: () => void;
	onSlot: (slot: number) => void;
}) {
	const persistenceText = busy
		? "CONNECTING TO FLIGHT RECORDS"
		: persistence === "cloud"
			? "FLIGHT RECORDS // CLOUD LINK ONLINE"
			: persistence === "session"
				? "FLIGHT RECORDS // THIS SESSION ONLY"
				: "FLIGHT RECORDS // OFFLINE — PROGRESS MAY NOT PERSIST";
	return (
		<frame key="CampaignScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<Label name="CampaignHeader" text="CAMPAIGN FILES" textSize={28} font={Enum.Font.GothamBlack} position={new UDim2(0.06, 0, 0.07, 0)} size={new UDim2(0.75, 0, 0, 44)} />
			<Label name="CampaignSubheader" text="SELECT A FLIGHT RECORD" color={C.Teal} textSize={11} font={Enum.Font.GothamBold} position={new UDim2(0.06, 2, 0.07, 44)} size={new UDim2(0.75, 0, 0, 24)} />
			<frame key="SlotGrid" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Position={UDim2.fromScale(0.5, 0.53)} Size={portrait ? new UDim2(0.88, 0, 0.66, 0) : new UDim2(0.88, 0, compactHeight ? 0.52 : 0.56, 0)}>
				<uigridlayout CellPadding={UDim2.fromOffset(12, 12)} CellSize={portrait ? new UDim2(1, 0, 0.25, -9) : new UDim2(0.5, -6, 0.5, -6)} FillDirectionMaxCells={portrait ? 1 : 2} SortOrder={Enum.SortOrder.LayoutOrder} />
				{SLOT_NUMBERS.map((number) => {
					const slot = slots?.[number - 1];
					const status = busy ? "READING FILE..." : !slot ? "LINK UNAVAILABLE" : slot.completed ? "COMPLETED // REPLAY" : slot.occupied ? "CONTINUE SORTIE" : "NEW CAMPAIGN";
					const detail = busy ? "PLEASE STAND BY" : !slot ? "RETURN AND TRY AGAIN" : slot.completed ? `HOSTILES 3 / 3   BEST ${slot.bestTime !== undefined ? formatTime(slot.bestTime) : "--:--"}` : slot.occupied ? `LAST RESULT  ${slot.kills} / 3 HOSTILES` : "NO FLIGHT RECORD";
					return (
						<textbutton key={`Slot${number}Button`} Active={!busy && slot !== undefined} AutoButtonColor={false} BackgroundColor3={C.Panel} BackgroundTransparency={0.08} BorderSizePixel={0} LayoutOrder={number} Text="" Event={{ Activated: () => !busy && slot !== undefined && onSlot(number) }}>
							<Corner radius={5} />
							<Stroke transparency={0.48} />
							<Label name="SlotNumber" text={string.format("%02d", number)} color={C.Orange} textSize={12} font={Enum.Font.GothamBold} position={UDim2.fromOffset(18, 10)} size={UDim2.fromOffset(42, 22)} />
							<Label name="Status" text={status} color={slot?.completed ? C.Teal : C.Ivory} textSize={18} font={Enum.Font.GothamBold} position={UDim2.fromOffset(18, 34)} size={new UDim2(1, -52, 0, 30)} />
							<Label name="Detail" text={detail} color={C.Muted} textSize={11} position={UDim2.fromOffset(18, 66)} size={new UDim2(1, -52, 0, 22)} />
							<Label name="Arrow" text="›" color={C.Teal} textSize={24} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -18, 0.5, 0)} size={UDim2.fromOffset(22, 32)} textXAlignment={Enum.TextXAlignment.Right} />
						</textbutton>
					);
				})}
			</frame>
			<ActionButton name="CampaignBackButton" text="‹  BACK" position={new UDim2(0.06, 0, 1, -64)} size={UDim2.fromOffset(126, 48)} enabled={!busy} onActivated={onBack} />
			<Label name="PersistenceStatus" text={persistenceText} color={C.Muted} textSize={10} font={Enum.Font.GothamBold} anchorPoint={new Vector2(1, 1)} position={new UDim2(0.94, 0, 1, -22)} size={UDim2.fromOffset(380, 22)} textXAlignment={Enum.TextXAlignment.Right} />
		</frame>
	);
}

function BriefingScreen({
	visible,
	selectedSlot,
	slot,
	portrait,
	compactHeight,
	busy,
	onBack,
	onLaunch,
}: {
	visible: boolean;
	selectedSlot: number;
	slot?: SaveSlot;
	portrait: boolean;
	compactHeight: boolean;
	busy: boolean;
	onBack: () => void;
	onLaunch: () => void;
}) {
	const compact = compactHeight && !portrait;
	const mode = slot?.completed ? "COMPLETED // REPLAY" : slot?.occupied ? "CONTINUE SORTIE" : "NEW SORTIE";
	return (
		<frame key="BriefingScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="BriefingPanel" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={C.Panel} BackgroundTransparency={0.04} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5)} Size={portrait ? new UDim2(0.9, 0, 0.82, 0) : compact ? new UDim2(0.9, 0, 0.9, 0) : new UDim2(0.82, 0, 0.75, 0)}>
				<Corner radius={6} />
				<Stroke transparency={0.35} />
				<uipadding PaddingLeft={new UDim(0, 34)} PaddingRight={new UDim(0, 34)} PaddingTop={new UDim(0, 24)} PaddingBottom={new UDim(0, 24)} />
				<Label name="BriefingEyebrow" text="MISSION 01 // EMERGENCY VECTOR" color={C.Orange} textSize={compact ? 9 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, compact ? 16 : 22)} />
				<Label name="BriefingTitle" text="GLASS HORIZON" textSize={compact ? 24 : 32} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, compact ? 17 : 30)} size={new UDim2(1, 0, 0, compact ? 30 : 44)} />
				<Label name="ObjectiveTag" text="PRIMARY OBJECTIVE" color={C.Teal} textSize={compact ? 9 : 10} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, compact ? 50 : 90)} size={UDim2.fromOffset(180, compact ? 14 : 18)} />
				<Label name="Objective" text="Destroy the three hostile aircraft" textSize={compact ? 16 : 19} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, compact ? 64 : 110)} size={new UDim2(1, 0, 0, compact ? 26 : 34)} />
				<Label name="Story" text="CONTROL: Unknown contacts have cut across the outer defense line under cover of a fractured storm front. The island runway is still operational, but only just. Break through, identify the hostile flight, and clear the sky before they reach the evacuation corridor." color={C.Muted} textSize={compact ? 11 : 14} position={UDim2.fromOffset(0, compact ? 96 : 156)} size={new UDim2(1, 0, 0, compact ? 66 : 82)} textWrapped={true} textYAlignment={Enum.TextYAlignment.Top} />
				<frame key="BriefingRule" BackgroundColor3={C.Ivory} BackgroundTransparency={0.78} BorderSizePixel={0} Position={new UDim2(0, 0, 1, compact ? -62 : -78)} Size={new UDim2(1, 0, 0, 1)} />
				<Label name="BriefingSlot" text={string.format("FILE %02d // %s", selectedSlot, mode)} color={C.Muted} textSize={10} font={Enum.Font.GothamBold} position={new UDim2(0, 0, 1, compact ? -50 : -62)} size={new UDim2(0.45, 0, 0, compact ? 38 : 40)} />
				<ActionButton name="BriefingBackButton" text="‹  FILES" anchorPoint={new Vector2(1, 1)} position={portrait ? new UDim2(1, 0, 1, -60) : new UDim2(1, -204, 1, 0)} size={UDim2.fromOffset(126, compact ? 48 : 52)} enabled={!busy} onActivated={onBack} />
				<ActionButton name="LaunchButton" text={busy ? "REQUESTING CLEARANCE..." : "LAUNCH  ›"} primary={true} anchorPoint={new Vector2(1, 1)} position={new UDim2(1, 0, 1, 0)} size={UDim2.fromOffset(190, compact ? 48 : 52)} enabled={!busy} onActivated={onLaunch} />
			</frame>
		</frame>
	);
}

function TelemetryPanel({ telemetry, compact, position, size }: { telemetry: Telemetry; compact: boolean; position: UDim2; size: UDim2 }) {
	const rows = [
		["Hull", `HULL ${math.floor(telemetry.health + 0.5)}%`, telemetry.health <= 30 ? C.Danger : C.Ivory],
		["Speed", `SPEED ${math.floor(telemetry.speed + 0.5)}`, C.Ivory],
		["Altitude", `ALT ${math.floor(telemetry.altitude + 0.5)}`, C.Ivory],
		["Elapsed", `TIME ${formatTime(telemetry.elapsed)}`, C.Muted],
	] as const;
	return (
		<frame key="TelemetryPanel" BackgroundColor3={C.Ink} BackgroundTransparency={0.3} BorderSizePixel={0} Position={position} Size={size}>
			<Corner radius={3} />
			<Stroke transparency={0.6} />
			<uipadding PaddingLeft={new UDim(0, compact ? 6 : 12)} PaddingRight={new UDim(0, compact ? 6 : 12)} PaddingTop={new UDim(0, compact ? 5 : 8)} PaddingBottom={new UDim(0, compact ? 5 : 8)} />
			{compact ? <uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalFlex={Enum.UIFlexAlignment.Fill} SortOrder={Enum.SortOrder.LayoutOrder} /> : <uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />}
			{rows.map(([name, text, color], index) => <Label key={name} name={name} text={text} color={color} textSize={compact ? 10 : 12} font={Enum.Font.RobotoMono} size={compact ? new UDim2(0.25, 0, 1, 0) : new UDim2(1, 0, 0, 20)} textXAlignment={compact ? Enum.TextXAlignment.Center : Enum.TextXAlignment.Left} layoutOrder={index + 1} />)}
		</frame>
	);
}

function MissionHud({
	visible,
	viewport,
	telemetry,
	throttle,
	joystickRef,
	knobRef,
	onJoystickBegan,
	onThrottle,
	onMissile,
	onEvade,
	onTarget,
}: {
	visible: boolean;
	viewport: Vector2;
	telemetry: Telemetry;
	throttle: number;
	joystickRef: React.RefObject<Frame>;
	knobRef: React.RefObject<Frame>;
	onJoystickBegan: (input: InputObject) => void;
	onThrottle: (value: number) => void;
	onMissile: () => void;
	onEvade: () => void;
	onTarget: () => void;
}) {
	const layout = getHudLayout(viewport.X, viewport.Y);
	const portrait = viewport.Y > viewport.X;
	const compactHeight = viewport.Y < 500;
	const missileReady = telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
	const evadeReady = telemetry.evadeCooldown <= 0;
	const locked = telemetry.lockProgress >= 0.99;
	const lockText = locked ? "LOCKED" : telemetry.target ? `LOCK ${math.floor(telemetry.lockProgress * 100)}%` : "SEEKING";
	const targetName = telemetry.targetName !== "" ? telemetry.targetName.upper() : "NO TARGET";
	const distance = (telemetry.targetDistance ?? 0) > 0 ? ` // ${math.floor((telemetry.targetDistance ?? 0) + 0.5)}m` : "";
	const warning = telemetry.incoming ? "⚠  MISSILE WARNING  ⚠" : telemetry.boundaryWarning ? "AIRSPACE LIMIT — TURN BACK" : "";
	const joystickSize = portrait ? 124 : compactHeight ? 122 : 136;
	const actionSize = portrait ? UDim2.fromOffset(132, 232) : UDim2.fromOffset(270, compactHeight ? 128 : 174);
	const horizontalThrottle = portrait || compactHeight;
	return (
		<frame key="MissionHUD" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="ObjectivePanel" BackgroundColor3={C.Ink} BackgroundTransparency={0.28} BorderSizePixel={0} Position={UDim2.fromOffset(layout.objective.x, layout.objective.y)} Size={UDim2.fromOffset(layout.objective.width, layout.objective.height)}>
				<Corner radius={3} /><Stroke transparency={0.55} />
				<Label name="ObjectiveText" text="DESTROY THE THREE HOSTILE AIRCRAFT" textSize={11} font={Enum.Font.GothamBold} position={UDim2.fromOffset(14, 5)} size={new UDim2(1, -28, 0, 22)} />
				<Label name="KillText" text={`HOSTILES  ${telemetry.kills} / ${telemetry.total}`} color={C.Teal} textSize={13} font={Enum.Font.GothamBold} position={UDim2.fromOffset(14, 26)} size={new UDim2(1, -28, 0, 22)} />
			</frame>
			<TelemetryPanel telemetry={telemetry} compact={layout.compactTop} position={UDim2.fromOffset(layout.telemetry.x, layout.telemetry.y)} size={UDim2.fromOffset(layout.telemetry.width, layout.telemetry.height)} />
			<frame key="TargetStatus" BackgroundColor3={C.Ink} BackgroundTransparency={0.38} BorderSizePixel={0} Position={UDim2.fromOffset(layout.target.x, layout.target.y)} Size={UDim2.fromOffset(layout.target.width, layout.target.height)} Visible={!layout.compactTop || warning === ""}>
				<Corner radius={3} /><Stroke transparency={0.58} />
				<Label name="TargetText" text={`${targetName}${distance} // ${lockText}`} color={C.Teal} textSize={11} font={Enum.Font.RobotoMono} size={UDim2.fromScale(1, 1)} textXAlignment={Enum.TextXAlignment.Center} />
			</frame>
			<Label name="Warning" text={warning} color={telemetry.incoming ? C.Danger : C.Orange} textSize={18} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(layout.compactTop ? layout.target.x : layout.warning.x, layout.compactTop ? layout.target.y : layout.warning.y)} size={UDim2.fromOffset(layout.compactTop ? layout.target.width : layout.warning.width, layout.compactTop ? layout.target.height : layout.warning.height)} textXAlignment={Enum.TextXAlignment.Center} />

			<frame ref={joystickRef} key="TouchJoystick" Active={true} AnchorPoint={new Vector2(0, 1)} BackgroundColor3={C.Ink} BackgroundTransparency={0.34} BorderSizePixel={0} Position={new UDim2(0, 18, 1, -18)} Size={UDim2.fromOffset(joystickSize, joystickSize)} Event={{ InputBegan: (_rbx, input) => onJoystickBegan(input) }}>
				<Corner radius={joystickSize / 2} /><Stroke transparency={0.3} thickness={2} />
				<Label name="Axes" text="+" color={C.TealDim} textSize={48} font={Enum.Font.RobotoMono} anchorPoint={new Vector2(0.5, 0.5)} position={UDim2.fromScale(0.5, 0.5)} size={UDim2.fromOffset(64, 64)} textXAlignment={Enum.TextXAlignment.Center} />
				<frame ref={knobRef} key="JoystickKnob" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={C.Teal} BackgroundTransparency={0.12} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromOffset(52, 52)}>
					<Corner radius={26} /><Stroke color={C.Ivory} transparency={0.6} />
				</frame>
			</frame>

			<frame key="ThrottleControls" AnchorPoint={new Vector2(0, 1)} BackgroundColor3={C.Ink} BackgroundTransparency={0.3} BorderSizePixel={0} Position={portrait ? new UDim2(0, 18, 1, -156) : new UDim2(0, compactHeight ? 150 : 166, 1, -18)} Size={horizontalThrottle ? UDim2.fromOffset(124, 54) : UDim2.fromOffset(68, 164)}>
				<Corner /><Stroke transparency={0.55} /><uipadding PaddingLeft={new UDim(0, horizontalThrottle ? 4 : 6)} PaddingRight={new UDim(0, horizontalThrottle ? 4 : 6)} PaddingTop={new UDim(0, horizontalThrottle ? 4 : 6)} PaddingBottom={new UDim(0, horizontalThrottle ? 4 : 6)} />
				<ActionButton name="ThrottleUpButton" text="+" position={UDim2.fromOffset(0, 0)} size={horizontalThrottle ? UDim2.fromOffset(44, 46) : new UDim2(1, 0, 0, 48)} textSize={22} onActivated={() => onThrottle(throttle + 0.1)} />
				<Label name="ThrottleText" text={`${math.floor(throttle * 100 + 0.5)}%\nTHR`} textSize={11} font={Enum.Font.RobotoMono} position={horizontalThrottle ? UDim2.fromOffset(44, 0) : UDim2.fromOffset(0, 50)} size={horizontalThrottle ? UDim2.fromOffset(28, 46) : new UDim2(1, 0, 0, 52)} textXAlignment={Enum.TextXAlignment.Center} textWrapped={true} />
				<ActionButton name="ThrottleDownButton" text="−" anchorPoint={horizontalThrottle ? new Vector2(1, 0) : new Vector2(0, 1)} position={horizontalThrottle ? new UDim2(1, 0, 0, 0) : new UDim2(0, 0, 1, 0)} size={horizontalThrottle ? UDim2.fromOffset(44, 46) : new UDim2(1, 0, 0, 48)} textSize={22} onActivated={() => onThrottle(throttle - 0.1)} />
			</frame>

			<frame key="CombatControls" AnchorPoint={new Vector2(1, 1)} BackgroundTransparency={1} Position={new UDim2(1, -18, 1, -18)} Size={actionSize}>
				<uigridlayout CellPadding={UDim2.fromOffset(8, 8)} CellSize={portrait ? new UDim2(1, 0, 0.25, -6) : new UDim2(0.5, -4, 0.5, -4)} FillDirectionMaxCells={portrait ? 1 : 2} SortOrder={Enum.SortOrder.LayoutOrder} />
				<ActionButton name="MissileButton" text={missileReady ? "MISSILE" : telemetry.missileCooldown > 0 ? `MISSILE ${string.format("%.1f", telemetry.missileCooldown)}` : "MISSILE EMPTY"} primary={true} enabled={missileReady} layoutOrder={1} textSize={16} onActivated={onMissile} />
				<ActionButton name="EvadeButton" text={evadeReady ? "EVADE" : `EVADE ${string.format("%.1f", telemetry.evadeCooldown)}`} enabled={evadeReady} layoutOrder={2} onActivated={onEvade} />
				<ActionButton name="TargetButton" text="TARGET" layoutOrder={3} onActivated={onTarget} />
				<frame key="WeaponStatus" BackgroundColor3={C.Ink} BackgroundTransparency={0.32} BorderSizePixel={0} LayoutOrder={4}>
					<Corner /><Stroke transparency={0.58} />
					<Label name="WeaponText" text={`MSL  ${telemetry.missiles}\n${lockText}`} color={locked ? C.Teal : C.Ivory} textSize={11} font={Enum.Font.RobotoMono} size={UDim2.fromScale(1, 1)} textXAlignment={Enum.TextXAlignment.Center} textWrapped={true} />
				</frame>
			</frame>
			<Label name="DesktopHelp" text="W/S PITCH · A/D TURN · RMB STEER · SPACE/LMB MISSILE · F EVADE · TAB/R TARGET · Q/E THROTTLE · SHIFT BOOST" color={C.Muted} textSize={9} font={Enum.Font.GothamBold} anchorPoint={new Vector2(0.5, 1)} position={new UDim2(0.5, 0, 1, -8)} size={new UDim2(0.7, 0, 0, 18)} textXAlignment={Enum.TextXAlignment.Center} visible={!UserInputService.TouchEnabled && !compactHeight} />
		</frame>
	);
}

function OutcomeScreen({
	visible,
	outcome,
	portrait,
	compactHeight,
	busy,
	onRetry,
	onReturn,
}: {
	visible: boolean;
	outcome: OutcomeState;
	portrait: boolean;
	compactHeight: boolean;
	busy: boolean;
	onRetry: () => void;
	onReturn: () => void;
}) {
	const compact = compactHeight && !portrait;
	return (
		<frame key="OutcomeScreen" BackgroundColor3={C.Ink} BackgroundTransparency={0.12} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="VictoryPanel" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={C.Panel} BackgroundTransparency={0.02} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5)} Size={portrait ? new UDim2(0.9, 0, 0.68, 0) : compact ? new UDim2(0.82, 0, 0.9, 0) : new UDim2(0.68, 0, 0.62, 0)}>
				<Corner radius={6} /><Stroke color={C.Teal} transparency={0.35} /><uipadding PaddingLeft={new UDim(0, 32)} PaddingRight={new UDim(0, 32)} PaddingTop={new UDim(0, 24)} PaddingBottom={new UDim(0, 24)} />
				<Label name="OutcomeEyebrow" text="OPERATION GLASS HORIZON" color={C.Orange} textSize={compact ? 9 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, compact ? 16 : 24)} />
				<Label name="OutcomeTitle" text={outcome.won ? "HORIZON SECURED" : "SORTIE LOST"} color={outcome.won ? C.Ivory : C.Danger} textSize={compact ? 25 : 34} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, compact ? 18 : 32)} size={new UDim2(1, 0, 0, compact ? 34 : 48)} />
				<Label name="OutcomeSummary" text={outcome.won ? "All hostile aircraft destroyed.\nThe evacuation corridor is clear. Campaign complete." : "The defense line did not hold.\nRearm and return to the horizon."} color={C.Muted} textSize={compact ? 12 : 15} position={UDim2.fromOffset(0, compact ? 53 : 88)} size={new UDim2(1, 0, 0, compact ? 42 : 54)} textWrapped={true} />
				<Label name="OutcomeStats" text={`HOSTILES  ${outcome.kills} / 3     TIME  ${formatTime(outcome.elapsed)}`} color={C.Teal} textSize={13} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(0, compact ? 101 : 154)} size={new UDim2(1, 0, 0, compact ? 22 : 28)} />
				<Label name="SaveStatus" text={outcome.saveText} color={outcome.saveColor} textSize={compact ? 9 : 11} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, compact ? 126 : 186)} size={new UDim2(1, 0, 0, compact ? 22 : 24)} />
				<ActionButton name="RetryButton" text={busy ? "RESETTING SORTIE..." : "RETRY SORTIE"} anchorPoint={new Vector2(1, 1)} position={portrait ? new UDim2(1, 0, 1, -60) : new UDim2(1, -198, 1, 0)} size={UDim2.fromOffset(184, compact ? 48 : 52)} enabled={!busy} onActivated={onRetry} />
				<ActionButton name="ReturnToMenuButton" text={outcome.won ? "CAMPAIGN COMPLETE  ›" : "RETURN TO MENU  ›"} primary={true} anchorPoint={new Vector2(1, 1)} position={new UDim2(1, 0, 1, 0)} size={UDim2.fromOffset(190, compact ? 48 : 52)} enabled={!busy} onActivated={onReturn} />
			</frame>
		</frame>
	);
}

export function GameUI({ remotes, controller }: GameUIProps) {
	const [screen, setScreen] = useState<Screen>("title");
	const [viewport, setViewport] = useState(new Vector2(568, 320));
	const [slots, setSlots] = useState<SaveSlot[] | undefined>();
	const [persistence, setPersistence] = useState<Persistence>("unavailable");
	const [selectedSlot, setSelectedSlot] = useState(1);
	const [busy, setBusy] = useState(false);
	const [toast, setToast] = useState<ToastState | undefined>();
	const [telemetry, setTelemetry] = useState(defaultTelemetry);
	const [throttle, setThrottleState] = useState(0.65);
	const [outcome, setOutcome] = useState<OutcomeState>({ won: true, kills: 3, elapsed: 0, saveText: "", saveColor: C.Muted });

	const mountedRef = useRef(true);
	const screenRef = useRef<Screen>("title");
	const inMissionRef = useRef(false);
	const requestRef = useRef(0);
	const busyRef = useRef(false);
	const toastRef = useRef(0);
	const throttleRef = useRef(0.65);
	const selectedSlotRef = useRef(1);
	const persistenceRef = useRef<Persistence>("unavailable");
	const telemetryRef = useRef(defaultTelemetry());
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
			const [response, problem] = invoke("StartMission", { slot: selectedSlot });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else {
				if (response.slots) applyResponseSlots(response);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedSlot, showToast]);

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

	const retryMission = useCallback(() => {
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
			const [started, startError] = invoke("StartMission", { slot: selectedSlot });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!started) showToast(startError ?? "Command rejected the request.", true);
			else {
				if (started.slots) applyResponseSlots(started);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedSlot, showToast]);

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
		if (!inMissionRef.current || (input.UserInputType !== Enum.UserInputType.Touch && input.UserInputType !== Enum.UserInputType.MouseButton1)) return;
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
		const changed = UserInputService.InputChanged.Connect((input) => {
			const active = activeJoystickInput.current;
			if (active && (input === active || input.UserInputType === Enum.UserInputType.MouseMovement)) moveJoystick(input);
		});
		const ended = UserInputService.InputEnded.Connect((input) => {
			const active = activeJoystickInput.current;
			if (active && (input === active || input.UserInputType === Enum.UserInputType.MouseButton1)) releaseJoystick();
		});
		const focus = UserInputService.WindowFocusReleased.Connect(releaseJoystick);
		return () => {
			changed.Disconnect();
			ended.Disconnect();
			focus.Disconnect();
		};
	}, [moveJoystick, releaseJoystick]);

	useEffect(() => {
		if (screen !== "mission") releaseJoystick();
	}, [releaseJoystick, screen]);

	useEffect(() => {
		const connection = remotes.MissionState.OnClientEvent.Connect((raw: unknown) => {
			if (!mountedRef.current || !typeIs(raw, "table")) return;
			const payload = raw as MissionMessage;
			if (payload.kind === "Started") {
				const started = payload as MissionStarted;
				const slot = math.clamp(math.floor(finite(started.slot, selectedSlotRef.current)), 1, 4);
				selectedSlotRef.current = slot;
				setSelectedSlot(slot);
				toastRef.current++;
				setToast(undefined);
				const resetTelemetry = defaultTelemetry();
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
					const sanitized = sanitizeTelemetry(payload, telemetryRef.current);
					telemetryRef.current = sanitized;
					setTelemetry(sanitized);
				}
			} else if (payload.kind === "Completed" || payload.kind === "Failed") {
				if (!inMissionRef.current) return;
				const finished = payload as MissionFinished;
				releaseJoystick();
				controller.Stop();
				setMenuCamera();
				changeScreen("outcome");
				const current = telemetryRef.current;
				const won = finished.kind === "Completed";
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
					kills: math.clamp(math.floor(finite(finished.kills, current.kills)), 0, 3),
					elapsed: math.max(0, finite(finished.elapsed, current.elapsed)),
					saveText,
					saveColor: won && finished.saved === true && resultPersistence === "cloud" ? C.Teal : resultPersistence === "cloud" ? C.Muted : C.Orange,
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

	const portrait = viewport.Y > viewport.X;
	const compactHeight = viewport.Y < 500;
	const selectedSave = slots?.[selectedSlot - 1];
	const rootChange = useMemo(() => ({ AbsoluteSize: (root: Frame) => mountedRef.current && setViewport(root.AbsoluteSize) }), []);

	return (
		<screengui key="SkybreakUI" DisplayOrder={20} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.DeviceSafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<frame ref={rootFrameRef} key="Root" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Change={rootChange}>
				<MenuBackdrop visible={screen !== "mission"} />
				<TitleScreen visible={screen === "title"} portrait={portrait} onCampaign={() => { if (!busyRef.current) { changeScreen("slots"); loadSlots(); } }} />
				<CampaignScreen visible={screen === "slots"} portrait={portrait} compactHeight={compactHeight} slots={slots} busy={busy} persistence={persistence} onBack={() => !busyRef.current && changeScreen("title")} onSlot={(slot) => { if (!busyRef.current && slots?.[slot - 1]) { selectedSlotRef.current = slot; setSelectedSlot(slot); changeScreen("briefing"); } }} />
				<BriefingScreen visible={screen === "briefing"} selectedSlot={selectedSlot} slot={selectedSave} portrait={portrait} compactHeight={compactHeight} busy={busy} onBack={() => !busyRef.current && changeScreen("slots")} onLaunch={startMission} />
				<MissionHud visible={screen === "mission"} viewport={viewport} telemetry={telemetry} throttle={throttle} joystickRef={joystickRef} knobRef={knobRef} onJoystickBegan={joystickBegan} onThrottle={setThrottle} onMissile={() => missileReady(telemetry) && controller.FireMissile()} onEvade={() => telemetry.evadeCooldown <= 0 && controller.Evade()} onTarget={() => controller.CycleTarget()} />
				<OutcomeScreen visible={screen === "outcome"} outcome={outcome} portrait={portrait} compactHeight={compactHeight} busy={busy} onRetry={retryMission} onReturn={returnToMenu} />
				{toast !== undefined && (
					<textlabel key="StatusToast" AnchorPoint={new Vector2(0.5, 1)} Position={new UDim2(0.5, 0, 1, -24)} Size={UDim2.fromOffset(math.min(420, viewport.X - 28), 48)} BackgroundColor3={C.Panel} BackgroundTransparency={0.06} BorderSizePixel={0} Font={Enum.Font.GothamBold} Text={toast.message} TextColor3={toast.isError ? C.Danger : C.Ivory} TextSize={12} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Center} ZIndex={20}>
						<Corner /><Stroke color={C.Orange} transparency={0.35} />
					</textlabel>
				)}
			</frame>
		</screengui>
	);
}

function missileReady(telemetry: Telemetry): boolean {
	return telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
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
