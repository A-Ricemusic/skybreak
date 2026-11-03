// Shared plain `{x, y, z}` point arithmetic for fairness and flight-strategy specs that simulate
// kinematics without Roblox Vector3. `unit` floors the length at 1e-9 so zero vectors stay finite.
// Pure Luau (math only), so it stages offline.
import type { Point } from "../../shared/WeaponRules";

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: Point, n: number): Point => ({ x: a.x * n, y: a.y * n, z: a.z * n });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Point): number => math.sqrt(dot(a, a));
export const unit = (a: Point): Point => mul(a, 1 / math.max(length(a), 1e-9));
