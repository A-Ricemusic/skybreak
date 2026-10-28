import { AC04MissionData, type AC04UnitGroup } from "./AC04MissionData";
import type { FlightPoint } from "./WorldTypes";
import type { Rgb } from "./EnvironmentPresets";
import type { PartSpec, TerrainMaterial, WorldPlan } from "./WorldPlan";
import { refineEarlyLayout, refineEarlyUnitPosition, refineEarlyWorld } from "./ac04/rebuild/EarlyWorld";
import { refineLateLayout, refineLateUnitPosition, refineLateWorld } from "./ac04/rebuild/LateWorld";
import { middleDeckMounted } from "./ac04/rebuild/MiddleCampaign";
import { refineMiddleLayout, refineMiddleUnitPosition, refineMiddleWorld } from "./ac04/rebuild/MiddleWorld";

export interface AC04MapEvidence {
	url: string; difficulty: "Ace"; inspected: boolean;
	/** Target-sector topology is useful across difficulties; counts are not imported. */
	use: string; confidence: "sector-layout" | "text-only";
}
export interface AC04Layout {
	spawn: FlightPoint; returnZ: number; bounds: number;
	sites: { [name: string]: FlightPoint };
	escape?: FlightPoint; escapeRadius?: number;
	stonehengeCeiling: number; evidence: AC04MapEvidence;
	/** Explicitly provisional until reference and device traversal measurements. */
	scaleStatus: "adapted-not-surveyed";
}
const V = (x: number, y: number, z: number): FlightPoint => ({x,y,z});
const LAND=64, SEA=32, LIMIT=3800;
const CONCRETE:Rgb=[132,142,145], STEEL:Rgb=[88,101,113], MARK:Rgb=[211,216,201];
const layouts: AC04Layout[]=[];
function L(id:number, sites:{[name:string]:FlightPoint}, spawn=V(0,950,2600), returnZ=3200):AC04Layout {
	const common:{[name:string]:FlightPoint}={center:V(0,LAND,0),north:V(0,900,-2400),west:V(-2600,900,0),intercept:V(0,900,-500),sea:V(2000,SEA,800),...sites};
	return {spawn,returnZ,bounds:LIMIT,sites:common,stonehengeCeiling:400,scaleStatus:"adapted-not-surveyed",evidence:{url:`https://mitoro.sakura.ne.jp/ac04/data/m${id<10?"0":""}${id}.htm`,difficulty:"Ace",inspected:true,use:id===6?"Coastline and harbor-sector silhouette inspected; scaled authoring is approximate.":id===7?"Ravine topology and plant-sector placement inspected; height/width adapted.":"Map target-sector topology, never difficulty-specific counts. Terrain relief inferred from mission text.",confidence:"sector-layout"}};
}
layouts.push(L(1,{"bomber-route":V(0,1100,-200),airbase:V(-700,LAND,600),settlement:V(750,LAND,1100)}));
layouts.push(L(2,{airbase:V(-400,LAND,-1200),apron:V(-1500,LAND,-1200),runway:V(-200,LAND,-1200)}));
layouts.push(L(3,{"radar-east":V(1700,650,-1700),"radar-west":V(-2300,850,-2100)},V(2200,1200,2300)));
layouts.push(L(4,{"transport-route":V(0,1200,-1200),"jammer-route":V(0,1300,-1200),windmills:V(-1200,LAND,800)}));
layouts.push(L(5,{refinery:V(-2100,LAND,-1300),rigs:V(2100,110,-1300),sea:V(1800,SEA,100),"south-patrol":V(0,1100,1000),"rig-patrol":V(2100,1200,-1800),"refinery-patrol":V(-2100,1100,-1800)},V(0,1100,2400),3400));
layouts.push(L(6,{harbor:V(-1550,SEA,350),"new-harbor":V(300,SEA,-1800),shipyard:V(1750,SEA,-700),fleet:V(300,SEA,2150),sea:V(2300,SEA,1400)},V(-1500,950,2800)));
layouts.push(L(7,{plant:V(-700,LAND,-1700),"solar-field":V(300,LAND,-1700),ravine:V(0,180,600)},V(0,1100,2500)));
layouts.push(L(8,{launch:V(800,LAND,300),island:V(800,LAND,300),west:V(-2900,1200,-300)},V(0,1200,2600)));
layouts.push(L(9,{beaches:V(0,LAND,300),"beach-west":V(-2300,LAND,850),"beach-center":V(0,LAND,50),"beach-east":V(2500,LAND,-300)},V(0,1100,2600)));
layouts.push(L(10,{airbase:V(650,600,1900),vtol:V(2000,300,-500),"sub-base":V(-900,SEA,-1900),resupply:V(-1900,LAND,500),fortress:V(0,LAND,0)},V(0,1100,3000)));
layouts.push(L(11,{"airliner-low":V(-2300,1200,-2300),"airliner-high":V(-2100,2600,-2200)},V(0,1600,900)));
layouts.push(L(12,{"gun-ring":V(0,LAND,-300),center:V(0,LAND,-300)},V(0,1050,2600)));
layouts.push(L(13,{ravine:V(0,LAND,350),river:V(2000,SEA,300),"u2-route":V(-2300,600,-2000)},V(0,700,2500)));
layouts.push(L(14,{"missile-north":V(0,350,-2400)},V(0,800,-1200)));
layouts.push(L(15,{"new-city":V(-1500,LAND,100),"old-town":V(1500,LAND,100),airport:V(0,LAND,-2100),city:V(0,LAND,200),outskirts:V(2300,LAND,-1300),"yellow-northeast":V(2400,1000,-2200),west:V(-3000,1050,-1800)}));
layouts.push(L(16,{"defense-lines":V(0,LAND,150),"west-line":V(-2300,LAND,1000),artillery:V(1400,LAND,-1700),headquarters:V(0,LAND,-2300)},V(0,1000,2600)));
layouts.push(L(17,{city:V(0,LAND,-300),headquarters:V(0,LAND,-1000),harbor:V(2100,SEA,300),flooded:V(-1400,SEA,1200),bridges:V(900,LAND,500),johnson:V(0,LAND,-1850),silver:V(1650,LAND,800)},V(0,1200,2650)));
layouts.push(L(18,{fortress:V(0,LAND,0),"generator-west":V(-420,220,0),"generator-east":V(420,220,0),"generator-north":V(0,220,-420),core:V(0,220,180),silos:V(900,LAND,700),"tunnel-west":V(-1600,220,0),"tunnel-east":V(1600,220,0),"tunnel-north":V(0,220,-1600),"tunnel-center":V(0,220,1600),escape:V(0,700,0)},V(0,1250,2700)));
layouts[17].escape=V(0,700,0);layouts[17].escapeRadius=250;
layouts[14].evidence.inspected=true;layouts[14].evidence.confidence="sector-layout";
// AC04-MIDDLE-REBUILD: applied once, after base layouts are constructed.
for(let i=0;i<layouts.size();i++)layouts[i]=refineLateLayout(i+1,refineMiddleLayout(i+1,refineEarlyLayout(i+1,layouts[i])));

