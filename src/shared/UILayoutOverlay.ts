// In-mission overlay cards: the centred pause card (title + RESUME/SETTINGS/MAIN MENU) and the
// settings sheet (header, one row per SETTING_ORDER entry, DONE). Both keep every control at or
// above MIN_TOUCH_TARGET and fall back to a one-row pause card on the Studio compact root.
import { SETTING_ORDER } from "./PlayerSettings";
import { MIN_TOUCH_TARGET, type Rectangle } from "./UILayoutGeometry";

export interface PauseLayout {
	panel: Rectangle;
	/** Relative to the panel. */
	title: Rectangle;
	/** RESUME, SETTINGS, MAIN MENU; relative to the panel. */
	buttons: Rectangle[];
}

/** Centred pause card over the dimmed mission: a title and three full-width 44+ px buttons. */
export function getPauseLayout(viewportWidth: number, viewportHeight: number): PauseLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const padding = height < 240 ? 8 : 16;
	const gap = height < 240 ? 6 : 8;
	const titleHeight = height < 240 ? 20 : 28;
	const available = height - 12 - padding * 2 - titleHeight - gap * 3;
	const button = math.clamp(math.floor(available / 3), MIN_TOUCH_TARGET, 52);
	const panelWidth = math.min(300, width - 24);
	// Too short for a column of three (Studio compact): one row of three buttons.
	const row = available < MIN_TOUCH_TARGET * 3;
	const panelHeight = row
		? padding * 2 + titleHeight + gap + MIN_TOUCH_TARGET
		: padding * 2 + titleHeight + gap * 3 + button * 3;
	const panel = {
		x: math.floor((width - panelWidth) / 2),
		y: math.max(6, math.floor((height - panelHeight) / 2)),
		width: panelWidth,
		height: panelHeight,
	};
	const title = { x: padding, y: padding, width: panelWidth - padding * 2, height: titleHeight };
	const buttons: Rectangle[] = [];
	const cell = math.floor((panelWidth - padding * 2 - gap * 2) / 3);
	for (let index = 0; index < 3; index++) {
		buttons.push(
			row
				? {
						x: padding + index * (cell + gap),
						y: title.y + titleHeight + gap,
						width: cell,
						height: MIN_TOUCH_TARGET,
					}
				: {
						x: padding,
						y: title.y + titleHeight + gap + index * (button + gap),
						width: panelWidth - padding * 2,
						height: button,
					},
		);
	}
	return { panel, title, buttons };
}

export interface SettingsLayout {
	panel: Rectangle;
	/** Title row, relative to the panel. */
	header: Rectangle;
	/** Scrolling list of setting rows, relative to the panel. */
	list: Rectangle;
	rowHeight: number;
	/** DONE button, relative to the panel. */
	done: Rectangle;
	/** − / + stepper buttons (and the toggle) are square, this size. */
	control: number;
	/** Width of the value text between the stepper buttons. */
	valueWidth: number;
}

const SETTINGS_ROWS = SETTING_ORDER.size();

/** The settings sheet: header, a scrolling list of 48 px rows with 44 px steppers, and DONE. */
export function getSettingsLayout(viewportWidth: number, viewportHeight: number): SettingsLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const padding = height < 240 ? 8 : 14;
	const headerHeight = height < 240 ? 22 : 30;
	const rowHeight = MIN_TOUCH_TARGET + 4;
	const panelWidth = math.min(460, width - 16);
	const panelHeight = math.min(
		height - 12,
		padding * 2 + headerHeight + 6 + SETTINGS_ROWS * rowHeight + 8 + MIN_TOUCH_TARGET,
	);
	const panel = {
		x: math.floor((width - panelWidth) / 2),
		y: math.floor((height - panelHeight) / 2),
		width: panelWidth,
		height: panelHeight,
	};
	const header = { x: padding, y: padding, width: panelWidth - padding * 2, height: headerHeight };
	const done = {
		x: padding,
		y: panelHeight - padding - MIN_TOUCH_TARGET,
		width: panelWidth - padding * 2,
		height: MIN_TOUCH_TARGET,
	};
	const listTop = header.y + headerHeight + 6;
	const list = {
		x: padding,
		y: listTop,
		width: panelWidth - padding * 2,
		height: math.max(rowHeight, done.y - 8 - listTop),
	};
	return { panel, header, list, rowHeight, done, control: MIN_TOUCH_TARGET, valueWidth: panelWidth < 360 ? 52 : 64 };
}
