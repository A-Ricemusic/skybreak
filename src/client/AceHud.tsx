import React, { useEffect, useMemo, useRef } from "@rbxts/react";
import { TweenService } from "@rbxts/services";
import { hullFraction, hullTone, type HudTone, type StatusCell } from "../shared/HudInstruments";
import type { HudMetrics, Rectangle, StatusPanelLayout } from "../shared/UILayout";
import { HUD, HUD_FONT, HUD_FONT_BOLD } from "./Theme";

// Ace-style flight HUD pieces: thin green line work and tabular type with a dark
// outline. Every piece is built once per size; updates only change text/colour.

export const TONE_COLOR: { [tone in HudTone]: Color3 } = { normal: HUD.Green, dim: HUD.Dim, warn: HUD.Amber, danger: HUD.Red };
const LINE = 1.5;
const OUTLINE = 0.55;

const at = (rectangle: Rectangle) => ({ Position: UDim2.fromOffset(rectangle.x, rectangle.y), Size: UDim2.fromOffset(rectangle.width, rectangle.height) });
const relative = (rectangle: Rectangle, origin: Rectangle): Rectangle => ({ ...rectangle, x: rectangle.x - origin.x, y: rectangle.y - origin.y });

/** One straight stroke of line art: centre, length and rotation (degrees), in pixels of its parent. */
interface LineSegment {
	x: number;
	y: number;
	length: number;
	rotation: number;
}

function between(x1: number, y1: number, x2: number, y2: number): LineSegment {
	return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, length: math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2), rotation: math.deg(math.atan2(y2 - y1, x2 - x1)) };
}

/** One stroke of line art: a thin frame with a soft dark outline for bright sky. */
function Line({ name, segment, color, thickness = LINE, transparency = 0 }: { name: string; segment: LineSegment; color: Color3; thickness?: number; transparency?: number }) {
	return (
		<frame
			key={name}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundColor3={color}
			BackgroundTransparency={transparency}
			BorderSizePixel={0}
			Position={UDim2.fromOffset(segment.x, segment.y)}
			Rotation={segment.rotation}
			Size={UDim2.fromOffset(segment.length + thickness / 2, thickness)}
		>
			<uistroke Color={HUD.Shadow} Transparency={OUTLINE} Thickness={1} />
		</frame>
	);
}

/** Green HUD type: monospaced digits, dark outline, no background. */
export function HudLabel({
	name,
	text,
	rectangle,
	color = HUD.Green,
	textSize,
	bold = false,
	alignment = Enum.TextXAlignment.Left,
	verticalAlignment = Enum.TextYAlignment.Center,
	visible = true,
	wrap = false,
	textRef,
	transparency = 0,
}: {
	name: string;
	text: string;
	rectangle: Rectangle;
	color?: Color3;
	textSize: number;
	bold?: boolean;
	alignment?: Enum.TextXAlignment;
	verticalAlignment?: Enum.TextYAlignment;
	visible?: boolean;
	wrap?: boolean;
	textRef?: React.RefObject<TextLabel>;
	transparency?: number;
}) {
	return (
		<textlabel
			ref={textRef}
			key={name}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			FontFace={bold ? HUD_FONT_BOLD : HUD_FONT}
			Text={text}
			TextColor3={color}
			TextSize={textSize}
			TextStrokeColor3={HUD.Shadow}
			TextStrokeTransparency={0.45}
			TextTransparency={transparency}
			TextTruncate={Enum.TextTruncate.AtEnd}
			TextWrapped={wrap}
			TextXAlignment={alignment}
			TextYAlignment={verticalAlignment}
			Visible={visible}
			{...at(rectangle)}
		/>
	);
}

