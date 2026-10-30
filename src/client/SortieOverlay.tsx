import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService } from "@rbxts/services";
import { rearmClock } from "../shared/SortieCutaways";
import { SpecialWeapons, type SpecialKind } from "../shared/SpecialWeapons";
import type { Telemetry } from "../shared/Types";
import type { InputMode } from "../shared/UILayout";
import type { FlightController } from "./FlightController";
import { HUD, HUD_FONT, HUD_FONT_BOLD } from "./Theme";

/** The reference's mm'ss"cc clock face, as the landing and takeoff boxes read. */
function hundredths(seconds: number): string {
	const total = math.max(0, math.floor(seconds * 100 + 1e-6));
	// Built from parts: roblox-ts emits a mixed-quote literal as a long string, which would keep the backslash.
	const second = string.char(34);
	return `${string.format("%02d", math.floor(total / 6000))}'${string.format("%02d", math.floor(total / 100) % 60)}${second}${string.format("%02d", total % 100)}`;
}
function Box({ name, text, position, size, color = HUD.Green, textSize, onActivated, selectable = true }: {
	name: string; text: string; position: UDim2; size: UDim2; color?: Color3; textSize: number; onActivated?: () => void; selectable?: boolean;
}) {
	const props = {
		BackgroundColor3: HUD.Shadow, BackgroundTransparency: 0.55, BorderSizePixel: 0, FontFace: HUD_FONT_BOLD, Text: text, TextColor3: color,
		TextSize: textSize, AnchorPoint: new Vector2(0.5, 0), Position: position, Size: size,
	};
	const stroke = <uistroke Color={color} Transparency={0.35} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />;
	return onActivated
		? <textbutton key={name} {...props} AutoButtonColor={true} Selectable={selectable} Event={{ Activated: onActivated }}>{stroke}</textbutton>
		: <textlabel key={name} {...props}>{stroke}</textlabel>;
}

/**
 * Engine batch C presentation over the mission HUD (m05 §9): the rearm's LANDING 3:00 / TAKEOFF 1:00 clock, its
 * TAKEOFF / CHANGE WEAPON menu and skip, and the letterboxed, HUD-less cut-in with its captions.
 */
