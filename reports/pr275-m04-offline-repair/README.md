# PR275 M4 offline repair proof

Base: `d4f311696e1b1c4f0a78209362c4f223cf1b8f5b`. Worktree: existing dedicated PR275 checkout. No Studio, engine, live write, upload, new checkout, merge or watch. Shared runtime reports were not modified.

The shipped candidate caches the original 32-track layout and a membership set lazily. `surfaceSide` only uses detail sampling, so initialization does not recurse through material. Original loop/order, snap arithmetic, yaw and seed-dependent props remain unchanged. Existing independent frozen production hash **3359413120** passes twice before and after (integer-millionth numeric encoding, exact keys/metadata/order); no baseline was recaptured. The only terrain execution change makes Water a strict coalescing barrier, preserving each original native Water FillBlock rather than treating it as ordinary replacement voxels.

| Actual M4 planner output / execution estimate | Base | Final |
| --- | ---: | ---: |
| Authored plan fingerprint, both passes | 3359413120 | 3359413120 |
| Build jobs | 8230 | 8236 |
| Cleanup jobs | 8125 | 8125 |
| Build summed voxel writes | 150028992 | 150028992 |
| Cleanup summed voxel writes | 150028992 | 150028992 |
| Build estimated 128-stud chunk touches | 97949 | 97949 |
| Cleanup estimated 128-stud chunk touches | 97949 | 97949 |
| Planner CPU seconds, pass 1 | 2.847302 | 0.035518 |
| Planner CPU seconds, pass 2 | 1.901071 | 0.036356 |

Chunk touches sum the globally aligned 128-stud bounding chunks per aligned job, including repeated touches; this is an offline estimate, not resident memory or measured native engine cost. Six additional build jobs preserve native Water boundaries; voxel volume and chunk estimates do not increase. Offline CPU timings are observations of separate runs, not engine speedup or proof of the missing 6.65 s recovery. The measured r8 surface emission component was only 2.319979 s; this repair cannot establish the full recovery.

## Rejected bounded containment experiment

[Exact candidate patch](rejected-containment.patch), [candidate planner measurements](containment-candidate.txt), and [focused experiment log](containment-candidate-tests.txt). It used same-material ordered runs, at most 128 jobs per window and 64 spatial buckets per box, with intact-window fallback; no subtraction/fragments or cross-material removal. Candidate focused tests passed 50/50 plus guards 4/4, including exhaustive mixed voxel/material comparisons, containment/corner/LOD fixtures, Water and eligibility/overflow/window fallbacks, cancellation and a pure reload/retry model. Those experimental tests are not counted as final production checks.

It saved **zero** jobs, summed voxel writes or chunk touches on actual M4 build/cleanup versus the Water-barrier-only execution. Therefore the algorithm, opt-ins and experimental recovery tests were removed from production source. No speculative intersecting-box rewrite was landed. Cleanup footprint registration, original page persistence, cancellation/error retention, reload/retry from the beginning and mark-clean-after-completion remain unchanged; existing official focused recovery tests pass. Actual ServerStorage reload/task cancellation remains an engine review obligation.

## Final checks and reproduction

- `bun run build`: passed (roblox-ts compilation, no engine).
- Official standalone Luau adapter: **77 passed, 0 failed**, seven suites; module-error guards **4/4**. Includes scheduler ordered mixed-material/Water equivalence and eligibility/chunk limits, dirty-state partial/cancel/failure/final-yield recovery, lifecycle, loading and mission budgets, M4/M5 planner tests. [Final log](focused-tests.txt).
- Focused frozen M4 planner: **2/2**, [before](before.txt), [after](after.txt).
- `bun run format && bun run lint`: passed (exit 0 for both).
- Full offline/CI and engine suites were not run under this bounded lease.

```sh
bun run build
LUAU_BIN='/Users/pelicannurse/Projects/test app/build/offline-luau/luau' bun tools/test-relay-offline.ts --spec=TerrainSchedule.spec --spec=TerrainWriteState.spec --spec=WorldLifecycle.spec --spec=LoadingGate.spec --spec=LaunchLoading.spec --spec=M04M05WorldPlan.spec --spec=MissionLoadBudget.spec
LUAU_BIN='/Users/pelicannurse/Projects/test app/build/offline-luau/luau' bun tools/test-plan-performance.ts --m04
bun run format && bun run lint
```

`--spec` rejects unknown suite names and stages the unchanged official dependency graph/guards; omitting it still runs all registered suites. `--m04` narrows only the planner loop; the original 18-mission baselines and default 36-case run remain intact. Metrics are offline only, with no runtime logging overhead. The first focused request included unavailable `BoundedWorldWork.spec`; the adapter correctly rejected it before execution, then the seven registered suites above passed.

Independent source/artifact review and coordinated fresh engine M4/cleanup + combined campaign acceptance remain mandatory. r8 source d4: loading 40/40, terrain 32/32, native 4/4; smoke 3/4, M4 28.647326 s > 22; M5–M18 blocked/unverified, five Ready rows, all eight teardown clean assertions true. Real-Enum log fix 3/3. Contention unproven. Budgets 22/25/30 and terrain .25/planning .05 remain unchanged. #273 flag false/F1 open; #274 merged/live by convention with earlier accepted 34/34 + 4/4; #275 unmerged. No Player/mobile/cloud/visual acceptance or owner-playtest dependency.
