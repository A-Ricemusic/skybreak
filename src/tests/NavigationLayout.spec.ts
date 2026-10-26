import {describe,expect,it} from "@rbxts/jest-globals";
import {navigationCaption,navigationCaptionRect,navigationCaptionSize,navigationDetails,navigationObstacles,navigationSummary,placeNavigationCaption,wrapNavigationDetails} from "../shared/NavigationLayout";
import {getHudLayout,InputMode,NAVIGATION_CAPTION_HEIGHT,NAVIGATION_CAPTION_MAX_WIDTH,NAVIGATION_CAPTION_WIDTH,NAVIGATION_ROW_HEIGHT,NAVIGATION_SLOT_HEIGHT,rectangleInside,rectanglesOverlap} from "../shared/UILayout";

const MODES:InputMode[]=["touch","keyboard","gamepad"];
// GothamBold 10pt is about 6.2 px per character; tests only need a monotonic measure.
const measure=(text:string)=>text.size()*6.2;

describe("safe-area navigation caption",()=>{
	it("is a glyph and a distance, with details only when they apply",()=>{
		expect(navigationCaption(412.7,0,false)).toEqual(["◇ 412m",""]);
		expect(navigationCaption(654.9,-1,false,380)).toEqual(["‹ 654m","ALT≤380"]);
		expect(navigationCaption(180,1,true,undefined,78.2)).toEqual(["› 180m","IN VOLUME · PROTECTED 79%"]);
		expect(navigationSummary(654.9,-1,380)).toBe("‹ 654m · ALT≤380");
		expect(navigationSummary(900,1)).toBe("› 900m");
	});
	it("stays a small text caption",()=>{
		expect(NAVIGATION_CAPTION_WIDTH).toBeLessThanOrEqual(120);
		expect(NAVIGATION_CAPTION_HEIGHT).toBeLessThanOrEqual(28);
	});
	it("never hides guidance: falls back to the slot under the objective line",()=>{
		for(const [width,height] of [[320,182],[560,240],[706,267],[390,705]])for(const mode of MODES) {
			const hud=getHudLayout(width,height,mode);
			const obstacles=navigationObstacles(hud);
			expect(rectangleInside(hud.navigation,width,height,hud.margin)).toBe(true);
			for(const obstacle of obstacles)expect(rectanglesOverlap(hud.navigation,obstacle)).toBe(false);
			expect(hud.navigation.y).toBeGreaterThanOrEqual(hud.callout.y+hud.callout.height);
			for(const [x,y] of [[-200,-100],[width/2,height/2],[width+200,height+100]]) {
				const caption=navigationCaptionRect(x,y,0,0,width,height,hud,obstacles);
				expect(rectangleInside(caption,width,height,6)).toBe(true);
			}
		}
		// A parent too narrow for any floating spot still gets the fixed slot.
		const compact=getHudLayout(320,182,"touch");
		expect(placeNavigationCaption(65,90,0,0,130,182,compact)).toBeUndefined();
		expect(navigationCaptionRect(65,90,0,0,130,182,compact)).toEqual(compact.navigation);
	});
	it("converts screen coordinates into an offset GUI parent without shifting the marker",()=>{
		const hud=getHudLayout(737,604,"keyboard");
		const unshifted=placeNavigationCaption(368,310,0,0,737,604,hud)!;
		const inset=placeNavigationCaption(405,368,37,58,737,604,hud)!;
		expect(inset).toEqual(unshifted);
		expect(unshifted.y+unshifted.height).toBeLessThan(310);
	});
	it("keeps edge and behind-camera captions out of objective and control lanes",()=>{
		for(const [width,height] of [[737,604],[844,332],[706,267],[560,240],[320,510],[390,705],[320,182]])for(const mode of MODES) {
			const hud=getHudLayout(width,height,mode);
			const obstacles=[hud.callout,hud.clock,hud.alert,hud.weapons.frame,hud.speed,hud.altitude];
			if(hud.hints)obstacles.push(hud.hints);
			if(hud.touch)obstacles.push(hud.touch.joystick,hud.touch.throttle,hud.touch.missile,hud.touch.target);
			for(const [x,y] of [[-200,-100],[width/2,height/2],[width+200,height+100]]) {
				const caption=placeNavigationCaption(x,y,0,0,width,height,hud);
				// No floating spot means the fixed slot, checked above.
				if(!caption)continue;
				expect(rectangleInside(caption,width,height,8)).toBe(true);
				for(const obstacle of obstacles)expect(rectanglesOverlap(caption,obstacle)).toBe(false);
			}
		}
	});
	it("wraps long detail lines between parts instead of truncating them",()=>{
		const parts=navigationDetails(true,380,78.2);
		expect(parts).toEqual(["IN VOLUME","ALT≤380","PROTECTED 79%"]);
		// "IN VOLUME · ALT≤380 · PROTECTED 79%" is wider than the caption: two lines, split at a separator.
		const lines=wrapNavigationDetails(parts,NAVIGATION_CAPTION_MAX_WIDTH-4,measure);
		expect(lines.size()).toBe(2);
		expect(lines[1]).toBe("PROTECTED 79%");
		for(const line of lines)expect(measure(line)).toBeLessThanOrEqual(NAVIGATION_CAPTION_MAX_WIDTH-4);
		// Short details stay on one line; nothing to wrap gives no lines.
		expect(wrapNavigationDetails(["ALT≤380"],196,measure)).toEqual(["ALT≤380"]);
		expect(wrapNavigationDetails([],196,measure).size()).toBe(0);
		// A narrow fixed slot puts every part on its own line.
		expect(wrapNavigationDetails(parts,60,measure).size()).toBe(3);
	});
	it("sizes the caption frame to its widest row, between the default and the maximum width",()=>{
		expect(navigationCaptionSize([40])).toEqual({width:NAVIGATION_CAPTION_WIDTH,height:NAVIGATION_CAPTION_HEIGHT});
		expect(navigationCaptionSize([40,150])).toEqual({width:154,height:NAVIGATION_CAPTION_HEIGHT});
		expect(navigationCaptionSize([40,180,90])).toEqual({width:184,height:NAVIGATION_ROW_HEIGHT*3+2});
		expect(navigationCaptionSize([40,400]).width).toBe(NAVIGATION_CAPTION_MAX_WIDTH);
		expect(NAVIGATION_SLOT_HEIGHT).toBe(NAVIGATION_ROW_HEIGHT*3+2);
	});
	it("places a measured three-row caption fully on screen at 1920x854 (the truncated bottom-right case)",()=>{
		const size=navigationCaptionSize([40,180,90]);
		for(const mode of MODES) {
			const hud=getHudLayout(1920,854,mode);
			for(const [x,y] of [[1900,840],[1910,500],[960,427],[-50,-50]]) {
				const caption=placeNavigationCaption(x,y,0,0,1920,854,hud,navigationObstacles(hud),size)!;
				expect(caption.width).toBe(size.width);
				expect(caption.height).toBe(size.height);
				expect(rectangleInside(caption,1920,854,8)).toBe(true);
				for(const obstacle of navigationObstacles(hud))expect(rectanglesOverlap(caption,obstacle)).toBe(false);
			}
		}
	});
	it("keeps the fixed slot clear of PAUSE, the radar, EVADE and the FIRE caption",()=>{
		for(const [width,height] of [[667,375],[800,390],[706,267],[1920,854],[390,705]])for(const mode of MODES) {
			const hud=getHudLayout(width,height,mode);
			for(const obstacle of navigationObstacles(hud))expect(rectanglesOverlap(hud.navigation,obstacle)).toBe(false);
			expect(hud.navigation.width).toBeLessThanOrEqual(NAVIGATION_CAPTION_MAX_WIDTH);
			expect(hud.navigation.height).toBeGreaterThanOrEqual(NAVIGATION_ROW_HEIGHT*2+2);
		}
	});
});
