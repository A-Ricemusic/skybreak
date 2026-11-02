# Lifecycle Jest investigation — #239 contains #238

Evidence supplied by the orchestrator; this implementation session did not run Studio or Player.

- Main `3ed084dd` and main+#231: no final summary after the expected WorldLifecycleRuntime warning.
- #238 at `5e40a109`: `/tmp/sq-238/build/jest-studio.log` reports WorldInstanceBudget at 834.982 seconds, M16 timeout at 120.162 seconds, and the second M03 test timeout at 20.044 seconds. WorldLifecycle then passes; the expected runtime error warning is again the last test output. Exact runtime test/call causing the stall cannot be identified from buffered suite output.

## Why the budget tests are slow

#238 already mocks `TerrainWriter.Write` and `WorldBuildScheduler.Pause`. Thus the file still invokes all 18 full world builders, but neither writing terrain nor waiting a frame is required to consume the time: every builder first generates a full terrain plan. M16 calls `buildM16ScenePlan` → `buildM16Plan` → `worldDressing` → `compactSurface`, filling a 128-stud height lookup over the whole footprint and computing cap/curtain operations before the mocked writer. It then creates the complete dressing/target instance graph. M03 likewise calls `buildM03Plan` before its writer. #238 caches one M03 plan in beforeAll, but both M03 Build calls regenerate it internally; its second M03 test retains Jest's default 20-second limit. The supplied log demonstrates those limits were exceeded; phase-by-phase CPU/allocation costs were not measured, so planning versus instance construction is not presented as a measured timing split.

The hypothesis that Jest never stops timed-out test bodies is too broad for the installed dependencies. `@rbxts-js/jest-circus/src/circus/utils.lua:callAsyncCircusFn` rejects its promise on timeout. `@rbxts-js/roblox-lua-promise/lib/init.lua:_reject` calls `_finalize`, which defers `coroutine.close` on the executor. This closes the test coroutine, but is not a general cancellation/join of detached task.spawn work. A timed-out body surviving is not established by the supplied log. Neither does the expected lifecycle warning establish that the first runtime test is the stall.

## Revised coverage and ownership

#239 is rebased onto `fix/military-kit-load` at `5e40a109` and supersedes/contains #238. The budget spec no longer starts any full world builder or full terrain planner. Existing M01–M18 WorldPlan specs retain complete plan/count/cap coverage in Studio and offline. This deliberately removes duplicate whole-world engine assembly from this unit spec; it is not a claim of full-world engine acceptance.

Small real-engine fixtures instead cover every military target mapping, exact base/kit accounting, all 138 M16 ground targets, hard caps/reserves, template reuse, and oversize rejection. M03's target-only assembly is extracted and shared with the production world; its 14 real support layouts and procedural target/aim models are checked without generating the mountain shell/dressing plan. No environment mutations, terrain writes or task scheduler patches are needed by this spec.

Fixture templates load directly through a synchronous synthetic loader using `Template`, not `Preload` (which spawns tasks). Each test and fixture setup resumes its own tracked coroutine once. Any unexpected yield is immediately cancelled and rejected; afterEach and afterAll cancel suspended workers, destroy the instance root, and reset the upload cache/configuration. Each case starts with a fresh synchronously loaded cache. A regression case proves the unexpected-yield worker is dead and its continuation did not run. Each case has a five-second Jest limit and the whole file asserts a 90-second budget, below the requested 120-second target. Wall-clock duration still requires the orchestrator's Studio run; offline source contracts prevent reintroducing full builds/planning, asynchronous preload or task.spawn/defer.

WorldLifecycleRuntime retains five-second polling/AwaitIdle bounds, a self-expiring cancellation fixture, tracked step/coordinator cleanup and scoped clear registration restoration. Its native terrain-clear probe is replaced by isolated terrain-state contracts; the production clear callback is unchanged.

## Remaining acceptance

Run the full Studio suite using #239 alone, since it includes #238. Confirm the budget file is below 120 seconds, WorldLifecycleRuntime and WorldPlan finish, and a final summary is emitted. The exact engine/runtime stall remains unconfirmed until that run. No uploads, keys or merges were performed by this session.
