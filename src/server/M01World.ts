import { planProfiler } from "./PlanProfiler";
import { Lighting, Workspace } from "@rbxts/services";
import { AssetSelection } from "../shared/AssetSelection";
import { M01_CARRIER_MODEL, M01_CARRIER_PLACEMENT } from "../shared/M01CarrierPlan";
import { buildM01Plan, M01, M01_CLOUD_BASE, M01_FILL_CHUNK, M01_ENVIRONMENT, M01_WORLD_KEY } from "../shared/M01WorldPlan";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldAssets, type WorldAssetName } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";

const carrierFrame = () => new CFrame(M01_CARRIER_PLACEMENT.x, M01_CARRIER_PLACEMENT.y, M01_CARRIER_PLACEMENT.z)
	.mul(CFrame.Angles(0, math.rad(M01_CARRIER_PLACEMENT.headingDegrees), 0));

function carrierPart(model: Model, name: string, size: Vector3, offset: Vector3, color: Color3): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.CFrame = carrierFrame().mul(new CFrame(offset));
	part.Color = color;
	part.Material = Enum.Material.SmoothPlastic;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = false;
	part.CastShadow = false;
	part.Parent = model;
	return part;
}

/** Clearly labelled, non-physical placeholder used only until Carrier gains an approved ID. */
export function placeM01CarrierStandIn(parent: Instance): Model {
	const model = new Instance("Model");
	model.Name = "CarrierStandIn";
	model.SetAttribute("GeometrySource", "CarrierStandIn");
	model.SetAttribute("StandIn", true);
	const water = M01_CARRIER_MODEL.waterlineAboveKeel;
	const deck = M01_CARRIER_MODEL.deckAboveKeel - water;
	const top = M01_CARRIER_MODEL.size.y - water;
	carrierPart(model, "StandInHull", new Vector3(150, 52, 440), new Vector3(0, 6, 60), Color3.fromRGB(112, 123, 132));
	carrierPart(model, "StandInBow", new Vector3(104, 48, 120), new Vector3(0, 4, -220), Color3.fromRGB(112, 123, 132));
	carrierPart(model, "StandInDeck", new Vector3(M01_CARRIER_MODEL.size.x, 4, M01_CARRIER_MODEL.size.z), new Vector3(0, deck - 2, 0), Color3.fromRGB(64, 72, 78));
	// Facing the bow (-Z), +X is starboard.
	carrierPart(model, "StandInIslandStarboard", new Vector3(32, top - deck, 100), new Vector3(55, (top + deck) / 2, 45), Color3.fromRGB(139, 147, 154));
	model.WorldPivot = carrierFrame();
	model.Parent = parent;
	return model;
}

function placeM01Carrier(parent: Instance, candidates: WorldAssetName[]): Model {
	// The upload must be checked in Studio: if its bow imports at +Z, turn the model
	// and its model-space catapult points together by 180 degrees before cutover.
	for (const candidate of candidates) {
		const uploaded = WorldAssets.PlaceUploaded(candidate, parent, carrierFrame());
		if (uploaded !== undefined) return uploaded;
	}
	return placeM01CarrierStandIn(parent);
}

/** C2/cutover may call this explicitly by worldKey; no current mission calls it.
 * Caller owns Terrain clearing and mission-clock handoff. Returns only after all work.
 * No uploads: clones ONLY the existing approved library. Missing dressing is omitted.
 */
export const M01World = {
	Build(parent: Instance, seed = 101): { groundTargets: Model[] } {
		const start = os.clock();
		parent.SetAttribute("WorldBuildPhase", "plan");
		const profile = planProfiler(parent);
		const plan = buildM01Plan(seed, profile.checkpoint);
		profile.finish();
		parent.SetAttribute("WorldBuildPhase", "environment");
		const names = plan.props.map((p) => p.asset);
		const carrierAssets = AssetSelection.CarrierCandidates(UploadedAssetSpecs) as WorldAssetName[];
		WorldAssets.Start(names);
		WorldAssets.Start(carrierAssets);
		WorldEnvironment.ApplySpec(M01_ENVIRONMENT, M01_WORLD_KEY);
		Workspace.Terrain.SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(36, 59, 62));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Rock, Color3.fromRGB(51, 70, 87));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(161, 169, 163));
		const scene = new Instance("Folder");
		scene.Name = M01_WORLD_KEY;
		scene.Parent = parent;
		task.wait();
		parent.SetAttribute("WorldBuildPhase", "terrain");
		const terrain = TerrainWriter.Write(plan.ops, 0.008, M01_FILL_CHUNK);
		parent.SetAttribute("WorldTerrainReadySeconds", os.clock() - start);
		parent.SetAttribute("WorldTerrainLongest", terrain.longest);
	parent.SetAttribute("WorldTerrainLongestBatch", terrain.longestBatch);
		parent.SetAttribute("WorldTerrainJobs", terrain.jobs);
		task.wait();
		parent.SetAttribute("WorldBuildPhase", "dressing");
		for (let i = 0; i < plan.parts.size(); i++) {
			const p = plan.parts[i];
			Scenery.Part(scene, p.name, new Vector3(p.sx, p.sy, p.sz), new Vector3(p.x, p.y, p.z), Color3.fromRGB(...p.color), material(p.material), { flightSolid: p.solid, castShadow: false });
			if (i % 32 === 31) task.wait();
		}
		// Native Clouds has no altitude property. Sparse non-solid wisps locate the broken
		// lower layer at the reference 6000 ft; native Clouds remains the high overcast deck.
		for (let i = 0; i < 8; i++) Scenery.Part(scene, "High cloud wisp", new Vector3(1800, 96, 1200), new Vector3((i % 2) * 2800 - 1400, M01_CLOUD_BASE + 48, -4800 + math.floor(i / 2) * 2600), Color3.fromRGB(185, 199, 216), Enum.Material.SmoothPlastic, { shape: Enum.PartType.Ball, transparency: 0.9, flightSolid: false, castShadow: false });
		const rays = new Instance("SunRaysEffect");
		rays.Name = "M01SunRays";
		rays.Intensity = 0.06;
		rays.Spread = 0.8;
		rays.Parent = Lighting;
		// Do not block another 30 s on cold uploads. Missing templates are reported; D1 owns carrier.
		let missing = 0;
		for (let i = 0; i < plan.props.size(); i++) {
			const p = plan.props[i];
			if (WorldAssets.PlaceUploaded(p.asset, scene, new CFrame(p.x, p.y, p.z), p.scale) === undefined) missing++;
			if (i % 8 === 7) task.wait();
		}
		placeM01Carrier(scene, carrierAssets);
		const descendants = scene.GetDescendants().size();
		assert(descendants + 4 <= M01.budget.descendants, "M01 approved template descendants exceeded budget; do not select before re-audit");
		parent.SetAttribute("WorldPropsMissing", missing);
		parent.SetAttribute("WorldBuildPhase", "done");
		parent.SetAttribute("WorldBuildSeconds", os.clock() - start);
		parent.SetAttribute("Composition", plan.key);
		return { groundTargets: [] };
	},
};