/** Small flight-path reticle: a ring with left/right wings and a top stem. */
function ReticleImpl({ rectangle }: { rectangle: Rectangle }) {
	const size = rectangle.width;
	const centre = size / 2;
	const ring = math.floor(size * 0.36);
	return (
		<frame key="Reticle" BackgroundTransparency={1} {...at(rectangle)}>
			<frame key="Ring" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Position={UDim2.fromOffset(centre, centre)} Size={UDim2.fromOffset(ring, ring)}>
				<uicorner CornerRadius={new UDim(0.5, 0)} />
				<uistroke Color={HUD.Green} Thickness={LINE} />
			</frame>
			<Line name="WingLeft" segment={between(0, centre, centre - ring / 2, centre)} color={HUD.Green} />
			<Line name="WingRight" segment={between(centre + ring / 2, centre, size, centre)} color={HUD.Green} />
			<Line name="Stem" segment={between(centre, centre - ring / 2, centre, centre - ring / 2 - size * 0.22)} color={HUD.Green} />
		</frame>
	);
}
export const Reticle = React.memo(ReticleImpl);

/**
 * SPEED / ALT: caption row, then an arrow-tag box whose point faces the reticle
 * (SPEED points right, ALT points left). Short compact rects drop the caption
 * row and prefix the value with its initial instead.
 */
export function InstrumentBox({ name, caption, value, rectangle, metrics, pointsRight, color = HUD.Green }: {
	name: string; caption: string; value: string; rectangle: Rectangle; metrics: HudMetrics; pointsRight: boolean; color?: Color3;
}) {
	const captioned = rectangle.height >= metrics.caption + metrics.box;
	const top = captioned ? metrics.caption : 0;
	const box = rectangle.height - top;
	const tip = math.floor(box / 2);
	const width = rectangle.width;
	const edges = useMemo(() => {
		const body = width - tip;
		// Outer side, top, bottom, then the two tag diagonals (all relative to the box row).
		const outer = pointsRight ? 0 : width;
		const inner = pointsRight ? body : tip;
		const point = pointsRight ? width : 0;
		const half = LINE / 2;
		return [
			between(outer, half, outer, box - half),
			between(outer, half, inner, half),
			between(outer, box - half, inner, box - half),
			between(inner, half, point, box / 2),
			between(inner, box - half, point, box / 2),
		];
	}, [width, box, tip, pointsRight]);
	const valueRect = { x: pointsRight ? 2 : tip + 2, y: 0, width: width - tip - 4, height: box };
	return (
		<frame key={name} BackgroundTransparency={1} {...at(rectangle)}>
			{captioned && <HudLabel name="Caption" text={caption} rectangle={{ x: pointsRight ? 0 : tip, y: 0, width: width - tip, height: top }} textSize={metrics.instrumentLabel} color={color} />}
			<frame key="Box" BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.8} BorderSizePixel={0} Position={UDim2.fromOffset(pointsRight ? 0 : tip, top)} Size={UDim2.fromOffset(width - tip, box)} />
			<frame key="Edges" BackgroundTransparency={1} Position={UDim2.fromOffset(0, top)} Size={UDim2.fromOffset(width, box)}>
				{edges.map((segment, index) => <Line key={`Edge${index}`} name={`Edge${index}`} segment={segment} color={color} />)}
			</frame>
			<HudLabel
				name="Value"
				text={captioned ? value : caption === "MPH" ? `${value} MPH` : `${caption.sub(1, 1)} ${value}`}
				rectangle={{ ...valueRect, y: top }}
				textSize={!captioned && caption === "MPH" ? math.min(metrics.instrumentText, valueRect.width / 5.6) : metrics.instrumentText}
				bold={true}
				color={color}
				alignment={Enum.TextXAlignment.Center}
			/>
		</frame>
	);
}

