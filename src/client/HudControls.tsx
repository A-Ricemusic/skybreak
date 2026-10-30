import { VOICE_DISCLOSURE, VOICE_DISCLOSURE_DETAIL } from "../shared/VoiceDisclosure";
import React, { useEffect, useRef } from "@rbxts/react";
import { RunService, TweenService } from "@rbxts/services";
import { evadeGauge } from "../shared/EvadeGauge";
import {
	formatSetting,
	isToggleSetting,
	NumericSettingKey,
	PlayerSettings,
	SETTING_LABELS,
	SETTING_ORDER,
	SettingKey,
	stepSetting,
} from "../shared/PlayerSettings";
import { RADAR_GLYPHS, RADAR_LAYER, RADAR_NEAR_RANGE, RADAR_RIM_INSET, radarProject, radarRange, type RadarContactKind } from "../shared/RadarMath";
import type { Telemetry } from "../shared/Types";
import { getPauseLayout, getSettingsLayout, type Rectangle } from "../shared/UILayout";
import type { FlightController } from "./FlightController";
import { C, HUD, HUD_FONT, HUD_FONT_BOLD } from "./Theme";

const at = (rectangle: Rectangle) => ({ Position: UDim2.fromOffset(rectangle.x, rectangle.y), Size: UDim2.fromOffset(rectangle.width, rectangle.height) });

/** Ring that lights from the bottom up as the recharging charge returns (UIGradient on the stroke). */
function ringSequence(fraction: number): NumberSequence {
	if (fraction >= 0.999) return new NumberSequence(0);
	if (fraction <= 0.001) return new NumberSequence(0.8);
	const edge = math.clamp(fraction, 0.002, 0.997);
	return new NumberSequence([
		new NumberSequenceKeypoint(0, 0),
		new NumberSequenceKeypoint(edge - 0.001, 0),
		new NumberSequenceKeypoint(edge, 0.8),
		new NumberSequenceKeypoint(1, 0.8),
	]);
}

let gunTouchSerial = 0;
/**
 * Round touch GUN (batch D1, only when the sortie fits a gun): fires while held. Each touch is its own
 * trigger source and releases when that input ends anywhere, so a finger sliding off never sticks the gun on.
 */
export function GunButton({ rectangle, rounds, onTrigger }: { rectangle: Rectangle; rounds: number; onTrigger: (source: string, held: boolean) => void }) {
	const empty = rounds <= 0;
	return (
		<textbutton
			key="GunButton"
			Active={true}
			AutoButtonColor={false}
			Selectable={false}
			BackgroundColor3={HUD.Shadow}
			BackgroundTransparency={empty ? 0.8 : 0.65}
			BorderSizePixel={0}
			FontFace={HUD_FONT_BOLD}
			Text={`GUN ${math.max(0, math.floor(rounds))}`}
			TextColor3={HUD.Green}
			TextSize={rectangle.width >= 54 ? 10 : 9}
			TextStrokeColor3={HUD.Shadow}
			TextStrokeTransparency={0.5}
			TextTransparency={empty ? 0.5 : 0}
			{...at(rectangle)}
			Event={{
				InputBegan: (_rbx, input) => {
					if (input.UserInputState !== Enum.UserInputState.Begin) return;
					if (input.UserInputType !== Enum.UserInputType.Touch && input.UserInputType !== Enum.UserInputType.MouseButton1) return;
					gunTouchSerial += 1;
					const source = `touch${gunTouchSerial}`;
					onTrigger(source, true);
					const connection = input.GetPropertyChangedSignal("UserInputState").Connect(() => {
						if (input.UserInputState !== Enum.UserInputState.End && input.UserInputState !== Enum.UserInputState.Cancel) return;
						connection.Disconnect();
						onTrigger(source, false);
					});
				},
			}}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={HUD.Green} Thickness={1.5} Transparency={empty ? 0.5 : 0.2} />
		</textbutton>
	);
}

/**
 * Round touch EVADE: fires on touch-down (the roll is a timed skill), shows the
 * charge pips and a recharge ring, and pulses red while a missile is inbound
 * and a charge is ready. The server decides; a press is always sent.
 */
