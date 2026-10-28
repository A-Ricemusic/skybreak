# Blockers

Last updated: 2026-10-28. Entries below were raised in the owner's Phase 0 assignment; no independent GitHub-settings or disk audit is claimed here.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-28 | Owner / Phase 0 brief | Enforced validation before merges: main has no branch protection. | A PR can merge without a passing `validate` check; manual discipline is currently required. | Owner sets branch protection in GitHub settings to require `validate` on main. This does not block opening the Phase 0 PR. |
| 2026-10-28 | Owner / Phase 0 brief | Full-resolution campaign footage storage: build Mac has about 14 GB free. | The full 1080p recording cannot be retained locally; proxy detail is insufficient for fine visual claims. | Use a 480p proxy plus per-mission 1080p clips, keep media in ignored `reference/ac04/`, and manage clip retention within available space (D-010). |

## Resolved

| Date | Raised by | What was blocked | Impact | Resolution |
|---|---|---|---|---|
| 2026-10-28 | Phase 0 implementation agent | First local offline validation attempt: fresh worktree had no `build/offline-luau/luau`. | Build succeeded but compiled-domain checks could not start. | Reused the existing main-checkout CLI via `LUAU_BIN=/Users/pelicannurse/Projects/test app/build/offline-luau/luau`; no system installation or source change. |

Mitigations for the open entries do not mean those underlying constraints have been resolved.
