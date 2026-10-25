// Package Blender's exact geometry as server-only data for Rojo.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
await mkdir(resolve(root, "build"), { recursive: true });
for (const name of ["Kestrel", "Vanta"]) {
	const geometry = await Bun.file(resolve(root, `assets/aircraft/${name.toLowerCase()}.mesh.json`)).json();
	if (geometry.schema !== "skybreak.triangulated-mesh.v1" || geometry.faces.length === 0) {
		throw new Error(`Missing or incompatible ${name} geometry export`);
	}
	await Bun.write(resolve(root, `build/${name}Geometry.txt`), JSON.stringify(geometry));
}
