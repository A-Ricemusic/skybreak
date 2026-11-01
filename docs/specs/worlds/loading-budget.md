# Campaign loading estimate gate — proposed 2026-10-31

Baseline: origin/main `cb8e1d10`. Values are pure-plan composition estimates in seconds, not measured build, replication or phone load times. M01/M02 retain their older job-based calibration; M03 switches from that older job model to the chunk-touch/yield model used by M04 onward. M06–M18 retain their original schedules and estimates. The audit’s M01 ~10.33 s figure was stale: source actually reports 19.963 s. M01 also needs this fix; no M06–M18 mission exceeds 16 s.

| Mission | Before estimate (s) | Proposed estimate (s) |
|---|---:|---:|
| M01 | 19.963 | 13.466 |
| M02 | 10.467 | 10.467 |
| M03 | 19.613 | 14.734 |
| M04 | 16.160 | 15.104 |
| M05 | 37.441 | 15.828 |
| M06 | 10.265 | 10.265 |
| M07 | 14.501 | 14.501 |
| M08 | 4.235 | 4.235 |
| M09 | 10.474 | 10.474 |
| M10 | 14.739 | 14.739 |
| M11 | 14.455 | 14.455 |
| M12 | 12.771 | 12.771 |
| M13 | 13.253 | 13.253 |
| M14 | 7.022 | 7.022 |
| M15 | 11.352 | 11.352 |
| M16 | 12.300 | 12.300 |
| M17 | 7.283 | 7.283 |
| M18 | 3.702 | 3.702 |

M01 merges adjacent non-overlapping land blocks with identical materials and vertical bounds, preserving its original water operations, Parts and props. Its fill cap rises to 262,144 voxels; the old job-based estimator and 8 ms budget remain. A standalone Luau comparison against the pre-merge plan verified identical 16-stud land-column intervals/materials, native water operations and all Parts/props (25,152 → 14,047 planned operations). The audit’s smaller M01 number must not be used as the baseline.

M03: 30,590 → 29,566 scheduled calls. Its caps, shared-edge curtains, terrain sampling, materials, runway, scenery and target poses remain unchanged; only the buried Y=-4..0 floor is removed. Exhaustive existing cap/join/perimeter tests establish the shell is closed through hard airspace, so the removed floor cannot be seen or collided with from flyable airspace. Loading budget changes from 8 ms to 0.5 s, with 262,144-voxel calls.

M04: 11,584 → 8,563 calls. M05: 8,861 → 5,205 calls. Native water tiles keep exactly the same footprints, depth, opacity and top Y=32; the existing scheduler partitions whole tiles on voxel planes instead of the planner pre-splitting into 128-stud strips. Caps, curtains, land, dressing and target IDs/poses remain unchanged. Fill cap rises from 65,536 to 262,144 voxels; loading work budgets change from 0.25 s to 0.3 / 3 s respectively. Native water remains native water, including the existing tanker keel clearance.

The model retains 0.07 ms per solid chunk touch, 0.2 ms per water touch, 0.2 s plus water-share frame penalty per yield, and 3 s fixed overhead. Its new budget argument is also passed to the runtime writer. Extrapolating the historic calibration to longer slices needs Studio acceptance. In particular M05 may hold the server for 3 s per loading resumption (plus one bounded call), trading longer individual loading stalls for fewer costly frame waits. This is not proof of faster device loading. Cleanup, cold uploads, replication and combat activation are outside the model.

The lifecycle gate still completes native clear before a new build. No asynchronous decoration is introduced: all terrain and scenery exist before the mission becomes ready. CombatService is unchanged, including its Luau local limit. No assets are uploaded.

`MissionLoadBudget.spec.ts` explicitly asserts ≤16 s for every mission and is in both offline runner lists. Existing geometry and budget tests remain. `RelayWorld.spec.ts` has one campaign-path Studio case per mission printing `MISSION_STUDIO_BUILD` with elapsed build time, plan time, terrain-ready time, terrain work, yields and longest native job when available. Uploads are fake fixtures; those times exclude cleanup/replication and do not establish phone performance. Existing M02–M05 integration timing logs remain. Studio and `test:roblox` were deliberately not run by this implementation sub-agent; the orchestrator owns those measurements.

## Offline validation

Frozen install, `bun run build`, and `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline` all exited 0. The final log records all 18 estimates above and `OFFLINE_LUAU_RESULT passed=1242 failed=0`; the Luau module guard, 19 catalog snapshots and 124 Python tests passed. Generated world counts are current. No Studio, `test:roblox`, Player or phone timing was performed.
