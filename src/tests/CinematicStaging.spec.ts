import {describe,expect,it} from "@rbxts/jest-globals";
import {CHAIR,RECORDER,isCard,moodLighting,recorderLightOn,reelsSpin,sceneTint,shotPose} from "../shared/CinematicStaging";
import {SpeakerTone,StoryMood,StoryScene,StoryShot,speakerStyle} from "../shared/RelayStory";

const MOODS:StoryMood[]=["dawn","day","dusk","night","storm"];
const SCENES:StoryScene[]=["hangar","canyon","farm","relay","harbor","city","sea"];
const SHOTS:StoryShot[]=["radio","wide","evidence","chair","recorder","sky","black"];
const dist=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>{const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;return math.sqrt(dx*dx+dy*dy+dz*dz);};

describe("cinematic staging tables",()=>{
	it("gives every mood a legal clock, grey storm fog and a dark blue night",()=>{
		for(const mood of MOODS){
			const l=moodLighting(mood);
			expect(l.clockTime>=0 && l.clockTime<24).toBe(true);expect(l.brightness>0 && l.fogEnd>l.fogStart).toBe(true);
			for(const c of [l.ambient,l.outdoorAmbient,l.fogColor])expect(c.r>=0 && c.r<=255 && c.g>=0 && c.g<=255 && c.b>=0 && c.b<=255).toBe(true);
		}
		expect(math.abs(moodLighting("dawn").clockTime-6.3)<.01).toBe(true);expect(moodLighting("day").clockTime).toBe(10);
		expect(math.abs(moodLighting("dusk").clockTime-17.8)<.01).toBe(true);expect(moodLighting("night").clockTime).toBe(1.5);expect(moodLighting("storm").clockTime).toBe(13);
		const storm=moodLighting("storm");expect(storm.fogEnd).toBe(900);expect(math.abs(storm.fogColor.r-storm.fogColor.b)<=12).toBe(true);
		const night=moodLighting("night");expect(night.ambient.b>night.ambient.r).toBe(true);expect(night.lamp>moodLighting("day").lamp).toBe(true);
		expect(moodLighting("dusk").ambient.r>moodLighting("dusk").ambient.b).toBe(true);
	});
	it("tints props darker at night and leaves day untouched within range",()=>{
		const base={r:152,g:102,b:67};
		expect(sceneTint(base,"day").r).toBe(152);
		const night=sceneTint(base,"night");expect(night.r<base.r && night.g<base.g).toBe(true);
		for(const mood of MOODS){const t=sceneTint({r:255,g:255,b:255},mood);expect(t.r<=255 && t.g<=255 && t.b<=255 && t.r>=0).toBe(true);}
	});
	it("frames every shot in every scene with a finite, non-degenerate pose",()=>{
		for(const shot of SHOTS)for(const scene of SCENES)for(const short of [false,true])for(const alpha of [0,.5,1,-1,2]){
			const pose=shotPose(shot,scene,alpha,short);
			expect(dist(pose.eye,pose.focus)>1).toBe(true);expect(pose.fov>=30 && pose.fov<=80).toBe(true);
			expect(pose.eye.x===pose.eye.x && pose.focus.y===pose.focus.y).toBe(true);
		}
	});
	it("pushes in on the chair, barely drifts on the recorder and tilts up for the sky",()=>{
		const c0=shotPose("chair","hangar",0,false),c1=shotPose("chair","hangar",1,false);
		expect(dist(c1.eye,CHAIR)<dist(c0.eye,CHAIR)).toBe(true);expect(c0.eye.y<CHAIR.y).toBe(true);
		const r0=shotPose("recorder","hangar",0,false),r1=shotPose("recorder","hangar",1,false);
		expect(dist(r0.eye,RECORDER)<6).toBe(true);expect(dist(r0.eye,r1.eye)<1).toBe(true);expect(r0.fov<shotPose("radio","hangar",0,false).fov).toBe(true);
		const s0=shotPose("sky","hangar",0,false),s1=shotPose("sky","hangar",1,false);
		expect(s1.focus.y>s0.focus.y).toBe(true);expect(s0.eye.y<8).toBe(true);expect(s0.focus.y>s0.eye.y).toBe(true);
		// Short safe roots widen the frame; still motion holds the mid pose.
		expect(shotPose("sky","hangar",0,true).fov>s0.fov).toBe(true);
		expect(shotPose("radio","canyon",.5,false).eye.x).toBe(-8);
	});
	it("spins the reels for tape and log speakers only, and blinks the recorder at 1 Hz",()=>{
		for(const [speaker,spin] of [["TEAL · RECORDED",true],["FLIGHT LOG",true],["RECORDER 7-T",true],["SERA · VARDA CONTROL",false],["MARSHAL · INTERCEPT",false],["RUSK",false],["TRAINEE",false],["VULTURE TWO",false]] as [string,boolean][])
			expect(reelsSpin(speakerStyle(speaker).tone)).toBe(spin);
		expect(reelsSpin("wing" as SpeakerTone)).toBe(false);
		expect(recorderLightOn("recorder",0)).toBe(true);expect(recorderLightOn("recorder",.49)).toBe(true);
		expect(recorderLightOn("recorder",.5)).toBe(false);expect(recorderLightOn("recorder",1.2)).toBe(true);
		for(const shot of SHOTS)if(shot!=="recorder")expect(recorderLightOn(shot,.1)).toBe(false);
		for(const shot of SHOTS)expect(isCard(shot)).toBe(shot==="black");
	});
	it("maps the new speakers to their chip tones",()=>{
		expect(speakerStyle("VULTURE TWO · RIDGE").tone).toBe("wing");expect(speakerStyle("RUSK").tone).toBe("marshal");
		expect(speakerStyle("RECORDER 7-T").tone).toBe("log");expect(speakerStyle("UNKNOWN").tone).toBe("control");
	});
});
