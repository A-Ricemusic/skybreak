import {describe,expect,it} from "@rbxts/jest-globals";
import {Rect,cinematicBandHeight,getCinematicFrame,getCinematicLayout,progressSegments,rectInside,rectsOverlap} from "../shared/CinematicLayout";
import {STORY,speakerStyle} from "../shared/RelayStory";

// Safe roots after CoreUISafeInsets (58 px Roblox top bar, plus the notch where stated):
// 667x375 -> 667x317; 844x390 with a 44 px left inset -> 800x332; 1920x854 -> 1920x796;
// 320x182 is already the Studio-compact safe root. The rest: Studio compact, an iPhone
// with both side insets, portrait phone and desktop.
const DEVICES=[[667,317],[800,332],[1920,796],[320,182]];
const SIZES=[...DEVICES,[320,162],[706,267],[750,332],[390,705],[1280,720]];

const frameFor=(width:number,height:number,large:boolean,lines:number)=>{
	const layout=getCinematicLayout(width,height,large);
	return {layout,frame:getCinematicFrame(layout,width,height,layout.lineHeight*lines+4)};
};

describe("cinematic caption panel without a top letterbox",()=>{
	it("keeps every control, the line and the progress inside the safe root without overlaps",()=>{
		for(const [width,height] of SIZES) for(const large of [false,true]) for(const lines of [1,2,99]) {
			const {layout,frame}=frameFor(width,height,large,lines);
			const root={x:0,y:0,width,height};
			const parts:Rect[]=[frame.speaker,frame.settingsButton,frame.pauseButton,frame.skipButton,frame.text,frame.progress];
			if(frame.hint)parts.push(frame.hint);
			for(const part of parts){
				expect(rectInside(part,root)).toBe(true);
				expect(rectInside(part,frame.band)).toBe(true);
				// Nothing sits in the lane under the Roblox top bar, the notch or the old letterbox.
				expect(part.y).toBeGreaterThanOrEqual(frame.scene.height);
			}
			for(let i=0;i<parts.size();i++)for(let j=i+1;j<parts.size();j++)expect(rectsOverlap(parts[i],parts[j])).toBe(false);
			expect(frame.band.y+frame.band.height).toBe(height);
			expect(frame.scene.height).toBeGreaterThanOrEqual(layout.sceneHeight);
			expect(rectInside(frame.backdrop,root)).toBe(true);
		}
	});
	it("puts Aa, pause and skip on the speaker row, right-aligned, with 44 px hit boxes",()=>{
		for(const [width,height] of SIZES) for(const large of [false,true]) {
			const {layout,frame}=frameFor(width,height,large,2);
			for(const button of [frame.settingsButton,frame.pauseButton,frame.skipButton]){
				expect(button.height).toBeGreaterThanOrEqual(44);
				expect(button.width).toBeGreaterThanOrEqual(44);
				expect(button.y).toBe(frame.speaker.y);
			}
			expect(layout.pillHeight).toBeLessThanOrEqual(layout.controlSize);
			expect(frame.settingsButton.x).toBeLessThan(frame.pauseButton.x);
			expect(frame.pauseButton.x).toBeLessThan(frame.skipButton.x);
			expect(frame.skipButton.x+frame.skipButton.width).toBe(frame.text.x+frame.text.width);
			expect(frame.speaker.x).toBe(frame.text.x);
			// Room for "SERA  VARDA CONTROL" at phone chip size; Studio compact truncates the role.
			expect(frame.speaker.width).toBeGreaterThanOrEqual(layout.tiny ? 120 : 150);
		}
	});
	it("opens the Aa popover above the panel, inside the root, side by side when the scene is short",()=>{
		for(const [width,height] of SIZES) for(const large of [false,true]) for(const lines of [1,2,99]) {
			const {layout,frame}=frameFor(width,height,large,lines);
			const panel=frame.settingsPanel;
			expect(rectInside(panel,{x:0,y:0,width,height})).toBe(true);
			expect(rectsOverlap(panel,frame.band)).toBe(false);
			expect(panel.height).toBeGreaterThanOrEqual(frame.horizontalSettings ? layout.controlSize : layout.controlSize*2);
			expect(panel.x+panel.width).toBe(frame.skipButton.x+frame.skipButton.width);
		}
		expect(frameFor(1920,796,false,2).frame.horizontalSettings).toBe(false);
		expect(frameFor(320,162,true,99).frame.horizontalSettings).toBe(true);
	});
	it("gives the reclaimed top band to the scene on landscape phones",()=>{
		for(const [width,height] of [[667,317],[706,267],[750,332],[800,332]]) {
			const layout=getCinematicLayout(width,height);
			expect(layout.phone).toBe(true);
			// Typical two-line beat: the panel stays a lower third and the scene keeps well over half the screen.
			expect(cinematicBandHeight(layout,layout.lineHeight*2+4)).toBeLessThanOrEqual(height*.42);
			expect(height-cinematicBandHeight(layout,layout.lineHeight*2+4)).toBeGreaterThanOrEqual(height*.58);
			expect(layout.sceneHeight).toBeGreaterThanOrEqual(height*.4);
		}
	});
	it("keeps a visible scene lane and at least one line at every safe size and text size",()=>{
		for(const [width,height] of SIZES) for(const large of [false,true]) {
			const layout=getCinematicLayout(width,height,large);
			expect(layout.sceneHeight).toBeGreaterThanOrEqual(60);
			expect(layout.maxLines).toBeGreaterThanOrEqual(1);
			expect(layout.maxBandHeight+layout.sceneHeight).toBe(height);
			expect(layout.maxTextHeight).toBeGreaterThanOrEqual(layout.maxLines*layout.bodySize);
		}
	});
	it("sizes phone body text at 15-17 pt with a comfortable line length",()=>{
		for(const [width,height] of SIZES) {
			const layout=getCinematicLayout(width,height);
			if(layout.tiny || layout.phone) {
				expect(layout.bodySize).toBeGreaterThanOrEqual(15);
				expect(layout.bodySize).toBeLessThanOrEqual(17);
				expect(layout.textWidth).toBeLessThanOrEqual(600);
			}
			expect(layout.textWidth).toBeLessThanOrEqual(width-layout.margin*2);
			expect(getCinematicLayout(width,height,true).bodySize).toBeGreaterThan(layout.bodySize);
		}
	});
	it("flags only Studio-compact heights as tiny and still fits two lines plus the controls at 320x182",()=>{
		const layout=getCinematicLayout(320,182);
		expect(layout.tiny).toBe(true);
		expect(getCinematicLayout(706,267).tiny).toBe(false);
		expect(layout.controlsWidth+layout.margin*2).toBeLessThanOrEqual(320);
		expect(layout.maxLines).toBeGreaterThanOrEqual(2);
	});
	it("shows the next hint only on desktop, beside the controls",()=>{
		for(const [width,height] of SIZES) {
			const {layout,frame}=frameFor(width,height,false,2);
			expect(layout.showHint).toBe(!layout.phone && !layout.tiny);
			expect(frame.hint!==undefined).toBe(layout.showHint);
			if(frame.hint)expect(frame.hint.x+frame.hint.width).toBeLessThanOrEqual(frame.settingsButton.x);
		}
	});
	it("sizes the panel to the measured line, clamped between one line and the cap",()=>{
		const layout=getCinematicLayout(750,332);
		const fixed=layout.padTop+layout.controlSize+layout.textGap+layout.progressGap+layout.progressHeight+layout.padBottom;
		expect(cinematicBandHeight(layout,0)).toBe(fixed+layout.lineHeight+4);
		expect(cinematicBandHeight(layout,44)).toBe(fixed+44);
		expect(cinematicBandHeight(layout,10000)).toBe(layout.maxBandHeight);
	});
	it("splits the progress bar into one non-overlapping segment per beat",()=>{
		for(const width of [304,600,760]) for(let beats=1;beats<=8;beats++) {
			const segments=progressSegments(width,beats);
			expect(segments.size()).toBe(beats);
			expect(segments[0].x).toBe(0);
			expect(segments[beats-1].x+segments[beats-1].width).toBe(width);
			for(let i=0;i<beats;i++){
				expect(segments[i].width).toBeGreaterThanOrEqual(10);
				if(i>0)expect(segments[i].x).toBeGreaterThanOrEqual(segments[i-1].x+segments[i-1].width+2);
			}
		}
	});
	it("gives every story speaker a known chip name, role split and colour tone",()=>{
		expect(speakerStyle("TEAL · RECORDED").tone).toBe("teal");
		expect(speakerStyle("TEAL · RECORDED").role).toBe("RECORDED");
		expect(speakerStyle("SERA · VARDA CONTROL").tone).toBe("control");
		expect(speakerStyle("FLIGHT LOG").tone).toBe("log");
		expect(speakerStyle("FLIGHT LOG").role).toBeUndefined();
		expect(speakerStyle("MARSHAL · INTERCEPT").tone).toBe("marshal");
		expect(speakerStyle("TRAINEE").tone).toBe("trainee");
		const known=new Set(["TEAL","SERA","FLIGHT LOG","RECORDER 7-T","MARSHAL","RUSK","TRAINEE","VULTURE TWO"]);
		for(const chapter of STORY)for(const beat of chapter.beats)expect(known.has(speakerStyle(beat.speaker).name)).toBe(true);
	});
});
