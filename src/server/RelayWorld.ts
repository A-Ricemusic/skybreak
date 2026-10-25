import { Lighting, Workspace } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { layoutFor } from "../shared/MissionLayouts";
import { Scenery } from "./Scenery";

const part=Scenery.Part;
function light(parent: Instance, pos: Vector3): void { part(parent,"Navigation light",new Vector3(4,3,4),pos,Color3.fromRGB(80,235,211),Enum.Material.Neon,{flightSolid:false,castShadow:false}); }
const near=(x: number,z: number,cx: number,cz: number,r: number): boolean=>(x-cx)*(x-cx)+(z-cz)*(z-cz)<r*r;
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
		Lighting.GlobalShadows=false; // no sun shadow map in sorties (mobile GPU); the menu restores it
		const sky=new Instance("Sky"); sky.Name="MissionSky"; sky.StarCount=night ? 1800 : 0; sky.Parent=Lighting;
		const at=new Instance("Atmosphere"); at.Name="MissionAtmosphere"; at.Density=storm ? .33 : preset==="harbor_fog" ? .31 : .24;
		at.Haze=storm ? 2.2 : 1.3; at.Color=warm ? Color3.fromRGB(240,199,154) : dawn ? Color3.fromRGB(236,208,186) : night ? Color3.fromRGB(130,165,196) : Color3.fromRGB(190,215,227); at.Parent=Lighting;
		const grade=new Instance("ColorCorrectionEffect"); grade.Name="MissionGrade"; grade.Contrast=.06; grade.Saturation=storm ? -.15 : .08; grade.Parent=Lighting;
		const cloud=new Instance("Clouds"); cloud.Name="MissionClouds"; cloud.Cover=storm ? .85 : .32; cloud.Density=.3; cloud.Parent=terrain; // storms keep their cover; density stays <= 0.3 for phones
		const scene=new Instance("Folder"); scene.Name=layout.name; scene.Parent=parent;
		parent.SetAttribute("MissionId",id); parent.SetAttribute("Composition",layout.name);
		const inland=bp.region==="upland_farm" || bp.region==="plateau_relay" || bp.region==="canyon_pass" || bp.region==="canyon_airfield";
		const farm=bp.region==="upland_farm";
		const P=farm ? Scenery.PALETTES.temperate : inland ? Scenery.PALETTES.canyon : Scenery.PALETTES.harbor;
		const floor=inland ? 43 : 39.5;
		Scenery.Sea(scene,inland ? Color3.fromRGB(30,78,102) : night ? Color3.fromRGB(18,40,58) : Color3.fromRGB(27,75,99));
		// Flat terrain uses bounded native slabs. Avoid millions of allocated voxels
		// per sortie on phones; each disposable world stays below Scenery.PART_BUDGET
		// BaseParts (Scenery.Report warns when a composition drifts over).
		if(inland) for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)part(scene,"Plateau floor",new Vector3(1550,50,1550),new Vector3(x*1550,18,z*1550),farm ? Color3.fromRGB(99,126,73) : Color3.fromRGB(160,116,78),farm ? Enum.Material.Grass : Enum.Material.Sandstone);
		else if(layout.landmark!=="platform") for(let x=-1;x<=1;x++)for(let z=0;z<=1;z++){
			part(scene,"Coastal ground",new Vector3(1400,55,1500),new Vector3(x*1400,12,z*1500-200),Color3.fromRGB(91,119,89),Enum.Material.Grass);
			// Shoreline sheets tile the slab grid exactly (no coplanar overlaps) and
			// only grow outward on the seaward edges.
			for(const [name,ext,y,color,material,transparency,flightSolid] of [["Shallows",220,Scenery.WATERLINE+.4,P.shallow,Enum.Material.SmoothPlastic,.45,false],["Beach",60,Scenery.WATERLINE+1.6,P.sand,Enum.Material.Sand,0,true]] as Array<[string,number,number,Color3,Enum.Material,number,boolean]>){
				const sx=1400+(x===0 ? 0 : ext), cx=x*1400+x*ext/2, sz=1500+ext, cz=z*1500-200+(z===0 ? -ext/2 : ext/2);
				part(scene,name,new Vector3(sx,name==="Beach" ? 3 : .5,sz),new Vector3(cx,y,cz),color,material,{transparency,flightSolid,castShadow:false});
			}
		}
		// Mesas are stacked tiers (base, shoulder, summit, cap) with offset
		// footprints so the walls read as layered rock with stepped ledges.
		const rng=new Random(id*7919);
		const tierColors=farm ? [Color3.fromRGB(96,92,84),Color3.fromRGB(118,110,96),Color3.fromRGB(134,124,106)] : inland ? [Color3.fromRGB(118,80,60),Color3.fromRGB(154,106,74),Color3.fromRGB(186,136,92)] : [Color3.fromRGB(88,86,82),Color3.fromRGB(112,108,100),Color3.fromRGB(132,126,114)];
		for(const r of layout.ridges){
			const [x,z,w,d,h]=r;
			const tiers: Array<[number,number,number]>=[[1,.55,0],[.84,.8,.045],[.66,1,.08]];
			for(let t=0;t<tiers.size();t++){
				const [scale,frac,wobble]=tiers[t];
				const tw=math.min(2000,w*scale), td=math.min(2000,d*scale), th=h*frac;
				const ox=w*wobble*rng.NextNumber(-1,1), oz=d*wobble*rng.NextNumber(-1,1);
				part(scene,t===0 ? "Mesa base" : t===1 ? "Mesa shoulder" : "Mesa summit",new Vector3(tw,th,td),new Vector3(x+ox,th/2-20,z+oz),tierColors[t],t===2 && !farm ? Enum.Material.Sandstone : Enum.Material.Rock);
				if(t===2) part(scene,"Mesa cap",new Vector3(math.max(10,tw-24),8,math.max(10,td-24)),new Vector3(x+ox,h-20+4,z+oz),farm ? Color3.fromRGB(86,119,73) : Color3.fromRGB(196,152,102),farm ? Enum.Material.Grass : Enum.Material.Sandstone);
			}
			// Talus boulders ring the foot of every mesa.
			Scenery.Rocks(scene,id*31+x,P,x,z,math.min(2000,w)+180,math.min(2000,d)+180,floor,4,(px,pz)=>math.abs(px-x)<w/2-10 && math.abs(pz-z)<d/2-10);
		}
		for (let i=1;i<layout.road.size();i++) Scenery.Road(scene,[new Vector3(layout.road[i-1][0],floor+1,layout.road[i-1][1]),new Vector3(layout.road[i][0],floor+1,layout.road[i][1])],25);
		const walls=inland && !farm ? [Color3.fromRGB(206,176,140),Color3.fromRGB(184,150,116),Color3.fromRGB(160,138,118)] : [Color3.fromRGB(146,150,152),Color3.fromRGB(127,139,141),Color3.fromRGB(168,160,146)];
		for (const s of layout.settlements) Scenery.Buildings(scene,id*17+s[0],s[0],s[1],s[2],s[3],floor+1,105,110,walls,night,layout.landmark==="city");
		const fx=layout.focus[0],fz=layout.focus[1];
		if(layout.landmark==="orchard") {
			for(let x=-3;x<=3;x++) for(let z=0;z<5;z++) {
				part(scene,"Farm strip",new Vector3(85,2,100),new Vector3(x*180,45,600-z*220),Color3.fromRGB(116+z*9,127,60),Enum.Material.Grass);
				part(scene,"Orchard trunk",new Vector3(6,16,6),new Vector3(x*180,54,600-z*220),Color3.fromRGB(98,72,46),Enum.Material.Wood);
				part(scene,"Orchard canopy",new Vector3(34,27,34),new Vector3(x*180,74,600-z*220),Color3.fromRGB(65,104+z*5,60),Enum.Material.Grass,{shape:Enum.PartType.Ball});
			}
		} else if(layout.landmark==="runway") {
			part(scene,"Runway",new Vector3(100,4,900),new Vector3(fx,48,fz),Color3.fromRGB(36,45,52),Enum.Material.Asphalt);
			for(let i=-4;i<=4;i++) { part(scene,"Center stripe",new Vector3(4,1,45),new Vector3(fx,50.5,fz+i*95),Color3.fromRGB(239,230,191),Enum.Material.Concrete,{flightSolid:false}); light(scene,new Vector3(fx-47,53,fz+i*95)); light(scene,new Vector3(fx+47,53,fz+i*95)); }
		} else if(layout.landmark==="bridge") {
			// A river with sand banks runs the full depth of the map; the bridge
			// carries the canyon track across it and a dirt road continues east.
			const rx=fx+300;
			for(const z of [-1200,600]) {
				part(scene,"River",new Vector3(160,3,1800),new Vector3(rx,floor+1,z),Color3.fromRGB(52,128,146),Enum.Material.SmoothPlastic,{reflectance:.18,castShadow:false});
				for(const side of [-1,1]) part(scene,"River bank",new Vector3(34,2,1800),new Vector3(rx+side*96,floor+1,z),P.sand,Enum.Material.Sand,{castShadow:false});
			}
			Scenery.Rocks(scene,id*53,P,rx,-300,120,3400,floor-2,8);
			part(scene,"Bridge deck",new Vector3(450,9,45),new Vector3(rx,70,fz),Color3.fromRGB(111,115,108));
			for(const side of [-1,1]) part(scene,"Bridge rail",new Vector3(450,4,2),new Vector3(rx,76.5,fz+side*21.5),Color3.fromRGB(70,74,78),Enum.Material.Metal,{castShadow:false});
			for(const x of [-150,150]) part(scene,"Bridge support",new Vector3(16,50,45),new Vector3(rx+x,45,fz),Color3.fromRGB(98,108,112));
			for(const x of [-205,205]) part(scene,"Bridge abutment",new Vector3(40,26,60),new Vector3(rx+x,58,fz),Color3.fromRGB(120,112,100),Enum.Material.Concrete);
			Scenery.Road(scene,[new Vector3(rx+225,floor+1,fz),new Vector3(rx+560,floor+1,fz+320),new Vector3(rx+900,floor+1,fz+360)],22,Color3.fromRGB(128,104,78));
		} else if(layout.landmark==="array") {
			for(const offset of [-420,420]) {
				const mast=MissionAssets.CreateCommsRelay("Quiet relay mast"); mast.PivotTo(new CFrame(fx+offset,90,fz+220)); mast.Parent=scene;
			}
		} else if(layout.landmark==="harbor" || layout.landmark==="platform") {
			for(let i=-1;i<=1;i++) {
				part(scene,"Quay",new Vector3(240,25,520),new Vector3(fx+i*600,29,fz),Color3.fromRGB(92,110,113));
				Scenery.Crane(scene,fx+i*600+60,fz-120,41.5,0,95);
				Scenery.Containers(scene,id*11+i,fx+i*600-60,fz+60,41.5,3,2,2);
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
		// Ground dressing keeps clear of targets, the landmark focus and the mesas.
		const keepClear=(x: number,z: number): boolean=>near(x,z,fx,fz,260) || bp.ground.some((g)=>near(x,z,g.x,g.z,200)) || layout.ridges.some((r)=>math.abs(x-r[0])<r[2]/2+60 && math.abs(z-r[1])<r[3]/2+60) || layout.settlements.some((s)=>x>s[0]-80 && x<s[0]+s[2]*105+40 && z>s[1]-80 && z<s[1]+s[3]*110+40);
		if(layout.landmark!=="platform") Scenery.Rocks(scene,id*97,P,0,-200,3600,3600,floor,inland ? 16 : 8,keepClear);
		if(farm || bp.region==="coastal_city") Scenery.Trees(scene,id*101,0,-200,3400,3400,floor,farm ? 20 : 12,keepClear);
		if(!inland) Scenery.SeaStacks(scene,id*131,P,8,1800,2400,(x,z)=>z<700 && math.abs(x)<2300);
		Scenery.Mountains(scene,id*151,inland && !farm ? Color3.fromRGB(150,110,84) : farm ? Color3.fromRGB(96,118,96) : Color3.fromRGB(92,104,118),layout.landmark==="platform" ? 6 : 14);
		Scenery.Report(parent,layout.name);
		return {groundTargets};
	},
};
