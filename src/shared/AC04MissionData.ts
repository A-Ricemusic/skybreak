import type { EnvironmentPreset, FlightPoint } from "./WorldTypes";
import { refineLateMission } from "./ac04/rebuild/LateCampaign";
import { refineMiddleMission } from "./ac04/rebuild/MiddleCampaign";

/** Normal first-play campaign. Unknown source details are never represented as verified. */
export type AC04Domain = "air" | "ground" | "naval" | "missile";
export interface AC04UnitGroup {
	id: string; type: string; domain: AC04Domain; count: number; points: number;
	phase: number; required: boolean; site: string;
	health?: number; speed?: number; path?: FlightPoint[]; protected?: boolean;
	triggerAt?: number; afterGroup?: string; invulnerable?: boolean;
	/** Aggregate authoritative kills in named groups; no client-supplied destruction fraction. */
	afterKills?: { groups: string[]; count: number };
	/** A timer OR preceding-group destruction causes this spawn. */
	triggerMode?: "either" | "both";
	/** Source count or score not established; gameplay value remains a provisional adaptation. */
	provisional?: boolean; note?: string;
}
export interface AC04Phase {
	id: "primary" | "update";
	kind: "targets" | "score" | "return" | "escort" | "missiles" | "escape";
	seconds: number; threshold?: number; requiredGroupIds: string[];
	requiredKills?: number; finishAtTimer?: boolean; startAfterTimer?: boolean;
	special?: string; label: string;
}
export interface AC04Mission {
	id: number; title: string; operation: string; environment: EnvironmentPreset;
	phases: AC04Phase[]; roster: AC04UnitGroup[]; source: string; gaps: string[];
	sRank: number; sRankProvisional?: boolean;
}

const wiki = "https://acecombat.wiki.gg/wiki/";
const G = (id: string, unitType: string, domain: AC04Domain, count: number, points: number, site: string, required = false, phase = 0, extra: Partial<AC04UnitGroup> = {}): AC04UnitGroup => ({ id, type: unitType, domain, count, points, site, required, phase, ...extra });
const P = (kind: AC04Phase["kind"], seconds: number, label: string, groups: string[] = [], threshold?: number, extra: Partial<AC04Phase> = {}): AC04Phase => ({ id: "primary", kind, seconds, label, requiredGroupIds: groups, threshold, ...extra });
const U = (kind: AC04Phase["kind"], seconds: number, label: string, groups: string[] = [], extra: Partial<AC04Phase> = {}): AC04Phase => P(kind, seconds, label, groups, undefined, { id: "update", ...extra });
const S = (seconds: number, threshold: number, label: string): AC04Phase => P("score", seconds, label, [], threshold, { finishAtTimer: true });
const M = (id: number, title: string, operation: string, environment: EnvironmentPreset, phases: AC04Phase[], roster: AC04UnitGroup[], sRank: number, gaps: string[] = [], slug?: string): AC04Mission => ({ id, title, operation, environment, phases, roster, sRank, source: wiki + (slug ?? title.gsub(" ", "_")[0]), gaps });

