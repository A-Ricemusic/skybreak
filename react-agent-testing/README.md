# React + Codex acceptance testing

A working example of turning manual test procedures into an agent-run browser test. The app is a small React todo list. Bun starts the app and invokes your locally installed Codex CLI, signed in with ChatGPT. No OpenAI API key or Midscene account is used.

This example lives in its own folder and does not change the Roblox code at the repository root.

## Run the app

```sh
cd "$HOME/Projects/test app/react-agent-testing"
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Vite.

## Run agentic tests

Prerequisites: Bun, Codex CLI, and `codex login status` showing `Logged in using ChatGPT`.

```sh
bunx playwright install chromium
bun run test:agent
```

The runner starts a dedicated local app server, asks Codex to execute all three checklist cases, writes evidence to `artifacts/<timestamp>-healthy/`, and exits nonzero on failed or incomplete execution. Each run consumes your normal Codex subscription usage allowance. It does not guarantee an unlimited or zero-cost allowance. The runner refuses API-key login and removes API-key environment overrides from the child process.

To demonstrate a real failure:

```sh
bun run test:agent:broken
```

This runs the exact same checklist against an app with an intentionally unresponsive checkbox. Expect a nonzero exit code. The ordinary app is unchanged; the defect is enabled only through a query parameter on that run's URL.

`CODEX_TEST_MODEL` optionally selects a different Codex model available to your subscription. The default is `gpt-6.1-sol`.

## Write tests as a manual checklist

Edit `checklists/todos.json`. For example:

```json
{
  "id": "complete-and-filter",
  "name": "Complete a todo and filter the list",
  "steps": [
    "Add a todo called Book dentist.",
    "Check the checkbox next to Book dentist.",
    "Verify that its checkbox is checked and the remaining count is zero.",
    "Switch Show tasks to Active and verify that no tasks are listed.",
    "Switch Show tasks to Completed and verify that Book dentist is shown."
  ]
}
```

You do not write locators, click scripts, or Playwright tests. Codex reads the live accessible UI, chooses targets, performs actions, and translates expectations into browser assertions at runtime. The tool adapter contains generic browser operations, not implementations of these checklist scenarios.

## How it works

1. `tools/run-agent.ts` checks subscription login, starts Vite, and runs `codex exec` with a structured final-output schema.
2. Codex runs from a temporary directory with shell tools disabled and read-only filesystem permissions. Only this example's browser MCP server is configured for the invocation; your global Codex configuration is unchanged.
3. `tools/browser-mcp.ts` exposes `begin_case`, `observe`, `act`, and `verify`. Each case gets a new isolated Chromium context. All browser navigation stays on the local demo; there is no arbitrary evaluation or navigation tool.
4. The agent chooses accessible roles and names from the observed interface. The adapter records actual checkbox state, text, visibility, and counts, along with screenshots and UI snapshots.
5. The runner combines the agent's explanation with recorded evidence. A failed operation or assertion permanently fails its case. Missing checks/results block a case. The agent cannot turn a recorded failure into a pass by changing its final answer.

## Review the evidence

Each run directory contains:

- `report.html`: readable case results with expandable assertions and screenshots.
- `report.json`: final results and browser evidence.
- `browser-events.jsonl`: browser calls, snapshots, assertion outcomes, and timestamps.
- `codex-events.jsonl`: actual Codex tool calls and model events.
- `agent-summary.json`: the agent's structured explanation.
- `prompt.txt` and `checklist.json`: exact inputs to reproduce the attempt.

`artifacts/latest.json` points to the last report. Artifacts are ignored by Git. Open `report.html` locally to review a run.

## Limits

This is a small, local demonstration, not a claim of exhaustive autonomous QA. The model still decides which checks implement a natural-language expectation; a poorly chosen check can miss a bug. Inspect the evidence and use measured code assertions for critical invariants. The deliberate broken run is a useful sanity check that failure detection actually works.

Each run has a five-minute agent timeout and an 80-action browser budget. The browser adapter is intended for this local example, not arbitrary websites or real drone hardware.

## Reference

- Codex subscription authentication: https://learn.chatgpt.com/docs/auth
- Non-interactive Codex and structured output: https://learn.chatgpt.com/docs/non-interactive-mode
- MCP tool configuration: https://learn.chatgpt.com/docs/extend/mcp

## Verified on this computer

Both runs below used the installed Codex CLI 0.164.0, model `gpt-6.1-sol`, and the existing ChatGPT login. Browser actions were chosen by Codex at runtime.

- Healthy app: all 3 cases passed; 11 browser assertions passed; runner exit code 0.
- Deliberately broken checkbox: 2 cases passed, completion/filter case failed; 4 assertions failed and the checkbox action reported that its state did not change; runner exit code 1. Codex itself completed normally and correctly described the failure.
- `bun run build`: TypeScript check and Vite production build passed.

Review [healthy-run report](artifacts/2026-10-25T02-47-44-221Z-healthy/report.html) and [broken-run report](artifacts/2026-10-25T02-48-13-972Z-broken/report.html). These artifacts are local to this checkout and are not committed.
