# Blockers

Last updated: 2026-10-28.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-28 | Orchestrator | Enforced checks before merge: main has no branch protection. | A PR can merge before its `validate` check passes, and every merge goes live. The orchestrator gates merges by hand for now. | **You:** in GitHub, Settings → Branches, require the `validate` check on `main`. |
| 2026-10-28 | Orchestrator | Disk space: the build Mac has about 11 GB free. | Per-mission 1080p clips and world builds will run it lower. About 21 GB is old T3 Code thread checkouts. | Owner approved removing this project's old checkouts only (2026-10-28). An agent is removing those that are clean and whose branches are pushed or merged. If more space is needed after that, the orchestrator asks the owner. |
| 2026-10-28 | Footage analyst | Unconfirmed: whether 1080p sections of the video can be downloaded. | If not, specs fall back to 480p, which can't read speed and altitude digits or radar contents. | The mission 1 spec agent checks this first and reports. |

## Resolved

| Date | Raised by | What was blocked | Resolution |
|---|---|---|---|
| 2026-10-28 | Orchestrator | The first footage agent ended its turn while the download was still running, with no ledger. | The download had completed. A second agent resumed from there and finished the ledger; the first was cancelled so only one agent owned the footage folder. |
| 2026-10-28 | Several agents | Fresh worktrees have no offline Luau runner, so the offline validator fails at first. | Point `LUAU_BIN` at the main checkout's copy (`build/offline-luau/luau`). This recurs in every new worktree; agent briefs now mention it. |
