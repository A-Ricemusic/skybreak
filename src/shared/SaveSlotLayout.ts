import { MIN_TOUCH_TARGET } from "./UILayout";

/** Campaign file screen: a 44px header (back + title + save status), then the scrolling slot list. */
export const CAMPAIGN_HEADER_HEIGHT = MIN_TOUCH_TARGET;
export const CAMPAIGN_HEADER_GAP = 6;
export const SAVE_SLOT_GAP = 6;
/** Panels at least this wide fit each file's status and detail on one line. */
export const SAVE_SLOT_WIDE_PANEL = 400;
/** The slot rows leave this much room on the right for the list's scrollbar. */
export const SAVE_SLOT_SCROLLBAR_LANE = 6;

export interface SaveSlotLayout {
	wide: boolean;
	/** Copy lane plus the inline delete target. */
	rowHeight: number;
	/** rowHeight plus an independent KEEP/DELETE action lane. */
	confirmHeight: number;
	copyLeft: number;
	copyWidth: number;
	statusTop: number;
	statusHeight: number;
	detailTop: number;
	detailHeight: number;
	progressTop: number;
}

/**
 * Text and destructive actions keep separate lanes at every width: the file
 * number, the copy, then a 44px delete target on the right. Wide panels give
 * the status and detail one line each; narrow panels give them two.
 */
export function getSaveSlotLayout(panelWidth: number): SaveSlotLayout {
	const wide = panelWidth >= SAVE_SLOT_WIDE_PANEL;
	const rowWidth = panelWidth - SAVE_SLOT_SCROLLBAR_LANE;
	const copyLeft = 44;
	const copyWidth = rowWidth - copyLeft - MIN_TOUCH_TARGET - 16;
	const statusTop = wide ? 9 : 10;
	const statusHeight = wide ? 16 : 32;
	const detailTop = statusTop + statusHeight + 2;
	const detailHeight = wide ? 16 : 30;
	// A 3px completion bar under the copy, then the row's bottom inset.
	const progressTop = detailTop + detailHeight + 6;
	const rowHeight = progressTop + 3 + 8;
	return {
		wide,
		rowHeight,
		confirmHeight: rowHeight + MIN_TOUCH_TARGET + 8,
		copyLeft,
		copyWidth,
		statusTop,
		statusHeight,
		detailTop,
		detailHeight,
		progressTop,
	};
}

/** Height available to the slot list below the header. */
export function getSlotListHeight(panelHeight: number): number {
	return math.max(MIN_TOUCH_TARGET, panelHeight - CAMPAIGN_HEADER_HEIGHT - CAMPAIGN_HEADER_GAP);
}

/** Scroll canvas height for four slots, given which rows are expanded for a delete confirmation. */
export function getSlotListCanvasHeight(layout: SaveSlotLayout, confirming: boolean[]): number {
	let height = 0;
	for (const open of confirming) height += open ? layout.confirmHeight : layout.rowHeight;
	return height + SAVE_SLOT_GAP * math.max(0, confirming.size() - 1);
}
