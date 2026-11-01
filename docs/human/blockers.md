# Blockers

Updated 2026-11-01 against main `36e949d0`.

## Open

| Blocker | Impact / evidence | Needed action |
|---|---|---|
| Studio signed out after auto-update 0.745.563 → 0.745.0.7451137 | Blocks Studio Jest for merged #220 and open #205/#203/#210/#221/#227. #220 merged without the usual Studio run as an explicit exception, not a pass. | Owner signs in once; then coordinated Studio runs. |
| Campaign loading acceptance | #205 measured freezes up to 74 s, mostly previous-world cleanup. Cooperative cleanup and 0.15 s terrain slices are proposed, not accepted or shipped. | Studio acceptance on #205, then campaign smoke #203. |
| Naval upload key unavailable | #226/#228 exports, manifests, decisions and independent strict 10/10 approvals are on main; no naval upload or in-game activation. #221 integration remains open/dormant. | Owner supplies Open Cloud key through the secure prompt; upload only exact approved exports/dependencies. |
| Player/phone acceptance | No Player/phone verification of missions 6–18; military appearance, M3 hotfix, #202 Next/chapter flow, load time, difficulty and device performance remain unverified. Owner's earlier M01 Normal phone win is historical evidence only. | Follow next.md; record observed outcomes and device. |

## Resolved / standing restrictions

- **M3 world-build failure:** #220 merged as `9793b6d8`, fixing the budget failure introduced after military activation #218. Base limits remain; decoration is separately bounded to 24 instances per placement. Studio regression run and Player observation remain open above.
- **Military models dormant:** #207 (`5eec0d06`) was superseded by activation #218 (`a06d05f9`): all ten models have independent 10/10 approvals and owner-reported moderation APPROVED. They are live under the pipeline convention; observed quality is unverified.
- **Results Next failure:** #202 (`cb8e1d10`) merged the continuation/chapter-gating fix; device acceptance is pending, not a reported pass.
- **Upload/publish evidence gates:** #216 (`d33c9a94`) and #217 (`c07fcfa9`) are merged. Exact-byte independent approvals and main evidence remain required for models and embedded assets. Approval is not a moderation guarantee.
- **Audio/voice uploads:** permanently blocked by owner instruction, independent of model eligibility. This is a standing restriction, not a blocker to work around.

Live means merged gameplay under the owner's automatic pipeline convention. This reconciliation did not run Studio or Player, upload assets, or establish new deployment observations.
