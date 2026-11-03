// Menu-screen geometry: the single reading panel every menu screen shares (side panel in landscape,
// bottom sheet in portrait), the gamepad hint row beside it, and the scene-opening fraction the
// backdrop fade and menu camera use. Pure functions of the viewport size.
import type { Rectangle } from "./UILayoutGeometry";

export type MenuMode = "side" | "sheet";

export interface MenuLayout {
	mode: MenuMode;
	compact: boolean;
	panel: Rectangle;
}

/** Share of a short (phone) landscape root given to the reading panel. */
const MENU_PHONE_PANEL_SHARE = 0.6;
/** Share of a tall (tablet/desktop) landscape root given to the reading panel. */
const MENU_DESKTOP_PANEL_SHARE = 0.44;
const MENU_PANEL_MAX_WIDTH = 580;
const MENU_PANEL_MAX_HEIGHT = 560;

/**
 * One panel shared by every menu screen. Landscape keeps it to the left and the
 * display aircraft in the open strip on the right; portrait uses a bottom sheet.
 * Phones in landscape give the copy about 60% of the width: mission text, not
 * the jet, is what the player has to read there.
 */
export function getMenuLayout(viewportWidth: number, viewportHeight: number): MenuLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	if (width >= height * 1.15) {
		const x = math.floor(math.clamp(width * 0.03, 12, 64));
		const share = height < 480 ? MENU_PHONE_PANEL_SHARE : MENU_DESKTOP_PANEL_SHARE;
		const panelWidth = math.floor(math.clamp(width * share, 280, MENU_PANEL_MAX_WIDTH));
		const vertical = height < 240 ? 6 : height < 440 ? 12 : math.floor(math.clamp(height * 0.08, 24, 64));
		const panelHeight = math.min(height - vertical * 2, MENU_PANEL_MAX_HEIGHT);
		return {
			mode: "side",
			compact: panelHeight < 400,
			panel: { x, y: math.floor((height - panelHeight) / 2), width: panelWidth, height: panelHeight },
		};
	}
	const margin = 16;
	const available = height - margin * 2;
	const panelHeight = math.floor(math.clamp(height * 0.62, math.min(340, available), math.min(460, available)));
	const panelWidth = math.min(width - margin * 2, 520);
	return {
		mode: "sheet",
		compact: panelHeight < 400,
		panel: {
			x: math.floor((width - panelWidth) / 2),
			y: height - margin - panelHeight,
			width: panelWidth,
			height: panelHeight,
		},
	};
}

/** Gamepad select/back hints: bottom-right beside the side panel, or just above the bottom sheet. */
export function getMenuHintsLayout(viewportWidth: number, viewportHeight: number, menu: MenuLayout): Rectangle {
	if (menu.mode === "side") {
		const width = math.max(1, viewportWidth);
		const hintsWidth = math.min(260, width - 16 - (menu.panel.x + menu.panel.width + 16));
		return { x: width - 16 - hintsWidth, y: math.max(1, viewportHeight) - 16 - 28, width: hintsWidth, height: 28 };
	}
	return { x: menu.panel.x, y: menu.panel.y - 36, width: menu.panel.width, height: 28 };
}

/**
 * Horizontal fraction (0-1) where the open scene strip begins, right of a side
 * panel. Used by the backdrop fade and the menu camera framing.
 */
export function getMenuSceneOpening(viewportWidth: number, menu: MenuLayout): number {
	return math.clamp((menu.panel.x + menu.panel.width) / math.max(1, viewportWidth), 0.3, 0.75);
}
