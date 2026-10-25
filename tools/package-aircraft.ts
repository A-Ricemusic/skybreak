// Package Blender's exact geometry as server-only data for Rojo.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
await mkdir(resolve(root, "build"), { recursive: true });
const assets = [
	{ name: "Kestrel", source: "assets/aircraft/kestrel.mesh.json", triangleLimit: 20000 },
	{ name: "Vanta", source: "assets/aircraft/vanta.mesh.json", triangleLimit: 20000 },
	{ name: "Warehouse", source: "assets/mission/warehouse.mesh.json", triangleLimit: 5000 },
	{ name: "Radar", source: "assets/mission/radar.mesh.json", triangleLimit: 5000 },
	{ name: "Lifeboat", source: "assets/mission/lifeboat.mesh.json", triangleLimit: 5000 },
] as const;

for (const asset of assets) {
	const geometry = await Bun.file(resolve(root, asset.source)).json();
	if (
		geometry.schema !== "skybreak.triangulated-mesh.v1" ||
		!Array.isArray(geometry.vertices) ||
		geometry.vertices.length === 0 ||
		!Array.isArray(geometry.faces) ||
		geometry.faces.length === 0 ||
		geometry.faces.length > asset.triangleLimit
	) {
		throw new Error(`Missing, incompatible, or over-budget ${asset.name} geometry export`);
	}
	await Bun.write(resolve(root, `build/${asset.name}Geometry.txt`), JSON.stringify(geometry));
}
