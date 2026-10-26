import type { SpeakerTone, StoryMood, StoryScene, StoryShot } from "./RelayStory";

/**
 * Pure staging tables for the Broken Relay cutscenes: mood lighting, camera
 * poses per shot and the small per-frame rules (reel spin, recorder blink).
 * Plain numbers only, no engine types, so the offline Luau runner can check
 * them; the client converts to Vector3/Color3 at the edge.
 */
export interface Vec { x: number; y: number; z: number; }
export interface Rgb { r: number; g: number; b: number; }
const v=(x:number,y:number,z:number):Vec=>({x,y,z}),rgb=(r:number,g:number,b:number):Rgb=>({r,g,b});

export interface MoodLighting {
	clockTime: number; brightness: number; exposure: number;
	ambient: Rgb; outdoorAmbient: Rgb; fogColor: Rgb; fogStart: number; fogEnd: number;
	/** Receiver lamp brightness; the night mood leans on it for the desk. */
	lamp: number;
}
const MOODS: Record<StoryMood,MoodLighting>={
	dawn:{clockTime:6.3,brightness:2.2,exposure:.1,ambient:rgb(124,98,88),outdoorAmbient:rgb(166,134,120),fogColor:rgb(236,204,172),fogStart:0,fogEnd:3200,lamp:3},
	day:{clockTime:10,brightness:2.6,exposure:.05,ambient:rgb(100,118,140),outdoorAmbient:rgb(130,145,155),fogColor:rgb(190,215,227),fogStart:0,fogEnd:100000,lamp:3},
	dusk:{clockTime:17.8,brightness:2.4,exposure:.1,ambient:rgb(132,86,58),outdoorAmbient:rgb(176,112,78),fogColor:rgb(242,160,108),fogStart:0,fogEnd:4000,lamp:3.5},
	night:{clockTime:1.5,brightness:1.5,exposure:.35,ambient:rgb(26,36,66),outdoorAmbient:rgb(38,54,92),fogColor:rgb(18,28,50),fogStart:0,fogEnd:2600,lamp:7},
	storm:{clockTime:13,brightness:1.8,exposure:-.1,ambient:rgb(96,100,104),outdoorAmbient:rgb(118,122,126),fogColor:rgb(150,156,160),fogStart:60,fogEnd:900,lamp:4},
};
/** Lighting service properties for a chapter mood. */
export function moodLighting(mood:StoryMood): MoodLighting { return MOODS[mood]; }

/** Ground/prop multipliers so canyon, farm and harbor read in the chapter's light. */
const TINT: Record<StoryMood,Rgb>={dawn:rgb(1.05,.94,.86),day:rgb(1,1,1),dusk:rgb(1.1,.84,.68),night:rgb(.42,.48,.7),storm:rgb(.72,.76,.8)};
export function sceneTint(base:Rgb,mood:StoryMood): Rgb {
	const t=TINT[mood];
	return rgb(math.clamp(base.r*t.r,0,255),math.clamp(base.g*t.g,0,255),math.clamp(base.b*t.b,0,255));
}

/** Desk-relative prop anchors shared by the dressing and the camera so close-ups land. */
export const CHAIR=v(-12,3,1),RECORDER=v(-5.5,5.5,1.6),JET_NOSE=v(-46,30,-88);
export interface ShotPose { eye: Vec; focus: Vec; fov: number; }
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/**
 * Camera for a beat. `alpha` is 0..1 through the beat (hold .5 with camera motion
 * off); `short` is a <240 px safe root that needs a wider frame. Vehicle scenes
 * (farm, harbor, sea) park their subject lower, so the wide shot drops.
 */
export function shotPose(shot:StoryShot,scene:StoryScene,alpha:number,short:boolean): ShotPose {
	const a=math.clamp(alpha,0,1),vehicle=scene==="farm" || scene==="harbor" || scene==="sea";
	switch(shot) {
		case "wide": return {fov:55,
			eye:short ? vehicle ? v(230-a*4,80,150) : v(430-a*8,300,380) : v(220-a*12,160,150-a*10),
			focus:short && vehicle ? v(45,-6,-65) : v(20,short ? -5 : 0,-85)};
		case "evidence": return {fov:55,eye:short ? v(21-a*2,20,-40) : v(21-a*5,20,-25),focus:v(4,short ? 4 : 6,-2)};
		// Low and slow toward the empty seat; the receiver sits off to the right, out of the subject plane.
		case "chair": return {fov:short ? 58 : 48,eye:v(lerp(-26,-21,a),1.6,short ? 18 : 13),focus:v(CHAIR.x,CHAIR.y+.6,CHAIR.z)};
		// Extreme close-up, barely drifting, so the blinking light carries the beat.
		case "recorder": return {fov:short ? 40 : 34,eye:v(RECORDER.x-2.2+a*.4,RECORDER.y+1.9,RECORDER.z+(short ? 4.6 : 3.8)-a*.3),focus:v(RECORDER.x,RECORDER.y+.3,RECORDER.z)};
		// From the desk, past the jet's nose, tilting up into whatever the mood painted.
		case "sky": return {fov:short ? 75 : 66,eye:v(-16,6,-14),focus:v(JET_NOSE.x,lerp(JET_NOSE.y,JET_NOSE.y+90,a),JET_NOSE.z)};
		// radio, and black (unseen behind the card) share the desk pose.
		default: return {fov:55,eye:short ? v(-8+a*2,12,-27) : v(-10+a*4,12,-19),focus:v(0,short ? 5 : 7,0)};
	}
}

/** Tape reels turn only while a recording or the log is speaking. */
export function reelsSpin(tone:SpeakerTone): boolean { return tone==="teal" || tone==="log"; }
/** Recorder lamp: ~1 Hz blink during recorder shots, dim otherwise. */
export function recorderLightOn(shot:StoryShot,clock:number): boolean { return shot==="recorder" && clock%1<.5; }
/** Title cards keep the black overlay opaque and centre the line. */
export function isCard(shot:StoryShot): boolean { return shot==="black"; }
