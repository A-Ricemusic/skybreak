import { TargetBoxes, TARGET_BOX_KEEPOUT_PAD } from "../../TargetBoxes";
import type { Rectangle } from "../../UILayout";

/** Root-local rendered pixels; origin must be AbsolutePosition + GUI inset exactly once. */
export function ac04ViewportPlacement(rectangles: readonly Rectangle[], originX: number, originY: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
	const pad = TARGET_BOX_KEEPOUT_PAD;
	return {
		keepouts: rectangles.map((r) => ({ x: originX + r.x - pad, y: originY + r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 })),
		bounds: TargetBoxes.Bounds(viewportWidth, viewportHeight, { x: originX, y: originY, width, height }),
	};
}

/** Cache invalidation is numeric: root movement/inset/rotation cannot reuse stale placement. */
export class AC04PlacementRevision {
	private valid = false;
	private x = 0; private y = 0; private width = 0; private height = 0; private vw = 0; private vh = 0;
	public Clear(): void { this.valid = false; }
	public Changed(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number): boolean {
		if (this.valid && x === this.x && y === this.y && width === this.width && height === this.height && viewportWidth === this.vw && viewportHeight === this.vh) return false;
		this.valid = true; this.x = x; this.y = y; this.width = width; this.height = height; this.vw = viewportWidth; this.vh = viewportHeight;
		return true;
	}
}

/** Only directional glyphs may move. Brackets always stay on the projected target.
 * Find the closest clear safe-edge segment; the glyph keeps its true bearing rotation.
 */
export function ac04FreeArrow(x: number, y: number, bounds: Rectangle, keepouts: readonly Rectangle[], size = 72): [number, number] | undefined {
	const half = size / 2 + 2;
	const left = bounds.x + half, right = bounds.x + bounds.width - half;
	const top = bounds.y + half, bottom = bounds.y + bounds.height - half;
	if (right < left || bottom < top) return undefined;
	let bestX = 0, bestY = 0, distance = math.huge;
	const consider = (cx: number, cy: number) => {
		if (!TargetBoxes.Fits(cx, cy, size, bounds, keepouts)) return;
		const d = (cx - x) ** 2 + (cy - y) ** 2;
		if (d < distance) { bestX = cx; bestY = cy; distance = d; }
	};
	consider(math.clamp(x, left, right), math.clamp(y, top, bottom));
	// Include obstacle boundaries so narrow clear segments are not lost to sampling.
	for (const r of keepouts) {
		for (const cx of [r.x - half, r.x + r.width + half]) { consider(cx, top); consider(cx, bottom); }
		for (const cy of [r.y - half, r.y + r.height + half]) { consider(left, cy); consider(right, cy); }
	}
	for (let i = 0; i <= 64; i++) {
		const t = i / 64;
		consider(left + (right - left) * t, top); consider(left + (right - left) * t, bottom);
		consider(left, top + (bottom - top) * t); consider(right, top + (bottom - top) * t);
	}
	return distance < math.huge ? [bestX, bestY] : undefined;
}
