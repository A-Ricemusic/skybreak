import { describe, expect, it } from "@rbxts/jest-globals";
import { getBriefingLayout } from "../shared/BriefingLayout";
import { getMenuLayout } from "../shared/UILayout";

describe("briefing reading viewport", () => {
	it("keeps a readable scroll viewport separate from both fixed action rows", () => {
		for (const [width, height] of [[319,181], [320,182], [560,240], [706,267], [750,332], [844,390], [320,568], [390,705], [1280,720]]) {
			const panel = getMenuLayout(width, height).panel;
			const layout = getBriefingLayout(panel.height);
			expect(layout.detailsHeight).toBeGreaterThanOrEqual(64);
			expect(layout.actionHeight).toBe(44);
			expect(layout.archiveBottom - layout.actionHeight - layout.detailsHeight).toBe(8);
			expect(panel.height - layout.actionHeight - layout.archiveBottom).toBe(8);
		}
	});
});
