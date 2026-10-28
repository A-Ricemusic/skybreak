import React, { useEffect, useRef, useState } from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { FlightMath } from "../../../shared/FlightMath";
import type { AC04Mission } from "../../../shared/AC04MissionData";
import { radarHeadingDegrees } from "../../../shared/RadarMath";
import { SpecialWeapons } from "../../../shared/SpecialWeapons";
import type { Telemetry } from "../../../shared/Types";
import { type AC04HudLayout, type AC04TouchAction, AC04_TOUCH_ACTIONS } from "../../../shared/ac04/ui/AC04HudLayout";
import type { AC04InputMode, AC04Rect } from "../../../shared/ac04/ui/AC04MenuLayout";
import { ac04Clock, ac04Distance, ac04Minutes, ac04Pad, ac04SplitRadio } from "../../../shared/ac04/ui/AC04UIFormat";
import type { FlightController } from "../../FlightController";
import { at } from "./AC04Primitives";
import { AC04Radar } from "./AC04Radar";
import { AC04_COMMAND_FONT, AC04_NUMBER_FONT, AC04Color } from "./AC04Theme";

/** Seconds an objective update stays under the radio before collapsing to the counters. */
const NOTICE_SECONDS = 6;
/** The server accepts a manual rearm request within this distance north of the line. */
const REARM_MARGIN = 120;

export interface AC04FlightHudProps {
	layout: AC04HudLayout;
	input: AC04InputMode;
	telemetry: Telemetry;
	score: number;
	gun: number;
	radioText: string;
	mission: AC04Mission;
	controller: FlightController;
	returnZ?: number;
	rearmSeconds?: number;
	highContrast: boolean;
	onPause: () => void;
	onGunDown: (input: InputObject) => void;
	onGunUp: () => void;
}
/** Small local contrast plate behind one instrument block; stronger with the high-contrast option. */
function Plate({ rect, strong, children }: React.PropsWithChildren<{ rect: AC04Rect; strong: boolean }>) {
	return (
		<frame BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={strong ? 0.3 : 0.8} BorderSizePixel={0} {...at(rect)}>
			{children}
		</frame>
	);
}
/** Boxed tag ("PTS", "TIME") followed by a tabular value. */
function TagValue({ tag, value, y, height, labelSize, valueSize, color = AC04Color.Flight, alignRight = false }: { tag: string; value: string; y: number; height: number; labelSize: number; valueSize: number; color?: Color3; alignRight?: boolean }) {
	const tagWidth = math.max(34, tag.size() * (labelSize - 1) + 10);
	return (
		<frame BackgroundTransparency={1} Position={UDim2.fromOffset(0, y)} Size={new UDim2(1, 0, 0, height)}>
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={tag} TextColor3={color} TextSize={labelSize} Position={UDim2.fromOffset(alignRight ? 0 : 4, 0)} Size={UDim2.fromOffset(tagWidth, height)}>
				<uistroke Color={color} Transparency={0.25} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			</textlabel>
			<textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={value} TextColor3={color} TextSize={valueSize} TextStrokeColor3={AC04Color.Shadow} TextStrokeTransparency={0.5} TextXAlignment={alignRight ? Enum.TextXAlignment.Right : Enum.TextXAlignment.Left} Position={UDim2.fromOffset(tagWidth + 10, 0)} Size={new UDim2(1, -(tagWidth + 14), 1, 0)} TextTruncate={Enum.TextTruncate.AtEnd} />
		</frame>
	);
}
// End of the AC04 flight HUD component.
/** Two-line instrument keeps the entire numeric row available on narrow and short viewports. */
function FlightInstrument({ tag, value, labelSize, valueSize }: { tag: string; value: string; labelSize: number; valueSize: number }) {
	return <>
		<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={tag} TextColor3={AC04Color.Flight}
			TextSize={labelSize} Position={UDim2.fromOffset(4, 2)} Size={new UDim2(1, -8, 0, labelSize + 3)} />
		<textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={value} TextColor3={AC04Color.Flight}
			TextSize={valueSize} TextStrokeColor3={AC04Color.Shadow} TextStrokeTransparency={0.5}
			Position={UDim2.fromOffset(4, labelSize + 5)} Size={new UDim2(1, -8, 1, -(labelSize + 7))} />
	</>;
}

