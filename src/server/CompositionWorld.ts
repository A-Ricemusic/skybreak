import { WorldBuildScheduler } from "./WorldBuildScheduler";
import { assertWorldInstanceBudget } from "./WorldInstanceBudget";
import { Workspace } from "@rbxts/services";
import type { EnvironmentSpec } from "../shared/EnvironmentPresets";
import type { PartSpec, PropSpec, TerrainOp } from "../shared/WorldPlan";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { WORLD_FILL_CHUNK, WORLD_TERRAIN_BUDGET } from "../shared/SealedWorldSurface";
import { clearTerrainIfDirty } from "./TerrainState";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldAssets, type WorldAssetName } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";
interface Contact { id: string; type: string; group: string; x: number; y: number; z: number; yaw: number }
interface Composition { key: string; ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]; targets: Contact[] }
/** Optional names become available when the independently owned asset manifest lands.
 * Do not mutate/generated-copy that manifest from another PR.
 */
const candidate = (t: Contact) => t.type === "frigate" || t.type === "destroyer" || t.type === "cruiser" || t.type === "missile_boat" ? "Frigate" : t.type === "supply_ship" || t.type === "landing_ship" || t.type === "container_ship" ? "FuelTanker" : t.type === "tanker" ? "FuelTanker" : t.type === "helicopter" ? "AttackHelicopter" : t.type === "transport" ? "HeavyTransport" : t.type === "jammer" ? "RadarJammer" : t.type === "ace" ? "VantaV2Elite" : t.type === "escort" ? "Vanta" : undefined;
function available(name: string): WorldAssetName | undefined {
 const key = name as WorldAssetName;
 return UploadedAssetSpecs[key] !== undefined ? key : undefined;
}
/**
 * The M04/M05 world clear, run by the world gate in its own thread, for a finished or a partly built world.
 * Measured in Studio Play: Air-filling M04's shell in bounded jobs took 14 s and the native clear that still had
 * to follow took 8 s more (an Air-filled extent stays allocated), so one native Terrain:Clear() is the cheapest
 * correct clear; the floorless shell (SealedWorldSurface) keeps it about 8-12 s. A native call cannot stop
 * part-way, so `cancelled` only skips a clear that has not started.
 */
