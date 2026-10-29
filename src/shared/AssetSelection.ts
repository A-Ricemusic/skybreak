// Pure decisions for the uploaded-asset loaders: which asset ID (if any) to try,
// which ace livery an enemy gets, how far to rescale an imported model and
// whether its parts kept their textures.
// No Roblox services here, so the offline Luau runner can execute it.

export type AceLivery = "Vulture" | "Rusk";
export type AircraftAssetName = "Kestrel" | "Vanta" | "VantaVulture" | "VantaRusk" | "KestrelV2" | "VantaV2" | "VantaV2Vulture" | "VantaV2Rusk";

/**
 * Part Transparency for glass parts (the v2 Canopy) so the cockpit shows through.
 * The previews only approximate it: tools/assets/skyasset.py glass_preview renders
 * glass at material alpha 0.60 (0.40 transparent); the FBX material stays opaque.
 */
export const GLASS_TRANSPARENCY = 0.45;

/** RGB 0-255 replacements for procedural Vanta material roles when an ace livery has no uploaded model. */
export interface ProceduralTint {
	White: [number, number, number];
	Navy: [number, number, number];
	Cyan: [number, number, number];
}

/**
 * The SurfaceAppearance maps every uploaded MeshPart must keep. Every folder in
 * assets/roblox-upload bakes all four into one atlas material, and the v2
 * Canopy uses that same material (its glass is a zone of the atlas; the loader
 * adds the see-through Transparency), so no part is exempt.
 */
export const SURFACE_MAPS = ["ColorMap", "NormalMap", "RoughnessMap", "MetalnessMap"] as const;
export type SurfaceMap = (typeof SURFACE_MAPS)[number];

/** What the loader saw on one imported BasePart. */
export interface ImportedPart {
	name: string;
	meshPart: boolean;
	/** Has a SurfaceAppearance child. */
	appearance: boolean;
	/** The maps that SurfaceAppearance carries (absent means none). */
	maps: Partial<Record<SurfaceMap, boolean>>;
}

const TINTS: Record<AceLivery, ProceduralTint> = {
	Vulture: { White: [34, 36, 40], Navy: [20, 21, 23], Cyan: [198, 190, 169] },
	Rusk: { White: [72, 28, 31], Navy: [42, 44, 48], Cyan: [168, 135, 62] },
};

