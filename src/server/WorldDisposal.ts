/** Native tree destruction, matching the established world lifecycle. */
export function destroyWorld(root?: Instance): void {
 root?.Destroy();
}
