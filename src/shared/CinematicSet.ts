import type { StoryMood, StoryScene, StoryShot } from "./RelayStory";
import type { Rgb, ShotPose } from "./CinematicStaging";

/**
 * Set dressing for the Broken Relay cutscenes (docs/specs/cutscene-assets.md): which
 * already-approved uploaded models stand around the radio desk in each scene, the
 * stage ground, a per-mood colour grade and a per-shot depth of field. Plain numbers
 * and names only (no engine types), so the offline Luau runner can check them; the
 * client converts at the edge and falls back to the old part-built backdrop whenever
 * a model has not replicated. Desk-relative studs, like CinematicStaging.
 */

/** Approved, uploaded world models the backdrops may use (RobloxAssetIds entries that are set). */
export type BackdropAsset = "OfficeMidrise" | "ApartmentBlock" | "CityTower" | "Farmhouse" | "Barn" | "GrainSilo" | "Broadleaf"
	| "Pine" | "RockA" | "RockB" | "RockC" | "RelayMast" | "RadarDish" | "HarbourQuay" | "ContainerStack" | "GantryCrane"
	| "Frigate";
export const BACKDROP_ASSETS: BackdropAsset[] = ["OfficeMidrise", "ApartmentBlock", "CityTower", "Farmhouse", "Barn", "GrainSilo",
	"Broadleaf", "Pine", "RockA", "RockB", "RockC", "RelayMast", "RadarDish", "HarbourQuay", "ContainerStack", "GantryCrane",
	"Frigate"];
/** One placed model: ground contact at (x, 0, z), turned `yaw` radians, uniformly scaled. */
export interface BackdropItem { asset: BackdropAsset; x: number; z: number; yaw: number; scale: number; }

/** Not-yet-uploaded Blender desk props (assets/roblox-upload/cinematic-*); each keeps its procedural stand-in until its ID exists. */
export type CinematicPropAsset = "CinematicRadioConsole" | "CinematicFieldRecorder" | "CinematicStatusBoard" | "CinematicTapeTin";
export const CINEMATIC_PROPS: CinematicPropAsset[] = ["CinematicRadioConsole", "CinematicFieldRecorder", "CinematicStatusBoard", "CinematicTapeTin"];
/** The anchor each prop's checklist records for seating it on its stand-in's spot. */
export const PROP_ANCHOR: Record<CinematicPropAsset, string> = {
	CinematicRadioConsole: "Body", CinematicFieldRecorder: "Centre", CinematicStatusBoard: "Board", CinematicTapeTin: "Centre",
};
/** Receiver centre on the desk (the procedural receiver's position). */
export const RECEIVER = { x: 0, y: 7, z: 0 } as const;
/** Lid opening for the recovered recorder (CinematicStaging.recorderOpen), radians about the hinge. */
export const RECORDER_LID_OPEN = 1.9;

const item = (asset: BackdropAsset, x: number, z: number, yaw = 0, scale = 1): BackdropItem => ({ asset, x, z, yaw, scale });
const PI = math.pi;
/**
 * Two bands: behind the desk (-z, seen by the wide, sky, chair and recorder shots) and in
 * front of it (+z, the radio shot's background, which used to be empty floor). Everything
 * stands at least 150 studs from the desk and clear of the story subject's spot (70, -110).
 */
