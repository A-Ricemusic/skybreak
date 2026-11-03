// Shared spec helper: did `fn` throw? Rule specs use it to assert a validator rejects malformed
// blueprints without depending on the error text. Pure Luau (pcall only), so it stages offline.
export function rejects(fn: () => void): boolean {
	const [ok] = pcall(fn);
	return !ok;
}
