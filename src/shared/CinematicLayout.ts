/**
 * Letterboxed cinematic composition. The 3D scene fills the whole safe root
 * above one bottom lower-third band; there is no top bar. The band holds a
 * row with the speaker chip on the left and the Aa / pause / skip pills on
 * the right, then the line, then a footer with the chapter title and beat
 * dots over a thin beat progress line. The band is sized to the chapter's
 * longest measured line (capped at `maxLines`), so there is never a large
 * empty panel.
 */
export interface CinematicLayout {
	tiny: boolean;
	phone: boolean;
	portrait: boolean;
	/** Touch height of each control; the hit box may overhang the band's top edge. */
	controlSize: number;
	margin: number;
	/** Speaker / controls row: the visible pill height and the speaker chip height. */
	chipHeight: number;
	chipTextSize: number;
	bodySize: number;
	lineHeight: number;
	/** Footer row (chapter title, hint, beat dots) and its text size. */
	footerHeight: number;
	footerTextSize: number;
	/** Band padding: above the row, between row/text/footer, below the footer (holds the progress line). */
	padTop: number;
	chipGap: number;
	padBottom: number;
	progressHeight: number;
	textWidth: number;
	maxLines: number;
	maxTextHeight: number;
	/** Worst-case bottom band and the scene lane that remains above it. */
	maxBandHeight: number;
	sceneHeight: number;
	skipWidth: number;
}

const MIN_SCENE = 44;
/** Everything in the band except the line itself. */
const fixedHeight = (l: Pick<CinematicLayout, "padTop" | "chipHeight" | "chipGap" | "footerHeight" | "padBottom">) =>
	l.padTop + l.chipHeight + l.chipGap * 2 + l.footerHeight + l.padBottom;

/** The safe root can be shorter than the requested simulator resolution. */
export function getCinematicLayout(width: number, height: number, large = false): CinematicLayout {
	const tiny = height < 240;
	const phone = !tiny && math.min(width, height) < 500;
	const portrait = height > width;
	const desktop = !tiny && !phone;
	const controlSize = 44;
	const margin = tiny ? 8 : desktop ? 32 : 16;
	const bodySize = tiny ? (large ? 17 : 15) : phone ? (large ? 19 : 16) : large ? 24 : 20;
	const lineHeight = math.ceil(bodySize * 1.25);
	const chipHeight = tiny ? 26 : desktop ? 34 : 28;
	const footerHeight = tiny ? 11 : desktop ? 16 : 12;
	const padTop = tiny ? 2 : desktop ? 10 : 4;
	const chipGap = tiny ? 2 : desktop ? 6 : 3;
	const padBottom = tiny ? 5 : desktop ? 12 : 7;
	const fixed = fixedHeight({ padTop, chipHeight, chipGap, footerHeight, padBottom });
	// The 44 px hit boxes centre on the row and may overhang the band's top edge; keep that off the scene lane.
	const overhang = math.max(0, (controlSize - chipHeight) / 2 - padTop);
	const lineCap = portrait ? 4 : 3;
	const room = height - overhang - MIN_SCENE - fixed - 4;
	const maxLines = math.clamp(math.floor(room / lineHeight), 1, lineCap);
	const maxTextHeight = maxLines * lineHeight + 4;
	const maxBandHeight = fixed + maxTextHeight;
	return {
		tiny, phone, portrait, controlSize, margin,
		chipHeight, chipTextSize: tiny ? 11 : desktop ? 14 : 12,
		bodySize, lineHeight,
		footerHeight, footerTextSize: tiny ? 10 : desktop ? 12 : 11,
		padTop, chipGap, padBottom,
		progressHeight: tiny ? 2 : 3,
		textWidth: math.min(width - margin * 2, desktop ? 760 : 600),
		maxLines, maxTextHeight, maxBandHeight,
		sceneHeight: height - maxBandHeight,
		skipWidth: tiny ? 72 : 88,
	};
}

/** Bottom band height for a measured line (or the chapter's tallest line). */
export function cinematicBandHeight(layout: CinematicLayout, textHeight: number): number {
	return fixedHeight(layout) + math.min(math.max(textHeight, layout.lineHeight + 4), layout.maxTextHeight);
}
