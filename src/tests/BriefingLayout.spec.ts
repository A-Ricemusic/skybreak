import { describe, expect, it } from "@rbxts/jest-globals";
import { TextService } from "@rbxts/services";
import {
	BRIEFING_GAP,
	BRIEFING_STORY_LINE_HEIGHT,
	getArchiveCanvasHeight,
	getArchiveGrid,
	getBriefingHeroHeight,
	getBriefingLayout,
} from "../shared/BriefingLayout";
import { ACT_NAMES, ACTS, MissionCatalog } from "../shared/MissionCatalog";
import { getMenuLayout, MIN_TOUCH_TARGET } from "../shared/UILayout";

const ROOTS: [number, number][] = [[319, 181], [320, 182], [560, 240], [706, 267], [750, 332], [844, 390], [320, 568], [390, 705], [1280, 720], [1920, 1080]];

describe("briefing reading viewport", () => {
	it("keeps a readable scroll viewport above one row of touch-sized actions", () => {
		for (const [width, height] of ROOTS) {
			const panel = getMenuLayout(width, height).panel;
			const layout = getBriefingLayout(panel.width, panel.height);
			expect(layout.detailsHeight).toBeGreaterThanOrEqual(100);
			expect(layout.dockHeight).toBe(MIN_TOUCH_TARGET);
			expect(layout.detailsHeight + BRIEFING_GAP + layout.dockHeight).toBe(panel.height);
			expect(layout.dockTop + layout.dockHeight).toBe(panel.height);
			const dock = layout.dock;
			for (const button of [dock.back, dock.archive, dock.launch]) expect(button).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			expect(dock.launch).toBeGreaterThanOrEqual(dock.archive);
			expect(dock.back + dock.archive + dock.launch + dock.gap * 2).toBe(panel.width);
		}
	});

	// The owner's QA phone: eyebrow, title, location and the full story must be
	// on screen when the briefing opens; only the plan and loadout may scroll.
	it("shows every mission's title and full story without scrolling on phones and desktop", () => {
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [390, 705], [1280, 720]] as [number, number][]) {
			const panel = getMenuLayout(width, height).panel;
			const layout = getBriefingLayout(panel.width, panel.height);
			for (const mission of MissionCatalog.All()) {
				const title = TextService.GetTextSize(mission.title, layout.titleSize, Enum.Font.GothamBlack, new Vector2(layout.textWidth, 1000));
				const story = TextService.GetTextSize(mission.briefing, layout.bodySize, Enum.Font.Gotham, new Vector2(layout.textWidth, 1000));
				expect(title.X <= layout.textWidth).toBe(true);
				const hero = getBriefingHeroHeight(title.Y, math.ceil(story.Y * BRIEFING_STORY_LINE_HEIGHT));
				expect(hero <= layout.detailsHeight).toBe(true);
			}
		}
	});

	it("uses phone-legible type", () => {
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [390, 705]] as [number, number][]) {
			const panel = getMenuLayout(width, height).panel;
			const layout = getBriefingLayout(panel.width, panel.height);
			expect(layout.bodySize).toBeGreaterThanOrEqual(13);
			expect(layout.titleSize >= 20 && layout.titleSize <= 30).toBe(true);
		}
	});
});

describe("mission archive grid", () => {
	it("fits whole tiles across the panel at every supported root", () => {
		for (const [width, height] of ROOTS) {
			const panel = getMenuLayout(width, height).panel;
			const grid = getArchiveGrid(panel.width, panel.height);
			expect(grid.columns).toBeGreaterThanOrEqual(2);
			expect(grid.tileWidth).toBeGreaterThanOrEqual(120);
			expect(grid.tileHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			expect(grid.columns * grid.tileWidth + (grid.columns - 1) * grid.gap <= panel.width).toBe(true);
			expect(grid.top + grid.height <= panel.height).toBe(true);
		}
	});

	it("shows a whole act without scrolling on phone landscape and desktop", () => {
		for (const [width, height] of [[750, 332], [844, 390], [390, 705], [1280, 720]] as [number, number][]) {
			const panel = getMenuLayout(width, height).panel;
			const grid = getArchiveGrid(panel.width, panel.height);
			for (const act of ACTS) {
				expect(getArchiveCanvasHeight(grid, MissionCatalog.ByAct(act).size()) <= grid.height).toBe(true);
				expect(ACT_NAMES[act]).toBeDefined();
			}
		}
	});
});
