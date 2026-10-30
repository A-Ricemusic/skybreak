// Builds build/terrain-bench.rbxlx: the real game plus the throwaway terrain bench server script.
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "../..");
const project = await Bun.file(resolve(root, "default.project.json")).json();
function absolute(v: any) { if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "$path") v[k] = resolve(root, x as string); else absolute(x); } }
absolute(project);
project.tree.ServerScriptService.TerrainBench = { $path: resolve(root, "tools/spikes/terrain-bench.server.luau") };
await Bun.write(resolve(root, "build/terrain-bench.project.json"), JSON.stringify(project, null, 2));
const p = Bun.spawn(["rojo", "build", "build/terrain-bench.project.json", "-o", "build/terrain-bench.rbxlx"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (await p.exited !== 0) throw new Error("bench place build failed");
