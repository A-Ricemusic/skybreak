# PR275 aggregate elapsed diagnostics

Base: `cdb496c1a9a20464c0f8513313e6b9f996e5144a`. Existing dedicated PR275 worktree only. Runtime's original r9 files remain immutable in the shared root. No Studio, engine, old-artifact rebuild, live writes, uploads, new checkout, merge, watch or subagents. User explicitly transferred the bounded compile/focused-offline/format-lint lease after correcting runtime's notification to the old loading author; no duplicate heavy work was reported.

## Why measure

The completed independent `d384601d` investigation was read in full. R9 at this base executed 15 suites: **84 passed / 1 failed**, adjunct unrun. Water preflight 2/2 matched 6,120 material/occupancy cells; M4 cold 11.563 s, repeat 13.052 s and campaign 17.122 s passed. Loading 40/40, terrain 33/33 and native 4/4 passed; smoke 3/4 failed M13 request 25.2928 s against 25 s. Fourteen campaign Ready rows and two distinct M4 preflight rows; five later missions blocked/unverified. Both teardown scopes reported all eight fields true, zero teardown failures. This is not an 86-case pass or a natural campaign/Player/mobile/cloud/visual claim.

M13 planner 0.03195 s, terrain callbacks 17.13076 s, terrain-ready 25.18103 s / 65 yields / 846 jobs, World.Build 25.23849 s leave approximately 8.018 s combined overhead before terrain-ready. Its source was unchanged. The gap does not establish contention, native-engine regression or another cause. This patch measures it; it is not a performance repair claim. Budgets remain 22/25/30 s, terrain .25 s and planning .05 s.

## Diagnostic contract, schema 1

Every new duration is an elapsed monotonic-clock span in seconds, **not CPU time**. Work callbacks include native dispatch, argument construction and small completed-group accounting; they are not pure native-engine timing. Original `WorldTerrain*`, `WorldBuildSeconds`, readiness and planner attributes retain their existing meaning. No geometry, native call dispatch/arguments/order/count, scheduling cap, cancellation condition, final-yield check or cleanup registration/persistence algorithm changes.

Composition builders (including M13 and M14–M18 when reached) publish `WorldBuildElapsedDiagnostics` JSON and one `MISSION_BUILD_ELAPSED` aggregate line per successful build. `WorldDiagBuildStatus` starts `incomplete`; new fields from a previous attempt are cleared. It becomes `complete` only at normal completion. Partial failures retain the completed `WorldDiagPlanElapsedSeconds`, `WorldDiagSetupElapsedSeconds` and `WorldDiagFootprintElapsedSeconds` boundaries, without a false completed build snapshot.

The composition aggregate covers:

- `planElapsedSeconds`: entry through planner/profile completion, including profiler overhead and any planner waits; existing planner attributes remain separate.
- `setupElapsedSeconds`: environment/assets/material setup and scene/contact model setup.
- `footprint`: total registration, prelude (including any existing recovery), cleanup-op conversion, persistence, JSON encoding, ServerStorage page creation/removal; page count and encoded byte count. The **entire original footprint is still registered and persisted before the first terrain write**.
- `terrain`: the write aggregate below.
- `beforeTerrainOtherElapsedSeconds`: remaining reporting/call-boundary time between setup completion and terrain-ready attribute publication, excluding footprint and measured write spans.
- `dressingElapsedSeconds`: placement and its existing scheduler waits.
- `postBuildElapsedSeconds`: instance-budget assertion, final attributes and build-tail tracing up to the snapshot boundary.
- `elapsedSeconds`: entry through that same snapshot boundary. The subsequent JSON/attribute/print publication has its own `WorldDiagPublishElapsedSeconds` attribute. The request/readiness interval outside the builder remains separate and must be measured by the runtime request seam, not labelled CPU or inferred as waits.

`TerrainWriter.Write` returns `diagnostics` and publishes `SKYBREAKTerrainWriteElapsedDiagnostics` on Terrain, initially `status=prepare` (an incomplete attempt marker), and again on normal completion, returned cancellation or caught error. Publication is best-effort and cannot replace a native error or fail an otherwise completed write. It has:

