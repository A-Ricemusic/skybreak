import { describe, expect, it } from "@rbxts/jest-globals";
import { TextService } from "@rbxts/services";
import { targetScoreLines } from "../shared/OutcomePoints";
import { getMenuLayout } from "../shared/UILayout";

// Engine font measurement; intentionally Studio-only (no DOM/React test harness).
describe("points debrief phone typography", () => {
	it("fits role, count and points in the existing debrief columns on narrow screens", () => {
		const kills = { bandit: 99, raider: 99, courier: 99, ace: 99, ground: 99, bomber: 99, escort: 99 };
		const points = { bandit: 999999, raider: 999999, courier: 999999, ace: 999999, ground: 999999, bomber: 999999, escort: 999999 };
		for (const [width, height] of [[319, 181], [320, 182], [320, 568], [390, 705], [568, 320]]) {
			const menu = getMenuLayout(width, height);
			const available = menu.panel.width - 16; // Rank/details row and scrollbar gutter.
			const size = menu.compact ? 11 : 13;
			for (const row of targetScoreLines({ total: 6999993, kills, points })) {
				const label = TextService.GetTextSize(row.label, size, Enum.Font.GothamMedium, new Vector2(10000, 1000));
				const value = TextService.GetTextSize(row.value, size, Enum.Font.RobotoMono, new Vector2(10000, 1000));
				expect(label.X).toBeLessThanOrEqual(available * 0.62);
				expect(value.X).toBeLessThanOrEqual(available * 0.38);
				expect(math.max(label.Y, value.Y)).toBeLessThanOrEqual(menu.compact ? 18 : 22);
			}
		}
	});
});
