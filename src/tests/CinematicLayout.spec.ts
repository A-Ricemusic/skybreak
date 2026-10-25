import {describe,expect,it} from "@rbxts/jest-globals";
import {getCinematicLayout} from "../shared/CinematicLayout";

describe("cinematic safe-area composition",()=>{
	it("reserves a visible scene lane and separate readable subtitle/actions at tiny safe heights",()=>{
		for(const height of [162,181,182,240,332,705]) {
			const layout=getCinematicLayout(height);
			expect(layout.sceneHeight).toBeGreaterThanOrEqual(44);
			expect(layout.actionHeight).toBeGreaterThanOrEqual(44);
			expect(layout.subtitleHeight).toBeGreaterThanOrEqual(20);
			expect(layout.subtitleY+layout.subtitleHeight).toBeLessThanOrEqual(layout.panelHeight-47);
			expect(layout.titleHeight+layout.sceneHeight+layout.panelHeight+6).toBe(height);
		}
	});
});