- `executionPreparationElapsedSeconds`: exactly the existing `terrainExecutionJobs` call.
- `summaryPreparationElapsedSeconds`: a separate single linear pass that classifies jobs, without changing them.
- `scheduler`: completed work, failed callback elapsed, pause-callback total/max, max attempted job, max resumption batch (including the final unyielded batch/check), residual loop/instrumentation time, completed count, yields and terminal status.
- `actualWaitElapsedSeconds` / `maxActualWaitElapsedSeconds`: exactly the injected `task.wait` call, excluding existing pre-yield and post-resumption reports. A throwing wait is measured once and rethrown. The **first pause is included**.
- `groups`: job counts and summed **estimated repeated-write cells** by material and native method (`FillRegion`, `FillBlock`, `FillWedge`, `FillBall`, `FillCylinder`, `ReadVoxels+WriteVoxels`). `planned*` is preparation output, `completed*` counts only callbacks that returned successfully. A failing job may already have made a partial native write or ReadVoxels call; completed counters do not claim otherwise. These are not unique occupied volume, engine memory, measured chunk work, or proof of native occupancy.
- `elapsedSeconds` and `otherElapsedSeconds`: complete measured write interval through the final capture boundary, plus residual setup/reporting overhead. Final snapshot publication and trace closure lie outside this write span and are included in the surrounding composition residual.

Hard task cancellation can skip finally and the post-pause measurements. An initial `prepare` snapshot is incomplete, never a resume cursor or success; existing cleanup progress is still persisted **before yielding**, and original footprint pages remain authoritative. Failed preparation that does not return cannot populate completed preparation spans; its elapsed time remains in the write residual with failed status. Existing retry starts from the full original footprint and clean is marked only after completion.

### Do not sum nested measurements twice

```text
composition.elapsed = plan + setup + footprint.elapsed + terrain.elapsed
                    + beforeTerrainOther + dressing + postBuild
terrain.elapsed     = executionPreparation + summaryPreparation
                    + scheduler.elapsed + terrain.other
scheduler.elapsed   = completedWork + failedWork + pauseCallback + scheduler.other
footprint.elapsed   = prelude + conversion + persistence
```

Actual wait is **inside** pauseCallback. JSON/storage are **inside** footprint persistence. Group work and maxima are descriptive subsets, not additional elapsed durations. Small floating-point residuals are not clamped or relabelled as a cause.

## Bounded overhead and invariants

No per-job/per-voxel print or timer is added. The scheduler retains its two existing clock calls around each job. Instrumentation adds one clock at each pause-callback entry and one terminal capture; the actual wait wrapper adds two per wait. Preparation and build phases use a constant number of boundary clocks. Group classification is one O(jobs) pass plus one reference and two counter updates per completed job; job accounting lies inside the measured callback. No additional voxel reads/writes, spatial normalization, geometry/material cache, native-call coalescing or alignment cleanup is included.

[Source invariants](source-invariants.json) prove the complete `TerrainWriter.run` native dispatch function equals base text exactly, including its duplicate alignment calculation; frozen M13 planner/world, compact/sealed surfaces and M4 planner are unchanged. No claim of a native speedup or budget recovery is supported. The default official offline adapter still executes all registered specs; this patch only registers the new pure module/spec in its dependency graph.

## Checks and next gate

Official standalone Luau focused adapter: **58 passed / 0 failed across six suites**, guards **4/4**. Eleven new meaningful diagnostics cases cover nonoverlapping preparation/work, first pause, initial scheduling/check delay, final batch, cancellation at final yield, throwing work and pause/wait callbacks, sink reuse, bounded extra clocks with identical budget schedule, hard coroutine stop/no late writes/full retry, method/material classification and unchanged job order/fields. Existing dirty-state, cancellation/error/final-yield recovery, lifecycle and loading suites remain included. [Focused output](focused-tests.txt).

roblox-ts compilation passed. Required `bun run format && bun run lint` results and final exact head are reported in the handback. No full offline, CI or engine run under this bounded lease. Early compile caught a reserved Luau local name and was corrected before the successful build; this is not an engine failure.

```sh
bun run build
LUAU_BIN='/Users/pelicannurse/Projects/test app/build/offline-luau/luau' bun tools/test-relay-offline.ts --spec=TerrainDiagnostics.spec --spec=TerrainSchedule.spec --spec=TerrainWriteState.spec --spec=WorldLifecycle.spec --spec=LoadingGate.spec --spec=LaunchLoading.spec
bun run format && bun run lint
```

Parent holds independent source/artifact review. Only afterward should runtime execute a **predeclared bounded paired baseline/candidate protocol** with identical seed, initial cleanup, module/registry state and relevant campaign prefix, retaining all trials and all limits. Instrumented candidate overhead is itself measured; baseline r9 remains immutable. No rerun-until-green, blind optimization or owner playtest dependency. #273 merged with conflict flag false/F1 open; #274 merged/live by convention with earlier selected 34/34 + synthetic 4/4 acceptance; #275 remains unmerged. All six human docs reconciled.
