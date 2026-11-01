import { robloxScheduler, worldClear } from "../server/WorldLifecycleRuntime";
import { WorldLifecycle } from "../shared/WorldLifecycle";
import { M04_WORLD_KEY } from "../shared/M04WorldPlan";
import { terrainDirty } from "../server/TerrainState";
import { M01 } from "../shared/M01Geometry";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import {afterAll,afterEach,beforeAll,describe,expect,it} from "@rbxts/jest-globals";
import {Lighting,RunService,Workspace} from "@rbxts/services";
import {MissionWorld} from "../server/MissionWorld";
import {WorldAssets} from "../server/WorldAssets";
import {MissionCatalog} from "../shared/MissionCatalog";
import {AircraftCollision} from "../server/AircraftCollision";
import {PART_BUDGET} from "../server/Scenery";
import {ENVIRONMENT_ATTRIBUTE} from "../shared/EnvironmentPresets";
import {SURFACE_MAPS,type SurfaceMap} from "../shared/AssetSelection";
import {UploadedAssets} from "../shared/UploadedAssets";
import {UploadedAssetSpecs,type UploadedAssetName} from "../shared/UploadedAssetSpecs";
import {WorldPlanner,type PropAsset} from "../shared/WorldPlan";
import {buildNightLighting} from "../server/NightLighting";
import {GROUND_TARGET_LABELS} from "../shared/CampaignEncounters";
import {M05_ENVIRONMENT,M05_WORLD_KEY} from "../shared/M05WorldPlan";
import {M01_ENVIRONMENT} from "../shared/M01WorldPlan";

/** Engine integration only. Included in Roblox Jest; never run by the offline VM (WorldPlan.spec audits the plans there). */

// Deterministic uploads: one textured MeshPart per world asset at its authored size, so the
// placement and grounding checks below exercise the uploaded-clone path without InsertService.
const WORLD: PropAsset[]=["Frigate","OilPlatform","HarbourQuay","ContainerStack","GantryCrane","Hangar","ControlTower","OfficeMidrise","ApartmentBlock","CityTower","Farmhouse","Barn","GrainSilo","RadarDish","RelayMast","Pine","Broadleaf","RockA","RockB","RockC"];
const probe=(appearance: SurfaceAppearance,map: SurfaceMap)=>appearance.GetAttribute(`Fake${map}`)===true;
function fakeIds(): Partial<Record<UploadedAssetName,number>> {
	const ids: Partial<Record<UploadedAssetName,number>>={};
	WORLD.forEach((name,i)=>ids[name]=9000+i);
	return ids;
}
function fakeUpload(assetId: number): Model {
	const name=WORLD[assetId-9000],spec=UploadedAssetSpecs[name];
	const container=new Instance("Model");
	const part=new Instance("MeshPart");
	part.Name=spec.folder;part.Size=spec.authoredSize;part.CFrame=new CFrame(300,40,-200);
	const appearance=new Instance("SurfaceAppearance");
	for(const map of SURFACE_MAPS)appearance.SetAttribute(`Fake${map}`,true);
	appearance.Parent=part;part.Parent=container;
	return container;
}
function cleanup(fixture: Folder | undefined): void {
	fixture?.Destroy();Workspace.Terrain.Clear();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
	for(const name of ["MissionAtmosphere","MissionGrade","MissionSky","MissionBloom"])Lighting.FindFirstChild(name)?.Destroy();
}
const DECORATION=["Shallows","Marker light","Navigation light","Safety line","Centreline","Threshold","Outer runway threshold","Threshold bar","Approach bar","Center stripe","Lit windows","Protected beacon"];
const inUploaded=(item: Instance)=>item.FindFirstAncestorWhichIsA("Model")?.GetAttribute("GeometrySource")==="Uploaded";

