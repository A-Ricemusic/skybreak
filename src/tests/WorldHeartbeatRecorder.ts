import { RunService } from "@rbxts/services";
import { observeWorldBuild, traceWorldPhase } from "../server/WorldBuildTrace";

/** Retains all phase spans since the last heartbeat, including phases that start and
 * finish before Heartbeat resumes. Memory decline is GC evidence, never proof of cause.
 */
export function recordWorldHeartbeats(mission: number) {
 const origin = os.clock();
 let previous = origin, phaseStart = origin, active = "idle", memory = gcinfo();
 let maxGap = 0, beats = 0, buildMaxGap = 0, measuringBuild = false;
 let spans: string[] = [];
 const totals = new Map<string, number>();
 const span = (now: number) => {
  const seconds = now - phaseStart;
  if (seconds > 0) {
   totals.set(active, (totals.get(active) ?? 0) + seconds);
   spans.push(`${active}@${string.format("%.3f", phaseStart-origin)}+${string.format("%.3f", seconds)}`);
  }
  phaseStart = now;
 };
 observeWorldBuild((phase, now) => { span(now); active = phase; });
 const heartbeat = RunService.Heartbeat.Connect(() => {
  const now = os.clock(), gap = now - previous, nextMemory = gcinfo();
  span(now); maxGap = math.max(maxGap, gap);
  if (measuringBuild) buildMaxGap = math.max(buildMaxGap, gap);
  beats++;
  if (gap > 0.3) print(`MISSION_HEARTBEAT_GAP mission=${mission} start=${previous-origin} seconds=${gap} active=${active} spans=${spans.join("|")} memoryDeltaKB=${nextMemory-memory} cause=unresolved-engine-scheduling-or-GC`);
  previous = now; memory = nextMemory; spans = [];
 });
 return {
  phase: traceWorldPhase,
  beginBuild() { measuringBuild = true; },
  endBuild() { measuringBuild = false; },
  finish() {
   span(os.clock()); heartbeat.Disconnect(); observeWorldBuild();
   return { maxGap, buildMaxGap, beats, phases: [...totals].map(([phase, seconds]) => `${phase}=${string.format("%.3f", seconds)}`).join(" ") };
  },
 };
}
