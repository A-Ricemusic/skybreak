import { describe, expect, it } from "@rbxts/jest-globals";

import { getHudLayout, rectanglesOverlap } from "../shared/UILayout";

describe("responsive mission HUD layout", () => {
	it("separates objective, telemetry, and target on a 568px phone viewport", () => {
		const layout = getHudLayout(568, 320);

		expect(layout.compactTop).toBe(true);
		expect(rectanglesOverlap(layout.objective, layout.telemetry)).toBe(false);
		expect(rectanglesOverlap(layout.objective, layout.target)).toBe(false);
		expect(rectanglesOverlap(layout.telemetry, layout.target)).toBe(false);
	});

	it("keeps every compact top panel inside narrow safe bounds", () => {
		const viewportWidth = 320;
		const layout = getHudLayout(viewportWidth, 568);

		for (const rectangle of [layout.objective, layout.telemetry, layout.target]) {
			expect(rectangle.x).toBeGreaterThanOrEqual(14);
			expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(viewportWidth - 14);
		}
	});

	it("uses the full telemetry panel only when horizontal space is safe", () => {
		const layout = getHudLayout(1024, 768);

		expect(layout.compactTop).toBe(false);
		expect(rectanglesOverlap(layout.telemetry, layout.objective)).toBe(false);
		expect(rectanglesOverlap(layout.telemetry, layout.target)).toBe(false);
		expect(rectanglesOverlap(layout.objective, layout.target)).toBe(false);
	});
});
