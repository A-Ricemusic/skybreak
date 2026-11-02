import { worldTraceScope } from "./WorldBuildTrace";
/** Per-build instrumentation: no retained plans, instances, connections or module caches.
 * CPU excludes task.wait; wall includes engine scheduling. MicroProfiler labels are
 * closed before yielding so another thread's work is never attributed to this slice.
 */
export function planProfiler(parent: Instance) {
 const endTrace = worldTraceScope("plan");
 const start = os.clock(), memory = gcinfo();
 let last = start, slice = start, cpu = 0, longest = 0, yields = 0;
 const phases = new Map<string, number>();
 let label = "composition";
 debug.profilebegin(`WorldPlan/${label}`);
 const checkpoint = (phase = "composition", done = false) => {
  const now = os.clock(), dt = now - last;
  cpu += dt; phases.set(phase, (phases.get(phase) ?? 0) + dt);
  longest = math.max(longest, now - slice);
  debug.profileend();
  if (!done && now - slice >= 0.05) { yields++; task.wait(); slice = os.clock(); }
  last = os.clock(); label = phase;
  if (!done) debug.profilebegin(`WorldPlan/${label}`);
 };
 return {
  checkpoint,
  finish() {
   checkpoint("composition", true);
   endTrace();
   parent.SetAttribute("WorldPlanSeconds", os.clock() - start);
   parent.SetAttribute("WorldPlanCPUSeconds", cpu);
   parent.SetAttribute("WorldPlanLongestSlice", longest);
   parent.SetAttribute("WorldPlanYields", yields);
   parent.SetAttribute("WorldPlanMemoryDeltaKB", gcinfo() - memory);
   for (const [phase, seconds] of phases) {
    parent.SetAttribute(`WorldPlan_${phase}`, seconds);
    print(`MISSION_PLAN_PHASE world=${parent.Name} phase=${phase} cpu=${seconds}`);
   }
  },
 };
}
