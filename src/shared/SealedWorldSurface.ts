import type { TerrainOp, TerrainMaterial } from "./WorldPlan";
/** M03 shell topology without M03's floor: aligned caps, shared-edge curtains.
 * The 128-stud address grid covers every fine/coarse join. Every column of the
 * 32,768-stud square has a cap whose bottom is at or above Y=0, and perimeter
 * curtains (outside hard airspace) reach Y=0, so no path from inside hard
 * airspace reaches the hollow interior. A rock floor below Y=0 would add nothing
 * reachable but cost a whole second layer of terrain chunks (about half of the
 * shell's Studio build and clear time, measured in docs/specs/worlds/m04-composition.md).
 */
export interface WorldSurface {
 height: (x: number, z: number) => number;
 detail: (x: number, z: number) => boolean;
 material: (x: number, z: number) => TerrainMaterial;
 /** Underwater cells are water alone from the cap's bottom (top - 8, never below Y=0) to Y=32, with no rock
  * cap under it: one chunk pass instead of two. Only for opaque water: aircraft collide with water and
  * nothing below its surface is seen, so the water itself seals the column (D-121).
  */
 waterColumns?: boolean;
}
export const WORLD_HALF = 16384;
export const WORLD_FILL_CHUNK = 262144;
/** Seconds of terrain work per resumption while an M04/M05 world builds behind the loading screen.
 * Every yield costs a whole engine frame (Studio Play measured 0.16-0.42 s per yield once a
 * 32k-stud world exists), so the shared 8 ms budget spent most of M04's 66 s waiting. The
 * server is single-player and the client is on the loading screen during this phase.
 */
export const WORLD_TERRAIN_BUDGET = 0.25;
export function surfaceSide(surface: WorldSurface, x: number, z: number): number {
 const tx = math.floor(x / 1024) * 1024, tz = math.floor(z / 1024) * 1024;
 for (let dx = 0; dx <= 1024; dx += 256) for (let dz = 0; dz <= 1024; dz += 256)
  if (surface.detail(tx + dx, tz + dz)) return 128;
 return 1024;
}
export function surfaceGround(surface: WorldSurface, x: number, z: number): number {
 const side = surfaceSide(surface, x, z);
 return surface.height(math.floor(x / side) * side + side / 2, math.floor(z / side) * side + side / 2);
}
export function sealedSurface(surface: WorldSurface, checkpoint: () => void) {
 const half = WORLD_HALF, ops: TerrainOp[] = [];
 const p = { ops, detailCells: 0, coarseCells: 0 };
 const block = (material: TerrainMaterial, x: number, z: number, sx: number, sz: number, bottom: number, top: number) => {
  if (top <= bottom) return;
  const y = (bottom + top) / 2, sy = top - bottom, last = ops[ops.size() - 1];
  // Consecutive identical-material boxes may be unioned exactly. Never reorder across
  // a curtain or a different material: their overwrite order controls visible edges.
  // Stay within the scheduler cap and its global 1024-stud tiles to avoid new splits.
  if (last !== undefined && last.material === material && last.y === y && last.sy === sy
   && (last.sx * last.sz + sx * sz) * sy / 64 <= WORLD_FILL_CHUNK) {
   if (last.x === x && last.sx === sx && last.z + last.sz / 2 === z - sz / 2
    && math.floor((z + sz / 2 - 0.01) / 1024) === math.floor((last.z - last.sz / 2) / 1024)) {
    last.z = (last.z - last.sz / 2 + z + sz / 2) / 2; last.sz += sz; return;
   }
   if (last.z === z && last.sz === sz && last.x + last.sx / 2 === x - sx / 2
    && math.floor((x + sx / 2 - 0.01) / 1024) === math.floor((last.x - last.sx / 2) / 1024)) {
    last.x = (last.x - last.sx / 2 + x + sx / 2) / 2; last.sx += sx; return;
   }
  }
  ops.push({ shape: "block", material, x, y, z, sx, sy, sz, yaw: 0 });
 };
 const cells: Array<{x: number; z: number; sx: number; sz: number; top: number}> = [];
 const heights = new Map<string, number>();
 const key = (x: number, z: number) => `${x},${z}`;
 for (let x = -half; x < half; x += 1024) for (let z = -half; z < half; z += 1024) {
  const side = surfaceSide(surface, x, z);
  for (let dx = 0; dx < 1024; dx += side) for (let dz = 0; dz < 1024; dz += side) {
   const c = {x: x + dx, z: z + dz, sx: side, sz: side, top: surface.height(x + dx + side / 2, z + dz + side / 2)};
   cells.push(c);
   for (let gx = c.x; gx < c.x + side; gx += 128) for (let gz = c.z; gz < c.z + side; gz += 128) heights.set(key(gx, gz), c.top);
   if (side === 128) p.detailCells++; else p.coarseCells++;
  }
  checkpoint();
 }
	for (const c of cells) {
		const cx = c.x + c.sx / 2, cz = c.z + c.sz / 2;
		// One 8-stud cap replaces the rock body plus snow overlay.
		if (!(surface.waterColumns === true && c.top < 32)) block(surface.material(cx, cz), cx, cz, c.sx, c.sz, c.top - 8, c.top);
		// Each shared edge is emitted once, in equal-height runs. Four-stud
		// vertical rock curtains close the hollow shell, including LOD joins.
		const wall = (axis: "x" | "z", edge: number, start: number, length: number, negative = false) => {
			let run = start, previous = -1;
			const flush = (finish: number) => {
				if (previous === c.top || finish === run) return;
				const lo = math.min(previous, c.top), hi = math.max(previous, c.top);
				const offset = (c.top > previous ? -2 : 2) * (negative ? -1 : 1);
				block("Rock", axis === "x" ? edge + offset : (run + finish) / 2, axis === "z" ? edge + offset : (run + finish) / 2,
					axis === "x" ? 4 : finish - run, axis === "z" ? 4 : finish - run, math.max(0, lo - 8), hi);
			};
			for (let v = start; v < start + length; v += 128) {
				const neighbor = heights.get(axis === "x" ? key(negative ? edge - 128 : edge, v) : key(v, negative ? edge - 128 : edge)) ?? 0;
				if (neighbor !== previous) { if (previous >= 0) flush(v); run = v; previous = neighbor; }
			}
			flush(start + length);
		};
		wall("x", c.x + c.sx, c.z, c.sz);
		wall("z", c.z + c.sz, c.x, c.sx);
		if (c.x === -half) wall("x", c.x, c.z, c.sz, true);
		if (c.z === -half) wall("z", c.z, c.x, c.sx, true);
		checkpoint();
	}

 // Native water exactly bounds each sampled shore tile. Ships use Y=32.
 // Keep each water tile whole; the scheduler tiles larger calls on voxel planes.
 for (const c of cells) if (c.top < 32) {
  const bottom = surface.waterColumns === true ? math.max(0, c.top - 8) : c.top;
  block("Water", c.x + c.sx / 2, c.z + c.sz / 2, c.sx, c.sz, bottom, 32);
 }
 return p;
}
