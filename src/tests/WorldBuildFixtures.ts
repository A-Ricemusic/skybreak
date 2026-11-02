import { SURFACE_MAPS, type SurfaceMap } from "../shared/AssetSelection";
import { UploadedAssetSpecs, type UploadedAssetName } from "../shared/UploadedAssetSpecs";
const WORLD: UploadedAssetName[] = ["Frigate","OilPlatform","HarbourQuay","ContainerStack","GantryCrane","Hangar","ControlTower","OfficeMidrise","ApartmentBlock","CityTower","Farmhouse","Barn","GrainSilo","RadarDish","RelayMast","Pine","Broadleaf","RockA","RockB","RockC"];
for (const [name] of pairs(UploadedAssetSpecs)) if (!WORLD.includes(name as UploadedAssetName)) WORLD.push(name as UploadedAssetName);
export const probe=(appearance: SurfaceAppearance,map: SurfaceMap)=>appearance.GetAttribute(`Fake${map}`)===true;
export function fakeIds(all = false): Partial<Record<UploadedAssetName,number>> {
	const ids: Partial<Record<UploadedAssetName,number>>={};
	WORLD.forEach((name,i)=>{ if (all || i < 20) ids[name]=9000+i; });
	return ids;
}
export function fakeUpload(assetId: number): Model {
	const name=WORLD[assetId-9000],spec=UploadedAssetSpecs[name];
	const container=new Instance("Model");
	const part=new Instance("MeshPart");
	part.Name=spec.folder;part.Size=spec.authoredSize;part.CFrame=new CFrame(300,40,-200);
	const appearance=new Instance("SurfaceAppearance");
	for(const map of SURFACE_MAPS)appearance.SetAttribute(`Fake${map}`,true);
	appearance.Parent=part;part.Parent=container;
	return container;
}
