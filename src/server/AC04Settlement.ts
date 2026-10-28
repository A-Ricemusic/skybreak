/** Capture server-owned progress before deferred cleanup can race player removal. */
export function ac04ScheduleCapturedCompletion(capture: () => void, complete: () => void, defer: (complete: () => void) => void): void {
 capture();
 defer(complete);
}
