import type { Rectangle } from "./UILayout";
export interface CinematicLayout {
	title: Rectangle; scene: Rectangle; subtitle: Rectangle; hint: Rectangle; actions: Rectangle[];
}
// The safe GUI can be shorter than the simulated device's pixel resolution.
// Reserve readable captions and 44px actions while keeping a real scene visible.
export function getCinematicLayout(width: number, height: number): CinematicLayout {
	const compact = height < 260;
	const titleHeight = compact ? 22 : 28;
	const actionHeight = compact ? 44 : 48;
	const actionY = height - actionHeight - 6;
	const hintHeight = compact ? 14 : 20;
	const hintY = actionY - hintHeight - 2;
	const subtitleHeight = compact ? 44 : 64;
	const subtitleY = hintY - subtitleHeight - 2;
	return {
		title: {x: width*0.04,y:0,width:width*0.92,height:titleHeight},
		scene: {x:0,y:titleHeight+2,width,height:math.max(1,subtitleY-titleHeight-4)},
		subtitle: {x:width*0.045,y:subtitleY,width:width*0.91,height:subtitleHeight},
		hint: {x:width*0.04,y:hintY,width:width*0.92,height:hintHeight},
		actions: [0.025,0.35,0.675].map(x=>({x:width*x,y:actionY,width:width*0.3,height:actionHeight})),
	};
}