describe("Released campaign world integration (Studio only)",()=>{
 let fixture: Folder | undefined;
 beforeAll(()=>UploadedAssets.Configure({ids:fakeIds(),probe,loader:fakeUpload}));
 afterAll(()=>UploadedAssets.Configure());
 afterEach(()=>{cleanup(fixture);fixture=undefined;Lighting.FindFirstChild("M01SunRays")?.Destroy();});
 // Measure heartbeat gaps through every build phase, including its final synchronous tail.
 for (let id = 1; id <= 18; id++) it(`bounds actual Studio build time and heartbeat gaps for M${id}`, () => {
  fixture = new Instance("Folder"); fixture.Name = "WorldTimingFixture"; fixture.Parent = Workspace;
  RunService.Heartbeat.Wait();
  let previous = os.clock(), maxGap = 0, beats = 0;
  const heartbeat = RunService.Heartbeat.Connect(() => {
   const now = os.clock(); maxGap = math.max(maxGap, now - previous); previous = now; beats++;
  });
  let seconds = 0;
  try {
   const start = os.clock();
   MissionWorld.Build(id, fixture);
   seconds = os.clock() - start;
   maxGap = math.max(maxGap, os.clock() - previous);
   // Observe the next heartbeat too, so a blocking final phase cannot escape measurement.
   RunService.Heartbeat.Wait();
  } finally { heartbeat.Disconnect(); }
  const batch = fixture.GetAttribute("WorldTerrainLongestBatch") as number;
  print(`MISSION_STUDIO_BUILD mission=${id} seconds=${seconds} maxHeartbeatGap=${maxGap} heartbeats=${beats} maxTerrainBatch=${batch} plan=${fixture.GetAttribute("WorldPlanSeconds")} terrainReady=${fixture.GetAttribute("WorldTerrainReadySeconds")} terrainWork=${fixture.GetAttribute("WorldTerrainWorkSeconds")} yields=${fixture.GetAttribute("WorldTerrainYields")} longestJob=${fixture.GetAttribute("WorldTerrainLongest")} (fake uploads; excludes cleanup/replication/device load)`);
  expect(beats).toBeGreaterThan(0);
  expect(seconds).toBeGreaterThan(0);
  expect(batch).toBeLessThanOrEqual(0.3);
  expect(maxGap).toBeLessThanOrEqual(0.3);
  expect(seconds).toBeLessThanOrEqual(16);
 }, 180000);
 for(const id of [0,1])it(`builds and disposes released sortie ${id}`,()=>{
  fixture=new Instance("Folder");fixture.Name="CampaignWorldFixture";fixture.Parent=Workspace;
  const bp=MissionCatalog.Get(id),world=MissionWorld.Build(id,fixture);
  expect(world.groundTargets.size()).toBe(bp.ground.size());
  expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe(id===0 ? bp.environment : "m01_sea_island");
  for(let i=0;i<world.groundTargets.size();i++){
   const target=world.groundTargets[i];expect(target.Name).toBe(bp.ground[i].name);
   expect(target.PrimaryPart?.Position.X).toBeCloseTo(bp.ground[i].x,2);
   expect(target.PrimaryPart?.Position.Z).toBeCloseTo(bp.ground[i].z,2);
  }
  const parts=fixture.GetDescendants().filter((p):p is BasePart=>p.IsA("BasePart"));
  for(const part of parts){expect(part.Anchored).toBe(true);expect(part.CanCollide).toBe(false);expect(part.Size.X<=2048 && part.Size.Y<=2048 && part.Size.Z<=2048).toBe(true);}
  const primitives=parts.filter((p)=>!inUploaded(p));
  expect(primitives.size()).toBeLessThanOrEqual(id===0 ? PART_BUDGET : M01.budget.parts);
  if(id===0)expect(fixture.GetAttribute("PartCount")).toBe(primitives.size());
  else {
   expect(fixture.GetAttribute("WorldBuildPhase")).toBe("done");
   expect(fixture.GetDescendants().size()).toBeLessThanOrEqual(M01.budget.descendants);
   const route=compileBomberEncounter(bp.phases[0].bombers!);
   const params=AircraftCollision.Parameters(fixture);
   for(let t=0;t<=240;t+=5)for(const pose of BomberRules.Sample(route,t).slots){
    const p=pose.position;
    const hit=Workspace.Raycast(new Vector3(p.x,p.y+72,p.z),new Vector3(0,-144,0),params);
    expect(hit).toBeUndefined();
   }
   expect(Lighting.FindFirstChild("M01SunRays")).toBeDefined();
  }
  fixture.Destroy();expect(world.groundTargets.every((m)=>m.Parent===undefined)).toBe(true);
 },120000);
 it("builds mission 2 with every typed target drawn once by the world, ready for combat to adopt",()=>{
  fixture=new Instance("Folder");fixture.Name="CampaignWorldFixture";fixture.Parent=Workspace;
  const specs=MissionCatalog.Get(2).phases[0].groundTargets!,world=MissionWorld.Build(2,fixture);
  expect(world.groundTargets.size()).toBe(0);
  expect(fixture.GetAttribute("WorldBuildPhase")).toBe("done");
  expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe("m02_farm_airbase");
  const visuals=world.targetVisuals!;
  expect(visuals.size()).toBe(specs.size());
  const labels: {[k: string]: string}={parked_bomber:"BOMBER",hangar:"HANGAR",aa_gun:"AA GUN",control_tower:"CTRL TOWER",substation:"SUBSTATION"};
  for(const spec of specs){
   const model=visuals.get(spec.id)!;
   expect(model.IsDescendantOf(fixture)).toBe(true);
   expect(model.Name).toBe(labels[spec.type]);expect(model.GetAttribute("TargetId")).toBe(spec.id);
   const aim=model.PrimaryPart!;expect(aim.Name).toBe("Aim");expect(aim.Transparency).toBe(1);
   expect(math.abs(aim.Position.X-spec.position.x)).toBeLessThan(80);expect(math.abs(aim.Position.Z-spec.position.z)).toBeLessThan(80);
   if(spec.type==="parked_bomber"){const [box,size]=model.GetBoundingBox();expect(box.Position.Y-size.Y/2).toBeCloseTo(spec.position.y,2);}
  }
  // Exactly once: one tagged model per id and no untagged copy of any target visual anywhere in the world.
  const tagged=fixture.GetDescendants().filter((i)=>i.IsA("Model") && i.GetAttribute("TargetId")!==undefined);
  expect(tagged.size()).toBe(specs.size());
  expect(new Set(tagged.map((m)=>m.GetAttribute("TargetId") as string)).size()).toBe(specs.size());
  for(const item of fixture.GetDescendants()){
   const inTarget=item.FindFirstAncestorWhichIsA("Model")?.GetAttribute("TargetId")!==undefined || item.GetAttribute("TargetId")!==undefined;
   if(item.IsA("Model") && (item.Name==="Hangar" || item.Name==="ControlTower" || item.Name==="HeavyBomber" || item.Name.sub(1,4)==="m02_")) expect(`${item.GetFullName()} untagged`).toBe("tagged");
   if(item.IsA("BasePart") && (item.Name==="AA turret" || item.Name==="Transformer")) expect(inTarget).toBe(true);
  }
  print(`M02_STUDIO_BUILD seconds=${fixture.GetAttribute("WorldBuildSeconds")} terrain=${fixture.GetAttribute("WorldTerrainReadySeconds")} jobs=${fixture.GetAttribute("WorldTerrainJobs")} missing=${fixture.GetAttribute("WorldPropsMissing")} descendants=${fixture.GetDescendants().size()} (fake uploads)`);
 },180000);
 it("builds M04 terrain without dormant aircraft duplicates",()=>{
  fixture=new Instance("Folder");fixture.Name="M04WorldFixture";fixture.Parent=Workspace;
  const world=MissionWorld.Build(4,fixture);
  expect(world.groundTargets.size()).toBe(0);expect(fixture.GetAttribute("WorldBuildPhase")).toBe("done");
  expect(fixture.GetDescendants().some(i=>i.IsA("Model") && i.Name.sub(1,4)==="m04_")).toBe(false);
  print(`M04_STUDIO_BUILD seconds=${fixture.GetAttribute("WorldBuildSeconds")} terrain=${fixture.GetAttribute("WorldTerrainReadySeconds")} jobs=${fixture.GetAttribute("WorldTerrainJobs")} descendants=${fixture.GetDescendants().size()} (fake world uploads)`);
  const gate=new WorldLifecycle(robloxScheduler);
  gate.Cleanup({clear:worldClear(M04_WORLD_KEY),restore:()=>MissionWorld.RestoreMenu()});
  expect(gate.Idle()).toBe(false);expect(gate.AwaitIdle()).toBe(true);
  expect(terrainDirty()).toBe(false);
  const again=new Instance("Folder");again.Parent=Workspace;
  expect(MissionWorld.Build(0,again).groundTargets.size()).toBe(1);again.Destroy();
  MissionWorld.RestoreMenu();expect(Workspace.FindFirstChild("World")).toBeDefined();
 },180000);
 it("builds mission 3 with every typed target drawn once by the world and a raised runway, ready for combat to adopt",()=>{
  fixture=new Instance("Folder");fixture.Name="CampaignWorldFixture";fixture.Parent=Workspace;
  const specs=MissionCatalog.Get(3).phases[0].groundTargets!,world=MissionWorld.Build(3,fixture);
  expect(world.groundTargets.size()).toBe(0);
  expect(fixture.GetAttribute("WorldBuildPhase")).toBe("done");
  expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe("m03_snow_radar");
  const visuals=world.targetVisuals!;
  expect(visuals.size()).toBe(specs.size());
  const labels: {[k: string]: string}={radar_dome:"RADAR",aa_gun:"AA GUN",parked_helicopter:"HELICOPTER"};
  for(const spec of specs){
   const model=visuals.get(spec.id)!;
   expect(model.IsDescendantOf(fixture)).toBe(true);
   expect(model.Name).toBe(labels[spec.type]);expect(model.GetAttribute("TargetId")).toBe(spec.id);
   const aim=model.PrimaryPart!;expect(aim.Name).toBe("Aim");expect(aim.Transparency).toBe(1);
   expect(math.abs(aim.Position.X-spec.position.x)).toBeLessThan(40);expect(math.abs(aim.Position.Z-spec.position.z)).toBeLessThan(40);
   // Each model stands on its foundation top: the layout's ground contact.
   const [box,size]=model.GetBoundingBox();expect(box.Position.Y-size.Y/2).toBeCloseTo(spec.position.y,1);
  }
  const tagged=fixture.GetDescendants().filter((i)=>i.IsA("Model") && i.GetAttribute("TargetId")!==undefined);
  expect(tagged.size()).toBe(specs.size());
  expect(new Set(tagged.map((m)=>m.GetAttribute("TargetId") as string)).size()).toBe(specs.size());
  for(const item of fixture.GetDescendants()) if(item.IsA("Model") && item.Name.sub(1,4)==="m03_") expect(`${item.GetFullName()} untagged`).toBe("tagged");
  // The runway reads above the lowland: its top (88) clears the terrain surface sampled beside it.
  const runway=fixture.GetDescendants().filter((i)=>i.IsA("BasePart") && i.Name==="Landing runway") as BasePart[];
  expect(runway.size()).toBe(2);
  for(const strip of runway) expect(strip.Position.Y+strip.Size.Y/2).toBe(88);
  const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[Workspace.Terrain];
  const ground=Workspace.Raycast(new Vector3(5800,400,11264),new Vector3(0,-800,0),params);
  // Measured: the lowland Ground surface reads about 82 (two studs over its voxel top), so the slab shows 6 studs.
  expect(ground).toBeDefined();expect(ground!.Position.Y).toBeLessThan(84);
  print(`M03_STUDIO_BUILD seconds=${fixture.GetAttribute("WorldBuildSeconds")} terrain=${fixture.GetAttribute("WorldTerrainReadySeconds")} plan=${fixture.GetAttribute("WorldPlanSeconds")} jobs=${fixture.GetAttribute("WorldTerrainJobs")} longest=${fixture.GetAttribute("WorldTerrainLongest")} descendants=${fixture.GetDescendants().size()} lowland=${ground!.Position.Y}`);
 },240000);
 it("builds mission 5 at night with every ground and naval target adopted once, no helicopter scenery, and lights that leave with the world",()=>{
  fixture=new Instance("Folder");fixture.Name="CampaignWorldFixture";fixture.Parent=Workspace;
  const bp=MissionCatalog.Get(5),specs=bp.phases[0].groundTargets!,started=os.clock(),world=MissionWorld.Build(5,fixture);
  buildNightLighting(fixture,bp.nightLighting!);
  const seconds=os.clock()-started;
  expect(world.groundTargets.size()).toBe(0);
  expect(fixture.GetAttribute("WorldBuildPhase")).toBe("done");
  expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe(M05_WORLD_KEY);
  expect(Lighting.ClockTime).toBeCloseTo(M05_ENVIRONMENT.clock,3);
  const visuals=world.targetVisuals!;
  expect(visuals.size()).toBe(specs.size());
  for(const spec of specs){
   const model=visuals.get(spec.id)!;
   expect(model.IsDescendantOf(fixture)).toBe(true);
   expect(model.Name).toBe(GROUND_TARGET_LABELS[spec.type]);expect(model.GetAttribute("TargetId")).toBe(spec.id);
   const aim=model.PrimaryPart!;expect(aim.Name).toBe("Aim");
   expect(math.abs(aim.Position.X-spec.position.x)).toBeLessThan(200);expect(math.abs(aim.Position.Z-spec.position.z)).toBeLessThan(200);
  }
  const tagged=fixture.GetDescendants().filter((i)=>i.IsA("Model") && i.GetAttribute("TargetId")!==undefined);
  expect(tagged.size()).toBe(specs.size());
  for(const item of fixture.GetDescendants()) if(item.IsA("Model")) expect(item.GetAttribute("TargetType")==="helicopter").toBe(false);
  const lights=fixture.GetDescendants().filter((i)=>i.IsA("BasePart") && (i.Name==="Industrial light" || i.Name==="Searchlight"));
  expect(lights.size()).toBe(bp.nightLighting!.fields.reduce((n,f)=>n+f.rows*f.columns,0)+bp.nightLighting!.searchlights.size());
  expect(fixture.GetDescendants().filter((i)=>i.IsA("PointLight")).size()).toBe(16);
  print(`M05_STUDIO_BUILD seconds=${string.format("%.2f",seconds)} world=${fixture.GetAttribute("WorldBuildSeconds")} terrain=${fixture.GetAttribute("WorldTerrainReadySeconds")} jobs=${fixture.GetAttribute("WorldTerrainJobs")} missing=${fixture.GetAttribute("WorldPropsMissing")} descendants=${fixture.GetDescendants().size()} (fake uploads)`);
  // No night leaks into mission 1: the lights leave with the world and mission 1 applies its own sky.
  cleanup(fixture);
  fixture=new Instance("Folder");fixture.Name="CampaignWorldFixture";fixture.Parent=Workspace;
  MissionWorld.Build(1,fixture);
  expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe("m01_sea_island");
  expect(Lighting.ClockTime).toBeCloseTo(M01_ENVIRONMENT.clock,3);
  expect(Workspace.GetDescendants().some((i)=>i.Name==="Industrial light" || i.Name==="Searchlight")).toBe(false);
 },300000);
 it("rejects every unreleased world before building anything",()=>{
  fixture=new Instance("Folder");fixture.Parent=Workspace;
  for(let id=4;id<=18;id++){if(MissionCatalog.Available(id)) continue;const [ok]=pcall(()=>MissionWorld.Build(id,fixture!));expect(ok).toBe(false);}
  expect(fixture.GetDescendants().size()).toBe(0);
 });
});