export function EvadeButton({ rectangle, telemetry, onEvade }: { rectangle: Rectangle; telemetry: Telemetry; onEvade: () => void }) {
	const gauge = evadeGauge(telemetry);
	const flashRef = useRef<Frame>();
	useEffect(() => {
		const flash = flashRef.current;
		if (!flash || !gauge.flash) return;
		flash.BackgroundTransparency = 0.25;
		const pulse = TweenService.Create(flash, new TweenInfo(0.32, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency: 0.85 });
		pulse.Play();
		return () => pulse.Cancel();
	}, [gauge.flash]);
	const size = rectangle.width;
	const pip = size >= 54 ? 6 : 5;
	const pips: React.ReactElement[] = [];
	if (gauge.maxCharges > 1) {
		for (let index = 0; index < gauge.maxCharges; index++) {
			const lit = index < gauge.charges;
			pips.push(
				<frame key={`Pip${index + 1}`} LayoutOrder={index} BackgroundColor3={lit ? HUD.Green : HUD.Shadow} BackgroundTransparency={lit ? 0.05 : 0.4} BorderSizePixel={0} Size={UDim2.fromOffset(pip, pip)}>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<uistroke Color={HUD.Green} Transparency={lit ? 0.4 : 0.2} Thickness={1} />
				</frame>,
			);
		}
	}
	return (
		<textbutton
			key="EvadeButton"
			Active={true}
			AutoButtonColor={false}
			Selectable={false}
			BackgroundColor3={HUD.Shadow}
			BackgroundTransparency={gauge.ready ? 0.62 : 0.78}
			BorderSizePixel={0}
			Text=""
			{...at(rectangle)}
			Event={{
				InputBegan: (_rbx, input) => {
					if (input.UserInputState !== Enum.UserInputState.Begin) return;
					if (input.UserInputType === Enum.UserInputType.Touch || input.UserInputType === Enum.UserInputType.MouseButton1) onEvade();
				},
			}}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={HUD.Green} Thickness={2.5} Transparency={0.05}>
				<uigradient Rotation={-90} Transparency={ringSequence(gauge.recharge)} />
			</uistroke>
			<frame ref={flashRef} key="IncomingFlash" BackgroundColor3={HUD.Red} BackgroundTransparency={1} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={gauge.flash} ZIndex={0}>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
			</frame>
			<textlabel
				key="EvadeLabel"
				BackgroundTransparency={1}
				Position={UDim2.fromScale(0, gauge.maxCharges > 1 ? 0.2 : 0.3)}
				Size={UDim2.fromScale(1, 0.4)}
				FontFace={HUD_FONT_BOLD}
				Text={gauge.label}
				TextColor3={HUD.Green}
				TextSize={size >= 54 ? 11 : 10}
				TextStrokeColor3={HUD.Shadow}
				TextStrokeTransparency={0.4}
				TextTransparency={gauge.ready ? 0 : 0.35}
				ZIndex={2}
			/>
			{pips.size() > 0 && (
				<frame key="ChargePips" BackgroundTransparency={1} Position={UDim2.fromScale(0, 0.62)} Size={new UDim2(1, 0, 0, pip)} ZIndex={2}>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Center} Padding={new UDim(0, 3)} SortOrder={Enum.SortOrder.LayoutOrder} />
					{pips}
				</frame>
			)}
		</textbutton>
	);
}

// HUD green for the frame; contacts differ by glyph fill and brightness, threats in red.
const RADAR_COLORS: { [kind in RadarContactKind]: Color3 } = {
	friendly: Color3.fromRGB(85, 185, 255),
	required: HUD.Green,
	optional: HUD.Dim,
	ground: HUD.Green,
	groundOptional: HUD.Dim,
	objective: HUD.White,
	protected: HUD.White,
	missile: HUD.Red,
};
const RADAR_TEXT: { [kind in RadarContactKind]: number } = {
	friendly: 12, required: 11, optional: 11, ground: 10, groundOptional: 9, objective: 13, protected: 10, missile: 14,
};
/** Seconds between radar refreshes: smooth enough for a heading-up scope, cheap on phones. */
const RADAR_INTERVAL = 1 / 20;
/** Heading letters on the rim, from world -Z (north) clockwise. */
const RADAR_CARDINALS: [string, number, number][] = [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]];