export function SortieOverlay({ controller, telemetry, viewport, inputMode }: { controller: FlightController; telemetry: Telemetry; viewport: Vector2; inputMode: InputMode }) {
	const [choosing, setChoosing] = useState(false);
	const rootRef = useRef<Frame>();
	const textSize = viewport.Y < 420 ? 12 : 16;
	const row = textSize + 14;
	const cutIn = controller.CutInStatus();
	const rearm = controller.RearmStatus();
	const menuOpen = rearm?.menu === true;
	useEffect(() => { if (!menuOpen) setChoosing(false); }, [menuOpen]);
	// Gamepad B (FlightController's menu binding) steps back out of the weapon list.
	const back = rearm?.back ?? 0;
	useEffect(() => setChoosing(false), [back]);
	// A controller alone must reach every choice: focus TAKEOFF, or the loaded weapon once the list opens; release on close.
	const loaded = rearm?.special ?? telemetry.special;
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const selected = GuiService.SelectedObject;
		if (!menuOpen || inputMode !== "gamepad") {
			if (selected && selected.IsDescendantOf(root)) GuiService.SelectedObject = undefined;
			return;
		}
		const target = root.FindFirstChild(choosing ? `Weapon${loaded ?? SpecialWeapons.Default}` : "Takeoff", true);
		if (target && target.IsA("GuiObject")) GuiService.SelectedObject = target;
	}, [menuOpen, choosing, inputMode]);
	if (cutIn) {
		const bar = math.floor(viewport.Y * 0.12);
		return (
			<frame key="SortieOverlay" ref={rootRef} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
				{/* The UI root sits inside the safe-area inset: run each bar 400 px past its screen edge. */}
				<frame key="LetterboxTop" BackgroundColor3={new Color3(0, 0, 0)} BorderSizePixel={0} AnchorPoint={new Vector2(0, 1)} Position={new UDim2(0, 0, 0, bar)} Size={new UDim2(1, 0, 0, bar + 400)} />
				<frame key="LetterboxBottom" BackgroundColor3={new Color3(0, 0, 0)} BorderSizePixel={0} Position={new UDim2(0, 0, 1, -bar)} Size={new UDim2(1, 0, 0, bar + 400)} />
				{cutIn.caption !== undefined && (
					<textlabel key="CutInCaption" BackgroundTransparency={1} FontFace={HUD_FONT} Text={cutIn.caption} TextColor3={HUD.White} TextSize={textSize}
						TextWrapped={true} AnchorPoint={new Vector2(0.5, 1)} Position={new UDim2(0.5, 0, 1, -bar - 12)} Size={new UDim2(0.8, 0, 0, row * 2)} TextYAlignment={Enum.TextYAlignment.Bottom} />
				)}
				{cutIn.skippable && <Box name="CutInSkip" text="SKIP · SPACE / RT" position={new UDim2(1, -110, 1, -bar + 8)} size={UDim2.fromOffset(180, row)} color={HUD.Dim} textSize={textSize - 4} onActivated={() => controller.SkipLanding()} selectable={false} />}
			</frame>
		);
	}
	if (!rearm) return <frame key="SortieOverlay" ref={rootRef} BackgroundTransparency={1} Visible={false} />;
	const clock = rearmClock(rearm.plan, rearm.elapsed, rearm.menu);
	const current = (rearm.special ?? telemetry.special ?? SpecialWeapons.Default) as SpecialKind;
	const width = math.max(220, row * 8);
	return (
		<frame key="SortieOverlay" ref={rootRef} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			<Box name="RearmClock" text={`${clock.label} ${hundredths(clock.seconds)}`} position={UDim2.fromScale(0.5, 0.08)} size={UDim2.fromOffset(width, row)} textSize={textSize} />
			{rearm.menu ? (
				<frame key="RearmMenu" BackgroundTransparency={1} AnchorPoint={new Vector2(0.5, 0)} Position={UDim2.fromScale(0.5, 0.26)} Size={UDim2.fromOffset(width, row * 8)}
					SelectionGroup={true} SelectionBehaviorUp={Enum.SelectionBehavior.Stop} SelectionBehaviorDown={Enum.SelectionBehavior.Stop}
					SelectionBehaviorLeft={Enum.SelectionBehavior.Stop} SelectionBehaviorRight={Enum.SelectionBehavior.Stop}>
					<Box name="LandingSuccessful" text="LANDING SUCCESSFUL" position={UDim2.fromScale(0.5, 0)} size={UDim2.fromOffset(width, row)} color={HUD.White} textSize={textSize} />
					{!choosing ? [
						<Box key="Takeoff" name="Takeoff" text={`TAKEOFF · ${SpecialWeapons.Get(current).short}`} position={new UDim2(0.5, 0, 0, row * 1.5)} size={UDim2.fromOffset(width, row)} textSize={textSize} onActivated={() => controller.RearmTakeoff()} />,
						<Box key="ChangeWeapon" name="ChangeWeapon" text="CHANGE WEAPON" position={new UDim2(0.5, 0, 0, row * 2.7)} size={UDim2.fromOffset(width, row)} textSize={textSize} onActivated={() => setChoosing(true)} />,
					] : [...SpecialWeapons.All().map((definition, index) => (
						<Box key={definition.kind} name={`Weapon${definition.kind}`} text={`${definition.short} · ${string.upper(definition.name)}`}
							position={new UDim2(0.5, 0, 0, row * (1.5 + index * 1.2))} size={UDim2.fromOffset(width, row)} color={definition.kind === current ? HUD.White : HUD.Green}
							textSize={textSize - 2} onActivated={() => { setChoosing(false); controller.RearmTakeoff(definition.kind); }} />
						)), <Box key="WeaponBack" name="WeaponBack" text="BACK · B" position={new UDim2(0.5, 0, 0, row * 6.4)} size={UDim2.fromOffset(width, row)} color={HUD.Dim} textSize={textSize - 2} onActivated={() => setChoosing(false)} />]}
				</frame>
			) : undefined}
			{rearm.skippable && <Box name="RearmSkip" text={rearm.menu ? "TAKEOFF · SPACE / RT" : "SKIP · SPACE / RT"} position={UDim2.fromScale(0.5, 0.78)} size={UDim2.fromOffset(width, row)} color={HUD.Dim} textSize={textSize - 2} onActivated={() => controller.SkipLanding()} selectable={false} />}
		</frame>
	);
}
