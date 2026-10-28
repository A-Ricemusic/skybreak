import React, { useEffect, useMemo, useRef } from "@rbxts/react";
import { TweenService } from "@rbxts/services";
import { FlightMath } from "../../shared/FlightMath";
import { flightWarning, LOW_ALTITUDE } from "../../shared/FlightWarnings";
import { evadeGauge } from "../../shared/EvadeGauge";
import { GameConfig } from "../../shared/GameConfig";
import { SpecialKind, SpecialWeapons } from "../../shared/SpecialWeapons";
import { WeaponRules } from "../../shared/WeaponRules";
import { clockLines, instrumentValue, statusLine } from "../../shared/HudInstruments";
import type { Telemetry } from "../../shared/Types";
import {
	getEvadeHint,
	getSpecialHint,
	getFlightHints,
	getHudLayout,
	getKillMarkerLayout,
	getTutorialInstruction,
	getMovementIndicators,
	getMovementIndicatorLayout,
	JOYSTICK_SIZE,
	MAX_FLIGHT_HINTS,
	type HudOptions,
	type ControlHint,
	type InputMode,
	type Rectangle,
} from "../../shared/UILayout";
import type { FlightTrend } from "../FlightController";
import { FlightController } from "../FlightController";
import { EvadeButton, Radar } from "../HudControls";
import { HudLabel, InstrumentBox, Reticle, StatusPanel, WarningBox } from "../AceHud";
import { NavigationCue } from "../NavigationCue";
import { KillMarker, type KillFlash } from "../KillMarker";
import { C, HUD, HUD_FONT_BOLD } from "../Theme";
import { Corner, Label, Stroke } from "./Primitives";
import { glyphFor } from "./UIInput";
import { missileReady } from "./UIFormat";

/** Temporarily replaces the one-line objective (radio lines, kills). */
interface Callout {
	text: string;
	color?: Color3;
}

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

// A touch stick pad; the knob is moved directly through knobRef while dragging.
function TouchStick({ name, knobName, rectangle, frameRef, knobRef, knob, onBegan }: {
	name: string;
	knobName: string;
	rectangle?: Rectangle;
	frameRef: React.RefObject<Frame>;
	knobRef: React.RefObject<Frame>;
	knob: number;
	onBegan: (input: InputObject) => void;
}) {
	return (
		<frame
			ref={frameRef}
			key={name}
			Active={true}
			BackgroundColor3={HUD.Shadow}
			BackgroundTransparency={0.75}
			BorderSizePixel={0}
			Position={rectangle ? UDim2.fromOffset(rectangle.x, rectangle.y) : undefined}
			Size={rectangle ? UDim2.fromOffset(rectangle.width, rectangle.height) : UDim2.fromOffset(96, 96)}
			Visible={rectangle !== undefined}
			Event={{ InputBegan: (_rbx, input) => onBegan(input) }}
		>
			<Corner scale={0.5} />
			<Stroke color={HUD.Green} transparency={0.6} thickness={1} />
			<frame
				ref={knobRef}
				key={knobName}
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
	);
}

