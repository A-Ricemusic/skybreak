import type { SpeakerTone, StoryMood, StoryScene, StoryShot } from "./RelayStory";
import { STORY, TEAL } from "./RelayStory";

/**
 * Pure staging tables for the Broken Relay cutscenes: mood lighting, camera
 * poses per shot and the small per-frame rules (reel spin, recorder blink,
 * typed-out lines, props that change with the story). Plain numbers only, no
 * engine types, so the offline Luau runner can check them; the client converts
 * to Vector3/Color3 at the edge. The original poses were checked in-engine at
 * desktop and phone aspect (see docs/broken-relay.md, "Cutscene visual pass").
 */
export interface Vec { x: number; y: number; z: number; }
export interface Rgb { r: number; g: number; b: number; }
const v=(x:number,y:number,z:number):Vec=>({x,y,z}),rgb=(r:number,g:number,b:number):Rgb=>({r,g,b});

/** Terrain cloud layer; the only thing that makes a storm read as a storm from under it. */
export interface MoodClouds { cover: number; density: number; color: Rgb; }
export interface MoodLighting {
	clockTime: number; brightness: number; exposure: number;
	ambient: Rgb; outdoorAmbient: Rgb; fogColor: Rgb; fogStart: number; fogEnd: number;
	/** Receiver lamp brightness; the night mood leans on it for the desk. */
	lamp: number;
	/** Atmosphere density/haze; Roblox ignores the Fog* properties whenever an Atmosphere exists, and both worlds add one. */
	density: number; haze: number;
	clouds: MoodClouds;
}
const MOODS: Record<StoryMood,MoodLighting>={
	// 6.3 still showed stars; 6.9 is first light with the warm fog intact.
	dawn:{clockTime:6.9,brightness:2.2,exposure:.1,ambient:rgb(124,98,88),outdoorAmbient:rgb(166,134,120),fogColor:rgb(236,204,172),fogStart:0,fogEnd:3200,lamp:3,density:.2,haze:1.2,clouds:{cover:.45,density:.35,color:rgb(238,206,176)}},
	day:{clockTime:10,brightness:2.6,exposure:.05,ambient:rgb(100,118,140),outdoorAmbient:rgb(130,145,155),fogColor:rgb(190,215,227),fogStart:0,fogEnd:100000,lamp:3,density:.22,haze:.8,clouds:{cover:.3,density:.3,color:rgb(255,255,255)}},
	dusk:{clockTime:17.8,brightness:2.4,exposure:.1,ambient:rgb(132,86,58),outdoorAmbient:rgb(176,112,78),fogColor:rgb(242,160,108),fogStart:0,fogEnd:4000,lamp:3.5,density:.3,haze:2,clouds:{cover:.5,density:.4,color:rgb(246,170,120)}},
	// Night was a lamp pool in black: lifted ambient/exposure so masts, walls and the jet still read.
	night:{clockTime:1.5,brightness:2,exposure:.55,ambient:rgb(58,70,110),outdoorAmbient:rgb(80,96,140),fogColor:rgb(24,34,60),fogStart:0,fogEnd:2600,lamp:7,density:.3,haze:.8,clouds:{cover:0,density:0,color:rgb(40,48,74)}},
	// Storm used to render a blue sky with white clouds: a near-full grey cloud deck does the work now.
	storm:{clockTime:13,brightness:1.6,exposure:-.05,ambient:rgb(90,94,100),outdoorAmbient:rgb(112,116,122),fogColor:rgb(120,126,130),fogStart:60,fogEnd:900,lamp:4,density:.5,haze:2.6,clouds:{cover:.97,density:.85,color:rgb(84,90,98)}},
};
/** Lighting service properties for a chapter mood. */
export function moodLighting(mood:StoryMood): MoodLighting { return MOODS[mood]; }

/** Ground/prop multipliers so canyon, farm and harbor read in the chapter's light. */
const TINT: Record<StoryMood,Rgb>={dawn:rgb(1.05,.94,.86),day:rgb(1,1,1),dusk:rgb(1.1,.84,.68),night:rgb(.5,.56,.78),storm:rgb(.72,.76,.8)};
export function sceneTint(base:Rgb,mood:StoryMood): Rgb {
	const t=TINT[mood];
	return rgb(math.clamp(base.r*t.r,0,255),math.clamp(base.g*t.g,0,255),math.clamp(base.b*t.b,0,255));
}

/** Desk-relative prop anchors shared by the dressing and the camera so close-ups land. */
export const CHAIR=v(-12,3,1),RECORDER=v(-5.5,5.5,1.6),CHART=v(6,5.2,0),TIN=v(-5.2,5.85,-2.6),BOARD=v(12.5,7.6,2.5);
/** The parked Kestrel's nose, and where the chapter's story subject (truck, launch or relay) stands: behind the desk, clear of the chair shot. */
export const CINEMATIC_JET=v(-24,5,-28),CINEMATIC_PARKED_JET=v(28,5,-44),CINEMATIC_HANGAR=v(0,0,-22);
export const JET_NOSE=v(-30,5,-40),SUBJECT=v(70,0,-110);
export interface ShotPose { eye: Vec; focus: Vec; fov: number; }
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/**
 * Camera for a beat. `alpha` is 0..1 through the beat (hold .5 with camera motion
 * off); `short` is a <240 px safe root that needs a wider frame; `portrait`
 * roots see a third of the width, so the document shot pulls back for them.
 */
