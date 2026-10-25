import { HudLayout, NAVIGATION_CAPTION_HEIGHT, NAVIGATION_CAPTION_WIDTH, Rectangle, rectangleInside, rectanglesOverlap } from "./UILayout";

/** One-line summary of the route marker (bearing glyph, distance, constraints). */
export function navigationSummary(distance:number,side:number,ceiling?:number,protectedHealth?:number):string {
	const arrow=side<-.25 ? "‹" : side>.25 ? "›" : "◇";
	return `${arrow} ${math.floor(distance)}m${ceiling!==undefined ? ` · ALT≤${ceiling}` : ""}${protectedHealth!==undefined ? ` · PROTECTED ${math.ceil(protectedHealth)}%` : ""}`;
}

/**
 * The floating caption: a glyph and the distance only, plus a tiny second line
 * when the volume, an altitude ceiling or a protected unit actually applies.
 */
export function navigationCaption(distance:number,side:number,inVolume:boolean,ceiling?:number,protectedHealth?:number):[string,string] {
	const arrow=side<-.25 ? "‹" : side>.25 ? "›" : "◇";
	const details:string[]=[];
	if(inVolume)details.push("IN VOLUME");
	if(ceiling!==undefined)details.push(`ALT≤${ceiling}`);
	if(protectedHealth!==undefined)details.push(`PROTECTED ${math.ceil(protectedHealth)}%`);
	return [`${arrow} ${math.floor(distance)}m`,details.join(" · ")];
}

/** Every HUD rectangle the floating caption must stay out of. Depends only on
 * the layout, so callers can compute it once per viewport and input mode. */
export function navigationObstacles(hud:HudLayout): Rectangle[] {
	const obstacles=[hud.callout,hud.timer,hud.alert,hud.status];
	if(hud.hints)obstacles.push(hud.hints);
	if(hud.touch)obstacles.push(hud.touch.joystick,hud.touch.throttle,hud.touch.missile,hud.touch.target,hud.touch.special);
	return obstacles;
}

/** Screen projection is relative to the inset screen; labels live in a GUI parent.
 * Keep the full caption in that parent's measured safe bounds and out of HUD lanes. */
export function placeNavigationCaption(screenX:number,screenY:number,originX:number,originY:number,width:number,height:number,hud:HudLayout,obstacles:Rectangle[]=navigationObstacles(hud)): Rectangle | undefined {
	const w=NAVIGATION_CAPTION_WIDTH,h=NAVIGATION_CAPTION_HEIGHT,gap=8;
	if(width<w+gap*2 || height<h+gap*2)return undefined;
	const pointX=screenX-originX,pointY=screenY-originY;
	const wantedX=math.clamp(pointX-w/2,gap,width-gap-w);
	const wantedY=math.clamp(pointY-16-h,gap,height-gap-h);
	const xs=[wantedX,(width-w)/2,gap,width-gap-w],ys=[wantedY,gap,height-gap-h];
	for(const obstacle of obstacles) {
		xs.push(math.clamp(obstacle.x-w-gap,gap,width-gap-w),math.clamp(obstacle.x+obstacle.width+gap,gap,width-gap-w));
		ys.push(math.clamp(obstacle.y-h-gap,gap,height-gap-h),math.clamp(obstacle.y+obstacle.height+gap,gap,height-gap-h));
	}
	let best:Rectangle | undefined,bestScore=math.huge;
	for(const x of xs)for(const y of ys) {
		const candidate={x,y,width:w,height:h};
		if(!rectangleInside(candidate,width,height,gap) || obstacles.some(obstacle=>rectanglesOverlap(candidate,obstacle)))continue;
		// Prefer above the projected marker, including when a nearby HUD lane
		// requires a horizontal move. Offscreen markers still get an edge caption.
		const score=(x-wantedX)**2+(y-wantedY)**2+(y+h>pointY-8 ? width*width+height*height : 0);
		if(score<bestScore){best=candidate;bestScore=score;}
	}
	return best;
}

/** Guidance is never hidden: when no floating spot fits, the caption takes the
 * fixed slot under the objective line. */
export function navigationCaptionRect(screenX:number,screenY:number,originX:number,originY:number,width:number,height:number,hud:HudLayout,obstacles:Rectangle[]=navigationObstacles(hud)): Rectangle {
	return placeNavigationCaption(screenX,screenY,originX,originY,width,height,hud,obstacles) ?? hud.navigation;
}
