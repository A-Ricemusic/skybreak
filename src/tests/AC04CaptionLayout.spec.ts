import { describe, expect, it } from "@rbxts/jest-globals";
import { TextService } from "@rbxts/services";
/** Caption geometry against Roblox's own text measurement; screenshot review covers rendering. */
import { AC04Story } from "../shared/ac04/AC04Story";
import { getAC04CaptionLayout, AC04_CAPTION_CONTROLS, AC04_CAPTION_BOTTOM_GAP } from "../shared/ac04/AC04CaptionLayout";
const measure = (text: string, size: number, width: number) => TextService.GetTextSize(text, size, Enum.Font.Gotham, new Vector2(width, 100000)).Y;
/** Safe roots: narrow phone 390x525, compact desktop 1205x525, landscape phones 844x390 / 667x375, desktop 1920x1020, tiny 320x240. */
const ROOTS: [number, number][] = [[390, 525], [1205, 525], [844, 390], [667, 375], [1920, 1020], [320, 240]];
describe("AC04 story captions", () => {
	it("sizes every caption canvas to its measured wrapped height so no line is unreachable", () => {
		for (const [width, height] of ROOTS) for (const chapter of AC04Story) {
			const texts = chapter.beats.map((b) => b.text);
			for (let i = 0; i < texts.size(); i++) {
				const layout = getAC04CaptionLayout(width, height, texts, i, measure);
				const measured = measure(texts[i], layout.textSize, layout.wrapWidth);
				expect(layout.textHeight).toBeGreaterThanOrEqual(measured);
				expect(layout.wrapWidth).toBeLessThanOrEqual(layout.captionWidth - layout.scrollBarThickness);
				expect(layout.textSize).toBeGreaterThanOrEqual(17);
				expect(layout.captionHeight).toBeGreaterThanOrEqual(layout.textSize);
				expect(layout.scrollable).toBe(layout.textHeight > layout.captionHeight + .5);
				expect(layout.captionY + layout.captionHeight + AC04_CAPTION_CONTROLS + AC04_CAPTION_BOTTOM_GAP).toBeLessThanOrEqual(layout.bandHeight);
				expect(layout.titleHeight + layout.bandHeight + layout.sceneHeight).toBe(height);
				expect(layout.sceneHeight).toBeGreaterThanOrEqual(math.min(90, height * .3) - 1);
			}
		}
	});
	it("shows every full caption without scrolling on the 390x525 narrow phone and 1205x525 compact desktop", () => {
		for (const [width, height] of [[390, 525], [1205, 525]] as [number, number][]) for (const chapter of AC04Story) {
			const texts = chapter.beats.map((b) => b.text);
			for (let i = 0; i < texts.size(); i++) {
				const layout = getAC04CaptionLayout(width, height, texts, i, measure);
				if (layout.scrollable) error(`${chapter.id} beat ${i + 1} needs scrolling at ${width}x${height}: text ${layout.textHeight} > ${layout.captionHeight}`);
			}
		}
	});
	it("keeps the band stable across a chapter and reproduces the reviewed i08 beat 4 defect geometry as fixed", () => {
		const chapter = AC04Story.find((c) => c.id === "ac04-i08")!, texts = chapter.beats.map((b) => b.text);
		const bands = texts.map((_, i) => getAC04CaptionLayout(390, 525, texts, i, measure).bandHeight);
		for (const band of bands) expect(band).toBe(bands[0]);
		const fourth = getAC04CaptionLayout(390, 525, texts, 3, measure);
		// Reviewed defect: label 341x80, frame 94, canvas 94 with clipped text. Now canvas equals the measured text.
		expect(fourth.textHeight).toBeGreaterThan(80);
		expect(fourth.captionHeight).toBeGreaterThanOrEqual(fourth.textHeight);
	});
	it("falls back to a scroll range equal to the hidden text on the tiny 320x240 root", () => {
		const chapter = AC04Story.find((c) => c.id === "ac04-i08")!, texts = chapter.beats.map((b) => b.text);
		const layout = getAC04CaptionLayout(320, 240, texts, 3, measure);
		expect(layout.scrollable).toBe(true);
		expect(layout.textHeight - layout.captionHeight).toBeGreaterThan(0);
		expect(layout.sceneHeight).toBeGreaterThanOrEqual(72);
	});
});
