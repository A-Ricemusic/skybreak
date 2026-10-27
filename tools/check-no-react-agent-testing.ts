// Guard: the standalone React + Codex/Playwright browser "agent testing" harness
// (formerly react-agent-testing/) was intentionally removed. Fail if it, or a web
// React/DOM browser-test stack, is re-added to any tracked path. Roblox UI/tests
// use @rbxts/react, @rbxts/react-roblox and @rbxts/jest*, which are allowed.
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const FORBIDDEN_DIR = "react-agent-testing";
const FORBIDDEN_DEPS = new Set(["react", "react-dom", "@vitejs/plugin-react", "playwright", "@playwright/test", "vite"]);
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const REMOVED =
	"The React agent testing harness (react-agent-testing/, React + Codex/Playwright browser tests) was intentionally removed and must not be re-added. Roblox tests use @rbxts/jest via `bun run test:roblox`.";

const proc = Bun.spawnSync(["git", "ls-files", "-z", "--cached"], { cwd: root });
if (proc.exitCode !== 0) throw new Error(`git ls-files failed: ${proc.stderr.toString()}`);
const tracked = proc.stdout
	.toString()
	.split("\0")
	.filter((path) => path !== "");

const errors: string[] = [];
for (const path of tracked) {
	const segments = path.split("/");
	if (segments.includes("node_modules")) continue;
	if (segments.includes(FORBIDDEN_DIR)) errors.push(`tracked path ${path}`);
	if (segments[segments.length - 1] !== "package.json") continue;
	const file = Bun.file(resolve(root, path));
	if (!(await file.exists())) continue; // deleted in the working tree
	const manifest = (await file.json()) as Record<string, unknown>;
	for (const field of DEP_FIELDS) {
		const deps = manifest[field];
		if (typeof deps !== "object" || deps === null) continue;
		for (const name of Object.keys(deps)) {
			if (FORBIDDEN_DEPS.has(name)) errors.push(`${path} ${field} -> ${name}`);
		}
	}
}

if (errors.length > 0) {
	console.error(`NO_REACT_AGENT_TESTING failed:\n${errors.map((e) => `  - ${e}`).join("\n")}\n${REMOVED}`);
	process.exit(1);
}
console.log(`NO_REACT_AGENT_TESTING passed tracked=${tracked.length}`);
