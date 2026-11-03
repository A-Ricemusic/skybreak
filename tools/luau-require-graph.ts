// Resolves rbxtsc `TS.import` calls in emitted Luau to compiled files under out/.
// Shared by check-luau-modules.ts (require-graph gate) and test-relay-offline.ts
// (offline staging manifest validation). Any project-import form this resolver does
// not recognise throws instead of silently dropping the edge.

/** Rojo instance prefixes (see default.project.json / test.project.json) mapped to out/ folders. */
const PROJECT_ROOTS: ReadonlyArray<readonly [readonly string[], string]> = [
	[["ReplicatedStorage", "Shared"], "shared"],
	[["ServerScriptService", "Server"], "server"],
	[["ServerStorage", "Tests"], "tests"],
	[["StarterPlayer", "StarterPlayerScripts", "Client"], "client"],
];
/** Package roots that are deliberately outside the project graph. */
const EXTERNAL_ROOTS: ReadonlyArray<readonly string[]> = [["ReplicatedStorage", "rbxts_include"]];

export type ResolvedImport =
	{ kind: "project"; file: string; source: string } | { kind: "external"; path: string; source: string };

const IMPORT_CALL = /TS\.import\(script, (game:GetService\("([^"]+)"\)|script((?:\.Parent)*))((?:, "[^"\n]+")+)\)/y;

/** Instance path (out/-relative segments) of the module a compiled file defines. */
export function instancePath(file: string): string[] {
	const segments = file.replace(/\.luau$/, "").split("/");
	const last = segments.pop()!.replace(/\.(server|client)$/, "");
	// Rojo turns init(.server|.client).luau into the containing folder itself.
	if (last !== "init") segments.push(last);
	return segments;
}

function startsWith(segments: string[], prefix: readonly string[]): boolean {
	return prefix.every((part, index) => segments[index] === part);
}

/** Resolve one instance path to the compiled ModuleScript file that defines it. */
function moduleFile(path: string[], files: ReadonlySet<string>, from: string, call: string): string {
	const base = path.join("/");
	for (const candidate of [`${base}.luau`, `${base}/init.luau`]) if (files.has(candidate)) return candidate;
	throw new Error(`Missing compiled import: ${base} (from ${from}: ${call})`);
}

/**
 * Every `TS.import(` in `source`, resolved. Throws on missing targets and on
 * import forms that cannot be resolved (unknown service roots, `.Parent` chains
 * that leave the project folders, or text the parser does not recognise).
 */
export function resolveImports(file: string, source: string, files: ReadonlySet<string>): ResolvedImport[] {
	const results: ResolvedImport[] = [];
	for (let index = source.indexOf("TS.import("); index >= 0; index = source.indexOf("TS.import(", index + 1)) {
		IMPORT_CALL.lastIndex = index;
		const match = IMPORT_CALL.exec(source);
		if (!match) {
			const snippet = source.slice(index, index + 160).split("\n")[0];
			throw new Error(`Unsupported TS.import form in ${file}: ${snippet}`);
		}
		const call = match[0];
		const names = [...match[4].matchAll(/"([^"]+)"/g)].map((part) => part[1]);
		if (match[2] !== undefined) {
			const absolute = [match[2], ...names];
			if (EXTERNAL_ROOTS.some((prefix) => startsWith(absolute, prefix))) {
				results.push({ kind: "external", path: absolute.join("/"), source: call });
				continue;
			}
			const root = PROJECT_ROOTS.find(([prefix]) => startsWith(absolute, prefix));
			if (!root) throw new Error(`Unsupported absolute TS.import root in ${file}: ${call}`);
			const path = [root[1], ...absolute.slice(root[0].length)];
			results.push({ kind: "project", file: moduleFile(path, files, file, call), source: call });
			continue;
		}
		const parents = match[3].length / ".Parent".length;
		const self = instancePath(file);
		// The top-level out/ folder is the deepest ancestor a project import may reach.
		if (parents >= self.length)
			throw new Error(`Relative TS.import leaves the project folders in ${file}: ${call}`);
		const path = [...self.slice(0, self.length - parents), ...names];
		results.push({ kind: "project", file: moduleFile(path, files, file, call), source: call });
	}
	return results;
}

/** Project-only require edges for every compiled file. */
export function buildRequireGraph(sources: ReadonlyMap<string, string>): Map<string, string[]> {
	const files = new Set(sources.keys());
	const graph = new Map<string, string[]>();
	for (const [file, source] of sources) {
		const edges = resolveImports(file, source, files).flatMap((entry) =>
			entry.kind === "project" ? [entry.file] : [],
		);
		graph.set(file, edges);
	}
	return graph;
}

/** Depth-first walk from `roots`; throws on a cycle or an unknown node. Returns visited files. */
export function checkRequireGraph(graph: ReadonlyMap<string, string[]>, roots: Iterable<string>): Set<string> {
	const done = new Set<string>();
	const active: string[] = [];
	function visit(file: string): void {
		const cycle = active.indexOf(file);
		if (cycle >= 0) throw new Error(`Luau require cycle: ${[...active.slice(cycle), file].join(" -> ")}`);
		if (done.has(file)) return;
		if (!graph.has(file)) throw new Error(`Missing compiled import: ${file}`);
		active.push(file);
		for (const dependency of graph.get(file)!) visit(dependency);
		active.pop();
		done.add(file);
	}
	for (const file of roots) visit(file);
	return done;
}