/** Touch stick: tracks one touch inside its square; releases to centre. */
function Stick({ rect, label, onMove }: { rect: AC04Rect; label: string; onMove: (x: number, y: number) => void }) {
	const ref = useRef<Frame>(), held = useRef<InputObject>();
	const moveRef = useRef(onMove);
	moveRef.current = onMove;
	useEffect(() => {
		const move = (input: InputObject) => {
			if (held.current !== input || !ref.current) return;
			const panel = ref.current, centre = panel.AbsolutePosition.add(panel.AbsoluteSize.div(2));
			const delta = new Vector2(input.Position.X - centre.X, input.Position.Y - centre.Y).div(math.max(1, rect.width / 2));
			moveRef.current(math.clamp(delta.X, -1, 1), math.clamp(-delta.Y, -1, 1));
		};
		const changed = UserInputService.InputChanged.Connect(move);
		const ended = UserInputService.InputEnded.Connect((input) => { if (held.current === input) { held.current = undefined; moveRef.current(0, 0); } });
		return () => { changed.Disconnect(); ended.Disconnect(); moveRef.current(0, 0); };
	}, [rect.width]);
	return (
		<frame ref={ref} Active={true} BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={0.55} BorderSizePixel={0} {...at(rect)}
			Event={{ InputBegan: (_, input) => { if (input.UserInputType === Enum.UserInputType.Touch) held.current = input; } }}>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<uistroke Color={AC04Color.Flight} Transparency={0.35} Thickness={1} />
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={label} TextColor3={AC04Color.FlightDim} TextSize={11} Size={UDim2.fromScale(1, 1)} />
		</frame>
	);
}
// End of AC04FlightHud.
const ACTION_LABEL: { [K in AC04TouchAction]: string } = { target: "TGT", missile: "MSL", evade: "EVADE", gun: "GUN", special: "SP.W", rearm: "REARM" };

/**
 * AC04 flight HUD: sparse, dispersed instruments around a clear centre. Every value is read from the
 * existing telemetry/controller; actions call the same FlightController methods as before.
 */
