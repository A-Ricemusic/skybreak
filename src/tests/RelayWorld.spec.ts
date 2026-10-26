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
const DECORATION=["Shallows","Marker light","Navigation light","Safety line","Centreline","Threshold","Threshold bar","Approach bar","Center stripe","Lit windows","Protected beacon"];
const inUploaded=(item: Instance)=>item.FindFirstAncestorWhichIsA("Model")?.GetAttribute("GeometrySource")==="Uploaded";

describe("Broken Relay disposable world integration",()=>{
	let fixture:Folder | undefined;
	afterEach(()=>{cleanup(fixture);fixture=undefined;});
	for(const bp of MissionCatalog.All())it(`builds and disposes M${bp.id} with exact authored targets and bounded scenery`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		const world=MissionWorld.Build(bp.id,fixture);
		expect(Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE)).toBe(bp.environment);
		expect(world.groundTargets.size()).toBe(bp.ground.size());
		for(let i=0;i<world.groundTargets.size();i++){
			const target=world.groundTargets[i];expect(target.Parent).toBe(fixture);expect(target.Name).toBe(bp.ground[i].name);
			expect(target.PrimaryPart?.Position.X).toBeCloseTo(bp.ground[i].x,2);
			expect(target.PrimaryPart?.Position.Z).toBeCloseTo(bp.ground[i].z,2);
			expect(target.GetAttribute("GeometrySource")).toBe("Blender");
		}
		let primitive=0;
		for(const item of fixture.GetDescendants())if(item.IsA("BasePart")){
			if(!inUploaded(item))primitive++;
			expect(item.Anchored).toBe(true);expect(item.CanCollide).toBe(false);
			// Every tagged visible surface remains solid except authored decoration.
			if (item.GetAttribute("FlightSolid") !== undefined) {
				const solid = !DECORATION.includes(item.Name) && item.Transparency < 1;
				expect(item.CanQuery).toBe(solid);
				expect(item.GetAttribute("FlightSolid")).toBe(solid);
			}
			expect(item.Size.X<=2048 && item.Size.Y<=2048 && item.Size.Z<=2048).toBe(true);
		}
		const filter = AircraftCollision.Parameters(fixture).FilterDescendantsInstances;
		for (const item of fixture.GetDescendants()) if (item.IsA("BasePart") && item.GetAttribute("FlightSolid") !== undefined) {
			expect(filter.includes(item)).toBe(item.GetAttribute("FlightSolid") === true);
		}
		expect(fixture.GetAttribute("PartCount")).toBe(primitive);
		expect(primitive).toBeLessThanOrEqual(PART_BUDGET);
		fixture.Destroy();expect(world.groundTargets.every((model)=>model.Parent===undefined)).toBe(true);
	});
	// The hand-composed opening worlds carry the densest primitive scenery (airbase, harbor).
	for(const id of [1,2,3])it(`keeps the M${id} composition within the ${PART_BUDGET}-part budget`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(id,fixture);
		let parts=0;
		for(const item of fixture.GetDescendants())if(item.IsA("BasePart") && !inUploaded(item))parts++;
		expect(fixture.GetAttribute("PartCount")).toBe(parts);
		expect(parts).toBeLessThanOrEqual(PART_BUDGET);
		expect(parts).toBeGreaterThan(20);
	});
});

describe("Mission worlds place uploaded models on the ground and keep the air clear",()=>{
	let fixture:Folder | undefined;
	beforeAll(()=>UploadedAssets.Configure({ids:fakeIds(),probe,loader:fakeUpload}));
	afterAll(()=>UploadedAssets.Configure());
	afterEach(()=>{cleanup(fixture);fixture=undefined;});
	const terrainOnly=()=>{const p=new RaycastParams();p.FilterType=Enum.RaycastFilterType.Include;p.FilterDescendantsInstances=[Workspace.Terrain];p.IgnoreWater=false;return p;};
	// A farm, a canyon airfield, a relay plateau, a harbour city and the ocean ring.
	for(const id of [5,8,10,20,23])it(`M${id}: every planned prop is an uploaded clone resting on what is under it`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(id,fixture);
		const plan=WorldPlanner.Build(id);
		const props=fixture.FindFirstChild(plan.name)?.FindFirstChild("Props");
		expect(props).toBeDefined();
		const models=props!.GetChildren().filter((m): m is Model=>m.IsA("Model"));
		expect(models.size()).toBe(plan.props.size());
		expect(fixture.GetAttribute("WorldFallbacks")).toBe(0);
		const params=terrainOnly();
		for(let i=0;i<models.size();i++){
			const model=models[i],p=plan.props[i],spec=UploadedAssetSpecs[p.asset];
			expect(model.GetAttribute("GeometrySource")).toBe("Uploaded");
			const [box,size]=model.GetBoundingBox(),bottom=box.Position.Y-size.Y/2;
			// The clone sits where the plan put it, at the planned scale.
			expect(math.abs(bottom-(p.y-spec.groundOffset*p.scale))<0.5).toBe(true);
			expect(math.abs(size.Y-spec.size.Y*p.scale)<0.5).toBe(true);
			const hit=Workspace.Raycast(new Vector3(p.x,bottom+spec.size.Y*p.scale+400,p.z),new Vector3(0,-1200,0),params);
			expect(hit).toBeDefined();
			if(p.asset==="Frigate"||p.asset==="OilPlatform"){expect(hit!.Material).toBe(Enum.Material.Water);expect(math.abs(hit!.Position.Y-p.y)<2.5).toBe(true);continue;}
			if(p.asset==="HarbourQuay"||p.asset==="GantryCrane")continue;
			// Real voxels under trees, rocks and buildings: no gap wider than one voxel step.
			expect(hit!.Material===Enum.Material.Water).toBe(false);
			expect(bottom-hit!.Position.Y<2.5).toBe(true);
		}
		if(id===23)expect(models.filter((m)=>m.GetAttribute("WorldTag")==="ProtectedHull").size()).toBe(1);
	});
	for(const id of [3,10,20,24])it(`M${id}: the executed terrain matches the plan's flight clearance and target aprons`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(id,fixture);
		const plan=WorldPlanner.Build(id);
		const params=AircraftCollision.Parameters(fixture);
		for(const s of plan.air){
			// Nothing solid (terrain voxels, parts or uploaded meshes) reaches above the sample's limit.
			const hit=Workspace.Raycast(new Vector3(s.x,s.limit+1500,s.z),new Vector3(0,-1500,0),params);
			expect(hit===undefined?`${s.label} clear`:`${s.label} hit ${hit.Instance.Name} at ${math.floor(hit.Position.Y)} over limit ${math.floor(s.limit)}`).toBe(`${s.label} clear`);
		}
		// The apron (or deck) top is level at the target's base: probe its corner, clear of the target model.
		const scenery=new RaycastParams();scenery.FilterType=Enum.RaycastFilterType.Include;
		scenery.FilterDescendantsInstances=[Workspace.Terrain,fixture.FindFirstChild(plan.name)!];
		for(const t of plan.targets){
			const top=Workspace.Raycast(new Vector3(t.x+t.apron*0.45,t.baseY+60,t.z+t.apron*0.45),new Vector3(0,-120,0),scenery);
			expect(top).toBeDefined();
			expect(math.abs(top!.Position.Y-t.baseY)<0.1).toBe(true);
		}
	});
});