/** Boxed warning text under the reticle; the parent pulses `textRef`. */
export function WarningBox({ rectangle, text, color, metrics, textRef }: { rectangle: Rectangle; text: string; color: Color3; metrics: HudMetrics; textRef?: React.RefObject<TextLabel> }) {
	return (
		<frame key="Warning" BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.75} BorderSizePixel={0} Visible={text !== ""} {...at(rectangle)}>
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={color} Thickness={LINE} />
			<textlabel
				ref={textRef}
				key="WarningText"
				BackgroundTransparency={1}
				FontFace={HUD_FONT_BOLD}
				Size={UDim2.fromScale(1, 1)}
				Text={text}
				TextColor3={color}
				TextScaled={true}
				TextStrokeColor3={HUD.Shadow}
				TextStrokeTransparency={0.4}
			>
				<uitextsizeconstraint MaxTextSize={metrics.text + 2} MinTextSize={metrics.minText} />
				<uipadding PaddingLeft={new UDim(0, 4)} PaddingRight={new UDim(0, 4)} />
			</textlabel>
		</frame>
	);
}

/** Centred mission banner (MISSION UPDATE, MISSION ACCOMPLISHED) in the warning box's frame, font and stroke; `blink` pulses its text. */
export function HudBanner({ name, text, color, stroke, metrics, blink = false, y = 0.2 }: { name: string; text: string; color: Color3; stroke?: Color3; metrics: HudMetrics; blink?: boolean; y?: number }) {
	const label = useRef<TextLabel>();
	useEffect(() => {
		const current = label.current;
		if (!blink || !current) return;
		current.TextTransparency = 0;
		const pulse = TweenService.Create(current, new TweenInfo(0.35, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1, true), { TextTransparency: 0.85 });
		pulse.Play();
		return () => { pulse.Cancel(); current.TextTransparency = 0; };
	}, [blink]);
	const height = metrics.row * 2;
	return (
		<frame key={name} BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.6} BorderSizePixel={0} AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, y, 0)} Size={UDim2.fromOffset(math.max(200, height * 7), height)}>
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={stroke ?? color} Thickness={LINE} />
			<textlabel ref={label} key="BannerText" BackgroundTransparency={1} FontFace={HUD_FONT_BOLD} Size={UDim2.fromScale(1, 1)} Text={text}
				TextColor3={color} TextScaled={true} TextStrokeColor3={HUD.Shadow} TextStrokeTransparency={0.4}>
				<uitextsizeconstraint MaxTextSize={metrics.text + 8} MinTextSize={metrics.minText} />
				<uipadding PaddingLeft={new UDim(0, 6)} PaddingRight={new UDim(0, 6)} />
			</textlabel>
		</frame>
	);
}

/** Ammo line as RichText: each cell in its own tone, joined by dim separators. */
export function statusText(cells: StatusCell[], separator: string): string {
	const tint = (text: string, tone: HudTone) => `<font color="#${TONE_COLOR[tone].ToHex()}">${text}</font>`;
	return cells.map((cell) => tint(cell.text, cell.tone)).join(tint(separator, "dim"));
}

/** Hull bar (green, amber, then red with damage) with the one-line ammo readout under it. */
export function StatusPanel({ layout, health, cells }: { layout: StatusPanelLayout; health: number; cells: StatusCell[] }) {
	const frame = layout.frame;
	const bar = relative(layout.bar, frame);
	const color = TONE_COLOR[hullTone(math.floor(health + 0.5))];
	return (
		<frame key="StatusPanel" BackgroundTransparency={1} {...at(frame)}>
			<frame key="HullBar" BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.6} BorderSizePixel={0} {...at(bar)}>
				<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={color} Thickness={1} Transparency={0.25} />
				<frame key="Fill" BackgroundColor3={color} BackgroundTransparency={0.1} BorderSizePixel={0} Size={UDim2.fromScale(hullFraction(health), 1)} />
			</frame>
			<textlabel
				key="AmmoLine"
				BackgroundTransparency={1}
				FontFace={HUD_FONT}
				RichText={true}
				Text={statusText(cells, layout.separator)}
				TextColor3={HUD.Green}
				TextSize={layout.text}
				TextStrokeColor3={HUD.Shadow}
				TextStrokeTransparency={0.45}
				TextXAlignment={Enum.TextXAlignment.Left}
				{...at(relative(layout.line, frame))}
			/>
		</frame>
	);
}
