/** Optional synchronous trace hook. No connection or timeline is retained in gameplay.
 * A phase identifies the interrupted work, not the cause of an engine/GC pause.
 */
let listener: ((phase: string, time: number) => void) | undefined;
let current = "idle";
const noTrace = () => {};
export function traceWorldPhase(phase: string): void {
 if (listener === undefined) return;
 current = phase;
 listener?.(phase, os.clock());
}
export function worldTraceScope(phase: string): () => void {
 if (listener === undefined) return noTrace;
 const previous = current;
 traceWorldPhase(phase);
 return () => traceWorldPhase(previous);
}
export function observeWorldBuild(callback?: (phase: string, time: number) => void): void {
 listener = callback;
 current = "idle";
}