/**
 * Heading-up square radar scope: range rings, heading letters on the rim and
 * the player's arrow at the centre. Blips are pooled TextLabels moved from
 * RenderStepped (no React re-render per frame); every position comes from the
 * client's own replicated mission folder and telemetry via
 * FlightController.GetRadarContacts. Missiles in flight blink red.
 */
function RadarImpl({ rectangle, controller, visible, textSize = 10, minText = 8 }: { rectangle: Rectangle; controller: FlightController; visible: boolean; textSize?: number; minText?: number }) {
	const scopeRef = useRef<Frame>();
	const cardinalRefs = [useRef<TextLabel>(), useRef<TextLabel>(), useRef<TextLabel>(), useRef<TextLabel>()];
	const rangeRef = useRef<TextLabel>();
	const size = rectangle.width;
	useEffect(() => {
		const scope = scopeRef.current;
		if (!visible || !scope) return;
		const pool: TextLabel[] = [];
		let clock = RADAR_INTERVAL;
		let lastRange = -1;
		const radius = size / 2;
		// Glyphs grow with the scope (phones 72-110 px, desktop up to 170 px).
		const glyphScale = math.max(1, size / 110);
		const connection = RunService.RenderStepped.Connect((dt) => {
			clock += dt;
			if (clock < RADAR_INTERVAL) return;
			clock = 0;
			const position = controller.GetPosition();
			const yaw = controller.GetHeading();
			let used = 0;
			if (position && yaw !== undefined) {
				const jammed=controller.GetTelemetry().radarJammed;
				scope.BackgroundColor3=jammed ? Color3.fromRGB(12,35+math.floor(os.clock()*17)%15,22) : HUD.Shadow;
				if(jammed && rangeRef.current) rangeRef.current.Text=controller.GetTelemetry().radarPartial ? "PARTIAL JAM" : "JAMMED";
				const contacts = controller.GetRadarContacts();
				const range = radarRange(position.X, position.Z, contacts, controller.GetAirspace());
				if (!jammed && (range !== lastRange || (rangeRef.current?.Text==="JAMMED" || rangeRef.current?.Text==="PARTIAL JAM")) && rangeRef.current) {
					lastRange = range;
					rangeRef.current.Text = range === RADAR_NEAR_RANGE ? "1.6k" : string.format("%.1fk", range / 1000);
				}
				// Heading letters ride the outer ring (pinned to the rim like out-of-range blips).
				for (let index = 0; index < RADAR_CARDINALS.size(); index++) {
					const [, east, south] = RADAR_CARDINALS[index];
					const rim = radarProject(east * range * 2, south * range * 2, yaw, range, radius);
					const label = cardinalRefs[index].current;
					if (label) label.Position = UDim2.fromOffset(radius + rim.x, radius + rim.y);
				}
				const blink = os.clock() % 0.5 < 0.25;
				for (const contact of contacts) {
					const blip = radarProject(contact.x - position.X, contact.z - position.Z, yaw, range, radius);
					let label = pool[used];
					if (!label) {
						label = new Instance("TextLabel");
						label.Name = "RadarBlip";
						label.AnchorPoint = new Vector2(0.5, 0.5);
						label.Size = UDim2.fromOffset(24, 24);
						label.BackgroundTransparency = 1;
						label.Font = Enum.Font.GothamBold;
						label.TextStrokeColor3 = HUD.Shadow;
						label.TextStrokeTransparency = 0.3;
						label.Parent = scope;
						pool[used] = label;
					}
					used += 1;
					const glyph = RADAR_GLYPHS[contact.kind];
					if (label.Text !== glyph) label.Text = glyph;
					const missile = contact.kind === "missile";
					label.TextColor3 = contact.selected ? HUD.Amber : missile && blink ? HUD.White : RADAR_COLORS[contact.kind];
					label.TextSize = math.floor((RADAR_TEXT[contact.kind] + (contact.selected ? 3 : 0)) * glyphScale);
					label.ZIndex = 3 + RADAR_LAYER[contact.kind];
					label.TextTransparency = blip.edge ? 0.45 : missile && blink ? 0.15 : 0;
					label.Position = UDim2.fromOffset(radius + blip.x, radius + blip.y);
					label.Visible = true;
				}
			}
			for (let index = used; index < pool.size(); index++) if (pool[index].Visible) pool[index].Visible = false;
		});
		return () => {
			connection.Disconnect();
			for (const label of pool) label.Destroy();
		};
	}, [visible, size, controller]);
	const line = (name: string, horizontal: boolean) => (
		<frame key={name} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={HUD.Green} BackgroundTransparency={0.7} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5)} Size={horizontal ? new UDim2(1, -4, 0, 1) : new UDim2(0, 1, 1, -4)} ZIndex={2} />
	);
	const ring = (name: string, scale: number, transparency: number) => (
		<frame key={name} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromScale(scale, scale)} ZIndex={2}>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uistroke Color={HUD.Green} Transparency={transparency} Thickness={1} />
		</frame>
	);
	return (
		<frame ref={scopeRef} key="Radar" BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.5} BorderSizePixel={0} Visible={visible} {...at(rectangle)}>
			<uistroke Color={HUD.Green} Transparency={0.15} Thickness={1.5} />
			{line("Across", true)}
			{line("Along", false)}
			{ring("OuterRing", (size - 2 * RADAR_RIM_INSET) / size, 0.35)}
			{ring("MiddleRing", 0.5, 0.55)}
			{ring("InnerRing", 0.22, 0.7)}
			<textlabel key="Player" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromOffset(14, 14)} Font={Enum.Font.GothamBlack} Text="▲" TextColor3={HUD.Green} TextSize={12} TextStrokeColor3={HUD.Shadow} TextStrokeTransparency={0.3} ZIndex={11} />
			{RADAR_CARDINALS.map(([letter], index) => (
				<textlabel ref={cardinalRefs[index]} key={`Heading${letter}`} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Size={UDim2.fromOffset(12, 12)} FontFace={HUD_FONT_BOLD} Text={letter} TextColor3={HUD.Green} TextSize={textSize} TextStrokeColor3={HUD.Shadow} TextStrokeTransparency={0.3} ZIndex={3} />
			))}
			<textlabel ref={rangeRef} key="Range" AnchorPoint={new Vector2(1, 1)} BackgroundTransparency={1} Position={new UDim2(1, -3, 1, -1)} Size={UDim2.fromOffset(40, 10)} FontFace={HUD_FONT} Text="" TextColor3={HUD.Dim} TextSize={math.max(minText, textSize - 2)} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={3} />
		</frame>
	);
}

