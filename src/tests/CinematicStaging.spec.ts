import {describe,expect,it} from "@rbxts/jest-globals";
import {AURORA,CHAIR,CHART,RECORDER,SUBJECT,auroraVisible,boardShowsTeal,cardVignette,isCard,isTyped,moodLighting,orchardBurned,recorderLightOn,recorderOpen,reelsSpin,sceneTint,shotPose,stageSubject,tapesInTin,typedGraphemes} from "../shared/CinematicStaging";
import {SpeakerTone,StoryMood,StoryScene,StoryShot,speakerStyle} from "../shared/RelayStory";

const MOODS:StoryMood[]=["dawn","day","dusk","night","storm"];
const SCENES:StoryScene[]=["hangar","canyon","farm","relay","harbor","city","sea"];
const SHOTS:StoryShot[]=["radio","wide","evidence","chair","recorder","sky","black"];
const dist=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>{const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;return math.sqrt(dx*dx+dy*dy+dz*dz);};

describe("cinematic staging tables",()=>{
	it("gives every mood a legal clock, grey storm fog and a dark blue night",()=>{
		for(const mood of MOODS){
			const l=moodLighting(mood);
			expect(l.clockTime>=0 && l.clockTime<24).toBe(true);expect(l.brightness>0 && l.fogEnd>l.fogStart).toBe(true);expect(l.density>0 && l.density<1 && l.haze>=0).toBe(true);
			for(const c of [l.ambient,l.outdoorAmbient,l.fogColor])expect(c.r>=0 && c.r<=255 && c.g>=0 && c.g<=255 && c.b>=0 && c.b<=255).toBe(true);
		}
		expect(math.abs(moodLighting("dawn").clockTime-6.9)<.01).toBe(true);expect(moodLighting("day").clockTime).toBe(10);
		expect(math.abs(moodLighting("dusk").clockTime-17.8)<.01).toBe(true);expect(moodLighting("night").clockTime).toBe(1.5);expect(moodLighting("storm").clockTime).toBe(13);expect(moodLighting("storm").density>moodLighting("day").density).toBe(true);
		const storm=moodLighting("storm");expect(storm.fogEnd).toBe(900);expect(math.abs(storm.fogColor.r-storm.fogColor.b)<=12).toBe(true);
		const night=moodLighting("night");expect(night.ambient.b>night.ambient.r).toBe(true);expect(night.lamp>moodLighting("day").lamp).toBe(true);
		expect(moodLighting("dusk").ambient.r>moodLighting("dusk").ambient.b).toBe(true);
		// Night must stay readable off the lamp pool; the storm needs a near-full grey deck; dawn must be past the stars.
		expect(night.exposure>=.5 && night.ambient.r+night.ambient.g+night.ambient.b>=220).toBe(true);
		for(const mood of MOODS){const c=moodLighting(mood).clouds;expect(c.cover>=0 && c.cover<=1 && c.density>=0 && c.density<=1).toBe(true);}
		expect(storm.clouds.cover>=.9 && storm.clouds.color.r<120 && math.abs(storm.clouds.color.r-storm.clouds.color.b)<=16).toBe(true);
		expect(moodLighting("dawn").clockTime>=6.75).toBe(true);
	});
	it("tints props darker at night and leaves day untouched within range",()=>{
		const base={r:152,g:102,b:67};
		expect(sceneTint(base,"day").r).toBe(152);
		const night=sceneTint(base,"night");expect(night.r<base.r && night.g<base.g).toBe(true);
		for(const mood of MOODS){const t=sceneTint({r:255,g:255,b:255},mood);expect(t.r<=255 && t.g<=255 && t.b<=255 && t.r>=0).toBe(true);}
	});
	it("frames every shot in every scene with a finite, non-degenerate pose",()=>{
		for(const shot of SHOTS)for(const scene of SCENES)for(const short of [false,true])for(const portrait of [false,true])for(const alpha of [0,.5,1,-1,2]){
			const pose=shotPose(shot,scene,alpha,short,portrait);
			expect(dist(pose.eye,pose.focus)>1).toBe(true);expect(pose.fov>=30 && pose.fov<=80).toBe(true);
			expect(pose.eye.x===pose.eye.x && pose.focus.y===pose.focus.y).toBe(true);
		}
	});
	it("pushes in on the chair, barely drifts on the recorder and tilts up for the sky",()=>{
		const c0=shotPose("chair","hangar",0,false),c1=shotPose("chair","hangar",1,false);
		expect(dist(c1.eye,CHAIR)<dist(c0.eye,CHAIR)).toBe(true);expect(c0.eye.y<CHAIR.y).toBe(true);
		const r0=shotPose("recorder","hangar",0,false),r1=shotPose("recorder","hangar",1,false);
		expect(dist(r0.eye,RECORDER)<10 && dist(r0.eye,RECORDER)>6).toBe(true);expect(dist(r0.eye,r1.eye)<1).toBe(true);expect(r0.fov<shotPose("radio","hangar",0,false).fov).toBe(true);
		const s0=shotPose("sky","hangar",0,false),s1=shotPose("sky","hangar",1,false);
		expect(s1.focus.y>s0.focus.y).toBe(true);expect(s0.eye.y<8).toBe(true);expect(s0.focus.y>s0.eye.y).toBe(true);
		// Short safe roots widen the frame; still motion holds the mid pose.
		expect(shotPose("sky","hangar",0,true).fov>s0.fov).toBe(true);
		expect(shotPose("radio","canyon",.5,false).eye.x).toBe(-8);
	});
	it("keeps the wide shot near the desk, and the document shot over the chart from the camera side",()=>{
		for(const scene of SCENES){
			const w=shotPose("wide",scene,.5,false);
			expect(dist(w.eye,{x:0,y:5,z:0})<100).toBe(true);expect(w.eye.y>w.focus.y && w.eye.y<=40).toBe(true);
			for(const portrait of [false,true]){
				const e=shotPose("evidence",scene,.5,false,portrait);
				expect(math.abs(e.focus.x-CHART.x)<1 && math.abs(e.focus.z-CHART.z)<1).toBe(true);
				expect(e.eye.z<CHART.z && e.eye.y>CHART.y+5).toBe(true);expect(dist(e.eye,CHART)<14).toBe(true);
			}
			// Portrait roots see a third of the width, so the chart camera pulls back for them.
			expect(dist(shotPose("evidence",scene,.5,false,true).eye,CHART)>dist(shotPose("evidence",scene,.5,false,false).eye,CHART)).toBe(true);
		}
		// The subject stands behind the desk, out of the chair shot's background.
		expect(SUBJECT.z<-90 && SUBJECT.x>50).toBe(true);
		expect(stageSubject("hangar")).toBeUndefined();expect(stageSubject("farm")).toBe("RelayTruck");expect(stageSubject("sea")).toBe("HarborLaunch");expect(stageSubject("relay")).toBe("CommsRelay");
	});
	it("types out tapes, the log and every title card, and fades everyone else",()=>{
		expect(isTyped("teal","radio")).toBe(true);expect(isTyped("log","evidence")).toBe(true);expect(isTyped("marshal","black")).toBe(true);
		expect(isTyped("control","chair")).toBe(false);expect(isTyped("trainee","sky")).toBe(false);expect(isTyped("wing","radio")).toBe(false);
		expect(typedGraphemes(0,8,100,false)).toBe(0);expect(typedGraphemes(1.6,8,100,false)).toBe(50);expect(typedGraphemes(3.2,8,100,false)).toBe(-1);
		expect(typedGraphemes(7,8,100,false)).toBe(-1);expect(typedGraphemes(0,8,100,true)).toBe(-1);expect(typedGraphemes(1,8,0,false)).toBe(-1);
		expect(cardVignette("marshal")).toBe(true);expect(cardVignette("teal")).toBe(false);expect(cardVignette("log")).toBe(false);
	});
	it("moves the props with the story: tapes, the orchard, the recorder, the board and the aurora",()=>{
		expect(tapesInTin(0)).toBeUndefined();expect(tapesInTin(1)).toBe(12);expect(tapesInTin(2)).toBe(11);expect(tapesInTin(5)).toBe(8);
		expect(tapesInTin(13)).toBe(0);expect(tapesInTin(27)).toBe(0);
		for(const id of [0,4,14])expect(orchardBurned(id)).toBe(false);for(const id of [15,16,27])expect(orchardBurned(id)).toBe(true);
		expect(recorderOpen(24)).toBe(false);expect(recorderOpen(25)).toBe(true);expect(recorderOpen(26)).toBe(false);
		expect(recorderLightOn("wide",.7,true)).toBe(true);expect(recorderLightOn("wide",.7,false)).toBe(false);
		expect(boardShowsTeal(0,0,5)).toBe(true);expect(boardShowsTeal(8,3,4)).toBe(true);expect(boardShowsTeal(9,0,4)).toBe(false);expect(boardShowsTeal(9,3,4)).toBe(false);expect(boardShowsTeal(9,4,4)).toBe(true);expect(boardShowsTeal(10,0,4)).toBe(true);
		expect(auroraVisible("relay","night")).toBe(true);expect(auroraVisible("relay","dawn")).toBe(false);expect(auroraVisible("hangar","night")).toBe(false);
		expect(AURORA.size()>=3 && AURORA.size()<=6).toBe(true);
		for(const ribbon of AURORA)expect(ribbon.pos.y>250 && ribbon.transparency>=.4 && ribbon.transparency<1 && ribbon.color.g>ribbon.color.r).toBe(true);
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
