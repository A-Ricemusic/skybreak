import type { TerrainOp, TerrainMaterial } from "./WorldPlan";
/** M06/M07 floorless shell (D-162), adapted from the M03 topology: aligned caps and shared-edge curtains.
 * The 128-stud address grid covers every fine/coarse join. Perimeter curtains
 * reach Y=0 outside hard airspace; caps never extend below Y=0.
 */
export interface WorldSurface {
 height: (x: number, z: number) => number;
 detail: (x: number, z: number) => boolean;
 material: (x: number, z: number) => TerrainMaterial;
}
export const WORLD_HALF = 16384;
export const WORLD_FILL_CHUNK = 65536;
export function surfaceSide(surface: WorldSurface, x: number, z: number): number {
 const tx = math.floor(x / 1024) * 1024, tz = math.floor(z / 1024) * 1024;
 for (let dx = 0; dx <= 1024; dx += 256) for (let dz = 0; dz <= 1024; dz += 256)
  if (surface.detail(tx + dx, tz + dz)) return 256;
 return 1024;
}
export function surfaceGround(surface: WorldSurface, x: number, z: number): number {
 const side = surfaceSide(surface, x, z);
 return surface.height(math.floor(x / side) * side + side / 2, math.floor(z / side) * side + side / 2);
}
export function compactSurface(surface: WorldSurface, checkpoint: () => void) {
 const half = WORLD_HALF, ops: TerrainOp[] = [];
 const p = { ops, detailCells: 0, coarseCells: 0 };
 const block = (material: TerrainMaterial, x: number, z: number, sx: number, sz: number, bottom: number, top: number) => {
  if (top > bottom) ops.push({ shape: "block", material, x, y: (bottom + top) / 2, z, sx, sy: top - bottom, sz, yaw: 0 });
 };
 // Floorless: all caps and edge curtains remain at/above Y=0.
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
		const wet = surface.material(cx, cz) === "Water";
        if (wet) {
         for (let dz = 0; dz < c.sz; dz += 128) block("Water", cx, c.z + dz + 64, c.sx, 128, 0, 32);
        } else block(surface.material(cx, cz), cx, cz, c.sx, c.sz, math.max(0, c.top - 8), c.top);
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

 return p;
}
