// Shared PR/publish gate. Never invokes test:roblox (which launches Studio).
// Compile once, then run the existing compiled contracts and generated-doc checks.
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
async function run(command: string[], summary?: RegExp, minimum = 0) {
  console.log(`> ${command.join(" ")}`);
  const proc = Bun.spawn(command, { cwd: root, stdout: "pipe", stderr: "inherit" });
  const stdout = await new Response(proc.stdout).text();
  console.log(stdout);
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${command.join(" ")} exited ${code}`);
  if (summary) {
    const matches = [...stdout.matchAll(summary)];
    if (matches.length !== 1 || Number(matches[0][1]) < minimum) {
      throw new Error(`Missing, failed or incomplete test summary: ${command.join(" ")}`);
    }
  }
}

await run(["bun", "tools/check-no-react-agent-testing.ts"], /^NO_REACT_AGENT_TESTING passed tracked=(\d+)$/gm, 1);
await run(["bun", "test", "tools/tests/check-ac04-only.test.ts"]);
await run(["bun", "tools/check-ac04-only.ts"]);
await run(["bun", "run", "build:place"]);
await run(["bun", "tools/test-ac04-offline.ts"], /^OFFLINE_LUAU_RESULT passed=(\d+) failed=0$/gm, 381);
await run(["bun", "tools/test-audio-offline.ts"], /^AUDIO_LIFECYCLE_SIMULATION passed=(\d+) failed=0$/gm, 10);
await run(["python3", "-m", "unittest", "discover", "-s", "tools/tests", "-p", "test_*.py"]);
await run(["bun", "tools/ac04-voice-lines.ts", "--check"]);