export const Radar = React.memo(RadarImpl);

/** Overlay button: 44+ px, gamepad-selectable, accent when primary. */
function OverlayButton({ name, text, rectangle, primary = false, textSize = 13, onActivated }: { name: string; text: string; rectangle: Rectangle; primary?: boolean; textSize?: number; onActivated: () => void }) {
	return (
		<textbutton
			key={name}
			Active={true}
			AutoButtonColor={true}
			Selectable={true}
			BackgroundColor3={primary ? C.Accent : C.Panel}
			BackgroundTransparency={primary ? 0 : 0.15}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			Text={text}
			TextColor3={primary ? C.Ink : C.Ivory}
			TextSize={textSize}
			ZIndex={42}
			{...at(rectangle)}
			Event={{ Activated: onActivated }}
		>
			<uicorner CornerRadius={new UDim(0, 6)} />
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={primary ? C.AccentHot : C.Ivory} Transparency={primary ? 0.5 : 0.8} />
		</textbutton>
	);
}

/** Dim overlay while the sortie is paused. The server resumes when the shared budget expires. */
export function PauseOverlay({ viewport, remaining, onResume, onSettings, onMenu }: { remaining?: number; viewport: Vector2; onResume: () => void; onSettings: () => void; onMenu: () => void }) {
	const layout = getPauseLayout(viewport.X, viewport.Y);
	const row = layout.buttons[0].y === layout.buttons[1].y;
	return (
		<frame key="PauseOverlay" Active={true} BackgroundColor3={C.Ink} BackgroundTransparency={0.35} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} ZIndex={40}>
			<frame key="PauseCard" BackgroundColor3={C.Panel} BackgroundTransparency={0.08} BorderSizePixel={0} ZIndex={41} {...at(layout.panel)}>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uistroke Color={C.Accent} Transparency={0.6} />
				<textlabel key="PauseTitle" BackgroundTransparency={1} Font={Enum.Font.GothamBlack} Text={remaining !== undefined && remaining <= 10 ? "RESUMING SOON" : "PAUSED"} TextColor3={C.Ivory} TextSize={layout.title.height >= 28 ? 13 : 10} TextXAlignment={Enum.TextXAlignment.Left} ZIndex={42} {...at({ ...layout.title, height: layout.title.height / 2 })} />
				<textlabel key="PauseNote" BackgroundTransparency={1} Font={Enum.Font.GothamBold} Text={remaining === undefined ? "CONFIRMING PAUSE…" : `AUTO-RESUME ${math.ceil(remaining)}s`} TextColor3={remaining !== undefined && remaining <= 10 ? C.Orange : C.Muted} TextSize={9} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={42} {...at({ ...layout.title, y: layout.title.y + layout.title.height / 2, height: layout.title.height / 2 })} />
				<OverlayButton name="PauseResumeButton" text={row ? "RESUME" : "RESUME  ›"} rectangle={layout.buttons[0]} primary={true} textSize={row ? 12 : 15} onActivated={onResume} />
				<OverlayButton name="PauseSettingsButton" text="SETTINGS" rectangle={layout.buttons[1]} textSize={row ? 11 : 13} onActivated={onSettings} />
				<OverlayButton name="PauseMenuButton" text="MAIN MENU" rectangle={layout.buttons[2]} textSize={row ? 11 : 13} onActivated={onMenu} />
			</frame>
		</frame>
	);
}

