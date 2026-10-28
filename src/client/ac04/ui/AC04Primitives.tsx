import React, { useEffect, useRef } from "@rbxts/react";
import type { AC04InputMode, AC04Rect } from "../../../shared/ac04/ui/AC04MenuLayout";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04_NUMBER_FONT, AC04Color } from "./AC04Theme";

export const at = (rect: AC04Rect) => ({ Position: UDim2.fromOffset(rect.x, rect.y), Size: UDim2.fromOffset(rect.width, rect.height) });

/** Thin instrument frame: transparent fill, 1 px rule. */
export function AC04Frame({ rect, color = AC04Color.Ink, fill, fillTransparency = 1, transparency = 0.25, zIndex = 1, children }: React.PropsWithChildren<{ rect: AC04Rect; color?: Color3; fill?: Color3; fillTransparency?: number; transparency?: number; zIndex?: number }>) {
	return (
		<frame BackgroundColor3={fill ?? AC04Color.Base} BackgroundTransparency={fill ? fillTransparency : 1} BorderSizePixel={0} ZIndex={zIndex} {...at(rect)}>
			<uistroke Color={color} Transparency={transparency} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			{children}
		</frame>
	);
}

/** "LABEL >" tag in command lettering. */
export function AC04Tag({ text, size, color = AC04Color.Ink, position, width = 200, order }: { text: string; size: number; color?: Color3; position?: UDim2; width?: number; order?: number }) {
	return <textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={`${text} >`} TextColor3={color} TextSize={size} TextXAlignment={Enum.TextXAlignment.Left} Position={position} Size={UDim2.fromOffset(width, size + 4)} LayoutOrder={order} />;
}

/** Tag above a value: the briefing/debrief metadata block. */
export function AC04Field({ label, value, labelSize, valueSize, width, order, valueColor = AC04Color.White, numeric = false, wrap = false }: { label: string; value: string; labelSize: number; valueSize: number; width: number; order?: number; valueColor?: Color3; numeric?: boolean; wrap?: boolean }) {
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(0, width, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y} LayoutOrder={order}>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 2)} />
			<AC04Tag text={label} size={labelSize} width={width} order={1} />
			<textlabel BackgroundTransparency={1} FontFace={numeric ? AC04_NUMBER_FONT : AC04_BODY_FONT} Text={value} TextColor3={valueColor} TextSize={valueSize} TextWrapped={wrap} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(1, -8, 0, valueSize + 4)} Position={UDim2.fromOffset(8, 0)} AutomaticSize={wrap ? Enum.AutomaticSize.Y : Enum.AutomaticSize.None} LayoutOrder={2} />
		</frame>
	);
}

/** Horizontal rule. */
export function AC04Rule({ x, y, width, color = AC04Color.Ink, transparency = 0.45 }: { x: number; y: number; width: number; color?: Color3; transparency?: number }) {
	return <frame BackgroundColor3={color} BackgroundTransparency={transparency} BorderSizePixel={0} Position={UDim2.fromOffset(x, y)} Size={UDim2.fromOffset(width, 1)} />;
}

export interface AC04Command {
	id: string;
	label: string;
	enabled: boolean;
	/** Contextual help line shown while focused. */
	help?: string;
	/** Right-aligned secondary text (status, count). */
	detail?: string;
}

/**
 * Compact command row: left-aligned technical lettering with a short luminance bar on the focused row.
 * The hit area is the full row (44 px on touch) while the visible typography stays compact.
 */
export function AC04CommandRow({ command, focused, y, width, height, textSize, onFocus, onActivate }: { command: AC04Command; focused: boolean; y: number; width: number; height: number; textSize: number; onFocus: () => void; onActivate: () => void }) {
	const color = !command.enabled ? AC04Color.Disabled : focused ? AC04Color.Focus : AC04Color.Ink;
	return (
		<textbutton
			key={command.id}
			AutoButtonColor={false}
			Selectable={false}
			Active={command.enabled}
			BackgroundColor3={AC04Color.Ink}
			BackgroundTransparency={focused ? 0.86 : 1}
			BorderSizePixel={0}
			Text=""
			Position={UDim2.fromOffset(0, y)}
			Size={UDim2.fromOffset(width, height)}
			Event={{ MouseEnter: onFocus, Activated: () => { onFocus(); if (command.enabled) onActivate(); } }}
		>
			<frame BackgroundColor3={AC04Color.Focus} BorderSizePixel={0} Visible={focused} AnchorPoint={new Vector2(0, 0.5)} Position={UDim2.fromScale(0, 0.5)} Size={UDim2.fromOffset(4, math.min(height - 8, textSize + 6))} />
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={command.label} TextColor3={color} TextSize={textSize} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} Position={UDim2.fromOffset(16, 0)} Size={new UDim2(1, command.detail !== undefined ? -150 : -20, 1, 0)} />
			{command.detail !== undefined && <textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={command.detail} TextColor3={command.enabled ? AC04Color.Muted : AC04Color.Disabled} TextSize={math.max(12, textSize - 2)} TextXAlignment={Enum.TextXAlignment.Right} AnchorPoint={new Vector2(1, 0)} Position={new UDim2(1, -8, 0, 0)} Size={new UDim2(0, 140, 1, 0)} />}
		</textbutton>
	);
}

