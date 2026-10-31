// Bun orchestrates compilation and Studio; Jest itself runs in Roblox's Luau VM.
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const timeoutMs = Number(process.env.ROBLOX_TEST_TIMEOUT_MS ?? 1_200_000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
	throw new Error("ROBLOX_TEST_TIMEOUT_MS must be a positive integer in milliseconds");
}
const run = async (command: string[]) => {
	const process = Bun.spawn(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
	if ((await process.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
};
await mkdir(resolve(root, "build"), { recursive: true });
// A failed build or Studio launch must not leave a previous run's green summary.
await rm(resolve(root, "build/jest-results.json"), { force: true });
await run(["bun", "run", "build"]);
const place = resolve(root, "build/skybreak-tests.rbxlx");
await run(["rojo", "build", "test.project.json", "-o", place]);
const output = resolve(root, "build/jest-output.log");
const launchLog = resolve(root, "build/jest-studio.log");
const errorLog = resolve(root, "build/jest-studio-stderr.log");
await Promise.all([output, launchLog, errorLog].map((path) => rm(path, { force: true })));
const executable = process.env.ROBLOX_STUDIO_PATH ?? "/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio";
const studio = Bun.spawn([
	executable, "--task", "RunScript", "--localPlaceFile", place,
	"--runScriptFile", resolve(root, "tools/run-jest.luau"),
	"--outputFile", output, "--quitAfterExecution",
], { cwd: root, stdout: Bun.file(launchLog), stderr: Bun.file(errorLog) });
const deadline = Date.now() + timeoutMs;
let summary: { success: boolean; passed: number; failed: number; suites: number; total: number } | undefined;
while (Date.now() < deadline) {
	const text = await Bun.file(output).text().catch(() => "");
	const match = text.match(/SKYBREAK_JEST_RESULT:(\{[^\r\n]+\})/);
	if (match) { summary = JSON.parse(match[1]); break; }
	if (studio.exitCode !== null) break;
	await Bun.sleep(500);
}
if (!summary) {
	studio.kill();
	throw new Error(`Studio did not report test results. Inspect ${output} and ${launchLog}.`);
}
console.log(JSON.stringify(summary, null, 2));
await Bun.write(resolve(root, "build/jest-results.json"), JSON.stringify(summary, null, 2) + "\n");
if (!summary.success || summary.total === 0) process.exitCode = 1;
