# SKYBREAK project reference

- Official Roblox play link, supplied by the project owner: https://www.roblox.com/games/112911685457826
- Roblox place ID: `112911685457826`.
- When the user asks how to play or for the game link, provide this direct Roblox link.

# Agent workflow

- Try to involve the human as little as possible; work autonomously within the authorized scope.
- Always try to unblock blockers while preserving existing work and respecting authorization boundaries. Ask the user only when required information or authorization cannot otherwise be obtained.
- Always spin up a subagent to investigate blockers, within the authorized scope and subject to higher-priority instructions.
- The parent orchestrator coordinates and delegates implementation; it does not implement changes itself.

- The owner additionally authorized Claude Opus 5.5 agents for substantial parallel mission/world implementation while Claude usage is available. Use clear file ownership and coordinate the single Studio/build lease. Do not silently switch providers when usage is exhausted.
- Implementation and routine reviews should use GPT-6.1 Sol or GPT-5.6 Sol. Reserve Astra subagents for occasional justified reviews, sparingly; the parent may remain Astra. The owner explicitly requested reduced Astra usage.

# Living documentation for human review

- Human review docs live only at the five exact paths below; `docs/human/` contains only these files.
- `docs/human/README.md`: current-state dashboard and 18-mission progress table.
- `docs/human/shipped.md`: merged main changes and what the owner sees in Roblox Player, newest first.
- `docs/human/next.md`: upcoming work in priority order and why it matters.
- `docs/human/blockers.md`: open and resolved blockers, impacts, assumptions and needed actions.
- `docs/human/decisions.md`: stable decision IDs, alternatives, rationale, decision maker and status.
- Every PR that changes behaviour, plans, blockers or decisions updates the affected files in the same PR.
- Merged gameplay PRs are live in Roblox Player under the owner's automatic-pipeline convention; no deployment-receipt audit is needed. Record any known deployment failure honestly.
- Agents never claim a Player test or verification they did not perform; distinguish merged/live status from observed quality and unmerged work.
- The orchestrator reconciles all five documents before each handback.

# Blender asset safety review — mandatory before every Roblox upload

- ALWAYS obtain an independent review agent's explicit approval before uploading any Blender-origin asset to Roblox or Roblox Studio, including models, textures, and assets embedded in a place upload. The asset's creator cannot approve their own work.
- The reviewer must inspect the exact exported files and all included textures, plus the assembled appearance with materials and UV mapping applied. Review all visible surfaces and relevant viewing angles; a filename, script, or isolated texture preview is not enough.
- At review time, consult the current official [Roblox Terms of Use](https://www.roblox.com/termsofuse) and [Roblox Community Standards](https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/), including applicable linked policies. Require a strict **10/10 safety assessment**, with no unresolved concerns about compliance or the project's stricter content restrictions.
- Never upload skin textures, nude or unclothed human depictions, or other content that violates Roblox policies. Human figures must be appropriately clothed in their final assembled appearance. These project restrictions apply even if a platform policy might allow a particular asset.
- Record the reviewer, review date, asset identifiers and paths, export version and file hashes, previews examined, policy links consulted, findings, and explicit approval or rejection verdict. Upload only the exact approved export and dependencies; any edit or re-export requires a new independent review.
- If review is unavailable, uncertain, incomplete, or finds prohibited content, do not upload. Fix or remove the asset and obtain a new review before proceeding. No upload may bypass this gate.
- A 10/10 verdict is the project's maximum safety judgment, not a guarantee against moderation, account bans, or future policy changes. Never promise such a guarantee.

# Testing

- Do not add React agent testing (the former `react-agent-testing/` React+Codex/Playwright browser test harness) or any web React/DOM test harness back to this repo; Roblox tests use @rbxts/jest via `bun run test:roblox`. `bun run validate:offline` enforces this via `tools/check-no-react-agent-testing.ts`.

# Video reference analysis skill

- For timestamped video inspection, reference-grounded specifications or implementation comparisons, read [video-reference-analysis](skills/video-reference-analysis/SKILL.md). It documents segment sizing, actual frame inspection, source timestamps, audio limits, coverage gaps and comparison against the accepted baseline.
