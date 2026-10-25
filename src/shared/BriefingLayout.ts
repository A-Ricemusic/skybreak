/** Fixed briefing actions reserve two 44px touch targets and two 8px gaps.
 * All mission copy, including the heading, belongs in the remaining viewport.
 * Supported menu panels are at least 169px tall, leaving 65px to scroll.
 */
export function getBriefingLayout(panelHeight: number) {
	const actionHeight = 44;
	const gap = 8;
	const archiveBottom = panelHeight - actionHeight - gap;
	return {
		actionHeight,
		archiveBottom,
		detailsHeight: archiveBottom - actionHeight - gap,
	};
}
