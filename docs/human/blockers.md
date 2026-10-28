# Blockers

Last updated: 2026-10-28.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-28 | Orchestrator | Enforced checks before merge: main has no branch protection. | A PR can merge before its `validate` check passes, and every merge goes live. The orchestrator gates merges by hand for now. | **You:** in GitHub, Settings → Branches, require the `validate` check on `main`. |
| 2026-10-28 | Orchestrator | Full-scale worlds (D-019): mission 1's time-matched world is about 15,000 to 35,000 studs across, against today's ±3,600-stud airspace. The engine check found terrain writing already near its time budget, streaming off, and phone limits unmeasured. | If full scale can't load in reasonable time or runs badly on phones, mission 1's world has to change. | The large-world measurement reports feasibility; the orchestrator brings any change of design to the owner. |

## Resolved

| Date | Raised by | What was blocked | Resolution |
|---|---|---|---|
| 2026-10-28 | Orchestrator | Disk space was down to about 10 GB free. | Owner approved removing this project's old checkouts only. An agent removed 129 that were clean and whose work was pushed or merged; free space is now about 22 GB. 47 were kept by the safety rules (recent, uncommitted, or commits not proven elsewhere). |
| 2026-10-28 | Footage analyst | Whether 1080p sections of the video could be downloaded was unconfirmed. | Confirmed: mission 1 was downloaded at 1440×1080, 59.94 fps. |
| 2026-10-28 | Orchestrator | The first footage agent ended its turn while the download was still running, with no ledger. | The download had completed. A second agent resumed from there and finished the ledger; the first was cancelled so only one agent owned the footage folder. |
| 2026-10-28 | Several agents | Fresh worktrees have no offline Luau runner, so the offline validator fails at first. | Point `LUAU_BIN` at the main checkout's copy (`build/offline-luau/luau`). This recurs in every new worktree; agent briefs now mention it. |
