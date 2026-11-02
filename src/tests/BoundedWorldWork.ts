const active = new Set<thread>();
export function cancelWorldWork(): void {
 for (const worker of active) if (coroutine.status(worker) === "suspended") task.cancel(worker);
 active.clear();
}
/** Cancel the worker before reporting a timeout: Jest alone does not stop yielded bodies. */
export function boundedWorldWork<T>(label: string, body: () => T, seconds = 90): T {
 let finished = false, result: T | undefined, failure: unknown;
 const worker = task.spawn(() => {
  try { result = body(); } catch (err) { failure = err; }
  finished = true;
 });
 if (!finished) active.add(worker);
 const deadline = os.clock() + seconds;
 while (!finished && os.clock() < deadline) task.wait();
 active.delete(worker);
 if (!finished) {
  if (coroutine.status(worker) === "suspended") task.cancel(worker);
  error(`${label} exceeded ${seconds}s; worker cancelled`);
 }
 if (failure !== undefined) error(tostring(failure));
 return result as T;
}
