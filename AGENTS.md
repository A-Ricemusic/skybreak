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

# AC04-only campaign and fresh saves

- Ace Combat 04 is the sole campaign. Remove and do not preserve or reintroduce Broken Relay missions, story, campaign selection, or save compatibility.
- Start every user fresh in `SkybreakAC04Fresh_20261027_v1`; do not migrate old campaign or prototype AC04 progress. Generic flight, HUD and audio utilities may remain when needed by AC04.
- The owner authorized wiping old stores `SkybreakCampaign_v1` and `SkybreakAC04Campaign_v1` (standard scope, `player_${UserId}` keys). Physical cloud cleanup must be coordinated with release cutover so old published servers cannot recreate deleted records; it remains pending until performed with the required private Open Cloud credential. Do not describe a new save epoch as proof that old cloud records were deleted.

# Living documentation for human review

- The four human review documents must live ONLY at `docs/human/taste.html`, `docs/human/plan.html`, `docs/human/status.html`, and `docs/human/playtest.html`. Do not keep duplicate copies elsewhere. `docs/human/` must contain ONLY these four files; keep supporting assets and other documentation outside it.
- Keep all four visually polished and easy to review: readable typography, clear headings, consistent color, useful tables and honest progress indicators.
- `taste.html` records every subjective decision, including visual/world choices, gameplay feel and difficulty, and story adaptation. Use stable decision IDs and current statuses; record what was chosen, alternatives considered, and why, retaining the rationale when a decision changes.
- `plan.html` describes the next proposed changes: what each item is, why it belongs in the game, and its connection to the Ace Combat 04 reference material. Keep it forward-looking; move completed work and its evidence to `status.html` and replace it with the next proposed work.
- `status.html` records what is actually completed, beta readiness, an honest assessment of the game, decisions currently being made in priority order, and reviewer feedback. Track responses, fixes, remaining issues, and retest evidence against the reviewed revision.
- `playtest.html` is the owner’s living guide to Roblox Player, not a local Studio candidate guide. Per the owner’s release convention, treat gameplay PRs merged to main as live in Roblox Player through automatic CI/CD. Update mission availability and included PRs when they merge; do not wait for an upload-receipt check or a Player test. The owner performs Player verification and reports issues. Lead with the official game link, latest merged gameplay revision and included PRs; show the last known place version/receipt as supporting metadata when available, without inventing newer values. Distinguish merged/live-by-pipeline status from observed gameplay quality and local unmerged work.
- Lay out all 18 AC04 missions in order with visible published availability and separate construction reports: mission logic/phases built, world/landmark completeness, story/cutscene placement and presentation, actual review evidence, remaining iterations and readiness for owner testing in Player. Keep unreleased local construction labeled as such; do not invent completion percentages or equate authored logic with a finished mission. Put overall gameplay/mechanics/controls and start-menu/UI status after the mission reports, distinguishing the published version from pending work.
- Game changes merged to main use the automatic validation/build/publication pipeline. Report merged gameplay changes as live under the owner’s convention; no additional deployment verification or Roblox Player playtest is required to update the documents. Documentation-only changes are excluded by the current workflow and do not imply new game content. If a deployment failure is actually known, record it honestly rather than claiming a verified upload. Existing exact-asset upload review rules still apply.
- The parent orchestrator personally owns corrections and publication-state verification for the playtest guide, as requested by the owner; it may directly edit these documents despite the general implementation delegation rule.
- Update `playtest.html` alongside every affected one of the other three documents whenever playable behavior, readiness, world, story, mechanics, UI, PR merge state, or candidate evidence changes.
- Continuously update every affected document whenever decisions, proposals, implementation, evidence, or feedback change, and reconcile all four before each handback. They must reflect current reality, not stale snapshots. Distinguish proposed, implemented, verified, and unknown states; never invent reviews, test results, or completion claims.
- Every agent assignment and handoff must explicitly account for ALL FOUR human documents. Read their current state before work; identify how the task changes each document. If the agent owns documentation writes, update the affected files before handoff and report which were checked. If the parent owns them to avoid concurrent edits, supply exact per-document update payloads (or an explicit no-change reason) and flag any contradiction immediately. The parent must merge those payloads and reconcile all four before reporting the handoff as current; a payload alone does not keep the documents up to date.
- Maintain one current description of each feature or mission. Replace obsolete current-state prose instead of appending contradictory updates. Retain old evidence only as clearly dated, revision-scoped history. Use merged gameplay PRs to update Player availability; do not require a deployment-receipt audit. Keep the merged-PR list current and label a previously observed place version as last known until new metadata is available. Record the audit time and actual verification limits.

# AC04 presentation fidelity

- The start menu and ALL presented material must look and feel like Ace Combat 04. This is a binding fidelity direction for menus, layout, typography, color, transitions, briefing, radar, HUD, results and story presentation, not generic flight UI polish. Distinguish current observed implementation from pending reference-based iteration; substantiate specific reference claims and do not promise original recordings or assets.

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