const SETS: Record<Exclude<StoryScene, "hangar" | "sea">, BackdropItem[]> = {
	city: [
		item("CityTower", -180, -245, .3), item("OfficeMidrise", 40, -270), item("ApartmentBlock", 230, -280, -.2), item("OfficeMidrise", -300, -120, PI / 2),
		item("ApartmentBlock", -70, 300, PI), item("OfficeMidrise", 160, 280, PI + .3), item("CityTower", -260, 250, PI),
	],
	farm: [
		item("Barn", -170, -230, .4), item("GrainSilo", -60, -290, .1), item("Farmhouse", 210, -210, -.5), item("Farmhouse", -160, 240, PI),
		item("Barn", 160, 270, PI - .3),
	],
	canyon: [
		item("RockC", -210, -260, .3, 7), item("RockB", -20, -245, 1.1, 5.5), item("RockA", 180, -250, -.4, 7), item("RockB", 270, -60, 2, 5),
		item("RockC", -280, -50, .8, 6), item("RockB", -130, 255, .5, 6), item("RockC", 90, 265, 2.4, 7), item("RockA", 285, 250, 1.7, 6),
	],
	relay: [
		item("Pine", -150, -220), item("Pine", -112, -252, 1.3, 1.15), item("Pine", -190, -275, 2.2, .9), item("RadarDish", -30, -290, .6),
		item("Pine", 210, -260, .4, 1.1), item("Pine", 250, -228, 2.9), item("Pine", -80, 250, .7, 1.2), item("Pine", -40, 285, 1.9),
		item("RockA", 30, 300, .9, 3), item("Pine", 130, 262, 2.5, 1.1), item("Pine", 175, 300, .2),
	],
	harbor: [
		item("HarbourQuay", -60, -270), item("GantryCrane", -130, -245), item("ContainerStack", 120, -235, .2), item("ContainerStack", 168, -258),
		item("ContainerStack", -100, 240, PI / 2), item("ContainerStack", -55, 300, PI / 2 + .1), item("GantryCrane", 180, 290, PI / 2),
	],
};
/** Broadleaf orchard rows on the farm; once it burns (CinematicStaging.orchardBurned) charred stumps stand in for them. */
const ORCHARD: BackdropItem[] = [
	item("Broadleaf", 40, -190, .2), item("Broadleaf", 80, -195, 1.4, .9), item("Broadleaf", 120, -188, 2.6), item("Broadleaf", 160, -192, .9, 1.1),
	item("Broadleaf", 50, -240, 2), item("Broadleaf", 95, -236, .5, 1.05), item("Broadleaf", 140, -244, 1.8, .95),
	item("Broadleaf", -60, 200, .3), item("Broadleaf", -20, 206, 2.2, .9), item("Broadleaf", 20, 198, 1.1), item("Broadleaf", 60, 204, 2.9, 1.1),
];
/** Where the orchard's trees stand, for the charred stumps once it has burned. */
export const ORCHARD_SPOTS: { x: number; z: number }[] = ORCHARD.map((tree) => ({ x: tree.x, z: tree.z }));
/** The chapter "The frigate ring" (RelayStory); its sea is ringed with frigates. */
export const FRIGATE_RING_CHAPTER = 8;
/** Ships at sea: the frigate ring, and a lone picket for any other sea chapter. */
const SEA: Record<"ring" | "picket", BackdropItem[]> = {
	ring: [item("Frigate", -260, -400, .4, .5), item("Frigate", 210, -440, -.3, .5), item("Frigate", 430, -150, 1.4, .5), item("Frigate", -120, 420, 1.2, .5)],
	picket: [item("Frigate", -240, -420, .4, .5)],
};
/** The relay mast ring around the subject: five masts (the sixth stood in the wide shot's way), alternately taller. */
export function relayMasts(): BackdropItem[] {
	const masts: BackdropItem[] = [];
	for (let i = 0; i < 6; i++) {
		if (i === 2) continue;
		const ang = i / 6 * PI * 2;
		masts.push(item("RelayMast", 70 + math.cos(ang) * 75, -110 + math.sin(ang) * 75, PI / 2 - ang, i % 2 === 0 ? .3 : .36));
	}
	return masts;
}
/** Uploaded models standing around the desk for a chapter; the hangar scene has the uploaded hangar instead. */
export function backdropFor(scene: StoryScene, id: number, burned: boolean): BackdropItem[] {
	if (scene === "hangar") return [];
	if (scene === "sea") return SEA[id === FRIGATE_RING_CHAPTER ? "ring" : "picket"];
	const items = [...SETS[scene]];
	if (scene === "farm" && !burned) for (const tree of ORCHARD) items.push(tree);
	if (scene === "relay") for (const mast of relayMasts()) items.push(mast);
	return items;
}

