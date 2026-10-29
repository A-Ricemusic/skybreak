import { describe, expect, it } from "@rbxts/jest-globals";
import { AssetSelection } from "../shared/AssetSelection";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssetSpecs, UploadedAssetName } from "../shared/UploadedAssetSpecs";
import { UploadedAssetOrientation } from "../shared/UploadedAssetOrientation";

// Pure contracts run by offline Luau and Roblox Jest; no asset downloads.
describe("dormant mission 4–5 assets", () => {
	it("resolves every dedicated candidate to its approved ID", () => {
		const groups: [UploadedAssetName[], UploadedAssetName, number][] = [
			[AssetSelection.TransportCandidates(UploadedAssetSpecs), "HeavyTransport", 135095912449793],
			[AssetSelection.JammerCandidates(UploadedAssetSpecs), "RadarJammer", 80069408823339],
			[AssetSelection.TankerCandidates(UploadedAssetSpecs), "FuelTanker", 83861380699092],
			[AssetSelection.HelicopterCandidates(UploadedAssetSpecs), "AttackHelicopter", 80747426523090],
			[AssetSelection.AircraftCandidates(true, "Elite"), "VantaV2Elite", 139083376207373],
		];
		for (const [candidates, name, id] of groups) {
			expect(candidates[0]).toBe(name);
			expect(RobloxAssetIds[name]).toBe(id);
			expect(AssetSelection.Resolve(RobloxAssetIds, candidates, new Set<number>())?.assetId).toBe(id);
			const offsets = UploadedAssetOrientation[name]!;
			expect(offsets.yaw + offsets.pitch + offsets.roll).toBe(0);
		}
	});
	it("keeps the tanker a world hull and retains helicopter hubs and axes", () => {
		expect(UploadedAssetSpecs.FuelTanker.kind).toBe("world");
		expect(UploadedAssetSpecs.FuelTanker.groundOffset).toBe(16);
		const spec = UploadedAssetSpecs.AttackHelicopter;
		const required = AssetSelection.RequiredAircraftParts(spec.controlSurfaces, spec.glassParts, spec.rotors);
		expect(required.includes("MainRotor")).toBe(true);
		expect(required.includes("TailRotor")).toBe(true);
		expect(spec.rotors!.MainRotor.axis.Y).toBe(1);
		expect(spec.rotors!.TailRotor.axis.X).toBe(1);
		expect(spec.rotors!.TailRotor.hub.X < 0).toBe(true);
		const parts = required.map((name) => ({ name, meshPart: true, appearance: true, maps: { ColorMap: true, NormalMap: true, RoughnessMap: true, MetalnessMap: true } }));
		expect(AssetSelection.AppearanceProblem(parts, required)).toBeUndefined();
	});
	it("only selects elite paint by explicit opt in", () => {
		expect(AssetSelection.AircraftCandidates(false).includes("VantaV2Elite")).toBe(false);
		expect(AssetSelection.AircraftCandidates(true).includes("VantaV2Elite")).toBe(false);
		expect(AssetSelection.AircraftCandidates(true, "Vulture").includes("VantaV2Elite")).toBe(false);
		expect(AssetSelection.AircraftCandidates(true, "Rusk").includes("VantaV2Elite")).toBe(false);
	});
});
