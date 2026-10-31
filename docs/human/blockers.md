# Blockers and acceptance gaps

No campaign implementation or merge dependency remains: practice, M01–M18 and engine batches D1–D13 are on main `4594c365`.

| Open item | Impact / assumption | Needed action |
|---|---|---|
| Player and real-phone verification | Current campaign has no recorded full Player acceptance; nobody has playtested M06–M18 in Player/on phone. Studio Jest passes do not establish visual quality or difficulty feel. | Owner follows [next.md](next.md), especially phone missions 10/15/16; report difficulty, targeting, service and loading. |
| Provisional reference counts and rank cuts | Authored rosters/subtypes/ranks remain adaptations; source totals and exact thresholds are unresolved in several later missions, including M06 initial/credited inventory and M17 initial-versus-total targets. | Compare source evidence and human score runs before tuning; do not label inferred values exact. |
| Modelled-only fairness | M11/M14 and M15–18 rule scenarios omit full runtime/human conditions, assembled scenery, complete hostile AI and some resource/pose variations. | Observe full sorties; calibrate escort/column survival and Rusk duel with carried damage, depleted stocks and real reaction time. |
| Audio uploads halted by owner instruction (D-142) | New/changed dialogue remains subtitles only; existing approved voices remain. | Keep uploads halted unless the owner changes the instruction. |
| Rendered/loading/controller acceptance | M03 distant terrain/return guidance, M05 dark props and real-controller menu, later mission sightlines and phone performance unverified. | Record actual Player observations and prioritize concrete fixes. |

Resolved: all sequential mission/engine dependencies and stale branch ancestry/merge ordering; D13 Luau register exhaustion and incomplete runtime fixtures; authored-arrival Jest assertions for M08/M09/M14; numeric catalog portability normalization. The orchestrator reports every mission's full Studio Jest suite passed before merge, culminating in M18 1,450/1,450. This reconciliation did not rerun Studio.

Publish check (2026-10-31): latest 20 main “Publish to Roblox” runs showed 20 successes, including [M18 run 41187517345](https://github.com/A-Ricemusic/skybreak/actions/runs/41187517345) successful; no failure in that sample. Live status follows the owner's pipeline convention and is separate from observed Player quality.
