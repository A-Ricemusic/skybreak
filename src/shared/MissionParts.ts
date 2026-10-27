/** BaseParts under `root`; the server's expectedParts and the client preload counter must agree. */
export function countParts(root: Instance): number {
	let count = 0;
	for (const item of root.GetDescendants()) if (item.IsA("BasePart")) count++;
	return count;
}
