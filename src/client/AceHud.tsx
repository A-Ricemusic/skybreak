import React, { useMemo } from "@rbxts/react";
import { kestrelOutline, outlineSegments, type HudTone, type LineSegment, type WeaponRow } from "../shared/HudInstruments";
import type { HudMetrics, Rectangle, WeaponPanelLayout } from "../shared/UILayout";
import { HUD, HUD_FONT, HUD_FONT_BOLD } from "./Theme";

// Ace-style flight HUD pieces: thin green line work and tabular type with a dark
// outline. Every piece is built once per size; updates only change text/colour.

export const TONE_COLOR: { [tone in HudTone]: Color3 } = { normal: HUD.Green, dim: HUD.Dim, warn: HUD.Amber, danger: HUD.Red };
const LINE = 1.5;
const OUTLINE = 0.55;

const at = (rectangle: Rectangle) => ({ Position: UDim2.fromOffset(rectangle.x, rectangle.y), Size: UDim2.fromOffset(rectangle.width, rectangle.height) });
const relative = (rectangle: Rectangle, origin: Rectangle): Rectangle => ({ ...rectangle, x: rectangle.x - origin.x, y: rectangle.y - origin.y });

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
			{captioned && <HudLabel name="Caption" text={caption} rectangle={{ x: pointsRight ? 0 : tip, y: 0, width: width - tip, height: top }} textSize={metrics.label} color={color} />}
			<frame key="Box" BackgroundColor3={HUD.Shadow} BackgroundTransparency={0.8} BorderSizePixel={0} Position={UDim2.fromOffset(pointsRight ? 0 : tip, top)} Size={UDim2.fromOffset(width - tip, box)} />
			<frame key="Edges" BackgroundTransparency={1} Position={UDim2.fromOffset(0, top)} Size={UDim2.fromOffset(width, box)}>
				{edges.map((segment, index) => <Line key={`Edge${index}`} name={`Edge${index}`} segment={segment} color={color} />)}
			</frame>
			<HudLabel
				name="Value"
				text={captioned ? value : `${caption.sub(1, 1)} ${value}`}
				rectangle={{ ...valueRect, y: top }}
				textSize={metrics.text}
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
				<uitextsizeconstraint MaxTextSize={metrics.text + 2} MinTextSize={8} />
				<uipadding PaddingLeft={new UDim(0, 4)} PaddingRight={new UDim(0, 4)} />
			</textlabel>
		</frame>
	);
}

/** The Kestrel's top-view outline in line art, tinted by hull damage. */
function SilhouetteImpl({ rectangle, color }: { rectangle: Rectangle; color: Color3 }) {
	const segments = useMemo(() => outlineSegments(kestrelOutline(), rectangle.width, rectangle.height), [rectangle.width, rectangle.height]);
	return (
		<frame key="Silhouette" BackgroundTransparency={1} {...at(rectangle)}>
			{segments.map((segment, index) => <Line key={`Outline${index}`} name={`Outline${index}`} segment={segment} color={color} />)}
			<Line name="Spine" segment={between(rectangle.width / 2, rectangle.height * 0.12, rectangle.width / 2, rectangle.height * 0.4)} color={color} transparency={0.5} thickness={1} />
		</frame>
	);
}
const Silhouette = React.memo(SilhouetteImpl);

/** A missile on a rail beside the silhouette: solid when ready, outline when not. */
function RailIcon({ name, rectangle, ready }: { name: string; rectangle: Rectangle; ready: boolean }) {
	const nose = math.floor(rectangle.width * 1.4);
	return (
		<frame key={name} BackgroundTransparency={1} {...at(rectangle)}>
			<frame key="Body" BackgroundColor3={HUD.Green} BackgroundTransparency={ready ? 0.05 : 1} BorderSizePixel={0} Position={UDim2.fromOffset(0, nose / 2)} Size={new UDim2(1, 0, 1, -nose / 2)}>
				<uistroke Color={ready ? HUD.Shadow : HUD.Dim} Transparency={ready ? OUTLINE : 0} Thickness={1} />
			</frame>
			<frame key="Nose" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={HUD.Green} BackgroundTransparency={ready ? 0.05 : 1} BorderSizePixel={0} Position={new UDim2(0.5, 0, 0, nose / 2)} Rotation={45} Size={UDim2.fromOffset(rectangle.width * 0.72, rectangle.width * 0.72)}>
				<uistroke Color={ready ? HUD.Shadow : HUD.Dim} Transparency={ready ? OUTLINE : 0} Thickness={1} />
			</frame>
		</frame>
	);
}

/** Bottom-right weapon list (caret on the FIRE weapon), damage, silhouette and ready rails. */
export function WeaponPanel({ layout, rows, metrics, hullColor, rails }: { layout: WeaponPanelLayout; rows: WeaponRow[]; metrics: HudMetrics; hullColor: Color3; rails: [boolean, boolean] }) {
	const frame = layout.frame;
	const caretWidth = math.floor(metrics.text * 0.8);
	return (
		<frame key="WeaponPanel" BackgroundTransparency={1} {...at(frame)}>
			{rows.map((row, index) => {
				const slot = layout.rows[index];
				if (!slot) return undefined;
				const slotRect = relative(slot, frame);
				const color = TONE_COLOR[row.tone];
				return (
					<frame key={`Row_${row.key}`} BackgroundTransparency={1} {...at(slotRect)}>
						<HudLabel name="Caret" text=">" rectangle={{ x: 0, y: 0, width: caretWidth, height: slotRect.height }} textSize={metrics.text} bold={true} visible={row.caret} />
						<HudLabel name="Label" text={row.label} rectangle={{ x: caretWidth, y: 0, width: slotRect.width - caretWidth, height: slotRect.height }} textSize={metrics.text} color={color} />
						<HudLabel name="Value" text={row.value} rectangle={{ x: caretWidth, y: 0, width: slotRect.width - caretWidth, height: slotRect.height }} textSize={metrics.text} color={color} bold={true} alignment={Enum.TextXAlignment.Right} />
					</frame>
				);
			})}
			{layout.silhouette && <Silhouette rectangle={relative(layout.silhouette, frame)} color={hullColor} />}
			{layout.rails?.map((rail, index) => <RailIcon key={`Rail${index + 1}`} name={`Rail${index + 1}`} rectangle={relative(rail, frame)} ready={rails[index]} />)}
		</frame>
	);
}
