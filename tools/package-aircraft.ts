// Package Blender's exact geometry as server-only data for Rojo.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const geometry = await Bun.file(resolve(root, "assets/aircraft/kestrel.mesh.json")).json();
if (geometry.schema !== "skybreak.triangulated-mesh.v1" || geometry.faces.length === 0) {
	throw new Error("Missing or incompatible Kestrel geometry export");
}
await mkdir(resolve(root, "build"), { recursive: true });
await Bun.write(resolve(root, "build/KestrelGeometry.txt"), JSON.stringify(geometry));
