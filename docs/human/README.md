# SKYBREAK campaign dashboard

PR #218 ledger repair (2026-10-31, unmerged): merged main f8f3693e; added all ten military Model IDs, source FBX paths, full approval hashes and dated review/moderation evidence to docs/qa/uploaded-assets.md. Corrected the Studio Jest inventory expectation from 39 to 49; the test checks numbers/count, not Markdown. Extended the existing Python military provenance contract to verify ledger rows. Studio rerun and Player observation remain pending; no upload, publish or secret access performed. Validation: frozen install, build and prescribed LUAU_BIN validate:offline all exited 0 (163 Python tests). Studio Jest compiled but was not run.

PR #218 gate integration (2026-10-31, unmerged): merged current main; the ten military manifest entries now retain owner-reported APPROVED moderation dated 2026-10-31, model IDs and exact approval-record hashes. Gate authorization still requires identical origin/main evidence; no exemption or private journal access. Offline build authorization is checked against a temporary post-merge Git fixture. Validation completed: frozen install, standalone build, build:place and prescribed LUAU_BIN validate:offline all exited 0 (163 Python tests). Strict offline validate authorized 13 blobs and 49 IDs using a temporary post-merge Git evidence fixture; production refs were unchanged. No upload, publish, secret read, canonical upload-state access, Studio or Player test.

Military kit activation (2026-10-31, proposed/unmerged): all ten IDs assigned after independent 10/10 approval and owner-reported moderation APPROVED. On merge, realistic tanks, SAMs, AA, artillery, bunkers, radar, trucks, fuel, barracks and containers replace matching target visuals in M02/M03/M05/M06/M07/M09/M10/M12/M15/M16/M17; per-type mission list in the [upload record](../qa/asset-reviews/military-ground-kit/upload-record-2026-10-31.md). Existing proxies, procedural failure fallback and bounded preload remain. No Player quality verification.

PR #216 post-merge validation (2026-10-31): `bun install --frozen-lockfile` and prescribed `LUAU_BIN` `bun run validate:offline` both exited 0; 1,225 Luau contracts and 154 Python tests passed. No uploads or secret reads.

PR #216 merge reconciliation (2026-10-31): merged main `5eec0d06` (#207), preserving #202 and military-kit records. Third independent uploader security review passed per owner handoff. Test account mocks now avoid credential-like syntax; GitGuardian recheck failed on historical commit `3575dead` only (incident 39368345); no new-commit finding reported. Upload gate decision is D-668 (D-666 remains the military kit).

PR #216 round-2 fixes (merged d33c9a94): OS account home anchors all shared upload state; real runs reject HOME/Path.home mismatches and symlinked canonical directories. Any negative decision matching an FBX/dependency hash or the same asset/export version blocks upload; approvals still require the complete export set.

PR #216 round-2 validation: frozen install and prescribed validate:offline both exit 0; 1,223 Luau contracts, 487 module compilations, 154 Python tests. No real uploads, secrets, canonical upload state, Studio or Player tests. Merged in #216 as d33c9a94.

PR #216 security follow-up (merged d33c9a94): canonical real-upload state; merged origin/main JSON decisions and creator manifests; per-attempt HALTs. Audio remains permanently blocked. Eleven historical approvals and ten PR207 ground-kit approvals transcribed; heavy-bomber/carrier reupload blocked by earlier same-hash incomplete REJECT. No uploads or Player verification.

Pending tooling (D-668): audio/voice uploads stay permanently disabled; exact-hash models with committed independent 10/10 APPROVE evidence may pass a separate model HALT. No assets uploaded.



