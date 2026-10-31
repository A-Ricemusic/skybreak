// Compile the unmodified rbxtsc output without executing Roblox code. TypeScript
// compilation alone misses Luau register limits; pure-domain tests omit runtimes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";

const root = resolve(import.meta.dir, "..");
const files = [...new Bun.Glob("{server,shared,tests,client}/**/*.luau").scanSync({ cwd: resolve(root, "out") })].sort();
if (files.length === 0) throw new Error("No compiled Luau modules; run bun run build first");
const graph = new Map<string, string[]>();
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
  // rbxtsc emits absolute Rojo paths for imports among these project folders.
  const edges: string[] = [];
  for (const match of source.matchAll(/TS\.import\(script, game:GetService\("[^"]+"\), "(Server|Shared)", ((?:"[^"]+"(?:, )?)+)\)/g)) {
    const path = [...match[2].matchAll(/"([^"]+)"/g)].map(part => part[1]).join("/");
    const target = `${match[1].toLowerCase()}/${path}`;
    edges.push(files.includes(`${target}.luau`) ? `${target}.luau` : `${target}/init.luau`);
  }
  graph.set(file, edges);
}
// Check actual emitted requires, not erased TypeScript type-only dependencies.
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
for (const file of files.filter(file => file.startsWith("server/"))) visit(file);
chunks.push('print("LUAU_MODULE_COMPILE passed=" .. checked .. " failed=0")');
const directory = resolve(root, "build/offline-module-compile");
await mkdir(directory, { recursive: true });
const harness = resolve(directory, "check.luau");
await writeFile(harness, chunks.join("\n"));
const proc = Bun.spawn([requireLuauBin(), harness], { cwd: root, stdout: "pipe", stderr: "inherit" });
const output = await new Response(proc.stdout).text();
console.log(output);
// Some standalone Luau builds return zero even after a runtime assertion.
if (await proc.exited !== 0 || !output.split(/\r?\n/).includes(`LUAU_MODULE_COMPILE passed=${files.length} failed=0`)) {
  throw new Error("Compiled Luau module check failed or did not finish");
}
console.log(`LUAU_REQUIRE_GRAPH passed=${done.size} failed=0`);
