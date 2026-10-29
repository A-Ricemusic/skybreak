import { describe, expect, it } from "@rbxts/jest-globals";
import { RADAR_GLYPHS, RADAR_LAYER, RADAR_NEAR_RANGE, RADAR_RANGE, RADAR_RIM_INSET, radarHeadingDegrees, radarProject, radarRange, type RadarContactKind } from "../shared/RadarMath";

const close = (actual: number, expected: number) => expect(math.abs(actual - expected)).toBeLessThan(0.0001);

describe("heading-up radar projection", () => {
	it("puts a contact dead ahead at the top of the disc for every heading", () => {
		for (const yaw of [0, math.pi / 2, math.pi, -math.pi / 2, 1.1]) {
			// FlightMath forward is (-sin yaw, 0, -cos yaw).
			const ahead = radarProject(-math.sin(yaw) * 1000, -math.cos(yaw) * 1000, yaw, 2000, 55);
			close(ahead.x, 0);
			expect(ahead.y).toBeLessThan(0);
			close(ahead.y, -(55 - RADAR_RIM_INSET) / 2);
			expect(ahead.edge).toBe(false);
		}
	});
	it("puts the right wing on the right and the tail at the bottom", () => {
		// Heading north (yaw 0): world +X is to the right, +Z is behind.
		const right = radarProject(500, 0, 0, 1000, 55);
		expect(right.x).toBeGreaterThan(0);
		close(right.y, 0);
		const behind = radarProject(0, 500, 0, 1000, 55);
		close(behind.x, 0);
		expect(behind.y).toBeGreaterThan(0);
		// Turned to face west (yaw +90°: forward -X), north (-Z) is now on the right.
		const north = radarProject(0, -500, math.pi / 2, 1000, 55);
		expect(north.x).toBeGreaterThan(0);
		close(north.y, 0);
	});
	it("pins contacts beyond the range to the rim in their direction", () => {
		const far = radarProject(9000, 0, 0, 3000, 55);
		expect(far.edge).toBe(true);
		close(far.x, 55 - RADAR_RIM_INSET);
		close(far.y, 0);
		const diagonal = radarProject(-9000, 9000, 0, 3000, 55);
		close(math.sqrt(diagonal.x * diagonal.x + diagonal.y * diagonal.y), 55 - RADAR_RIM_INSET);
		expect(diagonal.x).toBeLessThan(0);
		expect(diagonal.y).toBeGreaterThan(0);
	});
	it("reports the nose heading in compass degrees", () => {
		close(radarHeadingDegrees(0), 0);
		close(radarHeadingDegrees(-math.pi / 2), 90);
		close(radarHeadingDegrees(math.pi / 2), 270);
	});
	it("zooms in only while every required contact and the objective are close", () => {
		expect(radarRange(0, 0, [])).toBe(RADAR_RANGE);
		expect(radarRange(0, 0, [{ kind: "required", x: 800, z: 0 }, { kind: "objective", x: 0, z: -900 }])).toBe(RADAR_NEAR_RANGE);
		expect(radarRange(0, 0, [{ kind: "required", x: 800, z: 0 }, { kind: "ground", x: 0, z: 2400 }])).toBe(RADAR_RANGE);
		// Raiders and missiles never force the wide range.
		expect(radarRange(100, 100, [{ kind: "required", x: 600, z: 100 }, { kind: "optional", x: 3000, z: 0 }, { kind: "missile", x: -2500, z: 0 }])).toBe(RADAR_NEAR_RANGE);
	});
	it("gives every contact kind a glyph and draws missiles on top", () => {
		const kinds: RadarContactKind[] = ["friendly", "required", "optional", "ground", "groundOptional", "objective", "protected", "missile"];
		for (const kind of kinds) {
			expect(RADAR_GLYPHS[kind].size() > 0).toBe(true);
			expect(RADAR_LAYER[kind]).toBeLessThanOrEqual(RADAR_LAYER.missile);
		}
		expect(RADAR_GLYPHS.required).never.toBe(RADAR_GLYPHS.optional);
		expect(RADAR_GLYPHS.friendly).toBe("+");
		expect(RADAR_LAYER.friendly).never.toBe(RADAR_LAYER.protected);
	});
});