/** Native scrolling keeps every row reachable by touch drag and mouse wheel; focus reveals keyboard/gamepad rows. */
export function AC04CommandList({ rect, commands, focus, top = 0, rowPitch, textSize, onFocus, onActivate }: { rect: AC04Rect; commands: AC04Command[]; focus: number; top?: number; rowPitch: number; textSize: number; onFocus: (index: number) => void; onActivate: (index: number) => void }) {
	const ref = useRef<ScrollingFrame>();
	useEffect(() => {
		if (ref.current) ref.current.CanvasPosition = new Vector2(0, top * rowPitch);
	}, []);
	useEffect(() => {
		const panel = ref.current;
		if (!panel || focus < 0) return;
		const y = panel.CanvasPosition.Y, first = focus * rowPitch, last = first + rowPitch;
		if (first < y) panel.CanvasPosition = new Vector2(0, first);
		else if (last > y + rect.height) panel.CanvasPosition = new Vector2(0, last - rect.height);
	}, [focus, rowPitch, rect.height]);
	return (
		<scrollingframe ref={ref} Active={true} BackgroundTransparency={1} BorderSizePixel={0} ClipsDescendants={true}
			ScrollingDirection={Enum.ScrollingDirection.Y} ScrollBarThickness={6} ScrollBarImageColor3={AC04Color.Muted}
			CanvasSize={UDim2.fromOffset(0, commands.size() * rowPitch)} {...at(rect)}>
			{commands.map((command, index) => <AC04CommandRow key={command.id} command={command} focused={focus === index}
				y={index * rowPitch} width={rect.width - 10} height={rowPitch} textSize={textSize}
				onFocus={() => onFocus(index)} onActivate={() => onActivate(index)} />)}
		</scrollingframe>
	);
}

/** Footer buttons (Back, Confirm...) as compact framed commands; always visible, never scrolled. */
export function AC04CommandBar({ rect, commands, focus, textSize, onFocus, onActivate }: { rect: AC04Rect; commands: AC04Command[]; focus?: number; textSize: number; onFocus?: (index: number) => void; onActivate: (index: number) => void }) {
	const gap = 8, count = math.max(1, commands.size());
	const each = math.min(260, math.floor((rect.width - gap * (count - 1)) / count));
	return (
		<frame BackgroundTransparency={1} {...at(rect)}>
			{commands.map((command, index) => {
				const focused = focus === index;
				const color = !command.enabled ? AC04Color.Disabled : focused ? AC04Color.Base : AC04Color.Ink;
				return (
					<textbutton
						key={command.id}
						AutoButtonColor={false}
						Selectable={false}
						Active={command.enabled}
						BackgroundColor3={AC04Color.Focus}
						BackgroundTransparency={focused && command.enabled ? 0.05 : 1}
						BorderSizePixel={0}
						FontFace={AC04_COMMAND_FONT}
						Text={command.label}
						TextColor3={color}
						TextSize={textSize}
						AnchorPoint={new Vector2(1, 0)}
						Position={new UDim2(1, -(count - 1 - index) * (each + gap), 0, 0)}
						Size={UDim2.fromOffset(each, rect.height)}
						Event={{ MouseEnter: () => onFocus?.(index), Activated: () => { if (command.enabled) onActivate(index); } }}
					>
						<uistroke Color={command.enabled ? AC04Color.Ink : AC04Color.Disabled} Transparency={0.3} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
					</textbutton>
				);
			})}
		</frame>
	);
}

const HINTS: { [K in AC04InputMode]: string } = {
	keyboard: "↑ ↓  SELECT     ENTER  CONFIRM     BACKSPACE  BACK",
	gamepad: "D-PAD  SELECT     A  CONFIRM     B  BACK",
	touch: "",
};
const SIDE_HINTS: { [K in AC04InputMode]: string } = {
	keyboard: "← →  CHANGE",
	gamepad: "◀ ▶  CHANGE",
	touch: "",
};

