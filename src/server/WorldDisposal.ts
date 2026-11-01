const pending = new Set<Instance>();
/** Destroy leaves before containers, bounding both traversal and engine destruction per frame.
 * Keep the root parented until completion so a retry can discover unfinished work.
 */
export function destroyWorld(root?: Instance, cancelled: () => boolean = () => false): void {
 if (root !== undefined) pending.add(root);
 for (const remaining of pending) if (!dispose(remaining, cancelled)) return;
}
function dispose(root: Instance, cancelled: () => boolean): boolean {
 const stack: Array<{ node: Instance; visited: boolean }> = [{ node: root, visited: false }];
 let slice = os.clock(), count = 0;
 while (!stack.isEmpty()) {
  if (cancelled()) return false;
  const entry = stack.pop()!;
  if (entry.visited) entry.node.Destroy();
  else {
   stack.push({ node: entry.node, visited: true });
   for (const child of entry.node.GetChildren()) stack.push({ node: child, visited: false });
  }
  count++;
  if (count >= 64 || os.clock() - slice >= 0.015) { task.wait(); slice = os.clock(); count = 0; }
 }
 pending.delete(root);
 return true;
}
