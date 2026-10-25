import { Lighting, Workspace } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { layoutFor } from "../shared/MissionLayouts";

function part(parent: Instance, name: string, size: Vector3, pos: Vector3, color: Color3, material: Enum.Material=Enum.Material.Concrete): Part {
	const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=pos; p.Color=color; p.Material=material;
	p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false; p.Parent=parent; return p;
}
function road(parent: Instance, a: Vector3, b: Vector3, width=25): void {
	const count=math.ceil(a.sub(b).Magnitude/1800);
	for(let i=0;i<count;i++){
		const start=a.Lerp(b,i/count),finish=a.Lerp(b,(i+1)/count);
		const p=part(parent,"Road",new Vector3(width,2,start.sub(finish).Magnitude),start.add(finish).div(2),Color3.fromRGB(54,64,67),Enum.Material.Asphalt);
		p.CFrame=CFrame.lookAt(p.Position,finish);
	}
}
function light(parent: Instance, pos: Vector3): void { part(parent,"Navigation light",new Vector3(4,3,4),pos,Color3.fromRGB(80,235,211),Enum.Material.Neon); }
export const RelayWorld = {
	Build(id: number,parent: Instance): {groundTargets: Model[]} {
		const bp=MissionCatalog.Get(id), layout=layoutFor(id), terrain=Workspace.Terrain;
		Workspace.FindFirstChild("World")?.Destroy(); terrain.Clear();
		for (const name of ["SkybreakAtmosphere","SkybreakColor","MissionAtmosphere","MissionGrade","MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
		terrain.FindFirstChild("SkybreakClouds")?.Destroy(); terrain.FindFirstChild("MissionClouds")?.Destroy();
		const preset=bp.environment;
		const night=preset.find("night")[0] !== undefined || preset==="relay_aurora";
		const storm=preset.find("storm")[0] !== undefined;
		const warm=preset.find("sunset")[0] !== undefined || preset.find("dusk")[0] !== undefined || preset==="city_evening";
		const dawn=preset.find("dawn")[0] !== undefined;
		Lighting.ClockTime=night ? 1.8 : warm ? 17.7 : dawn ? 6.4 : storm ? 13 : 9.5;
		Lighting.Brightness=night ? 2 : 2.6; Lighting.ExposureCompensation=night ? .35 : .05;
		Lighting.Ambient=Color3.fromRGB(100,118,140); Lighting.OutdoorAmbient=Color3.fromRGB(130,145,155);
		const sky=new Instance("Sky"); sky.Name="MissionSky"; sky.StarCount=night ? 1800 : 0; sky.Parent=Lighting;
		const at=new Instance("Atmosphere"); at.Name="MissionAtmosphere"; at.Density=storm ? .33 : preset==="harbor_fog" ? .31 : .22;
		at.Haze=storm ? 2.2 : 1; at.Color=warm ? Color3.fromRGB(240,199,154) : night ? Color3.fromRGB(130,165,196) : Color3.fromRGB(190,215,227); at.Parent=Lighting;
		const grade=new Instance("ColorCorrectionEffect"); grade.Name="MissionGrade"; grade.Contrast=.06; grade.Saturation=storm ? -.15 : .08; grade.Parent=Lighting;
		const cloud=new Instance("Clouds"); cloud.Name="MissionClouds"; cloud.Cover=storm ? .85 : .32; cloud.Density=storm ? .65 : .3; cloud.Parent=terrain;
		const scene=new Instance("Folder"); scene.Name=layout.name; scene.Parent=parent;
		parent.SetAttribute("MissionId",id); parent.SetAttribute("Composition",layout.name);
		for (let x=-2;x<=2;x++) for(let z=-2;z<=2;z++) part(scene,"Sea",new Vector3(2000,5,2000),new Vector3(x*2000,-18,z*2000),Color3.fromRGB(27,75,99),Enum.Material.SmoothPlastic).Reflectance=.12;
		const inland=bp.region==="upland_farm" || bp.region==="plateau_relay" || bp.region==="canyon_pass" || bp.region==="canyon_airfield";
		// Flat terrain uses bounded native slabs. Avoid millions of allocated voxels
		// per sortie on phones; each disposable world stays below 400 BaseParts.
		if(inland) for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)part(scene,"Plateau floor",new Vector3(1550,50,1550),new Vector3(x*1550,18,z*1550),bp.region==="upland_farm" ? Color3.fromRGB(99,126,73) : Color3.fromRGB(160,116,78),bp.region==="upland_farm" ? Enum.Material.Grass : Enum.Material.Sandstone);
		else if(layout.landmark!=="platform") for(let x=-1;x<=1;x++)for(let z=0;z<=1;z++)part(scene,"Coastal ground",new Vector3(1400,55,1500),new Vector3(x*1400,12,z*1500-200),Color3.fromRGB(91,119,89),Enum.Material.Grass);
		for(const r of layout.ridges){
			part(scene,"Canyon mesa",new Vector3(math.min(2000,r[2]),r[4],math.min(2000,r[3])),new Vector3(r[0],r[4]/2-20,r[1]),Color3.fromRGB(120,95,76),Enum.Material.Rock);
			part(scene,"Mesa cap",new Vector3(r[2]-20,10,math.min(1990,r[3]-20)),new Vector3(r[0],r[4]-24,r[1]),bp.region==="upland_farm" ? Color3.fromRGB(86,119,73) : Color3.fromRGB(183,136,83),bp.region==="upland_farm" ? Enum.Material.Grass : Enum.Material.Sandstone);
		}
		for (let i=1;i<layout.road.size();i++) road(scene,new Vector3(layout.road[i-1][0],45,layout.road[i-1][1]),new Vector3(layout.road[i][0],45,layout.road[i][1]));
		for (const settlement of layout.settlements) for(let x=0;x<settlement[2];x++) for(let z=0;z<settlement[3];z++) {
			const height=layout.landmark==="city" ? 65+((x*13+z*17+id)%5)*21 : 17+((x+z)%3)*6;
			const pos=new Vector3(settlement[0]+x*105,45+height/2,settlement[1]+z*110);
			part(scene,"Civilian building",new Vector3(64,height,72),pos,Color3.fromRGB(127+(x%2)*20,139,141),Enum.Material.Concrete);
			part(scene,"Roof",new Vector3(68,3,76),pos.add(new Vector3(0,height/2,0)),Color3.fromRGB(51,79,88),Enum.Material.Metal);
			if(night) part(scene,"Lit windows",new Vector3(45,4,1),pos.add(new Vector3(0,height*.25,-36.5)),Color3.fromRGB(229,201,128),Enum.Material.Neon);
		}
		const fx=layout.focus[0],fz=layout.focus[1];
		if(layout.landmark==="orchard") {
			for(let x=-3;x<=3;x++) for(let z=0;z<5;z++) {
				part(scene,"Farm strip",new Vector3(85,2,100),new Vector3(x*180,45,600-z*220),Color3.fromRGB(116+z*9,127,60),Enum.Material.Grass);
				part(scene,"Orchard trunk",new Vector3(6,16,6),new Vector3(x*180,54,600-z*220),Color3.fromRGB(98,72,46),Enum.Material.Wood);
				const tree=part(scene,"Orchard canopy",new Vector3(34,27,34),new Vector3(x*180,74,600-z*220),Color3.fromRGB(65,104+z*5,60),Enum.Material.Grass); tree.Shape=Enum.PartType.Ball;
			}
		} else if(layout.landmark==="runway") {
			part(scene,"Runway",new Vector3(100,4,900),new Vector3(fx,48,fz),Color3.fromRGB(36,45,52),Enum.Material.Asphalt);
			for(let i=-4;i<=4;i++) { part(scene,"Center stripe",new Vector3(4,1,45),new Vector3(fx,50.5,fz+i*95),Color3.fromRGB(239,230,191)); light(scene,new Vector3(fx-47,53,fz+i*95)); light(scene,new Vector3(fx+47,53,fz+i*95)); }
		} else if(layout.landmark==="bridge") {
			for(const z of [-1200,600])part(scene,"River",new Vector3(160,3,1800),new Vector3(fx+300,44,z),Color3.fromRGB(45,124,144),Enum.Material.SmoothPlastic);
			part(scene,"Bridge deck",new Vector3(450,9,45),new Vector3(fx+300,70,fz),Color3.fromRGB(111,115,108));
			for(const x of [-150,150]) part(scene,"Bridge support",new Vector3(16,50,45),new Vector3(fx+300+x,45,fz),Color3.fromRGB(98,108,112));
		} else if(layout.landmark==="array") {
			for(const offset of [-420,420]) {
				const mast=MissionAssets.CreateCommsRelay("Quiet relay mast"); mast.PivotTo(new CFrame(fx+offset,90,fz+220)); mast.Parent=scene;
			}
		} else if(layout.landmark==="harbor" || layout.landmark==="platform") {
			for(let i=-1;i<=1;i++) {
				part(scene,"Quay",new Vector3(240,25,520),new Vector3(fx+i*600,29,fz),Color3.fromRGB(92,110,113));
				part(scene,"Crane mast",new Vector3(9,115,9),new Vector3(fx+i*600+105,100,fz),Color3.fromRGB(228,168,69),Enum.Material.Metal);
				part(scene,"Crane boom",new Vector3(145,9,9),new Vector3(fx+i*600+55,153,fz),Color3.fromRGB(228,168,69),Enum.Material.Metal);
				for(let k=0;k<3;k++) part(scene,"Cargo container",new Vector3(20,16,45),new Vector3(fx+i*600-80,51,fz-80+k*55),Color3.fromRGB(64+k*28,112,124),Enum.Material.CorrodedMetal);
			}
		} else if(layout.landmark==="city") {
			part(scene,"Civic plaza",new Vector3(500,6,280),new Vector3(fx,46,fz),Color3.fromRGB(173,167,144));
			part(scene,"Parliament",new Vector3(230,66,100),new Vector3(fx,82,fz-140),Color3.fromRGB(199,191,165));
			for(let i=-4;i<=4;i++) part(scene,"Parliament column",new Vector3(9,70,14),new Vector3(fx+i*24,85,fz-78),Color3.fromRGB(224,216,193));
		}
		const groundTargets: Model[]=[];
		for (const spec of bp.ground) {
			// All targets have level aprons. Bounds-based grounding keeps meshes honest.
			part(scene,"Target apron",new Vector3(150,5,160),new Vector3(spec.x,45,spec.z),Color3.fromRGB(90,103,108));
			const model=spec.asset==="radar" ? MissionAssets.CreateRadar(spec.name) : spec.asset==="warehouse" ? MissionAssets.CreateWarehouse(spec.name) : spec.asset==="comms_relay" ? MissionAssets.CreateCommsRelay(spec.name) : MissionAssets.CreateGrainSilo(spec.name);
			const [bounds,size]=model.GetBoundingBox();
			model.PivotTo(new CFrame(spec.x,48-(bounds.Position.Y-size.Y/2),spec.z).mul(CFrame.Angles(0,spec.yaw ?? 0,0)));
			model.Parent=parent; groundTargets.push(model);
		}
		return {groundTargets};
	},
};
