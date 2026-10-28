/** Story caption geometry. Text height is measured at the exact wrap width the label will use, and the
 * scrolling canvas is set to that measured height, so a caption that does not fit the band can always be
 * scrolled to its last line instead of silently clipping. Pure apart from the injected measurer. */
export type CaptionMeasure = (text: string, textSize: number, wrapWidth: number) => number;
export interface AC04CaptionLayout {
	titleHeight: number;
	bandHeight: number;
	sceneHeight: number;
	compact: boolean;
	textSize: number;
	/** Caption scroll frame, relative to the band. */
	captionX: number; captionY: number; captionWidth: number; captionHeight: number;
	/** Width the label wraps at: caption width minus the reserved scroll bar gutter. */
	wrapWidth: number;
	/** Measured height of the current caption; this is also the canvas height. */
	textHeight: number;
	scrollable: boolean;
	controlsHeight: number;
	scrollBarThickness: number;
}
export const AC04_CAPTION_CONTROLS = 44, AC04_CAPTION_BOTTOM_GAP = 13, AC04_CAPTION_SCROLLBAR = 6;
const GUTTER = AC04_CAPTION_SCROLLBAR + 6, CONTROL_GAP = 8;
export function ac04CaptionTextSize(width: number, height: number): number { return height < 400 || width < 600 ? 17 : 20; }
/**
 * @param texts every caption in the chapter; the band is sized for the longest so it does not jump between beats.
 * @param current index of the caption being shown.
 */
export function getAC04CaptionLayout(width: number, height: number, texts: string[], current: number, measure: CaptionMeasure): AC04CaptionLayout {
	const titleHeight = height < 300 ? 36 : 64;
	const textSize = ac04CaptionTextSize(width, height);
	const captionX = math.floor(width * .05), captionWidth = math.max(40, width - captionX * 2);
	const wrapWidth = math.max(20, captionWidth - GUTTER);
	const slack = math.ceil(textSize * .35);
	const heights = texts.map((text) => math.ceil(measure(text, textSize, wrapWidth)) + slack);
	const longest = heights.reduce((best, value) => math.max(best, value), textSize + slack);
	const textHeight = heights[current] ?? textSize + slack;
	const chrome = AC04_CAPTION_CONTROLS + AC04_CAPTION_BOTTOM_GAP + CONTROL_GAP;
	// Keep a usable scene lane; captions beyond that limit scroll inside the band.
	const minimumScene = math.max(90, math.floor(height * .3));
	const maxBand = math.max(chrome + textSize * 2, height - titleHeight - minimumScene);
	const roomyHeader = 39, tightHeader = 8;
	const wanted = (header: number) => header + longest + chrome;
	const compact = wanted(roomyHeader) > maxBand && maxBand < 170;
	const captionY = compact ? tightHeader : roomyHeader;
	const bandHeight = math.clamp(wanted(captionY), math.min(150, maxBand), maxBand);
	const captionHeight = math.max(textSize + 4, bandHeight - captionY - chrome);
	return {
		titleHeight, bandHeight, sceneHeight: height - titleHeight - bandHeight, compact, textSize,
		captionX, captionY, captionWidth, captionHeight, wrapWidth, textHeight,
		scrollable: textHeight > captionHeight + .5, controlsHeight: AC04_CAPTION_CONTROLS, scrollBarThickness: AC04_CAPTION_SCROLLBAR,
	};
}
