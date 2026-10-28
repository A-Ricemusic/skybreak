import React from "@rbxts/react";
import { C } from "../Theme";
import { SELECTION_NONE, useHighlight } from "../Highlight";
import { glyphFor } from "./UIInput";
import { MIN_TOUCH_TARGET, type ControlHint, type Rectangle } from "../../shared/UILayout";

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

function HintRowImpl({
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

const HintRow = React.memo(HintRowImpl);

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


function SectionHeading({ name, text, layoutOrder }: { name: string; text: string; layoutOrder: number }) {
	return <Label name={name} text={text} color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 12)} layoutOrder={layoutOrder} />;
}

export { ActionButton, Corner, FooterButtons, HintRow, Label, ScreenHeader, SectionHeading, Stroke };
