import {describe,expect,it} from "@rbxts/jest-globals";
import {navigationSummary,placeNavigationCaption} from "../shared/NavigationLayout";
import {getHudLayout,InputMode,rectangleInside,rectanglesOverlap} from "../shared/UILayout";

describe("safe-area navigation caption",()=>{
	it("retains route/recon/escort guidance when no floating caption fits",()=>{
		const hud=getHudLayout(320,182,"touch");
		expect(placeNavigationCaption(160,100,0,0,320,182,hud)).toBeUndefined();
		expect(navigationSummary(654.9,-1,380)).toBe("‹ 654m · ALT≤380");
		expect(navigationSummary(180,.1,undefined,78.2)).toBe("◇ 180m · PROTECTED 79%");
		expect(navigationSummary(900,1)).toBe("› 900m");
	});
	it("converts screen coordinates into an offset GUI parent without shifting the marker",()=>{
		const hud=getHudLayout(737,604,"keyboard");
		const unshifted=placeNavigationCaption(368,310,0,0,737,604,hud)!;
		const inset=placeNavigationCaption(405,368,37,58,737,604,hud)!;
		expect(inset).toEqual(unshifted);
		expect(unshifted.y+unshifted.height).toBeLessThan(310);
	});
	it("keeps edge and behind-camera captions out of objective and control lanes",()=>{
		for(const [width,height] of [[737,604],[844,332],[320,510],[320,182]])for(const mode of ["touch","keyboard","gamepad"] as InputMode[]) {
			const hud=getHudLayout(width,height,mode);
			const obstacles=[hud.callout,hud.alert,hud.status];
			if(hud.hints)obstacles.push(hud.hints);
			if(hud.touch)obstacles.push(hud.touch.joystick,hud.touch.throttle,hud.touch.missile,hud.touch.target);
			for(const [x,y] of [[-200,-100],[width/2,height/2],[width+200,height+100]]) {
				const caption=placeNavigationCaption(x,y,0,0,width,height,hud);
				// No available caption space is preferable to covering a required control.
				if(!caption)continue;
				expect(rectangleInside(caption,width,height,8)).toBe(true);
				for(const obstacle of obstacles)expect(rectanglesOverlap(caption,obstacle)).toBe(false);
			}
		}
	});
});
