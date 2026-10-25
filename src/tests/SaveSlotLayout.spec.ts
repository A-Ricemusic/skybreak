import { describe, expect, it } from "@rbxts/jest-globals";
import { TextService } from "@rbxts/services";
import { MissionCatalog } from "../shared/MissionCatalog";
import { getSaveSlotRowHeight } from "../shared/SaveSlotLayout";
import { getMenuLayout, MIN_TOUCH_TARGET } from "../shared/UILayout";

// Exercise actual Roblox font metrics rather than assuming Label.Size clips text.
describe("campaign save copy", () => {
	for (const [width, height] of [[320, 182], [568, 262], [750, 332], [844, 332], [320, 568], [390, 705], [1920, 1080]]) {
		it(`keeps every mission and confirmation readable at ${width}x${height}`, () => {
			const copyWidth = getMenuLayout(width, height).panel.width - 68;
			for (const text of ["CAMPAIGN COMPLETE · REPLAY", "DELETE THIS SAVE?", "LINK UNAVAILABLE", "READING FILE...", "NEW CAMPAIGN", ...MissionCatalog.All().map((mission) => `CONTINUE MISSION ${string.format("%02d", mission.id)}`)]) {
				const bounds = TextService.GetTextSize(text, 13, Enum.Font.GothamBold, new Vector2(copyWidth, 1000));
				expect(bounds.X <= copyWidth).toBe(true);
				expect(bounds.Y <= 36).toBe(true);
			}
			for (const text of ["All progress in this file is lost.", "Return and try again", "Please stand by", ...MissionCatalog.All().map((mission) => `27/27 complete · ${mission.title}`)]) {
				const bounds = TextService.GetTextSize(text, 12, Enum.Font.Gotham, new Vector2(copyWidth, 1000));
				expect(bounds.X <= copyWidth).toBe(true);
				expect(bounds.Y <= 32).toBe(true);
			}
			// Both confirmation targets fit side by side below the entire 84px copy lane.
			expect((getMenuLayout(width, height).panel.width - 24) / 2 >= MIN_TOUCH_TARGET).toBe(true);
			expect(getSaveSlotRowHeight(true, false) >= 84 + MIN_TOUCH_TARGET).toBe(true);
			expect(getSaveSlotRowHeight(false, true) >= 84 + MIN_TOUCH_TARGET).toBe(true);
		});
	}
});