/** Stage ground per scene (the old stage was one slate slab everywhere); the client tints it to the mood. */
export type GroundMaterial = "Concrete" | "Sandstone" | "Grass" | "Ground" | "Rock" | "Asphalt" | "Glass";
export interface StageGround { material: GroundMaterial; color: Rgb; reflectance: number; }
export function stageGround(scene: StoryScene, burned: boolean): StageGround {
	switch (scene) {
		case "sea": return { material: "Glass", color: { r: 16, g: 38, b: 70 }, reflectance: .25 };
		case "canyon": return { material: "Sandstone", color: { r: 150, g: 108, b: 76 }, reflectance: 0 };
		case "farm": return burned ? { material: "Ground", color: { r: 54, g: 46, b: 40 }, reflectance: 0 } : { material: "Grass", color: { r: 84, g: 104, b: 60 }, reflectance: 0 };
		case "relay": return { material: "Rock", color: { r: 98, g: 104, b: 102 }, reflectance: 0 };
		case "city": return { material: "Asphalt", color: { r: 54, g: 58, b: 62 }, reflectance: 0 };
		case "harbor": return { material: "Concrete", color: { r: 112, g: 114, b: 112 }, reflectance: 0 };
		default: return { material: "Concrete", color: { r: 64, g: 66, b: 68 }, reflectance: 0 };
	}
}

/** A local ColorCorrection stacked on the world's grade, plus soft sun rays at the low-sun moods. */
export interface MoodGrade { tint: Rgb; saturation: number; contrast: number; brightness: number; sunRays?: { intensity: number; spread: number }; }
const GRADES: Record<StoryMood, MoodGrade> = {
	dawn: { tint: { r: 255, g: 238, b: 224 }, saturation: .04, contrast: .06, brightness: 0, sunRays: { intensity: .06, spread: .6 } },
	day: { tint: { r: 252, g: 253, b: 255 }, saturation: .06, contrast: .05, brightness: 0 },
	dusk: { tint: { r: 255, g: 230, b: 208 }, saturation: .08, contrast: .08, brightness: 0, sunRays: { intensity: .08, spread: .7 } },
	night: { tint: { r: 216, g: 228, b: 255 }, saturation: -.12, contrast: .1, brightness: .02 },
	storm: { tint: { r: 226, g: 232, b: 238 }, saturation: -.2, contrast: .08, brightness: 0 },
};
export function moodGrade(mood: StoryMood): MoodGrade { return GRADES[mood]; }

/** DepthOfField settings for a shot, or undefined (wide, sky and cards stay sharp edge to edge). */
export interface ShotDepth { focusDistance: number; inFocusRadius: number; farIntensity: number; nearIntensity: number; }
const DEPTH: Partial<Record<StoryShot, { radius: number; far: number }>> = {
	radio: { radius: 10, far: .18 }, chair: { radius: 6, far: .3 }, recorder: { radius: 3, far: .4 }, evidence: { radius: 3, far: .45 },
};
export function shotDepth(shot: StoryShot, pose: ShotPose): ShotDepth | undefined {
	const d = DEPTH[shot];
	if (d === undefined) return undefined;
	const dx = pose.eye.x - pose.focus.x, dy = pose.eye.y - pose.focus.y, dz = pose.eye.z - pose.focus.z;
	return { focusDistance: math.sqrt(dx * dx + dy * dy + dz * dz), inFocusRadius: d.radius, farIntensity: d.far, nearIntensity: 0 };
}
/** Neutral settings while no depth shot is on screen. */
export const NO_DEPTH: ShotDepth = { focusDistance: 50, inFocusRadius: 50, farIntensity: 0, nearIntensity: 0 };

