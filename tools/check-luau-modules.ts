// Compile the unmodified rbxtsc output without executing Roblox code. TypeScript
// compilation alone misses Luau register limits; pure-domain tests omit runtimes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";
import { buildRequireGraph, checkRequireGraph } from "./luau-require-graph";
import { spawnWithTimeout } from "./spawn";

const root = resolve(import.meta.dir, "..");
const files = [
	...new Bun.Glob("{server,shared,tests,client}/**/*.luau").scanSync({ cwd: resolve(root, "out") }),
].sort();
if (files.length === 0) throw new Error("No compiled Luau modules; run bun run build first");
const sources = new Map<string, string>();
const chunks = [
	"local checked = 0",
	"local function check(name, source) local fn, err = loadstring(source, name); assert(fn, err); checked += 1 end",
];
function literal(source: string): string {
	let equals = "=";
	while (source.includes(`]${equals}]`)) equals += "=";
	return `[${equals}[\n${source}]${equals}]`;
}
for (const file of files) {
	const source = await readFile(resolve(root, "out", file), "utf8");
	chunks.push(`check(${JSON.stringify(file)}, ${literal(source)})`);
	sources.set(file, source);
}

// Negative fixtures: the graph check must reject each of these in-memory trees,
// so a resolver regression cannot silently drop edges again.
const sibling = (name: string) => `local x = TS.import(script, script.Parent, "${name}")\n`;
const shared = (service: string, ...path: string[]) =>
	`local x = TS.import(script, game:GetService("${service}"), ${path.map((part) => `"${part}"`).join(", ")})\n`;
const FIXTURES: Array<{ name: string; tree: Record<string, string>; error?: RegExp; visited?: number }> = [
	{
		name: "client relative cycle",
		tree: { "client/A.luau": sibling("B"), "client/B.luau": sibling("A") },
		error: /require cycle/,
	},
	{
		name: "server absolute cycle",
		tree: {
			"server/A.luau": shared("ServerScriptService", "Server", "B"),
			"server/B.luau": shared("ServerScriptService", "Server", "A"),
		},
		error: /require cycle/,
	},
	{
		name: "shared to client-relative cycle via init",
		tree: {
			"client/init.client.luau": 'local x = TS.import(script, script, "A")\n',
			"client/A.luau": shared("ReplicatedStorage", "Shared", "S"),
			"shared/S.luau": shared("StarterPlayer", "StarterPlayerScripts", "Client", "A"),
		},
		error: /require cycle/,
	},
	{
		name: "client missing relative target",
		tree: { "client/A.luau": sibling("Gone") },
		error: /Missing compiled import/,
	},
	{
		name: "server missing absolute target",
		tree: { "server/A.luau": shared("ServerScriptService", "Server", "Gone") },
		error: /Missing compiled import/,
	},
	{ name: "unknown service root", tree: { "client/A.luau": shared("Lighting", "X") }, error: /Unsupported absolute/ },
	{
		name: "unparsed import form",
		tree: { "client/A.luau": 'local x = TS.import(script, folder, "X")\n' },
		error: /Unsupported TS\.import form/,
	},
	{
		name: "relative import above project folder",
		tree: { "client/A.luau": 'local x = TS.import(script, script.Parent.Parent, "X")\n' },
		error: /leaves the project folders/,
	},
	{
		name: "supported forms resolve",
		tree: {
			"client/init.client.luau": 'local x = TS.import(script, script, "A")\n',
			"client/A.luau":
				'local s = TS.import(script, script.Parent, "screens", "S")\n' +
				shared("ReplicatedStorage", "Shared", "missions") +
				shared("ReplicatedStorage", "rbxts_include", "node_modules", "@rbxts", "roact", "src"),
			"client/screens/S.luau": 'local t = TS.import(script, script.Parent.Parent, "Theme")\n',
			"client/Theme.luau": "return {}\n",
			"shared/missions/init.luau": 'local m = TS.import(script, script, "m01")\n',
			"shared/missions/m01.luau": "return {}\n",
		},
		visited: 6,
	},
];
for (const fixture of FIXTURES) {
	const tree = new Map(Object.entries(fixture.tree));
	let failure: unknown;
	let visited = 0;
	try {
		visited = checkRequireGraph(buildRequireGraph(tree), tree.keys()).size;
	} catch (error) {
		failure = error;
	}
	const message = failure instanceof Error ? failure.message : String(failure);
	if (fixture.error ? !fixture.error.test(message) : failure !== undefined || visited !== fixture.visited) {
		throw new Error(
			`Require-graph fixture "${fixture.name}" did not behave as expected: ${failure ? message : `visited=${visited}`}`,
		);
	}
}
console.log(`LUAU_REQUIRE_GRAPH_FIXTURES passed=${FIXTURES.length} failed=0`);

// Check actual emitted requires, not erased TypeScript type-only dependencies, from
// every production root. Tests are compiled and parsed for import forms, not walked.
const graph = buildRequireGraph(sources);
const done = checkRequireGraph(
	graph,
	files.filter((file) => /^(server|client|shared)\//.test(file)),
);
chunks.push('print("LUAU_MODULE_COMPILE passed=" .. checked .. " failed=0")');
const directory = resolve(root, "build/offline-module-compile");
await mkdir(directory, { recursive: true });
const harness = resolve(directory, "check.luau");
await writeFile(harness, chunks.join("\n"));
const proc = await spawnWithTimeout([requireLuauBin(), harness], { cwd: root, stdout: "pipe", stderr: "inherit" });
const output = proc.stdout;
console.log(output);
// Some standalone Luau builds return zero even after a runtime assertion.
if (proc.code !== 0 || !output.split(/\r?\n/).includes(`LUAU_MODULE_COMPILE passed=${files.length} failed=0`)) {
	throw new Error("Compiled Luau module check failed or did not finish");
}
console.log(`LUAU_REQUIRE_GRAPH passed=${done.size} failed=0`);