export function AC04FlightHud(props: AC04FlightHudProps) {
	const { layout, telemetry, controller } = props;
	const text = layout.text, strong = props.highContrast;
	const [notice, setNotice] = useState<string>();
	const noticeSerial = useRef(0);
	useEffect(() => {
		const objective = telemetry.objective;
		if (objective === undefined || objective === "") return;
		const serial = ++noticeSerial.current;
		setNotice(objective);
		const thread = task.delay(NOTICE_SECONDS, () => { if (noticeSerial.current === serial) setNotice(undefined); });
		return () => { if (coroutine.status(thread) === "suspended") task.cancel(thread); };
	}, [telemetry.objective]);

	const phase = props.mission.phases.find((p) => `ac04_${p.id}` === telemetry.phase);
	const kind = phase?.kind;
	const progress = telemetry.objectiveProgress ?? 0, total = telemetry.objectiveTotal ?? 0;
	const scoreValue = kind === "score" && phase?.threshold !== undefined ? `${ac04Pad(props.score, 4)}/${ac04Pad(phase.threshold, 4)}` : ac04Pad(props.score, 4);
	const phaseLine = kind === "return" || kind === "escort" || kind === "escape" ? ac04Minutes(progress) : kind === "score" ? undefined : `${ac04Pad(progress, 2)}/${ac04Pad(total, 2)}`;
	const targetName = telemetry.target !== undefined && telemetry.targetName !== "" ? string.upper(telemetry.targetName) : undefined;
	const targetState = telemetry.targetDamageable === false ? "TRACK" : telemetry.lockProgress >= 0.99 ? "LOCK" : undefined;
	const targetLine = targetName !== undefined ? `${targetName}${telemetry.targetDistance !== undefined ? `  ${ac04Distance(telemetry.targetDistance)}` : ""}${targetState ? `  ${targetState}` : ""}` : "";

	const radio = props.radioText !== "" ? ac04SplitRadio(props.radioText) : undefined;
	const yaw = controller.GetHeading();
	const position = controller.GetPosition();
	const returnZ = props.returnZ;
	let guidance: string | undefined;
	if (kind === "return" && telemetry.navigation && position) guidance = `RETURN LINE  S 180°  ${ac04Distance(math.max(0, telemetry.navigation.Z - position.Z))} FT`;
	else if (props.rearmSeconds !== undefined && props.rearmSeconds > 0) guidance = `SERVICING  ${math.ceil(props.rearmSeconds)} S`;
	const southOfLine = returnZ !== undefined && position !== undefined && position.Z >= returnZ - REARM_MARGIN && kind !== "escape";

	let alert: string | undefined, alertColor = AC04Color.Warning;
	if (telemetry.incoming) { alert = "MISSILE"; alertColor = AC04Color.Danger; }
	else if (telemetry.lockWarning) alert = "LOCK WARNING";
	else if (telemetry.boundaryWarning) alert = "RETURN TO OPERATION AREA";

	const special = telemetry.special !== undefined && SpecialWeapons.IsKind(telemetry.special) ? SpecialWeapons.Get(telemetry.special).short : "SP.W";
	const evadeCharges = telemetry.evadeCharges ?? (telemetry.evadeCooldown <= 0 ? 1 : 0);
	const damage = math.clamp(math.floor(100 - telemetry.health + 0.5), 0, 100);
	const storesRow = (tag: string, value: string, index: number, color: Color3 = AC04Color.Flight) => (
		<TagValue key={tag} tag={tag} value={value} y={index * (text.label + 8)} height={text.label + 6} labelSize={text.label} valueSize={text.label + 2} color={color} />
	);
	const act = (action: AC04TouchAction) => {
		if (action === "target") controller.CycleTarget();
		else if (action === "missile") controller.FireMissile();
		else if (action === "evade") controller.Evade();
		else if (action === "gun") controller.FireGun();
		else if (action === "special") controller.Special();
		else if (action === "rearm") controller.Rearm();
	};
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			<Plate rect={layout.score} strong={strong}>
				<TagValue tag="PTS" value={scoreValue} y={2} height={text.value + 2} labelSize={text.label} valueSize={text.value} />
				{phaseLine !== undefined && <TagValue tag={kind === "targets" || kind === "missiles" ? "TGT" : "PHASE"} value={phaseLine} y={text.value + 6} height={text.value + 2} labelSize={text.label} valueSize={text.value - 2} />}
				<textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={targetLine} TextColor3={targetState === "TRACK" ? AC04Color.Friendly : AC04Color.Hostile} TextSize={text.label} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} Position={UDim2.fromOffset(6, text.value * 2 + 8)} Size={new UDim2(1, -8, 0, text.label + 2)} />
			</Plate>
			<Plate rect={layout.time} strong={strong}>
				<TagValue tag="TIME" value={ac04Clock(telemetry.timeRemaining ?? 0)} y={(layout.time.height - text.value - 2) / 2} height={text.value + 2} labelSize={text.label} valueSize={text.value} />
			</Plate>
			{yaw !== undefined && <textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={`${ac04Pad(radarHeadingDegrees(yaw), 3)}`} TextColor3={AC04Color.Flight} TextStrokeColor3={AC04Color.Shadow} TextStrokeTransparency={0.4} TextSize={text.small + 1} {...at(layout.heading)} />}
			{radio && (
				<Plate rect={layout.radio} strong={strong}>
					{radio.speaker !== undefined && (
						<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={radio.speaker} TextColor3={AC04Color.White} TextSize={text.small} AnchorPoint={new Vector2(0.5, 0)} Position={new UDim2(0.5, 0, 0, 2)} Size={UDim2.fromOffset(180, text.small + 2)}>
							<frame BackgroundColor3={AC04Color.White} BackgroundTransparency={0.3} BorderSizePixel={0} AnchorPoint={new Vector2(0.5, 0)} Position={new UDim2(0.5, 0, 1, 1)} Size={UDim2.fromOffset(math.min(170, radio.speaker.size() * text.small), 1)} />
						</textlabel>
					)}
					<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={`« ${radio.line} »`} TextColor3={AC04Color.White} TextStrokeColor3={AC04Color.Shadow} TextStrokeTransparency={0.35} TextSize={text.radio - 1} TextWrapped={true} TextYAlignment={Enum.TextYAlignment.Top} Position={UDim2.fromOffset(6, text.small + 8)} Size={new UDim2(1, -12, 1, -(text.small + 8))} />
				</Plate>
			)}
			{(notice !== undefined || guidance !== undefined) && (
				<textlabel BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={strong ? 0.3 : 0.75} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} RichText={false} TextWrapped={true}
					Text={notice !== undefined && guidance !== undefined ? `${notice}\n${guidance}` : notice ?? guidance ?? ""} TextColor3={guidance !== undefined ? AC04Color.Warning : AC04Color.Flight} TextSize={text.small} {...at(layout.notice)} />
			)}
			<Plate rect={layout.speed} strong={strong}>
				<FlightInstrument tag="SPEED" value={`${math.floor(FlightMath.ToMph(telemetry.speed))}`} labelSize={text.label} valueSize={text.value} />
			</Plate>
			<Plate rect={layout.altitude} strong={strong}>
				<FlightInstrument tag="ALT" value={`${math.floor(telemetry.altitude * 5)}`} labelSize={text.label} valueSize={text.value} />
			</Plate>
			{alert !== undefined && (
				<textlabel BackgroundColor3={alertColor} BackgroundTransparency={0.15} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} Text={alert} TextColor3={AC04Color.Shadow} TextSize={text.small + 1} {...at(layout.alert)} />
			)}
			<AC04Radar rect={layout.radar} controller={controller} returnZ={returnZ} />
			<Plate rect={layout.stores} strong={strong}>
				{storesRow("GUN", ac04Pad(props.gun, 4), 0)}
				{storesRow("MSL", `*${ac04Pad(telemetry.missiles, 3)}`, 1)}
				{storesRow(special, `**${ac04Pad(telemetry.specialCharges ?? 0, 2)}`, 2)}
				{storesRow("DMG", `${ac04Pad(damage, 3)}%`, 3, damage >= 70 ? AC04Color.Danger : damage >= 40 ? AC04Color.Warning : AC04Color.Flight)}
				{storesRow("EVD", string.rep("■", evadeCharges) + string.rep("□", math.max(0, (telemetry.evadeCharges !== undefined ? 3 : 1) - evadeCharges)), 4)}
			</Plate>
			{props.input !== "touch" && southOfLine && (
				<textbutton AutoButtonColor={false} Selectable={false} BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={0.3} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} Text="REARM" TextColor3={AC04Color.Friendly} TextSize={text.small} {...at(layout.rearm)} Event={{ Activated: () => controller.Rearm() }}>
					<uistroke Color={AC04Color.Friendly} Transparency={0.3} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
				</textbutton>
			)}
			<textbutton AutoButtonColor={false} Selectable={false} BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={0.45} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} Text={props.input === "keyboard" ? "PAUSE  P" : "PAUSE"} TextColor3={AC04Color.Flight} TextSize={text.small - 1} {...at(layout.pause)} Event={{ Activated: props.onPause }}>
				<uistroke Color={AC04Color.Flight} Transparency={0.4} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			</textbutton>
			{layout.leftStick && <Stick rect={layout.leftStick} label={"PITCH\n◀ TURN ▶"} onMove={(x, y) => controller.SetInput(x, y)} />}
			{layout.rightStick && <Stick rect={layout.rightStick} label={"SPEED\n＋\n−"} onMove={(_, y) => controller.SetTouchThrottleAxis(y)} />}
			{layout.actions && AC04_TOUCH_ACTIONS.map((action) => {
				const rect = layout.actions![action];
				const primary = action === "missile";
				const muted = action === "rearm" && !southOfLine;
				return (
					<textbutton key={action} AutoButtonColor={true} Selectable={false} BackgroundColor3={primary ? AC04Color.Flight : AC04Color.Shadow} BackgroundTransparency={primary ? 0.15 : 0.4} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} Text={ACTION_LABEL[action]} TextColor3={primary ? AC04Color.Shadow : muted ? AC04Color.FlightDim : AC04Color.Flight} TextSize={11} {...at(rect)}
						Event={{
							Activated: () => act(action),
							InputBegan: (_, input) => {
								const press = input.UserInputType === Enum.UserInputType.Touch || input.UserInputType === Enum.UserInputType.MouseButton1;
								if (!press || input.UserInputState !== Enum.UserInputState.Begin) return;
								if (action === "gun") props.onGunDown(input);
							},
							InputEnded: () => { if (action === "gun") props.onGunUp(); },
						}}>
						<uistroke Color={AC04Color.Flight} Transparency={0.35} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					</textbutton>
				);
			})}
		</frame>
	);
}
