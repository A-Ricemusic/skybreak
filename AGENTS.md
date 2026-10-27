# SKYBREAK project reference

- Official Roblox play link, supplied by the project owner: https://www.roblox.com/games/112911685457826
- Roblox place ID: `112911685457826`.
- When the user asks how to play or for the game link, provide this direct Roblox link.

# Agent workflow

- Try to involve the human as little as possible; work autonomously within the authorized scope.
- Always try to unblock blockers while preserving existing work and respecting authorization boundaries. Ask the user only when required information or authorization cannot otherwise be obtained.
- Always spin up a subagent to investigate blockers, within the authorized scope and subject to higher-priority instructions.
- The parent orchestrator coordinates and delegates implementation; it does not implement changes itself.

# Testing

- Do not add React agent testing (the former `react-agent-testing/` React+Codex/Playwright browser test harness) or any web React/DOM test harness back to this repo; Roblox tests use @rbxts/jest via `bun run test:roblox`. `bun run validate:offline` enforces this via `tools/check-no-react-agent-testing.ts`.
