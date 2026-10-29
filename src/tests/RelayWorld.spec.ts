import { M01 } from "../shared/M01Geometry";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import {afterAll,afterEach,beforeAll,describe,expect,it} from "@rbxts/jest-globals";
import {Lighting,Workspace} from "@rbxts/services";
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
 it("rejects every unreleased world before building anything",()=>{
  fixture=new Instance("Folder");fixture.Parent=Workspace;
  for(let id=2;id<=18;id++){const [ok]=pcall(()=>MissionWorld.Build(id,fixture!));expect(ok).toBe(false);}
  expect(fixture.GetDescendants().size()).toBe(0);
 });
});
