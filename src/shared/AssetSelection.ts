// Pure decisions for the uploaded-asset loaders: which asset ID (if any) to try,
// which ace livery an enemy gets and how far to rescale an imported model.
// No Roblox services here, so the offline Luau runner can execute it.

export type AceLivery = "Vulture" | "Rusk";
export type AircraftAssetName = "Kestrel" | "Vanta" | "VantaVulture" | "VantaRusk";

/** RGB 0-255 replacements for procedural Vanta material roles when an ace livery has no uploaded model. */
export interface ProceduralTint {
	White: [number, number, number];
	Navy: [number, number, number];
	Cyan: [number, number, number];
}

const TINTS: Record<AceLivery, ProceduralTint> = {
	Vulture: { White: [34, 36, 40], Navy: [20, 21, 23], Cyan: [198, 190, 169] },
	Rusk: { White: [72, 28, 31], Navy: [42, 44, 48], Cyan: [168, 135, 62] },
};

export const AssetSelection = {
	/** A usable Roblox asset ID: a positive whole number. */
	IsAssetId(value: unknown): value is number {
		return typeIs(value, "number") && value > 0 && value % 1 === 0 && value < math.huge;
	},
	/**
	 * The first candidate with a usable ID that has not already failed to load,
	 * or undefined to use the procedural path.
	 */
	Resolve<K extends string>(ids: Partial<Record<K, number | undefined>>, candidates: K[], failed: ReadonlySet<number>): { name: K; assetId: number } | undefined {
		for (const name of candidates) {
			const assetId = ids[name];
			if (AssetSelection.IsAssetId(assetId) && !failed.has(assetId)) return { name, assetId };
		}
		return undefined;
	},
	/** Ace liveries fall back to the plain uploaded Vanta, then to procedural geometry. */
	AircraftCandidates(enemy: boolean, livery?: AceLivery): AircraftAssetName[] {
		if (!enemy) return ["Kestrel"];
		if (livery === "Vulture") return ["VantaVulture", "Vanta"];
		if (livery === "Rusk") return ["VantaRusk", "Vanta"];
		return ["Vanta"];
	},
	/** Campaign ace names map to a livery: Vulture flight or Air Marshal Rusk. */
	LiveryForAce(aceName: string | undefined): AceLivery | undefined {
		if (aceName === undefined) return undefined;
		const upper = aceName.upper();
		if (upper.find("RUSK", 1, true)[0] !== undefined || upper.find("MARSHAL", 1, true)[0] !== undefined) return "Rusk";
		if (upper.find("VULTURE", 1, true)[0] !== undefined) return "Vulture";
		return undefined;
	},
	ProceduralTint(livery: AceLivery): ProceduralTint {
		return TINTS[livery];
	},
	/**
	 * Uniform scale that makes an imported model's longest side match the
	 * authored size. FBX unit handling differs between import routes; anything
	 * within 2% is left alone and absurd ratios are rejected (returns undefined).
	 */
	FitScale(actualLongest: number, expectedLongest: number): number | undefined {
		if (!(actualLongest > 0) || !(expectedLongest > 0)) return undefined;
		const ratio = expectedLongest / actualLongest;
		if (ratio > 0.98 && ratio < 1.02) return 1;
		if (ratio < 0.001 || ratio > 1000) return undefined;
		return ratio;
	},
};
