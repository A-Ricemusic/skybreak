import { lstat, readdir, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const dryRun = process.argv.includes("--dry-run");
const removed: string[] = [];
let reclaimedBytes = 0;

async function sizeOf(path: string): Promise<number> {
	const stat = await lstat(path);
	if (!stat.isDirectory()) return stat.size;

	let total = 0;
	for (const entry of await readdir(path)) {
		total += await sizeOf(resolve(path, entry));
	}
	return total;
}

async function removePath(path: string): Promise<void> {
	try {
		reclaimedBytes += await sizeOf(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}

	removed.push(relative(root, path));
	if (!dryRun) await rm(path, { recursive: true, force: true });
}

// roblox-ts recreates both directories during the next build.
await removePath(resolve(root, "out"));
await removePath(resolve(root, "include"));

// These files are generated entirely by the Blender Python sources. Keep the
// mesh JSON because tools/package-aircraft.ts consumes it during every build.
for (const aircraft of ["kestrel", "vanta"]) {
	for (const suffix of [".blend", ".blend1", ".fbx", ".glb", ".stats.json", "-three-quarter.png", "-top.png"]) {
		await removePath(resolve(root, `assets/aircraft/${aircraft}${suffix}`));
	}
}

const build = resolve(root, "build");
try {
	for (const entry of await readdir(build, { withFileTypes: true })) {
		if (entry.name === "screenshots") continue;
		if (entry.name === "skybreak.rbxlx" || entry.name === "skybreak.rbxlx.lock") continue;

		const isDisposable =
			entry.name === "KestrelGeometry.txt" ||
			entry.name === "VantaGeometry.txt" ||
			entry.name === "skybreak-tests.rbxlx" ||
			entry.name === "test-game.rbxlx" ||
			entry.name === "test-game.rbxlx.lock" ||
			entry.name.endsWith(".log") ||
			entry.name.endsWith(".tmp") ||
			entry.name.endsWith(".temp") ||
			entry.name.startsWith("jest-");
		if (isDisposable) await removePath(resolve(build, entry.name));
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const screenshots = resolve(build, "screenshots");
try {
	for (const entry of await readdir(screenshots, { withFileTypes: true })) {
		if (entry.isFile() && /^redesign-.*\.jpg$/i.test(entry.name)) continue;
		await removePath(resolve(screenshots, entry.name));
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const action = dryRun ? "Would remove" : "Removed";
console.log(`${action} ${removed.length} artifact path(s), ${reclaimedBytes} byte(s).`);
for (const path of removed) console.log(`- ${path}`);
console.log("Preserved build/skybreak.rbxlx, its Studio lock, and build/screenshots/redesign-*.jpg.");
