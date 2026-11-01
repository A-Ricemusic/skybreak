import { destroyWorld } from "../server/WorldDisposal";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Lighting, RunService, Workspace } from "@rbxts/services";
import { MissionWorld } from "../server/MissionWorld";
import { clearTerrainIfDirty } from "../server/TerrainState";
import { UploadedAssets } from "../shared/UploadedAssets";
import { fakeIds, fakeUpload, probe } from "./WorldBuildFixtures";
import { recordWorldHeartbeats } from "./WorldHeartbeatRecorder";

// Matched only by test:roblox:perf. One test ensures strictly sequential builds,
// complete compact output, and cleanup even when one mission misses its budget.
describe("Isolated mission world performance (Studio only)", () => {
 it("bounds all 18 builds and attributes heartbeat stalls", () => {
  const rows: Array<{ id: number; seconds: number; gap: number; batch: number; slice: number; ok: boolean }> = [];
  let previous: Folder | undefined;
  UploadedAssets.Configure({ ids: fakeIds(true), probe, loader: fakeUpload });
  print("MISSION_PERF_TABLE mission buildSeconds buildGap cleanupAndBuildGap terrainBatch planSlice planCPU memoryKB phases (fake uploads; no replication/device acceptance)");
  try {
   for (let id = 1; id <= 18; id++) {
    RunService.Heartbeat.Wait();
    const recorder = recordWorldHeartbeats(id);
    let seconds = 0, ok = false, errorMessage = "";
    const attemptStart = os.clock();
    let fixture: Folder | undefined;
    try {
     recorder.phase("previous-world-cleanup");
     destroyWorld(previous); previous = undefined;
     clearTerrainIfDirty();
     Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
     for (const name of ["MissionAtmosphere", "MissionGrade", "MissionSky", "MissionBloom", "M01SunRays"]) Lighting.FindFirstChild(name)?.Destroy();
     RunService.Heartbeat.Wait();
     // Observe post-cleanup allocation/GC pressure separately; Luau does not permit
     // forcing or timing a full collection. Automatic GC may interrupt any phase.
     recorder.phase("GC-settle-unconfirmed");
     task.wait(0.1);
     fixture = new Instance("Folder"); fixture.Name = `WorldTimingFixture_M${id}`; fixture.Parent = Workspace;
     previous = fixture;
     recorder.phase("build-dispatch"); recorder.beginBuild();
     const start = os.clock();
     MissionWorld.Build(id, fixture);
     seconds = os.clock() - start;
     // Flush the synchronous tail before ending the measured build window.
     RunService.Heartbeat.Wait();
     recorder.endBuild(); ok = true;
    } catch (err) {
     errorMessage = tostring(err);
     warn(`MISSION_PERF_ERROR M${id} phase=${fixture?.GetAttribute("WorldBuildPhase")} elapsed=${os.clock() - attemptStart} error=${errorMessage}`);
    } finally {
     const timing = recorder.finish();
     {
      const batch = fixture?.GetAttribute("WorldTerrainLongestBatch") as number ?? 0;
      const slice = fixture?.GetAttribute("WorldPlanLongestSlice") as number ?? 0;
      rows.push({ id, seconds, gap: timing.buildMaxGap, batch, slice, ok });
      print(`MISSION_PERF_ROW M${id} ${string.format("%.3f",seconds)} ${string.format("%.3f",timing.buildMaxGap)} ${string.format("%.3f",timing.maxGap)} ${batch} ${slice} ${fixture?.GetAttribute("WorldPlanCPUSeconds")} ${gcinfo()} ${timing.phases} status=${ok ? "OK" : "BUILD_FAILED"} error=${errorMessage}`);
     }
    }
   }
  } finally {
   // Last-world disposal has its own recorder too.
   const recorder = recordWorldHeartbeats(18);
   try { recorder.phase("previous-world-cleanup-final"); destroyWorld(previous); clearTerrainIfDirty(); RunService.Heartbeat.Wait(); }
   finally { const timing = recorder.finish(); print(`MISSION_PERF_FINAL_CLEANUP maxGap=${timing.maxGap} ${timing.phases}`); UploadedAssets.Configure(); }
  }
  expect(rows.size()).toBe(18);
  for (const row of rows) {
   print(`MISSION_PERF_ASSERT M${row.id}`);
   expect(row.ok).toBe(true);
   expect(row.seconds).toBeGreaterThan(0);
   expect(row.seconds).toBeLessThanOrEqual(16);
   expect(row.gap).toBeLessThanOrEqual(0.3);
   expect(row.batch).toBeLessThanOrEqual(0.3);
   expect(row.slice).toBeLessThanOrEqual(0.1);
  }
 }, 3_300_000);
});
