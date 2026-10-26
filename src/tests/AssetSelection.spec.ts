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
	it("fits the pilot Kestrel import (28x too large) to the procedural Kestrel's in-game size", () => {
		// Live Model import of kestrel.fbx exported at 0.28 m per stud: Roblox read FBX centimetres as studs.
		const imported = [644, 172, 754.6];
		const inGame = [22.1892, 5.9265, 26]; // UploadedAssetSpecs.Kestrel.size: authored 23 x 6.143 x 26.95 at gameScale 0.96475
		const scale = AssetSelection.FitScale(imported, inGame) as number;
		expect(math.abs(scale - 26 / 754.6) < 1e-6).toBe(true);
		expect(math.abs(imported[0] * scale - 22.1892) < 0.05).toBe(true);
		expect(math.abs(imported[1] * scale - 5.9265) < 0.05).toBe(true);
		expect(math.abs(imported[2] * scale - 26) < 1e-6).toBe(true);
		// The coordinator's trial ScaleTo(0.07) result (45 x 12 x 52.8) is fitted down the same way.
		expect(math.abs((AssetSelection.FitScale([45.08, 12.04, 52.82], inGame) as number) * 52.82 - 26) < 1e-6).toBe(true);
	});
	it("leaves a correctly sized import alone and fits world props to their authored size", () => {
		// A 0.01 m-per-stud export arrives at its authored size: world props keep it (gameScale 1).
		expect(AssetSelection.FitScale([61.5, 49, 76], [61.5, 49, 76])).toBe(1);
		expect(AssetSelection.FitScale([61.0, 48.6, 75.4], [61.5, 49, 76])).toBe(1);
		expect(math.abs((AssetSelection.FitScale([1722, 1372, 2128], [61.5, 49, 76]) as number) - 1 / 28) < 1e-9).toBe(true);
		// Aircraft authored a little larger than the procedural jet are shrunk to it.
		expect(math.abs((AssetSelection.FitScale([24.76, 8.02, 27.75], [23.5555, 7.6298, 26.4]) as number) - 26.4 / 27.75) < 1e-9).toBe(true);
	});
	it("rejects absurd ratios and imports whose proportions do not match", () => {
		expect(AssetSelection.FitScale([0, 0, 0], [23, 6, 27])).toBeUndefined();
		expect(AssetSelection.FitScale([0.001, 0.001, 0.0001], [23, 6, 27])).toBeUndefined();
		expect(AssetSelection.FitScale([math.huge, 1, 1], [23, 6, 27])).toBeUndefined();
		expect(AssetSelection.FitScale([23, 6], [23, 6, 27])).toBeUndefined();
		// Swapped axes (span along Z) and a model that lost its wings.
		expect(AssetSelection.FitScale([754.6, 172, 644], [22.1892, 5.9265, 26])).toBeUndefined();
		expect(AssetSelection.FitScale([120, 172, 754.6], [22.1892, 5.9265, 26])).toBeUndefined();
	});
	it("accepts an import only when every part is a MeshPart with a textured SurfaceAppearance", () => {
		const part = (name: string, meshPart = true, appearance = true, colorMap = true) => ({ name, meshPart, appearance, colorMap });
		const kestrel = ["Aileron_L", "Aileron_R", "Elevator_L", "Elevator_R", "Rudder_L", "Rudder_R"];
		const required = ["Body", ...kestrel];
		const pilot = [part("Body"), ...kestrel.map((name) => part(name))];
		expect(AssetSelection.AppearanceProblem(pilot, required)).toBeUndefined();
		expect(AssetSelection.AppearanceProblem([part("barn")])).toBeUndefined();
		expect(AssetSelection.AppearanceProblem([])).toBe("contains no parts");
		expect(AssetSelection.AppearanceProblem([part("Body"), part("Aileron_L", true, false)], ["Body"])).toBe("Aileron_L has no SurfaceAppearance");
		expect(AssetSelection.AppearanceProblem([part("Body", true, true, false)])).toBe("Body SurfaceAppearance has no ColorMap");
		expect(AssetSelection.AppearanceProblem([part("Hull", false)])).toBe("Hull is not a MeshPart");
		expect(AssetSelection.AppearanceProblem(pilot.filter((p) => p.name !== "Rudder_R"), required)).toBe("missing part Rudder_R");
	});
	it("lists an aircraft's control surfaces in a stable order", () => {
		const names = AssetSelection.ControlSurfaceNames({ Rudder: 1, Aileron_R: 1, Aileron_L: 1 });
		expect(names.size()).toBe(3);
		expect(names[0]).toBe("Aileron_L");
		expect(names[1]).toBe("Aileron_R");
		expect(names[2]).toBe("Rudder");
		expect(AssetSelection.ControlSurfaceNames(undefined).size()).toBe(0);
	});
});