function SettingRow({ settingKey, settings, order, rowHeight, control, valueWidth, onChange }: {
	settingKey: SettingKey; settings: PlayerSettings; order: number; rowHeight: number; control: number; valueWidth: number;
	onChange: <K extends SettingKey>(key: K, value: PlayerSettings[K]) => void;
}) {
	const controlsWidth = control * 2 + valueWidth;
	const value = formatSetting(settingKey, settings);
	const stepper = (direction: 1 | -1) => {
		if (isToggleSetting(settingKey)) return;
		const key = settingKey as NumericSettingKey;
		onChange(key, stepSetting(key, settings[key], direction));
	};
	const square = (name: string, text: string, x: number, onActivated: () => void) => (
		<textbutton key={name} Active={true} AutoButtonColor={true} Selectable={true} BackgroundColor3={C.PanelHot} BackgroundTransparency={0.1} BorderSizePixel={0} Font={Enum.Font.GothamBlack} Position={UDim2.fromOffset(x, (rowHeight - control) / 2)} Size={UDim2.fromOffset(control, control)} Text={text} TextColor3={C.Ivory} TextSize={18} ZIndex={44} Event={{ Activated: onActivated }}>
			<uicorner CornerRadius={new UDim(0, 6)} />
		</textbutton>
	);
	return (
		<frame key={`Setting_${settingKey}`} BackgroundTransparency={1} LayoutOrder={order} Size={new UDim2(1, -6, 0, rowHeight)} ZIndex={43}>
			<textlabel key="Label" BackgroundTransparency={1} Font={Enum.Font.GothamBold} Size={new UDim2(1, -controlsWidth - 8, 1, 0)} Text={SETTING_LABELS[settingKey]} TextColor3={C.Ivory} TextSize={12} TextTruncate={Enum.TextTruncate.AtEnd} TextXAlignment={Enum.TextXAlignment.Left} ZIndex={44} />
			<frame key="Controls" AnchorPoint={new Vector2(1, 0)} BackgroundTransparency={1} Position={UDim2.fromScale(1, 0)} Size={new UDim2(0, controlsWidth, 1, 0)} ZIndex={43}>
				{isToggleSetting(settingKey) ? (
					<textbutton key={`Setting${settingKey}Toggle`} Active={true} AutoButtonColor={true} Selectable={true} BackgroundColor3={settings[settingKey] ? C.Accent : C.PanelHot} BackgroundTransparency={0.05} BorderSizePixel={0} Font={Enum.Font.GothamBold} Position={UDim2.fromOffset(0, (rowHeight - control) / 2)} Size={UDim2.fromOffset(controlsWidth, control)} Text={value} TextColor3={settings[settingKey] ? C.Ink : C.Ivory} TextSize={13} ZIndex={44} Event={{ Activated: () => onChange(settingKey, !settings[settingKey]) }}>
						<uicorner CornerRadius={new UDim(0, 6)} />
					</textbutton>
				) : (
					<>
						{square(`Setting${settingKey}Minus`, "−", 0, () => stepper(-1))}
						<textlabel key="Value" BackgroundTransparency={1} Font={Enum.Font.RobotoMono} Position={UDim2.fromOffset(control, 0)} Size={new UDim2(0, valueWidth, 1, 0)} Text={value} TextColor3={C.Accent} TextSize={12} ZIndex={44} />
						{square(`Setting${settingKey}Plus`, "+", control + valueWidth, () => stepper(1))}
					</>
				)}
			</frame>
		</frame>
	);
}

