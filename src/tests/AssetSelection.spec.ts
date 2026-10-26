import { describe, expect, it } from "@rbxts/jest-globals";
import { AssetSelection } from "../shared/AssetSelection";

// Pure rules shared by the Roblox Jest run and the offline Luau runner (toBe / toBeUndefined only).
describe("AssetSelection uploaded-asset decisions", () => {
	it("accepts only positive whole-number asset IDs", () => {
		expect(AssetSelection.IsAssetId(123456789)).toBe(true);
		expect(AssetSelection.IsAssetId(undefined)).toBe(false);
		expect(AssetSelection.IsAssetId(0)).toBe(false);
		expect(AssetSelection.IsAssetId(-5)).toBe(false);
		expect(AssetSelection.IsAssetId(12.5)).toBe(false);
		expect(AssetSelection.IsAssetId(0 / 0)).toBe(false);
		expect(AssetSelection.IsAssetId(math.huge)).toBe(false);
		expect(AssetSelection.IsAssetId("123")).toBe(false);
	});
	it("uses the procedural path while every ID is undefined", () => {
		const ids: Partial<Record<"Kestrel" | "Vanta", number | undefined>> = { Kestrel: undefined, Vanta: undefined };
		expect(AssetSelection.Resolve(ids, ["Kestrel"], new Set())).toBeUndefined();
		expect(AssetSelection.Resolve(ids, ["Vanta"], new Set())).toBeUndefined();
	});
	it("picks the first usable candidate and skips IDs that already failed", () => {
		const ids = { VantaRusk: 30, Vanta: 20 };
		expect(AssetSelection.Resolve(ids, ["VantaRusk", "Vanta"], new Set())?.name).toBe("VantaRusk");
		expect(AssetSelection.Resolve(ids, ["VantaRusk", "Vanta"], new Set([30]))?.assetId).toBe(20);
		expect(AssetSelection.Resolve(ids, ["VantaRusk", "Vanta"], new Set([30, 20]))).toBeUndefined();
		expect(AssetSelection.Resolve({ Vanta: 20 }, ["VantaVulture", "Vanta"], new Set())?.name).toBe("Vanta");
	});
	it("maps campaign aces to liveries and falls back to the plain Vanta", () => {
		expect(AssetSelection.LiveryForAce("VULTURE LEAD")).toBe("Vulture");
		expect(AssetSelection.LiveryForAce("VULTURE TWO")).toBe("Vulture");
		expect(AssetSelection.LiveryForAce("AIR MARSHAL RUSK")).toBe("Rusk");
		expect(AssetSelection.LiveryForAce("ACE")).toBeUndefined();
		expect(AssetSelection.LiveryForAce(undefined)).toBeUndefined();
		const rusk = AssetSelection.AircraftCandidates(true, "Rusk");
		expect(rusk.size()).toBe(2);
		expect(rusk[0]).toBe("VantaRusk");
		expect(rusk[1]).toBe("Vanta");
		expect(AssetSelection.AircraftCandidates(true, "Vulture")[0]).toBe("VantaVulture");
		expect(AssetSelection.AircraftCandidates(true)[0]).toBe("Vanta");
		expect(AssetSelection.AircraftCandidates(false, "Rusk")[0]).toBe("Kestrel");
	});
	it("rescales imported models to the authored size and rejects absurd ratios", () => {
		expect(AssetSelection.FitScale(26.95, 26.95)).toBe(1);
		expect(AssetSelection.FitScale(26.6, 26.95)).toBe(1);
		expect(AssetSelection.FitScale(7.546, 26.95) !== undefined && math.abs((AssetSelection.FitScale(7.546, 26.95) as number) - 3.5714) < 0.001).toBe(true);
		expect(AssetSelection.FitScale(0, 26.95)).toBeUndefined();
		expect(AssetSelection.FitScale(0.0001, 26.95)).toBeUndefined();
	});
});