function part(plan:WorldPlan,name:string,p:FlightPoint,size:FlightPoint,color:Rgb=CONCRETE,material="Concrete",solid=true,shape:PartSpec["shape"]="block",yaw=0):void {
	plan.parts.push({name,shape,x:p.x,y:p.y,z:p.z,sx:size.x,sy:size.y,sz:size.z,yaw,color,material,solid,grounded:false});
}
function block(plan:WorldPlan, material:TerrainMaterial,x:number,y:number,z:number,sx:number,sy:number,sz:number):void {plan.ops.push({shape:"block",material,x,y,z,sx,sy,sz,yaw:0});}
function hill(plan:WorldPlan,x:number,z:number,rx:number,rz:number,height:number,material:TerrainMaterial="Grass",base=LAND):void {
	// Native terrain wedges avoid millions of Lua-side voxel reads per mountain.
	// Their coarse profiles are deliberately marked adapted, not surveyed relief.
	// A wedge can be split across X without changing its Z slope. Keep each
	// native fill below the terrain engine's unsplit region limit.
	const maxWidth=math.max(4,math.min(256,math.floor(128000000/math.max(1,height*rz))));
	const count=math.ceil(rx*2/maxWidth),width=rx*2/count;
	for(let i=0;i<count;i++){
		const cx=x-rx+(i+.5)*width;
		plan.ops.push({shape:"wedge",material,x:cx,y:base+height/2,z:z-rz/2,sx:width,sy:height,sz:rz,yaw:0});
		plan.ops.push({shape:"wedge",material,x:cx,y:base+height/2,z:z+rz/2,sx:width,sy:height,sz:rz,yaw:math.pi});
	}
}
function land(plan:WorldPlan,x:number,z:number,sx:number,sz:number,top=LAND,material:TerrainMaterial="Grass"):void{block(plan,material,x,top-8,z,sx,16,sz);}
function ocean(plan:WorldPlan):void {block(plan,"Sand",0,-32,0,8000,64,8000);block(plan,"Water",0,16,0,8000,32,8000);plan.waterY=SEA;}
function runway(plan:WorldPlan,p:FlightPoint,yaw=0):void {
	land(plan,p.x,p.z,850,1600,p.y);
	block(plan,"Air",p.x,p.y+600,p.z,850,1200,1600);
	part(plan,"Runway",V(p.x,p.y+2,p.z),V(150,4,1400),[42,48,52],"Asphalt",true,"block",yaw);
	for(let k=-6;k<=6;k++) part(plan,"Runway center stripe",V(p.x,p.y+4.2,p.z+k*90),V(6,.3,40),MARK,"SmoothPlastic",false);
	for(let k=-1;k<=1;k++) {part(plan,"Hangar shell",V(p.x-270,p.y+40,p.z+k*240),V(180,80,160));part(plan,"Hangar door",V(p.x-175,p.y+32,p.z+k*240),V(3,60,120),STEEL,"Metal");}
	part(plan,"Airfield tower",V(p.x+220,p.y+65,p.z+450),V(50,130,50));part(plan,"Tower cab",V(p.x+220,p.y+140,p.z+450),V(78,25,78),[56,101,121],"Glass");
}
function buildings(plan:WorldPlan,center:FlightPoint,nx:number,nz:number,flooded=false):void {
	for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
		const h=45+((i*31+j*53)%7)*22,x=center.x+(i-(nx-1)/2)*155,z=center.z+(j-(nz-1)/2)*155;
		let occupied=false;for(const g of AC04MissionData.Get(plan.id).roster)if(g.domain==="ground"||g.domain==="naval")for(let k=0;k<g.count;k++){
			const a=unitPosition(plan.id,g,k);if(math.abs(a.x-x)<115&&math.abs(a.z-z)<115)occupied=true;
		}if(occupied)continue;
		part(plan,flooded?"Flooded building":"City block",V(x,center.y+h/2-(flooded?35:0),z),V(90,h,95),[105+i%3*12,112+j%3*10,118],"Concrete");
		if(!flooded)part(plan,"Window ribbon",V(x,center.y+h*.6,z+48),V(70,4,1),[205,190,130],"Neon",false);
	}
}
function bridge(plan:WorldPlan,name:string,p:FlightPoint,length:number,yaw=0):void {
	part(plan,name,V(p.x,p.y+28,p.z),V(130,18,length),[102,112,119],"Concrete",true,"block",yaw);
	for(let i=-2;i<=2;i++)part(plan,name+" pier",V(p.x,p.y-15,p.z+i*length/5),V(32,80,32),CONCRETE,"Concrete");
}
function coastTiles(plan:WorldPlan,polygon:number[][]):void {
	// Rasterize an authored coastline to bounded terrain blocks. Coordinates are
	// approximate normalized control points from the inspected map, not exact tracing.
	const inside=(x:number,z:number):boolean=>{let hit=false;for(let i=0,j=polygon.size()-1;i<polygon.size();j=i++){
		const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
	}return hit;};
	for(let x=-3600;x<=3600;x+=240)for(let z=-3600;z<=3600;z+=240)if(inside(x,z))land(plan,x,z,248,248);
}
function unitPosition(id:number,g:AC04UnitGroup,index:number):FlightPoint {
	const mission=AC04MissionData.Get(id),layout=layouts[id-1];
	return refineLateUnitPosition(mission,layout,g,index,refineMiddleUnitPosition(mission,layout,g,index,refineEarlyUnitPosition(mission,layout,g,index,baseUnitPosition(id,g,index))));
}
function baseUnitPosition(id:number,g:AC04UnitGroup,index:number):FlightPoint {
	const l=layouts[id-1];let s=l.sites[g.site]??l.sites.center;
	if(id===6&&g.domain==="ground")s=g.site==="harbor"?V(-1100,LAND,350):g.site==="shipyard"?V(1200,LAND,-700):V(300,LAND,-1500);
	if(id===10&&g.id==="sub-stores")s=V(-900,LAND,-2750);
	if(id===18 && (g.id.find("generator")[0]!==undefined ||g.id==="core"))return {...s};
	if(id===18&&g.id==="ports")return V(index%2===0?-350:350,430,650+math.floor(index/2)*400);
	if(id===18&&g.id==="secondary-missiles")return V(index%2===0?-1050:1050,530,index<2?-1050:1050);
	if(id===12&&g.id==="stonehenge") {const a=(index+1)*math.pi/4;return V(math.cos(a)*650,s.y, s.z+math.sin(a)*650);}
	if(id===12&&(g.id==="aa"||g.id==="sam")){const a=index*math.pi*2/g.count+(g.id==="sam"?.2:0),r=g.id==="aa"?400:500;return V(math.cos(a)*r,LAND,-300+math.sin(a)*r);}
	if(id===13&&g.id==="balloons")return V(-2900+(index%10)*620,170+((index*43)%9)*90,-1100+math.floor(index/10)*300);
	if(id===1&&g.id==="bombers")return V(index%2===0?-180:180,1050+math.floor(index/2)*130,700-math.floor(index/2)*900);
	if(id===4&&g.id==="jammers")return V(index===0?-1450:1450,1300,-250);
	if(id===4&&g.id==="transports")return V((index-1)*2700,1200,-250);
	if(id===9&&g.domain==="ground") {
		let slot=index;for(const prior of AC04MissionData.Get(id).roster){if(prior===g)break;if(prior.domain==="ground"&&prior.phase===g.phase)slot+=prior.count;}
		const b=l.sites[slot%3===0?"beach-west":slot%3===1?"beach-center":"beach-east"];
		return V(b.x+(math.floor(slot/3)%4)*110-165,LAND,b.z-math.floor(slot/12)*150);
	}
	if(id===16&&g.id==="tanks") {const k=index%3;return V(-2000+k*1850+(math.floor(index/3)%6)*85,LAND,950-k*750-math.floor(index/18)*110);}
	if(id===14&&g.domain==="missile")return V((index%5-2)*160+(g.id==="missile-2"?(index<5?-900:900):0),280+(index%3)*45,-2400-math.floor(index/5)*160);
	if(g.protected)return {...s};
	// Stable, disjoint slots across groups sharing a sector, avoiding collocated
	// hulls/tanks while preserving phase-local encounter identity.
	let offset=0,total=0,seen=false;
	for(const other of AC04MissionData.Get(id).roster)if(other.site===g.site&&other.domain===g.domain&&other.phase===g.phase){
		if(other.id===g.id)seen=true;if(!seen)offset+=other.count;total+=other.count;
	}
	const slot=offset+index,columns=g.domain==="air"?7:5;
	const col=slot%columns,row=math.floor(slot/columns),spread=g.domain==="naval"?300:g.domain==="air"?260:g.type==="Tu-95"?150:100;
	const dx=(col-(math.min(total,columns)-1)/2)*spread,dz=(row-(math.ceil(total/columns)-1)/2)*spread;
	const y=g.domain==="air"?math.max(s.y,650)+(index%3)*120:g.domain==="naval"?SEA:math.max(s.y,LAND);
	return V(math.clamp(s.x+dx,-3300,3300),y,math.clamp(s.z+dz,-2900,2800));
}

