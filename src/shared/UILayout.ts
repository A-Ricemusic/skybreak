// Kept pure and shared so ServerStorage-hosted Roblox Jest tests can import it.
export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface HudLayout {
	compactTop: boolean;
	objective: Rectangle;
	telemetry: Rectangle;
	target: Rectangle;
	warning: Rectangle;
}

const centered = (viewportWidth: number, width: number, y: number, height: number): Rectangle => ({
	x: math.floor((viewportWidth - width) / 2),
	y,
	width,
	height,
});

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(viewportWidth: number, viewportHeight: number): HudLayout {
	const width = math.max(320, viewportWidth);
	const compactTop = width < 760;

	if (compactTop) {
		const safeWidth = math.max(292, width - 28);
		return {
			compactTop: true,
			objective: centered(width, math.min(340, safeWidth), 10, 54),
			telemetry: centered(width, math.min(540, safeWidth), 70, 48),
			target: centered(width, math.min(280, safeWidth), 124, 46),
			warning: centered(width, math.min(360, safeWidth), 176, 36),
		};
	}

	const compactHeight = viewportHeight < 500;
	return {
		compactTop: false,
		objective: centered(width, 340, 12, 54),
		telemetry: { x: 14, y: 14, width: 184, height: compactHeight ? 100 : 116 },
		target: centered(width, 280, 72, 46),
		warning: centered(width, 360, 124, 36),
	};
}

export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