const missions: AC04Mission[] = [
	M(1, "Sitting Duck", "Umbrella", "ocean_clear", [P("targets",600,"Intercept six bombers",["bombers"])], [
		G("bombers","Tu-95","air",6,100,"bomber-route",true,0,{health:110,speed:70}),
		G("escorts-f5","F-5E","air",2,60,"intercept"),G("escorts-mig","MiG-21","air",2,60,"intercept"),
	],840),
	M(2,"Imminent Threat","Harvest","farm_morning",[P("targets",900,"Destroy parked bombers",["parked-bombers"])],[
		G("parked-bombers","Tu-95","ground",11,120,"apron",true),G("aa","AA GUN","ground",4,20,"airbase"),
		G("hangars","HANGAR","ground",7,50,"airbase"),G("substation","SUBSTATION","ground",1,100,"airbase"),G("tower","CTRL. TOWER","ground",1,100,"airbase"),
		G("f4","F-4","air",2,60,"runway",false,0,{note:"Source aircraft take off from runway; runway launch adapter required."}),G("f5","F-5E","air",3,60,"airbase"),G("mig","MiG-21","air",2,60,"intercept"),
	],2120,["S-rank conflict: dedicated page 2120, mission index 2040; 2120 provisional until capture."]),
	M(3,"The Northern Eye","White Out","farm_overcast",[P("targets",900,"Destroy both radar bases",["radar-east","radar-west"]),U("return",900,"Return south to allied territory",[],{special:"extract-south"})],[
		G("radar-east","RADAR","ground",5,100,"radar-east",true,0,{provisional:true,note:"Total nine verified; 5/4 split inferred from map symbols."}),G("radar-west","RADAR","ground",4,100,"radar-west",true),
		G("aa","AA GUN","ground",5,20,"radar-east"),G("ch47","CH-47","air",1,40,"radar-west"),G("f4","F-4","air",2,60,"intercept"),G("f5","F-5E","air",3,60,"intercept"),G("f16","F-16","air",1,60,"radar-west"),G("f16-reinforcement","F-16","air",2,60,"radar-west",false,0,{afterGroup:"f16"}),
	],1380,["Extraction900seconds corroborated by Neoseeker jgreen walkthrough; dedicated wiki lists primary clock only. https://www.neoseeker.com/acecombat4/faqs/53489-ace-combat-4-jgreen.html"]),
	M(4,"Blockade","Hunting Hawk","farm_morning",[P("targets",720,"Intercept three transports",["transports"],undefined,{special:"airborne-jammers"})],[
		G("transports","C-17","air",3,160,"transport-route",true,0,{health:110,speed:75}),G("jammers","E-767","air",2,140,"jammer-route",false,0,{speed:65}),G("f16","F-16","air",4,60,"intercept"),G("mirage","MIR-2000","air",4,60,"intercept"),G("mig","MiG-29","air",4,60,"intercept"),
	],1280,[],"Blockade_(AC04)"),
	M(5,"Lifeline","Early Bird","city_dawn",[S(600,2000,"Cut the fleet's fuel supply"),U("return",240,"Disengage from Yellow Squadron",[],{special:"yellow-retreat"})],[
		// AC04-M5-STAGE-001: qualitative arrivals backed by Mitoro (Ace); exact Normal splits/delays are adaptation.
		G("f16","F-16","air",2,60,"south-patrol"),
		G("f16-return-1","F-16","air",2,60,"south-patrol",false,0,{afterGroup:"f16",triggerAt:30,triggerMode:"both"}),
		G("f16-return-2","F-16","air",3,60,"south-patrol",false,0,{afterGroup:"f16-return-1",triggerAt:30,triggerMode:"both"}),
		G("mirage","MIR-2000","air",2,60,"rig-patrol"),
		G("mirage-return-1","MIR-2000","air",2,60,"refinery-patrol",false,0,{afterGroup:"mirage",triggerAt:30,triggerMode:"both"}),
		G("mirage-return-2","MIR-2000","air",3,60,"refinery-patrol",false,0,{afterGroup:"mirage-return-1",triggerAt:30,triggerMode:"both"}),
		G("mig-offshore","MiG-29","air",2,60,"rig-patrol",false,0,{afterGroup:"mirage",triggerAt:15,triggerMode:"both"}),
		G("mig","MiG-29","air",3,60,"refinery-patrol",false,0,{afterKills:{groups:["fuel-small","fuel-medium","fuel-large","gas","pumps","refinery","stacks"],count:8},note:"Eight refinery-site kills is an explicit implementation assumption, not a verified Normal trigger."}),
		G("mig-return-1","MiG-29","air",4,60,"refinery-patrol",false,0,{afterGroup:"mig",triggerAt:30,triggerMode:"both"}),
		G("mig-return-2","MiG-29","air",4,60,"refinery-patrol",false,0,{afterGroup:"mig-return-1",triggerAt:30,triggerMode:"both"}),
		G("ka50","Ka-50","air",3,40,"refinery-patrol"),
		G("cranes","CRANE","ground",18,50,"rigs"),G("controls","CTRL. ROOM","ground",11,60,"rigs"),G("towers","TOWER","ground",11,60,"rigs"),
		G("fuel-small","FUEL TANK","ground",6,30,"refinery"),G("fuel-medium","FUEL TANK","ground",9,40,"refinery"),G("fuel-large","FUEL TANK","ground",12,50,"refinery"),G("gas","GAS TANK","ground",4,30,"refinery"),G("pumps","PUMP STN.","ground",2,100,"refinery"),G("refinery","REFINERY","ground",2,60,"refinery"),G("stacks","SMOKESTACK","ground",4,60,"refinery"),G("aa","AA GUN","ground",4,20,"rigs"),G("sam","SAM","ground",1,30,"rigs"),G("tankers","TANKER","naval",2,120,"sea"),G("yellow","Su-37 YELLOW","air",5,150,"north",false,1,{invulnerable:true}),
	],4000,["AC04-M5-STAGE-001: Normal minimum totals retained; 2/2/3 fighter splits, clearance +30s replacements, offshore MiG clearance +15s and eight refinery-site kills are provisional staging assumptions. Mitoro qualitative arrivals are Ace-specific; exact Normal spawn/respawn conditions remain unknown."]),
	M(6,"Invincible Fleet","Rough Seas","harbor_sunset",[S(900,3000,"Strike the Aegir Fleet")],[
		G("f18","F/A-18","air",10,60,"intercept"),G("f14","F-14","air",13,60,"fleet"),G("tornado","TND-IDS","air",5,60,"new-harbor"),G("ka25","Ka-25","air",1,50,"fleet"),
		G("raven","AEGIS RAVEN","naval",1,150,"fleet"),G("geofon","CARRIER GEOFON","naval",1,220,"fleet"),G("tanager","BATTLESHIP TANAGER","naval",1,200,"fleet"),G("cruisers","CRUISER","naval",4,100,"harbor"),G("destroyers","DESTROYER","naval",3,100,"shipyard"),G("beowulf","SUBMARINE","naval",2,120,"harbor"),G("container-ships","CONT. SHIP","naval",2,100,"new-harbor"),G("landing-ships","LNDG. SHIP","naval",2,100,"shipyard"),G("missile-boats","MSSL. BOAT","naval",2,60,"fleet"),G("submarines","SUBMARINE","naval",5,120,"sea"),G("supply","SUPPLY SHIP","naval",1,100,"new-harbor"),
		G("port-cranes","CRANE","ground",12,40,"shipyard",false,0,{provisional:true}),G("containers","CONTAINERS","ground",16,40,"harbor",false,0,{provisional:true}),G("storage","STORAGE","ground",10,40,"new-harbor",false,0,{provisional:true}),G("aa","AA GUN","ground",8,20,"harbor",false,0,{provisional:true}),G("sam","SAM","ground",5,50,"shipyard",false,0,{provisional:true}),
	],5000,["Port unit counts provisional; source table leaves counts blank. Ship component roster and fighter respawn timing unresolved."]),
	M(7,"Deep Strike","Blackout","canyon_noon",[P("targets",900,"Disable the solar plant",["solar-tower","control","radar"]),U("return",600,"Escape below Stonehenge fire",[],{special:"stonehenge-escape"})],[
		G("solar-tower","SOL. TOWER","ground",1,120,"plant",true),G("control","CTRL. ROOM","ground",1,120,"plant",true),G("radar","RADAR","ground",1,100,"plant",true),G("panels","SOL. PANEL","ground",41,15,"solar-field"),G("pillbox","PILLBOX","ground",2,60,"plant"),G("flak","FLAK GUN","ground",2,40,"plant"),G("sam","SAM","ground",2,30,"plant"),G("aa","AA GUN","ground",2,20,"plant"),G("tornado","TND-IDS","air",3,60,"intercept"),G("f16","F-16","air",9,60,"intercept"),G("f15","F-15C","air",8,60,"north"),G("hind","Mi-24","air",10,50,"ravine",false,1),
	],1540,["Detailed Stonehenge salvo schedule requires playback; first volley non-damaging per source."]),
	M(8,"Shattered Skies","Countdown","ocean_clear",[S(420,800,"Secure the launch airspace"),U("targets",360,"Intercept six stealth bombers",["b2"],{finishAtTimer:true})],[
		G("mig","MiG-29","air",12,60,"intercept",false,0,{provisional:true}),G("f15","F-15C","air",12,60,"intercept",false,0,{provisional:true}),G("f18","F/A-18","air",12,60,"intercept",false,0,{provisional:true}),G("f14","F-14","air",12,60,"intercept",false,0,{provisional:true}),G("sr71","SR-71","air",1,200,"north",false,0,{speed:220}),G("e767","E-767","air",1,140,"north"),G("kc10","KC-10","air",1,150,"north"),G("yellow","Su-37 YELLOW","air",5,150,"north",false,0,{invulnerable:true,note:"First damage triggers squadron retreat; no kills."}),G("b2","B-2","air",6,150,"west",true,1,{health:130,speed:90}),
	],2900,["Four fighter type counts are provisional; original table supplies no count. Launch/update timings need engine-reference comparison."]),
	M(9,"Operation Bunker Shot","Bunker Shot","harbor_fog",[S(600,2200,"Support the three beach landings"),U("targets",420,"Stop the attackers over the central beach",["a10"])],[
		G("tanks","TANK","ground",24,50,"beaches",false,0,{provisional:true}),G("batteries","BATTERY","ground",9,80,"beaches",false,0,{provisional:true,note:"80 points verified by Shotgunnova Normal guide lines796–797 and Asahi M09. Count9 remains provisional."}),G("aa","AA GUN","ground",12,20,"beaches",false,0,{provisional:true}),G("sam","SAM","ground",6,30,"beaches",false,0,{provisional:true}),G("pillbox","PILLBOX","ground",9,60,"beaches",false,0,{provisional:true}),G("mig","MiG-29","air",4,60,"intercept",false,0,{provisional:true}),G("f15","F-15C","air",3,60,"intercept",false,0,{provisional:true}),G("tornado","TND-IDS","air",3,60,"intercept",false,0,{provisional:true}),G("hind","Mi-24","air",3,50,"beaches",false,0,{provisional:true}),G("a10","A-10","air",6,100,"north",true,1,{note:"Six aircraft and100points each corroborated by requested Shotgunnova Normal walkthrough,600total."}),G("update-escorts","F-15C","air",4,60,"north",false,1,{provisional:true,note:"Fighter escort presence verified;4 aircraft from Mitoro Ace description, F15 type inferred from aggregate, awaiting Normal comparison."}),
	],4400,["Initial standard-unit table is a stub; initial roster counts are explicitly provisional. Six update A-10 verified."],"Operation_Bunker_Shot_(AC04)"),
	M(10,"Tango Line","Woodpecker","farm_overcast",[S(1200,3000,"Break the Istas defensive line")],[
		G("rafale","R-M01","air",4,60,"intercept"),G("hind","Mi-24","air",12,50,"vtol"),G("f14","F-14","air",3,60,"airbase"),G("harrier","AV-8B","air",15,60,"vtol"),G("chinook","CH-47","air",7,40,"vtol"),G("c130","C-130","air",1,100,"airbase"),G("ef2000","EF-2000","air",4,60,"intercept"),G("f18","F/A-18","air",7,60,"intercept"),
		G("bunkers","BUNKER","ground",18,60,"resupply",false,0,{provisional:true}),G("hangars","HANGAR","ground",12,50,"airbase",false,0,{provisional:true}),G("aa","AA GUN","ground",18,20,"fortress",false,0,{provisional:true}),G("sam","SAM","ground",12,30,"fortress",false,0,{provisional:true}),G("fuel","FUEL TANK","ground",12,40,"resupply",false,0,{provisional:true}),G("subs","SUBMARINE","naval",5,120,"sub-base",false,0,{provisional:true}),G("sub-stores","STORAGE","ground",14,40,"sub-base",false,0,{provisional:true}),G("surfacing-sub","SUBMARINE","naval",1,120,"sub-base",false,0,{afterGroup:"subs",triggerAt:20,triggerMode:"both",provisional:true}),
	],5400,["Ground72/naval20 aggregates verified; type breakdown provisional. Salvos ~300/705/1125 seconds, radio can delay."]),
	M(11,"Escort","Noah's Ark","farm_sunset",[P("escort",330,"Protect both Air Ixiom flights",["wave-1","wave-2","wave-3","wave-4","wave-4-mig"],undefined,{special:"two-airliners"})],[
		G("flight-701","AIR IXIOM 701","air",1,0,"airliner-low",false,0,{protected:true,health:240,speed:32}),G("flight-702","AIR IXIOM 702","air",1,0,"airliner-high",false,0,{protected:true,health:240,speed:32}),
		G("wave-1","F/A-18","air",1,60,"airliner-high",true),G("wave-2","MiG-29","air",2,60,"airliner-low",true,0,{triggerAt:100,afterGroup:"wave-1",triggerMode:"either"}),G("wave-3","F-14","air",3,60,"airliner-high",true,0,{triggerAt:200,afterGroup:"wave-2",triggerMode:"either"}),G("wave-4","Su-35","air",2,60,"airliner-low",true,0,{triggerAt:300,afterGroup:"wave-3",triggerMode:"either"}),G("wave-4-mig","MiG-29","air",2,60,"airliner-low",true,0,{triggerAt:300,afterGroup:"wave-3",triggerMode:"either"}),
	],600,["Success when both protected airliners reach safety at330seconds OR all10 attackers are destroyed. https://acecombat.wiki.gg/wiki/Escort_(AC04)"],"Escort_(AC04)"),
	M(12,"Stonehenge Offensive","Stone Crusher","canyon_noon",[P("targets",900,"Destroy seven operational railguns",["stonehenge"],undefined,{special:"stonehenge-jammer"}),U("targets",600,"Engage Yellow Squadron",["yellow"],{requiredKills:1,special:"yellow-four"})],[
		G("jammer","JAMMER","ground",1,100,"center"),G("stonehenge","STONEHENGE","ground",7,250,"gun-ring",true,0,{health:150}),G("aa","AA GUN","ground",9,30,"gun-ring"),G("sam","SAM","ground",7,30,"gun-ring"),G("rafale","R-M01","air",3,60,"intercept"),G("f15c","F-15C","air",1,60,"intercept"),G("su35","Su-35","air",1,60,"intercept"),G("f15e","F-15E","air",2,60,"intercept"),G("f2","F-2A","air",2,60,"intercept"),G("yellow","Su-37 YELLOW","air",5,150,"north",true,1,{health:150}),
	],2700),
	M(13,"Safe Return","Blindman's Bluff","canyon_dawn",[S(420,1300,"Clear jamming balloons from the ravine"),U("targets",900,"Cover the returning reconnaissance plane",["f15e","ef2000"],{special:"protect-u2"})],[
		G("balloons","JAMMER BALLOON","ground",100,100,"ravine",false,0,{health:8,provisional:true,note:"Current wiki100 versus old wiki115; Ace map157 is not a Normal count."}),G("frigate","FRIGATE","naval",1,100,"river"),G("u2","U-2","air",1,0,"u2-route",false,1,{protected:true,health:220,speed:40}),G("f15e","F-15E","air",2,60,"north",true,1),G("ef2000","EF-2000","air",2,60,"north",true,1),
	],2740,["Balloon count unresolved100/115; missile lock denied but unguided hit may work. Balloon respawn unknown."]),
	M(14,"Breaking Arrows","Aurora","farm_morning",[P("missiles",1200,"Intercept every cruise missile",["missile-1","missile-2","missile-final"],undefined,{special:"missile-boundary"})],[
		G("missile-1","MISSILE","missile",5,100,"missile-north",true,0,{health:20,speed:45}),G("missile-2","MISSILE","missile",10,100,"missile-north",true,0,{health:20,speed:45,afterGroup:"missile-1",note:"Source wave begins after some first-wave kills; exact threshold unresolved."}),G("missile-final","MISSILE","missile",1,200,"missile-north",true,0,{health:30,speed:60,afterGroup:"missile-2"}),G("f22","F-22","air",2,60,"north",false,0,{afterGroup:"missile-2"}),G("xb70","XB-70","air",1,200,"north",false,0,{provisional:true,speed:180,note:"Source table120 conflicts with prose200."}),
	],2020,["Second-wave trigger count and final missile exact evasive path unresolved."]),
	M(15,"Emancipation","Firefly","city_night",[S(600,2000,"Support the liberation of San Salvacion"),U("targets",600,"Intercept six bombers",["tu160"])],[
		G("ef2000","EF-2000","air",15,60,"intercept"),G("su35","Su-35","air",5,60,"intercept"),G("a10","A-10","air",5,60,"airport"),G("yellow","Su-37 YELLOW","air",5,150,"yellow-northeast",false,0,{note:"After four deaths the last Yellow retreats invulnerably."}),G("c17","C-17","ground",7,100,"airport"),G("ka50","Ka-50","air",6,40,"new-city",false,0,{provisional:true}),G("tanks","TANK","ground",18,50,"old-town",false,0,{provisional:true}),G("infantry","INF. TANK","ground",12,40,"new-city",false,0,{provisional:true}),G("launchers","LAUNCHER","ground",4,70,"outskirts",false,0,{provisional:true}),G("aa","AA GUN","ground",12,20,"city",false,0,{provisional:true}),G("sam","SAM","ground",6,30,"city",false,0,{provisional:true}),G("tu160","Tu-160","air",6,160,"west",true,1,{health:150,speed:95}),
	],4160,["Ka50/ground type counts provisional; city/airport/Yellow/bomber structure source-backed."]),
	M(16,"Whiskey Corridor","Sandstorm","canyon_dusk",[S(1200,3500,"Break through the armored defense")],[
		G("tanks","TANK","ground",74,50,"defense-lines"),G("howitzers","HOWITZER","ground",14,50,"artillery"),G("pillboxes","PILLBOX","ground",8,70,"west-line",false,0,{health:230}),G("launchers","LAUNCHER","ground",4,70,"headquarters"),G("tents","TENT","ground",12,40,"headquarters"),G("hq","H.Q","ground",1,100,"headquarters"),G("flak","FLAK GUN","ground",2,40,"defense-lines"),G("sam-heavy","SAM","ground",11,50,"defense-lines"),G("sam","SAM","ground",4,30,"artillery"),G("aa-heavy","AA GUN","ground",10,40,"defense-lines"),G("aa","AA GUN","ground",1,20,"headquarters"),G("sr71","SR-71","air",1,200,"west",false,0,{speed:220}),G("f117","F-117","air",3,60,"north"),G("f22","F-22","air",2,60,"north"),G("a10","A-10","air",2,60,"defense-lines"),G("f2","F-2","air",4,60,"intercept"),G("rafale","R-M01","air",3,60,"intercept"),G("tornado","TND-IDS","air",7,60,"intercept"),G("apache","AH-64","air",3,50,"defense-lines"),
	],6300,[],"Whiskey_Corridor_(mission)"),
	M(17,"Siege of Farbanti","Autumn Thunder","city_evening",[S(720,2100,"Open the approaches to Erusean headquarters"),U("targets",1080,"Defeat Yellow Squadron",["yellow"])],[
		G("apache","AH-64","air",4,50,"city"),G("f22","F-22","air",6,60,"intercept"),G("ef2000","EF-2000","air",6,60,"intercept"),G("active","F-15 ACTIVE","air",3,45,"north"),G("osprey","V-22","air",4,50,"headquarters",false,0,{triggerAt:600}),G("armor","TANK","ground",30,50,"bridges",false,0,{provisional:true}),G("aa","AA GUN","ground",15,20,"city",false,0,{provisional:true}),G("sam","SAM","ground",10,50,"headquarters",false,0,{provisional:true}),G("battleship","BATTLESHIP","naval",1,220,"harbor",false,0,{provisional:true,note:"Ship-type split inferred from walkthrough; total580 corroborated."}),G("destroyer","DESTROYER","naval",1,120,"harbor",false,0,{provisional:true}),G("subs","SUBMARINE","naval",2,120,"flooded",false,0,{provisional:true}),G("bridge","JOHNSON BRIDGE","ground",1,100,"johnson",false,0,{provisional:true}),G("yellow","Su-37 YELLOW","air",5,150,"north",true,1,{health:260}),
	],4250,["Ground55/ships4 aggregates available; split, bridge scoring and exact reinforcement trigger provisional."]),
	M(18,"Megalith","Judgement Day","ocean_clear",[P("targets",1200,"Destroy three internal generators",["generator-west","generator-east","generator-north"]),U("escape",1800,"Destroy the central missile and escape",["core"],{special:"megalith-core"})],[
		G("yellow","Su-37 YELLOW","air",15,90,"intercept"),G("generator-west","GENERATOR","ground",1,500,"generator-west",true),G("generator-east","GENERATOR","ground",1,500,"generator-east",true),G("generator-north","GENERATOR","ground",1,500,"generator-north",true),G("ports","MISSILE PORT","ground",6,0,"fortress"),G("secondary-missiles","MISSILE SILO","ground",4,500,"silos",false,1),G("core","MEGALITH MISSILE","ground",1,990,"core",true,1,{health:150}),
	],4290,["Tunnel cross-sections and physical scale adapted; require reference comparison at speed."],"Megalith_(mission)"),
];

missions[1].sRankProvisional = true;
missions[9].phases[0].special = "stonehenge-periodic";
// AC04-MIDDLE-REBUILD: M6-M12 roster/staging refinements (docs/reviews/ac04-middle-rebuild.json).
for (let i = 0; i < missions.size(); i++) missions[i] = refineLateMission(refineMiddleMission(missions[i]));

export const AC04MissionData = {
	Count: 18,
	All(): readonly AC04Mission[] { return missions; },
	Get(id: number): AC04Mission { assert(id >= 1 && id <= 18 && id === math.floor(id), "Invalid AC04 mission"); return missions[id - 1]; },
	InstanceId(group: AC04UnitGroup, index: number): string { return `${group.id}_${index + 1}`; },
	MaximumSeconds(id: number): number { let total=0; for (const p of missions[id-1].phases) total+=p.seconds; return total; },
};
