import {describe,expect,it} from "@rbxts/jest-globals";
import {navigationCaption,navigationCaptionRect,navigationObstacles,navigationSummary,placeNavigationCaption} from "../shared/NavigationLayout";
import {getHudLayout,InputMode,NAVIGATION_CAPTION_HEIGHT,NAVIGATION_CAPTION_WIDTH,rectangleInside,rectanglesOverlap} from "../shared/UILayout";

const MODES:InputMode[]=["touch","keyboard","gamepad"];

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
			const obstacles=[hud.callout,hud.timer,hud.alert,hud.status];
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
});
