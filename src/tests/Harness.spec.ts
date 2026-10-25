import { describe, expect, it } from "@rbxts/jest-globals";
import { RunService, ServerStorage } from "@rbxts/services";

describe("Roblox integration test isolation", () => {
	it("runs inside Studio against the dedicated test place", () => {
		expect(RunService.IsStudio()).toBe(true);
		expect(game.Workspace.GetAttribute("SkybreakTestMode")).toBe(true);
	});
	it("keeps test modules in server-only storage", () => {
		expect(script.IsDescendantOf(ServerStorage)).toBe(true);
	});
});
