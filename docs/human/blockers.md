# Blockers and acceptance gaps

PR #216 follow-up validation: frozen install and prescribed validate:offline both exit 0; 1,223 Luau contracts, 487 module compilations, 148 Python tests. No real uploads, secrets, canonical upload state, Studio or Player tests. Merge pending.

PR #216 (unmerged): heavy-bomber and carrier have an incomplete REJECT for the same revision-2 hashes later approved. Strictest-decision rule now refuses reupload. PR207 assets/evidence await merge; other insufficiently documented exports remain unapproved (full list in docs/qa/asset-reviews/upload-approval-format.md). No existing live asset is changed. State-dir, local-only review and retry bypass fixes implemented and validated offline.

Open owner-reported Player bug (main c1266e30, M01 Normal, phone): NEXT: MISSION 02 silently does nothing even after cloud confirmation. Root cause: GameUI.nextMission checks stale pre-sortie slots before sending any remote; Completed never refreshes them. Existing restartMission also stops at briefing. Pending PR removes that client authority check, uses the normal launch/loading path, and queues the server request while settlement releases its session. Timeout/refusal shows an error and returns to results for retry. Pending cloud writes do not block authoritative in-session progression. Review also found Next bypassed unseen chapters and launch automatically recorded them seen, violating D-030. PR #202 now shares chapter gating without restoring stale unlock checks, binds played/skipped chapter acknowledgement to an unlocked mission, and records the finale after its callback rather than victory. Offline regression coverage added; PR remains unmerged and owner device verification remains open.

No campaign implementation or merge dependency remains: practice, M01–M18 and engine batches D1–D13 are on main `4594c365`.

| Open item | Impact / assumption | Needed action |
|---|---|---|
| Player and real-phone verification | Current campaign has no recorded full Player acceptance; nobody has playtested M06–M18 in Player/on phone. Studio Jest passes do not establish visual quality or difficulty feel. | Owner follows [next.md](next.md), especially phone missions 10/15/16; report difficulty, targeting, service and loading. |
| Provisional reference counts and rank cuts | Authored rosters/subtypes/ranks remain adaptations; source totals and exact thresholds are unresolved in several later missions, including M06 initial/credited inventory and M17 initial-versus-total targets. | Compare source evidence and human score runs before tuning; do not label inferred values exact. |
| Modelled-only fairness | M11/M14 and M15–18 rule scenarios omit full runtime/human conditions, assembled scenery, complete hostile AI and some resource/pose variations. | Observe full sorties; calibrate escort/column survival and Rusk duel with carried damage, depleted stocks and real reaction time. |
| Audio/voice uploads permanently blocked (D-142, D-666) | New/changed dialogue remains subtitles only; existing approved voices remain. Legacy HALT remains an audio halt. | No audio uploads; removing halt files does not lift the code ban. Independently reviewed models are allowed under D-666. |
| Rendered/loading/controller acceptance | M03 distant terrain/return guidance, M05 dark props and real-controller menu, later mission sightlines and phone performance unverified. | Record actual Player observations and prioritize concrete fixes. |

Resolved: all sequential mission/engine dependencies and stale branch ancestry/merge ordering; D13 Luau register exhaustion and incomplete runtime fixtures; authored-arrival Jest assertions for M08/M09/M14; numeric catalog portability normalization. The orchestrator reports every mission's full Studio Jest suite passed before merge, culminating in M18 1,450/1,450. This reconciliation did not rerun Studio.

Publish check (2026-10-31): latest 20 main “Publish to Roblox” runs showed 20 successes, including [M18 run 41187517345](https://github.com/A-Ricemusic/skybreak/actions/runs/41187517345) successful; no failure in that sample. Live status follows the owner's pipeline convention and is separate from observed Player quality.

Pending tooling change (2026-10-31, D-666): split the audio and model HALTs. The legacy voice rejection and audio journal no longer block reviewed model uploads. A model-class rejection writes `HALT-models-3407487520` and blocks models/meshes/images. Shared `audio-upload.lock` stays in place. No uploads or state-file migrations performed.