export function compositionClear(cancelled: () => boolean): void {
 if (!cancelled()) clearTerrainIfDirty();
}
export function buildComposition(parent: Instance, environment: EnvironmentSpec, makePlan: (checkpoint: () => void) => Composition, descendantLimit: number, cloudFeet: number, terrainBudget = WORLD_TERRAIN_BUDGET): { groundTargets: Model[] } {
 const start = os.clock(); let slice = start, longest = 0;
 parent.SetAttribute("WorldBuildPhase", "plan");
 const plan = makePlan(() => { const dt = os.clock() - slice; longest = math.max(longest, dt); if (dt >= 0.004) { WorldBuildScheduler.Pause(); slice = os.clock(); } });
 parent.SetAttribute("WorldPlanSeconds", os.clock() - start);
 parent.SetAttribute("WorldPlanLongestSlice", longest);
 const names: WorldAssetName[] = plan.props.map(p => p.asset);
 for (const t of plan.targets) { const name = candidate(t); if (name !== undefined) { const key = available(name); if (key !== undefined) names.push(key); } }
 WorldAssets.Start(names);
 WorldEnvironment.ApplySpec(environment, plan.key);
 Workspace.Terrain.SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(43, 55, 43));
 Workspace.Terrain.SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(119, 116, 77));
 Workspace.Terrain.SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(65, 67, 59));
 Workspace.Terrain.SetMaterialColor(Enum.Material.Mud, Color3.fromRGB(53, 61, 56));
 const scene = new Instance("Folder"); scene.Name = plan.key; scene.Parent = parent;
 const models = new Map<string, Model>();
 for (const t of plan.targets) {
  const m = new Instance("Model"); m.Name = t.id; m.SetAttribute("TargetType", t.type); m.SetAttribute("LayoutGroup", t.group); m.Parent = scene; models.set(t.id, m);
 }
 parent.SetAttribute("WorldBuildPhase", "terrain");
 const timing = TerrainWriter.Write(plan.ops, terrainBudget, WORLD_FILL_CHUNK);
 parent.SetAttribute("WorldTerrainReadySeconds", os.clock() - start); parent.SetAttribute("WorldTerrainLongest", timing.longest); parent.SetAttribute("WorldTerrainJobs", timing.jobs);
 parent.SetAttribute("WorldBuildPhase", "dressing");
 for (let i = 0; i < plan.parts.size(); i++) {
  const p = plan.parts[i], owner = models.get(p.name) ?? scene, at = new Vector3(p.x, p.y, p.z);
  if (p.shape === "cylinder") Scenery.Cylinder(owner, p.name, p.sx, p.sy, at, Color3.fromRGB(...p.color), material(p.material), { flightSolid: p.solid, castShadow: false });
  else Scenery.Part(owner, p.name, new Vector3(p.sx, p.sy, p.sz), new CFrame(at).mul(CFrame.Angles(0, p.yaw, 0)), Color3.fromRGB(...p.color), material(p.material), { flightSolid: p.solid, castShadow: false });
  if (i % 32 === 31) WorldBuildScheduler.Pause();
 }
 let missing = 0;
 for (let pi = 0; pi < plan.props.size(); pi++) {
  const p = plan.props[pi], propOwner = p.tag !== undefined ? models.get(p.tag) ?? scene : scene;
  if (WorldAssets.PlaceUploaded(p.asset, propOwner, new CFrame(p.x, p.y, p.z).mul(CFrame.Angles(0, p.yaw, 0)), p.scale) === undefined) {
   missing++;
   const size = UploadedAssetSpecs[p.asset].size.mul(p.scale);
   // Visible stand-ins even for optional dressing that WorldAssets normally omits.
   const grey = Color3.fromRGB(83, 91, 98);
   const standIn = (name: string, dimensions: Vector3, at: Vector3, ball = false) => Scenery.Part(propOwner, name, dimensions, new CFrame(at).mul(CFrame.Angles(0, p.yaw, 0)), grey, Enum.Material.SmoothPlastic, { shape: ball ? Enum.PartType.Ball : Enum.PartType.Block, flightSolid: true, castShadow: false });
   if (p.asset === "Pine") {
    standIn("Pine trunk stand-in", new Vector3(4, size.Y * 0.5, 4), new Vector3(p.x, p.y + size.Y * 0.25, p.z));
    standIn("Pine canopy stand-in", new Vector3(size.X, size.Y * 0.8, size.Z), new Vector3(p.x, p.y + size.Y * 0.6, p.z), true);
   } else if (p.asset === "OilPlatform") {
    for (const x of [-80, 80]) for (const z of [-64, 64]) standIn("Platform leg stand-in", new Vector3(8, 112, 8), new Vector3(p.x + x, 64, p.z + z));
    standIn("Platform deck stand-in", new Vector3(220, 12, 180), new Vector3(p.x, 114, p.z));
    standIn("Platform derrick stand-in", new Vector3(24, 120, 24), new Vector3(p.x + 50, 180, p.z));
   } else standIn(`${p.asset} stand-in`, size, new Vector3(p.x, p.y + size.Y / 2 - UploadedAssetSpecs[p.asset].groundOffset * p.scale, p.z));
  }
   // Eight placements per frame, as M02 does: one frame per prop cost M04's 120 pines two seconds.
   if (pi % 8 === 7) WorldBuildScheduler.Pause();
 }
 for (const t of plan.targets) {
  const name = candidate(t); if (name === undefined && t.type !== "submarine") continue;
  const owner = models.get(t.id)!;
  const key = name !== undefined ? available(name) : undefined, frame = new CFrame(t.x, t.y, t.z).mul(CFrame.Angles(0, t.yaw, 0));
  if (key !== undefined && WorldAssets.PlaceUploaded(key, owner, frame) !== undefined) continue;
  missing++; owner.SetAttribute("StandIn", true);
  const part = (label: string, sx: number, sy: number, sz: number, y: number, z = 0) => Scenery.Part(owner, label, new Vector3(sx, sy, sz), frame.mul(new CFrame(0, y, z)), Color3.fromRGB(101, 111, 120), Enum.Material.Metal, { flightSolid: true, castShadow: false });
  if (t.y === 32) { part("Hull", 64, 32, 360, 0); part("Deck", 56, 12, 310, 20); part("Bridge", 44, t.type === "submarine" ? 12 : 40, 36, t.type === "submarine" ? 24 : 42, 120); }
  else { part("Fuselage", 12, 12, 64, 0); part("Wing or rotor", t.type === "helicopter" ? 50 : 70, 2, 8, 8); part("Tail", 24, 3, 12, 4, 26); if (t.type === "jammer") part("Radar dome", 26, 5, 26, 12); }
 }
 assertWorldInstanceBudget(scene, descendantLimit);
 parent.SetAttribute("CloudBaseReferenceFeet", cloudFeet);
 parent.SetAttribute("WorldPropsMissing", missing); parent.SetAttribute("WorldBuildSeconds", os.clock() - start); parent.SetAttribute("Composition", plan.key); parent.SetAttribute("WorldBuildPhase", "done");
 return { groundTargets: [] };
}
