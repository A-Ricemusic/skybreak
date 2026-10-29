# Blockers

Last updated: 2026-10-29.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-29 | Mission 2 world implementation; updated by the mission 2 agent | Mission 2 phone performance is unmeasured. Studio (desktop) measured the world build at 16.0–16.1 s in Play (terrain 15.4–15.6 s), with one 0.32 s terrain write stall, against an offline estimate of 10.5 s. | The loading screen holds about 16 s on desktop; a phone may be slower. | Your Player playtest on a phone is the real check; tell the orchestrator if loading feels too long. |
| 2026-10-29 | Mission 2 agent | Mission 1's runway may have the same hidden-pavement problem found on mission 2 (a 4-stud slab on terrain, D-056). Not checked; mission 1 was left unchanged. | If so, mission 1's runway is hard to see. | Orchestrator: check mission 1's runway in Studio and fix in a separate PR if needed. |
| 2026-10-29 | Mission 2 implementation | Mission 2's rank cuts, failure rules and air roster are assumptions, not footage readings (spec A1–A3: D-049, D-050, D-052). | Ranks, fail conditions and pressure may feel off until you play it. | **You:** after mission 2 merges, tell the orchestrator whether the ranks, the 15:00 limit and the enemy pressure feel right. |
| 2026-10-29 | Orchestrator | Owner acceptance of mission 1 (the beta test). | Mission 2 waits for your feedback (D-004). | **You:** play the practice flight and mission 1 in Roblox Player and report what you notice. |
| 2026-10-28 | Large-world measurement | Real-phone performance and streaming for full-scale worlds are unverified. Studio measured mission 1's world at 4 to 5.5 s server build and 60 FPS in the phone emulator (#114), but the emulator runs on desktop hardware. | Mission 1's world may need tuning after it goes live. | Re-measure the tuned world in Studio before the campaign switch; your Player playtest on a phone is the real check. |
| 2026-10-28 | Orchestrator | Enforced checks before merge: main has no branch protection. | A PR can merge before its `validate` check passes, and every merge goes live. The orchestrator gates merges by hand for now. | **You:** in GitHub, Settings → Branches, require the `validate` check on `main`. |

## Resolved

| Date | Raised by | What was blocked | Resolution |
|---|---|---|---|
| 2026-10-28 | Orchestrator | Uploading the approved bomber and carrier (the first key request timed out). | You provided the key through the secure card; both models uploaded and passed moderation (assets 112476761254185 and 118082412288291), then were wired in and checked in Studio (#124). |
| 2026-10-28 | Independent reviewer | Bomber and carrier safety review: review 1 rejected both; review 2 stopped at a brief error. | Revision 2 approved at 10/10 in review 3 (D-032). |
| 2026-10-28 | Orchestrator | Whether full-scale worlds (D-019) could load in reasonable time. | Measured (#109): feasible with level of detail (D-028). Full detail everywhere is not. |
| 2026-10-28 | Orchestrator | Disk space was down to about 10 GB free. | Owner approved removing this project's old checkouts only. An agent removed 129 that were clean and whose work was pushed or merged; free space is now about 22 GB. 47 were kept by the safety rules (recent, uncommitted, or commits not proven elsewhere). |
| 2026-10-28 | Footage analyst | Whether 1080p sections of the video could be downloaded was unconfirmed. | Confirmed: mission 1 was downloaded at 1440×1080, 59.94 fps. |
| 2026-10-28 | Orchestrator | The first footage agent ended its turn while the download was still running, with no ledger. | The download had completed. A second agent resumed from there and finished the ledger; the first was cancelled so only one agent owned the footage folder. |
| 2026-10-28 | Several agents | Fresh worktrees have no offline Luau runner, so the offline validator fails at first. | Point `LUAU_BIN` at the main checkout's copy (`build/offline-luau/luau`). This recurs in every new worktree; agent briefs now mention it. |

## PR #137 elite safety gate

Review 2 rejected `vanta-v2-elite-2` at 8/10 for a rear goggles/mask composition. Revision 3 changes the geometry and awaits a fresh independent 10/10 approval of the exact export and textures. Not uploaded. Four other assets are unchanged and retain their recorded approval.