export function shotPose(shot:StoryShot,scene:StoryScene,alpha:number,short:boolean,portrait=false): ShotPose {
	const a=math.clamp(alpha,0,1);
	switch(shot) {
		// Over the desk toward the jet and the subject; the old pose sat 200 studs out over empty floor.
		case "wide": return {fov:short ? 60 : 55,eye:v(38-a*5,short ? 23 : 19,36-a*3),focus:v(-6,7,-20)};
		// Looking down at the chart so its document fills the scene lane and stays legible on a phone.
		case "evidence": return {fov:short ? 44 : portrait ? 40 : 46,eye:v(CHART.x-a*.3,portrait ? 15.5 : 13.6,portrait ? -7.4 : -6.6),focus:v(CHART.x,CHART.y+.1,CHART.z-.2)};
		// Seated eye level over the empty chair toward the full-size jet, avoiding the old floor-level furniture silhouette.
		case "chair": return {fov:short ? 58 : 48,eye:v(lerp(-15,-12,a),5.8,short ? 19 : 17),focus:v(CHAIR.x,CHAIR.y+.8,CHAIR.z)};
		// Close on the recorder, far enough back that the whole box, its lamp and the desk around it read.
		case "recorder": return {fov:short ? 38 : 34,eye:v(RECORDER.x-4.3+a*.3,RECORDER.y+3.4,RECORDER.z+6.6-a*.3),focus:v(RECORDER.x+.2,RECORDER.y+.1,RECORDER.z-.2)};
		// Behind the parked jet at floor level, tilting up past its tail into whatever the mood painted.
		case "sky": return {fov:short ? 75 : 66,eye:v(-8,3,-6),focus:v(JET_NOSE.x,lerp(JET_NOSE.y,JET_NOSE.y+88,a),JET_NOSE.z)};
		// radio, and black (unseen behind the card) share the desk pose.
		default: return {fov:55,eye:short ? v(-8+a*2,12,-27) : v(-10+a*4,12,-19),focus:v(0,short ? 5 : 7,0)};
	}
}

/** Which replicated story model stands behind the desk; a hangar already has a parked jet. */
export function stageSubject(scene:StoryScene): "RelayTruck" | "HarborLaunch" | "CommsRelay" | undefined {
	if(scene==="hangar")return undefined;
	if(scene==="farm")return "RelayTruck";
	return scene==="harbor" || scene==="sea" ? "HarborLaunch" : "CommsRelay";
}
/** Tape reels turn only while a recording or the log is speaking. */
export function reelsSpin(tone:SpeakerTone): boolean { return tone==="teal" || tone==="log"; }
/** Recorder lamp: ~1 Hz blink during recorder shots, dim otherwise; steady once the recorder is recovered still running. */
export function recorderLightOn(shot:StoryShot,clock:number,steady=false): boolean { return steady || (shot==="recorder" && clock%1<.5); }
/** Title cards keep the black overlay opaque and centre the line. */
export function isCard(shot:StoryShot): boolean { return shot==="black"; }
/** The coup's cards carry a faint red vignette so its voice looks different from Teal's. */
export function cardVignette(tone:SpeakerTone): boolean { return tone==="marshal"; }

/** Lines typed out grapheme by grapheme instead of faded: Teal's tapes, the recorder/log, and every black card. */
export function isTyped(tone:SpeakerTone,shot:StoryShot): boolean { return shot==="black" || tone==="teal" || tone==="log"; }
/** Share of a beat over which a typed line appears. */
export const TYPE_SPAN=.4;
/** Graphemes visible `t` seconds into a beat: grows over the first 40 %, -1 (all) once done or whenever camera motion is off. */
export function typedGraphemes(t:number,duration:number,total:number,calm:boolean): number {
	if(calm || total<=0)return -1;
	const p=math.clamp(t/math.max(duration*TYPE_SPAN,.01),0,1);
	return p>=1 ? -1 : math.floor(total*p);
}

/** Cassettes left in the coffee tin: twelve when it is found (chapter 1), one fewer for every two earlier chapters in which Teal spoke, never below the last tape; no tin before it is found. */
export function tapesInTin(id:number): number | undefined {
	if(id<1)return undefined;
	let played=0;
	for(const chapter of STORY)if(chapter.id>=1 && chapter.id<id && chapter.beats.some((b)=>b.speaker===TEAL))played++;
	return math.max(1,12-math.floor(played/2));
}
/** The Teklan orchard burns at noon in chapter 15; farm scenes are charred from then on. */
export function orchardBurned(id:number): boolean { return id>=15; }
/** Recovery brings Teal's recorder home in chapter 25: dented, lid open, lamp steady. */
export function recorderOpen(id:number): boolean { return id===25; }
/** Sera's board keeps Teal's name strip through chapter 8, loses it for chapter 9 until the chapter's last beat, and keeps it after. */
export function boardShowsTeal(id:number,beat:number,lastBeat:number): boolean { return id!==9 || beat>=lastBeat; }
/** Faint green ribbons high over the crown station; only the night relay chapters have them. */
export function auroraVisible(scene:StoryScene,mood:StoryMood): boolean { return scene==="relay" && mood==="night"; }
export interface AuroraRibbon { pos: Vec; yaw: number; size: Vec; color: Rgb; transparency: number; }
export const AURORA: AuroraRibbon[]=[
	// High and forward of the jet so the `sky` shot's final tilt (toward -z, 60 degrees up) catches them.
	// Wide, thin and mostly transparent: bars of neon read as beams, bands read as curtains.
	{pos:v(-60,400,-300),yaw:.35,size:v(520,.5,30),color:rgb(96,255,170),transparency:.6},
	{pos:v(40,442,-350),yaw:.2,size:v(440,.5,22),color:rgb(120,255,200),transparency:.68},
	{pos:v(160,420,-270),yaw:.5,size:v(360,.5,18),color:rgb(80,230,150),transparency:.72},
	{pos:v(-200,470,-400),yaw:.1,size:v(300,.5,14),color:rgb(140,255,210),transparency:.8},
];
