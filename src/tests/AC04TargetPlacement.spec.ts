import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04PlacementRevision, ac04FreeArrow, ac04ViewportPlacement } from "../shared/ac04/ui/AC04TargetPlacement";
import { ac04HudKeepouts, ac04HudLayout } from "../shared/ac04/ui/AC04HudLayout";
import { TargetBoxes } from "../shared/TargetBoxes";
import { GuiService, Players } from "@rbxts/services";

describe("AC04 target placement", () => {
	it("converts a nonzero root origin once and clips the safe rectangle", () => {
		const p = ac04ViewportPlacement([{ x: 10, y: 20, width: 50, height: 60 }], 17, 58, 390, 700, 844, 844);
		expect(p.keepouts[0]).toEqual({ x: 23, y: 74, width: 58, height: 68 });
		expect(p.bounds).toEqual({ x: 21, y: 62, width: 382, height: 692 });
		expect(TargetBoxes.Fits(40, 90, 24, p.bounds, p.keepouts)).toBe(false);
		expect(TargetBoxes.Fits(220, 350, 24, p.bounds, p.keepouts)).toBe(true);
	});
	it("invalidates movement, size, rotation and lifecycle reset", () => {
		const c = new AC04PlacementRevision();
		expect(c.Changed(0, 58, 390, 786, 390, 844)).toBe(true);
		expect(c.Changed(0, 58, 390, 786, 390, 844)).toBe(false);
		expect(c.Changed(0, 36, 390, 786, 390, 844)).toBe(true);
		expect(c.Changed(0, 36, 390, 808, 390, 844)).toBe(true);
		expect(c.Changed(0, 36, 844, 354, 844, 390)).toBe(true);
		c.Clear(); expect(c.Changed(0, 36, 844, 354, 844, 390)).toBe(true);
	});
	it("reserves instruments, rearm and every input control", () => {
		for (const mode of ["keyboard", "touch", "gamepad"] as const) {
			const h = ac04HudLayout(844, 390, mode), rects = ac04HudKeepouts(h);
			for (const r of [h.rearm, h.radar, h.stores, h.speed, h.altitude, h.heading, h.notice, h.alert]) expect(rects.includes(r)).toBe(true);
			if (h.actions) for (const key of ["target", "missile", "gun", "special", "evade", "rearm"] as const) expect(rects.includes(h.actions[key])).toBe(true);
		}
	});
	it("retains a clear directional cue beside blocked controls without relocating a bracket", () => {
		const bounds = TargetBoxes.Bounds(390, 844), keepouts = [{ x: 0, y: 600, width: 390, height: 244 }];
		expect(TargetBoxes.Fits(195, 740, 24, bounds, keepouts)).toBe(false);
		const arrow = ac04FreeArrow(195, 740, bounds, keepouts);
		expect(arrow).toBeDefined();
		expect(TargetBoxes.Fits(arrow![0], arrow![1], 28, bounds, keepouts)).toBe(true);
		expect(ac04FreeArrow(20, 20, bounds, [bounds])).toBeUndefined();
	});
	it("keeps protected TRACK/HOLD and required tags independent of placement", () => {
		expect(TargetBoxes.Selected(false, true, 1).caption).toBe("track");
		expect(TargetBoxes.Selected(false, true, 0).caption).toBe("hold");
		expect(TargetBoxes.Selected(false, true, 1).locked).toBe(false);
		expect(TargetBoxes.Tone({ enemy: true, owner: 42, required: true, damageable: false }, 42)).toBeUndefined();
		expect(TargetBoxes.Tone({ enemy: true, owner: 42, required: true, damageable: true }, 42)).toBe("required");
	});
	it("uses native GUI origin plus exactly one engine inset", () => {
		const gui = new Instance("ScreenGui"); gui.IgnoreGuiInset = false;
		const root = new Instance("Frame"); root.Position = UDim2.fromOffset(17, 23); root.Size = UDim2.fromOffset(390, 700); root.Parent = gui;
		gui.Parent = Players.LocalPlayer?.FindFirstChildOfClass("PlayerGui");
		const [inset] = GuiService.GetGuiInset();
		const origin = root.AbsolutePosition.add(inset);
		const placed = ac04ViewportPlacement([{ x: 10, y: 20, width: 50, height: 60 }], origin.X, origin.Y, 390, 700, 1280, 844);
		expect(placed.keepouts[0].y).toBe(root.AbsolutePosition.Y + inset.Y + 16);
		gui.Destroy();
	});
});
