/**
 * Cinematic composition without a top letterbox. The 3D scene fills the safe
 * root; one lower-third caption panel at the bottom carries everything:
 *   row 1  speaker label on the left, Aa / pause / skip on the right
 *   row 2  the subtitle line
 *   row 3  a segmented progress bar (one segment per beat, the current one fills)
 * The panel sits on a soft gradient, not a slab, and is sized to the chapter's
 * longest measured line (capped at `maxLines`). Every rectangle is in safe-root
 * coordinates: the ScreenGui uses CoreUISafeInsets, so (0, 0) is already below
 * the Roblox top bar and clear of the notch.
 */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CinematicLayout {
	tiny: boolean;
	phone: boolean;
	portrait: boolean;
	/** Touch height of every control, and the height of the speaker/controls row. */
	controlSize: number;
	/** Visible pill inside each 44 px hit box. */
	pillHeight: number;
	margin: number;
	chipTextSize: number;
	bodySize: number;
	lineHeight: number;
	/** Panel padding: above the row, row to text, text to progress, progress height, below the progress. */
	padTop: number;
	textGap: number;
	progressGap: number;
	progressHeight: number;
	padBottom: number;
	/** Gradient fade above the panel so it reads as part of the shot. */
	featherHeight: number;
	textWidth: number;
	maxLines: number;
	maxTextHeight: number;
	/** Worst-case caption panel and the scene lane that remains above it. */
	maxBandHeight: number;
	sceneHeight: number;
	skipWidth: number;
	controlGap: number;
	controlsWidth: number;
	/** Desktop only: the "click for next" hint left of the controls; on phones it crowded the speaker. */
	showHint: boolean;
	hintWidth: number;
}

export interface CinematicFrame {
	/** Caption panel (full width) and the gradient behind it (panel plus feather). */
	band: Rect;
	backdrop: Rect;
	scene: Rect;
	speaker: Rect;
	hint?: Rect;
	settingsButton: Rect;
	pauseButton: Rect;
	skipButton: Rect;
	text: Rect;
	progress: Rect;
	/** Aa popover above the controls; `horizontal` lays its two toggles side by side when the scene lane is short. */
	settingsPanel: Rect;
	horizontalSettings: boolean;
	pausedChip: Rect;
}

/** Scene kept above the worst-case panel: room for the side-by-side settings popover and its gap. */
const MIN_SCENE = 60;
const SETTINGS_GAP = 6;

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
	const padTop = tiny ? 0 : desktop ? 10 : 2;
	const textGap = tiny ? 0 : desktop ? 4 : 2;
	const progressGap = tiny ? 4 : desktop ? 10 : 6;
	const progressHeight = tiny ? 2 : 3;
	const padBottom = tiny ? 4 : desktop ? 18 : 8;
	const fixed = padTop + controlSize + textGap + progressGap + progressHeight + padBottom;
	const lineCap = portrait ? 4 : 3;
	const room = height - MIN_SCENE - fixed - 4;
	const maxLines = math.clamp(math.floor(room / lineHeight), 1, lineCap);
	const maxTextHeight = maxLines * lineHeight + 4;
	const maxBandHeight = fixed + maxTextHeight;
	const skipWidth = tiny ? 72 : 88;
	const controlGap = tiny ? 0 : 4;
	return {
		tiny, phone, portrait, controlSize, pillHeight: tiny ? 28 : 30, margin,
		chipTextSize: tiny ? 11 : desktop ? 14 : 12,
		bodySize, lineHeight, padTop, textGap, progressGap, progressHeight, padBottom,
		featherHeight: tiny ? 12 : desktop ? 56 : 28,
		textWidth: math.min(width - margin * 2, desktop ? 760 : 600),
		maxLines, maxTextHeight, maxBandHeight,
		sceneHeight: height - maxBandHeight,
		skipWidth, controlGap, controlsWidth: skipWidth + controlSize * 2 + controlGap * 2,
		showHint: desktop, hintWidth: 124,
	};
}