function MissionHud({
	visible,
	viewport,
	inputMode,
	telemetry,
	callout,
	introduction,
	damageFlash,
	killFlash,
	scale,
	options,
	trend,
	fireNotice,
	radio,
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
	// Target boxes (FlightController) keep clear of the touch controls this layout draws and inside this safe-area root.
	const hudFrameRef = useRef<Frame>();
	useEffect(() => {
		controller.SetTargetKeepouts(visible ? layout : undefined, scale, hudFrameRef.current, viewport);
		return () => controller.SetTargetKeepouts(undefined, 1, undefined);
	}, [controller, layout, scale, visible, viewport]);
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
	const evadeHint = evade.flash ? getEvadeHint(inputMode) : undefined;
	const flightHints = getFlightHints(inputMode, { introduction, locked, missileReady: ready });
	// Second weapon slot: label, button state and a hint when it is both ready and relevant now
	// (flares with a missile inbound, missiles with a lock, the drone during the opening legend).
	const specialKind: SpecialKind = SpecialWeapons.IsKind(telemetry.special) ? telemetry.special : SpecialWeapons.Default;
	const specialDefinition = SpecialWeapons.Get(specialKind);
	const specialButton = SpecialWeapons.Button(specialKind, telemetry.specialCharges ?? 0, telemetry.specialCooldown ?? 0, telemetry.specialActive ?? 0);
	const specialReady = (telemetry.specialCharges ?? 0) > 0 && (telemetry.specialCooldown ?? 0) <= 0 && (telemetry.specialActive ?? 0) <= 0;
	const specialRelevant = specialKind === "flares" ? telemetry.incoming : specialKind === "uav" ? telemetry.target !== undefined && !locked : locked;
	const specialHint = specialReady && specialRelevant ? getSpecialHint(inputMode, specialDefinition.short) : undefined;
	// EVADE leads only while a missile is decoyable; never more than two hints at once.
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
	const movement = telemetry.tutorialStep === "move" && objectiveLine === tutorial
		? getMovementIndicators(inputMode, telemetry.turnObserved, telemetry.pitchObserved) : undefined;
	const movementTextSize = metrics.scale === "large" ? 16 : metrics.scale === "compact" ? 10 : 11;
	const movementCells = getMovementIndicatorLayout(layout.callout, movementTextSize);
	const stalling = telemetry.speed < FlightMath.WarningSpeed;
	const knob = math.floor((touch?.joystick.width ?? JOYSTICK_SIZE) * 0.375 + 0.5);
	return (
		<frame ref={hudFrameRef} key="MissionHUD" BackgroundTransparency={1} Size={UDim2.fromScale(1 / scale, 1 / scale)} Visible={visible}>
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
			{layout.radar && <Radar rectangle={layout.radar} controller={controller} visible={visible} textSize={metrics.label} minText={metrics.minText} />}

			<HudLabel name="MissionTimer" text={timeLine} rectangle={{ ...layout.clock, height: metrics.row }} textSize={metrics.text} color={timeRemaining <= 60 ? HUD.Red : HUD.Green} />
			<HudLabel name="ObjectiveProgress" text={progressLine} rectangle={{ ...layout.clock, y: layout.clock.y + metrics.row + 2, height: metrics.row }} textSize={metrics.text} />
			{movement ? movement.map((cell, index) => (
				<HudLabel key={`Movement${index}`} name={`Movement${index}`} text={cell.text}
					rectangle={movementCells[index]}
					color={cell.done ? HUD.Green : HUD.Amber} bold={!cell.done} textSize={movementTextSize}
					verticalAlignment={Enum.TextYAlignment.Top} />
			)) : <HudLabel name="ObjectiveText" text={objectiveLine} rectangle={layout.callout} color={objectiveColor} textSize={metrics.scale === "large" ? 16 : metrics.scale === "compact" ? 10 : 11} wrap={true} verticalAlignment={Enum.TextYAlignment.Top} />}

			{layout.reticle && <Reticle rectangle={layout.reticle} />}
			<InstrumentBox name="SpeedBox" caption="MPH" value={instrumentValue(FlightMath.ToMph(telemetry.speed))} rectangle={layout.speed} metrics={metrics} pointsRight={true} color={stalling ? HUD.Amber : HUD.Green} />
			<InstrumentBox name="AltitudeBox" caption="ALT" value={instrumentValue(telemetry.altitude)} rectangle={layout.altitude} metrics={metrics} pointsRight={false} color={telemetry.altitude < LOW_ALTITUDE ? HUD.Amber : HUD.Green} />
			{!alertSharesObjective && <WarningBox rectangle={layout.alert} text={alertText} color={alertColor} metrics={metrics} textRef={warningText} />}
			{/* Reserved for a missile time-to-impact / BREAK cue; empty and hidden until something drives it. */}

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

			<TouchStick name="TouchJoystick" knobName="JoystickKnob" rectangle={touch?.joystick} frameRef={joystickRef} knobRef={knobRef} knob={knob} onBegan={onJoystickBegan} />
			<TouchStick name="ThrottleJoystick" knobName="ThrottleKnob" rectangle={touch?.throttle} frameRef={throttleJoystickRef} knobRef={throttleKnobRef} knob={knob} onBegan={onThrottleBegan} />
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


export { MissionHud };
export type { Callout };
