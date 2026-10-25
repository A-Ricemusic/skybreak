/** The safe root can be shorter than the requested simulator resolution. */
export function getCinematicLayout(height:number) {
	const compact=height<360,tiny=height<240;
	const titleHeight=tiny ? 20 : compact ? 28 : 46;
	const panelHeight=math.min(compact ? 144 : 184,height-titleHeight-50);
	return {compact,tiny,titleHeight,panelHeight,sceneHeight:height-titleHeight-panelHeight-6,
		subtitleY:compact ? 21 : 30,subtitleHeight:panelHeight-(compact ? 70 : 81),actionHeight:44};
}