/** Text slot for a measured line (or the chapter's tallest line), clamped between one line and the cap. */
export function cinematicTextSlot(layout: CinematicLayout, textHeight: number): number {
	return math.min(math.max(textHeight, layout.lineHeight + 4), layout.maxTextHeight);
}

/** Caption panel height for a measured line (or the chapter's tallest line). */
export function cinematicBandHeight(layout: CinematicLayout, textHeight: number): number {
	const l = layout;
	return l.padTop + l.controlSize + l.textGap + cinematicTextSlot(l, textHeight) + l.progressGap + l.progressHeight + l.padBottom;
}

/** Every on-screen rectangle for a chapter whose tallest line measures `textHeight`. */
export function getCinematicFrame(layout: CinematicLayout, width: number, height: number, textHeight: number): CinematicFrame {
	const l = layout;
	const bandHeight = cinematicBandHeight(l, textHeight);
	const band = { x: 0, y: height - bandHeight, width, height: bandHeight };
	const backdropTop = math.max(0, band.y - l.featherHeight);
	const left = math.floor((width - l.textWidth) / 2), right = left + l.textWidth;
	const rowY = band.y + l.padTop;
	const skipButton = { x: right - l.skipWidth, y: rowY, width: l.skipWidth, height: l.controlSize };
	const pauseButton = { x: skipButton.x - l.controlGap - l.controlSize, y: rowY, width: l.controlSize, height: l.controlSize };
	const settingsButton = { x: pauseButton.x - l.controlGap - l.controlSize, y: rowY, width: l.controlSize, height: l.controlSize };
	const hint = l.showHint ? { x: settingsButton.x - 8 - l.hintWidth, y: rowY, width: l.hintWidth, height: l.controlSize } : undefined;
	const speaker = { x: left, y: rowY, width: (hint ?? settingsButton).x - 8 - left, height: l.controlSize };
	const textY = rowY + l.controlSize + l.textGap, slot = cinematicTextSlot(l, textHeight);
	const text = { x: left, y: textY, width: l.textWidth, height: slot };
	const progress = { x: left, y: textY + slot + l.progressGap, width: l.textWidth, height: l.progressHeight };
	// The popover opens upward from the controls; a short scene lane lays its two toggles side by side.
	const columnHeight = l.controlSize * 2 + 12;
	const horizontalSettings = band.y - SETTINGS_GAP - columnHeight < 0;
	const panelWidth = horizontalSettings ? math.min(l.textWidth, 2 * 140 + 12) : l.tiny ? 200 : 228;
	const panelHeight = horizontalSettings ? l.controlSize + 8 : columnHeight;
	const settingsPanel = { x: math.max(left, right - panelWidth), y: band.y - SETTINGS_GAP - panelHeight, width: panelWidth, height: panelHeight };
	const chipWidth = l.tiny ? 96 : 120, chipHeight = l.tiny ? 26 : 32;
	const pausedChip = { x: math.floor((width - chipWidth) / 2), y: math.floor((band.y - chipHeight) / 2), width: chipWidth, height: chipHeight };
	return {
		band, backdrop: { x: 0, y: backdropTop, width, height: height - backdropTop },
		scene: { x: 0, y: 0, width, height: band.y },
		speaker, hint, settingsButton, pauseButton, skipButton, text, progress,
		settingsPanel, horizontalSettings, pausedChip,
	};
}

/** One progress segment per beat across `width`, separated by a small gap. */
export function progressSegments(width: number, beats: number, gap = 3): Rect[] {
	const count = math.max(1, beats);
	const segment = (width - gap * (count - 1)) / count;
	const segments: Rect[] = [];
	for (let i = 0; i < count; i++) {
		const x = math.floor(i * (segment + gap));
		const nextX = i === count - 1 ? width : math.floor(i * (segment + gap) + segment);
		segments.push({ x, y: 0, width: nextX - x, height: 1 });
	}
	return segments;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function rectInside(inner: Rect, outer: Rect): boolean {
	return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
