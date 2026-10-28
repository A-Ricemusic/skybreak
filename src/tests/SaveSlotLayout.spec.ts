import { describe, expect, it } from "@rbxts/jest-globals";
import { TextService } from "@rbxts/services";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import {
	CAMPAIGN_HEADER_GAP,
	CAMPAIGN_HEADER_HEIGHT,
	getSaveSlotLayout,
	getSlotListCanvasHeight,
	getSlotListHeight,
	SAVE_SLOT_SCROLLBAR_LANE,
} from "../shared/SaveSlotLayout";
import { getMenuLayout, MIN_TOUCH_TARGET } from "../shared/UILayout";

const STATUSES = ["COMPLETE · REPLAY", "DELETE FILE 04?", "LINK UNAVAILABLE", "READING FILE...", "NEW CAMPAIGN", ...MissionCatalog.All().map((mission) => `CONTINUE MISSION ${string.format("%02d", mission.id)}`)];
const DETAILS = ["All progress in this file is lost.", "Return and try again", "Please stand by", ...MissionCatalog.All().map((mission) => `${MISSION_COUNT}/${MISSION_COUNT} complete · ${mission.title}`)];

// Exercise actual Roblox font metrics rather than assuming Label.Size clips text.
describe("campaign save copy", () => {
	for (const [width, height] of [[320, 182], [568, 262], [706, 267], [750, 332], [844, 332], [320, 568], [390, 705], [1280, 720], [1920, 1080]]) {
		it(`keeps every status, detail and confirmation readable at ${width}x${height}`, () => {
			const panel = getMenuLayout(width, height).panel;
			const layout = getSaveSlotLayout(panel.width);
			for (const text of STATUSES) {
				const bounds = TextService.GetTextSize(text, 13, Enum.Font.GothamBold, new Vector2(layout.copyWidth, 1000));
				expect(bounds.X <= layout.copyWidth).toBe(true);
				expect(bounds.Y <= layout.statusHeight).toBe(true);
			}
			for (const text of DETAILS) {
				const bounds = TextService.GetTextSize(text, 12, Enum.Font.Gotham, new Vector2(layout.copyWidth, 1000));
				expect(bounds.X <= layout.copyWidth).toBe(true);
				expect(bounds.Y <= layout.detailHeight).toBe(true);
			}
			// The copy lane ends 8px before the 44px delete target, which keeps an 8px inset.
			expect(layout.copyLeft + layout.copyWidth + 8 + MIN_TOUCH_TARGET + 8).toBe(panel.width - SAVE_SLOT_SCROLLBAR_LANE);
			expect(layout.rowHeight >= MIN_TOUCH_TARGET).toBe(true);
			expect(layout.progressTop >= layout.detailTop + layout.detailHeight).toBe(true);
			expect(layout.progressTop + 3 <= layout.rowHeight).toBe(true);
			// KEEP and DELETE sit side by side in their own lane below the copy.
			expect((panel.width - SAVE_SLOT_SCROLLBAR_LANE - 16 - 8) / 2 >= MIN_TOUCH_TARGET).toBe(true);
			expect(layout.confirmHeight).toBe(layout.rowHeight + MIN_TOUCH_TARGET + 8);
		});
	}

	it("leaves a pressable list below the header on every supported root", () => {
		for (const [width, height] of [[319, 181], [320, 182], [560, 240], [568, 320], [706, 267], [750, 332], [844, 390], [320, 568], [390, 705], [1280, 720]]) {
			const panel = getMenuLayout(width, height).panel;
			const list = getSlotListHeight(panel.height);
			expect(list >= MIN_TOUCH_TARGET).toBe(true);
			expect(CAMPAIGN_HEADER_HEIGHT + CAMPAIGN_HEADER_GAP + list <= panel.height).toBe(true);
		}
	});

	it("shows all four files without scrolling on phone landscape and desktop", () => {
		for (const [width, height] of [[750, 332], [844, 390], [390, 705], [1280, 720]]) {
			const panel = getMenuLayout(width, height).panel;
			const layout = getSaveSlotLayout(panel.width);
			expect(getSlotListCanvasHeight(layout, [false, false, false, false]) <= getSlotListHeight(panel.height)).toBe(true);
		}
	});
});
