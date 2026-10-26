import {describe,expect,it} from "@rbxts/jest-globals";
import {cinematicBandHeight,getCinematicLayout} from "../shared/CinematicLayout";
import {STORY,speakerStyle} from "../shared/RelayStory";

// Safe-root sizes: Studio compact, short landscape phones, portrait phone, desktop.
const SIZES=[[320,162],[320,182],[706,267],[750,332],[844,390],[390,705],[1280,720]];

describe("letterboxed cinematic composition",()=>{
	it("keeps a visible scene lane and 44 px controls at every safe size and text size",()=>{
		for(const [width,height] of SIZES) for(const large of [false,true]) {
			const layout=getCinematicLayout(width,height,large);
			expect(layout.sceneHeight).toBeGreaterThanOrEqual(44);
			expect(layout.barHeight).toBeGreaterThanOrEqual(44);
			expect(layout.controlSize).toBeGreaterThanOrEqual(44);
			expect(layout.maxLines).toBeGreaterThanOrEqual(1);
			expect(layout.barHeight+layout.maxBandHeight+layout.sceneHeight).toBe(height);
			expect(layout.maxTextHeight).toBeGreaterThanOrEqual(layout.maxLines*layout.bodySize);
		}
	});
	it("uses a compact lower third instead of a half-screen panel on landscape phones",()=>{
		for(const [width,height] of [[706,267],[750,332],[844,390]]) {
			const layout=getCinematicLayout(width,height);
			expect(layout.phone).toBe(true);
			// Typical two-line beat, and the worst-case capped band.
			expect(cinematicBandHeight(layout,layout.lineHeight*2+4)).toBeLessThanOrEqual(height*.35);
			expect(layout.sceneHeight).toBeGreaterThanOrEqual(height*.4);
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
	it("flags only Studio-compact heights as tiny and still fits subtitle plus skip at 320x182",()=>{
		const layout=getCinematicLayout(320,182);
		expect(layout.tiny).toBe(true);
		expect(getCinematicLayout(706,267).tiny).toBe(false);
		expect(layout.skipWidth+layout.controlSize*2+layout.margin*2).toBeLessThanOrEqual(320);
		expect(layout.maxLines).toBeGreaterThanOrEqual(2);
	});
	it("sizes the band to the measured line, clamped between one line and the cap",()=>{
		const layout=getCinematicLayout(750,332);
		const fixed=layout.padTop+layout.chipHeight+layout.chipGap+layout.padBottom;
		expect(cinematicBandHeight(layout,0)).toBe(fixed+layout.lineHeight+4);
		expect(cinematicBandHeight(layout,44)).toBe(fixed+44);
		expect(cinematicBandHeight(layout,10000)).toBe(layout.maxBandHeight);
	});
	it("gives every story speaker a known chip name, role split and colour tone",()=>{
		expect(speakerStyle("TEAL · RECORDED").tone).toBe("teal");
		expect(speakerStyle("TEAL · RECORDED").role).toBe("RECORDED");
		expect(speakerStyle("SERA · VARDA CONTROL").tone).toBe("control");
		expect(speakerStyle("FLIGHT LOG").tone).toBe("log");
		expect(speakerStyle("FLIGHT LOG").role).toBeUndefined();
		expect(speakerStyle("MARSHAL · INTERCEPT").tone).toBe("marshal");
		expect(speakerStyle("TRAINEE").tone).toBe("trainee");
		const known=new Set(["TEAL","SERA","FLIGHT LOG","MARSHAL","TRAINEE"]);
		for(const chapter of STORY)for(const beat of chapter.beats)expect(known.has(speakerStyle(beat.speaker).name)).toBe(true);
	});
});