/** Half-width of the square stage slab: the sea is a larger slab so the ships stand on water out to the storm fog. */
export function stageHalf(scene: StoryScene): number { return scene === "sea" ? 1000 : 350; }
/** The harbour's strip of water behind the quay (desk-relative z range); the rest of the harbour stage is concrete. */
export const HARBOUR_WATER = { z0: -350, z1: -306 } as const;

/**
 * Part-built stand-in for one backdrop model whose upload has not replicated (or failed to
 * place), so a partial load still leaves every spot dressed. Boxes in the item's frame: `offset`
 * is the box centre above the ground contact (before yaw), sized from the asset's in-game size.
 */
export type StandInMaterial = "Concrete" | "Metal" | "Grass" | "Slate" | "Wood" | "Neon";
export interface StandInPart { name: string; size: Vec3; offset: Vec3; color: Rgb; material: StandInMaterial; }
interface Vec3 { x: number; y: number; z: number; }
const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const c = (r: number, g: number, b: number): Rgb => ({ r, g, b });
const BUILDING: Partial<Record<BackdropAsset, Rgb>> = {
	OfficeMidrise: c(118, 124, 132), ApartmentBlock: c(150, 138, 122), CityTower: c(96, 108, 122), Farmhouse: c(196, 186, 162),
	Barn: c(132, 52, 42), GrainSilo: c(176, 178, 174), HarbourQuay: c(128, 126, 120), ContainerStack: c(150, 84, 54),
};
const CITY: BackdropAsset[] = ["OfficeMidrise", "ApartmentBlock", "CityTower"];
/** `size` is the asset's in-game size (UploadedAssetSpecs) times the item's scale; `groundOffset` likewise. */
export function standInParts(asset: BackdropAsset, size: Vec3, groundOffset: number): StandInPart[] {
	// Parts cannot exceed 2,048 studs on a side; real placements stay far below that.
	const w = math.min(size.x, 2000), d = math.min(size.z, 2000), h = math.clamp(size.y - groundOffset, 1, 2000);
	const building = BUILDING[asset];
	if (building) {
		const parts: StandInPart[] = [{ name: `${asset} stand-in`, size: v3(w * .95, h, d * .95), offset: v3(0, h / 2, 0), color: building, material: "Concrete" }];
		// A few lit window strips on both long faces so a city stand-in reads as inhabited at any mood.
		if (CITY.includes(asset)) for (let i = 0; i < 3; i++) for (const side of [-1, 1])
			parts.push({ name: "Window strip", size: v3(w * .6, 1.2, .4), offset: v3(0, h * (.35 + i * .22), side * (d * .475 + .3)), color: (i + (side > 0 ? 1 : 0)) % 3 === 0 ? c(255, 120, 200) : c(120, 230, 255), material: "Neon" });
		return parts;
	}
	switch (asset) {
		case "Broadleaf":
		case "Pine": {
			const green = asset === "Pine" ? c(46, 74, 48) : c(78, 112, 58);
			return [
				{ name: `${asset} trunk`, size: v3(w * .1, h * .4, w * .1), offset: v3(0, h * .2, 0), color: c(92, 70, 52), material: "Wood" },
				{ name: `${asset} crown`, size: v3(w * (asset === "Pine" ? .6 : .85), h * .65, d * (asset === "Pine" ? .6 : .85)), offset: v3(0, h * .65, 0), color: green, material: "Grass" },
			];
		}
		case "RockA":
		case "RockB":
		case "RockC": return [{ name: `${asset} stand-in`, size: v3(w * .85, h * .9, d * .85), offset: v3(0, h * .45, 0), color: c(132, 104, 82), material: "Slate" }];
		case "RelayMast": return [
			{ name: "Antenna mast", size: v3(2, h, 2), offset: v3(0, h / 2, 0), color: c(150, 156, 160), material: "Metal" },
			{ name: "Mast yard", size: v3(w * .5, 1, 1), offset: v3(0, h * .85, 0), color: c(150, 156, 160), material: "Metal" },
		];
		case "RadarDish": return [
			{ name: "Dish pedestal", size: v3(w * .25, h * .5, d * .25), offset: v3(0, h * .25, 0), color: c(170, 172, 168), material: "Concrete" },
			{ name: "Dish", size: v3(w * .9, h * .45, 2), offset: v3(0, h * .72, 0), color: c(214, 216, 212), material: "Metal" },
		];
		case "GantryCrane": return [
			{ name: "Crane leg", size: v3(w * .15, h * .6, d * .15), offset: v3(-w * .4, h * .3, 0), color: c(196, 150, 48), material: "Metal" },
			{ name: "Crane leg", size: v3(w * .15, h * .6, d * .15), offset: v3(w * .4, h * .3, 0), color: c(196, 150, 48), material: "Metal" },
			{ name: "Crane boom", size: v3(w, h * .1, d * .95), offset: v3(0, h * .65, 0), color: c(196, 150, 48), material: "Metal" },
		];
		default: {
			// Ships: a grey hull riding at the waterline (the ground contact), a superstructure and a mast.
			return [
				{ name: `${asset} hull`, size: v3(w * .9, h * .14, d * .95), offset: v3(0, h * .07, 0), color: c(110, 116, 122), material: "Metal" },
				{ name: `${asset} superstructure`, size: v3(w * .6, h * .22, d * .3), offset: v3(0, h * .25, 0), color: c(140, 146, 150), material: "Metal" },
				{ name: `${asset} mast`, size: v3(2, h * .35, 2), offset: v3(0, h * .53, 0), color: c(90, 94, 98), material: "Metal" },
			];
		}
	}
}
/** Part-built stand-in for the chapter's story subject when its model is missing; boxes from its ground contact. */
export function subjectStandInParts(subject: "RelayTruck" | "HarborLaunch" | "CommsRelay"): StandInPart[] {
	if (subject === "RelayTruck") return [
		{ name: "Truck cab", size: v3(16, 11, 9), offset: v3(0, 6.5, -12), color: c(92, 104, 88), material: "Metal" },
		{ name: "Truck body", size: v3(17, 15, 22), offset: v3(0, 8.5, 4), color: c(120, 126, 112), material: "Metal" },
	];
	if (subject === "HarborLaunch") return [
		{ name: "Launch hull", size: v3(24, 9, 54), offset: v3(0, 4.5, 0), color: c(70, 78, 86), material: "Metal" },
		{ name: "Launch cabin", size: v3(15, 9, 18), offset: v3(0, 13.5, 6), color: c(176, 180, 176), material: "Metal" },
	];
	return [
		{ name: "Relay base", size: v3(20, 4, 20), offset: v3(0, 2, 0), color: c(140, 140, 136), material: "Concrete" },
		{ name: "Relay mast", size: v3(4, 86, 4), offset: v3(0, 47, 0), color: c(150, 156, 160), material: "Metal" },
		{ name: "Relay yard", size: v3(24, 1.5, 1.5), offset: v3(0, 80, 0), color: c(150, 156, 160), material: "Metal" },
	];
}
/**
 * Dress every backdrop spot: `place` tries the uploaded model and reports whether it stood up;
 * a miss or an error builds that spot's stand-in instead, so partial availability never leaves a
 * gap (the old stage fell back only when nothing at all had placed).
 */
export function dressBackdrop(items: BackdropItem[], place: (item: BackdropItem) => boolean, standIn: (item: BackdropItem) => void): { uploaded: BackdropItem[]; standIns: BackdropItem[] } {
	const uploaded: BackdropItem[] = [], standIns: BackdropItem[] = [];
	for (const it of items) {
		const [ok, placed] = pcall(() => place(it));
		if (ok && placed === true) uploaded.push(it);
		else { standIn(it); standIns.push(it); }
	}
	return { uploaded, standIns };
}
