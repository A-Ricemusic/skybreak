import { describe, expect, it } from "@rbxts/jest-globals";
import { AssetSelection, GLASS_TRANSPARENCY, SURFACE_MAPS, SurfaceMap } from "../shared/AssetSelection";

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
		expect(rusk.size()).toBe(4);
		expect(rusk[0]).toBe("VantaV2Rusk");
		expect(rusk[1]).toBe("VantaRusk");
		expect(rusk[2]).toBe("VantaV2");
		expect(rusk[3]).toBe("Vanta");
		const vulture = AssetSelection.AircraftCandidates(true, "Vulture");
		expect(vulture[0]).toBe("VantaV2Vulture");
		expect(vulture[1]).toBe("VantaVulture");
		expect(vulture[2]).toBe("VantaV2");
		expect(AssetSelection.AircraftCandidates(true)[0]).toBe("VantaV2");
		expect(AssetSelection.AircraftCandidates(true)[1]).toBe("Vanta");
		expect(AssetSelection.AircraftCandidates(false, "Rusk")[0]).toBe("KestrelV2");
		expect(AssetSelection.AircraftCandidates(false)[1]).toBe("Kestrel");
	});
	it("prefers a v2 aircraft ID, falls back to v1, then to procedural geometry", () => {
		const kestrel = AssetSelection.AircraftCandidates(false);
		expect(AssetSelection.Resolve({ Kestrel: 10, KestrelV2: 11 }, kestrel, new Set())?.name).toBe("KestrelV2");
		expect(AssetSelection.Resolve({ Kestrel: 10, KestrelV2: undefined }, kestrel, new Set())?.name).toBe("Kestrel");
		// A v2 upload that failed to load (moderated, untextured, misshapen) falls back to v1.
		expect(AssetSelection.Resolve({ Kestrel: 10, KestrelV2: 11 }, kestrel, new Set([11]))?.assetId).toBe(10);
		expect(AssetSelection.Resolve({ Kestrel: undefined, KestrelV2: undefined }, kestrel, new Set())).toBeUndefined();
		const enemy = AssetSelection.AircraftCandidates(true);
		expect(AssetSelection.Resolve({ Vanta: 20, VantaV2: 21 }, enemy, new Set())?.name).toBe("VantaV2");
		expect(AssetSelection.Resolve({ Vanta: 20 }, enemy, new Set())?.name).toBe("Vanta");
		// An ace keeps a livery (v1) before switching to the plain v2 Vanta.
		const rusk = AssetSelection.AircraftCandidates(true, "Rusk");
		expect(AssetSelection.Resolve({ VantaRusk: 30, VantaV2: 21, Vanta: 20 }, rusk, new Set())?.name).toBe("VantaRusk");
		expect(AssetSelection.Resolve({ VantaV2Rusk: 31, VantaRusk: 30 }, rusk, new Set())?.name).toBe("VantaV2Rusk");
		expect(AssetSelection.Resolve({ VantaV2: 21, Vanta: 20 }, rusk, new Set())?.name).toBe("VantaV2");
	});
	it("makes only the authored glass parts see-through", () => {
		expect(AssetSelection.PartTransparency("Canopy", ["Canopy"])).toBe(GLASS_TRANSPARENCY);
		expect(GLASS_TRANSPARENCY > 0 && GLASS_TRANSPARENCY < 1).toBe(true);
		expect(AssetSelection.PartTransparency("Body", ["Canopy"])).toBeUndefined();
		expect(AssetSelection.PartTransparency("Canopy", undefined)).toBeUndefined();
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
	it("rejects non-finite dimensions on every actual and expected axis", () => {
		for (const invalid of [0 / 0, math.huge, -math.huge]) {
			for (const axis of [0, 1, 2]) {
				const dimensions = [23, 6, 27];
				dimensions[axis] = invalid;
				expect(AssetSelection.FitScale(dimensions, [23, 6, 27])).toBeUndefined();
				expect(AssetSelection.FitScale([23, 6, 27], dimensions)).toBeUndefined();
			}
		}
	});
	it("rejects non-positive dimensions even within the proportion tolerance", () => {
		for (const invalid of [0, -0.01]) {
			for (const axis of [0, 1, 2]) {
				const valid = [27, 27, 27];
				valid[axis] = 0.01;
				const dimensions = [...valid];
				dimensions[axis] = invalid;
				expect(AssetSelection.FitScale(dimensions, valid)).toBeUndefined();
				expect(AssetSelection.FitScale(valid, dimensions)).toBeUndefined();
				expect(AssetSelection.FitScale(valid, valid)).toBe(1);
			}
		}
	});
	it("accepts an import only when every part is a MeshPart with a textured SurfaceAppearance", () => {
		const all = { ColorMap: true, NormalMap: true, RoughnessMap: true, MetalnessMap: true };
		const part = (name: string, meshPart = true, appearance = true, colorMap = true) => ({ name, meshPart, appearance, maps: { ...all, ColorMap: colorMap } });
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
	it("requires all four SurfaceAppearance maps on every part, including control surfaces and the canopy", () => {
		const all = { ColorMap: true, NormalMap: true, RoughnessMap: true, MetalnessMap: true };
		const part = (name: string, maps: Partial<Record<SurfaceMap, boolean>> = all) => ({ name, meshPart: true, appearance: true, maps });
		expect(SURFACE_MAPS.size()).toBe(4);
		const names = AssetSelection.RequiredAircraftParts({ Rudder: 1, Aileron_L: 1 }, ["Canopy"]);
		expect(AssetSelection.AppearanceProblem(names.map((name) => part(name)), names)).toBeUndefined();
		for (const map of SURFACE_MAPS) {
			for (const lossy of ["Body", "Aileron_L", "Canopy"]) {
				const parts = names.map((name) => part(name, name === lossy ? { ...all, [map]: false } : all));
				expect(AssetSelection.AppearanceProblem(parts, names)).toBe(`${lossy} SurfaceAppearance has no ${map}`);
				// An unprobed (absent) map is missing too.
				const absent = names.map((name) => {
					if (name !== lossy) return part(name);
					const maps: Partial<Record<SurfaceMap, boolean>> = { ...all };
					maps[map] = undefined;
					return part(name, maps);
				});
				expect(AssetSelection.AppearanceProblem(absent, names)).toBe(`${lossy} SurfaceAppearance has no ${map}`);
			}
		}
		// Only ColorMap, as the pre-v2 rule checked, is no longer enough.
		expect(AssetSelection.AppearanceProblem([part("barn", { ColorMap: true })])).toBe("barn SurfaceAppearance has no NormalMap");
	});
	it("requires the v2 Canopy by exact name alongside Body and the control surfaces", () => {
		const all = { ColorMap: true, NormalMap: true, RoughnessMap: true, MetalnessMap: true };
		const part = (name: string) => ({ name, meshPart: true, appearance: true, maps: all });
		const surfaces = { Rudder: 1, Elevator_R: 1, Elevator_L: 1, Aileron_R: 1, Aileron_L: 1 };
		const required = AssetSelection.RequiredAircraftParts(surfaces, ["Canopy"]);
		expect(required.size()).toBe(7);
		expect(required[0]).toBe("Body");
		expect(required[1]).toBe("Aileron_L");
		expect(required[6]).toBe("Canopy");
		// v1 aircraft author no glass part, so only Body and the surfaces are required.
		expect(AssetSelection.RequiredAircraftParts(surfaces, undefined).size()).toBe(6);
		const complete = required.map(part);
		expect(AssetSelection.AppearanceProblem(complete, required)).toBeUndefined();
		const withoutCanopy = complete.filter((p) => p.name !== "Canopy");
		expect(AssetSelection.AppearanceProblem(withoutCanopy, required)).toBe("missing part Canopy");
		expect(AssetSelection.AppearanceProblem([...withoutCanopy, part("Canopy.001")], required)).toBe("missing part Canopy");
		expect(AssetSelection.AppearanceProblem([...withoutCanopy, part("canopy")], required)).toBe("missing part Canopy");
		expect(AssetSelection.AppearanceProblem(complete.filter((p) => p.name !== "Body"), required)).toBe("missing part Body");
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

// Future asset handoff is selected by manifest metadata, without changing fighter candidates.
describe("Bomber asset selection", () => {
	it("falls back without a bomber spec and discovers only the heavy-bomber aircraft folder", () => {
		expect(AssetSelection.BomberCandidates({ Kestrel: { kind: "aircraft", folder: "kestrel" } })).toEqual([]);
		const specs = { HeavyBomber: { kind: "aircraft", folder: "heavy-bomber" }, Prop: { kind: "world", folder: "heavy-bomber" } };
		const candidates = AssetSelection.BomberCandidates(specs);
		expect(candidates).toEqual(["HeavyBomber"]);
		expect(AssetSelection.Resolve({}, candidates, new Set())).toBeUndefined();
		expect(AssetSelection.Resolve({ HeavyBomber: 123 }, candidates, new Set())?.name).toBe("HeavyBomber");
		expect(AssetSelection.Resolve({ HeavyBomber: 123 }, candidates, new Set([123]))).toBeUndefined();
	});
});
