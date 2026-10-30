# M01 pressure tuning verification — 2026-10-29

Scope: source/data tuning; no Studio or Roblox Player combat test performed.

- `bun install --frozen-lockfile`: passed.
- `bun run build`: passed; offline gate also builds the isolated test place.
- Offline Luau contracts: 733 passed, 0 failed, including player targeting slots/overrides, forward arrival angles, wave queue, rank boundaries, route/pursuit and snapshots.
- Full offline gate: passed with the requested `LUAU_BIN` override; catalog snapshots, relay/audio/voice/radio checks, 122 Python tests and generated-doc checks passed.
- `bun run test:roblox`: not launched. It unconditionally starts Studio, which would violate this task's lease condition.
- Scripted/observed mission run: not performed. Shots at player: **unmeasured**; shots at allies: **unmeasured**. 80% refers to targeting slots, not measured shots or a claimed playtest result.

Lease checks: `pgrep -x RobloxStudio` returned PID **78049** at 2026-10-30 01:00:53, 01:02:13, 01:02:41, 01:03:10, 01:03:57, 01:04:45, 01:05:01, 01:05:30, 01:06:26 and 01:07:03 UTC (2026-10-29 local). Its command identifies another checkout's `t3-7d0491ed/build/m03-qa.rbxlx`. An independent read-only lease investigation confirmed the owner and competing demand. No Studio was started, stopped, killed or modified. These are busy checks spanning over five minutes, **not** the required five-minute empty interval.

Before marking ready: orchestrator assigns exclusive Studio access; current owner closes it; confirm repeated empty `pgrep -x RobloxStudio` checks spanning at least five minutes. Run `bun run test:roblox`, close only the instance started for this task, then perform an M01 combat run. Count actual hostile launches against the player and allies; verify the five admitted opening raiders approach ahead, the remaining opening requests queue, rear reinforcements fire once at 120 s, ace/escort retain 150 s priority, tails cause breaks/flares and return attacks, and Easy still permits interception. Normal/Ace and phone balance require observation. Do not infer playability from target-selection unit tests.
