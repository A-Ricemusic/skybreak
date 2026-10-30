# M12 Command Ring — procedural world in review

Implements the dormant world slice of [world spec](m12.md) and [mission spec](../missions/m12.md), decisions D-230–D-232. Original arid crater and monumental paired-rail emplacements, clear pale-blue 10:08 daylight, concrete radial and ring paving. Floor Y80, rim bands320/544, outer hills≤672. The ring is centred at(0,0), radius2,400; eight circular480-diameter pads (480×480 bounding footprints) support seven live-capacity guns and one existing southeast wreck (orientation explicitly authored, not proven by footage). No eighth scoreable gun. Tower height80 and rail length240 match the provisional scale. The central ECM and9 AA/7 SAM sites complete24 live ground contact capacity, each with a unique exported id in `m12TargetLayout`.

Initial briefing metadata stays3 air/18 ground/21 total, distinct from24 ground and9 air credited kills. Strike15:00 and elite10:00 are exported metadata; seven-gun completion, ECM radar changes, defence arrivals, initial aircraft, five-elite arrival/one-loss retreat, ammunition, rearm and score ownership are mission integration work. No static combat jets are fabricated to represent unseen rosters.

Ingress(0,500,10080), northbound, and the southwest resupply strip(-8640,104,10560) are authored assumptions. Runway2304×128, split into bounded sections, with3200-stud clear approaches at each end plus100-stud side margins. Runway top106 includes a2-stud asphalt skin above foundation top104. All foundations overlap the Y80 terrain and rise24 studs above it. Recovery marker is outside the ring at(4200,1200), not an ejection/health mechanic. Pads, modular roads and rails are procedural review geometry; exact silhouette/material fidelity and damage animation need rendered acceptance before activation.

## Ownership, safety and validation

Built on PR #167 (`1b33139cc6740f07cd2279df2f30c0b69618dad6`), above #166 and #164. Rebase onto main when the dependency stack merges. The registry recognizes the key, but no catalog entry selects it. `CompositionWorld` returns `groundTargets: []`; id-named models are scenery adoption points, never live combat/score actors. `registerWorldClear` uses the native terrain lifecycle. No existing mission, combat control, physics or asset is replaced.

Reuses `CompactWorldSurface` and the shared chunk/yield estimator with 0.25 s terrain slices: 0.07 ms solid / 0.2 ms water per scheduled 128-stud chunk touch, modeled frame yields and 3 s overhead. Limits: 600M voxel writes, 15,000 jobs, 650 Parts, 60 props, 2,600 descendants, ≤16 s estimate with a ≤15 s regression gate. These are offline estimates, not measured Studio performance.

Land uses 8-stud caps and shared-edge/perimeter curtains entirely at/above Y=0, beyond the 16,000-stud hard boundary. Every 128-stud column and mixed edge is tested for sealing. Neither world contains a river or ocean; no fake solid seabed, below-zero floor or Sea Parts are introduced. Water connectivity is therefore vacuous; M13 additionally flood-fills the actual emitted low caps to prove one connected traversable passage. All Part dimensions are ≤2,048. No uploaded props, Blender assets, exports or uploads are involved.

Offline tests cover deterministic plans/checkpoints, dormant registration, ids/counts/positions, complete foundation footprints and non-overlap, Part limits, whole-world cap/edge sealing, approach and route obstruction against emitted terrain/Parts, connected generated ravine floor, mission metadata and budget headroom. `bun install --frozen-lockfile`, `bun run build`, and the requested `LUAU_BIN=... bun run validate:offline` all passed, with full validator exit0:788 offline Luau contracts,122 Python tests, plus catalog/UI/voice/radio/document/place gates. Studio/Player/phone performance, rendered reference comparison, flight feel, animated destruction and owner acceptance remain open. No new footage/audio inspection is claimed; accepted specifications supply the reference evidence.

## Offline build budget

142,681,600 voxel writes · 4,479 jobs · 76,728 solid / 0 water chunk touches · 22 modeled yields · 128 Parts · 0 props · 384 reserved descendants · **12.770960 s** estimate (3.229040 s headroom).

## Complete scenery layout

Coordinates are studs; yaw radians. Live capacity is metadata only, not actor state.

| ID | Type | Group | X | Y | Z | Yaw | Live capacity |
|---|---|---|---:|---:|---:|---:|---|
| m12_gun_1 | ring_gun | ring | 0.000 | 104 | -2400.000 | -0.000 | yes |
| m12_gun_2 | ring_gun | ring | 1697.056 | 104 | -1697.056 | -0.785 | yes |
| m12_gun_3 | ring_gun | ring | 2400.000 | 104 | -0.000 | -1.571 | yes |
| m12_gun_4 | gun_wreck | ring | 1697.056 | 104 | 1697.056 | -2.356 | no |
| m12_gun_5 | ring_gun | ring | 0.000 | 104 | 2400.000 | -3.142 | yes |
| m12_gun_6 | ring_gun | ring | -1697.056 | 104 | 1697.056 | -3.927 | yes |
| m12_gun_7 | ring_gun | ring | -2400.000 | 104 | 0.000 | -4.712 | yes |
| m12_gun_8 | ring_gun | ring | -1697.056 | 104 | -1697.056 | -5.498 | yes |
| m12_ecm | ground_ecm | core | 0 | 104 | 0 | 0 | yes |
| m12_defence_1 | aa | defence | 296.599 | 104 | -3286.644 | -0.090 | yes |
| m12_defence_2 | aa | defence | 1531.766 | 104 | -2922.960 | -0.483 | yes |
| m12_defence_3 | aa | defence | 2533.736 | 104 | -2114.281 | -0.875 | yes |
| m12_defence_4 | aa | defence | 3149.967 | 104 | -983.722 | -1.268 | yes |
| m12_defence_5 | aa | defence | 3286.644 | 104 | 296.599 | -1.661 | yes |
| m12_defence_6 | aa | defence | 2922.960 | 104 | 1531.766 | -2.053 | yes |
| m12_defence_7 | aa | defence | 2114.281 | 104 | 2533.736 | -2.446 | yes |
| m12_defence_8 | aa | defence | 983.722 | 104 | 3149.967 | -2.839 | yes |
| m12_defence_9 | aa | defence | -296.599 | 104 | 3286.644 | -3.232 | yes |
| m12_defence_10 | sam | defence | -1531.766 | 104 | 2922.960 | -3.624 | yes |
| m12_defence_11 | sam | defence | -2533.736 | 104 | 2114.281 | -4.017 | yes |
| m12_defence_12 | sam | defence | -3149.967 | 104 | 983.722 | -4.410 | yes |
| m12_defence_13 | sam | defence | -3286.644 | 104 | -296.599 | -4.802 | yes |
| m12_defence_14 | sam | defence | -2922.960 | 104 | -1531.766 | -5.195 | yes |
| m12_defence_15 | sam | defence | -2114.281 | 104 | -2533.736 | -5.588 | yes |
| m12_defence_16 | sam | defence | -983.722 | 104 | -3149.967 | -5.980 | yes |
