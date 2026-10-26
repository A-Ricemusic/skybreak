/**
 * Letterboxed cinematic composition. The 3D scene fills the whole safe root;
 * a thin top bar carries the chapter eyebrow and controls, and a bottom
 * lower-third band holds the speaker chip, the line and a beat progress line.
 * The band is sized to the chapter's longest measured line (capped at
 * `maxLines`), so there is never a large empty panel.
 */
export interface CinematicLayout {
	tiny: boolean;
	phone: boolean;
	portrait: boolean;
	/** Top letterbox bar; also the touch height of each control. */
	barHeight: number;
	controlSize: number;
	margin: number;
	eyebrowSize: number;
	chipHeight: number;
	chipTextSize: number;
	bodySize: number;
	lineHeight: number;
	/** Band padding: above the chip, between chip and text, below the text (includes progress line). */
	padTop: number;
	chipGap: number;
	padBottom: number;
	progressHeight: number;
	textWidth: number;
	maxLines: number;
	maxTextHeight: number;
	/** Worst-case bottom band and the scene lane that remains between the bars. */
	maxBandHeight: number;
	sceneHeight: number;
	skipWidth: number;
}

const MIN_SCENE = 44;

/** The safe root can be shorter than the requested simulator resolution. */
export function getCinematicLayout(width: number, height: number, large = false): CinematicLayout {
	const tiny = height < 240;
	const phone = !tiny && math.min(width, height) < 500;
	const portrait = height > width;
	const desktop = !tiny && !phone;
	const barHeight = desktop ? 56 : 44;
	const margin = tiny ? 8 : desktop ? 32 : 16;
	const bodySize = tiny ? (large ? 17 : 15) : phone ? (large ? 19 : 16) : large ? 24 : 20;
	const lineHeight = math.ceil(bodySize * 1.25);
	const chipHeight = tiny ? 16 : desktop ? 26 : 22;
	const padTop = tiny ? 4 : desktop ? 14 : 8;
	const chipGap = tiny ? 2 : desktop ? 8 : 4;
	const padBottom = tiny ? 7 : desktop ? 16 : 10;
	const fixed = padTop + chipHeight + chipGap + padBottom;
	const lineCap = portrait ? 4 : 3;
	const room = height - barHeight - MIN_SCENE - fixed - 4;
	const maxLines = math.clamp(math.floor(room / lineHeight), 1, lineCap);
	const maxTextHeight = maxLines * lineHeight + 4;
	const maxBandHeight = fixed + maxTextHeight;
	return {
		tiny, phone, portrait, barHeight, controlSize: 44, margin,
		eyebrowSize: tiny ? 10 : desktop ? 13 : 11,
		chipHeight, chipTextSize: tiny ? 11 : desktop ? 14 : 12,
		bodySize, lineHeight, padTop, chipGap, padBottom,
		progressHeight: tiny ? 2 : 3,
		textWidth: math.min(width - margin * 2, desktop ? 760 : 600),
		maxLines, maxTextHeight, maxBandHeight,
		sceneHeight: height - barHeight - maxBandHeight,
		skipWidth: tiny ? 72 : 88,
	};
}

/** Bottom band height for a measured line (or the chapter's tallest line). */
export function cinematicBandHeight(layout: CinematicLayout, textHeight: number): number {
	return layout.padTop + layout.chipHeight + layout.chipGap + math.min(math.max(textHeight, layout.lineHeight + 4), layout.maxTextHeight) + layout.padBottom;
}
