import { MIN_TOUCH_TARGET } from "./UILayout";

/** Vertical rhythm between briefing blocks (eyebrow/title/meta header, story, objective, loadout). */
export const BRIEFING_GAP = 8;
/** Spacing inside the eyebrow/title/meta header. */
export const BRIEFING_HEADER_SPACING = 2;
/** The eyebrow and the region/environment meta are single scaled lines of this height. */
export const BRIEFING_LINE_HEIGHT = 14;
/** Story copy line height multiplier (TextLabel.LineHeight). */
export const BRIEFING_STORY_LINE_HEIGHT = 1.12;
/** Scrollbar inset plus the label's right inset. */
export const BRIEFING_TEXT_INSET = 16;

export interface BriefingDock {
	gap: number;
	back: number;
	archive: number;
	launch: number;
}

export interface BriefingLayout {
	/** One row of actions pinned to the bottom of the panel: back, archive, launch. */
	dockHeight: number;
	dockTop: number;
	/** Scrolling reading viewport above the dock. */
	detailsHeight: number;
	/** Wrapping width available to briefing copy. */
	textWidth: number;
	titleSize: number;
	bodySize: number;
	dock: BriefingDock;
}

/** Three touch targets in one row; launch keeps the largest share. */
export function getBriefingDock(panelWidth: number): BriefingDock {
	const gap = 8;
	const narrow = panelWidth < 330;
	const back = narrow ? MIN_TOUCH_TARGET + 8 : 92;
	const archive = narrow ? 84 : math.floor(math.clamp(panelWidth * 0.28, 100, 150));
	return { gap, back, archive, launch: panelWidth - back - archive - gap * 2 };
}

/**
 * The briefing is one scrolling column of copy above a single 44px action dock.
 * The heading scrolls with the copy so short landscape roots spend every pixel
 * above the dock on reading.
 */
export function getBriefingLayout(panelWidth: number, panelHeight: number): BriefingLayout {
	const dockHeight = MIN_TOUCH_TARGET;
	const dockTop = panelHeight - dockHeight;
	return {
		dockHeight,
		dockTop,
		detailsHeight: dockTop - BRIEFING_GAP,
		textWidth: panelWidth - BRIEFING_TEXT_INSET,
		titleSize: panelHeight < 220 ? 18 : panelHeight < 400 ? 22 : 30,
		bodySize: panelHeight < 220 ? 13 : 14,
		dock: getBriefingDock(panelWidth),
	};
}

/** Height of the hero block (eyebrow, title, meta, story) from measured title and story text heights. */
export function getBriefingHeroHeight(titleHeight: number, storyHeight: number): number {
	return BRIEFING_LINE_HEIGHT + BRIEFING_HEADER_SPACING + titleHeight + BRIEFING_HEADER_SPACING + BRIEFING_LINE_HEIGHT + BRIEFING_GAP + storyHeight;
}

export const ARCHIVE_HEADER_HEIGHT = MIN_TOUCH_TARGET;
export const ARCHIVE_GAP = 6;
export const ARCHIVE_TAB_HEIGHT = MIN_TOUCH_TARGET;
/** Header, gap, act tabs, gap. */
export const ARCHIVE_GRID_TOP = ARCHIVE_HEADER_HEIGHT + ARCHIVE_GAP + ARCHIVE_TAB_HEIGHT + ARCHIVE_GAP;
export const ARCHIVE_TILE_MIN_WIDTH = 132;
export const ARCHIVE_TILE_HEIGHT = 60;
/** Room on the right of the grid for its scrollbar. */
export const ARCHIVE_SCROLLBAR_LANE = 8;

export interface ArchiveGrid {
	columns: number;
	gap: number;
	tileWidth: number;
	tileHeight: number;
	top: number;
	/** Visible grid viewport height. */
	height: number;
}

/** Mission archive tiles: as many >=132px columns as the panel fits, at least two. */
export function getArchiveGrid(panelWidth: number, panelHeight: number): ArchiveGrid {
	const gap = 8;
	const usable = panelWidth - ARCHIVE_SCROLLBAR_LANE;
	const columns = math.max(2, math.floor((usable + gap) / (ARCHIVE_TILE_MIN_WIDTH + gap)));
	return {
		columns,
		gap,
		tileWidth: math.floor((usable - gap * (columns - 1)) / columns),
		tileHeight: ARCHIVE_TILE_HEIGHT,
		top: ARCHIVE_GRID_TOP,
		height: math.max(ARCHIVE_TILE_HEIGHT, panelHeight - ARCHIVE_GRID_TOP),
	};
}

/** Scroll canvas height for `count` tiles. */
export function getArchiveCanvasHeight(grid: ArchiveGrid, count: number): number {
	const rows = math.ceil(count / grid.columns);
	return rows * grid.tileHeight + math.max(0, rows - 1) * grid.gap;
}
