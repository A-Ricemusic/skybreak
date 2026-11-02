# Blockers

2026-11-01 #205 follow-up: reconciled main `fe1af743` (#210, #239, #231, #233, #235); preserved #236 floorless/procedural M3 and #239 bounded fixtures. #205 remains unmerged and failed its prior Studio run at `483ed930`. This revision restores the previous 262,144-cell shared build chunk limit, coalesces adjacent cleanup chunks, paces dressing by elapsed work, and bounds/cancels integration workers. Pure-plan audits yield between large assertion batches and compare whole plans with cooperative field traversal. No Studio/Player run in this implementation session; orchestrator retains Studio. Current acceptance: rerun #205 Jest plus the isolated all-mission performance harness, then compare build/cleanup wall times against pre-#205 before merging.

Follow-up validation: `bun install --frozen-lockfile` and prescribed-`LUAU_BIN` `bun run validate:offline` exited 0; 1,258 Luau contracts, 36 planner fingerprint/performance cases, 511 compiled modules and 179 Python tests passed. Engine regressions compiled only; Studio acceptance pending.

2026-11-01 Jest follow-up: #238 at `5e40a109` still took 835 s in WorldInstanceBudget, timed out M16 (120 s) and the second M03 test (20 s), then stalled in WorldLifecycleRuntime. **Merged #239 (`b2bb920a`) contains/supersedes #238.** Budget tests no longer generate full worlds/terrain plans; small synchronous fixtures cover kit accounting, all 138 M16 targets and shared M03 target assembly, with cancellation/cleanup and a 90 s whole-file target. Full plan budgets remain in existing offline/Studio plan specs. Installed Jest closes timed-out executors; surviving detached work and the exact runtime stall are unconfirmed. Orchestrator retains #239 regressions in the next coordinated run; this session ran no Studio/Player tests or uploads. Mission/live status is unchanged. See [investigation](../qa/jest-lifecycle-hang-investigation.md).

## Urgent open: M3 mobile crash — mitigated, awaiting owner phone retest

M3 crash mitigation #236 merged as `364a7413`, live as Roblox version 148, published 2026-11-01. It removes the inaccessible bottom floor, temporarily uses procedural targets with no military meshes/PBR maps, and logs construction errors before recovery. The owner-reported mobile app crash remains open: cause unconfirmed, awaiting owner phone retest. Not Studio/Player tested. Restore M3 military visuals only once the crash cause is confirmed. See [investigation](../qa/m03-crash-second-hotfix.md).

Updated 2026-11-01 against main `fe1af743`.

## Open

| Blocker | Impact / evidence | Needed action |
|---|---|---|
| Military kit reports failed loads in Studio Jest (2026-11-01) | Main `3ed084dd` log has 136 military warnings and WorldInstanceBudget fails. Code investigation finds that spec injects two overlapping `Size=(8,8,8)` MeshParts under the real IDs: these warnings reject synthetic cubes, not proof of live InsertService failure. Live uses the same normalisation guard but the real loader; live impact remains unconfirmed, not established loss of #218 visuals. M03 remains procedural by #236. | Unmerged `fix/military-kit-load` corrects fixture proportions, shares cached templates and omits frame waits from assembly coverage. Orchestrator reruns Studio; optionally set `Workspace.MilitaryKitDiagnostic=true` in the isolated Jest place for one real-ID hierarchy/preload probe (8s deadline). No Studio/Player run in this branch. [Code investigation and diagnostic outcomes](../qa/military-kit-load-investigation.md). |
| M3 mobile crash (open, mitigated) | #236 merged/live version 148, published 2026-11-01; temporary procedural targets. Root cause unconfirmed; not Studio/Player tested. | Owner retests M3 on phone; confirm cause before restoring military visuals. |
| Studio acceptance queue | #203 #205 #221 #227 remain open; #210/#231/#233/#235 are merged. #231 fixes missing touch GUN/ammo HUD and trigger release; #233 separates ground kills from air-kill requirements; #235 fixes underground M7 helicopters. | Run coordinated Studio acceptance after military fixture correction; see next.md. |
| Follow-ups after #205 lands | M9 landing craft buried in terrain (`M09WorldPlan.ts`); standard missiles skip scenery occlusion outside enclosed phases (`CombatService.ts:1121`); offline relay child processes lack timeouts (`tools/test-relay-offline.ts`); `tools/tests/test_place_assets.py` needs a prebuilt place. | Address after #205 lands; restore M3 military visuals only after crash cause confirmation. |
| Campaign loading acceptance | #205 measured freezes up to 74 s, mostly previous-world cleanup. Cooperative cleanup and 0.15 s terrain slices are proposed, not accepted or shipped. | Coordinated Studio queue in next.md, including #203 smoke and #205 acceptance. |
| Naval upload key unavailable | #226/#228 exports, manifests, decisions and independent strict 10/10 approvals are on main; no naval upload or in-game activation. #221 integration remains open/dormant. | Owner supplies Open Cloud key through the secure prompt; upload only exact approved exports/dependencies. |
| Player/phone acceptance | No Player/phone verification of missions 6–18; military appearance, M3 hotfix, #202 Next/chapter flow, load time, difficulty and device performance remain unverified. Owner's earlier M01 Normal phone win is historical evidence only. | Follow next.md; record observed outcomes and device. |

## Resolved / standing restrictions

- **Studio sign-in:** owner-supplied 2026-11-01 run on 0.745.0.7451137 confirms owner signed in; current fixture failures are tracked above. This agent did not run Studio.

- **M3 world-build failure:** #220 merged as `9793b6d8`, fixing the budget failure introduced after military activation #218. Base limits remain; decoration is separately bounded to 24 instances per placement. Studio regression run and Player observation remain open above.
- **Military models dormant:** #207 (`5eec0d06`) was superseded by activation #218 (`a06d05f9`): all ten models have independent 10/10 approvals and owner-reported moderation APPROVED. They are live under the pipeline convention; observed quality is unverified.
- **Results Next failure:** #202 (`cb8e1d10`) merged the continuation/chapter-gating fix; device acceptance is pending, not a reported pass.
- **Upload/publish evidence gates:** #216 (`d33c9a94`) and #217 (`c07fcfa9`) are merged. Exact-byte independent approvals and main evidence remain required for models and embedded assets. Approval is not a moderation guarantee.
- **Audio/voice uploads:** permanently blocked by owner instruction, independent of model eligibility. This is a standing restriction, not a blocker to work around.

Live means merged gameplay under the owner's automatic pipeline convention. This reconciliation did not run Studio or Player, upload assets, or establish new deployment observations.

Pending #205 reconciliation with main: preserves #236 M3 floor removal and procedural-only targets, #220 instance budgets/kit fallback, and #232 radio text. Cooperative cleanup and 0.15 s terrain slices still await orchestrator Studio acceptance; no new Player verification.