/** Input-aware navigation legend across the top edge (hidden on touch, which uses on-screen buttons). */
export function AC04NavHints({ rect, input, sideways = false, textSize = 12 }: { rect: AC04Rect; input: AC04InputMode; sideways?: boolean; textSize?: number }) {
	if (input === "touch" || rect.height <= 0) return undefined;
	return (
		<frame BackgroundTransparency={1} {...at(rect)}>
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={sideways ? `${SIDE_HINTS[input]}     ${HINTS[input]}` : HINTS[input]} TextColor3={AC04Color.Muted} TextSize={textSize} TextXAlignment={Enum.TextXAlignment.Right} Size={UDim2.fromScale(1, 1)} />
			<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.7} BorderSizePixel={0} Position={new UDim2(0, 0, 1, -1)} Size={new UDim2(1, 0, 0, 1)} />
		</frame>
	);
}

/** Caption lane: a vertical rule on the left, readable body text, scrolls when longer than the lane. */
export function AC04CaptionLane({ rect, text, textSize, color = AC04Color.White }: { rect: AC04Rect; text: string; textSize: number; color?: Color3 }) {
	return (
		<frame BackgroundTransparency={1} {...at(rect)}>
			<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.3} BorderSizePixel={0} Size={new UDim2(0, 1, 1, 0)} />
			<scrollingframe BackgroundTransparency={1} BorderSizePixel={0} Position={UDim2.fromOffset(14, 0)} Size={new UDim2(1, -14, 1, 0)} CanvasSize={new UDim2()} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={4} ScrollBarImageColor3={AC04Color.Ink} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={false}>
				<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text={text} TextColor3={color} TextSize={textSize} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} Size={new UDim2(1, -10, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y} />
			</scrollingframe>
		</frame>
	);
}

/** Single-line contextual help / status text. */
export function AC04Line({ rect, text, textSize, color = AC04Color.Muted, alignRight = false, font = AC04_BODY_FONT }: { rect: AC04Rect; text: string; textSize: number; color?: Color3; alignRight?: boolean; font?: Font }) {
	return <textlabel BackgroundTransparency={1} FontFace={font} Text={text} TextColor3={color} TextSize={textSize} TextWrapped={true} TextTruncate={Enum.TextTruncate.AtEnd} TextXAlignment={alignRight ? Enum.TextXAlignment.Right : Enum.TextXAlignment.Left} {...at(rect)} />;
}

/** Subdued procedural grid behind command screens. Original geometry; no imported artwork. */
export function AC04GridBackdrop({ width, height, spacing = 64 }: { width: number; height: number; spacing?: number }) {
	const lines: React.Element[] = [];
	for (let x = spacing; x < width; x += spacing) lines.push(<frame key={`v${x}`} BackgroundColor3={AC04Color.Grid} BackgroundTransparency={0.55} BorderSizePixel={0} Position={UDim2.fromOffset(x, 0)} Size={new UDim2(0, 1, 1, 0)} />);
	for (let y = spacing; y < height; y += spacing) lines.push(<frame key={`h${y}`} BackgroundColor3={AC04Color.Grid} BackgroundTransparency={0.55} BorderSizePixel={0} Position={UDim2.fromOffset(0, y)} Size={new UDim2(1, 0, 0, 1)} />);
	return (
		<frame BackgroundColor3={AC04Color.Base} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} ZIndex={0}>
			<uigradient Rotation={90} Color={new ColorSequence(AC04Color.Map, AC04Color.Base)} />
			{lines}
		</frame>
	);
}

/** Screen heading: large command lettering with a short rule. */
export function AC04Heading({ rect, text, sub, size, subSize, stackSub = false }: { rect: AC04Rect; text: string; sub?: string; size: number; subSize: number; stackSub?: boolean }) {
	return (
		<frame BackgroundTransparency={1} {...at(rect)}>
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={text} TextColor3={AC04Color.White} TextSize={size} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} Size={new UDim2(1, 0, 0, size + 4)} />
			{sub !== undefined && <textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={sub} TextColor3={AC04Color.Muted} TextSize={subSize} TextXAlignment={stackSub ? Enum.TextXAlignment.Left : Enum.TextXAlignment.Right} TextTruncate={Enum.TextTruncate.AtEnd} AnchorPoint={new Vector2(stackSub ? 0 : 1, 0)} Position={stackSub ? UDim2.fromOffset(0, size + 6) : new UDim2(1, 0, 0, math.floor((size - subSize) / 2))} Size={new UDim2(stackSub ? 1 : 0.5, 0, 0, subSize + 4)} />}
			<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.35} BorderSizePixel={0} Position={UDim2.fromOffset(0, size + 8 + (stackSub ? subSize + 8 : 0))} Size={new UDim2(1, 0, 0, 1)} />
		</frame>
	);
}
