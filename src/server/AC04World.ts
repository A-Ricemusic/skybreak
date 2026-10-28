import { Workspace } from "@rbxts/services";
import { AC04MissionData, type AC04UnitGroup } from "../shared/AC04MissionData";
import { AC04WorldPlanner } from "../shared/AC04WorldData";
import type { FlightPoint } from "../shared/WorldTypes";
import type { PartSpec } from "../shared/WorldPlan";
import { middleDeckMounted } from "../shared/ac04/rebuild/MiddleCampaign";
import { Scenery } from "./Scenery";
import { TerrainWriter, material } from "./TerrainWriter";
import { WorldEnvironment } from "./WorldEnvironment";

/** Every assembly here is authored native Roblox geometry; no uploaded meshes. */
const STEEL=Color3.fromRGB(111,126,134), DARK=Color3.fromRGB(41,51,61), PALE=Color3.fromRGB(194,199,199), OLIVE=Color3.fromRGB(102,116,85);
function cube(model:Model,name:string,size:Vector3,position:Vector3,color=STEEL,mat:Enum.Material=Enum.Material.Metal,solid=true,shape?:Enum.PartType):BasePart {
	return Scenery.Part(model,name,size,position,color,mat,{flightSolid:solid,shape});
}
function aircraft(aircraftType:string,name:string):Model {
	const model=new Instance("Model");model.Name=name;model.SetAttribute("GeometrySource","NativeProcedural");model.SetAttribute("AircraftType",aircraftType);
	const large=aircraftType==="Tu-95"||aircraftType==="Tu-160"||aircraftType==="B-2"||aircraftType==="C-17"||aircraftType==="E-767"||aircraftType==="KC-10"||aircraftType.find("IXIOM")[0]!==undefined||aircraftType==="XB-70";
	const helicopter=aircraftType==="Ka-25"||aircraftType==="Ka-50"||aircraftType==="Mi-24"||aircraftType==="CH-47"||aircraftType==="AH-64"||aircraftType==="V-22";
	const missile=aircraftType==="MISSILE";
	const yellow=aircraftType.find("YELLOW")[0]!==undefined;
	const scale=large?2.1:missile?.4:helicopter?.7:1;
	const paint=yellow?Color3.fromRGB(145,148,144):aircraftType==="B-2"||aircraftType==="F-117"?DARK:PALE;
	const root=cube(model,"Fuselage",new Vector3(8,7,42).mul(scale),Vector3.zero,paint);model.PrimaryPart=root;
	cube(model,"Nose",new Vector3(5,5,16).mul(scale),new Vector3(0,0,-25).mul(scale),paint);
	if(helicopter){
		cube(model,"Cockpit",new Vector3(9,7,12).mul(scale),new Vector3(0,2,-10).mul(scale),Color3.fromRGB(56,95,111),Enum.Material.Glass);
		cube(model,"Rotor",new Vector3(65,1,3).mul(scale),new Vector3(0,9,0).mul(scale),DARK);
		cube(model,"Rotor cross",new Vector3(3,1,65).mul(scale),new Vector3(0,9,0).mul(scale),DARK);
		cube(model,"Tail",new Vector3(3,5,30).mul(scale),new Vector3(0,0,28).mul(scale),paint);
	}else{
		const span=aircraftType==="U-2"?95:aircraftType==="B-2"?68:large?52:aircraftType==="F-14"?44:36;
		cube(model,"Wings",new Vector3(span,2,12).mul(scale),new Vector3(0,-1,2).mul(scale),paint);
		if(aircraftType==="B-2"){
			for(const side of [-1,1])Scenery.Part(model,"Flying wing",new Vector3(24,3,29).mul(scale),new CFrame(new Vector3(side*18,-1,-2).mul(scale)).mul(CFrame.Angles(0,side*.55,0)),paint,Enum.Material.Metal,{className:"WedgePart"});
		}else{
			cube(model,"Tailplane",new Vector3(21,1.5,7).mul(scale),new Vector3(0,1,18).mul(scale),paint);
			const twin=aircraftType.find("F-15")[0]!==undefined||aircraftType.find("F-22")[0]!==undefined||aircraftType.find("Su-")[0]!==undefined||aircraftType==="F-14"||aircraftType==="F/A-18";
			for(const x of twin?[-5,5]:[0])cube(model,"Vertical tail",new Vector3(1.5,12,10).mul(scale),new Vector3(x,6,17).mul(scale),yellow?Color3.fromRGB(220,177,61):paint);
		}
		if(!missile)cube(model,"Canopy",new Vector3(6,5,10).mul(scale),new Vector3(0,5,-12).mul(scale),Color3.fromRGB(70,118,137),Enum.Material.Glass);
		for(const x of large?[-19,-10,10,19]:[-5,5]){
			cube(model,"Engine",new Vector3(4,4,15).mul(scale),new Vector3(x,-3,8).mul(scale),DARK);
			if(aircraftType==="Tu-95")cube(model,"Propeller",new Vector3(1,14,1).mul(scale),new Vector3(x,-3,-1).mul(scale),DARK);
		}
		if(aircraftType==="E-767")cube(model,"Radar disc",new Vector3(26,4,26).mul(scale),new Vector3(0,11,7).mul(scale),DARK,Enum.Material.Metal,true,Enum.PartType.Ball);
	}
	model.PivotTo(new CFrame());return model;
}
function target(g:AC04UnitGroup,index:number):{model:Model;height:number} {
	const name=`${g.type} ${index+1}`;
	if(g.type==="Tu-95"||g.type==="C-17")return {model:aircraft(g.type,name),height:10};
	const m=new Instance("Model");m.Name=name;m.SetAttribute("GeometrySource","NativeProcedural");m.SetAttribute("AC04GroupId",g.id);
	let height=24;
	if(g.domain==="naval"){
		const carrier=g.type.find("CARRIER")[0]!==undefined,sub=g.type.find("SUBMARINE")[0]!==undefined,length=carrier?250:sub?135:170,width=carrier?70:sub?24:45;height=12;
		m.PrimaryPart=cube(m,"Hull",new Vector3(width,24,length),Vector3.zero,STEEL);
		cube(m,"Deck",new Vector3(width*.85,6,length*.85),new Vector3(0,17,0),DARK);
		cube(m,"Bridge",new Vector3(width*.45,sub?20:40,length*.2),new Vector3(carrier?25:0,sub?22:34,10),STEEL);
		if(!sub)cube(m,"Mast",new Vector3(4,55,4),new Vector3(0,65,10),STEEL);
		if(carrier)for(let k=0;k<7;k++)cube(m,"Flight deck marking",new Vector3(3,1,12),new Vector3(-10,21,-80+k*24),PALE,Enum.Material.SmoothPlastic,false);
	}else if(g.type==="JOHNSON BRIDGE"){
		height=28;m.PrimaryPart=cube(m,"Johnson Memorial Bridge deck",new Vector3(130,18,900),Vector3.zero,CONCRETE(),Enum.Material.Concrete);
		for(let k=-2;k<=2;k++)cube(m,"Bridge pier",new Vector3(32,80,32),new Vector3(0,-43,k*180),CONCRETE(),Enum.Material.Concrete);
	}else if(g.type==="STONEHENGE"){
		height=40;m.PrimaryPart=cube(m,"Railgun turntable",new Vector3(105,50,105),Vector3.zero,STEEL);
		cube(m,"Railgun housing",new Vector3(65,55,110),new Vector3(0,40,0),PALE);
		cube(m,"Rail barrel",new Vector3(18,18,310),new Vector3(0,65,-145),DARK);
		for(const x of [-15,15])cube(m,"Rail conductor",new Vector3(7,22,290),new Vector3(x,65,-145),PALE);
	}else if(g.type==="JAMMER BALLOON"){
		height=0;m.PrimaryPart=cube(m,"Airship envelope",new Vector3(38,27,65),Vector3.zero,Color3.fromRGB(193,191,162),Enum.Material.Fabric,true,Enum.PartType.Ball);
		cube(m,"Jammer pod",new Vector3(15,9,18),new Vector3(0,-22,0),DARK);
	}else if(g.type==="RADAR"||g.type==="JAMMER"){
		height=22;m.PrimaryPart=cube(m,"Pedestal",new Vector3(20,44,20),Vector3.zero,CONCRETE());
		cube(m,"Radar reflector",new Vector3(55,35,9),new Vector3(0,40,0),PALE);
		cube(m,"Receiver",new Vector3(4,4,20),new Vector3(0,40,-15),DARK);
	}else if(g.type==="SOL. PANEL"){
		height=5;m.PrimaryPart=cube(m,"Solar collector",new Vector3(62,10,55),Vector3.zero,Color3.fromRGB(54,87,113),Enum.Material.Glass);
	}else if(g.type==="GUN"){
		// AC04-MIDDLE-REBUILD: Tanager deck gun turret (wiki: 3 GUN components).
		height=10;m.PrimaryPart=cube(m,"Gun turret",new Vector3(24,12,28),Vector3.zero,STEEL);
		cube(m,"Gun barrels",new Vector3(12,5,36),new Vector3(0,3,-30),DARK);
	}else if(g.type==="TANK"||g.type==="INF. TANK"||g.type==="HOWITZER"||g.type==="AA GUN"||g.type==="SAM"||g.type==="LAUNCHER"||g.type==="FLAK GUN"){
		height=8;m.PrimaryPart=cube(m,"Chassis",new Vector3(21,14,36),Vector3.zero,OLIVE);
		cube(m,"Turret",new Vector3(14,10,16),new Vector3(0,12,0),OLIVE);
		cube(m,"Barrel",new Vector3(g.type==="SAM"?10:3,3,32),new Vector3(0,15,-19),DARK);
		if(!middleDeckMounted(g))for(const x of [-12,12])cube(m,"Tracks",new Vector3(5,10,37),new Vector3(x,-2,0),DARK);
	}else if(g.type==="FUEL TANK"||g.type==="GAS TANK"){
		height=25;const body=Scenery.Cylinder(m,"Storage tank",52,50,Vector3.zero,PALE,Enum.Material.Metal);m.PrimaryPart=body;
	}else if(g.type==="GENERATOR"){
		height=0;m.PrimaryPart=cube(m,"Generator core",new Vector3(80,90,60),Vector3.zero,STEEL);
		cube(m,"Generator light",new Vector3(65,50,5),new Vector3(0,0,-33),Color3.fromRGB(102,205,216),Enum.Material.Neon);
	}else if(g.type==="MEGALITH MISSILE"||g.type==="MISSILE SILO"){
		height=0;m.PrimaryPart=Scenery.Cylinder(m,"Missile body",g.type==="MEGALITH MISSILE"?65:30,160,Vector3.zero,PALE,Enum.Material.Metal);
		cube(m,"Warhead",new Vector3(50,50,50),new Vector3(0,90,0),DARK,Enum.Material.Metal,true,Enum.PartType.Ball);
	}else if(g.type==="CRANE"){
		height=50;m.PrimaryPart=cube(m,"Crane tower",new Vector3(12,100,12),Vector3.zero,Color3.fromRGB(195,156,61));
		cube(m,"Crane arm",new Vector3(110,10,10),new Vector3(30,50,0),Color3.fromRGB(195,156,61));
	}else{
		height=g.type==="SMOKESTACK"||g.type==="SOL. TOWER"?100:g.type==="TENT"?12:30;
		m.PrimaryPart=cube(m,g.type,new Vector3(g.type==="SMOKESTACK"?20:60,height*2,60),Vector3.zero,g.type==="TENT"?OLIVE:CONCRETE(),g.type==="TENT"?Enum.Material.Fabric:Enum.Material.Concrete);
		if(height===30)cube(m,"Roof",new Vector3(68,5,68),new Vector3(0,32,0),DARK);
	}
	// Upright cylinders have a rotated native CFrame. Preserve that orientation
	// when the model pivot is moved to its authored world position.
	if(m.PrimaryPart)m.PrimaryPart.PivotOffset=m.PrimaryPart.CFrame.Inverse();
	m.PivotTo(new CFrame());return {model:m,height};
}
function CONCRETE():Color3{return Color3.fromRGB(138,145,143);}
function plannedPart(parent:Instance,p:PartSpec):void{
	const options={flightSolid:p.solid,transparency:p.transparency,reflectance:p.reflectance};
	const color=Color3.fromRGB(p.color[0],p.color[1],p.color[2]);
	if(p.shape==="cylinder")Scenery.Cylinder(parent,p.name,p.sx,p.sy,new Vector3(p.x,p.y,p.z),color,material(p.material),options);
	else Scenery.Part(parent,p.name,new Vector3(p.sx,p.sy,p.sz),new CFrame(p.x,p.y,p.z).mul(CFrame.Angles(0,p.yaw,0)),color,material(p.material),{...options,className:p.shape==="wedge"?"WedgePart":"Part",shape:p.shape==="ball"?Enum.PartType.Ball:Enum.PartType.Block});
}
export interface AC04GroundTarget {id:string;groupId:string;model:Model}
function visible(model:Model,show:boolean):void{
	for(const item of model.GetDescendants())if(item.IsA("BasePart")){
		if(item.GetAttribute("NativeTransparency")===undefined)item.SetAttribute("NativeTransparency",item.Transparency);
		if(item.GetAttribute("NativeFlightSolid")===undefined)item.SetAttribute("NativeFlightSolid",item.GetAttribute("FlightSolid")===true);
		item.Transparency=show?item.GetAttribute("NativeTransparency") as number:1;
		item.CanQuery=show&&item.GetAttribute("NativeFlightSolid")===true;
	}
	model.SetAttribute("AC04Visible",show);
}
export const AC04World={
	CreateAircraft:aircraft,
	SetVisible:visible,
	Build(id:number,parent:Instance,isCurrent?:()=>boolean):{groundTargets:AC04GroundTarget[];spawn:FlightPoint;returnZ:number}{
		const started=os.clock(),m=AC04MissionData.Get(id),layout=AC04WorldPlanner.Layout(id),plan=AC04WorldPlanner.Build(id);
		assert(isCurrent===undefined||isCurrent(),"AC04 build cancelled before terrain");
		for(const old of parent.GetChildren())if(old.GetAttribute("AC04WorldOwned")===true)old.Destroy();
		Workspace.FindFirstChild("World")?.Destroy();Workspace.Terrain.Clear();WorldEnvironment.Apply(m.environment);
		for(const [name,color]of plan.materialColors)Workspace.Terrain.SetMaterialColor(material(name),Color3.fromRGB(color[0],color[1],color[2]));
		const timing=TerrainWriter.Write(plan.ops);
		assert(isCurrent===undefined||isCurrent(),"AC04 build cancelled after terrain");
		const scene=new Instance("Folder");scene.Name=plan.name;scene.SetAttribute("AC04WorldOwned",true);scene.Parent=parent;
		for(const p of plan.parts)plannedPart(scene,p);
		const groundTargets:AC04GroundTarget[]=[];
		for(const g of m.roster)if(g.domain==="ground"||g.domain==="naval")for(let i=0;i<g.count;i++){
			const a=AC04WorldPlanner.UnitPosition(id,g,i),built=target(g,i),model=built.model;
			let yaw=0;if(id===12&&g.id==="stonehenge")yaw=math.atan2(-a.x,-(a.z+300));
			model.PivotTo(new CFrame(a.x,a.y+built.height,a.z).mul(CFrame.Angles(0,yaw,0)));model.Parent=parent;
			model.SetAttribute("AC04GroupId",g.id);model.SetAttribute("AC04UnitId",AC04MissionData.InstanceId(g,i));model.SetAttribute("SourceProvisional",g.provisional===true);
			model.SetAttribute("AC04WorldOwned",true);visible(model,g.phase===0&&g.triggerAt===undefined&&g.afterGroup===undefined&&g.afterKills===undefined);
			groundTargets.push({id:AC04MissionData.InstanceId(g,i),groupId:g.id,model});
			if(groundTargets.size()%20===0){task.wait();assert(isCurrent===undefined||isCurrent(),"AC04 build cancelled during actors");}
		}
		parent.SetAttribute("CampaignId","ac04");parent.SetAttribute("MissionId",id);parent.SetAttribute("MapScaleStatus",layout.scaleStatus);parent.SetAttribute("MapReference",layout.evidence.url);parent.SetAttribute("WorldBuildSeconds",os.clock()-started);parent.SetAttribute("WorldTerrainLongest",timing.longest);parent.SetAttribute("WorldNativeOnly",true);
		Scenery.Report(parent,plan.name,1600);
		return {groundTargets,spawn:layout.spawn,returnZ:layout.returnZ};
	},
};
