import React, { useEffect, useRef } from "@rbxts/react";
import { TweenService } from "@rbxts/services";
import type { KillKind } from "../shared/ImpactFeedback";
import { ImpactFeedback } from "../shared/ImpactFeedback";
import type { Rectangle } from "../shared/UILayout";
import { MotionPreference } from "./MotionPreference";
import { C } from "./Theme";

/** One confirmed kill to call out; `serial` restarts the animation for back-to-back kills. */
export interface KillFlash {
	serial: number;
	kind: KillKind;
	text: string;
	/** Where the destroyed target was, in HUD-root pixels, when it was on screen. */
	bracket?: Vector2;
}

const KIND_COLOR: Record<KillKind, Color3> = { air: C.AccentHot, ground: C.Accent, ace: C.Orange };
const POP = 0.16;
const FADE = 0.3;
const BRACKET_SIZE = 60;

/**
 * "SPLASH ONE" / "TARGET DESTROYED" / "ACE DOWN": pops in at the top centre, holds,
 * fades. The destroyed target's bracket flashes once and expands away. Text only,
 * outside the forward view; nothing stays on screen after ImpactFeedback.CalloutSeconds.
 */
export function KillMarker({ flash, rectangle, visible }: { flash?: KillFlash; rectangle: Rectangle; visible: boolean }) {
	const labelRef = useRef<TextLabel>();
	const scaleRef = useRef<UIScale>();
	const bracketRef = useRef<Frame>();
	const strokeRef = useRef<UIStroke>();
	const serial = flash?.serial ?? 0;
	useEffect(() => {
		const label = labelRef.current, scale = scaleRef.current, bracket = bracketRef.current, stroke = strokeRef.current;
		if (serial === 0 || !label || !scale) return;
		const tweens: Tween[] = [];
		const play = (instance: Instance, seconds: number, goal: object, style: Enum.EasingStyle = Enum.EasingStyle.Quad) => {
			const tween = TweenService.Create(instance, new TweenInfo(seconds, style, Enum.EasingDirection.Out), goal as never);
			tweens.push(tween);
			tween.Play();
		};
		label.TextTransparency = 0;
		label.TextStrokeTransparency = 0.25;
		scale.Scale = MotionPreference.reduced ? 1 : 1.55;
		play(scale, POP, { Scale: 1 }, Enum.EasingStyle.Back);
		if (bracket && stroke) {
			bracket.Size = UDim2.fromOffset(BRACKET_SIZE, BRACKET_SIZE);
			stroke.Transparency = 0;
			play(bracket, 0.35, { Size: UDim2.fromOffset(BRACKET_SIZE * 1.7, BRACKET_SIZE * 1.7) });
			play(stroke, 0.35, { Transparency: 1 });
		}
		const fade = task.delay(ImpactFeedback.CalloutSeconds - FADE, () => {
			play(label, FADE, { TextTransparency: 1, TextStrokeTransparency: 1 });
		});
		return () => {
			task.cancel(fade);
			for (const tween of tweens) tween.Cancel();
			label.TextTransparency = 1;
			label.TextStrokeTransparency = 1;
			if (stroke) stroke.Transparency = 1;
		};
	}, [serial]);
	const color = flash ? KIND_COLOR[flash.kind] : C.Ivory;
	return (
		<frame key="KillMarker" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<textlabel
				ref={labelRef}
				key="KillCallout"
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				// Centre-anchored so the pop scales about the middle of the slot.
				Position={UDim2.fromOffset(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2)}
				Size={UDim2.fromOffset(rectangle.width, rectangle.height)}
				Font={Enum.Font.GothamBlack}
				Text={flash?.text ?? ""}
				TextColor3={color}
				TextSize={18}
				TextScaled={true}
				TextStrokeColor3={C.Ink}
				TextStrokeTransparency={1}
				TextTransparency={1}
				TextXAlignment={Enum.TextXAlignment.Center}
				TextYAlignment={Enum.TextYAlignment.Center}
			>
				<uitextsizeconstraint MaxTextSize={18} MinTextSize={9} />
				<uiscale ref={scaleRef} Scale={1} />
			</textlabel>
			<frame
				ref={bracketRef}
				key="KillBracketFlash"
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Position={UDim2.fromOffset(flash?.bracket?.X ?? 0, flash?.bracket?.Y ?? 0)}
				Size={UDim2.fromOffset(BRACKET_SIZE, BRACKET_SIZE)}
				Visible={flash?.bracket !== undefined}
			>
				<uicorner CornerRadius={new UDim(0, 7)} />
				<uistroke ref={strokeRef} Color={color} Thickness={2} Transparency={1} />
			</frame>
		</frame>
	);
}