Updated 2026-10-31 against main `cb8e1d10` (#202); results continuation and chapter-gating fix merged/live by pipeline convention; device acceptance remains open.

Practice and all 18 campaign missions are merged and live by the owner's automatic-pipeline convention. Play through the campaign next: [Play SKYBREAK](https://www.roblox.com/games/112911685457826). Sequential unlocks still require completing preceding missions.

All missions passed the orchestrator's full Studio Jest suite before merge (reported by the orchestrator; final M18 suite 1,450/1,450). This documentation reconciliation did not launch Studio or perform Player tests. Owner Player report before #202: M01 completed on Normal on a phone, but NEXT: MISSION 02 did nothing despite cloud-save confirmation. The merged results fix shares D-030 chapter gating with menu launches: unseen chapters play before Next loads the next mission, seen chapters launch directly, and seen flags require completion/Skip acknowledgements validated against server progression. The merged results fix has offline coverage only; no agent Player or Studio test. Missions 6–18 have no Player/phone playtests. Rendered quality, human difficulty, provisional ranks/counts, real loading time and phone performance remain unverified.

PR #202 follow-up validation (2026-10-31): frozen install, build, and prescribed-LUAU_BIN validate:offline exited 0; 1,223 offline Luau contracts, 487 module compilations, 202 require-graph nodes and 124 Python tests passed. ChapterContinuation.spec is in both offline runner lists. No Studio, test:roblox or Player run.

PR #203 smoke follow-up (2026-10-31, unmerged): orchestrator's first Studio run passed 1,463 other tests but stopped on Practice because the voxel check iterated `ReadVoxels.Size` (a Vector3). The helper now indexes numeric cells using Size, checks legacy Practice ground models separately from typed mission contacts, and includes a metadata/occupied-cell regression. Each mission reports its own row despite assertion failures; production completion/settlement still supplies unlocks, and genuine launch/settlement failures remain failures rather than fabricated progression. Frozen install, build and prescribed-LUAU_BIN offline validation exited 0 (1,223 Luau contracts, 489 module compilations, 202 require-graph nodes and 124 Python tests). The new smoke regression is compiled but awaits Studio execution. Studio rerun belongs to the orchestrator; no new Studio or Player verification is claimed.

Publish snapshot: latest 20 main runs checked; all 20 succeeded, including M18 run [41187517345](https://github.com/A-Ricemusic/skybreak/actions/runs/41187517345) completed successfully. No failure in that sample. Live is a pipeline convention, not an observed Player result.

| Mission | Title | PR | Merge commit | Studio verified | Player tested |
|---|---|---|---|---|---|
| 1 | OUR OWN PAINT | [#130](https://github.com/A-Ricemusic/skybreak/pull/130) | `4891e8a1` | ✓ 750/750 (#130) | Owner: Normal phone win; Next broken on c1266e30; fix device test pending |
| 2 | NO ANIMALS | [#143](https://github.com/A-Ricemusic/skybreak/pull/143) | `68f2df51` | ✓ reported pass | not yet |
| 3 | NOBODY SIGNED | [#147](https://github.com/A-Ricemusic/skybreak/pull/147) | `7d73c44c` | ✓ 845/845 | not yet |
| 4 | BLIND COURIERS | [#149](https://github.com/A-Ricemusic/skybreak/pull/149) | `af18e335` | ✓ 865/865 | not yet |
| 5 | LIGHTS OFF | [#148](https://github.com/A-Ricemusic/skybreak/pull/148) | `227713be` | ✓ 972/972 | not yet |
| 6 | IRON COAST | [#179](https://github.com/A-Ricemusic/skybreak/pull/179) | `199e7eed` | ✓ 1,133/1,133 | not yet |
| 7 | ARRAY BREAK | [#178](https://github.com/A-Ricemusic/skybreak/pull/178) | `a04fdd61` | ✓ passed; count not recorded here | not yet |
| 8 | OPEN FREQUENCY | [#183](https://github.com/A-Ricemusic/skybreak/pull/183) | `085373c8` | ✓ passed; count not recorded here | not yet |
| 9 | GREEN BEACON | [#185](https://github.com/A-Ricemusic/skybreak/pull/185) | `06ca3e44` | ✓ passed; count not recorded here | not yet |
| 10 | RIVER LINE | [#187](https://github.com/A-Ricemusic/skybreak/pull/187) | `7ff07613` | ✓ passed; count not recorded here | not yet |
| 11 | HIGH CROSSING | [#189](https://github.com/A-Ricemusic/skybreak/pull/189) | `5c88368c` | ✓ passed; count not recorded here | not yet |
| 12 | THE COMMAND RING | [#191](https://github.com/A-Ricemusic/skybreak/pull/191) | `351d7988` | ✓ passed; count not recorded here | not yet |
| 13 | EVIDENCE THROUGH THE GREY | [#195](https://github.com/A-Ricemusic/skybreak/pull/195) | `e2c7fab2` | ✓ passed; count not recorded here | not yet |
| 14 | AURORA SHIELD | [#196](https://github.com/A-Ricemusic/skybreak/pull/196) | `80273894` | ✓ passed; count not recorded here | not yet |
| 15 | SILENT STREETS | [#197](https://github.com/A-Ricemusic/skybreak/pull/197) | `d40b9706` | ✓ passed; count not recorded here | not yet |
| 16 | DUST ROAD | [#198](https://github.com/A-Ricemusic/skybreak/pull/198) | `6e04cc5a` | ✓ passed; count not recorded here | not yet |
| 17 | LAST WING | [#199](https://github.com/A-Ricemusic/skybreak/pull/199) | `f68d81d5` | ✓ passed; count not recorded here | not yet |
| 18 | CLEAR FREQUENCY | [#200](https://github.com/A-Ricemusic/skybreak/pull/200) | `4594c365` | ✓ 1,450/1,450 | not yet |

Practice: merged in [#130](https://github.com/A-Ricemusic/skybreak/pull/130), `4891e8a1`; Studio verified: ✓; Player tested: not yet.

[Level cards](levels.html) · [Shipped history](shipped.md) · [Playthrough checklist](next.md) · [Blockers](blockers.md) · [Decision records](decisions.md)

PR #217: rebuilt on merged #216/main; independent 10/10 review records for all 13 embedded meshes are included. Production authorization requires their merge; offline CI uses inventory plus regressions.

PR #217 final validation: frozen install, standalone build, and prescribed LUAU_BIN validate:offline all exited 0; 1,225 Luau contracts and 162 Python tests passed. GitGuardian and guard passed after history cleanup; CI validate pending at recording. No publish/upload or Player test.
