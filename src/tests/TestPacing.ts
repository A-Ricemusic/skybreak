/** Complete field equality for acyclic numeric plans, without scheduling engine frames.
 * Jest's recursive toEqual holds one non-yielding command for these large tables.
 */
export function plansEqual(a: unknown, b: unknown): boolean {
 if (a === b) return true;
 if (!typeIs(a, "table") || !typeIs(b, "table")) return false;
 const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
 for (const [key, value] of pairs(left)) if (!plansEqual(value, right[key])) return false;
 for (const [key] of pairs(right)) if (left[key] === undefined) return false;
 return true;
}
