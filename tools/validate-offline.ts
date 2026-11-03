// Shared PR/publish gate. Never invokes test:roblox (which launches Studio).
// Compile once, then run the existing compiled contracts and generated-doc checks.
import { resolve } from "node:path";
import { positiveEnv, spawnWithTimeout } from "./spawn";

const root = resolve(import.meta.dir, "..");
// Every gate step is killed and reported after this deadline instead of stalling
// the job until the workflow timeout. VALIDATE_STEP_TIMEOUT_MS overrides it.
const STEP_TIMEOUT_MS = positiveEnv("VALIDATE_STEP_TIMEOUT_MS") ?? 900_000;

// Offline contract floors. Keep them just under the counts printed by
// `bun tools/test-relay-offline.ts` (OFFLINE_SPECS registered=N and
// OFFLINE_LUAU_RESULT passed=N) so a silently dropped spec fails the gate.
// Raise both whenever specs are added; lowering either needs a reviewed reason.
const OFFLINE_SPEC_FLOOR = 130;
const OFFLINE_PASS_FLOOR = 1318;

interface Summary {
	pattern: RegExp;
	minimum: number;
}
interface StepOptions {
	/** Extra environment for this step only (merged over the current process env). */
	env?: Record<string, string>;
	/** Additional summary lines that must each match exactly once and reach their minimum. */
	summaries?: Summary[];
}

async function run(command: string[], summary?: RegExp, minimum = 0, options: StepOptions = {}) {
	console.log(`> ${command.join(" ")}`);
	const { stdout, code } = await spawnWithTimeout(command, {
		cwd: root,
		env: options.env ? { ...process.env, ...options.env } : undefined,
		stdout: "pipe",
		stderr: "inherit",
		timeoutMs: STEP_TIMEOUT_MS,
	});
	console.log(stdout);
	if (code !== 0) throw new Error(`${command.join(" ")} exited ${code}`);
	const summaries = [...(summary ? [{ pattern: summary, minimum }] : []), ...(options.summaries ?? [])];
	for (const check of summaries) {
		const matches = [...stdout.matchAll(check.pattern)];
		if (matches.length !== 1 || Number(matches[0][1]) < check.minimum) {
			throw new Error(
				`Missing, failed or incomplete test summary (${check.pattern.source}, minimum ${check.minimum}): ${command.join(" ")}`,
			);
		}
	}
}

await run(["bun", "tools/check-no-react-agent-testing.ts"], /^NO_REACT_AGENT_TESTING passed tracked=(\d+)$/gm, 1);
await run(["bun", "run", "format:check"]);
await run(["bun", "run", "lint"]);
await run(["bun", "run", "build:place"]);
// Inventory is structural validation only; publish always runs strict authorization.
await run(["python3", "-I", "tools/check-place-assets.py", "build/skybreak.rbxlx", "--inventory"]);
await run(["bun", "tools/check-luau-modules.ts"], /^LUAU_MODULE_COMPILE passed=(\d+) failed=0$/gm, 1);
await run(["bun", "tools/test-voice-disclosure-ui.ts"]);
await run(["bun", "tools/test-results-wiring.ts"]);
await run(["bun", "tools/test-m03-builder-contract.ts"]);
await run(["bun", "tools/test-world-budget-fixtures.ts"]);
await run(["bun", "tools/test-world-environments.ts"]);
await run(["bun", "tools/test-relay-offline.ts"], /^OFFLINE_LUAU_RESULT passed=(\d+) failed=0$/gm, OFFLINE_PASS_FLOOR, {
	summaries: [{ pattern: /^OFFLINE_SPECS registered=(\d+)$/gm, minimum: OFFLINE_SPEC_FLOOR }],
});
await run(["bun", "tools/test-plan-performance.ts"], /^PLAN_PERFORMANCE passed=(36) failed=0$/gm, 36);
await run(["bun", "tools/voice-lines.ts", "--check"]);
await run(["bun", "tools/story-voice-script.ts", "--check"]);
await run(["bun", "tools/test-mission-catalog.ts"], /^MISSION_CATALOG_SNAPSHOT passed=(\d+) failed=0/gm, 19);
await run(["bun", "tools/test-playtest-relay.ts"], /^PLAYTEST_RELAY_REGRESSION passed=(\d+) failed=0$/gm, 3);
await run(["bun", "tools/test-audio-offline.ts"], /^AUDIO_LIFECYCLE_SIMULATION passed=(\d+) failed=0$/gm, 10);
await run(
	["bun", "tools/test-voice-offline.ts"],
	/^VOICE_CONSUMER_RESULT passed=(\d+); simulated lifecycle only, audible output NOT tested$/gm,
	8,
);
await run(
	["bun", "tools/test-cinematic-offline.ts"],
	/^CINEMATIC_STAGE_RESULT passed=(\d+); engine doubles only, rendering NOT tested$/gm,
	10,
);
await run(["bun", "tools/test-radio-delivery.ts"], /^RADIO_DELIVERY passed=(4) failed=0$/gm, 4);
// Three summaries from one script: compiled gun input, HUD sanitizer and touch callbacks.
await run(["bun", "tools/test-client-gun-input.ts"], /^CLIENT_GUN_INPUT passed=(\d+) failed=0;/gm, 6, {
	summaries: [
		{ pattern: /^CLIENT_GUN_HUD passed=(\d+) failed=0;/gm, minimum: 6 },
		{ pattern: /^CLIENT_GUN_TOUCH passed=(\d+) failed=0;/gm, minimum: 3 },
	],
});
// The gate just built the place, so the place-dependent Python test must run, not skip.
await run(["python3", "-I", "-m", "unittest", "discover", "-s", "tools/tests", "-p", "test_*.py"], undefined, 0, {
	env: { SKYBREAK_REQUIRE_PLACE: "1" },
});
await run(["bun", "tools/relay-tables.ts", "--check"]);
await run(["bun", "tools/world-report.ts", "--check"]);
