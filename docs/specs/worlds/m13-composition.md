# M13 Evidence Through the Grey — procedural world in review

Implements the dormant world slice of [world spec](m13.md) and [mission spec](../missions/m13.md), decisions D-233–D-234. Dark rock/olive benches, diffuse grey11:05 stratus, full cloud cover with mobile cloud density0.3; no precipitation/lightning. Cloud base reference3000ft is metadata, not a physical layer. Fog readability needs rendered/mobile acceptance.

`m13JammerLayout` exports32 airborne jammer scenery ids across8 clusters of4, X offsets-850/-350/+350/+850 from the winding track, staggered Z and Y450/590/730/870. Original elongated60-stud block hulls and visible equipment keels are procedural review silhouettes, not uploaded balloon assets or operational jammers. `m13Routes` exports129 samples,418-second duration. Plane ingress(0,383,11520), then(-3360,383,6240), (2400,383,0), (-1920,383,-5760), exit(0,383,-11520). The static36-stud protected-plane silhouette is placed2% along the route ahead of the player, and must be adopted/removed before live actor integration.

A900-stud tested flight tube follows every bend with≥100-stud terrain clearance and no jammer obstruction. The1,024-stud surface raster conservatively reserves the entire route sweep per row plus1100-stud margins, so the actual floor is wider than the proposed500–900-stud minimum flyable corridor. Side basins widen further. Floor128, benches256, rock walls768–896 (within1050). This conservative coarse collision envelope is an explicit adaptation pending rendered flight review, not a surveyed ravine. No invented runway, ocean or settlement. `m13RoutePoint` preserves every sketch anchor; distance/speed pacing remains an authoring proposal.

Metadata preserves≥1300 points at7:00 expiry,32 credited jammer kills, then15:00 protecting the evidence aircraft. It does not end the sweep at13 balloons or pretend32 is the proven full deployed source roster. Four ordinary fighters plus an optional named ace/five total credited kills, fighter staging(±5760,-8640), spatial jammer coverage, radar/visual guns, aircraft health/priorities and mission update logic remain mission-owned integration work. No live escort, score or radar behaviour is implemented by this world.

## Ownership, safety and validation

Built on PR #167 (`1b33139cc6740f07cd2279df2f30c0b69618dad6`), above #166 and #164. Rebase onto main when the dependency stack merges. The registry recognizes the key, but no catalog entry selects it. `CompositionWorld` returns `groundTargets: []`; id-named models are scenery adoption points, never live combat/score actors. `registerWorldClear` uses the native terrain lifecycle. No existing mission, combat control, physics or asset is replaced.

Reuses `CompactWorldSurface` and the shared chunk/yield estimator with 0.25 s terrain slices: 0.07 ms solid / 0.2 ms water per scheduled 128-stud chunk touch, modeled frame yields and 3 s overhead. Limits: 600M voxel writes, 15,000 jobs, 650 Parts, 60 props, 2,600 descendants, ≤16 s estimate with a ≤15 s regression gate. These are offline estimates, not measured Studio performance.

Land uses 8-stud caps and shared-edge/perimeter curtains entirely at/above Y=0, beyond the 16,000-stud hard boundary. Every 128-stud column and mixed edge is tested for sealing. Neither world contains a river or ocean; no fake solid seabed, below-zero floor or Sea Parts are introduced. Water connectivity is therefore vacuous; M13 additionally flood-fills the actual emitted low caps to prove one connected traversable passage. All Part dimensions are ≤2,048. No uploaded props, Blender assets, exports or uploads are involved.

Offline tests cover deterministic plans/checkpoints, dormant registration, ids/counts/positions, complete foundation footprints and non-overlap, Part limits, whole-world cap/edge sealing, approach and route obstruction against emitted terrain/Parts, connected generated ravine floor, mission metadata and budget headroom. `bun install --frozen-lockfile`, `bun run build`, and the requested `LUAU_BIN=... bun run validate:offline` all passed, with full validator exit0:788 offline Luau contracts,122 Python tests, plus catalog/UI/voice/radio/document/place gates. Studio/Player/phone performance, rendered reference comparison, flight feel, animated destruction and owner acceptance remain open. No new footage/audio inspection is claimed; accepted specifications supply the reference evidence.

