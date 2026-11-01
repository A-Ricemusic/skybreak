import { describe, expect, it } from "@rbxts/jest-globals";
import { TerrainWriteState } from "../shared/TerrainWriteState";

// Test the dirty-state contract without destructive native Terrain:Clear() calls.
describe("Terrain write state", () => {
	it("clears only dirty terrain without invoking a native clear on the Jest thread", () => {
		let clears = 0;
		const terrain = new TerrainWriteState(() => { clears++; });
		terrain.BeginWrite();
		expect(clears).toBe(1); expect(terrain.Dirty()).toBe(true);
		terrain.MarkClean();
		terrain.ClearIfDirty();
		expect(clears).toBe(1);
		terrain.BeginWrite();
		expect(terrain.Dirty()).toBe(true); expect(clears).toBe(1);
		terrain.ClearIfDirty(); terrain.ClearIfDirty();
		expect(terrain.Dirty()).toBe(false); expect(clears).toBe(2);
	});
	it("keeps terrain dirty if its clear fails so recovery retries", () => {
		let fail = true, clears = 0;
		const terrain = new TerrainWriteState(() => { clears++; if (fail) error("expected clear failure"); });
		const [ok] = pcall(() => terrain.ClearIfDirty());
		expect(ok).toBe(false);
		expect(terrain.Dirty()).toBe(true);
		fail = false; terrain.ClearIfDirty();
		expect(terrain.Dirty()).toBe(false); expect(clears).toBe(2);
	});
});