/** The settings sheet, from the title screen or the pause card. Every change applies at once. */
export function SettingsSheet({ viewport, settings, onChange, onClose }: {
	viewport: Vector2; settings: PlayerSettings;
	onChange: <K extends SettingKey>(key: K, value: PlayerSettings[K]) => void; onClose: () => void;
}) {
	const layout = getSettingsLayout(viewport.X, viewport.Y);
	return (
		<frame key="SettingsSheet" Active={true} BackgroundColor3={C.Ink} BackgroundTransparency={0.3} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} ZIndex={40}>
			<frame key="SettingsPanel" BackgroundColor3={C.Panel} BackgroundTransparency={0.05} BorderSizePixel={0} ZIndex={41} {...at(layout.panel)}>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uistroke Color={C.Accent} Transparency={0.6} />
				<textlabel key="SettingsTitle" BackgroundTransparency={1} Font={Enum.Font.GothamBlack} Text="SETTINGS" TextColor3={C.Ivory} TextSize={layout.header.height >= 30 ? 18 : 14} TextXAlignment={Enum.TextXAlignment.Left} ZIndex={42} {...at(layout.header)} />
				<textlabel key="SettingsNote" BackgroundTransparency={1} Font={Enum.Font.GothamBold} Text="SAVED FOR THIS SESSION" TextColor3={C.Faint} TextSize={9} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={42} {...at(layout.header)} />
				<scrollingframe key="SettingsList" Active={true} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={UDim2.fromOffset(0, SETTING_ORDER.size() * layout.rowHeight + 140)} ScrollBarThickness={3} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.6} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={false} ZIndex={42} {...at(layout.list)}>
					<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} />
					{SETTING_ORDER.map((key, index) => (
						<SettingRow key={`Setting_${key}`} settingKey={key} settings={settings} order={index} rowHeight={layout.rowHeight} control={layout.control} valueWidth={layout.valueWidth} onChange={onChange} />
					))}
					<textlabel key="VoiceDisclosure" BackgroundTransparency={1} LayoutOrder={SETTING_ORDER.size()} Size={new UDim2(1, -12, 0, 140)} Font={Enum.Font.Gotham} Text={VOICE_DISCLOSURE + "\n" + VOICE_DISCLOSURE_DETAIL} TextColor3={C.Ivory} TextSize={13} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} ZIndex={43} />
				</scrollingframe>
				<OverlayButton name="SettingsDoneButton" text="DONE" rectangle={layout.done} primary={true} onActivated={onClose} />
			</frame>
		</frame>
	);
}