export const AssetSelection = {
	/** Future approved heavy bomber export contract: aircraft kind and folder heavy-bomber.
	 * No invented spec/ID; use the normal loader when the generated manifest gains it. */
	BomberCandidates<K extends string>(specs: Record<K, { kind: string; folder: string }>): K[] {
		const names: K[] = [];
		for (const [name, spec] of pairs(specs as Record<string, { kind: string; folder: string }>)) {
			if (spec.kind === "aircraft" && spec.folder === "heavy-bomber") names.push(name as K);
		}
		table.sort(names);
		return names;
	},
	/** Future approved carrier export contract. No generated spec or ID exists yet. */
	CarrierCandidates<K extends string>(specs: Record<K, { kind: string; folder: string }>): K[] {
		const names: K[] = [];
		for (const [name, spec] of pairs(specs as Record<string, { kind: string; folder: string }>)) {
			if (spec.kind === "world" && spec.folder === "carrier") names.push(name as K);
		}
		table.sort(names);
		return names;
	},
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
	/**
	 * Uploaded models to try in order; undefined IDs are skipped and an empty result
	 * means procedural geometry. Version 2 is preferred over v1. An ace keeps its
	 * livery first (v2 then v1, so the ace stays recognisable), then the plain Vanta
	 * (v2 then v1), then the procedural Vanta with a livery tint.
	 */
	AircraftCandidates(enemy: boolean, livery?: AceLivery): AircraftAssetName[] {
		if (!enemy) return ["KestrelV2", "Kestrel"];
		if (livery === "Vulture") return ["VantaV2Vulture", "VantaVulture", "VantaV2", "Vanta"];
		if (livery === "Rusk") return ["VantaV2Rusk", "VantaRusk", "VantaV2", "Vanta"];
		return ["VantaV2", "Vanta"];
	},
	/** Transparency for an imported part: glass parts are see-through, everything else keeps its own. */
	PartTransparency(partName: string, glassParts: readonly string[] | undefined): number | undefined {
		if (glassParts === undefined) return undefined;
		return glassParts.includes(partName) ? GLASS_TRANSPARENCY : undefined;
	},
	/** Spawn-name overrides take precedence; current campaign aces fall back to their blueprint name. */
	LiveryForAce(aceName: string | undefined, blueprintAceName?: string): AceLivery | undefined {
		const resolvedName = aceName ?? blueprintAceName;
		if (resolvedName === undefined) return undefined;
		const upper = resolvedName.upper();
		if (upper.find("RUSK", 1, true)[0] !== undefined || upper.find("MARSHAL", 1, true)[0] !== undefined) return "Rusk";
		if (upper.find("VULTURE", 1, true)[0] !== undefined) return "Vulture";
		return undefined;
	},
	ProceduralTint(livery: AceLivery): ProceduralTint {
		return TINTS[livery];
	},
	/**
	 * Uniform scale that makes an imported model's longest side match the in-game
	 * size. Roblox's Model import reads FBX centimetres as studs, so an export at
	 * 0.28 m per stud arrives 28x too large and one at 0.01 m per stud arrives at
	 * size; either is fitted here. Within 2% is left alone. Returns undefined for
	 * non-positive or non-finite dimensions, an absurd ratio or when the
	 * proportions do not match the authored model
	 * (each axis within 5% of the longest side after scaling): a wrong asset, lost
	 * pieces or swapped axes fall back instead of loading misshapen.
	 */
	FitScale(actual: readonly number[], expected: readonly number[]): number | undefined {
		if (actual.size() !== 3 || expected.size() !== 3) return undefined;
		for (const dimensions of [actual, expected]) {
			for (const value of dimensions) if (!(value > 0 && value < math.huge)) return undefined;
		}
		const actualLongest = math.max(actual[0], actual[1], actual[2]);
		const expectedLongest = math.max(expected[0], expected[1], expected[2]);
		const ratio = expectedLongest / actualLongest;
		if (ratio < 0.001 || ratio > 1000) return undefined;
		for (const axis of [0, 1, 2]) {
			if (math.abs(actual[axis] * ratio - expected[axis]) > expectedLongest * 0.05) return undefined;
		}
		return ratio > 0.98 && ratio < 1.02 ? 1 : ratio;
	},
	/** Names of the separately pivoted control-surface parts an aircraft spec authors. */
	ControlSurfaceNames(surfaces: Record<string, unknown> | undefined): string[] {
		const names: string[] = [];
		if (surfaces !== undefined) for (const [name] of pairs(surfaces)) names.push(name);
		table.sort(names);
		return names;
	},
	/**
	 * Part names an uploaded aircraft must contain, exactly: Body, every authored
	 * control surface and every glass part (the v2 Canopy). The bounds check cannot
	 * catch a lost canopy (it sits inside the body's bounds), so names are checked.
	 */
	RequiredAircraftParts(surfaces: Record<string, unknown> | undefined, glassParts: readonly string[] | undefined): string[] {
		return ["Body", ...AssetSelection.ControlSurfaceNames(surfaces), ...(glassParts ?? [])];
	},
	/**
	 * Whether an imported model's parts carry the textures the FBX embedded. The
	 * Model import gives every MeshPart a SurfaceAppearance with all four maps
	 * (SURFACE_MAPS); a part without one renders as bare grey geometry and one
	 * missing a map loses its relief, gloss or metal, so the whole model falls
	 * back. Returns the first problem, or undefined when the model is usable.
	 * `required` lists part names that must exist (RequiredAircraftParts).
	 */
	AppearanceProblem(parts: readonly ImportedPart[], required: readonly string[] = []): string | undefined {
		if (parts.size() === 0) return "contains no parts";
		for (const part of parts) {
			if (!part.meshPart) return `${part.name} is not a MeshPart`;
			if (!part.appearance) return `${part.name} has no SurfaceAppearance`;
			for (const map of SURFACE_MAPS) {
				if (part.maps[map] !== true) return `${part.name} SurfaceAppearance has no ${map}`;
			}
		}
		for (const name of required) {
			if (parts.find((part) => part.name === name) === undefined) return `missing part ${name}`;
		}
		return undefined;
	},
};
