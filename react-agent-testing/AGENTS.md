# React agent testing example

Use Bun. `bun run test:agent` starts the app and uses the signed-in Codex CLI to execute checklists/todos.json through a browser MCP tool server. No API key is required. `bun run test:agent:broken` deliberately injects a checkbox fault and should exit nonzero.

This folder is independent of the Roblox project at the repository root. Do not change files outside this folder. Tests are plain-language procedures, not prewritten Playwright action scripts. Generic browser tools belong in tools/browser-mcp.ts. Do not weaken checks or edit the app during a testing run.