function build(id:number):WorldPlan {
	const m=AC04MissionData.Get(id),l=layouts[id-1];
	const p:WorldPlan={id,name:`AC04 ${m.title}`,theme:"coast",environment:m.environment,lamps:id===15,ground:LAND,ops:[],parts:[],props:[],targets:[],waterPaths:[],groundPaths:[],air:[],materialColors:[["Grass",[73,101,68]],["Rock",[103,107,111]],["Sand",[172,157,121]]]};
	const seaMaps=new Set([1,4,5,6,8,9,10,17,18]);
	if(seaMaps.has(id))ocean(p);else {land(p,0,0,8000,8000,LAND,id===12||id===16?"Sand":"Grass");p.theme=id===12||id===16?"plateau":"farm";}
	if(id===1){hill(p,-500,500,1800,2000,180,"Grass",0);land(p,-700,600,850,1600);runway(p,l.sites.airbase);buildings(p,l.sites.settlement,5,4);hill(p,2250,-1900,850,1000,320,"Grass",0);}
	if(id===2){runway(p,l.sites.runway);for(let i=0;i<6;i++)hill(p,-3000+i*1100,-2800,700,800,230);}
	if(id===3){p.theme="plateau";for(const name of ["radar-east","radar-west"]){const s=l.sites[name];hill(p,s.x,s.z,1150,1000,s.y-LAND,"Rock");land(p,s.x,s.z,650,550,s.y,"Snow");}for(let k=0;k<5;k++)hill(p,-2700+k*1300,-2900,900,750,550,"Snow");}
	if(id===4){land(p,-1400,800,4200,5000);for(let i=0;i<8;i++){const x=-2800+i*450;part(p,"Windmill mast",V(x,LAND+80,900),V(8,160,8),MARK,"Metal");part(p,"Windmill rotor",V(x,LAND+150,900),V(105,7,7),MARK,"Metal");}hill(p,-2500,-1000,1300,1500,240);}
	if(id===5){land(p,-2400,-700,2700,5500);for(let k=0;k<5;k++){const x=1650+(k%2)*700,z=-2200+math.floor(k/2)*800;part(p,"Offshore platform",V(x,100,z),V(520,20,520),STEEL,"Metal");for(const dx of [-210,210])for(const dz of [-210,210])part(p,"Platform leg",V(x+dx,48,z+dz),V(30,100,30),CONCRETE,"Metal");}part(p,"Rig service connections",V(2100,100,-1300),V(660,20,1650),STEEL,"Metal");part(p,"Refinery service apron",V(-2100,65,-1300),V(1500,2,1800));}
	if(id===6){coastTiles(p,[[-3800,2150],[-1300,2050],[-1500,950],[-1900,500],[-1650,-200],[-900,-600],[-450,-1800],[500,-2700],[650,-1400],[1250,-900],[1900,-800],[1800,-400],[850,-200],[450,1700],[-600,2000],[800,2150],[1200,3000],[800,3800],[-3800,3800]]);for(const name of ["harbor","new-harbor","shipyard"]){const s=l.sites[name];part(p,"Harbor quay",V(s.x+180,SEA+10,s.z),V(200,40,1100));for(let i=0;i<4;i++)part(p,"Dock finger",V(s.x-120,SEA+10,s.z+(i-1.5)*260),V(500,30,90));}}
	if(id===7){p.theme="canyon";for(let z=-3000;z<=3000;z+=600){const bend=math.sin(z/900)*400;hill(p,bend-1100,z,850,700,650,"Sandstone");hill(p,bend+1100,z,850,700,700,"Sandstone");}land(p,-300,-1700,1400,1500);part(p,"Solar service road",V(-300,LAND+1,-1700),V(900,2,900),[71,76,78],"Asphalt");}
	if(id===8){hill(p,800,300,1400,1800,100,"Grass",0);land(p,800,300,900,1200);part(p,"Launch pad",V(800,LAND+3,300),V(300,6,300));part(p,"Launch vehicle",V(800,LAND+180,300),V(42,360,42),MARK,"Metal",true,"cylinder");part(p,"Launch gantry",V(900,LAND+160,300),V(40,320,90),STEEL,"Metal");hill(p,-1500,-1700,1000,900,230,"Grass",0);}
	if(id===9){for(const name of ["beach-west","beach-center","beach-east"]){const s=l.sites[name];land(p,s.x,s.z-1500,2600,3100);land(p,s.x,s.z+120,2600,240,LAND-16,"Sand");hill(p,s.x-1100,s.z-400,500,1200,430,"Rock");for(let k=0;k<3;k++)part(p,"Allied landing craft",V(s.x+(k-1)*250,SEA+10,s.z+800+k*150),V(60,20,130),[82,104,88],"Metal",false);}}
	if(id===10){p.theme="canyon";land(p,0,0,8000,8000);for(let i=0;i<8;i++){const a=i*math.pi/4;hill(p,math.cos(a)*2100,math.sin(a)*2100,850,850,750,"Rock");}runway(p,l.sites.airbase);for(let k=0;k<4;k++){const s=l.sites.vtol;land(p,s.x+(k%2)*200,s.z+math.floor(k/2)*240,180,200,s.y,"Concrete");}block(p,"Air",-900,420,-1900,1000,1000,1400);block(p,"Water",-900,16,-1900,1000,32,1400);}
	if(id===11){p.theme="farm";for(let i=0;i<6;i++)hill(p,-3000+i*1200,-500,700,1000,300);runway(p,V(2200,LAND,2500));}
	if(id===12){p.theme="plateau";part(p,"Stonehenge central service platform",V(0,LAND+4,-300),V(1500,8,1500),[114,117,112],"Concrete");for(let k=0;k<8;k++){const a=k*math.pi/4,x=math.cos(a)*650,z=-300+math.sin(a)*650;part(p,k===0?"Destroyed eighth railgun foundation":"Railgun foundation",V(x,LAND+10,z),V(160,20,160),CONCRETE,"Concrete",true,"cylinder");if(k===0)part(p,"Ruined eighth barrel",V(x+45,LAND+28,z),V(220,35,38),[59,61,60],"CorrodedMetal",true,"block",.7);}}
	if(id===13){p.theme="canyon";
		// Ridges sit between balloon flight lanes. Inferred relief must never
		// bury the low jammers that the player is required to find visually.
		for(let lane=0;lane<11;lane++)hill(p,-3210+lane*620,0,190,2200,540+(lane%4)*80,"Rock");
		block(p,"Air",2000,250,300,280,650,6200);block(p,"Water",2000,16,300,280,32,6200);
	}
	if(id===14){p.theme="farm";for(let i=0;i<8;i++){hill(p,-2800,i*750-2900,600,600,250);hill(p,2800,i*750-2900,600,600,320);}for(let i=0;i<4;i++)part(p,"Coast highway",V(0,LAND+1,-2400+i*1600),V(90,2,1600),[62,67,70],"Asphalt");}
	if(id===15){buildings(p,l.sites["new-city"],9,6);buildings(p,l.sites["old-town"],9,6);runway(p,l.sites.airport);part(p,"Government plaza",V(-1500,LAND+3,100),V(450,6,500),[163,153,137],"Concrete");}
	if(id===16){p.theme="plateau";for(let i=0;i<7;i++){hill(p,-3200,-2700+i*850,650,800,700,"Rock");hill(p,3200,-2700+i*850,650,800,650,"Sandstone");}for(let k=0;k<3;k++)part(p,"Defensive earthwork",V(-2000+k*1850,LAND+10,1000-k*750),V(900,20,35),[136,113,80],"Sand");}
	if(id===17){land(p,800,-1600,4900,4000);land(p,1400,700,2700,1800);buildings(p,V(700,LAND,-700),9,6);buildings(p,V(-1400,SEA,1200),7,5,true);bridge(p,"Silver Bridge",l.sites.silver,950);part(p,"Headquarters landfill",V(0,LAND-20,-1000),V(650,40,500),[119,130,115],"Concrete");}
	if(id===18){
		land(p,0,0,3300,3300,90,"Rock");
		// Four thick quadrants leave a 360-stud cross corridor. The center is an
		// open vertical shaft; the south approach is opened by the runtime gate.
		for(const x of [-850,850])for(const z of [-850,850]){
			part(p,"Megalith armored quadrant",V(x,260,z),V(1340,340,1340),[80,90,98],"Concrete");
		}
		for(const x of [-900,900])part(p,"East-west tunnel roof",V(x,440,0),V(1400,32,360),STEEL,"Metal");
		for(const z of [-900,900])part(p,"North-south tunnel roof",V(0,440,z),V(360,32,1400),STEEL,"Metal");
		part(p,"AC04CoreGate",V(0,250,650),V(356,320,26),[111,122,133],"Metal");
		for(const x of [-1750,1750])for(const z of [-1200,1200])part(p,"Fortress seawall",V(x,120,z),V(100,200,1000),CONCRETE,"Concrete");
		// Open portal gaps are essential: no perimeter wall crosses tunnel axes.
		for(const x of [-1200,1200])for(const z of [-1750,1750])part(p,"Fortress sea defenses",V(x,120,z),V(1000,200,100),CONCRETE,"Concrete");
	}
	// AC04-MIDDLE-REBUILD: replaces M6-M12 base geometry before final target clearance.
	refineEarlyWorld(m,l,p);
	refineMiddleWorld(m,l,p);
	refineLateWorld(m,l,p);
	let targetIndex=0;
	for(const g of m.roster)if(g.domain==="ground"||g.domain==="naval")for(let i=0;i<g.count;i++){
		const a=unitPosition(id,g,i);p.targets.push({index:targetIndex++,x:a.x,z:a.z,baseY:a.y,apron:0,deck:g.domain==="naval"||g.site==="rigs"||middleDeckMounted(g)});
		if(g.domain==="ground" && id!==18 && g.type!=="JAMMER BALLOON" && g.site!=="rigs" && !middleDeckMounted(g)){
			const pad=g.type==="Tu-95"?140:90;land(p,a.x,a.z,pad,pad,a.y,"Concrete");
			block(p,"Air",a.x,a.y+500,a.z,pad,1000,pad);
		}
		if(g.domain==="naval"){
			// Ensure an authored berth remains water even at a coarse coastline edge.
			block(p,"Air",a.x,120,a.z,180,320,340);block(p,"Water",a.x,16,a.z,180,32,340);
		}
	}
	// Coarse quays must not cover a ship's physical berth. Decorative fingers
	// yield to actual collision geometry until individual source berths are traced.
	p.parts=p.parts.filter((item)=>{
		const quay=item.name==="Dock finger"||item.name==="Harbor quay";
		const airportDecoration=item.name==="Hangar shell"||item.name==="Hangar door"||item.name==="Airfield tower"||item.name==="Tower cab";
		if(!quay&&!airportDecoration)return true;
		for(const g of m.roster)if(g.domain===(quay?"naval":"ground"))for(let i=0;i<g.count;i++){
			const a=unitPosition(id,g,i);if(math.abs(item.x-a.x)<item.sx/2+(quay?70:65)&&math.abs(item.z-a.z)<item.sz/2+(quay?150:65))return false;
		}return true;
	});
	p.air.push({x:l.spawn.x,z:l.spawn.z,limit:l.spawn.y-100,rad:100,label:"AC04 sortie spawn"});
	return p;
}
export const AC04WorldPlanner={
	Layout(id:number):AC04Layout{AC04MissionData.Get(id);return layouts[id-1];},
	Build:build,
	UnitPosition:unitPosition,
};
