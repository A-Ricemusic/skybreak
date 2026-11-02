// Standalone Luau has no game global; Studio audits yield without importing engine services.
const pause = () => { if (typeIs(game, "Instance")) task.wait(); };
let slice = os.clock();
export function testCheckpoint(): void {
 if (os.clock() - slice >= 0.25) { pause(); slice = os.clock(); }
}
/** Complete field equality for acyclic numeric plans, with bounded traversal slices.
 * Jest's recursive toEqual holds one non-yielding command for these large tables.
 */
export function plansEqual(a: unknown, b: unknown): boolean {
 testCheckpoint();
 if (a === b) return true;
 if (!typeIs(a, "table") || !typeIs(b, "table")) return false;
 const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
 for (const [key, value] of pairs(left)) if (!plansEqual(value, right[key])) return false;
 for (const [key] of pairs(right)) if (left[key] === undefined) return false;
 return true;
}