## Offline build budget

147,203,584 voxel writes · 4,563 jobs · 80,760 solid / 0 water chunk touches · 23 modeled yields · 67 Parts · 0 props · 323 reserved descendants · **13.253200 s** estimate (2.746800 s headroom).

## Complete scenery layout

Coordinates are studs; yaw radians. Each id owns its silhouette; plane is friendly and scores zero.

| ID | Type | Group | X | Y | Z | Yaw | Live capacity |
|---|---|---|---:|---:|---:|---:|---|
| m13_jammer_1 | airship | cluster_1 | -2580.909 | 450 | 8800 | 0 | yes |
| m13_jammer_2 | airship | cluster_1 | -2080.909 | 590 | 8800 | 0 | yes |
| m13_jammer_3 | airship | cluster_1 | -1126.364 | 730 | 9200 | 0 | yes |
| m13_jammer_4 | airship | cluster_1 | -626.364 | 870 | 9200 | 0 | yes |
| m13_jammer_5 | airship | cluster_2 | -4171.818 | 450 | 6300 | 0 | yes |
| m13_jammer_6 | airship | cluster_2 | -3671.818 | 590 | 6300 | 0 | yes |
| m13_jammer_7 | airship | cluster_2 | -2717.273 | 730 | 6700 | 0 | yes |
| m13_jammer_8 | airship | cluster_2 | -2217.273 | 870 | 6700 | 0 | yes |
| m13_jammer_9 | airship | cluster_3 | -1957.692 | 450 | 3800 | 0 | yes |
| m13_jammer_10 | airship | cluster_3 | -1457.692 | 590 | 3800 | 0 | yes |
| m13_jammer_11 | airship | cluster_3 | -1126.923 | 730 | 4200 | 0 | yes |
| m13_jammer_12 | airship | cluster_3 | -626.923 | 870 | 4200 | 0 | yes |
| m13_jammer_13 | airship | cluster_4 | 350.000 | 450 | 1300 | 0 | yes |
| m13_jammer_14 | airship | cluster_4 | 850.000 | 590 | 1300 | 0 | yes |
| m13_jammer_15 | airship | cluster_4 | 1180.769 | 730 | 1700 | 0 | yes |
| m13_jammer_16 | airship | cluster_4 | 1680.769 | 870 | 1700 | 0 | yes |
| m13_jammer_17 | airship | cluster_5 | 650.000 | 450 | -1200 | 0 | yes |
| m13_jammer_18 | airship | cluster_5 | 1150.000 | 590 | -1200 | 0 | yes |
| m13_jammer_19 | airship | cluster_5 | 2150.000 | 730 | -800 | 0 | yes |
| m13_jammer_20 | airship | cluster_5 | 2650.000 | 870 | -800 | 0 | yes |
| m13_jammer_21 | airship | cluster_6 | -1225.000 | 450 | -3700 | 0 | yes |
| m13_jammer_22 | airship | cluster_6 | -725.000 | 590 | -3700 | 0 | yes |
| m13_jammer_23 | airship | cluster_6 | 275.000 | 730 | -3300 | 0 | yes |
| m13_jammer_24 | airship | cluster_6 | 775.000 | 870 | -3300 | 0 | yes |
| m13_jammer_25 | airship | cluster_7 | -2623.333 | 450 | -6200 | 0 | yes |
| m13_jammer_26 | airship | cluster_7 | -2123.333 | 590 | -6200 | 0 | yes |
| m13_jammer_27 | airship | cluster_7 | -1556.667 | 730 | -5800 | 0 | yes |
| m13_jammer_28 | airship | cluster_7 | -1056.667 | 870 | -5800 | 0 | yes |
| m13_jammer_29 | airship | cluster_8 | -1790.000 | 450 | -8700 | 0 | yes |
| m13_jammer_30 | airship | cluster_8 | -1290.000 | 590 | -8700 | 0 | yes |
| m13_jammer_31 | airship | cluster_8 | -723.333 | 730 | -8300 | 0 | yes |
| m13_jammer_32 | airship | cluster_8 | -223.333 | 870 | -8300 | 0 | yes |
| m13_evidence_plane | evidence_plane | protected | -293.236 | 383 | 11059.200 | 0 | protected |
