import { describe, expect, it } from "@rbxts/jest-globals";
import { getCinematicLayout } from "../shared/CinematicLayout";
describe("cinematic safe-area layout",()=>{
	for (const [width,height] of [[320,182],[320,240],[568,262],[750,323],[374,608],[930,604]]) {
		it(`keeps scene, captions and touch actions separate in ${width}x${height}`,()=>{
			const layout=getCinematicLayout(width,height);
			expect(layout.scene.height).toBeGreaterThanOrEqual(40);
			expect(layout.subtitle.y).toBeGreaterThan(layout.scene.y+layout.scene.height);
			expect(layout.hint.y).toBeGreaterThan(layout.subtitle.y+layout.subtitle.height);
			for (let index=0;index<layout.actions.size();index++) {
				const action=layout.actions[index];
				expect(action.height).toBeGreaterThanOrEqual(44);expect(action.width).toBeGreaterThanOrEqual(44);
				expect(action.y).toBeGreaterThan(layout.hint.y+layout.hint.height);
				expect(action.y+action.height).toBeLessThanOrEqual(height);
				if(index>0)expect(action.x).toBeGreaterThan(layout.actions[index-1].x+layout.actions[index-1].width);
			}
		});
	}
});
