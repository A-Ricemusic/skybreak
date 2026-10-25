/** Authored compositions. Each ridge is [x,z,width,depth,height]; settlements
 * are [x,z,columns,rows]. Coordinates keep a clear central flight envelope. */
export interface LevelLayout {
	name: string;
	ridges: number[][];
	settlements: number[][];
	road: number[][];
	landmark: "runway" | "bridge" | "orchard" | "array" | "harbor" | "platform" | "city";
	focus: number[];
}
export const LEVEL_LAYOUTS: LevelLayout[] = [
	{name:"Varda training islands",ridges:[],settlements:[],road:[],landmark:"runway",focus:[-650,450]},
	{name:"Iron Coast five quays",ridges:[],settlements:[],road:[],landmark:"harbor",focus:[0,-1100]},
	// M3: the river (x=-550) runs between the west wall and the east mesa; the
	// village road climbs the canyon floor to the bridge, which continues east.
	{name:"Fox switchback",ridges:[[-1500,-300,550,1600,310],[550,-1450,500,1200,240],[1550,200,650,1800,330],[-200,1250,800,450,140]],settlements:[[-900,600,2,2]],road:[[-900,750],[-1150,-200],[-1000,-900],[-660,-900]],landmark:"bridge",focus:[-850,-900]},
	{name:"Hidden quarters bowl",ridges:[[-1450,-1200,650,650,340],[300,-1800,1100,400,380],[1500,-500,550,1400,230]],settlements:[[-850,-400,3,2]],road:[[-1200,600],[-850,-400],[-400,-600]],landmark:"array",focus:[-400,-600]},
	{name:"Teklan orchard terraces",ridges:[[-1600,-1800,650,650,210],[1600,-1600,650,950,220]],settlements:[[-1000,600,3,2],[1000,450,2,3]],road:[[-1000,-300],[0,-850],[1200,-300]],landmark:"orchard",focus:[0,-850]},
	{name:"Grain valley irrigation",ridges:[[-1750,-500,500,1800,260],[1600,-1700,800,600,220]],settlements:[[900,650,3,2]],road:[[500,400],[850,-700],[250,-1550]],landmark:"orchard",focus:[60,-1080]},
	{name:"Dust courier narrows",ridges:[[-1700,-500,650,2200,410],[500,-450,700,1300,320],[1350,-1700,650,900,400]],settlements:[[-1300,500,2,1]],road:[[-450,300],[-1200,-900],[-200,-1900]],landmark:"bridge",focus:[-900,-1000]},
	{name:"Varda tower siege",ridges:[[1400,300,500,1100,260],[-1650,-1500,700,950,310],[800,-1800,800,450,260]],settlements:[[-1150,600,3,2]],road:[[-650,1000],[-650,300],[-650,-800]],landmark:"runway",focus:[-650,300]},
	{name:"Vulture moonlit bowl",ridges:[[-1450,-900,650,1500,400],[1700,-400,500,1700,380],[0,-2100,1600,400,320]],settlements:[[-1000,900,2,2]],road:[[700,700],[1000,-850],[0,-1750]],landmark:"array",focus:[900,-850]},
	{name:"Kiro abandoned mine",ridges:[[-1400,-1200,650,1000,370],[1600,-1100,650,1200,410],[300,1000,1300,350,260]],settlements:[[-900,300,3,2]],road:[[-950,700],[-450,-300],[180,-1100]],landmark:"array",focus:[180,-1100]},
	{name:"Twin ridge relay saddle",ridges:[[-1750,-700,550,1800,390],[1800,-750,500,1800,420],[0,-2100,1300,350,270]],settlements:[[0,750,3,2]],road:[[-820,300],[-820,-780],[820,-780],[820,300]],landmark:"bridge",focus:[0,-780]},
	{name:"Open field refugee corridor",ridges:[[-1800,-1200,450,1500,250],[1700,-1800,600,500,310]],settlements:[[-1200,650,2,3],[900,600,3,2]],road:[[-1200,100],[-500,-900],[900,-1300]],landmark:"orchard",focus:[-500,-900]},
	{name:"Staging farm rail yard",ridges:[[1750,-650,500,1700,300],[-1650,-1700,650,700,320]],settlements:[[-1000,650,3,2]],road:[[-1100,400],[0,-500],[0,-1550],[1100,-1900]],landmark:"bridge",focus:[0,-1000]},
	{name:"High relay crossing",ridges:[[-1750,-600,550,1800,430],[1550,-1500,450,950,420],[0,1000,1500,400,260]],settlements:[[-1000,800,2,1]],road:[[-1000,200],[-1000,-700],[0,-1200],[1000,-1500]],landmark:"array",focus:[0,-1200]},
	{name:"Loyalist broadcast common",ridges:[[-1700,-300,450,1400,260],[1750,-500,500,1300,280],[0,-2150,1800,300,280]],settlements:[[-1000,450,3,3],[900,650,2,2]],road:[[-1200,450],[0,-900],[1200,450]],landmark:"array",focus:[0,-900]},
	{name:"Storm river divide",ridges:[[-1500,-700,650,1800,390],[1600,-1500,600,1000,320]],settlements:[[1000,550,3,1]],road:[[400,500],[800,-750],[0,-1600]],landmark:"bridge",focus:[0,-1050]},
	{name:"Aurora crown array",ridges:[[-1650,-1250,650,1200,440],[1500,-1200,700,1400,420],[0,950,1600,350,260]],settlements:[[-950,600,2,2]],road:[[0,600],[-700,-300],[-100,-1400]],landmark:"array",focus:[-100,-1400]},
	{name:"Vulture searchlight ridge",ridges:[[-1650,-500,650,1800,410],[1650,-800,650,1800,450],[0,-2200,1700,300,360]],settlements:[[-1000,850,2,2]],road:[[-500,300],[0,-1100],[600,-1550]],landmark:"runway",focus:[600,-1550]},
	{name:"Military quays and canal",ridges:[[-2000,-1600,400,1000,220]],settlements:[[-1300,300,3,4],[1250,450,4,3]],road:[[-1500,-100],[-500,-900],[500,-900],[1500,-100]],landmark:"harbor",focus:[0,-1150]},
	{name:"Eastern wing divided harbor",ridges:[[1900,-1900,600,500,190]],settlements:[[-1200,650,4,3],[1000,800,3,4]],road:[[-1400,-600],[0,-1350],[1400,-800]],landmark:"harbor",focus:[0,-1350]},
	{name:"Black canal city",ridges:[[-1900,-1800,450,650,220]],settlements:[[-1450,-200,3,5],[900,-400,4,5]],road:[[-400,500],[-900,-700],[0,-1500]],landmark:"city",focus:[0,-1300]},
	{name:"Five fog fuel piers",ridges:[[1900,700,500,900,190]],settlements:[[-1200,700,3,3],[1100,700,3,2]],road:[[-1400,-200],[0,-1100],[1400,-200]],landmark:"harbor",focus:[0,-1480]},
	{name:"Frigate ring over deep water",ridges:[[1950,1000,600,500,140],[-1900,-1800,500,600,170]],settlements:[],road:[],landmark:"platform",focus:[0,-1100]},
	{name:"Storm platform trident",ridges:[[-2000,1200,650,500,150]],settlements:[],road:[[-480,-900],[0,-1150],[480,-900]],landmark:"platform",focus:[0,-1150]},
	{name:"Dawn beachhead",ridges:[[1750,-1800,650,600,240]],settlements:[[-1300,650,4,3],[1150,700,4,4]],road:[[-1200,200],[-650,-500],[200,-900],[0,-1250]],landmark:"harbor",focus:[200,-900]},
	{name:"Civic plaza blackout",ridges:[[-1950,-1700,450,650,220]],settlements:[[-1250,200,4,5],[1100,300,4,5]],road:[[-1000,700],[0,-1200],[1000,700]],landmark:"city",focus:[0,-1200]},
	{name:"Coastal parliament sunrise",ridges:[[1900,-1850,650,500,200]],settlements:[[-1200,400,4,5],[1200,400,4,5]],road:[[-1200,500],[0,-1350],[1200,500]],landmark:"city",focus:[0,-1350]},
];
export function layoutFor(id: number): LevelLayout { return LEVEL_LAYOUTS[id-1]; }
