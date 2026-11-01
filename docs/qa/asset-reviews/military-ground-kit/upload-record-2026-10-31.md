# Military ground kit upload record — 2026-10-31

Owner handoff reports all ten uploads complete and Roblox moderation **APPROVED** on 2026-10-31. No upload, secret access, Studio launch or Player verification was performed by this activation task. Independent reviewer: GPT-6.1 Sol, 2026-10-31, explicit 10/10 approval; exact exports, hashes, dependencies, assembled previews and consulted policies remain recorded in [the independent review](independent-safety-review-2026-10-31.md). No export or texture was changed here.

| Asset | Roblox Model ID | Moderation |
|---|---:|---|
| military-tank | 133660866420591 | APPROVED |
| military-sam | 73161839960138 | APPROVED |
| military-aa | 101616884598832 | APPROVED |
| military-artillery | 95847143971617 | APPROVED |
| military-bunker | 99767408434768 | APPROVED |
| military-radar | 124278667774667 | APPROVED |
| military-truck | 137019773488099 | APPROVED |
| military-fuel | 96014055896534 | APPROVED |
| military-barracks | 132667525903898 | APPROVED |
| military-containers | 135400126796799 | APPROVED |

Runtime IDs are in `src/shared/RobloxAssetIds.ts`. Existing affected-world `WorldAssets.Preload(MILITARY_GROUND_ASSETS)` calls load all ten in parallel within the existing 30-second deadline before target construction. Placement reads cache without yielding; unavailable models retain procedural stand-ins. No replacement is scheduled after construction. Existing proxy footprints, query behavior, pre-decoration aim and D6 far Part LOD remain intact.

Mission coverage from `mission-inventory.json`: AA M02/M03/M05/M06/M07/M09/M10/M12/M16/M17; SAM M05/M06/M07/M09/M10/M12/M17; artillery M09/M16; barracks M10; bunkers M07/M09/M16; containers M06/M10; fuel M05/M06/M10; radar M03/M07/M09; tanks M09/M16/M17; trucks M09/M15/M16. Practice, M01/M04/M08/M11/M13/M14/M18 have no matching typed contacts. This PR proposes activation; it is not merged/live yet. Player orientation, assembled appearance, detail transitions and phone performance still need observation.