describe("Mission worlds never wait on a slow or failed upload",()=>{
	let fixture:Folder | undefined;
	afterEach(()=>{cleanup(fixture);fixture=undefined;UploadedAssets.Configure();WorldAssets.SetPreloadTimeout();});
	it("M5: a Pine load that never answers in time takes the fallback, and the build returns within its deadline",()=>{
		// The Pine request hangs until released; every other upload answers at once.
		const gate=new Instance("BindableEvent");
		let released=false;
		UploadedAssets.Configure({ids:fakeIds(),probe,loader:(id)=>{if(WORLD[id-9000]==="Pine"&&!released)gate.Event.Wait();return fakeUpload(id);}});
		WorldAssets.SetPreloadTimeout(0.5);
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(5,fixture);
		const plan=WorldPlanner.Build(5),pines=plan.props.filter((p)=>p.asset==="Pine").size();
		expect(pines).toBeGreaterThan(0);
		// Returned while the request is still pending: Pine is late, every pine is a stand-in, nothing else is.
		expect(fixture.GetAttribute("WorldPreloadLate")).toBe(1);
		expect(fixture.GetAttribute("WorldFallbacks")).toBe(pines);
		expect(fixture.GetAttribute("WorldUploaded")).toBe(plan.props.size()-pines);
		// The terrain batch yielded and recorded its timings for engine runs.
		expect((fixture.GetAttribute("WorldTerrainYields") as number)>0).toBe(true);
		expect((fixture.GetAttribute("WorldTerrainLongest") as number)>0).toBe(true);
		released=true;gate.Fire();gate.Destroy();
	});
	it("M2: a failed Barn upload still builds every barn (as its block) beside the uploaded farmhouses",()=>{
		const ids=fakeIds();
		UploadedAssets.Configure({ids,probe,loader:(id)=>{if(WORLD[id-9000]==="Barn")error("asset not owned by the place owner");return fakeUpload(id);}});
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(2,fixture);
		const houses=(name: string)=>fixture!.FindFirstChild("IronCoastWorld")!.GetChildren().filter((m): m is Model=>m.IsA("Model")&&m.Name===name);
		expect(houses("Barn").size()).toBe(5);
		expect(houses("Barn").every((m)=>m.GetAttribute("GeometrySource")==="Fallback")).toBe(true);
		expect(houses("Farmhouse").size()).toBe(22);
		expect(houses("Farmhouse").every((m)=>m.GetAttribute("GeometrySource")==="Uploaded")).toBe(true);
	});
	it("M2: the frigate floats over its dredged berth with water under the keel",()=>{
		UploadedAssets.Configure({ids:fakeIds(),probe,loader:fakeUpload});
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(2,fixture);
		const frigate=fixture.FindFirstChild("IronCoastWorld")!.FindFirstChild("Frigate") as Model;
		expect(frigate.GetAttribute("GeometrySource")).toBe("Uploaded");
		const [box,size]=frigate.GetBoundingBox(),keel=box.Position.Y-size.Y/2;
		const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[Workspace.Terrain];params.IgnoreWater=true;
		for(const dx of [-200,0,200]){
			const hit=Workspace.Raycast(new Vector3(box.Position.X+dx,keel+1,box.Position.Z),new Vector3(0,-100,0),params);
			expect(hit===undefined||hit.Position.Y<keel-2).toBe(true);
		}
	});
});
