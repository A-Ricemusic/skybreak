// Rectangle geometry shared by every layout module: the Rectangle type, the 44 px touch-target floor,
// edge helpers, and the free-span search (freeHalf / centredFree / topLaneRight) that the HUD, kill
// marker and toast placement use to find room between obstacles. Pure; no Roblox dependencies.

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Smallest edge length, in pixels, for any on-screen touch control. */
export const MIN_TOUCH_TARGET = 44;

export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectangleInside(inner: Rectangle, width: number, height: number, inset = 0): boolean {
	return (
		inner.x >= inset &&
		inner.y >= inset &&
		inner.x + inner.width <= width - inset &&
		inner.y + inner.height <= height - inset
	);
}

export const bottomOf = (rectangle: Rectangle) => rectangle.y + rectangle.height;
export const rightOf = (rectangle: Rectangle) => rectangle.x + rectangle.width;

export const centered = (viewportWidth: number, width: number, y: number, height: number): Rectangle => ({
	x: math.floor((viewportWidth - width) / 2),
	y,
	width,
	height,
});

/**
 * Half-width of the widest span centred on `centreX` in the row y..y+height that stays
 * clear of every obstacle and the side margins; -1 when an obstacle covers the centre.
 */
export function freeHalf(
	centreX: number,
	y: number,
	height: number,
	obstacles: Rectangle[],
	viewportWidth: number,
	margin: number,
): number {
	let half = math.min(centreX - margin, viewportWidth - margin - centreX);
	for (const obstacle of obstacles) {
		if (obstacle.y >= y + height || bottomOf(obstacle) <= y) continue;
		if (obstacle.x >= centreX) half = math.min(half, obstacle.x - centreX);
		else if (rightOf(obstacle) <= centreX) half = math.min(half, centreX - rightOf(obstacle));
		else return -1;
	}
	return half;
}

/**
 * Widest rectangle centred on `centreX` (at most `maxWidth`) in the row y..y+height
 * that stays clear of every obstacle; undefined when narrower than `minWidth`.
 */
export function centredFree(
	centreX: number,
	y: number,
	height: number,
	maxWidth: number,
	minWidth: number,
	obstacles: Rectangle[],
	viewportWidth: number,
	margin: number,
): Rectangle | undefined {
	const half = math.min(maxWidth / 2, freeHalf(centreX, y, height, obstacles, viewportWidth, margin));
	if (half < 0) return undefined;
	const width = math.floor(half) * 2;
	if (width < minWidth) return undefined;
	return { x: centreX - width / 2, y, width, height };
}

export const clear = (candidate: Rectangle, obstacles: Rectangle[]) =>
	!obstacles.some((obstacle) => rectanglesOverlap(candidate, obstacle));

/** Right end of the free top-row lane that starts at `left`: the first obstacle in the row y..y+height, or `limit`. */
export function topLaneRight(
	left: number,
	y: number,
	height: number,
	obstacles: Rectangle[],
	limit: number,
	gap: number,
): number {
	let right = limit;
	for (const obstacle of obstacles)
		if (obstacle.x >= left && obstacle.y < y + height && bottomOf(obstacle) > y)
			right = math.min(right, obstacle.x - gap);
	return right;
}
